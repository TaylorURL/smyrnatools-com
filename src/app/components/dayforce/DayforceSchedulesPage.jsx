/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat, fmtInt, fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { DayforceFilters } from './DayforceFilters'

const SCHEDULE_SORT_IDS = ['dateDesc', 'operator', 'hours', 'varianceDesc']

const fmtHours = (n) => `${fmtFloat(n, 1)}h`

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit'
})

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short'
})

/** Dayforce serialises timestamps without a zone — interpret as the
 *  local clock (tenant is in US Central, which is also where dispatchers
 *  read the page). Returns a Date or null. */
const parseLocal = (iso) => {
    if (!iso) return null
    const d = new Date(typeof iso === 'string' ? iso.replace(' ', 'T') : iso)
    return Number.isNaN(d.getTime()) ? null : d
}

const fmtTime = (iso) => {
    const d = parseLocal(iso)
    return d ? TIME_FORMATTER.format(d) : '—'
}

const fmtDay = (iso) => {
    if (!iso) return '—'
    const d = parseLocal(`${iso}T00:00:00`)
    return d ? DAY_FORMATTER.format(d) : iso
}

/** Punch-delta tag — small "+5m" / "-8m" pill on actual times showing
 *  how far off the actual punch was vs. the scheduled time. Helps the
 *  dispatcher spot a chronic early-clock-in without doing math in their
 *  head. Color matches the same variance scale used on the Hours page
 *  (early=red because it costs payroll, late=amber). */
function PunchDelta({ accent, actualIso, scheduledIso, kind }) {
    const a = parseLocal(actualIso)
    const s = parseLocal(scheduledIso)
    if (!a || !s) return null
    const diffMin = Math.round((a.getTime() - s.getTime()) / 60000)
    if (diffMin === 0) return null
    const isEarlyIn = kind === 'in' && diffMin < 0
    const isLateOut = kind === 'out' && diffMin > 0
    const isLateIn = kind === 'in' && diffMin > 0
    const isEarlyOut = kind === 'out' && diffMin < 0
    let color = 'var(--text-tertiary)'
    if (isEarlyIn || isLateOut)
        color = '#b45309' // padded the shift
    else if (isLateIn || isEarlyOut) color = '#1d4ed8' // short-changed the shift
    const sign = diffMin > 0 ? '+' : ''
    const label = Math.abs(diffMin) >= 60 ? `${sign}${(diffMin / 60).toFixed(1)}h` : `${sign}${diffMin}m`
    return (
        <span
            className="ml-1 inline-flex items-center rounded px-1 py-0 text-[9.5px] font-semibold tabular-nums"
            style={{ background: `${accent}10`, color }}
            title={`Actual vs scheduled ${kind === 'in' ? 'clock in' : 'clock out'}: ${sign}${diffMin} min`}
        >
            {label}
        </span>
    )
}

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {[120, 56, 480].map((h, i) => (
                <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
            ))}
        </div>
    )
}

/** One row = one operator's shift on one day. Compact table layout —
 *  optimized for scanning a punch log. */
function ScheduleRow({ accent, row }) {
    const ptoBadge = row.isPto
    return (
        <div className="grid grid-cols-12 items-center gap-2 px-3 py-1.5 text-[12px] border-t border-border-light first:border-t-0 hover:bg-bg-secondary transition-colors">
            <span className="col-span-2 font-mono tabular-nums text-text-primary">{fmtDay(row.shiftDate)}</span>
            <div className="col-span-3 min-w-0 flex items-center gap-2">
                <span className="font-mono tabular-nums w-14 shrink-0 text-text-tertiary">{row.badge || '—'}</span>
                <span className="truncate font-semibold text-text-primary">{row.name}</span>
            </div>
            <span className="col-span-1 font-mono tabular-nums text-[11px] text-text-tertiary truncate">
                {row.plantCode}
            </span>
            {ptoBadge ? (
                <span className="col-span-5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803d]">
                    <i className="fas fa-umbrella-beach text-[10px]" />
                    PTO · {fmtHours(row.ptoHours || row.scheduledHours)}
                </span>
            ) : (
                <>
                    <div className="col-span-2 flex items-center gap-1 text-[11.5px]">
                        <span className="text-text-tertiary text-[10px]">Sched</span>
                        <span className="font-mono tabular-nums text-text-secondary">
                            {fmtTime(row.scheduledInAt)} – {fmtTime(row.scheduledOutAt)}
                        </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1 text-[11.5px]">
                        <span className="text-text-tertiary text-[10px]">Actual</span>
                        <span className="font-mono tabular-nums text-text-primary font-semibold">
                            {fmtTime(row.actualInPunchAt || row.actualInAt)}
                        </span>
                        <PunchDelta
                            accent={accent}
                            actualIso={row.actualInPunchAt || row.actualInAt}
                            scheduledIso={row.scheduledInAt}
                            kind="in"
                        />
                        <span className="text-text-tertiary">–</span>
                        <span className="font-mono tabular-nums text-text-primary font-semibold">
                            {fmtTime(row.actualOutPunchAt || row.actualOutAt)}
                        </span>
                        <PunchDelta
                            accent={accent}
                            actualIso={row.actualOutPunchAt || row.actualOutAt}
                            scheduledIso={row.scheduledOutAt}
                            kind="out"
                        />
                    </div>
                    <div className="col-span-1 text-right">
                        <span className="font-mono tabular-nums text-text-primary font-semibold">
                            {fmtHours(row.actualHours)}
                        </span>
                    </div>
                </>
            )}
            {row.exceptionText && (
                <span className="col-span-12 text-[10.5px] text-[#b45309] truncate" title={row.exceptionText}>
                    <i className="fas fa-triangle-exclamation mr-1 text-[9px]" />
                    {row.exceptionText}
                </span>
            )}
        </div>
    )
}

/**
 * Schedules sub-page — flat per-(operator × day) punch log. Mirrors the
 * Dayforce timesheet Pay grid but as a sortable / filterable list so
 * dispatchers can spot patterns (chronic early clock-ins, missed
 * scheduled out, recurring exceptions on a specific weekday) without
 * scrolling through the Dayforce UI.
 *
 * Same operator scope as Hours / Labor Cost — mixer + tractor only.
 */
export function DayforceSchedulesPage({ accentColor, dateRange, plantCodes, selectedPlant }) {
    const accent = accentColor || '#1e3a5f'
    const dayforceMetrics = useDayforceOperatorMetrics({ dateRange, plantCodes, selectedPlant })
    const { diagnostics, excluded, hasSyncedData, isLoading, perShift, totals } = dayforceMetrics
    const filters = useDayforceOperatorFilters({ defaultSort: 'dateDesc', rows: perShift })

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
                <StatGroup columns={5}>
                    <Stat label="Shifts" value={fmtInt(perShift.length)} hint={`${totals.operatorCount} operator(s)`} />
                    <Stat label="Scheduled hours" value={fmtHours(totals.scheduledHours)} />
                    <Stat label="Actual hours" value={fmtHours(totals.totalActualHours)} />
                    <Stat
                        label="Exceptions"
                        value={fmtInt(totals.exceptionsCount)}
                        hint={`${totals.exceptionEmployees} operator(s)`}
                        valueColor={totals.exceptionsCount > 0 ? '#b45309' : undefined}
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

            <Panel
                title="Per-shift schedule"
                innerClassName="p-0"
                right={
                    isLoading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {filters.filtered.length} of {perShift.length} shifts
                        </span>
                    )
                }
            >
                {filters.filtered.length === 0 ? (
                    <EmptySection
                        icon="fa-filter-circle-xmark"
                        message="No shifts match these filters. Widen the date range above or clear the search / role filters."
                    />
                ) : (
                    <div>
                        <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-light bg-bg-secondary">
                            <span className="col-span-2">Date</span>
                            <span className="col-span-3">Operator</span>
                            <span className="col-span-1">Plant</span>
                            <span className="col-span-2">Scheduled</span>
                            <span className="col-span-2">Actual</span>
                            <span className="col-span-1 text-right">Hrs</span>
                        </div>
                        {filters.filtered.map((row) => (
                            <ScheduleRow key={`${row.dayforceEmployeeId}-${row.shiftDate}`} accent={accent} row={row} />
                        ))}
                    </div>
                )}
            </Panel>
        </div>
    )
}

export default DayforceSchedulesPage
