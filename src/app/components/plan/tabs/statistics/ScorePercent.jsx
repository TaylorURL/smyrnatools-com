/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Tier colours matched to the same buckets the old StarRating used so
 *  the new percentage badge keeps the same green→amber→red signal at a
 *  glance. */
const tierColor = (value) => {
    if (value == null || !Number.isFinite(value)) return 'var(--text-tertiary)'
    if (value >= 0.9) return '#16a34a'
    if (value >= 0.75) return '#65a30d'
    if (value >= 0.5) return '#d97706'
    if (value >= 0.25) return '#dc2626'
    return '#b91c1c'
}

/**
 * Renders a 0–1 fraction as a coloured percentage — the universal
 * "score" display for any percentage-shaped metric (good-service rate,
 * pace score, kicker rate, etc.) across the Statistics, Assets, and
 * People pages.
 *
 * Use this anywhere the underlying value is a percentage. Keep the
 * star glyphs only for genuine 1–5 ratings (operator rating, asset
 * cleanliness, asset condition).
 *
 * Sizes:
 *   - `lg` (default) → 20px, matches the headline `Stat` numeric value.
 *   - `sm` → 12.5px, for dense table cells and inline list rows.
 */
export function ScorePercent({ size = 'lg', value }) {
    if (value == null || !Number.isFinite(value)) {
        return <span className="text-text-tertiary">—</span>
    }
    const pct = Math.round(value * 100)
    const sizeClass = size === 'sm' ? 'text-[12.5px]' : 'text-[20px]'
    return (
        <span
            className={`font-mono font-semibold tabular-nums leading-none ${sizeClass}`}
            style={{ color: tierColor(value) }}
            title={`${pct}%`}
        >
            {pct}%
        </span>
    )
}

export default ScorePercent
