import React, { useMemo } from 'react'

import { BADGE_PILL_TINTS } from '../../../constants/topSectionConstants'
import Badge from '../../common/Badge'

/**
 * Splits a summary string like "5 Active · 2 Shop" into one tinted pill per
 * segment. Anything that does not parse into a count and a label, or whose
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
            <div className="flex items-center gap-1 flex-wrap">
                {parsed.map(({ count, label }) => {
                    const tint = BADGE_PILL_TINTS[label]
                    if (!tint) return null
                    const num = parseInt(count, 10)
                    const isZeroVariant = label === 'Unassigned' && num === 0
                    const color = isZeroVariant ? '#64748b' : tint
                    const handleClick = onPillClick ? () => onPillClick(label) : onClick
                    return (
                        <Badge
                            key={label}
                            variant="custom"
                            size="md"
                            shape="rounded"
                            weight="semibold"
                            uppercase={false}
                            onClick={handleClick}
                            className="gap-1 border"
                            style={{
                                background: `${color}14`,
                                borderColor: `${color}30`,
                                color: 'var(--text-primary)'
                            }}
                        >
                            <span className="font-mono tabular-nums">{count}</span>
                            <span>{label}</span>
                        </Badge>
                    )
                })}
            </div>
        )
    }

    return (
        <Badge
            variant="custom"
            size="md"
            shape="rounded"
            weight="semibold"
            uppercase={false}
            onClick={onClick}
            className="border"
            style={{
                background: `${accentColor}14`,
                borderColor: `${accentColor}30`,
                color: 'var(--text-primary)'
            }}
        >
            {children}
        </Badge>
    )
}

export default TopSectionBadgeRow
