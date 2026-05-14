/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtFloat, fmtInt, fmtRange } from '../../../../../utils/PlanStatisticsFormatUtility'
import {
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
    plantBadgeColor
} from '../../../../../utils/PlanUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { ByPlantChart, DayOfWeekChart, TrendChart } from './PlanStatisticsCharts'
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
 * Plant yardage hero — by-plant chart with consistent header text. Shared
 * between Yardage + Plants. The page passes its own loading/empty state.
 * ────────────────────────────────────────────────────────────────────────── */

function PlantYardageHero({ accentColor, knownPlantRows, knownPlantSummary, loading, plantNameByCode, selectedPlant }) {
    const heroTitle = selectedPlant
        ? `Yardage · ${plantNameByCode?.[selectedPlant] ? `${selectedPlant} · ${plantNameByCode[selectedPlant]}` : selectedPlant}`
        : 'Yardage by plant'
    return (
        <Panel
            title={heroTitle}
            innerClassName="p-3"
            right={
                loading ? (
                    <RefreshingHint when />
                ) : (
                    <span className="text-[11px] text-text-tertiary">
                        {knownPlantSummary.activeCount} plant
                        {knownPlantSummary.activeCount === 1 ? '' : 's'} · {fmtInt(knownPlantSummary.totalYardage)} yd³
                        total
                    </span>
                )
            }
        >
            {knownPlantRows.length === 0 ? (
                <EmptySection
                    icon="fa-chart-column"
                    loading={loading}
                    message={loading ? 'Loading plant production…' : 'No plant production in this window yet.'}
                />
            ) : (
                <ByPlantChart accent={accentColor} plantNameByCode={plantNameByCode} rows={knownPlantRows} />
            )}
        </Panel>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * NEW Overview — distilled best-of from every sub-page. Layout:
 *
 *   1. Daily yardage trend (the single most-asked-for chart on the page)
 *   2. Two-up: Top plants (5) | Customer satisfaction summary
 *   3. Two-up: Top customers (5) | Top products (5)
 *   4. Two-up: Plants snapshot (count + leader/laggard) | Big pours preview
 *   5. Period comparison (only when comparison is on)
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

/** Shared row layout for Overview's mini-lists (top plants, top customers,
 *  top products). Renders rank + label + bar gauge + value, hairline-
 *  separated rows, the same way the worst-orders list reads. */
function MiniRankedList({ accent, items, labelKey, max, primaryFmt, secondaryFmt, valueLabel }) {
    if (!items.length) return null
    return (
        <div className="flex flex-col">
            {items.map((item, idx) => {
                const value = item.yardage || 0
                const pct = max > 0 ? (value / max) * 100 : 0
                return (
                    <div
                        key={item[labelKey] || idx}
                        className="grid grid-cols-[20px_1fr_80px_auto] gap-2 items-center px-3 py-2 text-[12px]"
                        style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)' }}
                    >
                        <span className="font-mono tabular-nums text-right text-text-tertiary">{idx + 1}</span>
                        <span className="truncate text-text-primary">{item[labelKey]}</span>
                        <div className="h-1.5 rounded-full overflow-hidden bg-bg-tertiary">
                            <div className="h-full" style={{ background: accent, width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <div className="text-right shrink-0 flex items-baseline gap-1.5">
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {primaryFmt ? primaryFmt(item) : fmtInt(value)}
                            </span>
                            {valueLabel && <span className="text-[10px] text-text-tertiary">{valueLabel}</span>}
                            {secondaryFmt && (
                                <span className="text-[10px] text-text-tertiary">{secondaryFmt(item)}</span>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
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

/** Plants snapshot on the Overview — just the count + leader / laggard +
 *  a "View details" link to the full Plants page. */
function PlantsSnapshot({ accent, knownPlantRows, knownPlantSummary, loading, onSelect, plantNameByCode }) {
    const sorted = useMemo(() => [...knownPlantRows].sort((a, b) => b.yardage - a.yardage), [knownPlantRows])
    const top = sorted[0]
    const bottom = sorted.length > 1 ? sorted[sorted.length - 1] : null
    return (
        <Panel
            title="Plants snapshot"
            innerClassName="p-0"
            right={loading ? <RefreshingHint when /> : <ViewDetails onSelect={onSelect} section="plants" />}
        >
            {sorted.length === 0 ? (
                <EmptySection
                    loading={loading}
                    message={loading ? 'Loading plants…' : 'No plant production in this window.'}
                />
            ) : (
                <StatGroup columns={3}>
                    <Stat
                        label="Active plants"
                        value={fmtInt(knownPlantSummary.activeCount)}
                        hint={
                            knownPlantSummary.topShare
                                ? `top: ${knownPlantSummary.topShare.code} (${(knownPlantSummary.topShare.share * 100).toFixed(0)}%)`
                                : '—'
                        }
                    />
                    {top && (
                        <Stat
                            label="Leader"
                            value={top.code}
                            hint={`${fmtInt(top.yardage)} yd³${plantNameByCode?.[top.code] ? ` · ${plantNameByCode[top.code]}` : ''}`}
                            valueColor={plantBadgeColor(top.code, accent)}
                        />
                    )}
                    {bottom ? (
                        <Stat
                            label="Lowest"
                            value={bottom.code}
                            hint={`${fmtInt(bottom.yardage)} yd³${plantNameByCode?.[bottom.code] ? ` · ${plantNameByCode[bottom.code]}` : ''}`}
                            valueColor={plantBadgeColor(bottom.code, accent)}
                        />
                    ) : (
                        <Stat label="Lowest" value="—" hint="only one active plant" />
                    )}
                </StatGroup>
            )}
        </Panel>
    )
}

/** Big pours preview — top 3 by yardage with date / plant / yardage. */
function BigPoursPreview({ accent, currentSummary, loading, onSelect, plantNameByCode }) {
    const top = useMemo(
        () => [...currentSummary.bigPours].sort((a, b) => b.yardage - a.yardage).slice(0, 3),
        [currentSummary.bigPours]
    )
    return (
        <Panel
            title="Big pours to coordinate"
            innerClassName="p-0"
            right={
                loading ? (
                    <RefreshingHint when />
                ) : (
                    <ViewDetails
                        onSelect={onSelect}
                        section="bigPours"
                        label={`${currentSummary.bigPours.length} total`}
                    />
                )
            }
        >
            {top.length === 0 ? (
                <EmptySection
                    icon="fa-circle-check"
                    loading={loading}
                    message={loading ? 'Looking for big pours…' : 'No big pours scheduled in this window.'}
                />
            ) : (
                <div className="flex flex-col">
                    {top.map((pour, idx) => (
                        <div
                            key={`${pour.planDate}-${pour.plantCode}-${pour.orderNum || idx}`}
                            className="flex items-center gap-3 px-3 py-2 text-[12px]"
                            style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)' }}
                        >
                            <span
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ background: plantBadgeColor(pour.plantCode, accent) }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate text-text-primary">{pour.customer}</div>
                                <div className="text-[11px] text-text-secondary">
                                    <span className="font-mono tabular-nums">{pour.plantCode}</span>
                                    {plantNameByCode?.[pour.plantCode] && <> · {plantNameByCode[pour.plantCode]}</>}
                                    {' · '}
                                    {pour.planDate}
                                </div>
                            </div>
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {fmtInt(pour.yardage)} yd³
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    )
}

/** Overview page — a launchpad summarizing every other section. */
export function PlanStatisticsOverviewPage({
    accentColor,
    comparison,
    currentDays,
    currentSummary,
    knownPlantRows,
    knownPlantSummary,
    loading,
    onSelectSection,
    plantNameByCode,
    previousSummary,
    range,
    satisfactionAggregate,
    satisfactionLoading,
    topCustomers,
    topProducts,
    trendComparison,
    trendData
}) {
    const accent = accentColor || '#1e3a5f'
    const topPlants = useMemo(
        () => [...knownPlantRows].sort((a, b) => b.yardage - a.yardage).slice(0, 5),
        [knownPlantRows]
    )
    const maxPlantYardage = topPlants[0]?.yardage || 0
    const maxCustomerYardage = topCustomers[0]?.yardage || 0
    const maxProductYardage = topProducts[0]?.yardage || 0
    const isEmpty = isEmptyAfterLoad(loading, currentDays)

    if (loading && currentDays.length === 0) {
        // Cold-start skeleton matches the Overview layout so the swap is invisible.
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[260, 220, 180, 180].map((h, i) => (
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

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Daily yardage"
                innerClassName="p-3"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : trendComparison ? (
                        <span className="text-[11px] text-text-tertiary">
                            Dotted = {comparison === 'lastYear' ? 'last year' : 'previous period'}
                        </span>
                    ) : (
                        <ViewDetails onSelect={onSelectSection} section="yardage" />
                    )
                }
            >
                {trendData.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading daily trend…' : 'No daily yardage data yet.'}
                    />
                ) : (
                    <TrendChart accent={accent} data={trendData} comparisonData={trendComparison} />
                )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel
                    title="Top plants"
                    innerClassName="p-0"
                    right={
                        loading ? <RefreshingHint when /> : <ViewDetails onSelect={onSelectSection} section="plants" />
                    }
                >
                    {topPlants.length === 0 ? (
                        <EmptySection
                            loading={loading}
                            message={loading ? 'Loading plant production…' : 'No plant production in this window.'}
                        />
                    ) : (
                        <MiniRankedList
                            accent={accent}
                            items={topPlants.map((p) => ({
                                ...p,
                                label: plantNameByCode?.[p.code] ? `${p.code} · ${plantNameByCode[p.code]}` : p.code
                            }))}
                            labelKey="label"
                            max={maxPlantYardage}
                            primaryFmt={(item) => fmtInt(item.yardage)}
                            valueLabel="yd³"
                        />
                    )}
                </Panel>
                <SatisfactionSummary
                    aggregate={satisfactionAggregate}
                    loading={satisfactionLoading || loading}
                    onSelect={onSelectSection}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel
                    title="Top customers"
                    innerClassName="p-0"
                    right={
                        loading ? (
                            <RefreshingHint when />
                        ) : (
                            <ViewDetails onSelect={onSelectSection} section="customers" />
                        )
                    }
                >
                    {topCustomers.length === 0 ? (
                        <EmptySection
                            loading={loading}
                            message={loading ? 'Loading customer mix…' : 'No customer data in this window.'}
                        />
                    ) : (
                        <MiniRankedList
                            accent={accent}
                            items={topCustomers.slice(0, 5)}
                            labelKey="customer"
                            max={maxCustomerYardage}
                            primaryFmt={(item) => fmtInt(item.yardage)}
                            valueLabel="yd³"
                        />
                    )}
                </Panel>
                <Panel
                    title="Top products"
                    innerClassName="p-0"
                    right={
                        loading ? (
                            <RefreshingHint when />
                        ) : (
                            <ViewDetails onSelect={onSelectSection} section="customers" label="View mix" />
                        )
                    }
                >
                    {topProducts.length === 0 ? (
                        <EmptySection
                            loading={loading}
                            message={loading ? 'Loading product mix…' : 'No product data in this window.'}
                        />
                    ) : (
                        <MiniRankedList
                            accent={accent}
                            items={topProducts.slice(0, 5)}
                            labelKey="product"
                            max={maxProductYardage}
                            primaryFmt={(item) => `${fmtInt(item.loads)} loads`}
                        />
                    )}
                </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PlantsSnapshot
                    accent={accent}
                    knownPlantRows={knownPlantRows}
                    knownPlantSummary={knownPlantSummary}
                    loading={loading}
                    onSelect={onSelectSection}
                    plantNameByCode={plantNameByCode}
                />
                <BigPoursPreview
                    accent={accent}
                    currentSummary={currentSummary}
                    loading={loading}
                    onSelect={onSelectSection}
                    plantNameByCode={plantNameByCode}
                />
            </div>

            {previousSummary && <ComparisonPanel currentSummary={currentSummary} previousSummary={previousSummary} />}
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Yardage sub-page — daily trend, by-plant chart, day-of-week. Now respects
 * loading + empty states so a refresh doesn't blank the page.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsYardagePage({
    accentColor,
    comparison,
    currentDays,
    knownPlantRows,
    knownPlantSummary,
    loading,
    plantNameByCode,
    range,
    selectedPlant,
    trendComparison,
    trendData
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[260, 240, 200].map((h, i) => (
                    <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
                ))}
            </div>
        )
    }
    if (isEmpty) {
        return (
            <Panel title="Yardage" innerClassName="p-0">
                <EmptySection
                    icon="fa-chart-line"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            <PlantYardageHero
                accentColor={accentColor}
                knownPlantRows={knownPlantRows}
                knownPlantSummary={knownPlantSummary}
                loading={loading}
                plantNameByCode={plantNameByCode}
                selectedPlant={selectedPlant}
            />
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
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Plants sub-page — scorecards + by-plant chart + comparison. Now passes
 * loading flags through.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsPlantsPage({
    accentColor,
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
    selectedPlant
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[260, 280, 200].map((h, i) => (
                    <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
                ))}
            </div>
        )
    }
    if (isEmpty) {
        return (
            <Panel title="Plants" innerClassName="p-0">
                <EmptySection
                    icon="fa-industry"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            <PlantYardageHero
                accentColor={accentColor}
                knownPlantRows={knownPlantRows}
                knownPlantSummary={knownPlantSummary}
                loading={loading}
                plantNameByCode={plantNameByCode}
                selectedPlant={selectedPlant}
            />
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
