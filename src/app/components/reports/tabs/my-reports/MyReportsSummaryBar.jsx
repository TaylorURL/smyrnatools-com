/* eslint-disable react/forbid-dom-props */
import React from 'react'

import DeadlineFuse from '../../DeadlineFuse'

/**
 * Headline strip above the My Reports week ribbon. One dominant element —
 * the big mono "submitted / total" fraction — flanked by a thin progress
 * bar and a one-line summary of what's still out. The deadline fuse sits
 * on the right, demoted from its previous "third equal-weight chunk" role
 * to a contextual aside. Replaces the previous strip of three rounded
 * icon-boxes that read as a generic AI-templated stat cluster.
 */
export default function MyReportsSummaryBar({
    accent,
    cutoffLabel,
    daysLeft,
    fuseCaption,
    isFuture,
    isPast,
    overdueCarryover,
    pending,
    submitted,
    todayIndex,
    weekLabel,
    weekRange
}) {
    const totalAssigned = submitted + pending
    const completionPct = totalAssigned > 0 ? Math.round((submitted / totalAssigned) * 100) : null
    const allDone = totalAssigned > 0 && pending === 0
    const urgent = !isFuture && !isPast && daysLeft <= 1 && pending > 0
    const fuseMode = isPast ? 'past' : isFuture ? 'future' : 'current'

    const summaryParts = []
    if (totalAssigned === 0) summaryParts.push('No assigned reports')
    else if (allDone) summaryParts.push('All in')
    else {
        if (pending > 0) summaryParts.push(`${pending} pending`)
        if (overdueCarryover > 0) summaryParts.push(`${overdueCarryover} overdue from prior weeks`)
    }

    return (
        <div
            className="rounded-lg border bg-bg-primary border-border-light"
            style={urgent ? { borderColor: 'color-mix(in srgb, var(--status-danger) 45%, transparent)' } : undefined}
        >
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 px-4 py-3">
                <div className="flex items-baseline gap-3 min-w-0">
                    <div className="flex flex-col leading-tight">
                        <span className="text-[9.5px] font-bold uppercase tracking-[.08em] text-text-tertiary">
                            {weekLabel}
                            {weekRange ? ` · ${weekRange}` : ''}
                        </span>
                        <span className="font-heading font-bold leading-none tabular-nums tracking-tight text-text-primary text-[26px] md:text-[28px] mt-0.5">
                            {totalAssigned > 0 ? `${submitted}/${totalAssigned}` : '—'}
                            <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                                submitted
                            </span>
                        </span>
                    </div>
                    {completionPct != null && (
                        <span className="hidden sm:inline-flex items-baseline gap-1 font-mono tabular-nums text-[13px] font-semibold text-text-secondary">
                            {completionPct}
                            <span className="text-[10px] text-text-tertiary">%</span>
                        </span>
                    )}
                </div>

                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    {totalAssigned > 0 && (
                        <div
                            className="h-1.5 w-full rounded-full overflow-hidden"
                            style={{ background: 'var(--bg-tertiary)' }}
                            role="progressbar"
                            aria-valuenow={completionPct ?? 0}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <span
                                className="block h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
                                style={{
                                    background: allDone ? 'var(--status-success)' : accent,
                                    width: `${completionPct ?? 0}%`
                                }}
                            />
                        </div>
                    )}
                    <span className="text-[12px] text-text-secondary truncate">
                        {summaryParts.join(' · ')}
                    </span>
                </div>

                <div className="hidden md:flex min-w-[260px] shrink-0">
                    <DeadlineFuse
                        caption={fuseCaption}
                        cutoffLabel={cutoffLabel}
                        daysLeft={daysLeft}
                        embedded
                        mode={fuseMode}
                        todayIndex={todayIndex}
                    />
                </div>
            </div>
        </div>
    )
}
