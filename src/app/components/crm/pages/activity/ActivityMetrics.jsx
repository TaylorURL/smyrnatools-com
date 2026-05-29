import React from 'react'

/* ─── KPI strip ────────────────────────────────────────────────── */

export function ActivityMetrics({ accentColor, isLoading, metrics, rangeLabel }) {
    if (isLoading) {
        return (
            <div className="rounded-md overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-bg-primary border border-border-light">
                {Array.from({ length: 5 }).map((_, i) => (
                    <MetricSkel key={i} />
                ))}
            </div>
        )
    }
    const bookedPct = Math.round((metrics.bookedRate || 0) * 100)
    return (
        <div className="rounded-md overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-bg-primary border border-border-light">
            <MetricCell label="Calls today" value={metrics.callsToday} />
            <MetricCell label="Calls this week" value={metrics.callsWeek} sub={`Range · ${rangeLabel}`} />
            <MetricCell
                label="Booked"
                sub={metrics.total > 0 ? `${bookedPct}% of activity` : 'No activity'}
                value={metrics.outcomeCounts.booked || 0}
            />
            <MetricCell label="Customers contacted" sub="Unique customer #" value={metrics.uniqueCustomers} />
            <MetricCell
                label="Top caller"
                sub={
                    metrics.topCaller
                        ? `${metrics.topCaller.count} call${metrics.topCaller.count === 1 ? '' : 's'}`
                        : '—'
                }
                value={metrics.topCaller ? metrics.topCaller.name : '—'}
                valueText
            />
        </div>
    )
}

function MetricCell({ label, sub, value, valueText }) {
    return (
        <div className="px-3 py-2.5 flex flex-col gap-0.5 bg-bg-primary border-r last:border-r-0 border-b sm:border-b-0 border-border-light">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-text-tertiary">{label}</span>
            <span
                className={`leading-tight font-semibold tabular-nums text-text-primary ${valueText ? 'text-[14px] truncate' : 'text-[20px] font-mono'}`}
                title={valueText ? String(value) : undefined}
            >
                {value}
            </span>
            {sub && <span className="text-[10.5px] text-text-tertiary">{sub}</span>}
        </div>
    )
}

function MetricSkel() {
    return (
        <div className="px-3 py-2.5 flex flex-col gap-1 border-r last:border-r-0 border-b sm:border-b-0 border-border-light">
            <div className="h-2 w-16 rounded bg-bg-tertiary animate-pulse" />
            <div className="h-5 w-12 rounded bg-bg-tertiary animate-pulse" />
            <div className="h-2 w-20 rounded bg-bg-tertiary animate-pulse" />
        </div>
    )
}
