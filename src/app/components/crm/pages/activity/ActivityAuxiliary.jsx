/* eslint-disable react/forbid-dom-props */
import React from 'react'

/* ─── Empty state ──────────────────────────────────────────────── */

export function ActivityEmpty({ hasFilters, totalLoaded }) {
    return (
        <div className="rounded-md p-8 text-center bg-bg-primary border border-border-light flex flex-col items-center gap-2">
            <i className="fas fa-phone-volume text-[22px] text-text-tertiary" />
            <div className="text-[13px] font-semibold text-text-primary">
                {totalLoaded === 0 ? 'No team calls logged yet' : hasFilters ? 'No matches' : 'Nothing in this range'}
            </div>
            <div className="text-[11.5px] text-text-secondary max-w-[420px]">
                {totalLoaded === 0
                    ? 'Once anyone on the team logs a call from the Outreach or Directory tab, it lands here in chronological order.'
                    : hasFilters
                      ? 'Adjust the search, outcome filter, or time range to see more activity.'
                      : 'Try widening the time range to see older calls.'}
            </div>
        </div>
    )
}

const SkelBar = ({ className = '', style }) => (
    <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
)

export function ActivityListSkeleton() {
    return (
        <div className="rounded-md overflow-hidden bg-bg-primary border border-border-light">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="px-4 py-2.5 flex items-start gap-3"
                    style={{ borderBottom: i === 7 ? 'none' : '1px solid var(--border-light)' }}
                >
                    <SkelBar className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <SkelBar className="h-3 w-1/2" />
                        <SkelBar className="h-2.5 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    )
}
