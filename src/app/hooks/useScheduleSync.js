import { useCallback, useEffect, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { ScheduleBucketService } from '../../services/ScheduleBucketService'
import { parseDailyOrderHtml } from '../../utils/DailyOrderParser'

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const REALTIME_DEBOUNCE_MS = 1500
const BUCKET_NAME = 'dispatch-reports'

/**
 * Keeps `plantProduction` in lockstep with the daily schedule bucket.
 *
 * The Tampermonkey script on the dispatch workstation uploads today + 7 days
 * of schedule HTMLs to Supabase storage every 5 minutes. This hook:
 *   1. Pulls the file for the currently-viewed plan date on mount / date change.
 *   2. Re-pulls every 5 minutes as a safety net.
 *   3. Subscribes to realtime `storage.objects` events on the bucket, so a
 *      fresh upload triggers an immediate re-sync (debounced).
 *   4. Exposes `refresh()` for manual user-driven refreshes.
 *
 * The `_meta` blob (special/QC jobs, formatted notes) is preserved across
 * every sync so user-authored plan metadata isn't wiped.
 */
export function useScheduleSync({ planDate, plants, setPlantProduction, enabled = true }) {
    const [lastSyncedAt, setLastSyncedAt] = useState(null)
    const [fileUpdatedAt, setFileUpdatedAt] = useState(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const plantsRef = useRef(plants)
    plantsRef.current = plants
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
            const [html, updatedAt] = await Promise.all([
                ScheduleBucketService.fetchScheduleByDate(date),
                ScheduleBucketService.fetchScheduleUpdatedAt(date)
            ])
            if (cancelledRef.current) return false
            if (updatedAt) setFileUpdatedAt(updatedAt)
            if (!html) return false
            const production = parseDailyOrderHtml(html, plantsRef.current)
            if (cancelledRef.current || !production || Object.keys(production).length === 0) return false
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

    // Initial fetch + 5-min safety-net polling.
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

    // Realtime: fire an immediate (debounced) sync whenever a new file lands
    // in the dispatch bucket. Bucket files are named `YYYY-MM-DD.html`, so we
    // only act when the event matches the date currently being viewed.
    useEffect(() => {
        if (!enabled) return undefined
        const channelName = `dispatch-bucket-${BUCKET_NAME}-${Date.now()}`
        const handleStorageChange = (payload) => {
            const objectName = payload?.new?.name || payload?.old?.name || ''
            if (!objectName) return
            const expected = `${planDateRef.current}.html`
            // Tolerate folder prefixes (`region/2026-04-23.html`) by checking
            // the suffix rather than the whole path.
            if (!objectName.endsWith(expected)) return
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
            realtimeDebounceRef.current = setTimeout(() => {
                sync()
            }, REALTIME_DEBOUNCE_MS)
        }
        const channel = Database.channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    filter: `bucket_id=eq.${BUCKET_NAME}`,
                    schema: 'storage',
                    table: 'objects'
                },
                handleStorageChange
            )
            .subscribe()
        return () => {
            if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
            Database.removeChannel(channel)
        }
    }, [enabled, sync])

    return { fileUpdatedAt, isSyncing, lastSyncedAt, refresh: sync }
}
