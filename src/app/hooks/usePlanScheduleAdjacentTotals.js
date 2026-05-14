import { useMemo } from 'react'

import { clean } from '../../utils/PlanScheduleUtility'
import { getDayOfWeekForDate, getOffsetDate, isClosedDay } from '../../utils/PlanUtility'

/**
 * Day-over-day + week-to-date yardage roll-ups for the schedule's KPI
 * strip. Kept separate from `usePlanScheduleData` so the bulky pool /
 * order pipeline doesn't have to re-run when only the adjacent fetch
 * cache changes.
 *
 * Free-text search and status pills are intentionally NOT mirrored into
 * `adjacentDayOrderFilter` — they're display filters, not scoping
 * filters, and applying them to historical days would make the
 * comparison incoherent.
 */
export function usePlanScheduleAdjacentTotals({
    adjacentProduction,
    minYards,
    planDate,
    plantFilterSet,
    productFilter,
    sumDayYardage,
    totalYards
}) {
    /** Most recent NON-CLOSED day before planDate. Skips Sundays (plants
     *  closed). On Mondays we return null instead of snapping to Saturday
     *  — comparing Monday production to a half-crew Saturday is misleading,
     *  so the badge simply hides on Mondays. */
    const previousBusinessDate = useMemo(() => {
        if (!planDate) return null
        const planDayOfWeek = getDayOfWeekForDate(planDate)
        if (planDayOfWeek === 1) return null
        for (let offset = -1; offset >= -7; offset--) {
            const candidate = getOffsetDate(planDate, offset)
            if (!isClosedDay(candidate)) return candidate
        }
        return null
    }, [planDate])

    const previousBusinessDayLabel = useMemo(() => {
        if (!previousBusinessDate) return ''
        return new Date(previousBusinessDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    }, [previousBusinessDate])

    /** Predicate that mirrors the toolbar's structural filters (plant /
     *  product / minimum yards) so day-over-day and week totals scope to
     *  the same slice the user is viewing. */
    const adjacentDayOrderFilter = useMemo(() => {
        const minYd = parseFloat(minYards) || 0
        const hasPlantFilter = plantFilterSet.size > 0
        const productCode = productFilter !== 'all' ? productFilter : null
        if (!hasPlantFilter && !productCode && minYd <= 0) return null
        return (order) => {
            if (hasPlantFilter && !plantFilterSet.has(order.plantCode)) return false
            if (productCode && clean(order.productCode) !== productCode) return false
            if (minYd > 0 && (parseFloat(order.yardage) || 0) < minYd) return false
            return true
        }
    }, [minYards, plantFilterSet, productFilter])

    const previousBusinessDayYardage = useMemo(() => {
        if (!previousBusinessDate) return 0
        return sumDayYardage(adjacentProduction?.[previousBusinessDate], adjacentDayOrderFilter)
    }, [adjacentDayOrderFilter, adjacentProduction, previousBusinessDate, sumDayYardage])

    /** Mon–Sat date strings of the week containing planDate. Sunday is
     *  excluded (plants are closed). When planDate is Sunday, the week is
     *  the prior Mon–Sat that just ended. */
    const currentWeekDates = useMemo(() => {
        if (!planDate) return []
        const dow = getDayOfWeekForDate(planDate)
        if (dow == null) return []
        const mondayOffset = dow === 0 ? -6 : -(dow - 1)
        return Array.from({ length: 6 }, (_, i) => getOffsetDate(planDate, mondayOffset + i))
    }, [planDate])

    /** Total yardage for the current Mon–Sat week. Today's yardage comes
     *  from the live `totalYards` (already filtered); every other day is
     *  summed from the adjacent fetch cache with the same structural
     *  filters reapplied so the week total matches the user's view. */
    const weekYardage = useMemo(() => {
        if (currentWeekDates.length === 0) return totalYards
        return currentWeekDates.reduce((sum, date) => {
            if (date === planDate) return sum + totalYards
            return sum + sumDayYardage(adjacentProduction?.[date], adjacentDayOrderFilter)
        }, 0)
    }, [adjacentDayOrderFilter, adjacentProduction, currentWeekDates, planDate, sumDayYardage, totalYards])

    /** Percent change vs the previous business day. Null when that day has
     *  no data so the badge renders nothing instead of a misleading "+∞%". */
    const yardageDeltaPct = useMemo(() => {
        if (!(previousBusinessDayYardage > 0)) return null
        const delta = totalYards - previousBusinessDayYardage
        return Math.round((delta / previousBusinessDayYardage) * 1000) / 10
    }, [totalYards, previousBusinessDayYardage])

    return {
        previousBusinessDayLabel,
        previousBusinessDayYardage,
        weekYardage,
        yardageDeltaPct
    }
}
