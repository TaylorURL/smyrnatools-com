import React from 'react'

import Badge from '../common/Badge'

/**
 * Status pill for a plant's Saturday operator forecast.
 *
 * Two states:
 * - Submitted → muted-emerald chip with "Sat: {N} op{s}"
 * - Pending   → muted-amber chip with "Sat: Pending"
 *
 * Built on the shared Badge component (success/warning tones) so the
 * tonal hue resolves consistently in dark / light / gray themes without
 * per-theme overrides.
 */
function PlantSaturdayForecastBadge({ plantCode, forecast, compact = false }) {
    const hasForecast = forecast != null
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
        <Badge
            tone={hasForecast ? 'success' : 'warning'}
            size={compact ? 'sm' : 'md'}
            shape="pill"
            weight="semibold"
            uppercase={false}
            dot
            title={titleText}
            aria-label={ariaLabel}
            className="tabular-nums select-none transition-colors duration-150"
        >
            {label}
        </Badge>
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
