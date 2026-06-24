import React from 'react'

/**
 * Renders a 0–1 fraction as a percentage — the universal "score" display
 * for any percentage-shaped metric (good-service rate, pace score, kicker
 * rate, etc.) across the Statistics, Assets, and People pages.
 *
 * The percent value itself is the signal, so the number renders in the
 * inherited theme text color (light, dark, and grayed-out themes all just
 * work). Use this anywhere the underlying value is a percentage. Keep the
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
        <span className={`font-mono font-semibold tabular-nums leading-none ${sizeClass}`} title={`${pct}%`}>
            {pct}%
        </span>
    )
}

export default ScorePercent
