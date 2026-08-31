/* eslint-disable react/forbid-dom-props */
import React from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

import { fmtInt } from '../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../utils/PlanStatisticsUtility'

/** Chart hues keyed by the `displayStatus` label, which flattens In-Shop
 *  assets into their shop sub-status (Down In Yard, Ready For Pickup, …).
 *  Labels with no entry rotate through `fallbackColors` instead. */
const STATUS_PALETTE = {
    Active: 'var(--status-active)',
    'Down In Yard': 'var(--status-down-yard)',
    'In Shop': 'var(--status-shop)',
    'Ready For Pickup': 'var(--status-ready)',
    Retired: 'var(--text-tertiary)',
    Spare: 'var(--status-spare)',
    'Third Party Work': 'var(--status-third-party)',
    'Waiting For Shop': 'var(--status-waiting)'
}

const fallbackColors = [
    'var(--series-1)',
    'var(--series-2)',
    'var(--series-3)',
    'var(--series-4)',
    'var(--series-5)',
    'var(--series-6)',
    'var(--series-7)'
]

const colorFor = (label, index) => STATUS_PALETTE[label] || fallbackColors[index % fallbackColors.length]

/** Donut of the fleet's status mix. Retired assets never reach it — the
 *  distribution is aggregated over operational items only. */
export function StatusPieChart({ data }) {
    if (!data?.length) {
        return (
            <div className="flex items-center justify-center py-8 text-[12px] text-text-tertiary">
                No status data in scope.
            </div>
        )
    }
    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        formatter={(value) => [fmtInt(value), 'Assets']}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Pie
                        data={data}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={1}
                        stroke="var(--bg-primary)"
                    >
                        {data.map((entry, index) => (
                            <Cell key={entry.label} fill={colorFor(entry.label, index)} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Bar chart over a bucketed series — tenure, age, hours, service, and
 *  cleanliness distributions all render through it. `xKey` and `valueKey`
 *  point at the label and count fields, but the axis and tooltip always
 *  read the value as an asset count. */
export function CategoricalBarChart({ accent, data, height = 220, valueKey = 'count', xKey = 'label' }) {
    if (!data?.length) {
        return (
            <div className="flex items-center justify-center py-8 text-[12px] text-text-tertiary">
                No data to chart.
            </div>
        )
    }
    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ bottom: 4, left: 0, right: 8, top: 12 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis dataKey={xKey} stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={36} tickFormatter={fmtInt} />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ fill: `${accent}10` }}
                        formatter={(value) => [fmtInt(value), 'Assets']}
                    />
                    <Bar dataKey={valueKey} name="Assets" fill={accent} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export function AssetStatsEmpty({ icon = 'fa-circle-info', loading, message }) {
    return (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-text-tertiary">
            <i className={`fas ${loading ? 'fa-spinner animate-dv-spin' : icon} text-[14px]`} />
            <span>{message}</span>
        </div>
    )
}
