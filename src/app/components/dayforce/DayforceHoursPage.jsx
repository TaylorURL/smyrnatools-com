/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import { fmtFloat, fmtInt, fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import { DayforceFilters } from './DayforceFilters'
import OperatorDailyStrip from './hours/OperatorDailyStrip'
import OperatorHoursRow from './hours/OperatorHoursRow'
import PlantPressureTable from './hours/PlantPressureTable'

const HOURS_SORT_IDS = ['hours', 'ot', 'name']

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

const SKELETON_HEIGHT_CLASSES = ['h-[120px]', 'h-[56px]', 'h-[180px]', 'h-[240px]', 'h-[320px]']

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {SKELETON_HEIGHT_CLASSES.map((h, i) => (
                <div key={i} className={`rounded-card bg-bg-secondary border border-border-light ${h}`} />
            ))}
        </div>
    )
}

/**
 * Hours sub-page for the Operations > Statistics tab. Designed to share
 * the visual vocabulary of its sibling tabs (Service, Customer Lookup):
 * a single `StatGroup` of summary `Stat` tiles up top, then a sequence
 * of titled `Panel`s, each with a short description and either a real
 * `<table>` or a callout grid.
 *
 * Answers three operational questions in order:
 *   1. What's the headline OT exposure for the window? — summary stats
 *   2. Which plants are driving it? — "OT pressure by plant" table.
 *      Click a row to scope the operator table to that plant.
 *   3. What does one operator's pattern look like? — per-operator
 *      table rows expand inline to reveal a 7-day shift mini-chart.
 *
 * Scheduled hours intentionally dropped from the headline view — the
 * dispatcher cares about what got worked, not what was on the schedule.
 */
export function DayforceHoursPage({ accentColor, dateRange, plantCodes, selectedPlant }) {
    const accent = accentColor || '#1e3a5f'
    const dayforceMetrics = useDayforceOperatorMetrics({ dateRange, plantCodes, selectedPlant })
    const { diagnostics, excluded, hasSyncedData, isLoading, perOperator, perPlant, perShift, perWeek, totals } =
        dayforceMetrics
    const filters = useDayforceOperatorFilters({ defaultSort: 'hours', rows: perOperator })

    /* Local plant filter that scopes the operator table to a single plant
     * when the user clicks a row in the plant pressure panel. Independent
     * from the page-level `selectedPlant` prop so the dispatcher can drill
     * in without leaving the page. */
    const [focusedPlantCode, setFocusedPlantCode] = useState(null)
    const [expandedOperatorId, setExpandedOperatorId] = useState(null)

    /* Roll up OT exposure per rostered plant. The shared hook ships
     * `perPlant` with totals only — to surface OT specifically we have
     * to bucket from `perOperator` (where the OT split lives, since OT
     * is computed per operator-week, not per shift). */
    const plantPressure = useMemo(() => {
        const nameByCode = new Map((perPlant || []).map((p) => [String(p.code), p.name]))
        const buckets = new Map()
        for (const row of perOperator) {
            const code = row.plantCode || 'Unassigned'
            const bucket = buckets.get(code) || {
                actualHours: 0,
                code,
                name: nameByCode.get(String(code)) || (code === 'Unassigned' ? 'Unassigned' : code),
                operatorCount: 0,
                operatorsOverOt: 0,
                otCost: 0,
                otHours: 0
            }
            bucket.actualHours += row.actualHours
            bucket.otHours += row.otHours
            bucket.otCost += row.otCost
            bucket.operatorCount += 1
            if (row.otHours > 0) bucket.operatorsOverOt += 1
            buckets.set(code, bucket)
        }
        return Array.from(buckets.values()).sort((a, b) => b.otCost - a.otCost || b.actualHours - a.actualHours)
    }, [perOperator, perPlant])

    const maxPlantOtCost = useMemo(
        () => plantPressure.reduce((max, p) => Math.max(max, p.otCost || 0), 0),
        [plantPressure]
    )

    const avgWeeklyHours = useMemo(() => computeAvgWeeklyHours(perOperator, perWeek), [perOperator, perWeek])
    const otSharePct = totals.totalActualHours > 0 ? (totals.otHours / totals.totalActualHours) * 100 : 0
    const operatorsInOt = useMemo(() => perOperator.filter((r) => r.otHours > 0).length, [perOperator])
    const otCostShareOfPayroll = totals.totalCost > 0 ? (totals.otCost / totals.totalCost) * 100 : 0

    /* Apply both the plant focus and the user filter to the table rows. */
    const tableRows = useMemo(() => {
        if (!focusedPlantCode) return filters.filtered
        return filters.filtered.filter((r) => (r.plantCode || 'Unassigned') === focusedPlantCode)
    }, [filters.filtered, focusedPlantCode])

    const maxOperatorHours = useMemo(
        () => tableRows.reduce((max, row) => Math.max(max, row.actualHours || 0), 1),
        [tableRows]
    )

    /* Pre-bucket per-shift rows by employee so the row-expand handler
     * doesn't re-filter the entire perShift list on every render. */
    const shiftsByEmployee = useMemo(() => {
        const map = new Map()
        for (const s of perShift || []) {
            const arr = map.get(s.dayforceEmployeeId) || []
            arr.push(s)
            map.set(s.dayforceEmployeeId, arr)
        }
        for (const arr of map.values()) {
            arr.sort((a, b) => String(a.shiftDate).localeCompare(String(b.shiftDate)))
        }
        return map
    }, [perShift])

    const togglePlantFocus = (code) => {
        setFocusedPlantCode((current) => (current === code ? null : code))
    }

    if (isLoading && diagnostics.shiftsLoaded === 0) return <LoadingSkeleton />

    if (diagnostics.loadError) {
        return (
            <Panel title="Couldn't load Dayforce data" innerClassName="p-3">
                <div className="flex items-start gap-3 text-[12.5px]">
                    <i className="fas fa-circle-exclamation text-[14px] mt-0.5 text-text-primary" />
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
                innerClassName="p-0 overflow-hidden"
            >
                <div className="flex flex-col gap-3 p-3">
                    <StatGroup columns={6}>
                        <Stat
                            label="Actual hours"
                            value={fmtHours(totals.totalActualHours)}
                            hint={
                                totals.operatorCount > 0
                                    ? `Across ${fmtInt(totals.operatorCount)} operators`
                                    : 'Worked across the window'
                            }
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
                            hint={`${fmtInt(totals.operatorCount)} operators in window`}
                        />
                        <Stat
                            label="Exceptions"
                            value={fmtInt(totals.exceptionsCount)}
                            hint={`${fmtInt(totals.exceptionEmployees)} operator${totals.exceptionEmployees === 1 ? '' : 's'} flagged`}
                        />
                    </StatGroup>
                    <div className="text-[11.5px] text-text-secondary">
                        OT cost is {fmtFloat(otCostShareOfPayroll, 1)}% of total payroll for this window. The richer
                        breakdown lives in the panels below.
                    </div>
                </div>
            </Panel>

            <Panel
                title="OT pressure by plant"
                right={
                    focusedPlantCode ? (
                        <button
                            type="button"
                            onClick={() => setFocusedPlantCode(null)}
                            className="text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        >
                            <i className="fas fa-xmark text-[10px]" /> Clear plant filter ({focusedPlantCode})
                        </button>
                    ) : null
                }
            >
                <div className="text-[11.5px] mb-2 text-text-secondary">
                    Which plants are eating the OT budget — sorted by OT cost, worst first. Click any row to filter the
                    operator table below to that plant.
                </div>
                {plantPressure.length === 0 ? (
                    <EmptySection icon="fa-circle-info" message="No plant data in the window." />
                ) : (
                    <PlantPressureTable
                        focusedPlantCode={focusedPlantCode}
                        maxOtCost={maxPlantOtCost}
                        onTogglePlant={togglePlantFocus}
                        plants={plantPressure}
                    />
                )}
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
                visibleCount={tableRows.length}
            />

            <Panel
                title="Per-operator hours"
                innerClassName="p-0"
                right={
                    isLoading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {tableRows.length} of {perOperator.length} shown
                            {focusedPlantCode ? ` · ${focusedPlantCode} only` : ''}
                        </span>
                    )
                }
            >
                {tableRows.length === 0 ? (
                    <EmptySection
                        icon="fa-filter-circle-xmark"
                        message="No operators match these filters. Try widening the date range or clearing the search / role / plant filters."
                    />
                ) : (
                    <div>
                        <div className="flex items-center gap-2 px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-light bg-bg-tertiary">
                            <span className="w-3 shrink-0" aria-hidden="true" />
                            <span className="w-12 shrink-0">Badge</span>
                            <span className="flex-1">Operator</span>
                            <span className="w-14 text-right shrink-0">Actual</span>
                            <span className="w-14 text-right shrink-0">OT</span>
                            <span className="w-12 text-right shrink-0 hidden sm:inline">OT %</span>
                            <span className="w-14 text-right shrink-0 hidden md:inline">PTO</span>
                        </div>
                        {tableRows.map((row) => {
                            const isExpanded = expandedOperatorId === row.dayforceEmployeeId
                            return (
                                <React.Fragment key={row.dayforceEmployeeId}>
                                    <OperatorHoursRow
                                        accent={accent}
                                        isExpanded={isExpanded}
                                        maxHours={maxOperatorHours}
                                        onToggle={() =>
                                            setExpandedOperatorId(isExpanded ? null : row.dayforceEmployeeId)
                                        }
                                        row={row}
                                    />
                                    {isExpanded && (
                                        <OperatorDailyStrip
                                            accent={accent}
                                            dailyShifts={shiftsByEmployee.get(row.dayforceEmployeeId) || []}
                                        />
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>
                )}
            </Panel>
        </div>
    )
}

export default DayforceHoursPage
