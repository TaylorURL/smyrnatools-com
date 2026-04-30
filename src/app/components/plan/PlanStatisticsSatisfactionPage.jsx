import React, { useMemo } from 'react'
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

import { fmtDate, fmtInt, fmtRange, satisfactionColor } from '../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../utils/PlanStatisticsUtility'
import { plantBadgeColor } from '../../../utils/PlanUtility'
import { Panel } from '../ui/Panel'

/** Coloured score badge — single-source-of-truth styling reused for the
 *  primary score and the comparison tile. */
function ScoreBadge({ score, size = 'md' }) {
    const color = satisfactionColor(score)
    const numClass = size === 'lg' ? 'text-[40px]' : 'text-[26px]'
    const pctClass = size === 'lg' ? 'text-[16px]' : 'text-[12px]'
    return (
        <div className="flex items-baseline gap-0.5" style={{ color }}>
            <span className={`${numClass} font-bold leading-none font-mono tabular-nums`}>
                {score == null ? '—' : score}
            </span>
            <span className={`${pctClass} font-semibold`}>%</span>
        </div>
    )
}

/** Headline score for the active period — large badge, good/bad counts, and
 *  a one-line range hint so the user always knows what window is in view. */
function PrimaryScoreCard({ aggregate, range }) {
    const score = aggregate ? Math.round(aggregate.score * 100) : null
    return (
        <Panel
            title="Customer satisfaction"
            innerClassName="p-4 flex flex-col gap-2"
            right={
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    {fmtRange(range.start, range.end)}
                </span>
            }
        >
            <div className="flex items-end gap-3">
                <ScoreBadge score={score} size="lg" />
                <div className="flex flex-col text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {aggregate ? (
                        <>
                            <span>
                                {fmtInt(aggregate.goodService)} good · {fmtInt(aggregate.badService)} bad
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                {fmtInt(aggregate.samples)} order{aggregate.samples === 1 ? '' : 's'} scored
                            </span>
                        </>
                    ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>No ticket data in this window.</span>
                    )}
                </div>
            </div>
        </Panel>
    )
}

/** Comparison tile — current vs previous range with a delta pill. Hidden
 *  when the user has comparison set to "none". */
function ComparisonTile({ current, previous, comparison }) {
    if (comparison === 'none') return null
    const curScore = current ? Math.round(current.score * 100) : null
    const prevScore = previous ? Math.round(previous.score * 100) : null
    const delta = Number.isFinite(curScore) && Number.isFinite(prevScore) ? curScore - prevScore : null
    const deltaColor = delta == null ? 'var(--text-tertiary)' : delta >= 0 ? '#16a34a' : '#dc2626'
    const title = comparison === 'yoy' ? 'Year-over-year' : 'Vs previous period'
    const previousLabel = comparison === 'yoy' ? 'Last year' : 'Previous'
    return (
        <Panel
            title={title}
            innerClassName="p-4"
            right={
                delta != null ? (
                    <span
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                        style={{ background: `${deltaColor}1f`, color: deltaColor }}
                    >
                        <i className={`fas fa-arrow-${delta >= 0 ? 'up' : 'down'} text-[8px]`} />
                        {delta >= 0 ? '+' : ''}
                        {delta}pp
                    </span>
                ) : null
            }
        >
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        Current
                    </span>
                    <ScoreBadge score={curScore} />
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {current ? `${fmtInt(current.samples)} orders` : 'No ticket data'}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {previousLabel}
                    </span>
                    <ScoreBadge score={prevScore} />
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {previous ? `${fmtInt(previous.samples)} orders` : 'No ticket data'}
                    </span>
                </div>
            </div>
        </Panel>
    )
}

/** Per-day score line across the current range. Gaps render as breaks so
 *  days with no ticket data don't get drawn as 0%. */
function ScoreTrendChart({ accent, trend }) {
    const labelled = useMemo(() => trend.map((p) => ({ ...p, label: fmtDate(p.date) })), [trend])
    const valid = labelled.filter((p) => p.score != null)
    if (valid.length < 2) {
        return (
            <div
                className="text-[12px] py-6 px-2 rounded text-center"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
            >
                Need at least two days with ticket data for a trend line.
            </div>
        )
    }
    return (
        <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={labelled} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="label"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} width={32} />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ stroke: accent, strokeOpacity: 0.2 }}
                        formatter={(value, _name, item) => [
                            value == null
                                ? '—'
                                : `${value}% · ${item?.payload?.goodService} good / ${item?.payload?.badService} bad`,
                            'Score'
                        ]}
                    />
                    <Line
                        type="monotone"
                        dataKey="score"
                        stroke={accent}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                        connectNulls
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Horizontal bar chart ranking plants by their satisfaction score across
 *  the active period. Coloured by tier so green / amber / red plants group
 *  visually. */
function PerPlantSatisfactionChart({ accent, perPlant, plantNameByCode }) {
    const data = useMemo(
        () =>
            perPlant.slice(0, 14).map((p) => ({
                ...p,
                label: plantNameByCode?.[p.code] ? `${p.code} · ${plantNameByCode[p.code]}` : p.code
            })),
        [perPlant, plantNameByCode]
    )
    if (data.length === 0) {
        return (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No per-plant ticket data in this window yet.
            </div>
        )
    }
    return (
        <div style={{ height: Math.max(220, data.length * 28 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ bottom: 4, left: 8, right: 16, top: 8 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                        type="number"
                        domain={[0, 100]}
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${v}%`}
                    />
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
                        formatter={(value, _name, item) => [
                            `${value}% · ${item?.payload?.goodService} good / ${item?.payload?.badService} bad (${item?.payload?.samples} ord)`,
                            'Satisfaction'
                        ]}
                    />
                    <Bar dataKey="score" name="Satisfaction" radius={[0, 3, 3, 0]}>
                        {data.map((row) => (
                            <Cell
                                key={row.code}
                                fill={satisfactionColor(row.score) || plantBadgeColor(row.code, accent)}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/**
 * Customer-satisfaction sub-page. Driven by the global period/comparison
 * selectors so it stays in lockstep with the rest of the Statistics tab.
 *
 * Renders a primary score card, an optional comparison tile (when the user
 * has comparison turned on), a per-day trend line over the current range,
 * and a per-plant ranking bar chart.
 */
export function PlanStatisticsSatisfactionPage({
    accentColor,
    aggregate,
    comparison,
    loading,
    perPlant,
    plantNameByCode,
    previousAggregate,
    range,
    trend
}) {
    return (
        <div className="flex flex-col gap-4">
            <div
                className="rounded px-4 py-3 flex items-start gap-3 text-[12px]"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)'
                }}
            >
                <i className="fas fa-circle-info text-[14px] mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                <div className="flex-1">
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Satisfaction is computed from dispatched tickets, weighted by yardage.
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Score = pace (60%) + on-time start (40%). Driven by the period and comparison selectors above.
                    </div>
                </div>
                {loading && (
                    <span className="text-[11px] inline-flex items-center gap-1.5">
                        <i className="fas fa-spinner fa-spin" />
                        Loading…
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <PrimaryScoreCard aggregate={aggregate} range={range} />
                <ComparisonTile current={aggregate} previous={previousAggregate} comparison={comparison} />
            </div>

            <Panel title="Score trend" innerClassName="p-3">
                <ScoreTrendChart accent={accentColor} trend={trend} />
            </Panel>

            <Panel
                title="Plant comparison"
                innerClassName="p-3"
                right={
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {perPlant.length} plant{perPlant.length === 1 ? '' : 's'} with ticket data
                    </span>
                }
            >
                <PerPlantSatisfactionChart accent={accentColor} perPlant={perPlant} plantNameByCode={plantNameByCode} />
            </Panel>
        </div>
    )
}

export default PlanStatisticsSatisfactionPage
