/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { BADGE_PILL_TINTS } from './topSectionConstants'

/** Inline badge — parses "X Label · Y Label" into a row of compact pills.
 *  Text colour flips to white in dark / grayed-out modes and to black in
 *  light mode so the count + label always reads against whatever theme
 *  surface the pill sits on. The status tint stays on the background +
 *  border so the colour cue (red = Shop, green = Active, etc.) is still
 *  carried, just not at the cost of legibility on dark chrome. */
const Badge = ({ children, onClick, onPillClick, accentColor, isDark }) => {
    const text = typeof children === 'string' ? children : ''
    const parts = text.split('·').map((s) => s.trim())
    const parsed = parts
        .map((p) => {
            const match = p.match(/^(\d+)\s+(.+)$/)
            return match ? { count: match[1], label: match[2] } : null
        })
        .filter(Boolean)

    const textColor = isDark ? '#ffffff' : '#000000'

    if (parsed.length >= 2) {
        return (
            <div className="flex items-center gap-1 flex-wrap">
                {parsed.map(({ count, label }) => {
                    const tint = BADGE_PILL_TINTS[label]
                    if (!tint) return null
                    const num = parseInt(count, 10)
                    const isZeroVariant = label === 'Unassigned' && num === 0
                    const color = isZeroVariant ? '#64748b' : tint
                    const clickHandler = onPillClick ? () => onPillClick(label) : onClick
                    const Tag = clickHandler ? 'button' : 'span'
                    const clickProps = clickHandler ? { onClick: clickHandler, type: 'button' } : {}
                    return (
                        <Tag
                            key={label}
                            className={`inline-flex items-center gap-1 rounded text-[11px] font-semibold px-1.5 py-0.5${
                                clickHandler ? ' border-none cursor-pointer hover:brightness-95' : ''
                            }`}
                            style={{ background: `${color}14`, border: `1px solid ${color}30`, color: textColor }}
                            {...clickProps}
                        >
                            <span className="font-mono tabular-nums">{count}</span>
                            <span>{label}</span>
                        </Tag>
                    )
                })}
            </div>
        )
    }

    const Wrapper = onClick ? 'button' : 'span'
    const wrapperProps = onClick
        ? {
              className: 'border-none bg-transparent p-0 cursor-pointer',
              onClick,
              type: 'button'
          }
        : {}
    return (
        <Wrapper {...wrapperProps}>
            <span
                className="inline-flex items-center gap-1 rounded text-[11px] font-semibold px-1.5 py-0.5"
                style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}30`, color: textColor }}
            >
                {children}
            </span>
        </Wrapper>
    )
}

export default Badge
