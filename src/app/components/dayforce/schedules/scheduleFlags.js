import { LONG_SHIFT_HOURS } from '../../../constants/dayforceScheduleConstants'
import { parseLocal } from './scheduleFormatters'

/** Minute-of-epoch for a Date — seconds and milliseconds truncated so a
 *  punch at 7:10:23 reads as the same "7:10" the dispatcher sees on
 *  screen. Without this, sub-minute drift between Dayforce's scheduled
 *  timestamp and the actual punch timestamp (often a few seconds in
 *  either direction) would flag every on-time punch as late. */
export const minuteOf = (date) => Math.floor(date.getTime() / 60000)

/** Was this punch late? (Clock in after scheduled in, or clock out after
 *  scheduled out.) Helpers shared by `PunchDelta` and `ShiftCell` so the
 *  red flag is computed once per shift. Minute-level comparison — same
 *  minute is never late, regardless of seconds. */
export const isPunchLate = (actualIso, scheduledIso) => {
    const a = parseLocal(actualIso)
    const s = parseLocal(scheduledIso)
    if (!a || !s) return false
    return minuteOf(a) > minuteOf(s)
}

export const isShiftLong = (actualHours) => Number(actualHours) > LONG_SHIFT_HOURS

/** Padding the shift (clock-in before scheduled, clock-out after
 *  scheduled) is intentionally NOT a red flag — those cases are
 *  noise the dispatcher has explicitly said they don't care about.
 *  Only short-changed-shift signals (late in, early out) and long
 *  shifts trigger the red treatment. */
/** Dayforce raises an exception any time a punch deviates from schedule,
 *  but the dispatcher only cares about a subset of those. Padded-shift
 *  exceptions — clocked in early OR clocked out late — are explicitly
 *  ignored. This filter strips them out of the raw `exceptionText` so
 *  the cell doesn't turn amber and the tooltip doesn't surface them.
 *
 *  Matching is intentionally loose because Dayforce phrases these flags
 *  in inconsistent ways ("Early In", "Punch In Early", "Schedule
 *  Adherence: Early In", "In Early", "Clock In Early", etc.). The rule
 *  is: if a piece mentions both `early` AND `in` it's an early-clock-in;
 *  if it mentions both `late` AND `out` it's a late-clock-out. Both get
 *  filtered.
 *
 *  Anything else — missed lunch, no-show, schedule mismatch unrelated to
 *  early/late, etc. — still flows through and drives the amber
 *  treatment. */
const containsEarlyIn = (lower) => /\bearly\b/.test(lower) && /\bin\b/.test(lower)
const containsLateOut = (lower) => /\blate\b/.test(lower) && /\bout\b/.test(lower)

export const filterExceptionText = (raw) => {
    if (!raw) return ''
    return String(raw)
        .split(/[,;\n]/)
        .map((piece) => piece.trim())
        .filter((piece) => {
            if (!piece) return false
            const lower = piece.toLowerCase()
            return !containsEarlyIn(lower) && !containsLateOut(lower)
        })
        .join(', ')
}

/** Long shift (>14h) is the sole red-tier flag — it's the only
 *  hours-of-service signal severe enough to demand the most urgent
 *  treatment. Low YPH and late punches are real signals but live in
 *  the lower-severity orange tier. */
export const shiftHasRedFlag = (shift) => {
    if (!shift || shift.isPto) return false
    return isShiftLong(shift.actualHours)
}

/** Tints for the weekly grid's day cells, in descending severity:
 *  sky = PTO, red = long shift (>14h) only, orange = low YPH or late
 *  clock-in (performance warnings), amber = non-padded Dayforce
 *  exception, transparent otherwise. Long shift always wins so an
 *  HOS overage is never masked by a co-occurring orange or amber
 *  condition. Exposed as its own helper so WeekTable can apply the
 *  colour to the `<td>` itself — pinning the bg on the inner div
 *  leaves a 5–10 px gap at the bottom of taller rows because table
 *  cells don't propagate `height: 100%` to children. */
export const PTO_CELL_BG = 'rgba(14, 165, 233, 0.08)'
export const RED_FLAG_CELL_BG = 'rgba(220, 38, 38, 0.08)'
export const LOW_YPH_CELL_BG = 'rgba(234, 88, 12, 0.10)'
export const EXCEPTION_CELL_BG = 'rgba(217, 119, 6, 0.06)'

export const getShiftCellBackground = ({ exceptionText, shift, shiftYph, yphTarget }) => {
    if (!shift) return 'transparent'
    if (shift.isPto) return PTO_CELL_BG
    if (shiftHasRedFlag(shift)) return RED_FLAG_CELL_BG
    const isLowYph = shiftYph != null && shiftYph < yphTarget
    const isLatePunch = isPunchLate(shift.actualInPunchAt || shift.actualInAt, shift.scheduledInAt)
    if (isLowYph || isLatePunch) return LOW_YPH_CELL_BG
    const effectiveException = filterExceptionText(exceptionText ?? shift.exceptionText)
    if (effectiveException) return EXCEPTION_CELL_BG
    return 'transparent'
}
