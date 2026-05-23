/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { useOperatorClockStatus } from '../../context/OperatorClockStatusContext'

/** Pretty-prints an ISO timestamp as a local "HH:MM" so the tooltip
 *  reads as a wall-clock time the user can mentally compare to "now". */
const formatLocalTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const h = d.getHours()
    const m = String(d.getMinutes()).padStart(2, '0')
    const period = h >= 12 ? 'PM' : 'AM'
    const hh = h % 12 === 0 ? 12 : h % 12
    return `${hh}:${m} ${period}`
}

const COLOR_ON_CLOCK = '#16a34a'
const COLOR_OFF_CLOCK = '#94a3b8'
const COLOR_UNKNOWN = '#cbd5e1'

/**
 * Tiny clock-status dot for any operator name surface. Reads today's
 * Dayforce shifts via `useOperatorClockStatus` and renders:
 *   - green dot when the operator has an open shift (clocked in, not
 *     yet clocked out)
 *   - slate dot when there's a closed shift today (clocked in and out)
 *   - neutral light-slate dot when the operator has no shift today —
 *     they may legitimately be off, or Dayforce hasn't synced yet
 *
 * The dot is `size="sm"` by default for inline use beside a name. Pass
 * `size="md"` for headers / detail-page contexts where the indicator
 * deserves a bit more weight. `withLabel` reveals a short "On the clock"
 * / "Off" caption beside the dot for surfaces that have the room.
 */
export function OperatorClockIndicator({ badge, size = 'sm', withLabel = false, className = '' }) {
    const status = useOperatorClockStatus(badge)
    if (!badge) return null

    const dotSize = size === 'md' ? 10 : 8
    const ringSize = dotSize + 4

    let color = COLOR_UNKNOWN
    let title = 'No shift on file for today'
    let label = 'Unknown'
    if (status.isKnown && status.isClockedIn) {
        color = COLOR_ON_CLOCK
        const inAt = formatLocalTime(status.actualInAt)
        title = inAt ? `On the clock since ${inAt}` : 'On the clock'
        label = 'On clock'
    } else if (status.isKnown && !status.isClockedIn) {
        color = COLOR_OFF_CLOCK
        const outAt = formatLocalTime(status.actualOutAt)
        title = outAt ? `Off the clock — last out ${outAt}` : 'Off the clock'
        label = 'Off clock'
    }

    return (
        <span
            className={`inline-flex items-center gap-1 align-middle shrink-0 ${className}`}
            title={title}
            aria-label={title}
        >
            <span
                className="inline-block rounded-full"
                style={{
                    background: color,
                    boxShadow: status.isClockedIn ? `0 0 0 2px ${color}33` : undefined,
                    height: dotSize,
                    width: dotSize
                }}
            />
            {withLabel && (
                <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color }}>
                    {label}
                </span>
            )}
            {/* Reserve the same vertical footprint as a 12px text node so a
             *  bare dot doesn't shift the baseline of the name it sits
             *  next to. */}
            <span className="sr-only" style={{ width: ringSize - dotSize }}>
                {status.isClockedIn ? 'clocked in' : 'clocked out'}
            </span>
        </span>
    )
}

export default OperatorClockIndicator
