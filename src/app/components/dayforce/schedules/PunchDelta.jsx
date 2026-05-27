import React from 'react'

import Badge from '../../common/Badge'
import { minuteOf } from './scheduleFlags'
import { parseLocal } from './scheduleFormatters'

/** Punch-delta tag — small "+5m" / "-8m" pill on actual times. Only
 *  two cases are shown: a late clock-in and an early clock-out (both
 *  short-change the shift). Padding the shift (early-in / late-out) is
 *  intentionally suppressed because the dispatcher doesn't act on those.
 *
 *  Late clock-in renders with the danger tone (red); early clock-out
 *  renders with the warning tone (amber). The unified Badge handles
 *  theme-aware contrast across dark / light / gray. */
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
    const sign = diffMin > 0 ? '+' : ''
    const label = Math.abs(diffMin) >= 60 ? `${sign}${(diffMin / 60).toFixed(1)}h` : `${sign}${diffMin}m`
    return (
        <Badge
            tone={isLateIn ? 'danger' : 'warning'}
            size="xs"
            weight="semibold"
            uppercase={false}
            title={`Actual vs scheduled ${kind === 'in' ? 'clock in' : 'clock out'}: ${sign}${diffMin} min`}
            className="tabular-nums cursor-help"
        >
            {label}
        </Badge>
    )
}
