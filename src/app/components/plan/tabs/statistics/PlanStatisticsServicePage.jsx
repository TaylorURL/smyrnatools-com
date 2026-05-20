/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

import { fmtDate, fmtInt, fmtPct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../../utils/PlanStatisticsUtility'
import { formatColocatedCodeLabel, formatColocatedPlantLabel } from '../../../../../utils/PlantColocationUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { EmptySection, RefreshingHint } from './PlanStatisticsPages'

const GOOD_COLOR = '#16a34a'
const LATE_COLOR = '#f59e0b'
const SLOW_COLOR = '#ea580c'
const BOTH_COLOR = '#b91c1c'

const fmtMinutes = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    if (n < 60) return `${Math.round(n)} min`
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const goodPctColor = (pct) => {
    if (pct == null) return 'var(--text-tertiary)'
    if (pct >= 0.9) return GOOD_COLOR
    if (pct >= 0.75) return '#65a30d'
    if (pct >= 0.6) return LATE_COLOR
    return BOTH_COLOR
}

/** Two-line tag explaining why a single bad order was bad. */
function FailureTags({ isLate, isSlow }) {
    if (!isLate && !isSlow) return null
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {isLate && (
                <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: `${LATE_COLOR}20`, color: LATE_COLOR }}
                >
                    <i className="fas fa-clock text-[9px]" />
                    Late
                </span>
            )}
            {isSlow && (
                <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: `${SLOW_COLOR}20`, color: SLOW_COLOR }}
                >
                    <i className="fas fa-gauge-simple-low text-[9px]" />
                    Slow
                </span>
            )}
        </div>
    )
}

/** Sortable column header for the plant scorecard. */
function ColumnHeader({ active, direction, label, numeric, onClick }) {
    const arrow = !active ? '' : direction === 'asc' ? ' ↑' : ' ↓'
    return (
        <th
            onClick={onClick}
            className={`text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap cursor-pointer select-none border-b border-border-light bg-bg-tertiary text-text-tertiary ${
                numeric ? 'text-right' : 'text-left'
            }`}
        >
            <span style={{ color: active ? 'var(--text-primary)' : undefined }}>
                {label}
                {arrow}
            </span>
        </th>
    )
}

function PlantScorecardTable({ colocationMap, plantNameByCode, rows }) {
    const [sortKey, setSortKey] = useState('goodPct')
    const [sortDir, setSortDir] = useState('desc')
    const toggleSort = (key, defaultDir) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        else {
            setSortKey(key)
            setSortDir(defaultDir || 'desc')
        }
    }
    const sorted = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1
        const cmp = (a, b) => {
            if (sortKey === 'plant') {
                const al = formatColocatedPlantLabel(a.code, plantNameByCode, colocationMap)
                const bl = formatColocatedPlantLabel(b.code, plantNameByCode, colocationMap)
                return al.localeCompare(bl) * dir
            }
            const av = a[sortKey]
            const bv = b[sortKey]
            const an = av == null ? -Infinity : av
            const bn = bv == null ? -Infinity : bv
            return (an - bn) * dir
        }
        return [...rows].sort(cmp)
    }, [rows, sortKey, sortDir, plantNameByCode, colocationMap])

    return (
        <div className="overflow-x-auto rounded border border-border-light">
            <table className="w-full min-w-[820px] border-collapse">
                <thead>
                    <tr>
                        <ColumnHeader
                            active={sortKey === 'plant'}
                            direction={sortDir}
                            label="Plant"
                            onClick={() => toggleSort('plant', 'asc')}
                        />
                        <ColumnHeader
                            active={sortKey === 'jobs'}
                            direction={sortDir}
                            label="Jobs"
                            numeric
                            onClick={() => toggleSort('jobs')}
                        />
                        <ColumnHeader
                            active={sortKey === 'goodJobs'}
                            direction={sortDir}
                            label="Good"
                            numeric
                            onClick={() => toggleSort('goodJobs')}
                        />
                        <ColumnHeader
                            active={sortKey === 'lateJobs'}
                            direction={sortDir}
                            label="Late"
                            numeric
                            onClick={() => toggleSort('lateJobs')}
                        />
                        <ColumnHeader
                            active={sortKey === 'slowJobs'}
                            direction={sortDir}
                            label="Slow"
                            numeric
                            onClick={() => toggleSort('slowJobs')}
                        />
                        <ColumnHeader
                            active={sortKey === 'goodPct'}
                            direction={sortDir}
                            label="Good %"
                            numeric
                            onClick={() => toggleSort('goodPct')}
                        />
                        <ColumnHeader
                            active={sortKey === 'avgLateMin'}
                            direction={sortDir}
                            label="Avg late"
                            numeric
                            onClick={() => toggleSort('avgLateMin')}
                        />
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((row) => {
                        const pctColor = goodPctColor(row.goodPct)
                        const codeLabel = formatColocatedCodeLabel(row.code, colocationMap)
                        const plantLabel = formatColocatedPlantLabel(row.code, plantNameByCode, colocationMap)
                        return (
                            <tr key={row.code} className="border-t border-border-light">
                                <td className="px-3 py-2 text-[12.5px] text-text-primary">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                                            {codeLabel}
                                        </span>
                                        <span className="font-semibold">{plantLabel}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-primary">
                                    {fmtInt(row.jobs)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {fmtInt(row.goodJobs)}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12.5px] tabular-nums"
                                    style={{ color: row.lateJobs > 0 ? LATE_COLOR : 'var(--text-secondary)' }}
                                >
                                    {fmtInt(row.lateJobs)}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12.5px] tabular-nums"
                                    style={{ color: row.slowJobs > 0 ? SLOW_COLOR : 'var(--text-secondary)' }}
                                >
                                    {fmtInt(row.slowJobs)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums font-semibold">
                                    {row.goodPct == null ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        <div className="flex items-center gap-2 justify-end">
                                            <div className="w-[60px] rounded h-2 overflow-hidden bg-bg-tertiary">
                                                <div
                                                    className="h-full"
                                                    style={{
                                                        background: pctColor,
                                                        width: `${Math.max(2, row.goodPct * 100)}%`
                                                    }}
                                                />
                                            </div>
                                            <span style={{ color: pctColor }}>{fmtPct(row.goodPct)}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {row.lateJobs > 0 ? fmtMinutes(row.avgLateMin) : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function CustomerList({ emptyMessage, rows }) {
    if (!rows.length) {
        return <div className="text-[12px] py-3 text-center text-text-tertiary">{emptyMessage}</div>
    }
    return (
        <div className="flex flex-col">
            {rows.map((row, idx) => (
                <div
                    key={row.name + idx}
                    className="flex items-center gap-2 py-1.5 border-b border-border-light last:border-b-0"
                >
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: BOTH_COLOR }}
                    >
                        {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-text-primary truncate" title={row.name}>
                            {row.name}
                        </div>
                        <div className="text-[10.5px] text-text-tertiary">
                            {fmtInt(row.badJobs)} bad of {fmtInt(row.jobs)} · {fmtInt(row.lateJobs)} late ·{' '}
                            {fmtInt(row.slowJobs)} slow
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div
                            className="text-[14px] font-bold tabular-nums"
                            style={{ color: goodPctColor(row.goodPct) }}
                        >
                            {fmtPct(row.goodPct)}
                        </div>
                        <div className="text-[10px] text-text-tertiary">good</div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function HourOfDayChart({ accentColor, data }) {
    const chartData = useMemo(
        () =>
            data.map((b) => ({
                badJobs: b.badJobs,
                goodPct: b.jobs > 0 ? Math.round(b.goodPct * 1000) / 10 : null,
                jobs: b.jobs,
                label: b.label,
                lateJobs: b.lateJobs,
                slowJobs: b.slowJobs
            })),
        [data]
    )
    const hasJobs = chartData.some((b) => b.jobs > 0)
    if (!hasJobs) {
        return <div className="text-[12px] py-6 text-center text-text-tertiary">No scheduled jobs in this window.</div>
    }
    return (
        <div className="flex flex-col gap-2">
            <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ bottom: 4, left: 8, right: 16, top: 8 }}>
                        <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} interval={0} />
                        <YAxis
                            stroke="var(--text-tertiary)"
                            tick={{ fontSize: 11 }}
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                            contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                            cursor={{ fill: `${accentColor}10` }}
                            formatter={(_value, _name, item) => {
                                const p = item?.payload
                                if (!p || p.jobs === 0) return ['No jobs', '']
                                return [
                                    `${p.goodPct == null ? '—' : `${p.goodPct}%`} good · ${fmtInt(p.jobs)} jobs · ${fmtInt(p.lateJobs)} late · ${fmtInt(p.slowJobs)} slow`,
                                    ''
                                ]
                            }}
                        />
                        <Bar dataKey="goodPct" radius={[3, 3, 0, 0]}>
                            {chartData.map((row) => (
                                <Cell
                                    key={row.label}
                                    fill={
                                        row.jobs === 0 ? 'var(--border-light)' : goodPctColor((row.goodPct || 0) / 100)
                                    }
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] text-text-secondary">
                {data
                    .filter((b) => b.jobs > 0)
                    .map((b) => (
                        <div
                            key={b.label}
                            className="flex items-center justify-between rounded px-2 py-1 bg-bg-tertiary"
                        >
                            <span className="truncate">{b.label}</span>
                            <span
                                className="font-semibold tabular-nums shrink-0"
                                style={{ color: goodPctColor(b.goodPct) }}
                            >
                                {fmtPct(b.goodPct)}
                            </span>
                        </div>
                    ))}
            </div>
        </div>
    )
}

function DailyTrendChart({ accentColor, data }) {
    const chartData = useMemo(
        () =>
            data.map((d) => ({
                date: d.date,
                goodPct: Math.round(d.goodPct * 1000) / 10,
                jobs: d.jobs,
                lateJobs: d.lateJobs,
                slowJobs: d.slowJobs
            })),
        [data]
    )
    if (!chartData.length) {
        return <div className="text-[12px] py-6 text-center text-text-tertiary">Not enough data for a trend.</div>
    }
    return (
        <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ bottom: 4, left: 8, right: 16, top: 8 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="date"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(d) => fmtDate(d)}
                    />
                    <YAxis
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ stroke: `${accentColor}30` }}
                        formatter={(_value, _name, item) => {
                            const p = item?.payload
                            if (!p) return ['', '']
                            return [
                                `${p.goodPct}% good · ${fmtInt(p.jobs)} jobs · ${fmtInt(p.lateJobs)} late · ${fmtInt(p.slowJobs)} slow`,
                                ''
                            ]
                        }}
                        labelFormatter={(d) => fmtDate(d)}
                    />
                    <Line
                        type="monotone"
                        dataKey="goodPct"
                        stroke={accentColor}
                        strokeWidth={2}
                        dot={{ fill: accentColor, r: 3 }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function OutcomesBreakdown({ accentColor, outcomes }) {
    const total = outcomes.reduce((sum, b) => sum + b.count, 0)
    if (total === 0) {
        return <div className="text-[12px] py-6 text-center text-text-tertiary">No jobs to classify yet.</div>
    }
    const chartData = outcomes.map((b) => ({ count: b.count, fill: b.color, label: b.label }))
    return (
        <div className="flex flex-col gap-3">
            <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ bottom: 4, left: 8, right: 16, top: 8 }}>
                        <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} interval={0} />
                        <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={fmtInt} />
                        <Tooltip
                            contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                            cursor={{ fill: `${accentColor}10` }}
                            formatter={(value) => [`${fmtInt(value)} jobs`, '']}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                            {chartData.map((row) => (
                                <Cell key={row.label} fill={row.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-0.5">
                {outcomes.map((b) => {
                    const pct = total > 0 ? b.count / total : 0
                    return (
                        <div key={b.key} className="flex items-center gap-2 py-1">
                            <div className="w-[120px] text-[12px] text-text-secondary shrink-0">{b.label}</div>
                            <div className="flex-1 rounded h-4 overflow-hidden bg-bg-tertiary">
                                <div
                                    className="h-full rounded transition-all"
                                    style={{ background: b.color, width: `${Math.max(2, pct * 100)}%` }}
                                />
                            </div>
                            <div className="w-[110px] text-[12px] text-text-secondary text-right tabular-nums shrink-0">
                                {fmtInt(b.count)} · {fmtPct(pct)}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function WorstOrdersTable({ colocationMap, plantNameByCode, rows }) {
    if (!rows.length) {
        return (
            <div className="text-[12px] py-6 text-center text-text-tertiary">No bad-service jobs in this window.</div>
        )
    }
    return (
        <div className="overflow-x-auto rounded border border-border-light">
            <table className="w-full min-w-[760px] border-collapse">
                <thead>
                    <tr className="bg-bg-tertiary">
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Date
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Plant
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Customer
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            What happened
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Scheduled
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            First load
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Late by
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Pace
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((m) => (
                        <tr key={m.orderId} className="border-t border-border-light">
                            <td className="px-3 py-2 text-[12px] text-text-secondary tabular-nums">
                                {fmtDate(m.date)}
                            </td>
                            <td className="px-3 py-2 text-[12px] text-text-primary">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                                        {formatColocatedCodeLabel(m.plantCode, colocationMap)}
                                    </span>
                                    <span>
                                        {formatColocatedPlantLabel(m.plantCode, plantNameByCode, colocationMap)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-3 py-2 text-[12px] text-text-primary truncate max-w-[220px]">
                                {m.customer || '—'}
                            </td>
                            <td className="px-3 py-2">
                                <FailureTags isLate={m.isLate} isSlow={m.isSlow} />
                            </td>
                            <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                {m.startTime || '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                {m.firstLoadTime || '—'}
                            </td>
                            <td
                                className="px-3 py-2 text-right text-[12px] tabular-nums font-bold"
                                style={{ color: m.isLate ? LATE_COLOR : 'var(--text-tertiary)' }}
                            >
                                {m.isLate ? fmtMinutes(m.latenessMin) : '—'}
                            </td>
                            <td
                                className="px-3 py-2 text-right text-[12px] tabular-nums"
                                style={{ color: m.isSlow ? SLOW_COLOR : 'var(--text-tertiary)' }}
                            >
                                {m.paceScore == null ? '—' : fmtPct(m.paceScore)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/**
 * Service-quality analytics sub-page. Covers the full "good vs. bad
 * customer experience" picture: late starts, slow pours, and the
 * overlap between them. Uses the SAME per-order classifier
 * (`scoreOrderExperience`) that powers the customer-satisfaction
 * score, so this page and the Satisfaction page always agree on
 * whether a specific order was good service.
 *
 * Attribution lands on the plant + scheduled hour, never on the
 * driver — drivers don't control either lateness or pour pace, so
 * blaming them with a leaderboard would be misleading.
 */
export default function PlanStatisticsServicePage({
    accentColor,
    colocationMap,
    loading,
    plansLoading,
    plantNameByCode,
    serviceLoading,
    serviceStats
}) {
    const { byCustomer, byDay, byHour, byPlant, kpi, outcomes, threshold, worstOrders } = serviceStats
    const isLoading = !!(loading || serviceLoading || plansLoading)
    const hasData = kpi.totalJobs > 0
    const visiblePlantRows = useMemo(() => byPlant.filter((row) => row.jobs > 0), [byPlant])

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Customer experience"
                right={isLoading ? <RefreshingHint when /> : null}
                innerClassName="p-0 overflow-hidden"
            >
                {hasData ? (
                    <StatGroup columns={4}>
                        <Stat
                            label="Good service"
                            value={fmtPct(kpi.goodPct)}
                            valueColor={goodPctColor(kpi.goodPct)}
                            hint={`${fmtInt(kpi.goodJobs)} of ${fmtInt(kpi.totalJobs)} jobs — neither late nor slow`}
                        />
                        <Stat
                            label="Late jobs"
                            value={fmtInt(kpi.lateJobs)}
                            valueColor={kpi.lateJobs > 0 ? LATE_COLOR : 'var(--text-primary)'}
                            hint={`First load > ${threshold} min past scheduled start`}
                        />
                        <Stat
                            label="Slow jobs"
                            value={fmtInt(kpi.slowJobs)}
                            valueColor={kpi.slowJobs > 0 ? SLOW_COLOR : 'var(--text-primary)'}
                            hint="Pour rate under 70% of requested yd/hr"
                        />
                        <Stat
                            label="Late + slow"
                            value={fmtInt(kpi.lateAndSlow)}
                            valueColor={kpi.lateAndSlow > 0 ? BOTH_COLOR : 'var(--text-primary)'}
                            hint="Worst-case overlap — both failures on one order"
                        />
                    </StatGroup>
                ) : (
                    <div className="p-3">
                        <EmptySection
                            icon="fa-circle-info"
                            loading={isLoading}
                            message={
                                isLoading
                                    ? 'Loading ticket data…'
                                    : 'No measurable jobs in this window. Service scoring needs a scheduled start time and at least one loaded ticket per order.'
                            }
                        />
                    </div>
                )}
            </Panel>

            <Panel title="Service quality by plant" right={isLoading ? <RefreshingHint when /> : null}>
                {visiblePlantRows.length > 0 ? (
                    <>
                        <div className="text-[11.5px] mb-2 text-text-secondary">
                            Per-plant breakdown — best on-time and on-pace first. Click any column to re-rank. Late and
                            Slow columns count separately, so an order that was both shows up in both.
                        </div>
                        <PlantScorecardTable
                            rows={visiblePlantRows}
                            plantNameByCode={plantNameByCode}
                            colocationMap={colocationMap}
                        />
                    </>
                ) : (
                    <EmptySection
                        icon="fa-circle-info"
                        loading={isLoading}
                        message="No plant scorecards yet — measured jobs will appear once first loads land."
                    />
                )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Panel title="Customers feeling the bad service" innerClassName="p-3">
                    <div className="text-[11.5px] mb-2 text-text-secondary">
                        Accounts experiencing the most bad-service jobs (min 2 jobs in window). These customers don't
                        cause the lateness or slow pace — but they absorb it, and the on-time conversation needs to
                        happen with them.
                    </div>
                    <CustomerList rows={byCustomer} emptyMessage="No customers with bad service in this window." />
                </Panel>
                <Panel title="Good service % by time of day" innerClassName="p-3">
                    <div className="text-[11.5px] mb-2 text-text-secondary">
                        Buckets scheduled start times by hour-of-day. Surfaces patterns like "6am load-outs run late" or
                        "afternoon pours fall behind pace." Attribution lands on the dispatcher's booking decision.
                    </div>
                    <HourOfDayChart data={byHour} accentColor={accentColor} />
                </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Panel title="Outcome mix" innerClassName="p-3">
                    <div className="text-[11.5px] mb-2 text-text-secondary">
                        Every measured order sorts into exactly one bucket — useful for spotting whether the bad service
                        is mostly lateness, mostly slow pours, or both at once.
                    </div>
                    <OutcomesBreakdown outcomes={outcomes} accentColor={accentColor} />
                </Panel>
                <Panel title={byDay.length > 1 ? 'Good service trend by day' : 'Service trend'} innerClassName="p-3">
                    {byDay.length > 1 ? (
                        <>
                            <div className="text-[11.5px] mb-2 text-text-secondary">
                                Daily good-service %. Spot weekday patterns and one-off bad days at a glance.
                            </div>
                            <DailyTrendChart data={byDay} accentColor={accentColor} />
                        </>
                    ) : (
                        <div className="text-[12px] py-6 text-center text-text-tertiary">
                            Single-day window — the daily trend lights up once the window spans multiple days.
                        </div>
                    )}
                </Panel>
            </div>

            <Panel title="Worst bad-service jobs" right={isLoading ? <RefreshingHint when /> : null}>
                <div className="text-[11.5px] mb-2 text-text-secondary">
                    Top 20 bad-service jobs ranked by lateness (then pace). "What happened" shows whether the order was
                    late, slow, or both — useful for spotting the specific customers and dates worth digging into.
                </div>
                <WorstOrdersTable rows={worstOrders} plantNameByCode={plantNameByCode} colocationMap={colocationMap} />
            </Panel>
        </div>
    )
}
