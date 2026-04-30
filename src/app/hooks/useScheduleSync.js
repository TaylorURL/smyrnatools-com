import { useCallback, useEffect, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { DispatchDataService } from '../../services/DispatchDataService'

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const REALTIME_DEBOUNCE_MS = 750

/**
 * Keeps `plantProduction` in lockstep with the `dispatch_data` table — the
 * canonical source for parsed dispatch report data. The bucket's HTML
 * files are still uploaded by the bridge userscript, but they get parsed
 * server-side by the `dispatch-import` edge function and written to
 * `dispatch_data`. This hook reads from there only.
 *
 *   1. Pulls schedule rows for `planDate` on mount / date change.
 *   2. Re-pulls every 5 minutes as a safety net.
 *   3. Subscribes to realtime postgres_changes on `dispatch_data` so any
 *      upsert (from the importer running) triggers a debounced refresh.
 *   4. Exposes `refresh()` for manual user-driven refreshes.
 *
 * The `_meta` blob (special/QC jobs, formatted notes) is preserved across
 * every sync so user-authored plan metadata isn't wiped.
 */
// eslint-disable-next-line no-unused-vars
export function useScheduleSync({ planDate, plants, setPlantProduction, enabled = true }) {
    const [lastSyncedAt, setLastSyncedAt] = useState(null)
    const [fileUpdatedAt, setFileUpdatedAt] = useState(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const setPlantProductionRef = useRef(setPlantProduction)
    setPlantProductionRef.current = setPlantProduction
    const planDateRef = useRef(planDate)
    planDateRef.current = planDate
    const cancelledRef = useRef(false)
    const realtimeDebounceRef = useRef(null)

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
            if (updatedAt) setFileUpdatedAt(updatedAt)
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
        sync()
        const interval = setInterval(sync, SYNC_INTERVAL_MS)
        return () => {
            cancelledRef.current = true
            clearInterval(interval)
        }
    }, [planDate, enabled, sync])

    // Realtime: any change on a dispatch_data row for the current planDate
    // triggers a debounced re-sync. We refetch the whole map rather than
    // patching incrementally — DispatchDataService aggregates per plant
    // and the cost of one re-read is small compared to keeping the merge
    // logic in two places.
    useEffect(() => {
        if (!enabled) return undefined
        const channelName = `dispatch-data-schedule-${Date.now()}`
        const onChange = (payload) => {
            const row = payload?.new || payload?.old
            if (row?.order_date !== planDateRef.current) return
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
            realtimeDebounceRef.current = setTimeout(() => sync(), REALTIME_DEBOUNCE_MS)
        }
        const channel = Database.channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_data' }, onChange)
            .subscribe()
        return () => {
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
            Database.removeChannel(channel)
        }
    }, [enabled, sync])

    return { fileUpdatedAt, isSyncing, lastSyncedAt, refresh: sync }
}
