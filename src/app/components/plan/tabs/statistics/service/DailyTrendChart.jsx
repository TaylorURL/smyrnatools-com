/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fmtDate, fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../../../utils/PlanStatisticsUtility'

export default function DailyTrendChart({ accentColor, data }) {
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
