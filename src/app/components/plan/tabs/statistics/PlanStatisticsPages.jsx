/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useCallback, useMemo, useState } from 'react'

import { OperatorService } from '../../../../../services/OperatorService'
import { fmtFloat, fmtInt, fmtRange, fmtYards, parseIsoLocal } from '../../../../../utils/PlanStatisticsFormatUtility'
import {
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
    plantBadgeColor
} from '../../../../../utils/PlanUtility'
import CommentModalSection from '../../../sections/CommentModalSection'
import HistoryViewSection from '../../../sections/HistoryViewSection'
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
                current: { formatted: fmtYards(currentSummary.totalYardage), value: currentSummary.totalYardage },
                label: 'Total yardage',
                previous: { formatted: fmtYards(previousSummary.totalYardage), value: previousSummary.totalYardage }
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
                    formatted: fmtYards(currentSummary.avgYardagePerActiveDay),
                    value: currentSummary.avgYardagePerActiveDay
                },
                label: 'Avg yardage / active day',
                previous: {
                    formatted: fmtYards(previousSummary.avgYardagePerActiveDay),
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
                            {fmtYards(totalYardage)}
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
                                {fmtYards(yardagePerDay)} yd³
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
                            bestDay
                                ? `${fmtYards(bestDay.totalYardage)} yd³ · ${fmtInt(bestDay.totalLoads)} loads`
                                : null
                        }
                    />
                    <HighlightRow
                        icon="fa-arrow-trend-down"
                        label="Slowest day"
                        value={worstDay ? formatDayLabel(worstDay.planDate) : '—'}
                        hint={worstDay ? `${fmtYards(worstDay.totalYardage)} yd³` : null}
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
                                ? `${fmtYards(topPlantShare.yardage)} yd³ · ${(topPlantShare.share * 100).toFixed(0)}% share`
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
                                ? `${fmtYards(topCustomerShare.yardage)} yd³ · ${(topCustomerShare.share * 100).toFixed(0)}% share`
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
                        hint="Loads per operator"
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
/** Build a plain-text report of every unmatched driver name in the
 *  window. Tab-separated so it pastes into Sheets / Excel cleanly and
 *  also reads as a sane block in Slack / email. The dispatcher hits
 *  "Copy list" and forwards this to whoever maintains operator names. */
function buildUnmatchedNamesReport(rows) {
    const header = ['Operator name (ticket)', 'Operator #', 'Loads', 'Yd³', 'Trucks', 'Plants'].join('\t')
    const body = rows.map((r) =>
        [
            r.name || '(no name)',
            r.driverNums.join(', ') || '—',
            String(r.loads),
            r.yardage > 0 ? r.yardage.toFixed(1) : '—',
            r.trucks.join(', ') || '—',
            r.plants.join(', ') || '—'
        ].join('\t')
    )
    return [header, ...body].join('\n')
}

/** Aggregate row at the bottom of the Operators table for every ticket
 *  whose `driver_name` doesn't resolve to an operator record in Tools.
 *  Spans the whole table width with a warning tint, names the cause
 *  (Jonel ↔ Tools name mismatch), then renders an actionable per-name
 *  breakdown of every unique offender — load count, yardage, driver #,
 *  trucks, loading plants — so the dispatcher can hand the full list
 *  to whoever maintains operator records.
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
    const unmatchedNames = Array.isArray(row.unmatchedNames) ? row.unmatchedNames : []
    const [copyState, setCopyState] = useState('idle')
    const handleCopy = useCallback(async () => {
        const text = buildUnmatchedNamesReport(unmatchedNames)
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
            } else {
                const textarea = document.createElement('textarea')
                textarea.value = text
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
            }
            setCopyState('copied')
            setTimeout(() => setCopyState('idle'), 1800)
        } catch {
            setCopyState('error')
            setTimeout(() => setCopyState('idle'), 1800)
        }
    }, [unmatchedNames])
    return (
        <div
            className="px-3 py-2.5 text-[12.5px] flex flex-col gap-2.5"
            style={{
                background: 'rgba(202, 138, 4, 0.07)',
                borderTop: isFirst ? 'none' : '1px solid var(--border-light)'
            }}
        >
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <i className="fas fa-triangle-exclamation text-[13px] text-[#854d0e]" aria-hidden="true" />
                        <span className="font-semibold text-text-primary">Unmatched operators</span>
                        <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold italic text-[#854d0e]"
                            style={{ background: 'rgba(202, 138, 4, 0.16)' }}
                        >
                            {fmtInt(unmatchedNames.length)} unique · {fmtInt(row.loads)} load
                            {row.loads === 1 ? '' : 's'} · {fmtYards(row.yardage)} yd³
                        </span>
                    </div>
                    <div className="text-[11px] mt-1 text-text-secondary leading-snug max-w-2xl">
                        {operatorRosterReady && operatorRosterCount === 0 ? (
                            <>
                                <b>Operator roster failed to load.</b> Tools couldn&apos;t fetch any operator records,
                                so every ticket lands here by default. Refresh the page; if the problem persists, check
                                the operator-service edge function.
                            </>
                        ) : (
                            <>
                                These tickets reference operator names that don&apos;t match any of the{' '}
                                {operatorRosterReady ? <b>{fmtInt(operatorRosterCount)}</b> : '—'} operator records in
                                Tools. Usually caused by a spelling mismatch between Jonel and Tools — fix the
                                operator&apos;s name on either side to roll these loads into the right operator row.
                            </>
                        )}
                    </div>
                </div>
                {unmatchedNames.length > 0 && (
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer border-none shrink-0"
                        style={{
                            background:
                                copyState === 'copied'
                                    ? 'rgba(22, 163, 74, 0.15)'
                                    : copyState === 'error'
                                      ? 'rgba(220, 38, 38, 0.15)'
                                      : 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color:
                                copyState === 'copied'
                                    ? '#15803d'
                                    : copyState === 'error'
                                      ? '#b91c1c'
                                      : 'var(--text-primary)'
                        }}
                        title="Copy the full unmatched-names list to your clipboard (tab-separated; pastes into Sheets / Excel / Slack cleanly)"
                    >
                        <i
                            className={`fas ${
                                copyState === 'copied'
                                    ? 'fa-circle-check'
                                    : copyState === 'error'
                                      ? 'fa-circle-exclamation'
                                      : 'fa-copy'
                            } text-[11px]`}
                        />
                        {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy list'}
                    </button>
                )}
            </div>
            {unmatchedNames.length === 0 ? (
                <div className="text-[11px] text-text-tertiary italic">
                    No unmatched operator names captured in this window.
                </div>
            ) : (
                <div
                    className="rounded border overflow-hidden"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
                >
                    <div
                        className="grid gap-3 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-light"
                        style={{
                            gridTemplateColumns:
                                'minmax(0, 1.6fr) minmax(0, 0.7fr) 3.5rem 4rem minmax(0, 1fr) minmax(0, 0.9fr)'
                        }}
                    >
                        <span>Operator name (ticket)</span>
                        <span>Operator #</span>
                        <span className="text-right">Loads</span>
                        <span className="text-right">Yd³</span>
                        <span>Trucks</span>
                        <span>Loaded at</span>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto">
                        {unmatchedNames.map((entry, idx) => (
                            <div
                                key={entry.key}
                                className="grid gap-3 px-3 py-1.5 text-[12px] items-center"
                                style={{
                                    background: idx % 2 === 1 ? 'var(--bg-secondary)' : 'transparent',
                                    borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)',
                                    gridTemplateColumns:
                                        'minmax(0, 1.6fr) minmax(0, 0.7fr) 3.5rem 4rem minmax(0, 1fr) minmax(0, 0.9fr)'
                                }}
                            >
                                <span className="font-mono text-text-primary truncate" title={entry.name}>
                                    {entry.name || '(no name)'}
                                </span>
                                <span className="font-mono tabular-nums text-text-secondary truncate">
                                    {entry.driverNums.length === 0 ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        entry.driverNums.join(', ')
                                    )}
                                </span>
                                <span className="font-mono tabular-nums text-right font-semibold text-text-primary">
                                    {fmtInt(entry.loads)}
                                </span>
                                <span className="font-mono tabular-nums text-right text-text-secondary">
                                    {entry.yardage > 0 ? entry.yardage.toFixed(1) : '—'}
                                </span>
                                <span className="font-mono tabular-nums text-text-secondary truncate">
                                    {entry.trucks.length === 0 ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        entry.trucks.map((t) => `#${t}`).join(', ')
                                    )}
                                </span>
                                <span className="font-mono tabular-nums text-text-secondary truncate">
                                    {entry.plants.length === 0 ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        entry.plants.join(', ')
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-end gap-3 text-[10.5px] text-text-tertiary tabular-nums">
                <span>
                    Avg yd³/load:{' '}
                    <span className="font-mono text-text-secondary">{row.loads > 0 ? avgYardage.toFixed(1) : '—'}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    Share of bad loads
                    <div className="h-1.5 rounded-sm overflow-hidden bg-bg-tertiary w-16 inline-block">
                        <div
                            className="h-full rounded-sm"
                            style={{
                                background: accentColor,
                                width: `${maxLoads > 0 ? (row.loads / maxLoads) * 100 : 0}%`
                            }}
                        />
                    </div>
                </span>
            </div>
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

    /* Operator-modal state — when a dispatcher hits Comments / History on
     * a row we mount the same `CommentModalSection` / `HistoryViewSection`
     * pair the assets pages use, scoped to the operator's `employeeId`.
     * Stored as the full `{ employeeId, name }` object so the modal can
     * show the operator's display name without a roster re-lookup. */
    const [commentTarget, setCommentTarget] = useState(null)
    const [historyTarget, setHistoryTarget] = useState(null)
    const handleShowComments = useCallback((operator) => setCommentTarget(operator), [])
    const handleShowHistory = useCallback((operator) => setHistoryTarget(operator), [])

    /* When a single plant is filtered, dispatch wants to see who's actually
     * assigned to that plant vs. who only happened to load there. We split
     * `loadsByOperator` into three buckets — assigned, visiting (loaded
     * here but home-planted elsewhere), and unmatched (ticket name didn't
     * resolve to any operator record). The flat list is preserved when no
     * plant is filtered so the cross-fleet "Most loads overall" view still
     * works. */
    const operatorSegments = useMemo(() => {
        if (loadsByOperator.length === 0) return []
        const target = selectedPlant ? String(selectedPlant).trim() : ''
        if (!target) return [{ header: null, key: 'all', rows: loadsByOperator }]
        const assigned = []
        const visiting = []
        const unmatched = []
        for (const row of loadsByOperator) {
            if (row.unmatched) {
                unmatched.push(row)
                continue
            }
            if (row.homePlant && String(row.homePlant).trim() === target) {
                assigned.push(row)
            } else {
                visiting.push(row)
            }
        }
        const segments = []
        if (assigned.length > 0) {
            segments.push({
                header: {
                    count: assigned.length,
                    hint: `Home plant · ${target}`,
                    title: `Assigned to ${target}`
                },
                key: 'assigned',
                rows: assigned
            })
        }
        if (visiting.length > 0) {
            segments.push({
                header: {
                    count: visiting.length,
                    hint: 'Loaded here but assigned to another plant',
                    title: `Visiting · loaded at ${target}`
                },
                key: 'visiting',
                rows: visiting
            })
        }
        if (unmatched.length > 0) {
            segments.push({
                header: {
                    count: unmatched.length,
                    hint: 'Ticket name did not resolve to an operator record',
                    title: 'Unmatched'
                },
                key: 'unmatched',
                rows: unmatched
            })
        }
        return segments
    }, [loadsByOperator, selectedPlant])

    /* Print-friendly export. Opens a fresh window with a self-contained
     * HTML document (no app CSS) so the output works regardless of which
     * theme is active and survives the user clicking "Save as PDF" from
     * the print dialog. Segment headers carry through to the printout
     * when a plant is filtered, so the assigned-vs-visiting split is
     * preserved on paper. */
    const handlePrint = useCallback(() => {
        if (typeof window === 'undefined') return
        if (loadsByOperator.length === 0) return
        const win = window.open('', '_blank', 'width=900,height=700')
        if (!win) return
        const escapeHtml = (value) =>
            String(value ?? '').replace(
                /[&<>"']/g,
                (c) => ({ '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[c]
            )
        const rangeLabel = fmtRange(range.start, range.end)
        const headerTitle = selectedPlant
            ? `Operators · Plant ${selectedPlant} · ${rangeLabel}`
            : `Operators · All plants · ${rangeLabel}`
        const metaLine = `${fmtInt(totals.drivers)} operator${totals.drivers === 1 ? '' : 's'} · ${fmtInt(totals.loads)} load${totals.loads === 1 ? '' : 's'} · ${fmtYards(totals.yardage)} yd³${totals.mismatched > 0 ? ` · ${fmtInt(totals.mismatched)} mismatch${totals.mismatched === 1 ? '' : 'es'}` : ''}`
        const renderRow = (row, idxInSegment) => {
            const avgYardage = row.loads > 0 ? row.yardage / row.loads : 0
            const plantLoads = row.unmatched
                ? '—'
                : (row.plantLoads || [])
                      .map((pl) => `${escapeHtml(pl.plant)}&times;${pl.loads}`)
                      .join('&nbsp;&nbsp;') || '—'
            const trucks = (row.trucksDriven || []).join(', ') || '—'
            return `<tr>
                <td class="num">${idxInSegment + 1}</td>
                <td>${escapeHtml(row.name)}${row.driverNum ? `<br><span class="muted">#${escapeHtml(row.driverNum)}</span>` : ''}</td>
                <td>${escapeHtml(row.homePlant || '—')}</td>
                <td>${plantLoads}</td>
                <td>${escapeHtml(trucks)}</td>
                <td class="num">${fmtInt(row.loads)}</td>
                <td class="num">${row.loads > 0 ? avgYardage.toFixed(1) : '—'}</td>
                <td class="num">${fmtYards(row.yardage)}&nbsp;yd³</td>
            </tr>`
        }
        const bodyHtml = operatorSegments
            .map((segment) => {
                const headerHtml = segment.header
                    ? `<tr class="section-header">
                        <td colspan="8">
                            <span class="section-title">${escapeHtml(segment.header.title)}</span>
                            <span class="section-count">${fmtInt(segment.header.count)}</span>
                            <span class="section-hint">${escapeHtml(segment.header.hint)}</span>
                        </td>
                       </tr>`
                    : ''
                const rowsHtml = segment.rows.map(renderRow).join('')
                return headerHtml + rowsHtml
            })
            .join('')
        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(headerTitle)}</title>
<style>
    @page { size: letter portrait; margin: 0.5in; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #111827; margin: 0; padding: 0; }
    h1 { font-size: 16px; margin: 0 0 4px; font-weight: 700; }
    .meta { font-size: 11px; color: #6b7280; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #4b5563; border-bottom: 2px solid #d1d5db; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, 'SF Mono', Monaco, monospace; }
    tr.section-header td { background: #f9fafb; padding-top: 12px; padding-bottom: 6px; border-bottom: 1px solid #d1d5db; }
    .section-title { font-weight: 700; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; }
    .section-count { display: inline-block; background: #ffffff; border: 1px solid #d1d5db; border-radius: 2px; padding: 1px 6px; font-size: 10px; margin-left: 6px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .section-hint { font-weight: 400; text-transform: none; letter-spacing: 0; color: #6b7280; margin-left: 8px; font-size: 10px; }
    .muted { color: #6b7280; font-size: 10px; font-family: ui-monospace, monospace; }
    @media print {
        body { font-size: 10px; }
        thead { display: table-header-group; }
    }
</style>
</head>
<body>
    <h1>${escapeHtml(headerTitle)}</h1>
    <div class="meta">${metaLine}</div>
    <table>
        <thead>
            <tr>
                <th class="num">#</th>
                <th>Operator</th>
                <th>Assigned plant</th>
                <th>Loads by plant</th>
                <th>Trucks</th>
                <th class="num">Loads</th>
                <th class="num">Yds / load</th>
                <th class="num">Yardage</th>
            </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
    </table>
</body>
</html>`
        win.document.open()
        win.document.write(html)
        win.document.close()
        win.focus()
        // Defer print() so the document parses before the dialog opens.
        // Some browsers race here and the dialog renders against an empty
        // doc otherwise.
        setTimeout(() => {
            try {
                win.print()
            } catch {
                /* user can still print manually */
            }
        }, 250)
    }, [loadsByOperator, operatorSegments, range, selectedPlant, totals])

    if (loading && currentDays.length === 0) {
        return <div className="rounded animate-pulse bg-bg-secondary border border-border-light h-[320px]" />
    }
    if (!loading && currentDays.length === 0) {
        return (
            <Panel title="Operators Loads" innerClassName="p-0">
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
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {loading ? (
                        <RefreshingHint when />
                    ) : totals.drivers > 0 ? (
                        <span className="text-[11px] text-text-tertiary">
                            {fmtInt(totals.drivers)} operator{totals.drivers === 1 ? '' : 's'} · {fmtInt(totals.loads)}{' '}
                            load{totals.loads === 1 ? '' : 's'} · {fmtYards(totals.yardage)} yd³
                            {totals.mismatched > 0 && (
                                <>
                                    {' · '}
                                    <span className="font-semibold text-red-600">
                                        {fmtInt(totals.mismatched)} mismatch{totals.mismatched === 1 ? '' : 'es'}
                                    </span>
                                </>
                            )}
                        </span>
                    ) : null}
                    <button
                        className="inline-flex items-center gap-1.5 rounded bg-bg-secondary border border-border-light text-text-secondary text-[11px] font-semibold px-2 py-1 hover:bg-bg-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={loadsByOperator.length === 0 || loading}
                        onClick={handlePrint}
                        title="Print the operator list"
                        type="button"
                    >
                        <i className="fas fa-print text-[10px]" />
                        <span>Print</span>
                    </button>
                </div>
            }
        >
            {loadsByOperator.length === 0 ? (
                <EmptySection
                    icon="fa-id-badge"
                    loading={loading}
                    message={(() => {
                        if (loading) return 'Loading tickets…'
                        if (selectedPlant) {
                            return `No operators loaded at plant ${selectedPlant} in ${fmtRange(range.start, range.end)}.`
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
                    {operatorSegments.map((segment) => (
                        <React.Fragment key={segment.key}>
                            {segment.header && (
                                <OperatorSegmentHeader
                                    count={segment.header.count}
                                    hint={segment.header.hint}
                                    title={segment.header.title}
                                />
                            )}
                            {segment.rows.map((row, idxInSegment) => {
                                const avgYardage = row.loads > 0 ? row.yardage / row.loads : 0
                                const statusLabel =
                                    row.operatorStatus && row.operatorStatus !== 'Active' ? row.operatorStatus : null
                                if (row.unmatched) {
                                    return (
                                        <UnmatchedDriversRow
                                            key={row.key}
                                            accentColor={accentColor}
                                            avgYardage={avgYardage}
                                            isFirst={idxInSegment === 0}
                                            maxLoads={maxLoads}
                                            row={row}
                                        />
                                    )
                                }
                                return (
                                    <div
                                        key={row.key}
                                        className="grid grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_4.5rem_4.5rem_5rem] gap-3 items-center px-3 py-2 text-[12.5px]"
                                        style={{
                                            borderTop: idxInSegment === 0 ? 'none' : '1px solid var(--border-light)'
                                        }}
                                    >
                                        <span className="font-mono tabular-nums text-right text-text-tertiary">
                                            {idxInSegment + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-text-primary">{row.name}</div>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                {row.driverNum && (
                                                    <span
                                                        className="font-mono tabular-nums text-[10.5px] text-text-tertiary"
                                                        title="Dispatch operator number (smyrna_id)"
                                                    >
                                                        #{row.driverNum}
                                                    </span>
                                                )}
                                                {statusLabel && (
                                                    <span
                                                        className="inline-flex items-center rounded px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                                                        style={{
                                                            background: 'rgba(220, 38, 38, 0.12)',
                                                            color: '#b91c1c'
                                                        }}
                                                        title={`Operator status: ${statusLabel}`}
                                                    >
                                                        {statusLabel}
                                                    </span>
                                                )}
                                            </div>
                                            {row.employeeId && (
                                                <OperatorActionButtons
                                                    operator={{ employeeId: row.employeeId, name: row.name }}
                                                    onComments={handleShowComments}
                                                    onHistory={handleShowHistory}
                                                />
                                            )}
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
                                            {fmtYards(row.yardage)} yd³
                                        </span>
                                    </div>
                                )
                            })}
                        </React.Fragment>
                    ))}
                </div>
            )}
            {commentTarget && (
                <CommentModalSection
                    itemId={commentTarget.employeeId}
                    itemNumber={commentTarget.name}
                    itemType="Operator"
                    onClose={() => setCommentTarget(null)}
                    service={OperatorService}
                />
            )}
            {historyTarget && (
                <HistoryViewSection item={historyTarget} onClose={() => setHistoryTarget(null)} type="operator" />
            )}
        </Panel>
    )
}

/**
 * Section divider between groups on the Operators page when the plant
 * filter is active. Matches the dense `Stat`-style header rhythm used
 * elsewhere — uppercase title + count chip + muted hint — so the
 * grouping reads as part of the table, not a separate region.
 */
function OperatorSegmentHeader({ count, hint, title }) {
    return (
        <div className="flex items-baseline gap-2.5 px-3 py-2 bg-bg-tertiary border-y border-border-light">
            <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-text-secondary">{title}</span>
            <span className="rounded-sm bg-bg-primary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-text-secondary border border-border-light">
                {fmtInt(count)}
            </span>
            {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
        </div>
    )
}

/**
 * Comments + History action chips that sit under an operator's name in
 * the Statistics → Operators row. Mirrors the pattern on `AssetListRow`'s
 * operator column (used by MixersView, TractorsView, …) so the same
 * affordance is available wherever an operator is rendered. Clicks bubble
 * up the operator object to the parent, which owns the modal state.
 */
function OperatorActionButtons({ onComments, onHistory, operator }) {
    if (!operator?.employeeId) return null
    return (
        <div className="flex items-center gap-1 mt-1">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onComments?.(operator)
                }}
                title="Operator comments"
                className="inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0.5 cursor-pointer transition-colors hover:brightness-95 bg-bg-secondary border border-border-light text-text-secondary"
            >
                <i className="fas fa-comment text-[8px]" />
                <span>Comments</span>
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onHistory?.(operator)
                }}
                title="Operator history"
                className="inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0.5 cursor-pointer transition-colors hover:brightness-95 bg-bg-secondary border border-border-light text-text-secondary"
            >
                <i className="fas fa-history text-[8px]" />
                <span>History</span>
            </button>
        </div>
    )
}
