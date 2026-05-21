/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fmtDate, fmtInt, fmtRange, fmtYards } from '../../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../../utils/PlanStatisticsUtility'
import { plantBadgeColor } from '../../../../../utils/PlanUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'

/* ──────────────────────────────────────────────────────────────────────────
 * The page intentionally stays monochrome — same hairline-border / mono-
 * tabular-number language the rest of Statistics + the Plan tab use.
 * Tier colour is reserved for SMALL status pills (the same pattern the
 * Plant Scorecard's Steady / Heavy / Light pill uses) so a glance still
 * tells you good vs bad without painting the whole page green / red.
 * ────────────────────────────────────────────────────────────────────────── */

const TIER = {
    bad: { color: '#dc2626', label: 'Needs attention' },
    excellent: { color: '#16a34a', label: 'Excellent' },
    none: { color: 'var(--text-tertiary)', label: 'No data' },
    onTrack: { color: '#0ea5e9', label: 'On track' },
    watch: { color: '#d97706', label: 'Watch' }
}

const tierFor = (score) => {
    if (score == null) return TIER.none
    if (score >= 90) return TIER.excellent
    if (score >= 80) return TIER.onTrack
    if (score >= 70) return TIER.watch
    return TIER.bad
}

const fmtScore = (score) => (score == null ? '—' : `${score}%`)

/* ─── Small visual primitives ─────────────────────────────────────────────── */

/** Subtle status pill — same style as the Plant Scorecard's "Steady"
 *  tag. Tier colour at 12% bg + 100% fg. Stays small, never dominates. */
function ScorePill({ score, label }) {
    const tier = tierFor(score)
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ background: `${tier.color}1f`, color: tier.color }}
        >
            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.color }} />
            {label || tier.label}
        </span>
    )
}

/** Δ pill — same pattern as the rest of the Statistics page (KPI strip's
 *  DeltaHint). Tiny, monochrome neutral when null, green/red otherwise. */
function DeltaPill({ delta, suffix = 'pp' }) {
    if (delta == null || !Number.isFinite(delta)) return null
    const color = delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : 'var(--text-tertiary)'
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
            style={{ background: `${color}1f`, color }}
        >
            <i className={`fas fa-${delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'minus'} text-[8px]`} />
            {delta > 0 ? '+' : ''}
            {delta}
            {suffix}
        </span>
    )
}

/** Inline "Refreshing…" indicator that lives in the Panel's right slot.
 *  Shown when the section's data is still in flight but we already have
 *  partial / cached data on screen. */
function RefreshingHint({ when }) {
    if (!when) return null
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <i className="fas fa-spinner fa-spin text-[10px]" />
            Refreshing…
        </span>
    )
}

/** Empty-state row with optional spinner. Renders inside a Panel when the
 *  panel's dataset is empty — explicit messaging beats a blank box. */
function EmptySection({ icon = 'fa-circle-info', loading, message }) {
    return (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-text-tertiary">
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : icon} text-[14px]`} />
            <span>{message}</span>
        </div>
    )
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */

/** Hero — the headline good-rate + good/bad split + comparison delta.
 *  Score is now strictly the share of orders that were good (no weighted
 *  blend). Same flat panel + StatGroup vocabulary as the rest of the page. */
function Hero({ aggregate, loading, plantNameByCode, previousAggregate, range, selectedPlant }) {
    const score = aggregate ? Math.round(aggregate.score * 100) : null
    const prevScore = previousAggregate ? Math.round(previousAggregate.score * 100) : null
    const delta = score != null && prevScore != null ? score - prevScore : null
    const badRate =
        aggregate && aggregate.samples > 0 ? Math.round((aggregate.badService / aggregate.samples) * 100) : null
    const scopeLabel = selectedPlant
        ? `Plant ${selectedPlant}${plantNameByCode?.[selectedPlant] ? ` · ${plantNameByCode[selectedPlant]}` : ''}`
        : 'All plants'
    return (
        <Panel
            title="Customer satisfaction"
            right={
                loading ? (
                    <RefreshingHint when />
                ) : (
                    <span className="text-[11px] text-text-tertiary">
                        {scopeLabel} · {fmtRange(range.start, range.end)}
                    </span>
                )
            }
            innerClassName="p-0"
        >
            <div className="px-4 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span
                    className="font-mono tabular-nums font-semibold leading-none text-text-primary"
                    style={{ fontSize: 38 }}
                >
                    {fmtScore(score)}
                </span>
                <ScorePill score={score} />
                {delta != null && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
                        vs comparison <DeltaPill delta={delta} />
                    </span>
                )}
                <div className="flex-1" />
                <span className="text-[11px] text-text-tertiary">
                    Per-order verdict: good unless late &gt; 15 min OR pace dropped below schedule
                </span>
            </div>
            <StatGroup columns={4} className="rounded-none">
                <Stat
                    label="Good orders"
                    value={fmtInt(aggregate?.goodService)}
                    hint={
                        aggregate && aggregate.samples > 0
                            ? `${Math.round((aggregate.goodService / aggregate.samples) * 100)}% of scored`
                            : 'No tickets in window'
                    }
                />
                <Stat
                    label="Bad orders"
                    value={fmtInt(aggregate?.badService)}
                    hint={aggregate && aggregate.samples > 0 ? `${badRate}% of scored` : 'No tickets in window'}
                    valueColor={aggregate && aggregate.badService > 0 ? '#dc2626' : undefined}
                />
                <Stat
                    label="Orders scored"
                    value={fmtInt(aggregate?.samples)}
                    hint={
                        aggregate
                            ? `${fmtInt(aggregate.goodService)} good · ${fmtInt(aggregate.badService)} bad`
                            : 'No tickets in window'
                    }
                />
                <Stat label="Good-service rate" value={fmtScore(score)} hint="bad = late > 15 min or slow pace" />
            </StatGroup>
        </Panel>
    )
}

/* ─── Momentum ────────────────────────────────────────────────────────────── */

/** Trailing 7 days vs prior 7 — uses the same StatGroup primitives so the
 *  visual rhythm matches the KPI strip above. */
function Momentum({ momentum, loading }) {
    if (loading && !momentum) {
        return (
            <Panel title="7-day momentum" innerClassName="p-0">
                <EmptySection loading message="Computing trailing 7-day windows…" />
            </Panel>
        )
    }
    if (!momentum) {
        return (
            <Panel title="7-day momentum" innerClassName="p-0">
                <EmptySection
                    icon="fa-circle-info"
                    message="Need at least 14 days of ticket data to compute momentum."
                />
            </Panel>
        )
    }
    const trajLabel =
        momentum.trajectory === 'improving' ? 'Improving' : momentum.trajectory === 'declining' ? 'Declining' : 'Stable'
    const trajColor =
        momentum.trajectory === 'improving'
            ? '#16a34a'
            : momentum.trajectory === 'declining'
              ? '#dc2626'
              : 'var(--text-secondary)'
    return (
        <Panel title="7-day momentum" innerClassName="p-0">
            <StatGroup columns={3}>
                <Stat
                    label="Last 7 days"
                    value={fmtScore(momentum.recent.score)}
                    hint={`${fmtInt(momentum.recent.samples)} order${momentum.recent.samples === 1 ? '' : 's'}`}
                />
                <Stat
                    label="Previous 7 days"
                    value={fmtScore(momentum.prior.score)}
                    hint={`${fmtInt(momentum.prior.samples)} order${momentum.prior.samples === 1 ? '' : 's'}`}
                />
                <Stat
                    label="Trajectory"
                    value={trajLabel}
                    hint={
                        momentum.delta == null
                            ? 'Need both windows scored'
                            : `${momentum.delta >= 0 ? '+' : ''}${momentum.delta}pp delta`
                    }
                    valueColor={trajColor}
                />
            </StatGroup>
        </Panel>
    )
}

/* ─── Plant scoreboard ────────────────────────────────────────────────────── */

/** Tabular plant scoreboard — uses the same hairline-row layout as the
 *  Plants sub-page's PlantScorecardTable. Click a row to focus the whole
 *  page on that plant. */
function PlantScoreboard({ accent, perPlant, plantNameByCode, selectedPlant, onPlantClick }) {
    if (perPlant.length === 0) return null
    const trajIcon = (t) =>
        t === 'improving' ? 'fa-arrow-trend-up' : t === 'declining' ? 'fa-arrow-trend-down' : 'fa-minus'
    const trajColor = (t) => (t === 'improving' ? '#16a34a' : t === 'declining' ? '#dc2626' : 'var(--text-tertiary)')
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
                <thead>
                    <tr className="text-text-tertiary">
                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                            Plant
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Score
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Δ vs first half
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Good
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">Bad</th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Orders
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Yardage
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {perPlant.map((row) => {
                        const isActive = selectedPlant === row.code
                        return (
                            <tr
                                key={row.code}
                                onClick={onPlantClick ? () => onPlantClick(row.code) : undefined}
                                className={onPlantClick ? 'cursor-pointer transition-colors' : ''}
                                style={{
                                    background: isActive ? `${accent}10` : 'transparent',
                                    borderTop: '1px solid var(--border-light)'
                                }}
                                onMouseEnter={(e) => {
                                    if (!onPlantClick || isActive) return
                                    e.currentTarget.style.background = 'var(--bg-secondary)'
                                }}
                                onMouseLeave={(e) => {
                                    if (!onPlantClick || isActive) return
                                    e.currentTarget.style.background = 'transparent'
                                }}
                            >
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="inline-block w-2 h-2 rounded-full shrink-0"
                                            style={{ background: plantBadgeColor(row.code, accent) }}
                                        />
                                        <span className="font-mono tabular-nums font-semibold text-text-primary">
                                            {row.code}
                                        </span>
                                        {plantNameByCode?.[row.code] && (
                                            <span className="truncate text-text-secondary">
                                                {plantNameByCode[row.code]}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                    {fmtScore(row.score)}
                                </td>
                                <td className="px-2 py-2 text-right">
                                    {row.delta == null ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        <span
                                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums"
                                            style={{ color: trajColor(row.trajectory) }}
                                        >
                                            <i className={`fas ${trajIcon(row.trajectory)} text-[9px]`} />
                                            {row.delta >= 0 ? '+' : ''}
                                            {row.delta}
                                        </span>
                                    )}
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                    {fmtInt(row.goodService)}
                                </td>
                                <td
                                    className="px-2 py-2 text-right font-mono tabular-nums"
                                    style={{ color: row.badService > 0 ? '#dc2626' : 'var(--text-secondary)' }}
                                >
                                    {fmtInt(row.badService)}
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                    {fmtInt(row.samples)}
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                    {fmtYards(row.yardage)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <ScorePill score={row.score} />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/* ─── Score over time canvas ──────────────────────────────────────────────── */

function ScoreCanvas({ accent, trend }) {
    const labelled = useMemo(() => trend.map((p) => ({ ...p, label: fmtDate(p.date) })), [trend])
    // The chart needs at least one rolling-score data point to be useful;
    // the rolling line stabilises after the first day with ticket data so
    // it's the best signal for "is service still trending?".
    const validRolling = labelled.filter((p) => p.rollingScore != null)
    if (validRolling.length < 2) {
        return <EmptySection icon="fa-chart-line" message="Need at least two days with ticket data for a trend line." />
    }
    const maxSamples = Math.max(...labelled.map((p) => p.samples || 0), 1)
    return (
        <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={labelled} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <defs>
                        <linearGradient id="sat-vol-grad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
                            <stop offset="100%" stopColor={accent} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="label"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        yAxisId="score"
                        domain={[0, 100]}
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 10 }}
                        width={36}
                        tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                        yAxisId="volume"
                        orientation="right"
                        domain={[0, Math.max(maxSamples * 1.4, 5)]}
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 10 }}
                        width={32}
                    />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ stroke: accent, strokeOpacity: 0.2 }}
                        formatter={(value, name, item) => {
                            if (name === 'Volume') return [`${fmtInt(value)} orders`, 'Volume']
                            const samples = item?.payload?.samples ?? 0
                            const good = item?.payload?.goodService ?? 0
                            const bad = item?.payload?.badService ?? 0
                            if (name === '7-day rolling') {
                                const rs = item?.payload?.rollingSamples ?? 0
                                return [
                                    value == null ? '—' : `${value}% (rolling ${rs} order${rs === 1 ? '' : 's'})`,
                                    name
                                ]
                            }
                            return [
                                value == null
                                    ? samples === 0
                                        ? '— · no tickets that day'
                                        : '—'
                                    : `${value}% · ${good} good / ${bad} bad`,
                                'Daily'
                            ]
                        }}
                    />
                    <Area
                        yAxisId="volume"
                        type="monotone"
                        dataKey="samples"
                        name="Volume"
                        stroke="none"
                        fill="url(#sat-vol-grad)"
                        isAnimationActive={false}
                    />
                    {/* Daily binary score — thin line, dots only on points
                        with data. Goes underneath the rolling line so the
                        rolling number reads as the headline. */}
                    <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="score"
                        name="Daily"
                        stroke={accent}
                        strokeOpacity={0.35}
                        strokeWidth={1}
                        dot={{ fill: accent, fillOpacity: 0.6, r: 1.5, stroke: 'none' }}
                        activeDot={{ r: 3 }}
                        isAnimationActive={false}
                    />
                    {/* 7-day rolling good-rate — bold primary signal. */}
                    <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="rollingScore"
                        name="7-day rolling"
                        stroke={accent}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}

/* ─── Weekday strip ───────────────────────────────────────────────────────── */

/** Mon–Sat score breakdown — bars in user accent; tier dot under each
 *  weekday so colour stays minimal. */
function Weekday({ accent, data }) {
    const valid = data.filter((d) => d.score != null)
    if (valid.length === 0) {
        return <EmptySection icon="fa-calendar-week" message="No weekday ticket data yet." />
    }
    return (
        <div className="flex items-end justify-between gap-2 h-[140px] py-2">
            {data.map((bucket) => {
                const tier = tierFor(bucket.score)
                const h = bucket.score == null ? 4 : Math.max(8, (bucket.score / 100) * 100)
                const opacity = bucket.score == null ? 0.25 : 0.35 + (bucket.score / 100) * 0.55
                return (
                    <div key={bucket.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-end h-[100px]">
                            <span className="text-[10.5px] font-bold tabular-nums leading-none text-text-primary">
                                {bucket.score == null ? '—' : `${bucket.score}%`}
                            </span>
                            <div
                                className="w-full rounded-t-sm mt-1"
                                style={{ background: accent, height: h, opacity }}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <span
                                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: tier.color }}
                            />
                            <span className="text-[10.5px] font-semibold text-text-secondary">{bucket.label}</span>
                        </div>
                        <span className="text-[9.5px] tabular-nums text-text-tertiary">
                            {bucket.samples ? `${fmtInt(bucket.samples)} ord` : ''}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

/* ─── Worst-orders + worst-customers lists ────────────────────────────────── */

function WorstOrdersList({ orders, plantNameByCode }) {
    return (
        <div className="flex flex-col">
            {orders.map((row, idx) => (
                <div
                    key={`${row.planDate}-${row.plantCode}-${row.orderNum || idx}`}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 text-[12px]"
                    style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)' }}
                >
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold bg-[#dc26261f] text-red-600">
                        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-red-600" />
                        Bad
                    </span>
                    <div className="min-w-0">
                        <div className="font-semibold truncate text-text-primary">{row.customer}</div>
                        <div className="text-[11px] flex items-center gap-2 flex-wrap text-text-secondary">
                            <span className="font-mono tabular-nums">{row.plantCode}</span>
                            {plantNameByCode?.[row.plantCode] && <span>· {plantNameByCode[row.plantCode]}</span>}
                            <span>· {fmtDate(row.planDate)}</span>
                            {row.productCode && <span>· {row.productCode}</span>}
                        </div>
                    </div>
                    <div className="text-right font-mono tabular-nums font-semibold text-text-primary">
                        {fmtYards(row.yardage)} yd³
                    </div>
                </div>
            ))}
        </div>
    )
}

function WorstCustomersList({ customers }) {
    return (
        <div className="flex flex-col">
            {customers.map((row, idx) => (
                <div
                    key={row.customer}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 text-[12px]"
                    style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)' }}
                >
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold tabular-nums bg-[#dc26261f] text-red-600">
                        {row.badOrders} bad
                    </span>
                    <div className="min-w-0">
                        <div className="font-semibold truncate text-text-primary">{row.customer}</div>
                        <div className="text-[11px] flex items-center gap-2 flex-wrap text-text-secondary">
                            <span>
                                {fmtInt(row.badOrders)} of {fmtInt(row.samples)} scored
                            </span>
                            <span>· {fmtYards(row.yardage)} yd³ affected</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ─── Page shell ──────────────────────────────────────────────────────────── */

/**
 * Customer-satisfaction sub-page. Stays in lockstep with the global period
 * / plant / comparison selectors above. Layout is intentionally restrained:
 * the same flat-panel + hairline-border + monospace-number visual language
 * the rest of the Statistics tab uses. Tier colour appears only on small
 * status pills + trajectory arrows; bars + lines use the user's accent.
 *
 * Loading: the full-page skeleton renders ONLY while we're still in the
 * cold-start (no aggregate yet). Once anything is in, individual sections
 * each show their own "Refreshing…" inline indicator + loading-spinner
 * empty-states so users always see whether a panel is missing data because
 * it's loading or because the window genuinely has none.
 */
export function PlanStatisticsSatisfactionPage({
    accentColor,
    aggregate,
    byWeekday = [],
    loading,
    momentum,
    onSelectPlant,
    perPlant,
    plantNameByCode,
    previousAggregate,
    range,
    selectedPlant,
    trend,
    worstCustomers = [],
    worstOrders = []
}) {
    const showSkeleton = loading && !aggregate
    const accent = accentColor || '#1e3a5f'

    if (showSkeleton) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[120, 90, 220, 240, 200, 200].map((h, i) => (
                    <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
                ))}
            </div>
        )
    }

    if (!aggregate) {
        return (
            <Panel title="Customer satisfaction" innerClassName="p-0">
                <EmptySection
                    icon="fa-circle-info"
                    message="No ticket data in this window. Pick a different period or plant filter."
                />
            </Panel>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <Hero
                aggregate={aggregate}
                loading={loading}
                plantNameByCode={plantNameByCode}
                previousAggregate={previousAggregate}
                range={range}
                selectedPlant={selectedPlant}
            />

            <Momentum momentum={momentum} loading={loading} />

            <Panel
                title="Plants"
                innerClassName={perPlant.length === 0 ? 'p-0' : 'p-0'}
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {perPlant.length} plant{perPlant.length === 1 ? '' : 's'} · click a row to focus
                        </span>
                    )
                }
            >
                {perPlant.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading per-plant scores…' : 'No plant has ticket data in this window yet.'}
                    />
                ) : (
                    <PlantScoreboard
                        accent={accent}
                        perPlant={perPlant}
                        plantNameByCode={plantNameByCode}
                        selectedPlant={selectedPlant}
                        onPlantClick={onSelectPlant}
                    />
                )}
            </Panel>

            <Panel
                title="Good-service rate over time"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            bold = 7-day rolling · faint = daily · area = order volume
                        </span>
                    )
                }
            >
                <ScoreCanvas accent={accent} trend={trend} />
            </Panel>

            <Panel title="Score by weekday" right={loading ? <RefreshingHint when /> : null}>
                {byWeekday.filter((d) => d.score != null).length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading per-weekday scores…' : 'No weekday ticket data yet.'}
                    />
                ) : (
                    <Weekday accent={accent} data={byWeekday} />
                )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel
                    title="Worst orders to follow up on"
                    innerClassName="p-0"
                    right={
                        loading ? (
                            <RefreshingHint when />
                        ) : (
                            <span className="text-[11px] text-text-tertiary">
                                {worstOrders.length} bad order{worstOrders.length === 1 ? '' : 's'}
                            </span>
                        )
                    }
                >
                    {worstOrders.length === 0 ? (
                        <EmptySection
                            icon="fa-circle-check"
                            loading={loading}
                            message={
                                loading ? 'Scoring orders…' : 'Every scored order in this window was good service.'
                            }
                        />
                    ) : (
                        <WorstOrdersList orders={worstOrders} plantNameByCode={plantNameByCode} />
                    )}
                </Panel>
                <Panel
                    title="Customers with bad service"
                    innerClassName="p-0"
                    right={
                        loading ? (
                            <RefreshingHint when />
                        ) : (
                            <span className="text-[11px] text-text-tertiary">
                                {worstCustomers.length} customer{worstCustomers.length === 1 ? '' : 's'}
                            </span>
                        )
                    }
                >
                    {worstCustomers.length === 0 ? (
                        <EmptySection
                            icon="fa-circle-check"
                            loading={loading}
                            message={loading ? 'Aggregating customers…' : 'No customer has bad service in this window.'}
                        />
                    ) : (
                        <WorstCustomersList customers={worstCustomers} />
                    )}
                </Panel>
            </div>
        </div>
    )
}

export default PlanStatisticsSatisfactionPage
