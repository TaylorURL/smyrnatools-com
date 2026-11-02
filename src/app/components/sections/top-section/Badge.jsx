import React, { useMemo } from 'react'

import { BADGE_PILL_TINTS } from '../../../constants/topSectionConstants'

/**
 * Splits a summary string like "5 Active · 2 Shop" into one count per
 * segment, read as a line of figures: a small square in the status colour, the
 * number set large, its label beside it. Each one filters the list. Anything that does not parse into a count and a label, or whose
 * label has no entry in BADGE_PILL_TINTS, falls back to a single pill in the
 * caller's accent colour.
 *
 * The tints are data, so they reach the pill through inline `style` rather
 * than a class: Tailwind resolves arbitrary values at build time and cannot
 * see a hex that is chosen per status at runtime.
 *
 * Exported as `TopSectionBadgeRow` despite the file name, so an import never
 * collides with the shared common/Badge.
 */
const TopSectionBadgeRow = ({ children, onClick, onPillClick, accentColor }) => {
    const text = typeof children === 'string' ? children : ''
    // Keyed on the string itself, so a pill click re-renders without re-running
    // the split and the per-segment regex over a summary that has not moved.
    const parsed = useMemo(
        () =>
            text
                .split('·')
                .map((segment) => {
                    const match = segment.trim().match(/^(\d+)\s+(.+)$/)
                    return match ? { count: match[1], label: match[2] } : null
                })
                .filter(Boolean),
        [text]
    )

    if (parsed.length >= 2) {
        return (
            <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
                {parsed.map(({ count, label }) => {
                    const tint = BADGE_PILL_TINTS[label]
                    if (!tint) return null
                    const num = parseInt(count, 10)
                    const isZeroVariant = label === 'Unassigned' && num === 0
                    const handleClick = onPillClick ? () => onPillClick(label) : onClick
                    return (
                        <button
                            type="button"
                            key={label}
                            onClick={handleClick}
                            className="group inline-flex items-baseline gap-1.5 rounded-[3px] border-none bg-transparent px-2 py-1 first:-ml-2 cursor-pointer transition-colors duration-150 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                            <span
                                className="relative -top-px inline-block h-2 w-2 shrink-0 self-center rounded-[2px]"
                                style={{ background: isZeroVariant ? 'var(--status-spare)' : tint }}
                                aria-hidden="true"
                            />
                            <span className="font-heading text-[20px] font-semibold leading-none tabular-nums text-text-primary">
                                {count}
                            </span>
                            <span className="text-[13px] text-text-secondary group-hover:text-text-primary">
                                {label}
                            </span>
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-baseline gap-1.5 rounded-[3px] border-none bg-transparent px-2 py-1 -ml-2 text-[13px] text-text-secondary cursor-pointer hover:bg-bg-hover hover:text-text-primary"
            style={{ boxShadow: `inset 2px 0 0 ${accentColor}` }}
        >
            {children}
        </button>
    )
}

export default TopSectionBadgeRow
