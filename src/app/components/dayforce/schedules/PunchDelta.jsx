/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { minuteOf } from './scheduleFlags'
import { parseLocal } from './scheduleFormatters'

/** Punch-delta tag — small "+5m" / "-8m" pill on actual times. Only
 *  two cases are shown: a late clock-in (red — operator started behind
 *  schedule, short-changing the shift) and an early clock-out (blue —
 *  operator left before scheduled out, also short-changing the shift).
 *  Padding the shift (early-in / late-out) is intentionally suppressed
 *  because the dispatcher doesn't act on those. */
export function PunchDelta({ accent, actualIso, scheduledIso, kind }) {
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
    const color = isLateIn ? '#b91c1c' : '#1d4ed8'
    const sign = diffMin > 0 ? '+' : ''
    const label = Math.abs(diffMin) >= 60 ? `${sign}${(diffMin / 60).toFixed(1)}h` : `${sign}${diffMin}m`
    return (
        <span
            className="inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold tabular-nums"
            style={{ background: `${accent}10`, color }}
            title={`Actual vs scheduled ${kind === 'in' ? 'clock in' : 'clock out'}: ${sign}${diffMin} min`}
        >
            {label}
        </span>
    )
}
