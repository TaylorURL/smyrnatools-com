import { useMemo } from 'react'

import { parseLocal } from '../components/dayforce/schedules/scheduleFormatters'
import useDayforceOperatorMetrics from './useDayforceOperatorMetrics'

/** The clock-in board staffs concrete pours, so only Mixer Operators have a
 *  generated clock-in to audit against. Tractor operators (aggregate hauling)
 *  are a separate operation and never appear on the board. */
const CLOCK_IN_POSITION = 'Mixer Operator'

/**
 * Manager-scheduled mixer-operator clock-in times (minute-of-day, Central wall
 * clock) for the plan date, grouped by plant. Sourced from Dayforce's
 * `scheduled_in_at` through the shared operator-metrics pipeline, so it reuses
 * the same name/badge matching and org-unit → plant resolution every other
 * Dayforce surface relies on. That makes it directly comparable to the clock-in
 * board's generated times for an adherence audit.
 *
 * `scheduledClockInsByPlant` is `Map<plantCode, number[]>` of minute-of-day
 * values; empty until the Dayforce fetch resolves and for any plant whose
 * manager hasn't built (or hasn't synced) a schedule for the day yet.
 *
 * @param {object} params
 * @param {string} params.planDate `YYYY-MM-DD` of the plan day
 * @param {string[]} params.plantCodes plant codes in the current dashboard scope
 */
export default function useOperatorScheduledClockIns({ planDate, plantCodes }) {
    const dateRange = useMemo(() => (planDate ? { end: planDate, start: planDate } : null), [planDate])

    const { isLoading, perShift } = useDayforceOperatorMetrics({ dateRange, plantCodes })

    const scheduledClockInsByPlant = useMemo(() => {
        const byPlant = new Map()
        for (const shift of perShift || []) {
            if (shift.shiftDate !== planDate || shift.position !== CLOCK_IN_POSITION) continue
            const scheduledStart = parseLocal(shift.scheduledInAt)
            if (!scheduledStart) continue
            const minuteOfDay = scheduledStart.getHours() * 60 + scheduledStart.getMinutes()
            const code = String(shift.plantCode)
            if (!byPlant.has(code)) byPlant.set(code, [])
            byPlant.get(code).push(minuteOfDay)
        }
        return byPlant
    }, [perShift, planDate])

    return { isLoading, scheduledClockInsByPlant }
}
