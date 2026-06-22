/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { CALL_OUTCOME_COLORS, CALL_OUTCOME_LABELS } from '../../../../../utils/CrmRosterUtility'

/* ─── Outcome breakdown bar (stacked, clickable) ────────────────── */

export function ActivityOutcomeBreakdown({ isLoading, metrics, onSelectOutcome, selectedOutcome }) {
    if (isLoading) {
        return (
            <div className="rounded-md p-3 bg-bg-primary border border-border-light">
                <div className="h-2.5 rounded bg-bg-tertiary animate-pulse" />
            </div>
        )
    }
    if (!metrics.total) return null
    const orderedKeys = ['booked', 'will_book_again', 'note', 'no_answer', 'not_interested']
    return (
        <div className="rounded-md p-3 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-text-tertiary">
                    Outcome mix
                </span>
                <span className="text-[10.5px] text-text-tertiary tabular-nums">
                    {metrics.total} entr{metrics.total === 1 ? 'y' : 'ies'}
                </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-bg-tertiary">
                {orderedKeys.map((key) => {
                    const count = metrics.outcomeCounts[key] || 0
                    if (count === 0) return null
                    const pct = (count / metrics.total) * 100
                    return (
                        <button type="button"
                            key={key}
                            type="button"
                            onClick={() => onSelectOutcome(key)}
                            title={`${CALL_OUTCOME_LABELS[key]} · ${count} (${Math.round(pct)}%)`}
                            className="h-full border-none cursor-pointer transition-opacity active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                            style={{
                                background: CALL_OUTCOME_COLORS[key],
                                opacity: selectedOutcome === 'all' || selectedOutcome === key ? 1 : 0.35,
                                width: `${pct}%`
                            }}
                            aria-label={`${CALL_OUTCOME_LABELS[key]} ${count} calls`}
                        />
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {orderedKeys.map((key) => {
                    const count = metrics.outcomeCounts[key] || 0
                    if (count === 0) return null
                    const isActive = selectedOutcome === key
                    return (
                        <button type="button"
                            key={key}
                            type="button"
                            onClick={() => onSelectOutcome(key)}
                            className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer bg-transparent border-none p-0 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                            style={{
                                color: isActive ? CALL_OUTCOME_COLORS[key] : 'var(--text-secondary)',
                                fontWeight: isActive ? 700 : 500
                            }}
                        >
                            <span
                                className="w-2 h-2 rounded-sm flex-shrink-0"
                                style={{ background: CALL_OUTCOME_COLORS[key] }}
                                aria-hidden="true"
                            />
                            <span>{CALL_OUTCOME_LABELS[key]}</span>
                            <span className="tabular-nums text-text-tertiary">{count}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
