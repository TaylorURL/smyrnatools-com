import { useEffect, useRef, useState } from 'react'

import { ScheduleBucketService } from '../../services/ScheduleBucketService'
import { parseDailyOrderHtml } from '../../utils/DailyOrderParser'

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Keeps `plantProduction` in lockstep with the daily schedule bucket.
 *
 * The Tampermonkey script on the dispatch workstation uploads today + 7 days
 * of schedule HTMLs to Supabase storage every 5 minutes. This hook pulls the
 * file for the currently-viewed plan date, parses it, and overwrites the
 * production object — preserving the `_meta` blob (special/QC jobs, formatted
 * notes) so user-authored plan metadata survives re-syncs.
 *
 * For dates that aren't in the bucket (past dates, far-future dates), the
 * fetch returns null and we leave whatever's already in state untouched.
 */
export function useScheduleSync({ planDate, plants, setPlantProduction, enabled = true }) {
    const [lastSyncedAt, setLastSyncedAt] = useState(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const plantsRef = useRef(plants)
    plantsRef.current = plants
    const setPlantProductionRef = useRef(setPlantProduction)
    setPlantProductionRef.current = setPlantProduction

    useEffect(() => {
        if (!enabled || !planDate) return
        let cancelled = false

        const sync = async () => {
            if (cancelled) return
            setIsSyncing(true)
            try {
                const html = await ScheduleBucketService.fetchScheduleByDate(planDate)
                if (cancelled) return
                if (!html) {
                    // No file in the bucket for this date — fine, leave state alone.
                    return
                }
                const production = parseDailyOrderHtml(html, plantsRef.current)
                if (cancelled || !production || Object.keys(production).length === 0) return

                setPlantProductionRef.current((prev) => {
                    const next = { ...production }
                    if (prev && prev._meta) next._meta = prev._meta
                    // Return same reference when nothing changed so autosave
                    // doesn't fire on every sync tick when bucket is stable.
                    if (JSON.stringify(prev) === JSON.stringify(next)) return prev
                    return next
                })
                setLastSyncedAt(new Date())
            } catch (err) {
                if (!cancelled) console.warn('[useScheduleSync]', err)
            } finally {
                if (!cancelled) setIsSyncing(false)
            }
        }

        sync() // Initial fetch on mount / date change
        const interval = setInterval(sync, SYNC_INTERVAL_MS)

        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [planDate, enabled])

    return { isSyncing, lastSyncedAt }
}
