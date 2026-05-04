import { useCallback, useEffect, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { DispatchDataService } from '../../services/DispatchDataService'

/* Safety interval — short enough that even when realtime is down (publication
 * misconfigured, websocket dropped) the schedule still feels live, long
 * enough that we're not hammering the API in the steady state. */
const SYNC_INTERVAL_MS = 60 * 1000
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

    // Realtime: any change on dispatch_data triggers a debounced re-sync.
    // We don't filter the payload by `order_date` — DELETE events ship
    // only a partial `old` row that may not include order_date, so an
    // overzealous filter ate every event and the schedule never updated
    // without a manual refresh. The re-sync inside `sync()` is keyed by
    // the current planDate via `planDateRef`, so unrelated dates trigger
    // at most one cheap refetch — a fair price for not missing changes.
    useEffect(() => {
        if (!enabled) return undefined
        const channelName = `dispatch-data-schedule-${Date.now()}`
        const onChange = () => {
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
            realtimeDebounceRef.current = setTimeout(() => sync(), REALTIME_DEBOUNCE_MS)
        }
        const channel = Database.channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_data' }, onChange)
            .subscribe((status, err) => {
                // Surface a hard failure in the console — a silent
                // CHANNEL_ERROR is what kept the original bug invisible.
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('[useScheduleSync] realtime subscription failed:', status, err?.message || '')
                }
            })
        return () => {
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
            Database.removeChannel(channel)
        }
    }, [enabled, sync])

    return { fileUpdatedAt, isSyncing, lastSyncedAt, refresh: sync }
}
