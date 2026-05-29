import { useEffect, useMemo, useState } from 'react'

import { ScheduleSnapshotService } from '../../services/ScheduleSnapshotService'
import { predictSatisfactionFromPlanProduction } from '../../utils/PlanScheduleDataUtility'

/**
 * Past-day "predicted customer satisfaction" sourced from the 5:30 PM
 * `end_of_day` schedule snapshot rather than the live schedule.
 *
 * On today / future days `usePlanScheduleData` already produces a live
 * forecast, so this returns null and defers to it. On past days the live
 * schedule has since drifted (orders get added, moved, cancelled), so we
 * recompute the forecast against the schedule as it stood when it was locked
 * the evening before — the same number a dispatcher would have seen at 5:30 PM.
 *
 * Returns the standard satisfaction envelope (tagged `isSnapshot: true`) or
 * null when no snapshot exists for the date (Sunday skip, empty day, or a date
 * that predates the snapshot cron).
 *
 * @param {object} params
 * @param {Array} params.assignments current (frozen) planner help assignments
 * @param {object} params.filters memoized active schedule filter scope
 * @param {Function} params.getTravelTime `(fromPlant, toPlant) => minutes`
 * @param {boolean} params.isPastDay whether the viewed schedule is in the past
 * @param {string} params.planDate `YYYY-MM-DD` of the schedule day
 * @param {Array} params.stats per-plant insight rows feeding the base pool
 */
export function usePlanScheduleSnapshotPrediction({ assignments, filters, getTravelTime, isPastDay, planDate, stats }) {
    const [snapshotProduction, setSnapshotProduction] = useState(null)

    useEffect(() => {
        if (!isPastDay || !planDate) {
            setSnapshotProduction(null)
            return undefined
        }
        // Clear immediately so navigating between past dates never flashes the
        // previous day's forecast while the next snapshot loads.
        setSnapshotProduction(null)
        let cancelled = false
        ;(async () => {
            const snapshot = await ScheduleSnapshotService.getSnapshot(planDate)
            if (!cancelled) setSnapshotProduction(snapshot?.plant_production ?? null)
        })()
        return () => {
            cancelled = true
        }
    }, [isPastDay, planDate])

    return useMemo(() => {
        if (!snapshotProduction) return null
        return predictSatisfactionFromPlanProduction(snapshotProduction, {
            assignments,
            filters,
            getTravelTime,
            planDate,
            stats
        })
    }, [snapshotProduction, assignments, filters, getTravelTime, planDate, stats])
}
