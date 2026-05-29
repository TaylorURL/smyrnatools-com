import { useCallback, useEffect, useRef, useState } from 'react'

import CrmRosterService from '../../services/CrmRosterService'
import CrmService from '../../services/CrmService'

/**
 * Backs the CRM view. Owns the dormant-customer roster
 * (and, when `includeActive: true` is passed, the broader Directory
 * roster of every customer that's poured in the last year), the
 * per-customer history map, and the per-customer phone-contacts cache
 * that overlays manual edits onto dispatch-derived numbers. History +
 * contacts are lazy-loaded the first time a customer is opened and
 * cached locally for the lifetime of the tab.
 *
 * @param {Object} [options]
 * @param {boolean} [options.includeActive=false] - If true, the roster
 *   includes customers currently pouring (not just dormant). Used by
 *   the Directory page; left false for the Outreach Queue.
 */
export function useCrmRoster({ includeActive = false } = {}) {
    const [roster, setRoster] = useState([])
    const [isLoadingRoster, setIsLoadingRoster] = useState(true)
    const [rosterError, setRosterError] = useState(null)
    const [historyByCustomer, setHistoryByCustomer] = useState({})
    const [contactsByCustomer, setContactsByCustomer] = useState({})
    const [loadingHistoryFor, setLoadingHistoryFor] = useState(() => new Set())
    const [loadingContactsFor, setLoadingContactsFor] = useState(() => new Set())
    const [savingContactFor, setSavingContactFor] = useState(() => new Set())
    const [savingFor, setSavingFor] = useState(() => new Set())
    const [recentActivity, setRecentActivity] = useState([])
    const [isLoadingActivity, setIsLoadingActivity] = useState(false)
    /** Per-user activity rollup for the management Team Monitor surface.
     *  Reusing the `fetchLeaderboard` service method here is intentional —
     *  the edge function endpoint is also called `leaderboard` for
     *  backward compatibility, but consumer-facing state uses the
     *  monitoring-tool framing. */
    const [teamMonitor, setTeamMonitor] = useState({ daysWindow: 30, rows: [] })
    const [isLoadingTeamMonitor, setIsLoadingTeamMonitor] = useState(false)
    const isMountedRef = useRef(true)

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    const loadRoster = useCallback(async () => {
        setIsLoadingRoster(true)
        setRosterError(null)
        try {
            const data = await CrmRosterService.fetchRoster({ includeActive })
            if (!isMountedRef.current) return
            setRoster(data)
        } catch (err) {
            if (!isMountedRef.current) return
            setRosterError(err?.message || 'Failed to load roster')
        } finally {
            if (isMountedRef.current) setIsLoadingRoster(false)
        }
    }, [includeActive])

    useEffect(() => {
        loadRoster()
    }, [loadRoster])

    const loadHistory = useCallback(
        async (customerNum, { force = false } = {}) => {
            if (!customerNum) return
            if (!force && historyByCustomer[customerNum]) return
            setLoadingHistoryFor((prev) => {
                const next = new Set(prev)
                next.add(customerNum)
                return next
            })
            try {
                const data = await CrmRosterService.fetchHistory(customerNum)
                if (!isMountedRef.current) return
                setHistoryByCustomer((prev) => ({ ...prev, [customerNum]: data }))
            } catch {
                if (!isMountedRef.current) return
                setHistoryByCustomer((prev) => ({ ...prev, [customerNum]: [] }))
            } finally {
                if (isMountedRef.current) {
                    setLoadingHistoryFor((prev) => {
                        const next = new Set(prev)
                        next.delete(customerNum)
                        return next
                    })
                }
            }
        },
        [historyByCustomer]
    )

    /** Optimistically prepends the new entry to the customer's cached history
     *  and patches the matching roster row's last_call_* summary so the UI
     *  updates immediately without waiting for a full roster refetch. */
    const applyOptimisticEntry = useCallback((customerNum, entry) => {
        setHistoryByCustomer((prev) => {
            const existing = prev[customerNum] ?? []
            return { ...prev, [customerNum]: [entry, ...existing] }
        })
        setRoster((prev) =>
            prev.map((row) =>
                row.customer_num === customerNum
                    ? {
                          ...row,
                          call_count_last_30: (row.call_count_last_30 || 0) + 1,
                          last_call_at: entry.created_at,
                          last_call_by_name: entry.created_by_name,
                          last_call_comment: entry.comment,
                          last_call_outcome: entry.outcome
                      }
                    : row
            )
        )
        setRecentActivity((prev) => [entry, ...prev].slice(0, 500))
    }, [])

    const logCall = useCallback(
        async ({ customerNum, outcome, comment, customerName, contactName, phone }) => {
            if (!customerNum || !outcome) return null
            setSavingFor((prev) => {
                const next = new Set(prev)
                next.add(customerNum)
                return next
            })
            try {
                const entry = await CrmRosterService.logCall({
                    comment,
                    contactName,
                    customerName,
                    customerNum,
                    outcome,
                    phone
                })
                if (entry && isMountedRef.current) applyOptimisticEntry(customerNum, entry)
                return entry
            } finally {
                if (isMountedRef.current) {
                    setSavingFor((prev) => {
                        const next = new Set(prev)
                        next.delete(customerNum)
                        return next
                    })
                }
            }
        },
        [applyOptimisticEntry]
    )

    /** Removes an entry from the cached history. Roster summary fields
     *  (last_call_*, call_count_last_30) are recomputed from the surviving
     *  entries so the row reflects the new state without a full refetch. */
    const deleteEntry = useCallback(
        async (customerNum, logId) => {
            if (!customerNum || !logId) return false
            try {
                await CrmRosterService.deleteLog(logId)
            } catch {
                return false
            }
            if (!isMountedRef.current) return true
            setHistoryByCustomer((prev) => {
                const existing = prev[customerNum]
                if (!existing) return prev
                const remaining = existing.filter((entry) => entry.id !== logId)
                return { ...prev, [customerNum]: remaining }
            })
            setRecentActivity((prev) => prev.filter((entry) => entry.id !== logId))
            setRoster((prev) =>
                prev.map((row) => {
                    if (row.customer_num !== customerNum) return row
                    const remaining = (historyByCustomer[customerNum] || []).filter((entry) => entry.id !== logId)
                    const next = remaining[0] || null
                    return {
                        ...row,
                        call_count_last_30: Math.max(0, (row.call_count_last_30 || 0) - 1),
                        last_call_at: next?.created_at || null,
                        last_call_by_name: next?.created_by_name || null,
                        last_call_comment: next?.comment || null,
                        last_call_outcome: next?.outcome || null
                    }
                })
            )
            return true
        },
        [historyByCustomer]
    )

    /** Archive a prospect by marking its account 'lost'. The matching roster
     *  row is patched locally so it drops out of the active directory at once
     *  (consumers hide lifecycle_stage === 'lost') without a full refetch. */
    const archiveAccount = useCallback(async (accountId, name) => {
        if (!accountId || !name) return false
        try {
            await CrmService.saveAccount({ id: accountId, lifecycleStage: 'lost', name })
        } catch {
            return false
        }
        if (isMountedRef.current) {
            setRoster((prev) =>
                prev.map((row) => (row.account_id === accountId ? { ...row, lifecycle_stage: 'lost' } : row))
            )
        }
        return true
    }, [])

    const loadContacts = useCallback(
        async (customerNum, { force = false } = {}) => {
            if (!customerNum) return
            if (!force && contactsByCustomer[customerNum]) return
            setLoadingContactsFor((prev) => {
                const next = new Set(prev)
                next.add(customerNum)
                return next
            })
            try {
                const data = await CrmRosterService.fetchContacts(customerNum)
                if (!isMountedRef.current) return
                setContactsByCustomer((prev) => ({ ...prev, [customerNum]: data }))
            } catch {
                if (!isMountedRef.current) return
                setContactsByCustomer((prev) => ({ ...prev, [customerNum]: [] }))
            } finally {
                if (isMountedRef.current) {
                    setLoadingContactsFor((prev) => {
                        const next = new Set(prev)
                        next.delete(customerNum)
                        return next
                    })
                }
            }
        },
        [contactsByCustomer]
    )

    /** Insert or update a phone-number entry. Patches the local cache
     *  optimistically so the editor reflects the new state without
     *  waiting for a refetch. Server enforces the single-primary-per-
     *  customer rule, so we mirror it in the local patch. */
    const saveContact = useCallback(async (customerNum, payload) => {
        if (!customerNum) return null
        setSavingContactFor((prev) => {
            const next = new Set(prev)
            next.add(customerNum)
            return next
        })
        try {
            const saved = await CrmRosterService.saveContact({ ...payload, customerNum })
            if (!saved || !isMountedRef.current) return saved
            setContactsByCustomer((prev) => {
                const existing = prev[customerNum] || []
                const otherRows = existing.filter((row) => row.phone_digits !== saved.phone_digits)
                const next = saved.is_primary
                    ? [saved, ...otherRows.map((row) => ({ ...row, is_primary: false }))]
                    : [saved, ...otherRows]
                return { ...prev, [customerNum]: next }
            })
            return saved
        } finally {
            if (isMountedRef.current) {
                setSavingContactFor((prev) => {
                    const next = new Set(prev)
                    next.delete(customerNum)
                    return next
                })
            }
        }
    }, [])

    /** Remove a phone-number entry. The server hard-deletes manual rows
     *  and soft-hides dispatch-sourced ones; the local cache reflects
     *  the returned row (or strips it when it was hard-deleted). */
    const deleteContact = useCallback(async (customerNum, phoneDigits, phoneDisplay) => {
        if (!customerNum || !phoneDigits) return false
        setSavingContactFor((prev) => {
            const next = new Set(prev)
            next.add(customerNum)
            return next
        })
        try {
            const result = await CrmRosterService.deleteContact({ customerNum, phoneDigits, phoneDisplay })
            if (!isMountedRef.current) return true
            setContactsByCustomer((prev) => {
                const existing = prev[customerNum] || []
                if (result?.action === 'hidden' && result?.data) {
                    const filtered = existing.filter((row) => row.phone_digits !== phoneDigits)
                    return { ...prev, [customerNum]: [...filtered, result.data] }
                }
                return {
                    ...prev,
                    [customerNum]: existing.filter((row) => row.phone_digits !== phoneDigits)
                }
            })
            return true
        } catch {
            return false
        } finally {
            if (isMountedRef.current) {
                setSavingContactFor((prev) => {
                    const next = new Set(prev)
                    next.delete(customerNum)
                    return next
                })
            }
        }
    }, [])

    const loadTeamMonitor = useCallback(async ({ daysWindow = 30 } = {}) => {
        setIsLoadingTeamMonitor(true)
        try {
            const data = await CrmRosterService.fetchLeaderboard({ daysWindow })
            if (isMountedRef.current) setTeamMonitor(data)
        } catch {
            if (isMountedRef.current) setTeamMonitor({ daysWindow, rows: [] })
        } finally {
            if (isMountedRef.current) setIsLoadingTeamMonitor(false)
        }
    }, [])

    const loadRecentActivity = useCallback(async () => {
        setIsLoadingActivity(true)
        try {
            const data = await CrmRosterService.fetchRecentActivity(200)
            if (isMountedRef.current) setRecentActivity(data)
        } catch {
            if (isMountedRef.current) setRecentActivity([])
        } finally {
            if (isMountedRef.current) setIsLoadingActivity(false)
        }
    }, [])

    return {
        archiveAccount,
        contactsByCustomer,
        deleteContact,
        deleteEntry,
        historyByCustomer,
        isLoadingActivity,
        isLoadingRoster,
        isLoadingTeamMonitor,
        loadContacts,
        loadHistory,
        loadRecentActivity,
        loadTeamMonitor,
        loadingContactsFor,
        loadingHistoryFor,
        logCall,
        recentActivity,
        refreshRoster: loadRoster,
        roster,
        rosterError,
        saveContact,
        savingContactFor,
        savingFor,
        teamMonitor
    }
}

export default useCrmRoster
