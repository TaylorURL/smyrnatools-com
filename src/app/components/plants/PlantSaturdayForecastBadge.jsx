import React from 'react'

/**
 * Status pill for a plant's Saturday operator forecast.
 *
 * Two states:
 * - Submitted → muted-emerald chip with "Sat: {N} op{s}"
 * - Pending   → muted-amber chip with "Sat: Pending"
 *
 * Built with project status tokens (`status-active`, `status-warning`) so the
 * tonal hue resolves consistently in dark / light / gray themes without per-
 * theme overrides. The chip uses a transparent tint of the status color for the
 * background and the status color itself for text + dot — the same recipe the
 * dashboard alert rows rely on.
 */
function PlantSaturdayForecastBadge({ plantCode, forecast, compact = false }) {
    const hasForecast = forecast != null
    const sizeClasses = compact ? 'px-2 py-0.5 text-[10.5px] gap-1' : 'px-2.5 py-1 text-[11px] gap-1.5'
    const dotSizeClass = compact ? 'h-1.5 w-1.5' : 'h-2 w-2'

    const toneClasses = hasForecast
        ? 'bg-[color-mix(in_srgb,var(--status-active)_14%,transparent)] text-[var(--status-active)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--status-active)_28%,transparent)]'
        : 'bg-[color-mix(in_srgb,var(--status-warning)_14%,transparent)] text-[var(--status-warning)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--status-warning)_28%,transparent)]'

    const operatorCount = forecast?.operatorCount ?? 0
    const operatorWord = operatorCount === 1 ? 'op' : 'ops'
    const label = hasForecast ? `Sat: ${operatorCount} ${operatorWord}` : 'Sat: Pending'

    const titleText = hasForecast
        ? buildSubmittedTitle(operatorCount, forecast)
        : `Awaiting Saturday forecast for plant ${plantCode}`

    const ariaLabel = hasForecast
        ? `Saturday forecast submitted: ${operatorCount} operator${operatorCount === 1 ? '' : 's'} for plant ${plantCode}`
        : `Saturday forecast pending for plant ${plantCode}`

    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold tracking-tight tabular-nums select-none transition-colors duration-150 ${sizeClasses} ${toneClasses}`}
            title={titleText}
            aria-label={ariaLabel}
        >
            <span className={`rounded-full bg-current ${dotSizeClass}`} aria-hidden="true" />
            <span className="leading-none">{label}</span>
        </span>
    )
}

/** Builds a tooltip with operator count, submitter, and short date. */
function buildSubmittedTitle(operatorCount, forecast) {
    const operatorWord = operatorCount === 1 ? 'operator' : 'operators'
    const namePart = forecast.submittedByName ? ` by ${forecast.submittedByName}` : ''
    const datePart = forecast.submittedAt ? ` on ${formatShortSubmittedAt(forecast.submittedAt)}` : ''
    return `${operatorCount} ${operatorWord} forecasted${namePart}${datePart}`
}

/** "May 23, 4:12 PM" — locale-aware short timestamp. */
function formatShortSubmittedAt(submittedAt) {
    const date = new Date(submittedAt)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString(undefined, {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short'
    })
}

export default PlantSaturdayForecastBadge
