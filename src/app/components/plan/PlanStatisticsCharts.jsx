import React, { useMemo } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

import {
    deltaColor,
    deltaPct,
    fmtDate,
    fmtInt,
    fmtPct,
    parseIsoLocal,
    satisfactionColor
} from '../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE, PLAN_STATS_FALLBACK_SERIES_COLORS } from '../../../utils/PlanStatisticsUtility'
import { plantBadgeColor } from '../../../utils/PlanUtility'

/** Inline KPI hint — leads with intrinsic context (e.g. "yd³/load"); appends
 *  a subtle Δ% pill only when a comparison value is provided. */
export function DeltaHint({ base, current, previous }) {
    const pct = deltaPct(current, previous)
    if (!Number.isFinite(previous) || pct == null) return base ?? null
    return (
        <span className="inline-flex items-center gap-1.5">
            <span style={{ color: 'var(--text-tertiary)' }}>{base}</span>
            <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-semibold tabular-nums"
                style={{
                    background: `${deltaColor(pct) || 'var(--text-tertiary)'}1f`,
                    color: deltaColor(pct) || 'var(--text-tertiary)'
                }}
            >
                <i className={`fas fa-${pct >= 0 ? 'arrow-up' : 'arrow-down'} text-[8px]`} />
                {fmtPct(pct).replace('+', '').replace('-', '')}
            </span>
        </span>
    )
}

/** Daily yardage + loads trend with optional dotted comparison line. */
export function TrendChart({ data, accent, comparisonData }) {
    const merged = useMemo(
        () =>
            data.map((d, idx) => ({
                ...d,
                comparisonYardage: comparisonData?.[idx]?.totalYardage ?? null,
                shortDate: fmtDate(d.planDate)
            })),
        [data, comparisonData]
    )
    return (
        <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={merged} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="shortDate"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                    />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={48} tickFormatter={fmtInt} />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ stroke: accent, strokeOpacity: 0.2 }}
                        formatter={(value, name) => [fmtInt(value), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                        type="monotone"
                        dataKey="totalYardage"
                        name="Yardage"
                        stroke={accent}
                        strokeWidth={2}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="totalLoads"
                        name="Loads"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="4 3"
                    />
                    {comparisonData && (
                        <Line
                            type="monotone"
                            dataKey="comparisonYardage"
                            name="Yardage (prior)"
                            stroke="var(--text-tertiary)"
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="2 4"
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Top-12 horizontal bar chart of yardage by plant. */
export function ByPlantChart({ accent, plantNameByCode, rows }) {
    const trimmed = useMemo(
        () =>
            [...rows]
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, 12)
                .map((r) => ({
                    ...r,
                    name: plantNameByCode?.[r.code] ? `${r.code} · ${plantNameByCode[r.code]}` : r.code
                })),
        [rows, plantNameByCode]
    )
    if (trimmed.length === 0) {
        return (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No plant production data in the selected range.
            </div>
        )
    }
    return (
        <div style={{ height: Math.max(220, trimmed.length * 28 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trimmed} layout="vertical" margin={{ bottom: 4, left: 8, right: 16, top: 8 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={fmtInt} />
                    <YAxis
                        type="category"
                        dataKey="code"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        width={64}
                    />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ fill: `${accent}10` }}
                        formatter={(value, name) => [fmtInt(value), name]}
                    />
                    <Bar dataKey="yardage" name="Yardage" radius={[0, 3, 3, 0]}>
                        {trimmed.map((row, idx) => (
                            <Cell
                                key={row.code}
                                fill={plantBadgeColor(
                                    row.code,
                                    PLAN_STATS_FALLBACK_SERIES_COLORS[idx % PLAN_STATS_FALLBACK_SERIES_COLORS.length]
                                )}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Mon–Sat average-yardage bars (Sundays excluded — plant is closed). */
export function DayOfWeekChart({ accent, plans }) {
    const data = useMemo(() => {
        // Mon–Sat only — Sundays are non-operating days for the plant.
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const buckets = labels.map((label) => ({ avg: 0, count: 0, label, total: 0 }))
        plans.forEach((p) => {
            const d = parseIsoLocal(p.planDate)
            if (!d) return
            const dow = d.getDay()
            if (dow === 0) return
            const bucket = buckets[dow - 1]
            bucket.total += p.totalYardage
            bucket.count += 1
        })
        buckets.forEach((b) => {
            b.avg = b.count > 0 ? Math.round(b.total / b.count) : 0
        })
        return buckets
    }, [plans])
    return (
        <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ bottom: 4, left: 0, right: 8, top: 12 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={48} tickFormatter={fmtInt} />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ fill: `${accent}10` }}
                        formatter={(value, _name, item) => [
                            `${fmtInt(value)} yd³ avg · ${item?.payload?.count} day${item?.payload?.count === 1 ? '' : 's'}`,
                            'Yardage'
                        ]}
                    />
                    <Bar dataKey="avg" name="Avg yardage" fill={accent} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/**
 * Customer satisfaction chart — wraps the SHARED `computeCustomerSatisfaction`
 * results from `PlanUtility` so the page reads the same score the Schedule
 * tab badge reads. Per-day score points feed a trend line; the headline shows
 * the period-aggregate score with good/bad-service counts and a sample tally.
 */
export function SatisfactionChart({ accent, aggregate, isLoading, satisfactionByDay, days }) {
    const trend = useMemo(
        () =>
            days
                .map((d) => {
                    const sat = satisfactionByDay[d.planDate]
                    if (!sat) return null
                    return {
                        badService: sat.badService,
                        goodService: sat.goodService,
                        label: fmtDate(d.planDate),
                        samples: sat.samples,
                        score: Math.round(sat.score * 100)
                    }
                })
                .filter(Boolean),
        [days, satisfactionByDay]
    )
    const score100 = aggregate ? Math.round(aggregate.score * 100) : null
    const headlineColor = satisfactionColor(score100)
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-end gap-3 px-1">
                <div className="flex items-baseline gap-1">
                    <span
                        className="text-[40px] font-bold leading-none font-mono tabular-nums"
                        style={{ color: headlineColor }}
                    >
                        {score100 == null ? '—' : score100}
                    </span>
                    <span className="text-[16px] font-semibold" style={{ color: headlineColor }}>
                        %
                    </span>
                </div>
                <div className="flex flex-col text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {aggregate ? (
                        <>
                            <span>
                                {fmtInt(aggregate.goodService)} good service · {fmtInt(aggregate.badService)} bad
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                across {fmtInt(aggregate.samples)} order
                                {aggregate.samples === 1 ? '' : 's'} with ticket data
                            </span>
                        </>
                    ) : (
                        <>
                            <span>{isLoading ? 'Fetching ticket data…' : 'No ticket data in range'}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                Score combines pace (60%) and on-time start (40%)
                            </span>
                        </>
                    )}
                </div>
            </div>

            {trend.length > 1 ? (
                <div style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
                            <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                            <XAxis
                                dataKey="label"
                                stroke="var(--text-tertiary)"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                            />
                            <YAxis domain={[0, 100]} stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} width={30} />
                            <Tooltip
                                contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                                cursor={{ stroke: accent, strokeOpacity: 0.2 }}
                                formatter={(value, _name, item) => [
                                    `${value}% · ${item?.payload?.goodService} good / ${item?.payload?.badService} bad`,
                                    'Score'
                                ]}
                            />
                            <Line
                                type="monotone"
                                dataKey="score"
                                stroke={accent}
                                strokeWidth={2}
                                dot={{ r: 2.5 }}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div
                    className="text-[11.5px] py-3 px-2 rounded text-center"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
                >
                    {isLoading
                        ? 'Loading per-day ticket data…'
                        : 'Trend chart needs at least two days with ticket data.'}
                </div>
            )}
        </div>
    )
}
