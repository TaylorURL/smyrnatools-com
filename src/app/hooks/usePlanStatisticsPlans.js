import { useEffect, useState } from 'react'

import { PlanService } from '../../services/PlanService'

/**
 * Owns the saved-`plans`-row fetch + `plansByDate` map for `usePlanStatistics`.
 *
 * Only the Help & Cross-Loading sub-page needs these rows (the rest of the
 * Statistics tab reads ordered/loaded production straight from `dispatch_data`),
 * so the fetch is gated behind `helpCrossLoadingEnabled`.
 *
 * The map is keyed by `plan_date` so per-day pair groupings can walk one
 * entry at a time without scanning the full array each lookup.
 *
 * @param {Object} args
 * @param {boolean} args.helpCrossLoadingEnabled
 * @param {{ current: { start: string, end: string } }} args.range
 * @returns {{ plansByDate: Object }}
 */
export function usePlanStatisticsPlans({ helpCrossLoadingEnabled, range }) {
    const [plansByDate, setPlansByDate] = useState({})

    useEffect(() => {
        if (!helpCrossLoadingEnabled) return undefined
        let cancelled = false
        ;(async () => {
            try {
                const rows = await PlanService.fetchPlansInRange(range.current.start, range.current.end)
                if (cancelled) return
                const map = {}
                ;(rows || []).forEach((row) => {
                    if (row?.plan_date) map[row.plan_date] = row
                })
                setPlansByDate(map)
            } catch (err) {
                if (!cancelled) {
                    console.warn('[usePlanStatisticsPlans] plans fetch failed', err?.message || err)
                    setPlansByDate({})
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [helpCrossLoadingEnabled, range])

    return { plansByDate }
}

export default usePlanStatisticsPlans
