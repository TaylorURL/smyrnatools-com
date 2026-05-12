import React from 'react'

import { Panel as SharedPanel } from '../ui/Panel'

/** Plan-insights list — warnings and suggestions surfaced from
 *  `usePlanInsights`. Two visual tones: amber bar for warnings, neutral
 *  for suggestions. */
export function PlanInsightsList({ warnings, suggestions }) {
    return (
        <SharedPanel id="insights" title={`Plan insights · ${warnings.length + suggestions.length}`}>
            <div className="flex flex-col gap-1.5">
                {warnings.map((warning, i) => (
                    <div
                        key={`w-${i}`}
                        className="flex items-baseline gap-2 text-[12.5px] py-1"
                        style={{ borderLeft: '2px solid #f59e0b', paddingLeft: 10 }}
                    >
                        <span className="text-text-primary">{warning.message}</span>
                    </div>
                ))}
                {suggestions.map((suggestion, i) => (
                    <div
                        key={`s-${i}`}
                        className="flex items-baseline gap-2 text-[12.5px] py-1"
                        style={{ borderLeft: '2px solid var(--border-medium)', paddingLeft: 10 }}
                    >
                        <span className="text-text-secondary">{suggestion.message}</span>
                    </div>
                ))}
            </div>
        </SharedPanel>
    )
}

/** Stacked bar list — yardage by plant, sorted descending. Empty plants
 *  still render their bar at 0%. */
export function PlanYardageByPlantList({ accentColor, plantProduction, stats, totalYardage }) {
    const rows = stats
        .map((stat) => ({
            ...stat,
            yardage: parseFloat(plantProduction[stat.code]?.totalYardage) || 0
        }))
        .sort((a, b) => b.yardage - a.yardage)

    return (
        <SharedPanel id="yardage" title="Yardage by plant">
            <div className="flex flex-col gap-2">
                {rows.map((row) => {
                    const pct = totalYardage > 0 ? (row.yardage / totalYardage) * 100 : 0
                    return (
                        <div key={row.code} className="flex items-center gap-3">
                            <div className="w-12 font-bold text-[13px] text-text-primary font-heading">{row.code}</div>
                            <div className="flex-1 min-w-0">
                                <div className="h-2 rounded-full overflow-hidden bg-bg-tertiary">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            background: accentColor,
                                            width: `${Math.max(pct, row.yardage > 0 ? 3 : 0)}%`
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="w-24 text-right text-[12px] text-text-secondary">
                                <b className="text-text-primary">{row.yardage.toLocaleString()} yd</b>
                                {totalYardage > 0 && (
                                    <>
                                        {' '}
                                        <span className="text-text-tertiary">({Math.round(pct)}%)</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </SharedPanel>
    )
}
