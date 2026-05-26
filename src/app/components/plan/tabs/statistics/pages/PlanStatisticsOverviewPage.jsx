/* eslint-disable react/forbid-dom-props */
import React from 'react'

import {
    fmtFloat,
    fmtInt,
    fmtRange,
    fmtYards,
    parseIsoLocal
} from '../../../../../../utils/PlanStatisticsFormatUtility'
import { Panel } from '../../../../ui/Panel'
import { EmptySection, isEmptyAfterLoad, RefreshingHint } from './planStatsShared'

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
            className="text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
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
            right={loading ? <RefreshingHint when /> : <ViewDetails onSelect={onSelect} section="service" />}
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
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
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
function LaunchpadTile({ hint, icon, label, onSelect, section, value }) {
    return (
        <button
            type="button"
            onClick={() => onSelect?.(section)}
            className="flex flex-col gap-1 items-start rounded-lg border bg-bg-secondary border-border-light cursor-pointer p-3 text-left hover:border-current active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
            style={{ color: 'var(--text-secondary)' }}
        >
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                <i className={`fas ${icon} text-[11px] text-text-primary`} />
                {label}
            </span>
            <span className="font-mono tabular-nums font-bold leading-none text-text-primary" style={{ fontSize: 22 }}>
                {value}
            </span>
            {hint && <span className="text-[10.5px] text-text-tertiary">{hint}</span>}
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-text-primary">
                Open
                <i className="fas fa-arrow-right text-[9px]" />
            </span>
        </button>
    )
}

/** One row inside the Period-highlights / Watchlist cards. Big label, big
 *  value, optional hint underneath. Mirrors the at-a-glance density of the
 *  dashboard "Stat" components without forcing a column grid. */
function HighlightRow({ icon, label, hint, value }) {
    return (
        <div className="flex items-start gap-3 px-3 py-2.5 border-t border-border-light first:border-t-0">
            <i className={`fas ${icon} text-[11px] mt-1 w-4 text-center text-text-tertiary`} />
            <div className="flex-1 min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">{label}</div>
                <div className="font-semibold truncate text-text-primary" style={{ fontSize: 13.5 }}>
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
                        icon="fa-industry"
                        label="Production"
                        section="production"
                        value={`${activeCount} plant${activeCount === 1 ? '' : 's'}`}
                        hint="Scorecards · trend · weekday"
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        icon="fa-thumbs-up"
                        label="Service"
                        section="service"
                        value={goodPct != null ? `${goodPct}%` : '—'}
                        hint={
                            satisfactionAggregate
                                ? `${fmtInt(badServiceCount)} bad${badServiceCount === 1 ? '' : 's'} flagged`
                                : 'No scored tickets yet'
                        }
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        icon="fa-id-badge"
                        label="Operators"
                        section="operators"
                        value={fmtInt(currentSummary.totalLoads || 0)}
                        hint="Loads per operator"
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
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
