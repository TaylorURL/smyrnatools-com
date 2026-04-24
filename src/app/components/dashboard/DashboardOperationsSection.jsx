import React from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { STATUS_COLORS } from '../../constants/dashboardConstants'
import { DashboardCard, SectionTitle } from '../ui/DashboardCards'

const STATUSES = ['Active', 'Spare', 'In Shop', 'Stationary']

const calcMetrics = (data) => {
    const total = data.reduce((sum, d) => sum + d.days, 0)
    const findDays = (status) => data.find((d) => d.status === status)?.days || 0
    return {
        active: total > 0 ? Math.round((findDays('Active') / total) * 100) : 0,
        inShop: total > 0 ? Math.round((findDays('In Shop') / total) * 100) : 0,
        spare: total > 0 ? Math.round((findDays('Spare') / total) * 100) : 0
    }
}

const buildChartEntry = (data, name) => {
    if (!data?.length) return null
    const entry = { name }
    for (const status of STATUSES) {
        const key = status === 'In Shop' ? 'inShop' : status.toLowerCase()
        entry[key] = parseFloat(data.find((d) => d.status === status)?.percentage || 0)
    }
    return entry
}

const ASSET_CONFIG = [
    { dataKey: 'mixers', isConcreteOnly: true, name: 'Mixers' },
    { dataKey: 'tractors', isConcreteOnly: false, name: 'Tractors' },
    { dataKey: 'trailers', isConcreteOnly: false, name: 'Trailers' },
    { dataKey: 'equipment', isConcreteOnly: false, name: 'Equipment' },
    { dataKey: 'pickups', isConcreteOnly: false, name: 'Pickups' }
]

const DATE_FILTER_LABELS = ['last-week', 'this-month', 'this-quarter', 'this-year', 'all']
const formatFilterLabel = (filter) =>
    filter
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

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

/** Pipeline panel — tinted card with title, count badge, and scrollable name chips. */
function PipelinePanel({ icon, tint, title, items, renderLabel, emptyText }) {
    return (
        <div
            className="rounded-xl border px-3 py-2.5 flex flex-col"
            style={{ background: `${tint}0a`, borderColor: `${tint}2a` }}
        >
            <div className="flex items-center gap-2 mb-2">
                <div
                    className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-inset"
                    style={{ background: `${tint}20`, boxShadow: `inset 0 0 0 1px ${tint}30` }}
                >
                    <i className={`fas ${icon} text-xs`} style={{ color: tint }} />
                </div>
                <span className="text-[13px] font-semibold text-text-primary flex-1 truncate">{title}</span>
                <span
                    className="rounded-full text-white text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 leading-none"
                    style={{ background: tint }}
                >
                    {items.length}
                </span>
            </div>
            {items.length === 0 ? (
                <span className="text-[11px] text-text-secondary italic">{emptyText}</span>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {items.map((item, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                                background: `${tint}14`,
                                borderColor: `${tint}30`,
                                color: tint
                            }}
                            title={renderLabel(item, true)}
                        >
                            {renderLabel(item)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

/** Asset-type breakdown chip row (used for overdue + issue counts). */
function AssetChipRow({ data, tint, emptyText }) {
    const rows = data.filter((d) => d.count > 0)
    if (rows.length === 0) {
        return <span className="text-[11px] text-text-secondary italic">{emptyText}</span>
    }
    return (
        <div className="flex flex-wrap gap-1.5">
            {rows.map((row) => (
                <span
                    key={row.label}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: `${tint}14`, borderColor: `${tint}30`, color: tint }}
                >
                    <span className="opacity-80">{row.label}</span>
                    <span className="tabular-nums text-text-primary bg-bg-primary rounded-full px-1.5 border border-border-light">
                        {row.count}
                    </span>
                </span>
            ))}
        </div>
    )
}

function HistoryTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div
            className="rounded-lg shadow-lg px-3.5 py-2.5"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <p className="text-sm font-semibold m-0 mb-1.5" style={{ color: 'var(--text-primary)' }}>
                {label}
            </p>
            {payload
                .filter((p) => p.value > 0)
                .map((entry, index) => (
                    <p key={index} className="text-xs m-0.5" style={{ color: entry.color }}>
                        {entry.name}: {entry.value.toFixed(1)}%
                    </p>
                ))}
        </div>
    )
}

/**
 * Consolidated Operations section replacing the old side-by-side People +
 * Maintenance split. Three visible bands in a single full-width card:
 *   1. KPI strip — mixed workforce + service stats
 *   2. Attention grid — people pipeline (Training / Pending / Light Duty)
 *      paired with asset attention (service overdue + open issues per type)
 *   3. Historical status distribution chart with quick date filters
 */
export default function DashboardOperationsSection({
    displayStats,
    isAggregate,
    filteredTrainingOperators,
    filteredPendingStartOperators,
    filteredLightDutyOperators,
    statusHistoryData,
    handleQuickDateFilter,
    formatPendingDate,
    accentColor,
    isMobile
}) {
    const ops = displayStats.operators || {}
    const overdueByAsset = [
        !isAggregate && { count: displayStats.mixers?.overdue || 0, label: 'Mixers' },
        { count: displayStats.tractors?.overdue || 0, label: 'Tractors' },
        { count: displayStats.trailers?.overdue || 0, label: 'Trailers' },
        { count: displayStats.equipment?.overdue || 0, label: 'Equipment' }
    ].filter(Boolean)
    const issuesByAsset = [
        !isAggregate && { count: displayStats.mixers?.issues || 0, label: 'Mixers' },
        { count: displayStats.tractors?.issues || 0, label: 'Tractors' },
        { count: displayStats.trailers?.issues || 0, label: 'Trailers' },
        { count: displayStats.equipment?.issues || 0, label: 'Equipment' }
    ].filter(Boolean)

    const chartData = ASSET_CONFIG.map((a) => {
        if (a.isConcreteOnly && isAggregate) return null
        return buildChartEntry(statusHistoryData[a.dataKey], a.name)
    }).filter(Boolean)

    const assetSummaries = ASSET_CONFIG.filter((a) => !a.isConcreteOnly || !isAggregate).map((a) => ({
        name: a.name,
        ...calcMetrics(statusHistoryData[a.dataKey])
    }))

    return (
        <DashboardCard accent={accentColor} className="flex flex-col">
            <SectionTitle
                icon="fa-gauge-high"
                accentColor={accentColor}
                subtitle="Workforce, service attention, and historical utilization"
            >
                Operations
            </SectionTitle>

            {/* Band 1 — KPI strip */}
            <div className="flex flex-wrap gap-2.5 mb-5">
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

            {/* Band 2 — attention grid */}
            <div className={`grid gap-3 mb-5 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
                <div className="flex flex-col gap-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary m-0 px-1">
                        People pipeline
                    </h4>
                    <PipelinePanel
                        icon="fa-chalkboard-user"
                        tint="#0ea5e9"
                        title="In Training"
                        items={filteredTrainingOperators}
                        emptyText="No operators in training."
                        renderLabel={(r, full) =>
                            full
                                ? `${r.operatorName} · training at ${r.trainerPlant} for ${r.operatorPlant} (trainer: ${r.trainerName || '—'})`
                                : `${r.operatorName}${r.operatorPlant ? ` → ${r.operatorPlant}` : ''}`
                        }
                    />
                    <PipelinePanel
                        icon="fa-hourglass-half"
                        tint="#f59e0b"
                        title="Pending Start"
                        items={filteredPendingStartOperators}
                        emptyText="No pending-start operators."
                        renderLabel={(r, full) => {
                            const date = formatPendingDate ? formatPendingDate(r.pendingDate) : r.pendingDate
                            return full
                                ? `${r.operatorName} · ${r.operatorPlant || '—'} · starts ${date || 'TBD'}`
                                : `${r.operatorName}${date ? ` · ${date}` : ''}`
                        }}
                    />
                    <PipelinePanel
                        icon="fa-user-injured"
                        tint="#6366f1"
                        title="Light Duty"
                        items={filteredLightDutyOperators}
                        emptyText="No operators on light duty."
                        renderLabel={(r, full) =>
                            full
                                ? `${r.operatorName} · ${r.plant || '—'}`
                                : `${r.operatorName}${r.plant ? ` · ${r.plant}` : ''}`
                        }
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary m-0 px-1">
                        Asset attention
                    </h4>
                    <div
                        className="rounded-xl border px-3 py-3"
                        style={{ background: 'rgba(220, 38, 38, 0.06)', borderColor: 'rgba(220, 38, 38, 0.25)' }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div
                                className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-inset"
                                style={{
                                    background: 'rgba(220, 38, 38, 0.18)',
                                    boxShadow: 'inset 0 0 0 1px rgba(220, 38, 38, 0.3)'
                                }}
                            >
                                <i className="fas fa-exclamation-triangle text-xs" style={{ color: '#dc2626' }} />
                            </div>
                            <span className="text-[13px] font-semibold text-text-primary flex-1">Service Overdue</span>
                            <span className="rounded-full text-white text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 leading-none bg-red-600">
                                {displayStats.overdueTotal || 0}
                            </span>
                        </div>
                        <AssetChipRow data={overdueByAsset} tint="#dc2626" emptyText="No overdue service." />
                    </div>
                    <div
                        className="rounded-xl border px-3 py-3"
                        style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div
                                className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-inset"
                                style={{
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    boxShadow: 'inset 0 0 0 1px rgba(245, 158, 11, 0.35)'
                                }}
                            >
                                <i className="fas fa-wrench text-xs" style={{ color: '#f59e0b' }} />
                            </div>
                            <span className="text-[13px] font-semibold text-text-primary flex-1">Open Issues</span>
                            <span
                                className="rounded-full text-white text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 leading-none"
                                style={{ background: '#f59e0b' }}
                            >
                                {displayStats.openIssuesTotal || 0}
                            </span>
                        </div>
                        <AssetChipRow data={issuesByAsset} tint="#f59e0b" emptyText="No open issues." />
                    </div>
                </div>
            </div>

            {/* Band 3 — historical chart */}
            <div className="border-t border-border-light pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h4 className="text-sm md:text-base font-semibold text-text-primary m-0">
                        Historical Status Distribution
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {DATE_FILTER_LABELS.map((filter) => (
                            <button
                                key={filter}
                                onClick={() => handleQuickDateFilter(filter)}
                                className="bg-bg-tertiary border border-border-light rounded-md text-text-secondary text-[10px] md:text-xs font-semibold px-2 py-1 md:px-3 md:py-1.5 cursor-pointer hover:brightness-95 transition"
                            >
                                {formatFilterLabel(filter)}
                            </button>
                        ))}
                    </div>
                </div>

                <div
                    className={`grid gap-2.5 mb-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-[repeat(auto-fit,minmax(140px,1fr))]'}`}
                >
                    {assetSummaries.map((asset) => (
                        <div key={asset.name} className="bg-bg-tertiary border border-border-light rounded-lg p-3">
                            <div className="text-xs font-semibold text-text-primary mb-2">{asset.name}</div>
                            <div className="flex flex-col gap-1">
                                {[
                                    {
                                        color: 'text-emerald-600 dark:text-emerald-400',
                                        label: 'Active',
                                        value: asset.active
                                    },
                                    {
                                        color: 'text-violet-600 dark:text-violet-400',
                                        label: 'Spare',
                                        value: asset.spare
                                    },
                                    { color: 'text-sky-600 dark:text-sky-400', label: 'In Shop', value: asset.inShop }
                                ].map(({ color, label, value }) => (
                                    <div key={label} className="flex justify-between text-[11px]">
                                        <span className={color}>{label}</span>
                                        <span className="font-semibold text-text-primary tabular-nums">{value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {chartData.length === 0 ? (
                    <div className="text-center py-5 text-text-secondary text-sm">No historical data available</div>
                ) : (
                    <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis
                                type="number"
                                domain={[0, 100]}
                                unit="%"
                                tick={{ fill: 'var(--text-secondary)', fontSize: isMobile ? 10 : 11 }}
                            />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fill: 'var(--text-secondary)', fontSize: isMobile ? 10 : 12 }}
                                width={isMobile ? 55 : 80}
                            />
                            <Tooltip content={<HistoryTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                            <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
                            <Bar dataKey="active" stackId="a" fill={STATUS_COLORS.Active} name="Active" />
                            <Bar dataKey="spare" stackId="a" fill={STATUS_COLORS.Spare} name="Spare" />
                            <Bar dataKey="inShop" stackId="a" fill={STATUS_COLORS['In Shop']} name="In Shop" />
                            <Bar dataKey="stationary" stackId="a" fill={STATUS_COLORS.Stationary} name="Stationary" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </DashboardCard>
    )
}
