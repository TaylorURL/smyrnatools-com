import React from 'react'

/* Per-size visual identity. Color is intentionally minimal — surfaced as a
 * tiny dot indicator only, NOT a full-bleed background. The badge itself
 * stays monochrome so it slots into dense schedule / dashboard rows without
 * overwhelming surrounding content. */
const SIZE_META = {
    large: { dot: '#7c3aed', label: 'Large' },
    medium: { dot: '#0ea5e9', label: 'Medium' },
    small: { dot: '#10b981', label: 'Small' }
}

const SIZE_KEYS = Object.keys(SIZE_META)

/**
 * Compact pill identifying a pour-size category (small / medium / large).
 * Designed to be reusable across the Plan Schedule, Plan Dashboard, and any
 * future surface that needs to flag a window's pour size at a glance.
 *
 * Visual language:
 *  - Monochrome chip background (no per-size flooding).
 *  - 6px colored dot indicates size.
 *  - Optional truck-range suffix renders as muted mono text.
 *
 * @param {Object} props
 * @param {'small'|'medium'|'large'} props.size - Pour size category.
 * @param {string} [props.truckRange] - Optional truck-count range (e.g. "1–2").
 * @param {boolean} [props.showLabel=true] - When false, renders just the dot
 *  + truck-range — useful in very dense rows.
 * @param {string} [props.className] - Extra Tailwind classes to merge.
 */
function PourSizeBadge({ size, truckRange, showLabel = true, className = '' }) {
    const meta = SIZE_META[size] || SIZE_META.medium
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${className} bg-bg-tertiary border border-border-light text-text-secondary`}
            title={`${meta.label} pour${truckRange ? ` · ${truckRange} trucks` : ''}`}
        >
            <span className="inline-block rounded-full shrink-0 h-1.5 w-1.5" style={{ background: meta.dot }} />
            {showLabel && <span>{meta.label}</span>}
            {truckRange && <span className="font-mono opacity-75 normal-case tracking-normal">{truckRange}</span>}
        </span>
    )
}

export { SIZE_KEYS as POUR_SIZE_KEYS, SIZE_META as POUR_SIZE_META }
export default PourSizeBadge
