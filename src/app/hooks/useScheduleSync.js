import { useCallback, useEffect, useRef, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'

const SYNC_INTERVAL_MS = 30 * 1000
const UPDATE_CHECK_INTERVAL_MS = 10 * 1000

/**
 * Keeps `plantProduction` in lockstep with the `dispatch_data` table — the
 * canonical source for parsed dispatch report data. The bucket's HTML files
 * are uploaded by the bridge userscript, parsed server-side by the
 * `dispatch-import` edge function, and written to `dispatch_data`.
 *
 *   1. Pulls schedule rows for `planDate` on mount / date change.
 *   2. Polls `fetchLastUpdatedAt` every 10s; a newer timestamp triggers a
 *      re-pull immediately (cheap "is there anything new?" check that
 *      replaces the realtime postgres_changes subscription, which can no
 *      longer reach the locked-down `dispatch_data` table from the anon role).
 *   3. Re-pulls every 30s as a safety net even if the timestamp probe
 *      misses (clock skew, dropped requests).
 *   4. Exposes `refresh()` for manual user-driven refreshes.
 *
 * The `_meta` blob (special/QC jobs, formatted notes) is preserved across
 * every sync so user-authored plan metadata isn't wiped.
 */
// eslint-disable-next-line no-unused-vars
export function useScheduleSync({ planDate, plants: _plants, setPlantProduction, enabled = true }) {
    const [lastSyncedAt, setLastSyncedAt] = useState(null)
    const [fileUpdatedAt, setFileUpdatedAt] = useState(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const setPlantProductionRef = useRef(setPlantProduction)
    setPlantProductionRef.current = setPlantProduction
    const planDateRef = useRef(planDate)
    planDateRef.current = planDate
    const cancelledRef = useRef(false)
    const lastSeenUpdatedAtRef = useRef(null)

    const sync = useCallback(async () => {
        const date = planDateRef.current
        if (!date) return false
        setIsSyncing(true)
        try {
            const [production, updatedAt] = await Promise.all([
                DispatchDataService.fetchSchedule(date),
                DispatchDataService.fetchLastUpdatedAt(date)
            ])
            if (cancelledRef.current) return false
            if (updatedAt) {
                setFileUpdatedAt(updatedAt)
                lastSeenUpdatedAtRef.current = updatedAt.getTime()
            }
            if (!production || Object.keys(production).length === 0) return false
            setPlantProductionRef.current((prev) => {
                const next = { ...production }
                if (prev && prev._meta) next._meta = prev._meta
                if (JSON.stringify(prev) === JSON.stringify(next)) return prev
                return next
            })
            setLastSyncedAt(new Date())
            return true
        } catch (err) {
            if (!cancelledRef.current) console.warn('[useScheduleSync]', err)
            return false
        } finally {
            if (!cancelledRef.current) setIsSyncing(false)
        }
    }, [])

    useEffect(() => {
        if (!enabled || !planDate) return undefined
        cancelledRef.current = false
        lastSeenUpdatedAtRef.current = null
        sync()
        const safetyInterval = setInterval(sync, SYNC_INTERVAL_MS)
        const updateCheckInterval = setInterval(async () => {
            try {
                const updatedAt = await DispatchDataService.fetchLastUpdatedAt(planDateRef.current)
                if (cancelledRef.current || !updatedAt) return
                const ts = updatedAt.getTime()
                if (lastSeenUpdatedAtRef.current == null || ts > lastSeenUpdatedAtRef.current) {
                    sync()
                }
            } catch {
                // Network blips fall back to the next safety interval tick.
            }
        }, UPDATE_CHECK_INTERVAL_MS)
        return () => {
            cancelledRef.current = true
            clearInterval(safetyInterval)
            clearInterval(updateCheckInterval)
        }
    }, [planDate, enabled, sync])

    return { fileUpdatedAt, isSyncing, lastSyncedAt, refresh: sync }
}
