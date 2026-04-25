import React from 'react'

import { DashboardCard, SectionTitle } from '../ui/DashboardCards'

/** KPI chip used in the top summary band — compact enough to pack ~6 across. */
function OpsKpi({ label, value, tint, icon }) {
    const color = tint || 'var(--accent)'
    return (
        <div className="relative flex items-center gap-2.5 rounded-xl border border-border-light bg-bg-primary px-3 py-2.5 overflow-hidden flex-1 min-w-[140px]">
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
                style={{ background: color }}
            />
            <div
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ background: `${color}14`, color }}
            >
                <i className={`fas ${icon} text-xs`} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider truncate">
                    {label}
                </span>
                <span className="text-lg font-bold leading-tight tabular-nums" style={{ color }}>
                    {value}
                </span>
            </div>
        </div>
    )
}

/**
 * Operations section — workforce + service KPI band only. The detailed
 * pipeline lists and asset attention chips already live in the side menu,
 * so this surface stays focused on the headline numbers.
 */
export default function DashboardOperationsSection({ displayStats, accentColor }) {
    const ops = displayStats.operators || {}
    return (
        <DashboardCard accent={accentColor} className="flex flex-col">
            <SectionTitle icon="fa-gauge-high" accentColor={accentColor} subtitle="Workforce and service overview">
                Operations
            </SectionTitle>
            <div className="flex flex-wrap gap-2.5">
                <OpsKpi icon="fa-users" label="Operators" tint={accentColor} value={ops.total || 0} />
                <OpsKpi icon="fa-user-check" label="Active" tint="#16a34a" value={ops.active || 0} />
                <OpsKpi
                    icon="fa-user-clock"
                    label="Unassigned"
                    tint={(ops.unassigned || 0) > 0 ? '#f59e0b' : '#64748b'}
                    value={ops.unassigned || 0}
                />
                <OpsKpi icon="fa-user-injured" label="Light Duty" tint="#6366f1" value={ops.lightDuty || 0} />
                <OpsKpi
                    icon="fa-exclamation-triangle"
                    label="Service Overdue"
                    tint={(displayStats.overdueTotal || 0) > 0 ? '#dc2626' : '#16a34a'}
                    value={displayStats.overdueTotal || 0}
                />
                <OpsKpi
                    icon="fa-wrench"
                    label="Open Issues"
                    tint={(displayStats.openIssuesTotal || 0) > 0 ? '#f59e0b' : '#16a34a'}
                    value={displayStats.openIssuesTotal || 0}
                />
            </div>
        </DashboardCard>
    )
}
