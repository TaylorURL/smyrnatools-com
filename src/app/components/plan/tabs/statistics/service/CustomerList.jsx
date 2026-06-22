/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import ServiceTierBreakdown from '../ServiceTierBreakdown'
import { goodPctColor } from './serviceShared'

/**
 * Initial visible-row cap. Anything beyond gets hidden behind a "Show N more"
 * disclosure so the panel doesn't dump 30+ customers on the page by default.
 */
const DEFAULT_VISIBLE_ROWS = 5

/**
 * Ranked list of customers with the worst service. Design follows the
 * "one signal per region" principle — severity is carried by the colored
 * good-service percentage on the right, and nothing else. The rank is a
 * muted monospace digit (not a chip), rows have no decorative borders, and
 * the hover state is a single subtle background tint. Rows past the visible
 * cap collapse behind a quiet disclosure button.
 */
export default function CustomerList({ emptyMessage, rows }) {
    const [showAll, setShowAll] = useState(false)

    if (!rows.length) {
        return <div className="text-[12px] py-3 text-center text-text-tertiary">{emptyMessage}</div>
    }

    const canCollapse = rows.length > DEFAULT_VISIBLE_ROWS
    const visibleRows = !showAll && canCollapse ? rows.slice(0, DEFAULT_VISIBLE_ROWS) : rows
    const hiddenCount = rows.length - DEFAULT_VISIBLE_ROWS

    return (
        <div className="flex flex-col">
            {visibleRows.map((row, idx) => {
                const rank = idx + 1
                const pct = row.goodPct != null ? Math.round(row.goodPct * 100) : null
                return (
                    <div
                        key={row.name + idx}
                        className="group flex items-center gap-3.5 -mx-2.5 px-2.5 py-2.5 rounded-md transition-colors duration-150 ease-out hover:bg-bg-hover/60 motion-reduce:transition-none"
                    >
                        <span
                            aria-hidden="true"
                            className="w-5 shrink-0 text-right font-mono tabular-nums text-[11px] text-text-tertiary leading-none"
                        >
                            {rank}
                        </span>

                        <div className="flex-1 min-w-0">
                            <div
                                className="text-[13px] font-semibold text-text-primary truncate leading-tight"
                                title={row.name}
                            >
                                {row.name}
                            </div>
                            <div className="mt-1 text-[11px] text-text-tertiary leading-none">
                                <span className="font-mono tabular-nums text-text-secondary font-semibold">
                                    {fmtInt(row.badJobs)}
                                </span>{' '}
                                <span>bad of</span> <span className="font-mono tabular-nums">{fmtInt(row.jobs)}</span>
                                <span className="mx-1.5 text-border-medium" aria-hidden="true">
                                    ·
                                </span>
                                <span className="font-mono tabular-nums">{fmtInt(row.lateJobs)}</span> late
                                <span className="mx-1.5 text-border-medium" aria-hidden="true">
                                    ·
                                </span>
                                <span className="font-mono tabular-nums">{fmtInt(row.slowJobs)}</span> slow
                            </div>
                        </div>

                        <div className="shrink-0 hidden sm:block opacity-80 group-hover:opacity-100 transition-opacity duration-150 motion-reduce:transition-none">
                            <ServiceTierBreakdown tierCounts={row.tierCounts} compact />
                        </div>

                        <div
                            className="shrink-0 flex flex-col items-end leading-none w-[44px]"
                            aria-label={
                                pct != null ? `Good service rate ${pct} percent` : 'Good service rate not available'
                            }
                        >
                            <span
                                className="font-mono font-bold tabular-nums text-[15px]"
                                style={{ color: pct != null ? goodPctColor(row.goodPct) : 'var(--text-tertiary)' }}
                            >
                                {pct != null ? `${pct}%` : '—'}
                            </span>
                            <span className="mt-1 text-[9px] uppercase tracking-wider text-text-tertiary">good</span>
                        </div>
                    </div>
                )
            })}

            {canCollapse && (
                <button type="button"
                    aria-expanded={showAll}
                    className="mt-2 self-center inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-transparent border-none text-[11.5px] font-medium text-text-secondary cursor-pointer transition-colors duration-150 ease-out hover:text-text-primary hover:bg-bg-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none"
                    onClick={() => setShowAll((prev) => !prev)}
                    type="button"
                >
                    <span>{showAll ? 'Show fewer' : `Show ${hiddenCount} more`}</span>
                    <i
                        aria-hidden="true"
                        className="fas fa-chevron-down text-[9px] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={{ transform: showAll ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                </button>
            )}
        </div>
    )
}
