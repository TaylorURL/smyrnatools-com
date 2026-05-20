/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
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
    parseIsoLocal
} from '../../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../../utils/PlanStatisticsUtility'

/** Inline KPI hint — leads with intrinsic context (e.g. "yd³/load"); appends
 *  a subtle Δ% pill only when a comparison value is provided. */
export function DeltaHint({ base, current, previous }) {
    const pct = deltaPct(current, previous)
    if (!Number.isFinite(previous) || pct == null) return base ?? null
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="text-text-tertiary">{base}</span>
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
    /** Average yardage across days with production. Drawn as a red dashed
     *  reference line so the dispatcher sees at a glance which days beat
     *  the typical pour and which lagged. Days with zero yardage are
     *  excluded from the denominator — they dilute the "typical day" sense
     *  when the import hasn't landed yet or the day was a holiday. */
    const avgYardage = useMemo(() => {
        const productive = (data || []).filter((d) => (d.totalYardage || 0) > 0)
        if (!productive.length) return null
        const sum = productive.reduce((s, d) => s + (d.totalYardage || 0), 0)
        return sum / productive.length
    }, [data])
    return (
        <div className="h-60">
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
                    {Number.isFinite(avgYardage) && (
                        <ReferenceLine
                            y={avgYardage}
                            stroke="#dc2626"
                            strokeDasharray="4 3"
                            strokeWidth={1.5}
                            ifOverflow="extendDomain"
                            label={{
                                fill: '#dc2626',
                                fontSize: 11,
                                fontWeight: 600,
                                position: 'insideTopRight',
                                value: `avg ${fmtInt(Math.round(avgYardage))} yd/day`
                            }}
                        />
                    )}
                </LineChart>
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
        <div className="h-[220px]">
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
