/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat, fmtInt, fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { DayforceFilters } from './DayforceFilters'

const COST_SORT_IDS = ['cost', 'ot', 'hours', 'name']

const USD = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })
const USD_CENTS = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 2, style: 'currency' })

const fmtMoney = (n) => USD.format(Number(n) || 0)
const fmtHours = (n) => `${fmtFloat(n, 1)}h`

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {[120, 56, 320, 220].map((h, i) => (
                <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
            ))}
        </div>
    )
}

function OperatorCostRow({ row }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] border-t border-border-light first:border-t-0 hover:bg-bg-secondary transition-colors">
            <span className="font-mono tabular-nums w-14 shrink-0 text-text-tertiary">{row.badge || '—'}</span>
            <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="truncate text-text-primary font-semibold">{row.name}</span>
                {row.position && (
                    <span className="text-[11px] text-text-tertiary truncate hidden sm:inline">· {row.position}</span>
                )}
                {row.plantCode && (
                    <span className="font-mono tabular-nums text-[11px] text-text-tertiary hidden md:inline">
                        · {row.plantCode}
                    </span>
                )}
            </div>
            <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-secondary">
                {fmtHours(row.regHours)}
            </span>
            <span
                className="font-mono tabular-nums w-16 text-right shrink-0 font-semibold"
                style={{ color: row.otHours > 0 ? '#b45309' : 'var(--text-tertiary)' }}
            >
                {row.otHours > 0 ? fmtHours(row.otHours) : '—'}
            </span>
            <span className="font-mono tabular-nums w-20 text-right shrink-0 text-text-tertiary">
                {row.hourlyRate ? USD_CENTS.format(row.hourlyRate) : '—'}
            </span>
            <span className="font-mono tabular-nums w-24 text-right shrink-0 text-text-primary font-semibold">
                {fmtMoney(row.totalCost)}
            </span>
        </div>
    )
}

/**
 * Labor Cost sub-page for the Operations > Statistics tab. Dayforce
 * hourly rate × actual hours, OT split at the weekly 40-hour threshold
 * (1.5× multiplier). Filtered to mixer + tractor operators only at the
 * hook layer so non-operator payroll never bleeds into the rollups.
 *
 * Visual conventions match the other Plan stats sub-pages.
 */
export function DayforceLaborCostPage({ accentColor, dateRange, plantCodes, selectedPlant }) {
    const accent = accentColor || '#1e3a5f'
    const dayforceMetrics = useDayforceOperatorMetrics({ dateRange, plantCodes, selectedPlant })
    const { diagnostics, excluded, hasSyncedData, isLoading, perOperator, perPlant, perWeek, totals } = dayforceMetrics
    const filters = useDayforceOperatorFilters({ defaultSort: 'cost', rows: perOperator })

    if (isLoading && diagnostics.shiftsLoaded === 0) return <LoadingSkeleton />

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

    if (!hasSyncedData) {
        return (
            <Panel title="Labor Cost" innerClassName="p-0">
                <EmptySection
                    icon="fa-cloud-arrow-down"
                    message="No Dayforce timesheet data has been imported yet. Labor cost appears here after the dayforce-bridge userscript completes its first cycle."
                />
            </Panel>
        )
    }

    const otShare = totals.totalCost > 0 ? (totals.otCost / totals.totalCost) * 100 : 0

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Labor cost summary"
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
                    <Stat label="Total labor cost" value={fmtMoney(totals.totalCost)} />
                    <Stat
                        label="Regular cost"
                        value={fmtMoney(totals.regCost)}
                        hint={`${fmtHours(totals.regHours)} worked`}
                    />
                    <Stat
                        label="OT cost"
                        value={fmtMoney(totals.otCost)}
                        hint={`${fmtHours(totals.otHours)} · ${fmtFloat(otShare, 1)}% of total`}
                        valueColor={totals.otCost > 0 ? '#b45309' : undefined}
                    />
                    <Stat
                        label="Avg blended rate"
                        value={totals.avgHourlyRate ? USD_CENTS.format(totals.avgHourlyRate) : '—'}
                        hint="cost ÷ actual hours"
                    />
                    <Stat label="Operators" value={fmtInt(totals.operatorCount)} />
                    <Stat
                        label="Cost / operator"
                        value={totals.operatorCount > 0 ? fmtMoney(totals.totalCost / totals.operatorCount) : '—'}
                    />
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
                sortIds={COST_SORT_IDS}
                visibleCount={filters.filtered.length}
            />

            <Panel
                title="Per-operator labor cost"
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
                            <span className="w-16 text-right shrink-0">Reg</span>
                            <span className="w-16 text-right shrink-0">OT</span>
                            <span className="w-20 text-right shrink-0">Rate</span>
                            <span className="w-24 text-right shrink-0">Cost</span>
                        </div>
                        {filters.filtered.map((row) => (
                            <OperatorCostRow key={row.dayforceEmployeeId} row={row} />
                        ))}
                    </div>
                )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Per-plant cost" innerClassName="p-3" right={isLoading ? <RefreshingHint when /> : null}>
                    {perPlant.length === 0 ? (
                        <EmptySection icon="fa-industry" message="No plant-attributed cost in this window." />
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {perPlant.map((row) => {
                                const max = perPlant[0]?.cost || 0
                                const pct = max > 0 ? (row.cost / max) * 100 : 0
                                return (
                                    <div key={row.code} className="flex items-center gap-2 text-[12px]">
                                        <span className="font-mono tabular-nums w-14 shrink-0 text-text-primary">
                                            {row.code}
                                        </span>
                                        <span className="flex-1 min-w-0 truncate text-text-secondary">{row.name}</span>
                                        <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary w-28">
                                            <div className="h-full" style={{ background: accent, width: `${pct}%` }} />
                                        </div>
                                        <span className="font-mono tabular-nums font-semibold w-24 text-right shrink-0 text-text-primary">
                                            {fmtMoney(row.cost)}
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

                <Panel
                    title="Weekly cost trend"
                    innerClassName="p-3"
                    right={isLoading ? <RefreshingHint when /> : null}
                >
                    {perWeek.length === 0 ? (
                        <EmptySection icon="fa-chart-line" message="No weekly data in this window." />
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {perWeek.map((row) => {
                                const max = Math.max(...perWeek.map((r) => r.cost), 1)
                                const pct = (row.cost / max) * 100
                                return (
                                    <div key={row.week} className="flex items-center gap-2 text-[12px]">
                                        <span className="font-mono tabular-nums w-20 shrink-0 text-text-primary">
                                            {row.week}
                                        </span>
                                        <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary flex-1">
                                            <div className="h-full" style={{ background: accent, width: `${pct}%` }} />
                                        </div>
                                        <span className="font-mono tabular-nums font-semibold w-24 text-right shrink-0 text-text-primary">
                                            {fmtMoney(row.cost)}
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

export default DayforceLaborCostPage
