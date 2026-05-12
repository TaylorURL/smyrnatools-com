import React from 'react'

const SKELETON_ROW_LABELS = [
    'Fleet total',
    'Active',
    'Spare',
    'In shop',
    'Stationary',
    'Allocation',
    'Verified',
    'Operators',
    'Open alerts',
    'Open issues'
]

/**
 * Right-rail "at a glance" snapshot for the dashboard. Mirrors the Plan
 * tab's `PlanDashboardAtAGlance` so the user sees the same vertical
 * label/value pattern across both views. Hidden below `xl` breakpoint —
 * the Overview StatGroup already shows these numbers on smaller screens.
 *
 * Renders a skeleton variant when `loading` is true so the third column
 * doesn't disappear during the dashboard's bootstrap.
 */
export function DashboardAtAGlance({ alertCount, displayStats, loading = false, openIssues }) {
    if (loading) {
        return (
            <aside
                className="hidden xl:block sticky top-0 self-start py-5 pl-4 overflow-y-auto w-60"
                style={{ maxHeight: '100vh' }}
            >
                <div className="h-3 w-32 mb-2 rounded animate-pulse bg-bg-tertiary" />
                <div className="flex flex-col">
                    {SKELETON_ROW_LABELS.map((label, i) => (
                        <div
                            key={label}
                            className="flex items-baseline justify-between py-1.5 border-b border-border-light"
                        >
                            <span className="text-[12px] text-text-secondary">{label}</span>
                            <span
                                className="h-3 w-12 rounded animate-pulse bg-bg-tertiary"
                                style={{ animationDelay: `${i * 40}ms` }}
                            />
                        </div>
                    ))}
                </div>
            </aside>
        )
    }

    const stats = displayStats || {}
    const ops = stats.operators || {}
    const allocation = Math.round(stats.overallAllocationPercent || 0)
    const verified = Math.round(stats.verificationAverage || 0)
    const inShop =
        (stats.mixers?.shop || 0) +
        (stats.tractors?.shop || 0) +
        (stats.trailers?.shop || 0) +
        (stats.equipment?.shop || 0) +
        (stats.pickups?.shop || 0)
    const spare =
        (stats.mixers?.spare || 0) +
        (stats.tractors?.spare || 0) +
        (stats.trailers?.spare || 0) +
        (stats.equipment?.spare || 0)
    const stationary = stats.pickups?.stationary || 0
    const active =
        (stats.mixers?.active || 0) +
        (stats.tractors?.active || 0) +
        (stats.trailers?.active || 0) +
        (stats.equipment?.active || 0) +
        (stats.pickups?.active || 0)

    const dateLabel = new Date().toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
        year: 'numeric'
    })

    const allocationColor = allocation >= 80 ? '#16a34a' : allocation >= 50 ? '#d97706' : '#dc2626'
    const verifiedColor = verified >= 90 ? '#16a34a' : verified >= 70 ? '#d97706' : '#dc2626'

    const rows = [
        { label: 'Fleet total', value: (stats.fleetTotal || 0).toLocaleString() },
        { color: '#16a34a', label: 'Active', value: active.toLocaleString() },
        { color: '#7c3aed', label: 'Spare', value: spare.toLocaleString() },
        { color: '#1e40af', label: 'In shop', value: inShop.toLocaleString() },
        { color: '#a16207', label: 'Stationary', value: stationary.toLocaleString() },
        { color: allocationColor, label: 'Allocation', value: `${allocation}%` },
        { color: verifiedColor, label: 'Verified', value: `${verified}%` },
        { label: 'Operators', value: (ops.active || 0).toLocaleString() },
        { color: alertCount > 0 ? '#dc2626' : undefined, label: 'Open alerts', value: (alertCount || 0).toString() },
        { color: openIssues > 0 ? '#d97706' : undefined, label: 'Open issues', value: (openIssues || 0).toString() }
    ]

    return (
        <aside
            className="hidden xl:block sticky top-0 self-start py-5 pl-4 overflow-y-auto w-60"
            style={{ maxHeight: '100vh' }}
        >
            <div className="text-[12px] mb-1 text-text-tertiary">{dateLabel}</div>
            <div className="flex flex-col">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className="flex items-baseline justify-between py-1.5 border-b border-border-light"
                    >
                        <span className="text-[12px] text-text-secondary">{row.label}</span>
                        <span
                            className="text-[13px] font-semibold font-mono tabular-nums"
                            style={{ color: row.color || 'var(--text-primary)' }}
                        >
                            {row.value}
                        </span>
                    </div>
                ))}
            </div>
        </aside>
    )
}
