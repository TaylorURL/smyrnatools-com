import { useMemo } from 'react'

import { canonicalNameKey } from '../../../hooks/useOperatorYardageByDay'
import { WEEKDAYS, YPH_TARGET } from './scheduleConstants'
import { filterExceptionText, shiftHasRedFlag } from './scheduleFlags'
import { addDays, fmtWeekLabel, mondayOf } from './scheduleFormatters'

/** Operator-row sort comparator factory. Sort options are limited to the
 *  ones that make sense in a per-week grid (date-based sort drops out
 *  since the date is now a column, not a row). */
const makeRowComparator = (sortId) => (a, b) => {
    if (sortId === 'hours') return b.weekHours - a.weekHours
    if (sortId === 'varianceDesc') {
        const aVar = Math.abs(a.weekHours - a.weekScheduledHours)
        const bVar = Math.abs(b.weekHours - b.weekScheduledHours)
        return bVar - aVar
    }
    return a.name.localeCompare(b.name)
}

/** Pivot the filtered shifts into a list of week-tables. Each week:
 *    - has Mon–Sat day metadata
 *    - has one row per operator with `byDay` keyed by yyyy-mm-dd
 *    - has totalsByDay (sum of actual hours per day across ops)
 *    - has a weekTotal (sum of all op weekHours)
 *  Sorted newest-week first so the dispatcher sees current week up
 *  top when the range spans multiple weeks. */
export function useWeekTables({ filteredShifts, sortId, yardageByOperatorByDay }) {
    return useMemo(() => {
        const sortRow = makeRowComparator(sortId)
        const weekBuckets = new Map()
        for (const shift of filteredShifts) {
            const monday = mondayOf(shift.shiftDate)
            if (!monday) continue
            if (!weekBuckets.has(monday)) weekBuckets.set(monday, new Map())
            const opMap = weekBuckets.get(monday)
            const opKey = shift.dayforceEmployeeId
            if (!opMap.has(opKey)) {
                opMap.set(opKey, {
                    badge: shift.badge,
                    byDay: {},
                    exceptions: 0,
                    id: opKey,
                    name: shift.name,
                    plantCode: shift.plantCode,
                    redFlags: 0,
                    weekHours: 0,
                    weekScheduledHours: 0,
                    weekYardage: 0,
                    yardageByDay: {}
                })
            }
            const op = opMap.get(opKey)
            op.byDay[shift.shiftDate] = shift
            op.weekHours += Number(shift.actualHours) || 0
            op.weekScheduledHours += Number(shift.scheduledHours) || 0
            /* Yards delivered on this shift — pulled from the tickets
             * roll-up keyed by the operator's canonical name. Falls back
             * to 0 if there's no match (non-mixer operator, name
             * mismatch). */
            const canon = canonicalNameKey(shift.name)
            const yardsThisDay = canon ? yardageByOperatorByDay.get(canon)?.[shift.shiftDate] || 0 : 0
            if (yardsThisDay > 0) {
                op.yardageByDay[shift.shiftDate] = yardsThisDay
                op.weekYardage += yardsThisDay
            }
            /* Use the filtered exception text so padded-shift cases
             * (early-in / late-out) don't get counted as real exceptions
             * in the per-operator rollup. */
            const effExc = filterExceptionText(shift.exceptionText)
            if (effExc) op.exceptions += 1
            /* Per-shift YPH check — when actualHours > 0 and yards > 0
             * and yph < target, count as a red flag. Re-evaluated here
             * (not just in the cell) so the right-column rollup stays
             * in lockstep with what the cell renders. */
            const shiftHours = Number(shift.actualHours) || 0
            const isLowYphHere = shiftHours > 0 && yardsThisDay > 0 && yardsThisDay / shiftHours < YPH_TARGET
            if (shiftHasRedFlag(shift) || isLowYphHere) {
                op.redFlags += 1
                /* Red-flagged shifts always count as exceptions for the
                 * total, even if Dayforce didn't tag them. Keeps the
                 * "X exc." rollup honest when a long shift slipped past
                 * the platform's own exception flags. */
                if (!effExc) op.exceptions += 1
            }
        }

        return [...weekBuckets.entries()]
            .map(([monday, opMap]) => {
                const days = WEEKDAYS.map((wd) => ({
                    full: wd.full,
                    iso: addDays(monday, wd.offset),
                    label: wd.label
                }))
                const operatorRows = [...opMap.values()].sort(sortRow)
                const totalsByDay = {}
                let weekTotal = 0
                let weekYardageTotal = 0
                for (const op of operatorRows) {
                    weekYardageTotal += op.weekYardage || 0
                    for (const day of days) {
                        const s = op.byDay[day.iso]
                        if (!s || s.isPto) continue
                        totalsByDay[day.iso] = (totalsByDay[day.iso] || 0) + (Number(s.actualHours) || 0)
                        weekTotal += Number(s.actualHours) || 0
                    }
                }
                return {
                    days,
                    monday,
                    operatorRows,
                    totalsByDay,
                    weekLabel: fmtWeekLabel(monday),
                    weekTotal,
                    weekYardageTotal
                }
            })
            .sort((a, b) => b.monday.localeCompare(a.monday))
    }, [filteredShifts, sortId, yardageByOperatorByDay])
}
