import React from 'react'

/** Timeline entry — colored dot rail + Plan-tab card body. */
export default function TimelineItem({ dotColor, dotClassName, isLast, children }) {
    return (
        <div className="flex gap-2.5 py-1.5">
            <div className="flex flex-col items-center w-5 flex-shrink-0">
                <div
                    className={`w-2.5 h-2.5 rounded-full z-[1] ${dotClassName ?? ''}`}
                    style={{
                        background: dotColor || 'var(--accent, #1e3a5f)',
                        boxShadow: '0 0 0 2px var(--bg-primary), 0 0 0 3px var(--border-light)'
                    }}
                />
                {!isLast && <div className="w-px flex-1 -mt-0.5 bg-[var(--border-light)]" />}
            </div>
            <div className="flex-1 rounded p-2.5 bg-bg-secondary border border-border-light">{children}</div>
        </div>
    )
}

/** Timeline entry header — label + optional "Current" badge + custom badge. */
export function TimelineHeader({ label, isCurrent, badge }) {
    return (
        <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[12.5px] font-semibold leading-tight text-text-primary">{label}</span>
            {isCurrent && (
                <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-600 text-white">
                    Current
                </span>
            )}
            {badge}
        </div>
    )
}

/** Flex row container for timeline metadata items. */
export function TimelineMeta({ children }) {
    return <div className="flex items-center gap-2.5 flex-wrap">{children}</div>
}

/** Muted date label for timeline entries. */
export function TimelineDate({ date }) {
    return <span className="text-[11px] tabular-nums text-text-tertiary">{date}</span>
}

/** Accent-colored duration label for timeline entries. */
export function TimelineDuration({ text }) {
    return <span className="text-[11px] font-semibold text-[var(--accent, #1e3a5f)]">{text}</span>
}

/** Section heading inside a timeline tab. */
export function TimelineSectionTitle({ title }) {
    return <h3 className="m-0 mb-1 text-[9.5px] font-bold uppercase tracking-wider text-text-secondary">{title}</h3>
}
