/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtFloat, fmtInt, fmtRange, parseIsoLocal } from '../../../../../utils/PlanStatisticsFormatUtility'
import {
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
    plantBadgeColor
} from '../../../../../utils/PlanUtility'
import { Panel } from '../../../ui/Panel'
import { DayOfWeekChart, TrendChart } from './PlanStatisticsCharts'
import { BigPoursTable, ComparisonRow, PlantScorecardTable, RankedList } from './PlanStatisticsTables'

/* ──────────────────────────────────────────────────────────────────────────
 * Shared loading / empty primitives — every sub-page uses the same vocab so
 * a "Refreshing…" indicator on Yardage looks identical to one on Plants or
 * Customers. Centralising these means we never drift into per-section
 * lookalikes that drift apart over time.
 * ────────────────────────────────────────────────────────────────────────── */

/** Inline indicator shown in a Panel's right slot while data is being
 *  fetched but partial / cached content is already on screen. */
export function RefreshingHint({ when }) {
    if (!when) return null
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <i className="fas fa-spinner fa-spin text-[10px]" />
            Refreshing…
        </span>
    )
}

/** Empty / loading state for a panel body — explicit messaging beats a
 *  blank box and lets the user tell "loading" apart from "no data". */
export function EmptySection({ icon = 'fa-circle-info', loading, message }) {
    return (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-text-tertiary">
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : icon} text-[14px]`} />
            <span>{message}</span>
        </div>
    )
}

/** True when the schedule fetch has finished and there's nothing to show. */
const isEmptyAfterLoad = (loading, currentDays) => !loading && currentDays.length === 0

/* ──────────────────────────────────────────────────────────────────────────
 * Period comparison — same metric on both sides + Δ%. Shared between
 * Overview / Plants when comparison is on.
 * ────────────────────────────────────────────────────────────────────────── */

export function ComparisonPanel({ currentSummary, previousSummary }) {
    const rows = useMemo(
        () => [
            {
                current: { formatted: fmtInt(currentSummary.totalYardage), value: currentSummary.totalYardage },
                label: 'Total yardage',
                previous: { formatted: fmtInt(previousSummary.totalYardage), value: previousSummary.totalYardage }
            },
            {
                current: { formatted: fmtInt(currentSummary.totalLoads), value: currentSummary.totalLoads },
                label: 'Loads scheduled',
                previous: { formatted: fmtInt(previousSummary.totalLoads), value: previousSummary.totalLoads }
            },
            {
                current: { formatted: fmtInt(currentSummary.totalOrders), value: currentSummary.totalOrders },
                label: 'Orders',
                previous: { formatted: fmtInt(previousSummary.totalOrders), value: previousSummary.totalOrders }
            },
            {
                current: {
                    formatted: currentSummary.yardagePerLoad != null ? fmtFloat(currentSummary.yardagePerLoad) : '—',
                    value: currentSummary.yardagePerLoad
                },
                label: 'Yardage per load',
                previous:
                    previousSummary.yardagePerLoad != null
                        ? {
                              formatted: fmtFloat(previousSummary.yardagePerLoad),
                              value: previousSummary.yardagePerLoad
                          }
                        : null
            },
            {
                current: {
                    formatted: fmtInt(currentSummary.avgYardagePerActiveDay),
                    value: currentSummary.avgYardagePerActiveDay
                },
                label: 'Avg yardage / active day',
                previous: {
                    formatted: fmtInt(previousSummary.avgYardagePerActiveDay),
                    value: previousSummary.avgYardagePerActiveDay
                }
            },
            {
                current: {
                    formatted:
                        currentSummary.avgShiftSpanHours != null ? fmtFloat(currentSummary.avgShiftSpanHours) : '—',
                    value: currentSummary.avgShiftSpanHours
                },
                label: 'Avg shift span (h)',
                previous:
                    previousSummary.avgShiftSpanHours != null
                        ? {
                              formatted: fmtFloat(previousSummary.avgShiftSpanHours),
                              value: previousSummary.avgShiftSpanHours
                          }
                        : null
            },
            {
                current: {
                    formatted: `${currentSummary.daysWithProduction}/${currentSummary.dayCount}`,
                    value: currentSummary.daysWithProduction
                },
                label: 'Active production days',
                previous: {
                    formatted: `${previousSummary.daysWithProduction}/${previousSummary.dayCount}`,
                    value: previousSummary.daysWithProduction
                }
            }
        ],
        [currentSummary, previousSummary]
    )

    return (
        <Panel title="Period comparison" innerClassName="p-0">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                <span>Metric</span>
                <span>Current</span>
                <span>Previous</span>
                <span className="text-right" style={{ minWidth: 60 }}>
                    Δ
                </span>
            </div>
            {rows.map((row) => (
                <ComparisonRow key={row.label} label={row.label} current={row.current} previous={row.previous} />
            ))}
        </Panel>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * NEW Overview — distilled best-of from every sub-page. Layout:
 *
 *   1. Daily yardage trend (the single most-asked-for chart on the page)
 *   2. Two-up: Top plants (5) | Customer satisfaction summary
 *   3. Plants snapshot (count + leader/laggard)
 *   4. Period comparison (only when comparison is on)
 *
 * Every panel has a "View details →" link that switches the active sidebar
 * section so the page works as a launchpad into the deeper views.
 * ────────────────────────────────────────────────────────────────────────── */

/** Tiny "Open <section> →" affordance in a panel's right slot. */
function ViewDetails({ onSelect, section, label = 'View details' }) {
    if (!onSelect) return null
    return (
        <button
            type="button"
            onClick={() => onSelect(section)}
            className="text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 text-text-secondary"
        >
            {label}
            <i className="fas fa-arrow-right text-[9px]" />
        </button>
    )
}

/** Customer-satisfaction summary card on the Overview. Shows just the
 *  binary good/bad split + a "View details" affordance. */
function SatisfactionSummary({ aggregate, loading, onSelect }) {
    return (
        <Panel
            title="Customer satisfaction"
            innerClassName="p-0"
            right={loading ? <RefreshingHint when /> : <ViewDetails onSelect={onSelect} section="satisfaction" />}
        >
            {!aggregate && !loading ? (
                <EmptySection icon="fa-circle-info" message="No ticket data scored in this window yet." />
            ) : !aggregate && loading ? (
                <EmptySection loading message="Scoring orders…" />
            ) : (
                <div className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-baseline gap-3">
                        <span
                            className="font-mono tabular-nums font-bold leading-none text-text-primary"
                            style={{ fontSize: 32 }}
                        >
                            {Math.round(aggregate.score * 100)}%
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-text-tertiary">
                            good-service rate
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[12px]">
                        <div className="rounded p-2 flex flex-col bg-bg-secondary border border-border-light">
                            <span className="text-[10px] text-text-tertiary">Good</span>
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {fmtInt(aggregate.goodService)}
                            </span>
                        </div>
                        <div className="rounded p-2 flex flex-col bg-bg-secondary border border-border-light">
                            <span className="text-[10px] text-text-tertiary">Bad</span>
                            <span
                                className="font-mono tabular-nums font-semibold"
                                style={{ color: aggregate.badService > 0 ? '#dc2626' : 'var(--text-primary)' }}
                            >
                                {fmtInt(aggregate.badService)}
                            </span>
                        </div>
                        <div className="rounded p-2 flex flex-col bg-bg-secondary border border-border-light">
                            <span className="text-[10px] text-text-tertiary">Scored</span>
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {fmtInt(aggregate.samples)}
                            </span>
                        </div>
                    </div>
                    <span className="text-[10.5px] text-text-tertiary">
                        Bad = late &gt; 15 min OR pace dropped below schedule.
                    </span>
                </div>
            )}
        </Panel>
    )
}

/** Launchpad tile linking to a deep-dive sub-page. Each tile carries a single
 *  teaser metric so the Overview answers "what should I look at next?" rather
 *  than trying to replay any sub-page's content. */
function LaunchpadTile({ accent, hint, icon, label, onSelect, section, value }) {
    return (
        <button
            type="button"
            onClick={() => onSelect?.(section)}
            className="flex flex-col gap-1 items-start rounded-lg border bg-bg-secondary border-border-light cursor-pointer p-3 text-left hover:border-current transition-colors"
            style={{ color: 'var(--text-secondary)' }}
        >
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                <i className={`fas ${icon} text-[11px]`} style={{ color: accent }} />
                {label}
            </span>
            <span className="font-mono tabular-nums font-bold leading-none text-text-primary" style={{ fontSize: 22 }}>
                {value}
            </span>
            {hint && <span className="text-[10.5px] text-text-tertiary">{hint}</span>}
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: accent }}>
                Open
                <i className="fas fa-arrow-right text-[9px]" />
            </span>
        </button>
    )
}

/** One row inside the Period-highlights / Watchlist cards. Big label, big
 *  value, optional hint underneath. Mirrors the at-a-glance density of the
 *  dashboard "Stat" components without forcing a column grid. */
function HighlightRow({ icon, label, hint, value, valueColor }) {
    return (
        <div className="flex items-start gap-3 px-3 py-2.5 border-t border-border-light first:border-t-0">
            <i
                className={`fas ${icon} text-[11px] mt-1 w-4 text-center`}
                style={{ color: valueColor || 'var(--text-tertiary)' }}
            />
            <div className="flex-1 min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">{label}</div>
                <div
                    className="font-semibold truncate text-text-primary"
                    style={{ color: valueColor || 'var(--text-primary)', fontSize: 13.5 }}
                >
                    {value}
                </div>
                {hint && <div className="text-[11px] text-text-tertiary truncate">{hint}</div>}
            </div>
        </div>
    )
}

/** Friendly weekday + month/day formatter — e.g. "Wed, May 14". */
const formatDayLabel = (iso) => {
    if (!iso || typeof iso !== 'string') return '—'
    const parsed = parseIsoLocal(iso)
    if (!parsed) return iso
    return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })
}

/** Overview page — synthesizes every other section without duplicating any
 *  one. Reads as a launchpad: the period story up top, what stood out, what
 *  needs attention, and quick jumps into the deep-dive pages. */
export function PlanStatisticsOverviewPage({
    accentColor,
    currentDays,
    currentSummary,
    knownPlantSummary,
    loading,
    onSelectSection,
    plantNameByCode,
    range,
    satisfactionAggregate,
    satisfactionLoading
}) {
    const accent = accentColor || '#1e3a5f'
    const isEmpty = isEmptyAfterLoad(loading, currentDays)

    if (loading && currentDays.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[160, 220, 200, 160].map((h, i) => (
                    <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
                ))}
            </div>
        )
    }

    if (isEmpty) {
        return (
            <Panel title="Overview" innerClassName="p-0">
                <EmptySection
                    icon="fa-chart-line"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }

    const topPlantShare = currentSummary.topPlantShare
    const topCustomerShare = currentSummary.topCustomerShare
    const bestDay = currentSummary.bestDay
    const worstDay = currentSummary.worstDay
    const peakHour = currentSummary.peakHour
    const activeCount = knownPlantSummary?.activeCount || 0
    const totalYardage = currentSummary.totalYardage || 0
    const daysWithProduction = currentSummary.daysWithProduction || 0
    const yardagePerDay = daysWithProduction > 0 ? Math.round(totalYardage / daysWithProduction) : 0
    const yardagePerLoad = currentSummary.yardagePerLoad
    const badServiceCount = satisfactionAggregate?.badService || 0
    const goodPct = satisfactionAggregate ? Math.round(satisfactionAggregate.score * 100) : null
    const peakHourLabel =
        peakHour && peakHour.loads > 0
            ? `${String(peakHour.hour).padStart(2, '0')}:00 · ${fmtInt(peakHour.loads)} loads`
            : '—'
    const shiftSpanLabel =
        currentSummary.avgShiftSpanHours != null ? `${fmtFloat(currentSummary.avgShiftSpanHours)} h avg` : '—'

    return (
        <div className="flex flex-col gap-4">
            {/* 1. Period story — single high-density narrative card. */}
            <Panel title="Period summary" innerClassName="p-4">
                <div className="flex flex-col gap-3">
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <span
                            className="font-mono tabular-nums font-bold leading-none text-text-primary font-heading"
                            style={{ fontSize: 36 }}
                        >
                            {fmtInt(totalYardage)}
                        </span>
                        <span className="text-[11.5px] uppercase tracking-wider text-text-tertiary">
                            yd³ poured · {daysWithProduction} day{daysWithProduction === 1 ? '' : 's'} · {activeCount}{' '}
                            active plant{activeCount === 1 ? '' : 's'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                        <div className="rounded p-2 flex flex-col bg-bg-secondary border border-border-light">
                            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Avg / day</span>
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {fmtInt(yardagePerDay)} yd³
                            </span>
                        </div>
                        <div className="rounded p-2 flex flex-col bg-bg-secondary border border-border-light">
                            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                                Yards / load
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {yardagePerLoad != null ? fmtFloat(yardagePerLoad) : '—'}
                            </span>
                        </div>
                        <div className="rounded p-2 flex flex-col bg-bg-secondary border border-border-light">
                            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Peak hour</span>
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {peakHourLabel}
                            </span>
                        </div>
                        <div className="rounded p-2 flex flex-col bg-bg-secondary border border-border-light">
                            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Shift span</span>
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {shiftSpanLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </Panel>

            {/* 2. Two-up: what stood out · how customers felt. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Period highlights" innerClassName="p-0">
                    <HighlightRow
                        icon="fa-arrow-trend-up"
                        label="Best day"
                        value={bestDay ? formatDayLabel(bestDay.planDate) : '—'}
                        hint={
                            bestDay ? `${fmtInt(bestDay.totalYardage)} yd³ · ${fmtInt(bestDay.totalLoads)} loads` : null
                        }
                    />
                    <HighlightRow
                        icon="fa-arrow-trend-down"
                        label="Slowest day"
                        value={worstDay ? formatDayLabel(worstDay.planDate) : '—'}
                        hint={worstDay ? `${fmtInt(worstDay.totalYardage)} yd³` : null}
                    />
                    <HighlightRow
                        icon="fa-industry"
                        label="Top plant"
                        value={
                            topPlantShare
                                ? plantNameByCode?.[topPlantShare.code]
                                    ? `${topPlantShare.code} · ${plantNameByCode[topPlantShare.code]}`
                                    : topPlantShare.code
                                : '—'
                        }
                        hint={
                            topPlantShare
                                ? `${fmtInt(topPlantShare.yardage)} yd³ · ${(topPlantShare.share * 100).toFixed(0)}% share`
                                : null
                        }
                        valueColor={topPlantShare ? plantBadgeColor(topPlantShare.code, accent) : null}
                    />
                    <HighlightRow
                        icon="fa-handshake"
                        label="Top customer"
                        value={topCustomerShare?.customer || '—'}
                        hint={
                            topCustomerShare
                                ? `${fmtInt(topCustomerShare.yardage)} yd³ · ${(topCustomerShare.share * 100).toFixed(0)}% share`
                                : null
                        }
                    />
                </Panel>
                <SatisfactionSummary
                    aggregate={satisfactionAggregate}
                    loading={satisfactionLoading || loading}
                    onSelect={onSelectSection}
                />
            </div>

            {/* 3. Quick-nav launchpad — every other section in one row. */}
            <Panel title="Drill into details" innerClassName="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <LaunchpadTile
                        accent={accent}
                        icon="fa-industry"
                        label="Production"
                        section="production"
                        value={`${activeCount} plant${activeCount === 1 ? '' : 's'}`}
                        hint="Scorecards · trend · weekday"
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        accent={accent}
                        icon="fa-face-smile"
                        label="Customer satisfaction"
                        section="satisfaction"
                        value={goodPct != null ? `${goodPct}%` : '—'}
                        hint={
                            satisfactionAggregate
                                ? `${fmtInt(badServiceCount)} bad${badServiceCount === 1 ? '' : 's'} flagged`
                                : 'No scored tickets yet'
                        }
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        accent={accent}
                        icon="fa-id-badge"
                        label="Operators"
                        section="operators"
                        value={fmtInt(currentSummary.totalLoads || 0)}
                        hint="Loads per driver"
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        accent={accent}
                        icon="fa-arrows-rotate"
                        label="Help & cross-loading"
                        section="helpCrossLoading"
                        value={`${activeCount}`}
                        hint="Plants in flow"
                        onSelect={onSelectSection}
                    />
                </div>
            </Panel>
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Production sub-page — merged Plants + Yardage view. Leads with the
 * per-plant scorecard table (the operator-facing "who did what" answer),
 * then a daily yardage trend and weekday-shape chart for time-series
 * context, then the period-comparison block when comparison is on.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsProductionPage({
    accentColor,
    comparison,
    currentDays,
    currentSummary,
    isSingleDay,
    knownPlantRows,
    knownPlantSummary,
    loading,
    mixerCountsByPlant,
    perPlantLoadAttribution,
    plantNameByCode,
    previousSummary,
    range,
    trendComparison,
    trendData
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[280, 260, 200].map((h, i) => (
                    <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
                ))}
            </div>
        )
    }
    if (isEmpty) {
        return (
            <Panel title="Production" innerClassName="p-0">
                <EmptySection
                    icon="fa-industry"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Plant scorecards"
                innerClassName="p-0"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {knownPlantSummary.activeCount} active ·{' '}
                            {knownPlantSummary.topShare
                                ? `top: ${knownPlantSummary.topShare.code} (${(knownPlantSummary.topShare.share * 100).toFixed(0)}%)`
                                : '—'}
                        </span>
                    )
                }
            >
                {knownPlantRows.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading scorecards…' : 'No plant production in this window.'}
                    />
                ) : (
                    <PlantScorecardTable
                        accent={accentColor}
                        isSingleDay={isSingleDay}
                        loadAttributionByPlant={perPlantLoadAttribution}
                        mixerCountsByPlant={mixerCountsByPlant}
                        plantNameByCode={plantNameByCode}
                        rows={knownPlantRows}
                        singleDayShiftSpan={isSingleDay ? currentDays[0]?.shiftSpanHours : null}
                        totalYardage={knownPlantSummary.totalYardage}
                    />
                )}
            </Panel>
            <Panel
                title="Daily yardage trend"
                innerClassName="p-3"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : trendComparison ? (
                        <span className="text-[11px] text-text-tertiary">
                            Dotted = {comparison === 'lastYear' ? 'last year' : 'previous period'}
                        </span>
                    ) : null
                }
            >
                {trendData.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading daily yardage…' : 'No daily yardage data yet.'}
                    />
                ) : (
                    <TrendChart accent={accentColor} data={trendData} comparisonData={trendComparison} />
                )}
            </Panel>
            <Panel title="Average by weekday" innerClassName="p-3" right={loading ? <RefreshingHint when /> : null}>
                {currentDays.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading weekday averages…' : 'No weekday data yet.'}
                    />
                ) : (
                    <DayOfWeekChart accent={accentColor} plans={currentDays} />
                )}
            </Panel>
            {previousSummary && <ComparisonPanel currentSummary={currentSummary} previousSummary={previousSummary} />}
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Customers + products sub-page.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsCustomersPage({
    accentColor,
    currentDays,
    currentSummary,
    loading,
    range,
    topCustomers,
    topProducts
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[0, 1].map((i) => (
                        <div key={i} className="rounded bg-bg-secondary border border-border-light h-[260px]" />
                    ))}
                </div>
            </div>
        )
    }
    if (isEmpty) {
        return (
            <Panel title="Customers & products" innerClassName="p-0">
                <EmptySection
                    icon="fa-handshake"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Panel
                title="Customer concentration"
                innerClassName="p-3"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : currentSummary.topCustomerShare ? (
                        <span className="text-[11px] text-text-tertiary">
                            Top {(currentSummary.topCustomerShare.share * 100).toFixed(0)}%
                        </span>
                    ) : null
                }
            >
                {topCustomers.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading customers…' : 'No customer data in this window.'}
                    />
                ) : (
                    <RankedList
                        accent={accentColor}
                        emptyLabel="No customer data in this range."
                        items={topCustomers}
                        labelKey="customer"
                        secondaryFmt={(item) => `${item.orders} ord`}
                    />
                )}
            </Panel>
            <Panel title="Top product mixes" innerClassName="p-3" right={loading ? <RefreshingHint when /> : null}>
                {topProducts.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading products…' : 'No product data in this window.'}
                    />
                ) : (
                    <RankedList
                        accent={accentColor}
                        emptyLabel="No product data in this range."
                        items={topProducts}
                        labelKey="product"
                        secondaryFmt={(item) => `${fmtInt(item.loads)} loads`}
                    />
                )}
            </Panel>
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Big pours sub-page — full coordination list.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsBigPoursPage({
    accentColor,
    currentDays,
    currentSummary,
    loading,
    plantNameByCode,
    range
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return <div className="rounded animate-pulse bg-bg-secondary border border-border-light h-[320px]" />
    }
    if (isEmpty) {
        return (
            <Panel title="Big pours" innerClassName="p-0">
                <EmptySection
                    icon="fa-truck-monster"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <Panel
            title="Big pours to coordinate"
            innerClassName="p-0"
            right={
                loading ? (
                    <RefreshingHint when />
                ) : (
                    <span className="text-[11px] text-text-tertiary">
                        {currentSummary.bigPours.length} · &gt;{BIG_POUR_YARDAGE_THRESHOLD} yd³ · &lt;
                        {BIG_POUR_SPACING_THRESHOLD_MIN}m spacing
                    </span>
                )
            }
        >
            {currentSummary.bigPours.length === 0 ? (
                <EmptySection
                    icon="fa-circle-check"
                    loading={loading}
                    message={
                        loading
                            ? 'Looking for big pours…'
                            : 'No big pours in this window — every order is within normal coordination range.'
                    }
                />
            ) : (
                <BigPoursTable accent={accentColor} plantNameByCode={plantNameByCode} pours={currentSummary.bigPours} />
            )}
        </Panel>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Operators sub-page — per-driver load count + yardage across the active
 * window, derived from ticket-level data. Each row cross-references the
 * driven truck(s) against the operator's assigned-active mixer so the page
 * surfaces wrong-truck / wrong-plant / unassigned / multi-truck mismatches.
 * ────────────────────────────────────────────────────────────────────────── */

const MISMATCH_BADGES = {
    multiTruck: { bg: 'rgba(194, 65, 12, 0.16)', fg: '#9a3412', icon: 'fa-shuffle', label: 'Multi-truck' },
    unassigned: { bg: 'rgba(220, 38, 38, 0.14)', fg: '#b91c1c', icon: 'fa-user-slash', label: 'Unassigned' },
    wrongPlant: { bg: 'rgba(217, 119, 6, 0.14)', fg: '#92400e', icon: 'fa-industry', label: 'Wrong plant' },
    wrongTruck: { bg: 'rgba(234, 179, 8, 0.18)', fg: '#854d0e', icon: 'fa-truck', label: 'Wrong truck' }
}

function MismatchBadge({ tone }) {
    const cfg = MISMATCH_BADGES[tone]
    if (!cfg) return null
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: cfg.bg, color: cfg.fg }}
            title={cfg.label}
        >
            <i className={`fas ${cfg.icon} text-[9px]`} />
            {cfg.label}
        </span>
    )
}

/** Trucks the operator actually drove this window. Each chip turns
 *  green when it matches their assigned mixer (so the row reads "yes,
 *  they were in their truck") and stays neutral otherwise. The
 *  assigned-mixer reference itself lives in `AssignedCell` to keep
 *  this column focused on real activity. */
function TruckCell({ assignedTruck, trucksDriven }) {
    if (trucksDriven.length === 0) {
        return <span className="text-[11px] italic text-text-tertiary">No trucks</span>
    }
    return (
        <div className="flex flex-wrap items-center gap-1">
            {trucksDriven.map((truck) => {
                const isAssigned = assignedTruck === truck
                return (
                    <span
                        key={truck}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-semibold"
                        style={{
                            background: isAssigned ? 'rgba(22, 163, 74, 0.14)' : 'var(--bg-tertiary)',
                            color: isAssigned ? '#15803d' : 'var(--text-primary)'
                        }}
                        title={
                            isAssigned
                                ? `#${truck} · matches assigned mixer`
                                : assignedTruck
                                  ? `#${truck} · assigned mixer is #${assignedTruck}`
                                  : `#${truck} · operator has no assigned mixer`
                        }
                    >
                        #{truck}
                    </span>
                )
            })}
        </div>
    )
}

/** Operator's plant assignment — pulled strictly from the active-mixer
 *  roster (plant code + truck number), falling back to the operator
 *  record's `plant_code` for spare drivers without a fixed mixer. We do
 *  NOT infer a plant from where the driver happened to load tickets —
 *  operators are assigned to plants in the roster, not derived from
 *  load history. Rows that don't link to either source collapse into
 *  the dedicated "Unmatched drivers" bucket row instead of reaching
 *  this component. */
function AssignedCell({ assignedPlant, assignedTruck }) {
    if (!assignedPlant && !assignedTruck) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold italic text-text-tertiary bg-bg-tertiary"
                title="Operator record has no active mixer assignment and no plant set"
            >
                <i className="fas fa-circle-question text-[9px]" />
                No assignment
            </span>
        )
    }
    return (
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {assignedPlant && (
                <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[11.5px] font-mono tabular-nums font-bold text-text-primary bg-bg-tertiary"
                    title={`Active-mixer roster plant: ${assignedPlant}`}
                >
                    {assignedPlant}
                </span>
            )}
            {assignedTruck && (
                <span
                    className="font-mono tabular-nums text-[11.5px] text-text-secondary"
                    title={`Assigned mixer #${assignedTruck}`}
                >
                    #{assignedTruck}
                </span>
            )}
        </div>
    )
}

/** Aggregate row at the bottom of the Operators table for every ticket
 *  whose `driver_name` doesn't resolve to an operator record in Tools.
 *  Spans the whole table width with a warning tint, names the cause
 *  ("Jonel ↔ Tools name mismatch"), and lists up to a dozen sample
 *  driver-name strings from the bucket so the dispatcher can chase the
 *  worst offenders. The bucket still carries real load + yardage totals
 *  so the column footer stays honest.
 *
 *  When the operator roster genuinely failed to load (empty array after
 *  fetch settled), the message swaps to point at THAT problem instead of
 *  blaming name spellings — otherwise every ticket would always end up
 *  here and the dispatcher would chase ghost name-mismatch fixes. */
function UnmatchedDriversRow({
    accentColor,
    avgYardage,
    isFirst,
    maxLoads,
    operatorRosterCount,
    operatorRosterReady,
    row
}) {
    const sampleList = Array.isArray(row.sampleNames) ? row.sampleNames : []
    return (
        <div
            className="grid grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_4.5rem_4.5rem_5rem] gap-3 items-start px-3 py-2.5 text-[12.5px]"
            style={{
                background: 'rgba(202, 138, 4, 0.07)',
                borderTop: isFirst ? 'none' : '1px solid var(--border-light)'
            }}
        >
            <span className="font-mono tabular-nums text-right text-text-tertiary pt-0.5">—</span>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <i className="fas fa-triangle-exclamation text-[12px] text-[#854d0e]" aria-hidden="true" />
                    <span className="font-semibold text-text-primary">Unmatched drivers</span>
                </div>
                <div className="text-[10.5px] mt-1 text-text-secondary leading-snug">
                    {operatorRosterReady && operatorRosterCount === 0 ? (
                        <>
                            <b>Operator roster failed to load.</b> Tools couldn&apos;t fetch any operator records, so
                            every ticket lands here by default. Refresh the page; if the problem persists, check the
                            operator-service edge function.
                        </>
                    ) : (
                        <>
                            These tickets reference driver names that don&apos;t match any of the{' '}
                            {operatorRosterReady ? <b>{fmtInt(operatorRosterCount)}</b> : '—'} operator records in
                            Tools. Usually caused by a spelling mismatch between Jonel and Tools — fix the
                            operator&apos;s name on either side to roll these loads into the right driver row.
                        </>
                    )}
                </div>
                {sampleList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {sampleList.map((sample) => (
                            <span
                                key={sample}
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-mono bg-bg-primary border border-border-light text-text-secondary"
                                title="Driver name from the ticket"
                            >
                                {sample}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold italic text-[#854d0e] self-start"
                style={{ background: 'rgba(202, 138, 4, 0.16)' }}
                title="No operator-record link for these tickets — can't show an assigned plant"
            >
                <i className="fas fa-triangle-exclamation text-[9px]" />
                Name mismatch
            </span>
            <div className="flex flex-wrap items-center gap-1 min-w-0">
                {row.plantLoads.length === 0 ? (
                    <span className="text-[11px] text-text-tertiary">—</span>
                ) : (
                    row.plantLoads.map(({ plant, loads }) => (
                        <span
                            key={plant}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-mono tabular-nums bg-bg-tertiary text-text-primary"
                            title={`${plant} · ${loads} unmatched load${loads === 1 ? '' : 's'}`}
                        >
                            <span className="font-semibold">{plant}</span>
                            <span className="text-text-tertiary">×</span>
                            <span className="font-semibold">{loads}</span>
                        </span>
                    ))
                )}
            </div>
            <div className="flex flex-wrap items-center gap-1 min-w-0">
                {row.trucksDriven.length === 0 ? (
                    <span className="text-[11px] italic text-text-tertiary">No trucks</span>
                ) : (
                    row.trucksDriven.map((truck) => (
                        <span
                            key={truck}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-semibold bg-bg-tertiary text-text-primary"
                            title={`#${truck} · driven on unmatched ticket(s)`}
                        >
                            #{truck}
                        </span>
                    ))
                )}
            </div>
            <span className="text-[11px] text-text-tertiary">—</span>
            <div className="flex flex-col items-end gap-1 min-w-0">
                <span className="font-mono tabular-nums font-semibold text-text-primary">{fmtInt(row.loads)}</span>
                <div className="h-1.5 rounded-sm overflow-hidden relative bg-bg-tertiary w-12">
                    <div
                        className="h-full rounded-sm"
                        style={{
                            background: accentColor,
                            width: `${maxLoads > 0 ? (row.loads / maxLoads) * 100 : 0}%`
                        }}
                    />
                </div>
            </div>
            <span
                className="font-mono tabular-nums text-right text-text-secondary"
                title={
                    row.loads > 0
                        ? `Average yardage per load · ${row.loads} unmatched load${row.loads === 1 ? '' : 's'}`
                        : 'No loads recorded'
                }
            >
                {row.loads > 0 ? avgYardage.toFixed(1) : '—'}
            </span>
            <span className="font-mono tabular-nums text-right text-text-secondary">{fmtInt(row.yardage)} yd³</span>
        </div>
    )
}

export function PlanStatisticsOperatorsPage({
    accentColor,
    currentDays,
    loading,
    loadsByOperator = [],
    range,
    selectedPlant
}) {
    const totals = useMemo(() => {
        let loads = 0
        let yardage = 0
        let mismatched = 0
        loadsByOperator.forEach((row) => {
            loads += row.loads
            yardage += row.yardage
            if (row.mismatches.length > 0) mismatched += 1
        })
        return { drivers: loadsByOperator.length, loads, mismatched, yardage }
    }, [loadsByOperator])

    if (loading && currentDays.length === 0) {
        return <div className="rounded animate-pulse bg-bg-secondary border border-border-light h-[320px]" />
    }
    if (!loading && currentDays.length === 0) {
        return (
            <Panel title="Operators" innerClassName="p-0">
                <EmptySection
                    icon="fa-id-badge"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    const maxLoads = loadsByOperator.length > 0 ? loadsByOperator[0].loads : 0
    return (
        <Panel
            title="Loads per operator"
            innerClassName="p-0"
            right={
                loading ? (
                    <RefreshingHint when />
                ) : totals.drivers > 0 ? (
                    <span className="text-[11px] text-text-tertiary">
                        {fmtInt(totals.drivers)} driver{totals.drivers === 1 ? '' : 's'} · {fmtInt(totals.loads)} load
                        {totals.loads === 1 ? '' : 's'} · {fmtInt(totals.yardage)} yd³
                        {totals.mismatched > 0 && (
                            <>
                                {' · '}
                                <span className="font-semibold text-red-600">
                                    {fmtInt(totals.mismatched)} mismatch{totals.mismatched === 1 ? '' : 'es'}
                                </span>
                            </>
                        )}
                    </span>
                ) : null
            }
        >
            {loadsByOperator.length === 0 ? (
                <EmptySection
                    icon="fa-id-badge"
                    loading={loading}
                    message={(() => {
                        if (loading) return 'Loading tickets…'
                        if (selectedPlant) {
                            return `No drivers loaded at plant ${selectedPlant} in ${fmtRange(range.start, range.end)}.`
                        }
                        return `No ticket data available for ${fmtRange(range.start, range.end)}.`
                    })()}
                />
            ) : (
                <div className="flex flex-col">
                    <div className="grid grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_4.5rem_4.5rem_5rem] gap-3 items-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b border-border-light bg-bg-secondary text-text-tertiary">
                        <span className="text-right">#</span>
                        <span>Operator</span>
                        <span>Assigned</span>
                        <span>Loads by plant</span>
                        <span>Trucks driven</span>
                        <span>Flags</span>
                        <span className="text-right">Loads</span>
                        <span className="text-right" title="Average yards per load — yardage ÷ loads">
                            Yds / load
                        </span>
                        <span className="text-right">Yardage</span>
                    </div>
                    {loadsByOperator.map((row, idx) => {
                        const avgYardage = row.loads > 0 ? row.yardage / row.loads : 0
                        const statusLabel =
                            row.operatorStatus && row.operatorStatus !== 'Active' ? row.operatorStatus : null
                        if (row.unmatched) {
                            return (
                                <UnmatchedDriversRow
                                    key={row.key}
                                    accentColor={accentColor}
                                    avgYardage={avgYardage}
                                    isFirst={idx === 0}
                                    maxLoads={maxLoads}
                                    row={row}
                                />
                            )
                        }
                        return (
                            <div
                                key={row.key}
                                className="grid grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_4.5rem_4.5rem_5rem] gap-3 items-center px-3 py-2 text-[12.5px]"
                                style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)' }}
                            >
                                <span className="font-mono tabular-nums text-right text-text-tertiary">{idx + 1}</span>
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-text-primary">{row.name}</div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                        {row.driverNum && (
                                            <span
                                                className="font-mono tabular-nums text-[10.5px] text-text-tertiary"
                                                title="Dispatch driver number (smyrna_id)"
                                            >
                                                #{row.driverNum}
                                            </span>
                                        )}
                                        {statusLabel && (
                                            <span
                                                className="inline-flex items-center rounded px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                                                style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#b91c1c' }}
                                                title={`Operator status: ${statusLabel}`}
                                            >
                                                {statusLabel}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <AssignedCell assignedPlant={row.homePlant} assignedTruck={row.assignedTruck} />
                                <div className="flex flex-wrap items-center gap-1 min-w-0">
                                    {row.plantLoads.length === 0 ? (
                                        <span className="text-[11px] text-text-tertiary">—</span>
                                    ) : (
                                        row.plantLoads.map(({ plant, loads }) => {
                                            const isHome = plant === row.homePlant
                                            return (
                                                <span
                                                    key={plant}
                                                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-mono tabular-nums"
                                                    style={{
                                                        background: isHome
                                                            ? 'rgba(22, 163, 74, 0.14)'
                                                            : 'var(--bg-tertiary)',
                                                        color: isHome ? '#15803d' : 'var(--text-primary)'
                                                    }}
                                                    title={
                                                        isHome
                                                            ? `${plant} · home plant · ${loads} load${loads === 1 ? '' : 's'}`
                                                            : `${plant} · cross-plant · ${loads} load${loads === 1 ? '' : 's'}`
                                                    }
                                                >
                                                    <span className="font-semibold">{plant}</span>
                                                    <span className="text-text-tertiary">×</span>
                                                    <span className="font-semibold">{loads}</span>
                                                </span>
                                            )
                                        })
                                    )}
                                </div>
                                <TruckCell assignedTruck={row.assignedTruck} trucksDriven={row.trucksDriven} />
                                <div className="flex flex-wrap items-center gap-1 min-w-0">
                                    {row.mismatches.length === 0 ? (
                                        <span className="text-[11px] text-text-tertiary">—</span>
                                    ) : (
                                        row.mismatches.map((tone) => <MismatchBadge key={tone} tone={tone} />)
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1 min-w-0">
                                    <span className="font-mono tabular-nums font-semibold text-text-primary">
                                        {fmtInt(row.loads)}
                                    </span>
                                    <div className="h-1.5 rounded-sm overflow-hidden relative bg-bg-tertiary w-12">
                                        <div
                                            className="h-full rounded-sm"
                                            style={{
                                                background: accentColor,
                                                width: `${maxLoads > 0 ? (row.loads / maxLoads) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                                <span
                                    className="font-mono tabular-nums text-right text-text-secondary"
                                    title={
                                        row.loads > 0
                                            ? `Average yardage per load · ${row.loads} load${row.loads === 1 ? '' : 's'}`
                                            : 'No loads recorded'
                                    }
                                >
                                    {row.loads > 0 ? avgYardage.toFixed(1) : '—'}
                                </span>
                                <span className="font-mono tabular-nums text-right text-text-secondary">
                                    {fmtInt(row.yardage)} yd³
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </Panel>
    )
}
