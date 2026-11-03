/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../common/Badge'

/**
 * One entry on a history timeline: a dot on a hairline rail, and the entry
 * beside it on the dialog's own surface - no tinted card, the way the
 * timeline tab's change rows sit. `dotColor` (a CSS colour) wins over
 * `dotClassName` (a background class); with neither the dot takes the accent.
 */
export default function TimelineItem({ dotColor, dotClassName, isLast, children }) {
    return (
        <div className="flex gap-3">
            <div className="flex w-2.5 shrink-0 flex-col items-center" aria-hidden="true">
                <div
                    className={`mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ${dotColor ? '' : dotClassName || 'bg-accent'}`}
                    style={dotColor ? { background: dotColor } : undefined}
                />
                {!isLast && <div className="mt-1 w-px flex-1 bg-border-light" />}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-4'}`}>{children}</div>
        </div>
    )
}

export function TimelineHeader({ label, isCurrent, badge }) {
    return (
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium leading-snug text-text-primary">{label}</span>
            {isCurrent && (
                <Badge tone="success" size="md" shape="rounded-md">
                    Current
                </Badge>
            )}
            {badge}
        </div>
    )
}

export function TimelineMeta({ children }) {
    return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export function TimelineDate({ date }) {
    return <span className="text-[12px] tabular-nums text-text-tertiary">{date}</span>
}

export function TimelineDuration({ text }) {
    return <span className="text-[12px] font-medium tabular-nums text-text-secondary">{text}</span>
}

/** A small label over a timeline or list. The extra space above it, inside a
 *  tab's `gap-3` column, groups it with what follows rather than what precedes. */
export function TimelineSectionTitle({ title }) {
    return <h3 className="m-0 mt-2 text-[12px] font-medium text-text-secondary">{title}</h3>
}
