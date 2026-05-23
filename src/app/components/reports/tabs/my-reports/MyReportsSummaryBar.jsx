import React from 'react'

import DeadlineFuse from '../../DeadlineFuse'

/** A single stat cell — mirrors OperationsView's RegionTotalCell layout (icon box +
 *  uppercase label + mono value) so the two surfaces share a visual rhythm. */
function SummaryCell({ accent, color, hint, icon, label, value, warning }) {
    const accentTint = `${accent}14`
    return (
        <div
            className="rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0"
            style={{
                background: warning ? `${color || '#dc2626'}12` : 'var(--bg-primary)',
                border: `1px solid ${warning ? `${color || '#dc2626'}66` : 'var(--border-light)'}`
            }}
        >
            <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{
                    background: warning ? color || '#dc2626' : accentTint,
                    color: warning ? '#fff' : 'var(--text-primary)'
                }}
            >
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{label}</span>
                <span className="text-[14px] font-bold font-mono tabular-nums font-heading text-text-primary">
                    {value}
                </span>
                {hint && <span className="text-[10px] text-text-secondary">{hint}</span>}
            </div>
        </div>
    )
}

/** Compact summary metrics shown above the My Reports week ribbon — mirrors
 *  the OperationsView region-totals strip so the two surfaces feel related. */
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
    return (
        <div
            className="shrink-0 flex items-center gap-2 overflow-x-auto px-3 py-2 rounded-lg border"
            style={{
                background: urgent ? 'linear-gradient(90deg, #fee2e240, #fef3c740)' : 'var(--bg-primary)',
                borderColor: urgent ? '#fbbf24' : 'var(--border-light)'
            }}
        >
            <span className="text-[9px] font-semibold uppercase tracking-wider shrink-0 mr-1 text-text-secondary">
                {weekLabel}
                {weekRange ? ` · ${weekRange}` : ''}
            </span>

            <SummaryCell
                accent={accent}
                icon="fa-circle-check"
                label="Submitted"
                value={totalAssigned > 0 ? `${submitted}/${totalAssigned}` : '—'}
                hint={completionPct != null ? `${completionPct}% complete` : undefined}
            />

            <SummaryCell
                accent={accent}
                color="#dc2626"
                icon="fa-hourglass-half"
                label="Pending"
                value={pending > 0 ? String(pending) : '—'}
                hint={pending > 0 ? 'still due' : totalAssigned > 0 ? 'all in' : undefined}
                warning={urgent}
            />

            {overdueCarryover > 0 && (
                <SummaryCell
                    accent={accent}
                    color="#dc2626"
                    icon="fa-triangle-exclamation"
                    label="Overdue"
                    value={String(overdueCarryover)}
                    hint="prior weeks"
                    warning
                />
            )}

            {allDone && !isPast && (
                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#16a34a14] text-text-primary">
                    <i className="fas fa-check-circle text-[12px]" />
                    All caught up
                </div>
            )}

            {/* Deadline indicator — pulled in from the old standalone
             *  DeadlineFuse card and rendered inline on the right. We
             *  give it `flex-1` so the day-pill row stretches across the
             *  empty space at the end of the bar instead of sitting in a
             *  tight cluster next to the stats. */}
            <div className="flex-1 min-w-[260px] hidden sm:flex">
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
    )
}
