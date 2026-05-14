import React from 'react'

/** A single stat cell — mirrors PlanView's RegionTotalCell layout (icon box +
 *  uppercase label + mono value) so the two surfaces share a visual rhythm. */
function SummaryCell({ accent, color, hint, icon, label, value, valueColor, warning }) {
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
                    color: warning ? '#fff' : accent
                }}
            >
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{label}</span>
                <span
                    className="text-[14px] font-bold font-mono tabular-nums font-heading"
                    style={{ color: valueColor || 'var(--text-primary)' }}
                >
                    {value}
                </span>
                {hint && <span className="text-[10px] text-text-secondary">{hint}</span>}
            </div>
        </div>
    )
}

/** Compact summary metrics shown above the My Reports week ribbon — mirrors
 *  the PlanView region-totals strip so the two surfaces feel related. */
export default function MyReportsSummaryBar({
    accent,
    cutoffLabel,
    daysLeft,
    isFuture,
    isPast,
    overdueCarryover,
    pending,
    submitted,
    weekLabel,
    weekRange
}) {
    const totalAssigned = submitted + pending
    const completionPct = totalAssigned > 0 ? Math.round((submitted / totalAssigned) * 100) : null
    const allDone = totalAssigned > 0 && pending === 0
    const urgent = !isFuture && !isPast && daysLeft <= 1 && pending > 0
    const daysValue = isPast ? 'Closed' : isFuture ? `${daysLeft}d` : `${daysLeft}d`
    const daysHint = isPast ? 'cutoff passed' : isFuture ? 'until opens' : `to ${cutoffLabel}`
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
                valueColor={allDone ? '#16a34a' : undefined}
                hint={completionPct != null ? `${completionPct}% complete` : undefined}
            />

            <SummaryCell
                accent={accent}
                color="#dc2626"
                icon="fa-hourglass-half"
                label="Pending"
                value={pending > 0 ? String(pending) : '—'}
                valueColor={pending > 0 && urgent ? '#dc2626' : undefined}
                hint={pending > 0 ? 'still due' : totalAssigned > 0 ? 'all in' : undefined}
                warning={urgent}
            />

            <SummaryCell
                accent={accent}
                color="#d97706"
                icon="fa-clock"
                label="Window"
                value={daysValue}
                valueColor={urgent ? '#dc2626' : undefined}
                hint={daysHint}
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

            <div className="flex-1" />

            {allDone && !isPast && (
                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#16a34a14] text-green-600">
                    <i className="fas fa-check-circle text-[12px]" />
                    All caught up
                </div>
            )}
        </div>
    )
}
