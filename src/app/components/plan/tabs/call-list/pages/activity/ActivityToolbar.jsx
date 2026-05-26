/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { CALL_OUTCOME_COLORS, CALL_OUTCOME_LABELS } from '../../../../../../../utils/CallListUtility'
import { ICON_BY_OUTCOME, TIME_RANGE_OPTIONS } from './activityShared'

/* ─── Toolbar ──────────────────────────────────────────────────── */

export function ActivityToolbar({
    hasOutcomeFilter,
    isLoading,
    onClearOutcome,
    onQueryChange,
    onRefresh,
    onTimeRangeChange,
    outcomeFilter,
    query,
    shown,
    timeRange,
    total
}) {
    return (
        <div
            className="rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 flex-1 min-w-[200px] bg-bg-secondary border border-border-light">
                <i className="fas fa-magnifying-glass text-[11px] text-text-tertiary" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search by customer, contact, note, or who called…"
                    disabled={isLoading}
                    className="bg-transparent outline-none border-none text-[12.5px] w-full text-text-primary disabled:opacity-60"
                />
            </div>
            <div className="inline-flex rounded-md overflow-hidden border border-border-light">
                {TIME_RANGE_OPTIONS.map((opt) => {
                    const active = opt.key === timeRange
                    return (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => onTimeRangeChange(opt.key)}
                            disabled={isLoading}
                            className="text-[11.5px] font-semibold px-2.5 py-1.5 border-none cursor-pointer disabled:opacity-60 active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                            style={{
                                background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                                color: active ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>
            {hasOutcomeFilter && (
                <button
                    type="button"
                    onClick={onClearOutcome}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                    style={{
                        background: `${CALL_OUTCOME_COLORS[outcomeFilter]}1A`,
                        color: CALL_OUTCOME_COLORS[outcomeFilter]
                    }}
                    title="Clear outcome filter"
                >
                    <i className={`fas ${ICON_BY_OUTCOME[outcomeFilter] || 'fa-filter'} text-[10px]`} />
                    {CALL_OUTCOME_LABELS[outcomeFilter]}
                    <i className="fas fa-xmark text-[10px] opacity-80" />
                </button>
            )}
            <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer bg-bg-tertiary text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                title="Reload activity feed"
            >
                <i className="fas fa-rotate text-[10px]" />
                Refresh
            </button>
            <span className="text-[11.5px] text-text-tertiary tabular-nums ml-auto">
                {isLoading ? (
                    <span className="italic">Loading…</span>
                ) : (
                    <>
                        {shown} of {total}
                    </>
                )}
            </span>
        </div>
    )
}
