/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat, fmtInt, fmtPct, fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { DayforceFilters } from './DayforceFilters'

const HOURS_SORT_IDS = ['hours', 'name', 'varianceDesc', 'ot']

const colorForVariance = (pct) => {
    if (pct == null || Number.isNaN(pct)) return 'var(--text-tertiary)'
    if (pct >= 5) return '#b91c1c' // worked materially more than scheduled
    if (pct >= 1) return '#b45309'
    if (pct <= -5) return '#1d4ed8' // worked materially less
    return '#15803d'
}

const fmtHours = (n) => `${fmtFloat(n, 1)}h`

/** Shared first-load skeleton — three stacked placeholder rectangles
 *  matching the rhythm of every other Plan stats sub-page. */
function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {[120, 56, 320, 220].map((h, i) => (
                <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
            ))}
        </div>
    )
}

/** Side-by-side bar showing scheduled vs actual hours for an operator. */
function OperatorHoursRow({ accent, row }) {
    const maxHours = Math.max(row.scheduledHours, row.actualHours, 1)
    const schedPct = (row.scheduledHours / maxHours) * 100
    const actualPct = (row.actualHours / maxHours) * 100
    const variancePct =
        row.scheduledHours > 0 ? ((row.actualHours - row.scheduledHours) / row.scheduledHours) * 100 : null
    const varianceColor = colorForVariance(variancePct)
    return (
        <div className="flex flex-col gap-1 px-3 py-2 border-t border-border-light first:border-t-0 hover:bg-bg-secondary transition-colors">
            <div className="flex items-center gap-2 text-[12px]">
                <span className="font-mono tabular-nums w-14 shrink-0 text-text-tertiary">{row.badge || '—'}</span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate text-text-primary font-semibold">{row.name}</span>
                    {row.position && (
                        <span className="text-[11px] text-text-tertiary truncate hidden sm:inline">
                            · {row.position}
                        </span>
                    )}
                    {row.plantCode && (
                        <span className="font-mono tabular-nums text-[11px] text-text-tertiary hidden md:inline">
                            · {row.plantCode}
                        </span>
                    )}
                </div>
                <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-secondary">
                    {fmtHours(row.scheduledHours)}
                </span>
                <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-primary font-semibold">
                    {fmtHours(row.actualHours)}
                </span>
                <span
                    className="font-mono tabular-nums w-16 text-right shrink-0 font-semibold"
                    style={{ color: varianceColor }}
                >
                    {variancePct == null ? '—' : `${variancePct > 0 ? '+' : ''}${fmtPct(variancePct)}`}
                </span>
            </div>
            <div className="flex flex-col gap-0.5 pl-16">
                <div className="h-1.5 rounded-sm overflow-hidden bg-bg-tertiary">
                    <div className="h-full" style={{ background: 'var(--text-tertiary)', width: `${schedPct}%` }} />
                </div>
                <div className="h-1.5 rounded-sm overflow-hidden bg-bg-tertiary">
                    <div className="h-full" style={{ background: accent, width: `${actualPct}%` }} />
                </div>
            </div>
        </div>
    )
}

/**
 * Hours sub-page for the Operations > Statistics tab. Mirrors the Pay
 * grid you'd see in Dayforce (scheduled vs actual + variance) but
 * filtered to mixer + tractor operators only — non-operator roles
 * (plant managers, office, etc.) are excluded at the hook layer so the
 * totals are payroll-comparable.
 *
 * Visual conventions match the other Plan stats sub-pages (Production,
 * Service, etc.): Panel-wrapped StatGroup, shared EmptySection +
 * RefreshingHint, loading skeleton on first load.
 */
export function DayforceHoursPage({ accentColor, dateRange, plantCodes, selectedPlant }) {
    const accent = accentColor || '#1e3a5f'
    const dayforceMetrics = useDayforceOperatorMetrics({ dateRange, plantCodes, selectedPlant })
    const { diagnostics, excluded, hasSyncedData, isLoading, perOperator, perPlant, perWeek, totals } = dayforceMetrics
    const filters = useDayforceOperatorFilters({ defaultSort: 'hours', rows: perOperator })

    // Hard first-load: nothing in shifts cache yet. Show the standard
    // skeleton instead of a stack of "no data" panels.
    if (isLoading && diagnostics.shiftsLoaded === 0) return <LoadingSkeleton />

    // Load error — same red-callout treatment used by other failing
    // sub-pages, but rendered inside a Panel so it lives in the layout
    // grid instead of floating loose.
    if (diagnostics.loadError) {
        return (
            <Panel title="Couldn't load Dayforce data" innerClassName="p-3">
                <div className="flex items-start gap-3 text-[12.5px]">
                    <i className="fas fa-circle-exclamation text-[14px] mt-0.5" style={{ color: '#b91c1c' }} />
                    <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-semibold text-text-primary">Query error</span>
                        <span className="text-text-secondary font-mono break-all">{diagnostics.loadError}</span>
                    </div>
                </div>
            </Panel>
        )
    }

    // No data synced yet — single Panel with EmptySection, same as the
    // Production page's empty state.
    if (!hasSyncedData) {
        return (
            <Panel title="Hours" innerClassName="p-0">
                <EmptySection
                    icon="fa-cloud-arrow-down"
                    message="No Dayforce timesheet data has been imported yet. Hours appear here after the dayforce-bridge userscript completes its first cycle."
                />
            </Panel>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Hours summary"
                right={
                    isLoading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {fmtRange(dateRange?.start, dateRange?.end)}
                        </span>
                    )
                }
                innerClassName="p-3"
            >
                <StatGroup columns={6}>
                    <Stat label="Scheduled hours" value={fmtHours(totals.scheduledHours)} />
                    <Stat label="Actual hours" value={fmtHours(totals.totalActualHours)} />
                    <Stat
                        label="Variance"
                        value={`${totals.varianceHours > 0 ? '+' : ''}${fmtFloat(totals.varianceHours, 1)}h`}
                        hint={
                            totals.scheduledHours > 0
                                ? `${totals.variancePct > 0 ? '+' : ''}${fmtPct(totals.variancePct)} vs schedule`
                                : null
                        }
                        valueColor={colorForVariance(totals.variancePct)}
                    />
                    <Stat label="Operators" value={fmtInt(totals.operatorCount)} />
                    <Stat
                        label="Exceptions"
                        value={fmtInt(totals.exceptionsCount)}
                        hint={`${totals.exceptionEmployees} operator(s)`}
                    />
                    <Stat label="PTO hours" value={fmtHours(totals.ptoHours)} />
                </StatGroup>
            </Panel>

            <DayforceFilters
                accent={accent}
                availablePositions={filters.availablePositions}
                controls={filters.controls}
                excluded={excluded}
                onReset={filters.reset}
                setPosition={filters.setPosition}
                setSearch={filters.setSearch}
                setSort={filters.setSort}
                sortIds={HOURS_SORT_IDS}
                visibleCount={filters.filtered.length}
            />

            <Panel
                title="Per-operator hours"
                innerClassName="p-0"
                right={
                    isLoading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {filters.filtered.length} of {perOperator.length} shown
                        </span>
                    )
                }
            >
                {filters.filtered.length === 0 ? (
                    <EmptySection
                        icon="fa-filter-circle-xmark"
                        message="No operators match these filters. Try widening the date range or clearing the search / role filters."
                    />
                ) : (
                    <div>
                        <div className="flex items-center gap-2 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-light bg-bg-secondary">
                            <span className="w-14 shrink-0">Badge</span>
                            <span className="flex-1">Operator</span>
                            <span className="w-16 text-right shrink-0">Sched</span>
                            <span className="w-16 text-right shrink-0">Actual</span>
                            <span className="w-16 text-right shrink-0">Var</span>
                        </div>
                        {filters.filtered.map((row) => (
                            <OperatorHoursRow key={row.dayforceEmployeeId} accent={accent} row={row} />
                        ))}
                    </div>
                )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Per-plant rollup" innerClassName="p-3" right={isLoading ? <RefreshingHint when /> : null}>
                    {perPlant.length === 0 ? (
                        <EmptySection icon="fa-industry" message="No plant-attributed hours in this window." />
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {perPlant.map((row) => {
                                const max = perPlant[0]?.actualHours || 0
                                const pct = max > 0 ? (row.actualHours / max) * 100 : 0
                                return (
                                    <div key={row.code} className="flex items-center gap-2 text-[12px]">
                                        <span className="font-mono tabular-nums w-14 shrink-0 text-text-primary">
                                            {row.code}
                                        </span>
                                        <span className="flex-1 min-w-0 truncate text-text-secondary">{row.name}</span>
                                        <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary w-28">
                                            <div className="h-full" style={{ background: accent, width: `${pct}%` }} />
                                        </div>
                                        <span className="font-mono tabular-nums font-semibold w-16 text-right shrink-0 text-text-primary">
                                            {fmtHours(row.actualHours)}
                                        </span>
                                        <span className="font-mono tabular-nums w-12 text-right shrink-0 text-text-tertiary">
                                            {row.operatorCount}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Panel>

                <Panel title="Weekly trend" innerClassName="p-3" right={isLoading ? <RefreshingHint when /> : null}>
                    {perWeek.length === 0 ? (
                        <EmptySection icon="fa-chart-line" message="No weekly data in this window." />
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {perWeek.map((row) => {
                                const max = Math.max(...perWeek.map((r) => r.actualHours), 1)
                                const pct = (row.actualHours / max) * 100
                                return (
                                    <div key={row.week} className="flex items-center gap-2 text-[12px]">
                                        <span className="font-mono tabular-nums w-20 shrink-0 text-text-primary">
                                            {row.week}
                                        </span>
                                        <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary flex-1">
                                            <div className="h-full" style={{ background: accent, width: `${pct}%` }} />
                                        </div>
                                        <span className="font-mono tabular-nums font-semibold w-16 text-right shrink-0 text-text-primary">
                                            {fmtHours(row.actualHours)}
                                        </span>
                                        <span className="font-mono tabular-nums w-12 text-right shrink-0 text-text-tertiary">
                                            {row.operatorCount}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    )
}

export default DayforceHoursPage
