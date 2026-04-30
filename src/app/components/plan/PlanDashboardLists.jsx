import React from 'react'

import { formatPullUpDelta } from '../../../utils/PlanDashboardUtility'
import { formatMinutesClock } from '../../../utils/PlanRuntimeUtility'
import PourSizeBadge from '../common/PourSizeBadge'
import { Panel as SharedPanel } from '../ui/Panel'

/**
 * Compact list of pull-up recommendations — earlier surplus windows that
 * could host later jobs. Sorted top-down by latest customer first so the
 * dispatcher works the phones in the right order.
 */
export function PlanCompactionList({ rows }) {
    return (
        <SharedPanel id="compaction" title={`Compact schedule · ${rows.length}`}>
            <div className="text-[12px] mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                Earlier surplus windows that could host later jobs. Pulling these up keeps trucks productive instead of
                idling between pours. When working the phones, start with the latest-scheduled customers first — listed
                top-down below.
            </div>
            <div className="flex flex-col gap-1.5">
                {rows.map((row, i) => {
                    const customer = (row.order?.customer || '').trim()
                    const orderTag = row.order?.orderNum ? `#${row.order.orderNum}` : 'order'
                    return (
                        <div
                            key={`${row.plantCode}-${row.suggestedStartMin}-${i}`}
                            className="flex items-baseline gap-2 text-[12.5px] py-1"
                            style={{ borderLeft: '2px solid #0d9488', paddingLeft: 10 }}
                        >
                            <span
                                className="font-mono text-[11.5px] font-semibold"
                                style={{ color: '#0d9488', minWidth: 36 }}
                            >
                                {row.plantCode}
                            </span>
                            <span style={{ color: 'var(--text-primary)' }}>
                                <b>{orderTag}</b>
                                {customer ? (
                                    <>
                                        {' '}
                                        · <b>{customer}</b>
                                    </>
                                ) : null}{' '}
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {formatMinutesClock(row.originalStartMin)} →{' '}
                                    <b style={{ color: 'var(--text-primary)' }}>
                                        {formatMinutesClock(row.suggestedStartMin)}
                                    </b>{' '}
                                    ({formatPullUpDelta(row.pullUpDeltaMin)} earlier · notify by{' '}
                                    <b style={{ color: 'var(--text-primary)' }}>
                                        {formatMinutesClock(row.notifyByMin)}
                                    </b>
                                    )
                                </span>
                            </span>
                        </div>
                    )
                })}
            </div>
        </SharedPanel>
    )
}

/** Open-window list — idle-truck windows where a plant could absorb a new
 *  pour without disrupting today's plan. */
export function PlanOpenWindowsList({ rows }) {
    return (
        <SharedPanel id="open-windows" title={`Open windows · ${rows.length}`}>
            <div className="text-[12px] mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                Idle-truck windows where a plant could absorb a new pour without disrupting today&apos;s plan. Use these
                when calling out for fill-in work.
            </div>
            <div className="flex flex-col gap-1.5">
                {rows.map((row, i) => {
                    const hours = Math.round((row.durationMin / 60) * 10) / 10
                    return (
                        <div
                            key={`${row.plantCode}-${row.time}-${row.key}-${i}`}
                            className="flex flex-wrap items-baseline gap-2 text-[12.5px] py-1"
                            style={{ borderLeft: '2px solid var(--border-medium)', paddingLeft: 10 }}
                        >
                            <span
                                className="font-mono text-[11.5px] font-semibold"
                                style={{ color: 'var(--text-primary)', minWidth: 36 }}
                            >
                                {row.plantCode}
                            </span>
                            <PourSizeBadge size={row.key} truckRange={row.truckRange} />
                            <span style={{ color: 'var(--text-secondary)' }}>
                                <b style={{ color: 'var(--text-primary)' }}>{formatMinutesClock(row.time)}</b>
                                {' · '}
                                {row.minTrucks}+ idle · ~{hours}h window
                            </span>
                        </div>
                    )
                })}
            </div>
        </SharedPanel>
    )
}

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
                        <span style={{ color: 'var(--text-primary)' }}>{warning.message}</span>
                    </div>
                ))}
                {suggestions.map((suggestion, i) => (
                    <div
                        key={`s-${i}`}
                        className="flex items-baseline gap-2 text-[12.5px] py-1"
                        style={{ borderLeft: '2px solid var(--border-medium)', paddingLeft: 10 }}
                    >
                        <span style={{ color: 'var(--text-secondary)' }}>{suggestion.message}</span>
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
                            <div
                                className="w-12 font-bold text-[13px]"
                                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                            >
                                {row.code}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div
                                    className="h-2 rounded-full overflow-hidden"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                >
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            background: accentColor,
                                            width: `${Math.max(pct, row.yardage > 0 ? 3 : 0)}%`
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="w-24 text-right text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                <b style={{ color: 'var(--text-primary)' }}>{row.yardage.toLocaleString()} yd</b>
                                {totalYardage > 0 && (
                                    <>
                                        {' '}
                                        <span style={{ color: 'var(--text-tertiary)' }}>({Math.round(pct)}%)</span>
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
