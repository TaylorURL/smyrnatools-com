/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtFloat, fmtInt, fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import { DayforceFilters } from './DayforceFilters'

const HOURS_SORT_IDS = ['hours', 'ot', 'name']

/** Bucket thresholds — same numbers the dispatcher reads off the floor:
 *  anyone over 40h triggered OT this week, anyone 35-40h is one rough day
 *  away, anyone under 30h had room on the schedule that didn't get used. */
const OT_THRESHOLD = 40
const APPROACHING_OT_THRESHOLD = 35
const UNDERUTILIZED_THRESHOLD = 30

const USD = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })

const fmtMoney = (n) => USD.format(Number(n) || 0)
const fmtHours = (n) => `${fmtFloat(n, 1)}h`

/** Average actual hours per operator-week — the period total divided by
 *  the number of distinct (operator, week) buckets. Approximates "what
 *  did each operator work in a typical week" without needing the bucket
 *  map exposed. */
const computeAvgWeeklyHours = (perOperator, perWeek) => {
    if (!perOperator?.length || !perWeek?.length) return 0
    const totalActual = perOperator.reduce((sum, row) => sum + (row.actualHours || 0), 0)
    const operatorWeeks = perWeek.reduce((sum, row) => sum + (row.operatorCount || 0), 0)
    return operatorWeeks > 0 ? totalActual / operatorWeeks : 0
}

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {[120, 56, 200, 320, 220].map((h, i) => (
                <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
            ))}
        </div>
    )
}

/** Compact operator chip used inside the spotlight callouts — name +
 *  badge + the headline number for the bucket (hours, OT hours, etc.).
 *  Designed to read instantly: dispatcher sees the name and the number
 *  without parsing a row. */
function SpotlightChip({ accent, primary, secondary, row }) {
    return (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border-light bg-bg-primary text-[12px]">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-text-primary truncate">{row.name}</span>
                    {row.plantCode && (
                        <span
                            className="font-mono tabular-nums text-[10px] px-1 rounded shrink-0 text-text-primary"
                            style={{ background: `${accent}18` }}
                        >
                            {row.plantCode}
                        </span>
                    )}
                </div>
                {secondary && <div className="text-[10.5px] text-text-tertiary truncate">{secondary}</div>}
            </div>
            <span className="font-mono tabular-nums font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
                {primary}
            </span>
        </div>
    )
}

/** Spotlight column wrapper — colored header + scrollable chip list +
 *  empty fallback. Keeps the three callout panels visually balanced
 *  even when one of them has nothing to show. */
function SpotlightColumn({ accentColor, children, count, emptyMessage, hint, icon, title }) {
    return (
        <div className="flex flex-col gap-2 rounded border border-border-light bg-bg-primary p-3 min-h-0">
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                    style={{ background: `${accentColor}1a`, color: accentColor }}
                >
                    <i className={`fas ${icon} text-[12px]`} />
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-text-primary truncate">{title}</div>
                    {hint && <div className="text-[10.5px] text-text-tertiary truncate">{hint}</div>}
                </div>
                <span
                    className="font-mono tabular-nums text-[12.5px] font-bold shrink-0"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {fmtInt(count)}
                </span>
            </div>
            {count === 0 ? (
                <div className="text-[11.5px] text-text-tertiary px-1 py-2">{emptyMessage}</div>
            ) : (
                <div className="flex flex-col gap-1.5">{children}</div>
            )}
        </div>
    )
}

/** Single operator row — actual / OT / OT% / PTO. Scheduled column
 *  dropped per design intent: dispatcher cares about what was worked,
 *  not what was on the schedule. */
function OperatorHoursRow({ accent, maxHours, row }) {
    const otSharePct = row.actualHours > 0 ? (row.otHours / row.actualHours) * 100 : 0
    const pct = maxHours > 0 ? (row.actualHours / maxHours) * 100 : 0
    const otPct = maxHours > 0 ? (row.otHours / maxHours) * 100 : 0
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
                <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-primary font-semibold">
                    {fmtHours(row.actualHours)}
                </span>
                <span
                    className={`font-mono tabular-nums w-16 text-right shrink-0 font-semibold ${
                        row.otHours > 0 ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                >
                    {row.otHours > 0 ? fmtHours(row.otHours) : '—'}
                </span>
                <span
                    className={`font-mono tabular-nums w-14 text-right shrink-0 ${
                        otSharePct >= 15 ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                >
                    {otSharePct > 0 ? `${fmtFloat(otSharePct, 0)}%` : '—'}
                </span>
                <span className="font-mono tabular-nums w-14 text-right shrink-0 text-text-tertiary">
                    {row.ptoHours > 0 ? fmtHours(row.ptoHours) : '—'}
                </span>
            </div>
            {/* Stacked bar: regular hours in accent, OT hours in amber, on a
             *  shared canvas so the dispatcher sees both the absolute
             *  workload AND the OT chunk inside it without doing math. */}
            <div className="h-1.5 rounded-sm overflow-hidden bg-bg-tertiary ml-16 relative">
                <div className="h-full absolute left-0 top-0" style={{ background: accent, width: `${pct}%` }} />
                {row.otHours > 0 && (
                    <div
                        className="h-full absolute top-0"
                        style={{
                            background: '#b45309',
                            left: `${pct - otPct}%`,
                            width: `${otPct}%`
                        }}
                    />
                )}
            </div>
        </div>
    )
}

/**
 * Hours sub-page for the Operations > Statistics tab. Rewritten to
 * answer the question a dispatch manager actually has at the end of a
 * week: who's going into overtime, who's approaching it, who has
 * unused capacity, and how is the OT exposure trending. Scheduled
 * hours intentionally dropped from the headline view — the dispatcher
 * cares about what got worked, not what was on the schedule.
 *
 * Layout:
 *   1. KPI strip — actual hours, OT hours + share, operators over OT,
 *      avg weekly hours, PTO, exceptions.
 *   2. Spotlight callouts — over OT / approaching OT / under-utilized.
 *      Three columns of chips so the dispatcher can see the names that
 *      need attention without scrolling the operator table.
 *   3. Filters + per-operator table — actual / OT / OT% / PTO with a
 *      stacked bar visualizing the OT chunk inside the workload.
 *   4. Per-plant rollup + weekly trend — both surface OT alongside
 *      actual hours so plant-level and time-level OT spikes are
 *      visible at a glance.
 */
export function DayforceHoursPage({ accentColor, dateRange, plantCodes, selectedPlant }) {
    const accent = accentColor || '#1e3a5f'
    const dayforceMetrics = useDayforceOperatorMetrics({ dateRange, plantCodes, selectedPlant })
    const { diagnostics, excluded, hasSyncedData, isLoading, perOperator, perWeek, totals } = dayforceMetrics
    const filters = useDayforceOperatorFilters({ defaultSort: 'hours', rows: perOperator })

    const spotlights = useMemo(() => {
        const overOt = perOperator
            .filter((row) => row.otHours > 0)
            .sort((a, b) => b.otHours - a.otHours)
            .slice(0, 8)
        const approachingOt = perOperator
            .filter(
                (row) =>
                    row.otHours === 0 && row.actualHours >= APPROACHING_OT_THRESHOLD && row.actualHours < OT_THRESHOLD
            )
            .sort((a, b) => b.actualHours - a.actualHours)
            .slice(0, 8)
        const underutilized = perOperator
            .filter((row) => row.actualHours > 0 && row.actualHours < UNDERUTILIZED_THRESHOLD)
            .sort((a, b) => a.actualHours - b.actualHours)
            .slice(0, 8)
        return { approachingOt, overOt, underutilized }
    }, [perOperator])

    const avgWeeklyHours = useMemo(() => computeAvgWeeklyHours(perOperator, perWeek), [perOperator, perWeek])
    const otSharePct = totals.totalActualHours > 0 ? (totals.otHours / totals.totalActualHours) * 100 : 0
    const operatorsInOt = useMemo(() => perOperator.filter((r) => r.otHours > 0).length, [perOperator])
    const maxOperatorHours = useMemo(
        () => filters.filtered.reduce((max, row) => Math.max(max, row.actualHours || 0), 1),
        [filters.filtered]
    )

    if (isLoading && diagnostics.shiftsLoaded === 0) return <LoadingSkeleton />

    if (diagnostics.loadError) {
        return (
            <Panel title="Couldn't load Dayforce data" innerClassName="p-3">
                <div className="flex items-start gap-3 text-[12.5px]">
                    <i
                        className="fas fa-circle-exclamation text-[14px] mt-0.5"
                        style={{ color: 'var(--text-primary)' }}
                    />
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
                    <Stat
                        label="Actual hours"
                        value={fmtHours(totals.totalActualHours)}
                        hint="Worked across the window"
                    />
                    <Stat
                        label="OT hours"
                        value={fmtHours(totals.otHours)}
                        hint={
                            totals.totalActualHours > 0
                                ? `${fmtFloat(otSharePct, 1)}% of total · ${fmtMoney(totals.otCost)}`
                                : 'No actual hours yet'
                        }
                    />
                    <Stat
                        label="Operators in OT"
                        value={fmtInt(operatorsInOt)}
                        hint={
                            totals.operatorCount > 0
                                ? `${fmtFloat((operatorsInOt / totals.operatorCount) * 100, 0)}% of fleet`
                                : '—'
                        }
                    />
                    <Stat label="Avg weekly hours" value={fmtHours(avgWeeklyHours)} hint="Per operator-week" />
                    <Stat
                        label="PTO hours"
                        value={fmtHours(totals.ptoHours)}
                        hint={`${fmtInt(totals.operatorCount)} operators`}
                    />
                    <Stat
                        label="Exceptions"
                        value={fmtInt(totals.exceptionsCount)}
                        hint={`${totals.exceptionEmployees} operator(s)`}
                    />
                </StatGroup>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <SpotlightColumn
                    accentColor="#b91c1c"
                    count={spotlights.overOt.length}
                    emptyMessage="No operators went over 40h this period."
                    hint={`>${OT_THRESHOLD}h in a week`}
                    icon="fa-triangle-exclamation"
                    title="Over OT"
                >
                    {spotlights.overOt.map((row) => (
                        <SpotlightChip
                            key={row.dayforceEmployeeId}
                            accent={accent}
                            primary={fmtHours(row.otHours)}
                            secondary={`${fmtHours(row.actualHours)} actual · ${fmtMoney(row.otCost)} OT cost`}
                            row={row}
                        />
                    ))}
                </SpotlightColumn>

                <SpotlightColumn
                    accentColor="#b45309"
                    count={spotlights.approachingOt.length}
                    emptyMessage="No operators near the OT threshold."
                    hint={`${APPROACHING_OT_THRESHOLD}–${OT_THRESHOLD}h in a week`}
                    icon="fa-stopwatch"
                    title="Approaching OT"
                >
                    {spotlights.approachingOt.map((row) => (
                        <SpotlightChip
                            key={row.dayforceEmployeeId}
                            accent={accent}
                            primary={fmtHours(row.actualHours)}
                            secondary={
                                row.position ? `${row.position} · room to slow down` : 'Room to slow down before OT'
                            }
                            row={row}
                        />
                    ))}
                </SpotlightColumn>

                <SpotlightColumn
                    accentColor="#1d4ed8"
                    count={spotlights.underutilized.length}
                    emptyMessage="No operators below the under-utilized threshold."
                    hint={`<${UNDERUTILIZED_THRESHOLD}h in a week`}
                    icon="fa-bed"
                    title="Under-utilized"
                >
                    {spotlights.underutilized.map((row) => (
                        <SpotlightChip
                            key={row.dayforceEmployeeId}
                            accent={accent}
                            primary={fmtHours(row.actualHours)}
                            secondary={
                                row.ptoHours > 0 ? `${fmtHours(row.ptoHours)} PTO in window` : 'Capacity available'
                            }
                            row={row}
                        />
                    ))}
                </SpotlightColumn>
            </div>

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
                            <span className="w-16 text-right shrink-0">Actual</span>
                            <span className="w-16 text-right shrink-0">OT</span>
                            <span className="w-14 text-right shrink-0">OT %</span>
                            <span className="w-14 text-right shrink-0">PTO</span>
                        </div>
                        {filters.filtered.map((row) => (
                            <OperatorHoursRow
                                key={row.dayforceEmployeeId}
                                accent={accent}
                                maxHours={maxOperatorHours}
                                row={row}
                            />
                        ))}
                    </div>
                )}
            </Panel>
        </div>
    )
}

export default DayforceHoursPage
