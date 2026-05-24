/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../../../utils/PlanStatisticsUtility'
import ScorePercent from '../ScorePercent'
import { goodPctColor } from './serviceShared'

export default function HourOfDayChart({ accentColor, data }) {
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
                            <ScorePercent size="sm" value={b.goodPct} />
                        </div>
                    ))}
            </div>
        </div>
    )
}
