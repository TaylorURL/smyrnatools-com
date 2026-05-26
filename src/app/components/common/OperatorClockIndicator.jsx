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

/**
 * Tiny clock-status dot for any operator name surface. Reads today's
 * Dayforce shifts via `useOperatorClockStatus` and renders:
 *   - green dot (status-active) with a soft pulsing halo when the operator
 *     has an open shift (clocked in, not yet clocked out)
 *   - muted dot when there's a closed shift today (clocked in and out)
 *   - neutral dot when the operator has no shift today — they may
 *     legitimately be off, or Dayforce hasn't synced yet
 *
 * The dot is `size="sm"` by default for inline use beside a name. Pass
 * `size="md"` for headers / detail-page contexts where the indicator
 * deserves a bit more weight. `withLabel` reveals a short "On clock" /
 * "Off" caption beside the dot for surfaces that have the room.
 */
export function OperatorClockIndicator({ badge, size = 'sm', withLabel = false, className = '' }) {
    const status = useOperatorClockStatus(badge)
    if (!badge) return null

    const dotPxSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'
    const dotColor = status.isKnown
        ? status.isClockedIn
            ? 'bg-status-active'
            : 'bg-text-tertiary'
        : 'bg-border-medium'

    let title = 'No shift on file for today'
    let label = 'Unknown'
    if (status.isKnown && status.isClockedIn) {
        const inAt = formatLocalTime(status.actualInAt)
        title = inAt ? `On the clock since ${inAt}` : 'On the clock'
        label = 'On clock'
    } else if (status.isKnown && !status.isClockedIn) {
        const outAt = formatLocalTime(status.actualOutAt)
        title = outAt ? `Off the clock — last out ${outAt}` : 'Off the clock'
        label = 'Off clock'
    }

    const isActive = status.isKnown && status.isClockedIn

    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 align-middle ${className}`}
            title={title}
            aria-label={title}
            role="img"
        >
            <span className="relative inline-flex">
                <span
                    className={`inline-block rounded-full ${dotPxSize} ${dotColor} ${
                        isActive ? 'ring-2 ring-status-active/30 motion-reduce:ring-status-active/40' : ''
                    }`}
                />
                {isActive && (
                    <span
                        className={`absolute inset-0 inline-block rounded-full bg-status-active/40 animate-ping motion-reduce:animate-none`}
                        aria-hidden="true"
                    />
                )}
            </span>
            {withLabel && (
                <span
                    className={`text-[10.5px] font-semibold uppercase tracking-wider ${
                        isActive ? 'text-status-active' : 'text-text-secondary'
                    }`}
                >
                    {label}
                </span>
            )}
            <span className="sr-only">{isActive ? 'clocked in' : 'clocked out'}</span>
        </span>
    )
}

export default OperatorClockIndicator
