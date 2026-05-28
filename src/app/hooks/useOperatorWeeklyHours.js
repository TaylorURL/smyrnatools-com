import { useMemo } from 'react'

import { toDateString } from '../../utils/DayforcePayrollUtility'
import useDayforceOperatorMetrics from './useDayforceOperatorMetrics'

/** Monday (ISO week start) of the week containing `dateString`, as YYYY-MM-DD. */
const isoWeekStart = (dateString) => {
    const date = new Date(`${dateString}T00:00:00`)
    if (Number.isNaN(date.getTime())) return null
    const isoDay = date.getDay() || 7 // Sunday (0) -> 7 so Monday-start math works
    date.setDate(date.getDate() - (isoDay - 1))
    return toDateString(date)
}

/** `dateString` shifted by `deltaDays`, as YYYY-MM-DD. */
const shiftDate = (dateString, deltaDays) => {
    const date = new Date(`${dateString}T00:00:00`)
    if (Number.isNaN(date.getTime())) return null
    date.setDate(date.getDate() + deltaDays)
    return toDateString(date)
}

/**
 * Each operator's hours worked SO FAR this pay week — Dayforce actuals from
 * the ISO-week Monday through the day before `planDate` (the plan day itself
 * is excluded since it hasn't been worked yet). This is the "how many hours
 * does an operator currently have" figure that drives who gets scheduled:
 * the fewest-hours operators are brought in first so the crew's weekly hours
 * stay even.
 *
 * Keyed by smyrnatools operator id (`operatorId` on the Dayforce rollup, the
 * id matched from the Dayforce employee). Empty until the fetch resolves, and
 * empty for the week's first day (nothing worked yet).
 */
export default function useOperatorWeeklyHours({ planDate, plantCodes, selectedPlant }) {
    const dateRange = useMemo(() => {
        if (!planDate) return null
        const start = isoWeekStart(planDate)
        const end = shiftDate(planDate, -1)
        if (!start || !end) return null
        return { end, start }
    }, [planDate])

    const { isLoading, matchedOperatorIds, perOperator } = useDayforceOperatorMetrics({
        dateRange,
        plantCodes,
        selectedPlant
    })

    return useMemo(() => {
        const workedByOperator = new Map()
        for (const row of perOperator || []) {
            if (row.isMatched && row.operatorId) workedByOperator.set(row.operatorId, row.actualHours || 0)
        }
        return { isLoading, matchedOperatorIds: matchedOperatorIds || new Set(), workedByOperator }
    }, [perOperator, matchedOperatorIds, isLoading])
}
