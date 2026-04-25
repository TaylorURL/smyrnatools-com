import React from 'react'

import { Panel } from '../ui/Panel'

/**
 * Canonical status palette (matches mixerConfig.statusBadgeClasses + Fleet
 * Overview): Active green, Spare violet, In Shop blue, Stationary amber.
 */
const STATUS_TINTS = {
    active: '#166534',
    inShop: '#1e40af',
    spare: '#7c3aed',
    stationary: '#a16207',
    warning: '#a16207'
}

/** Inline status chip — colored count + label, no wrapping container. */
function StatChip({ label, value, tint }) {
    return (
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[15px] font-bold tabular-nums" style={{ color: tint }}>
                {value}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
        </div>
    )
}

/**
 * Deployment bar — share of the population currently active / on-roster.
 * Matches Fleet Overview's allocation bar visually so the two sections
 * scan identically.
 */
function DeploymentBar({ percent, label, tooltip }) {
    const pct = Math.min(100, Math.max(0, percent || 0))
    const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626'
    return (
        <div className="flex items-center gap-2 min-w-[200px]" title={tooltip}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                {label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ background: color, width: `${pct}%` }} />
            </div>
            <span className="text-[12px] font-bold tabular-nums" style={{ color }}>
                {pct}%
            </span>
        </div>
    )
}

/** Sub-type pill for manager role breakdown (Plant / District / Safety). */
function SubTypePill({ label, value, tint }) {
    return (
        <div
            className="flex items-center gap-1.5 rounded-md bg-bg-tertiary px-2 py-1 border border-border-light"
            title={`${label} · ${value}`}
        >
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: tint }}>
                {value}
            </span>
        </div>
    )
}

/** Single row in the flat People Overview — same rhythm as Fleet Overview. */
function PeopleRow({ icon, iconColor, label, total, stats, subTypes, deployment, isTotal }) {
    return (
        <div
            className={`flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-2 border-b border-border-light last:border-b-0 transition-colors ${
                isTotal ? 'border-t-2 border-t-border-medium bg-bg-tertiary/50 font-semibold' : 'hover:bg-bg-tertiary'
            }`}
        >
            <div className="flex items-center gap-3 min-w-[180px] flex-shrink-0">
                <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ring-1 ring-inset"
                    style={{
                        background: `${iconColor}14`,
                        color: iconColor,
                        boxShadow: `inset 0 0 0 1px ${iconColor}22`
                    }}
                >
                    <i className={`fas ${icon} text-[15px]`} />
                </div>
                <div>
                    <div
                        className={`text-[10px] uppercase tracking-wider leading-none ${
                            isTotal ? 'font-bold text-text-primary' : 'font-semibold text-text-secondary'
                        }`}
                    >
                        {label}
                    </div>
                    <div className="text-[24px] font-bold leading-tight text-text-primary tabular-nums">{total}</div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 flex-1">
                {stats.map(({ key, label: sLabel, value, tint }) => (
                    <StatChip key={key} label={sLabel} value={value} tint={tint} />
                ))}
            </div>
            {subTypes && subTypes.length > 0 && <div className="flex flex-wrap items-center gap-1.5">{subTypes}</div>}
            {deployment && (
                <DeploymentBar percent={deployment.percent} label={deployment.label} tooltip={deployment.tooltip} />
            )}
        </div>
    )
}

/**
 * Flat People Overview — workforce categories rendered as inline rows,
 * matching Fleet Overview's rhythm. Categories: Operators, Managers.
 * Totals row sums every count above.
 *
 * Detailed name-by-name lists for Training / Pending / Light-Duty live in
 * the side menu — this surface stays at the headline-numbers level.
 */
export default function DashboardPeopleSection({ displayStats, isAggregate, managerStats, accentColor }) {
    const ops = displayStats.operators || {}
    const totalOperators = ops.total || 0
    const activeOperators = ops.active || 0
    const lightDuty = ops.lightDuty || 0
    const unassigned = ops.unassigned || 0
    const mixerAssigned = ops.mixerAssigned || 0
    const tractorAssigned = ops.tractorAssigned || 0
    const deploymentPercent = totalOperators > 0 ? Math.round((activeOperators / totalOperators) * 100) : 0

    const operatorStats = [
        { key: 'active', label: 'Active', tint: STATUS_TINTS.active, value: activeOperators },
        { key: 'lightDuty', label: 'Light Duty', tint: STATUS_TINTS.spare, value: lightDuty },
        { key: 'unassigned', label: 'Unassigned', tint: STATUS_TINTS.warning, value: unassigned }
    ]
    const operatorSubTypes = [
        !isAggregate && mixerAssigned > 0 ? (
            <SubTypePill key="mixers" label="Mixers" value={mixerAssigned} tint="#2563eb" />
        ) : null,
        tractorAssigned > 0 ? (
            <SubTypePill key="tractors" label="Tractors" value={tractorAssigned} tint="#16a34a" />
        ) : null
    ].filter(Boolean)

    const managers = managerStats || { buckets: {}, total: 0 }
    const managerSubTypes = [
        managers.buckets.plant > 0 ? (
            <SubTypePill key="plant" label="Plant" value={managers.buckets.plant} tint="#0ea5e9" />
        ) : null,
        managers.buckets.district > 0 ? (
            <SubTypePill key="district" label="District" value={managers.buckets.district} tint="#9333ea" />
        ) : null,
        managers.buckets.safety > 0 ? (
            <SubTypePill key="safety" label="Safety" value={managers.buckets.safety} tint="#dc2626" />
        ) : null,
        managers.buckets.other > 0 ? (
            <SubTypePill key="other" label="Other" value={managers.buckets.other} tint="#64748b" />
        ) : null
    ].filter(Boolean)

    const peopleRows = [
        <PeopleRow
            key="operators"
            icon="fa-users"
            iconColor="#0284c7"
            label="Operators"
            total={totalOperators}
            stats={operatorStats}
            subTypes={operatorSubTypes}
            deployment={{
                label: 'Deployment',
                percent: deploymentPercent,
                tooltip:
                    'Deployment — share of operators currently Active vs total roster. Green ≥ 80%, amber ≥ 50%, red < 50%.'
            }}
        />,
        <PeopleRow
            key="managers"
            icon="fa-user-tie"
            iconColor="#7c3aed"
            label="Managers"
            total={managers.total}
            stats={[]}
            subTypes={managerSubTypes}
        />
    ]

    const totalHeadcount = totalOperators + managers.total
    peopleRows.push(
        <PeopleRow
            key="totals"
            icon="fa-list-check"
            iconColor={accentColor || '#1e3a5f'}
            label="People Total"
            total={totalHeadcount}
            stats={[
                { key: 'active', label: 'Active', tint: STATUS_TINTS.active, value: activeOperators },
                { key: 'lightDuty', label: 'Light Duty', tint: STATUS_TINTS.spare, value: lightDuty },
                { key: 'unassigned', label: 'Unassigned', tint: STATUS_TINTS.warning, value: unassigned },
                { key: 'managers', label: 'Managers', tint: '#7c3aed', value: managers.total }
            ]}
            isTotal
        />
    )

    return (
        <Panel
            title="People Overview"
            right={
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    Operators and managers
                </span>
            }
        >
            <div className="flex flex-col">{peopleRows}</div>
        </Panel>
    )
}
