import { LONG_SHIFT_HOURS } from './scheduleConstants'
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

export const shiftHasRedFlag = (shift) => {
    if (!shift || shift.isPto) return false
    if (isShiftLong(shift.actualHours)) return true
    if (isPunchLate(shift.actualInPunchAt || shift.actualInAt, shift.scheduledInAt)) return true
    return false
}
