/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtInt, fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import { SCHEDULE_SORT_IDS } from '../../constants/dayforceScheduleConstants'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import useOperatorYardageByDay from '../../hooks/useOperatorYardageByDay'
import { useWeekTables } from '../../hooks/useWeekTables'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import { DayforceFilters } from './DayforceFilters'
import { LoadingSkeleton } from './schedules/LoadingSkeleton'
import { filterExceptionText } from './schedules/scheduleFlags'
import { fmtHours } from './schedules/scheduleFormatters'
import { WeekTable } from './schedules/WeekTable'

/**
 * Schedules sub-page — weekly timesheet grid. Per-(operator × day) shifts
 * are pivoted into a table where each row is one operator and each column
 * is one working day (Mon–Sat). When the active date range spans more
 * than one calendar week, each week renders as its own table with a
 * weekly totals row and right-column.
 *
 * Mirrors the Dayforce timesheet Pay grid visually so the dispatcher's
 * eye can land on a row, scan across the week, and spot patterns
 * (chronic early clock-ins on Mondays, missed Saturdays, recurring
 * exceptions on a single day) without scrolling through a flat list.
 *
 * Same operator scope as Hours / Labor Cost — mixer + tractor only.
 */
export function DayforceSchedulesPage({ accentColor, dateRange, plantCodes, selectedPlant }) {
    const accent = accentColor || '#1e3a5f'
    const dayforceMetrics = useDayforceOperatorMetrics({ dateRange, plantCodes, selectedPlant })
    const { diagnostics, excluded, hasSyncedData, isLoading, perShift, totals } = dayforceMetrics
    /** Per-operator yardage from `dispatch_data` over the same date range.
     *  Used to compute YPH (yards / actualHours) at both the per-shift
     *  and per-week level so the schedule grid can flag low-productivity
     *  operators. */
    const { yardageByOperatorByDay } = useOperatorYardageByDay({ dateRange })
    const filters = useDayforceOperatorFilters({ defaultSort: 'operator', rows: perShift })

    /** Summary counter — recomputed locally so the "Exceptions" tile in
     *  the top StatGroup ignores padded-shift cases (early clock-in,
     *  late clock-out) the same way the per-cell rendering does. The
     *  hook-side `totals.exceptionsCount` raw-counts every Dayforce
     *  `exception_code`; that would otherwise pad the headline number
     *  with cases the dispatcher said they don't care about. */
    const filteredExceptionStats = useMemo(() => {
        let count = 0
        const employees = new Set()
        for (const shift of perShift) {
            if (filterExceptionText(shift.exceptionText)) {
                count += 1
                if (shift.dayforceEmployeeId) employees.add(shift.dayforceEmployeeId)
            }
        }
        return { count, employees: employees.size }
    }, [perShift])

    const weekTables = useWeekTables({
        filteredShifts: filters.filtered,
        sortId: filters.controls.sort,
        yardageByOperatorByDay
    })

    if (isLoading && diagnostics.shiftsLoaded === 0) return <LoadingSkeleton />

    if (diagnostics.loadError) {
        return (
            <Panel title="Couldn't load Dayforce data" innerClassName="p-3">
                <div className="flex items-start gap-3 text-[12.5px]">
                    <i
                        className="fas fa-circle-exclamation text-[14px] mt-0.5 text-status-danger"
                        aria-hidden="true"
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
            <Panel title="Schedules" innerClassName="p-0">
                <EmptySection
                    icon="fa-cloud-arrow-down"
                    message="No Dayforce timesheet data has been imported yet. Daily schedules and punches appear here after the dayforce-bridge userscript completes its first cycle."
                />
            </Panel>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Schedule summary"
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
                <StatGroup columns={4}>
                    <Stat label="Shifts" value={fmtInt(perShift.length)} hint={`${totals.operatorCount} operator(s)`} />
                    <Stat label="Actual hours" value={fmtHours(totals.totalActualHours)} />
                    <Stat
                        label="Exceptions"
                        value={fmtInt(filteredExceptionStats.count)}
                        hint={`${filteredExceptionStats.employees} operator(s)`}
                    />
                    <Stat label="PTO hours" value={fmtHours(totals.ptoHours)} />
                </StatGroup>
            </Panel>

            <DayforceFilters
                accent={accent}
                availablePositions={Array.from(new Set(perShift.map((s) => s.position).filter(Boolean))).sort()}
                controls={filters.controls}
                excluded={excluded}
                onReset={filters.reset}
                setPosition={filters.setPosition}
                setSearch={filters.setSearch}
                setSort={filters.setSort}
                sortIds={SCHEDULE_SORT_IDS}
                visibleCount={filters.filtered.length}
            />

            {weekTables.length === 0 ? (
                <Panel title="Per-shift schedule" innerClassName="p-0">
                    <EmptySection
                        icon="fa-filter-circle-xmark"
                        message="No shifts match these filters. Widen the date range in the top bar or clear the search / role filters."
                    />
                </Panel>
            ) : (
                /* One WeekTable per Mon–Sat week in the selected range —
                 * stacked vertically so the date range in the page header
                 * is the single source of truth. The historical week-by-
                 * week carousel was removed because it duplicated what the
                 * top-bar period selector already does. `weekTables` is
                 * sorted newest-first so the most recent week renders on
                 * top. */
                weekTables.map((week) => (
                    <WeekTable
                        key={week.weekLabel}
                        accent={accent}
                        days={week.days}
                        operatorRows={week.operatorRows}
                        totalsByDay={week.totalsByDay}
                        weekLabel={week.weekLabel}
                        weekTotal={week.weekTotal}
                        weekYardageTotal={week.weekYardageTotal}
                    />
                ))
            )}
        </div>
    )
}

export default DayforceSchedulesPage
