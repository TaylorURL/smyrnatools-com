/* eslint-disable react/forbid-dom-props */
import React from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../../../utils/PlanStatisticsUtility'
import ScorePercent from '../ScorePercent'

export default function OutcomesBreakdown({ accentColor, outcomes }) {
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
                            <div className="w-[150px] text-[12px] text-text-secondary text-right shrink-0 inline-flex items-center justify-end gap-2">
                                <span className="tabular-nums">{fmtInt(b.count)}</span>
                                <ScorePercent size="sm" value={pct} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
