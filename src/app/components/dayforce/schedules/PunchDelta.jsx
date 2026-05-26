import React from 'react'

import { minuteOf } from './scheduleFlags'
import { parseLocal } from './scheduleFormatters'

/** Punch-delta tag — small "+5m" / "-8m" pill on actual times. Only
 *  two cases are shown: a late clock-in and an early clock-out (both
 *  short-change the shift). Padding the shift (early-in / late-out) is
 *  intentionally suppressed because the dispatcher doesn't act on those.
 *
 *  The colour signal lives in the badge background — late clock-in
 *  paints with the project's `status-badge-danger` (red), early
 *  clock-out with `status-badge-warning` (amber). The text itself
 *  stays theme-primary (black in light, white in dark) so the digits
 *  read cleanly against any theme; the previous inline red / blue
 *  text washed out in dark mode and clashed with the rest of the
 *  status vocabulary in the app. */
export function PunchDelta({ actualIso, scheduledIso, kind }) {
    const a = parseLocal(actualIso)
    const s = parseLocal(scheduledIso)
    if (!a || !s) return null
    /* Minute-level diff so seconds drift between Dayforce schedule
     * timestamps and the actual punch (commonly 5–45s) doesn't spawn
     * a "+1m" pill when the clock-display minute is the same. */
    const diffMin = minuteOf(a) - minuteOf(s)
    if (diffMin === 0) return null
    const isLateIn = kind === 'in' && diffMin > 0
    const isEarlyOut = kind === 'out' && diffMin < 0
    // Padded-shift cases — drop the pill entirely.
    if (!isLateIn && !isEarlyOut) return null
    const badgeClass = isLateIn ? 'status-badge-danger' : 'status-badge-warning'
    const sign = diffMin > 0 ? '+' : ''
    const label = Math.abs(diffMin) >= 60 ? `${sign}${(diffMin / 60).toFixed(1)}h` : `${sign}${diffMin}m`
    return (
        <span
            className={`${badgeClass} inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold tabular-nums text-text-primary cursor-help`}
            title={`Actual vs scheduled ${kind === 'in' ? 'clock in' : 'clock out'}: ${sign}${diffMin} min`}
        >
            {label}
        </span>
    )
}
