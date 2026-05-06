import { useCallback, useEffect, useRef, useState } from 'react'

import CallListService from '../../services/CallListService'

/**
 * Backs the Plan -> Call List tab. Owns the dormant-customer roster and the
 * per-customer history map. Exposes actions for logging calls and reloading
 * after a mutation. History is lazy-loaded the first time a customer is
 * expanded and cached locally for the lifetime of the tab.
 */
export function useCallList() {
    const [roster, setRoster] = useState([])
    const [isLoadingRoster, setIsLoadingRoster] = useState(true)
    const [rosterError, setRosterError] = useState(null)
    const [historyByCustomer, setHistoryByCustomer] = useState({})
    const [loadingHistoryFor, setLoadingHistoryFor] = useState(() => new Set())
    const [savingFor, setSavingFor] = useState(() => new Set())
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
            const data = await CallListService.fetchRoster()
            if (!isMountedRef.current) return
            setRoster(data)
        } catch (err) {
            if (!isMountedRef.current) return
            setRosterError(err?.message || 'Failed to load call list')
        } finally {
            if (isMountedRef.current) setIsLoadingRoster(false)
        }
    }, [])

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
                const data = await CallListService.fetchHistory(customerNum)
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
                const entry = await CallListService.logCall({
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
                await CallListService.deleteLog(logId)
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

    return {
        deleteEntry,
        historyByCustomer,
        isLoadingRoster,
        loadHistory,
        loadingHistoryFor,
        logCall,
        refreshRoster: loadRoster,
        roster,
        rosterError,
        savingFor
    }
}

export default useCallList
