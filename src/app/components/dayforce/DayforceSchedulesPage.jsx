/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { fmtFloat, fmtInt, fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import useOperatorYardageByDay, { canonicalNameKey } from '../../hooks/useOperatorYardageByDay'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import { DayforceFilters } from './DayforceFilters'

/** YPH target — yards-per-hour below this counts as "not doing well"
 *  per the dispatcher's threshold. Mirrors `TARGET_YPH` from
 *  `planConstants.ts` so the schedule grid and the plant scorecard read
 *  off the same number. */
const YPH_TARGET = 3

const SCHEDULE_SORT_IDS = ['operator', 'hours', 'varianceDesc']

const fmtHours = (n) => `${fmtFloat(n, 1)}h`

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit'
})

const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' })

/** Mon–Sat working-week labels for the column header. Sunday is excluded
 *  everywhere — plants don't run that day. */
const WEEKDAYS = [
    { full: 'Monday', label: 'Mon', offset: 0 },
    { full: 'Tuesday', label: 'Tue', offset: 1 },
    { full: 'Wednesday', label: 'Wed', offset: 2 },
    { full: 'Thursday', label: 'Thu', offset: 3 },
    { full: 'Friday', label: 'Fri', offset: 4 },
    { full: 'Saturday', label: 'Sat', offset: 5 }
]

/** Dayforce serialises timestamps without a zone — interpret as the local
 *  clock (tenant is in US Central, which is also where dispatchers read
 *  the page). Returns a Date or null. */
const parseLocal = (iso) => {
    if (!iso) return null
    const d = new Date(typeof iso === 'string' ? iso.replace(' ', 'T') : iso)
    return Number.isNaN(d.getTime()) ? null : d
}

const fmtTime = (iso) => {
    const d = parseLocal(iso)
    return d ? TIME_FORMATTER.format(d) : '—'
}

/** Compact "6:30a" formatter for a cell — strips minutes when on the hour
 *  so the cell stays narrow when the schedule is round-numbered. */
const fmtTimeCompact = (iso) => {
    const d = parseLocal(iso)
    if (!d) return '—'
    const h = d.getHours()
    const m = d.getMinutes()
    const period = h >= 12 ? 'p' : 'a'
    const display = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${display}${period}` : `${display}:${String(m).padStart(2, '0')}${period}`
}

/** Date helpers — `yyyy-mm-dd` strings. Calendar arithmetic stays local
 *  to avoid the timezone drift that bit us elsewhere. */
const parseYmd = (ymd) => {
    if (!ymd) return null
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return null
    const date = new Date(y, m - 1, d)
    return Number.isNaN(date.getTime()) ? null : date
}

const formatYmd = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** Returns the Monday of the same ISO week as `ymd`. Sunday rolls to the
 *  previous Monday so a Sunday-flagged shift (rare; PTO sometimes lands
 *  here) doesn't anchor its own degenerate week. */
const mondayOf = (ymd) => {
    const d = parseYmd(ymd)
    if (!d) return null
    const dow = d.getDay() // 0 = Sun
    const offset = dow === 0 ? -6 : 1 - dow
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
    return formatYmd(monday)
}

const addDays = (ymd, days) => {
    const d = parseYmd(ymd)
    if (!d) return null
    return formatYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Pretty week label — "May 26 – Jun 1" for the table header. */
const fmtWeekLabel = (mondayYmd) => {
    const start = parseYmd(mondayYmd)
    const end = parseYmd(addDays(mondayYmd, 5))
    if (!start || !end) return mondayYmd || ''
    return `${SHORT_DAY_FORMATTER.format(start)} – ${SHORT_DAY_FORMATTER.format(end)}`
}

/** Threshold beyond which a shift counts as "long" and triggers the
 *  same red treatment as a late punch. Mirrors the LONG HOURS efficiency
 *  threshold from `reportConstants.js`. */
const LONG_SHIFT_HOURS = 14

/** Minute-of-epoch for a Date — seconds and milliseconds truncated so a
 *  punch at 7:10:23 reads as the same "7:10" the dispatcher sees on
 *  screen. Without this, sub-minute drift between Dayforce's scheduled
 *  timestamp and the actual punch timestamp (often a few seconds in
 *  either direction) would flag every on-time punch as late. */
const minuteOf = (date) => Math.floor(date.getTime() / 60000)

/** Was this punch late? (Clock in after scheduled in, or clock out after
 *  scheduled out.) Helpers shared by `PunchDelta` and `ShiftCell` so the
 *  red flag is computed once per shift. Minute-level comparison — same
 *  minute is never late, regardless of seconds. */
const isPunchLate = (actualIso, scheduledIso) => {
    const a = parseLocal(actualIso)
    const s = parseLocal(scheduledIso)
    if (!a || !s) return false
    return minuteOf(a) > minuteOf(s)
}

const isShiftLong = (actualHours) => Number(actualHours) > LONG_SHIFT_HOURS

/** Padding the shift (clock-in before scheduled, clock-out after
 *  scheduled) is intentionally NOT a red flag — those cases are
 *  noise the dispatcher has explicitly said they don't care about.
 *  Only short-changed-shift signals (late in, early out) and long
 *  shifts trigger the red treatment. */
/** Dayforce raises an exception any time a punch deviates from schedule,
 *  but the dispatcher only cares about a subset of those. Padded-shift
 *  exceptions — clocked in early OR clocked out late — are explicitly
 *  ignored. This filter strips them out of the raw `exceptionText` so
 *  the cell doesn't turn amber and the tooltip doesn't surface them.
 *
 *  Matching is intentionally loose because Dayforce phrases these flags
 *  in inconsistent ways ("Early In", "Punch In Early", "Schedule
 *  Adherence: Early In", "In Early", "Clock In Early", etc.). The rule
 *  is: if a piece mentions both `early` AND `in` it's an early-clock-in;
 *  if it mentions both `late` AND `out` it's a late-clock-out. Both get
 *  filtered.
 *
 *  Anything else — missed lunch, no-show, schedule mismatch unrelated to
 *  early/late, etc. — still flows through and drives the amber
 *  treatment. */
const containsEarlyIn = (lower) => /\bearly\b/.test(lower) && /\bin\b/.test(lower)
const containsLateOut = (lower) => /\blate\b/.test(lower) && /\bout\b/.test(lower)

const filterExceptionText = (raw) => {
    if (!raw) return ''
    return String(raw)
        .split(/[,;\n]/)
        .map((piece) => piece.trim())
        .filter((piece) => {
            if (!piece) return false
            const lower = piece.toLowerCase()
            return !containsEarlyIn(lower) && !containsLateOut(lower)
        })
        .join(', ')
}

const shiftHasRedFlag = (shift) => {
    if (!shift || shift.isPto) return false
    if (isShiftLong(shift.actualHours)) return true
    if (isPunchLate(shift.actualInPunchAt || shift.actualInAt, shift.scheduledInAt)) return true
    return false
}

/** Punch-delta tag — small "+5m" / "-8m" pill on actual times. Only
 *  two cases are shown: a late clock-in (red — operator started behind
 *  schedule, short-changing the shift) and an early clock-out (blue —
 *  operator left before scheduled out, also short-changing the shift).
 *  Padding the shift (early-in / late-out) is intentionally suppressed
 *  because the dispatcher doesn't act on those. */
function PunchDelta({ accent, actualIso, scheduledIso, kind }) {
    const a = parseLocal(actualIso)
    const s = parseLocal(scheduledIso)
    if (!a || !s) return null
    /* Minute-level diff so seconds drift between Dayforce schedule
     * timestamps and the actual punch (commonly 5–45s) doesn't spawn
     * a "+1m" pill when the clock-display minute is the same. */
    const diffMin = minuteOf(a) - minuteOf(s)
    if (diffMin === 0) return null
    const isLateIn = kind === 'in' && diffMin > 0
    const isEarlyOut = kind === 'out' && diffMin < 0
    // Padded-shift cases — drop the pill entirely.
    if (!isLateIn && !isEarlyOut) return null
    const color = isLateIn ? '#b91c1c' : '#1d4ed8'
    const sign = diffMin > 0 ? '+' : ''
    const label = Math.abs(diffMin) >= 60 ? `${sign}${(diffMin / 60).toFixed(1)}h` : `${sign}${diffMin}m`
    return (
        <span
            className="inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold tabular-nums"
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

/** Yards-per-hour chip — shows the per-shift YPH next to the punch row
 *  and tints the BACKGROUND red when the operator is below the
 *  dispatcher's threshold. Text stays theme-aware (black in light, white
 *  in dark) — the background carries the severity signal. Suppressed
 *  entirely when we don't have yardage data for this shift. */
function YphChip({ yph }) {
    if (yph == null || !Number.isFinite(yph)) return null
    const isLow = yph < YPH_TARGET
    const bg = isLow ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)'
    return (
        <span
            className="inline-flex items-center rounded px-1 py-0 text-[9.5px] font-semibold tabular-nums text-text-primary"
            style={{ background: bg }}
            title={`${fmtFloat(yph, 1)} yd / hour${isLow ? ` (below ${YPH_TARGET} target)` : ''}`}
        >
            {fmtFloat(yph, 1)} y/h
        </span>
    )
}

/** Compact cell content for one shift inside the weekly grid. Tries to
 *  fit the three most useful signals: hours (big), scheduled in time
 *  (small), and exception / PTO markers (icon row). Hover surfaces the
 *  full punch detail. */
function ShiftCell({ accent, shift, yardage }) {
    if (!shift) {
        return (
            <div
                className="flex items-center justify-center h-full text-text-tertiary text-[11px]"
                style={{ minHeight: 60 }}
            >
                —
            </div>
        )
    }
    if (shift.isPto) {
        return (
            <div
                className="flex flex-col items-start gap-0.5 px-2 py-1.5 h-full"
                style={{ background: 'rgba(14, 165, 233, 0.08)', minHeight: 60 }}
                title={`PTO — ${fmtHours(shift.ptoHours || shift.scheduledHours)}`}
            >
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-primary">
                    <i className="fas fa-umbrella-beach text-[9px]" />
                    PTO
                </span>
                <span className="font-mono tabular-nums font-semibold text-text-primary text-[12px]">
                    {fmtHours(shift.ptoHours || shift.scheduledHours)}
                </span>
            </div>
        )
    }
    /** Filter padded-shift exceptions (early-in / late-out) out of the
     *  raw Dayforce text — those don't count as a real exception per
     *  dispatcher's request. */
    const effectiveExceptionText = filterExceptionText(shift.exceptionText)
    const hasException = !!effectiveExceptionText
    /** Yards-per-hour for this shift — divides delivered yardage by
     *  actual hours worked. Null when we don't have a yardage match
     *  for the operator on this day (typical for a non-mixer position
     *  or a name that didn't resolve to a ticket driver). */
    const shiftYph =
        Number(shift.actualHours) > 0 && Number(yardage) > 0 ? Number(yardage) / Number(shift.actualHours) : null
    const isLowYph = shiftYph != null && shiftYph < YPH_TARGET
    /** Red flag — long shift (>14h), any late punch, OR a low-YPH
     *  shift. Outweighs the amber Dayforce-exception color so the
     *  most urgent issues are visible at a glance across the grid. */
    const hasRedFlag = shiftHasRedFlag(shift) || isLowYph
    const isLong = isShiftLong(shift.actualHours)
    const inLate = isPunchLate(shift.actualInPunchAt || shift.actualInAt, shift.scheduledInAt)
    // Numeric cells render in the theme text color regardless of flag state —
    // the inline alert icon next to the number carries the warning signal.
    const hoursColor = 'var(--text-primary)'
    const cellBg = hasRedFlag ? 'rgba(220, 38, 38, 0.08)' : hasException ? 'rgba(217, 119, 6, 0.06)' : 'transparent'
    const iconColor = 'var(--text-primary)'
    /* Padded-shift signals (early in, late out) are intentionally
     * omitted — the dispatcher only acts on short-changed shifts and
     * long shifts. */
    const flagTitle = [
        isLong ? `Long shift (>${LONG_SHIFT_HOURS}h)` : null,
        inLate ? 'Late clock-in' : null,
        isLowYph ? `Low YPH (${fmtFloat(shiftYph, 1)} < ${YPH_TARGET})` : null,
        effectiveExceptionText ? `Exception: ${effectiveExceptionText}` : null
    ]
        .filter(Boolean)
        .join(' · ')
    const tooltip = [
        `Scheduled ${fmtTime(shift.scheduledInAt)} – ${fmtTime(shift.scheduledOutAt)}`,
        `Actual ${fmtTime(shift.actualInPunchAt || shift.actualInAt)} – ${fmtTime(shift.actualOutPunchAt || shift.actualOutAt)}`,
        flagTitle || null
    ]
        .filter(Boolean)
        .join('\n')
    return (
        <div
            className="flex flex-col gap-0.5 px-2 py-1.5 h-full"
            style={{ background: cellBg, minHeight: 60 }}
            title={tooltip}
        >
            <div className="flex items-center gap-1.5">
                <span className="font-mono tabular-nums font-semibold text-[13px]" style={{ color: hoursColor }}>
                    {fmtHours(shift.actualHours)}
                </span>
                {(hasRedFlag || hasException) && (
                    <i
                        className="fas fa-triangle-exclamation text-[10px]"
                        style={{ color: iconColor }}
                        title={flagTitle || effectiveExceptionText}
                    />
                )}
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-text-secondary font-mono tabular-nums">
                <span>{fmtTimeCompact(shift.actualInPunchAt || shift.actualInAt)}</span>
                <PunchDelta
                    accent={accent}
                    actualIso={shift.actualInPunchAt || shift.actualInAt}
                    scheduledIso={shift.scheduledInAt}
                    kind="in"
                />
                <span className="text-text-tertiary">→</span>
                <span>{fmtTimeCompact(shift.actualOutPunchAt || shift.actualOutAt)}</span>
                <PunchDelta
                    accent={accent}
                    actualIso={shift.actualOutPunchAt || shift.actualOutAt}
                    scheduledIso={shift.scheduledOutAt}
                    kind="out"
                />
            </div>
            {shiftYph != null && (
                <div className="flex items-center gap-1 mt-0.5">
                    <YphChip yph={shiftYph} />
                </div>
            )}
        </div>
    )
}

/** Renders one week-grid table: operators as rows, Mon–Sat as columns,
 *  plus a "Total" right column with each operator's weekly hours and a
 *  totals row at the bottom summing each day across operators. */
function WeekTable({ accent, days, operatorRows, totalsByDay, weekTotal, weekLabel, weekYardageTotal }) {
    const headerCell =
        'text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2 border-b border-border-light bg-bg-secondary text-text-tertiary'
    return (
        <Panel
            title="Weekly schedule"
            innerClassName="p-0"
            right={<span className="text-[11px] text-text-tertiary">{weekLabel}</span>}
        >
            <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                    <thead>
                        <tr>
                            <th className={headerCell} style={{ left: 0, minWidth: 180, position: 'sticky' }}>
                                Operator
                            </th>
                            {days.map((day) => (
                                <th key={day.iso} className={`${headerCell} text-center`} style={{ minWidth: 130 }}>
                                    <div>{day.label}</div>
                                    <div className="text-[9.5px] font-mono tabular-nums text-text-tertiary mt-0.5">
                                        {SHORT_DAY_FORMATTER.format(parseYmd(day.iso))}
                                    </div>
                                </th>
                            ))}
                            <th className={`${headerCell} text-right`} style={{ minWidth: 80 }}>
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {operatorRows.map((op) => {
                            /** Operator-level YPH for the week — null when
                             *  we don't have any yardage matched (mixer
                             *  drivers will have it, other positions won't). */
                            const opYph = op.weekHours > 0 && op.weekYardage > 0 ? op.weekYardage / op.weekHours : null
                            const isLowOpYph = opYph != null && opYph < YPH_TARGET
                            return (
                                <tr key={op.id} className="border-t border-border-light">
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <span className="font-semibold text-text-primary truncate">{op.name}</span>
                                            <span className="font-mono tabular-nums text-[10.5px] text-text-tertiary">
                                                {op.badge || '—'} · {op.plantCode || '—'}
                                            </span>
                                        </div>
                                    </td>
                                    {days.map((day) => (
                                        <td
                                            key={day.iso}
                                            className="border-l border-border-light align-top"
                                            style={{ padding: 0 }}
                                        >
                                            <ShiftCell
                                                accent={accent}
                                                shift={op.byDay[day.iso] || null}
                                                yardage={op.yardageByDay?.[day.iso] || 0}
                                            />
                                        </td>
                                    ))}
                                    <td className="border-l border-border-light px-3 py-2 text-right align-top">
                                        <span className="font-mono tabular-nums font-bold text-text-primary text-[13px]">
                                            {fmtHours(op.weekHours)}
                                        </span>
                                        {opYph != null && (
                                            <div
                                                className="text-[10.5px] font-mono tabular-nums mt-0.5"
                                                style={{ color: 'var(--text-secondary)' }}
                                                title={`${fmtFloat(opYph, 1)} yards / hour across the week${isLowOpYph ? ` (below ${YPH_TARGET} target)` : ''}`}
                                            >
                                                {fmtFloat(opYph, 1)} y/h
                                            </div>
                                        )}
                                        {op.redFlags > 0 && (
                                            <div className="text-[10px] text-text-primary mt-0.5">
                                                <i className="fas fa-triangle-exclamation mr-1 text-[9px]" />
                                                {op.redFlags} red flag{op.redFlags === 1 ? '' : 's'}
                                            </div>
                                        )}
                                        {op.exceptions > 0 && op.exceptions > op.redFlags && (
                                            <div className="text-[10px] text-text-primary mt-0.5">
                                                <i className="fas fa-triangle-exclamation mr-1 text-[9px]" />
                                                {op.exceptions - op.redFlags} exc.
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-bg-secondary border-t-2 border-border-light">
                            <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-secondary">
                                Day totals
                            </td>
                            {days.map((day) => (
                                <td
                                    key={day.iso}
                                    className="border-l border-border-light px-2 py-2 text-center font-mono tabular-nums font-semibold text-text-primary text-[12px]"
                                >
                                    {fmtHours(totalsByDay[day.iso] || 0)}
                                </td>
                            ))}
                            <td className="border-l border-border-light px-3 py-2 text-right font-mono tabular-nums font-bold text-text-primary text-[13px]">
                                {fmtHours(weekTotal)}
                                {weekYardageTotal > 0 && weekTotal > 0 && (
                                    <div
                                        className="text-[10.5px] font-mono tabular-nums mt-0.5"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {fmtFloat(weekYardageTotal / weekTotal, 1)} y/h
                                    </div>
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </Panel>
    )
}

/** Week navigator — prev / next chevrons + the active week label, plus
 *  a "Latest" jump-back button when the user has scrolled into older
 *  weeks. Visual chrome matches the period navigator on the Statistics
 *  controls so the two surfaces feel like one product.
 *
 *  "Older" advances index +1 (the array is sorted newest-first), "Newer"
 *  decrements. Disabled states pin the edges so the user can't drift
 *  out of range. */
function WeekNavigator({ accentColor, count, label, onIndexChange, position }) {
    const canGoOlder = position < count - 1
    const canGoNewer = position > 0
    return (
        <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11.5px] text-text-tertiary">
                Showing week {position + 1} of {count}
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1 py-0.5 bg-bg-tertiary border border-border-light">
                <button
                    type="button"
                    onClick={() => canGoOlder && onIndexChange(position + 1)}
                    disabled={!canGoOlder}
                    className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Older week"
                    aria-label="Previous week"
                >
                    <i className="fas fa-chevron-left text-xs" />
                </button>
                <span className="px-2 text-xs font-semibold text-text-primary">{label}</span>
                <button
                    type="button"
                    onClick={() => canGoNewer && onIndexChange(position - 1)}
                    disabled={!canGoNewer}
                    className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Newer week"
                    aria-label="Next week"
                >
                    <i className="fas fa-chevron-right text-xs" />
                </button>
                {position > 0 && (
                    <button
                        type="button"
                        onClick={() => onIndexChange(0)}
                        className="border-none bg-transparent cursor-pointer px-2 py-1 rounded text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        Latest
                    </button>
                )}
            </div>
        </div>
    )
}

/** Clamps the active week index when the underlying `weekTables` array
 *  changes shape (different time-range period, filter narrows the rows
 *  down to a single week, etc.). Snap back to the newest week so the
 *  user always lands on a valid week — never on an empty rendering
 *  slot because the previous index is now out of range. */
function WeekCarousel({ accent, activeWeekIndex, setActiveWeekIndex, weekTables }) {
    useEffect(() => {
        if (activeWeekIndex >= weekTables.length && weekTables.length > 0) {
            setActiveWeekIndex(0)
        }
    }, [activeWeekIndex, setActiveWeekIndex, weekTables.length])

    const safeIndex = Math.max(0, Math.min(activeWeekIndex, weekTables.length - 1))
    const week = weekTables[safeIndex]
    if (!week) return null

    return (
        <>
            {weekTables.length > 1 && (
                <WeekNavigator
                    accentColor={accent}
                    count={weekTables.length}
                    label={week.weekLabel}
                    onIndexChange={setActiveWeekIndex}
                    position={safeIndex}
                />
            )}
            <WeekTable
                accent={accent}
                days={week.days}
                operatorRows={week.operatorRows}
                totalsByDay={week.totalsByDay}
                weekLabel={week.weekLabel}
                weekTotal={week.weekTotal}
                weekYardageTotal={week.weekYardageTotal}
            />
        </>
    )
}

/** Operator-row sort comparator factory. Sort options are limited to the
 *  ones that make sense in a per-week grid (date-based sort drops out
 *  since the date is now a column, not a row). */
function makeRowComparator(sortId) {
    return (a, b) => {
        if (sortId === 'hours') return b.weekHours - a.weekHours
        if (sortId === 'varianceDesc') {
            const aVar = Math.abs(a.weekHours - a.weekScheduledHours)
            const bVar = Math.abs(b.weekHours - b.weekScheduledHours)
            return bVar - aVar
        }
        return a.name.localeCompare(b.name)
    }
}

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
    /** Active week the user is viewing. `weekTables` is sorted newest-
     *  first, so index 0 = current/latest week. Increment moves older,
     *  decrement moves newer. */
    const [activeWeekIndex, setActiveWeekIndex] = useState(0)

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

    /** Pivot the filtered shifts into a list of week-tables. Each week:
     *    - has Mon–Sat day metadata
     *    - has one row per operator with `byDay` keyed by yyyy-mm-dd
     *    - has totalsByDay (sum of actual hours per day across ops)
     *    - has a weekTotal (sum of all op weekHours)
     *  Sorted newest-week first so the dispatcher sees current week up
     *  top when the range spans multiple weeks. */
    const weekTables = useMemo(() => {
        const sortRow = makeRowComparator(filters.controls.sort)
        const weekBuckets = new Map()
        for (const shift of filters.filtered) {
            const monday = mondayOf(shift.shiftDate)
            if (!monday) continue
            if (!weekBuckets.has(monday)) weekBuckets.set(monday, new Map())
            const opMap = weekBuckets.get(monday)
            const opKey = shift.dayforceEmployeeId
            if (!opMap.has(opKey)) {
                opMap.set(opKey, {
                    badge: shift.badge,
                    byDay: {},
                    exceptions: 0,
                    id: opKey,
                    name: shift.name,
                    plantCode: shift.plantCode,
                    redFlags: 0,
                    weekHours: 0,
                    weekScheduledHours: 0,
                    weekYardage: 0,
                    yardageByDay: {}
                })
            }
            const op = opMap.get(opKey)
            op.byDay[shift.shiftDate] = shift
            op.weekHours += Number(shift.actualHours) || 0
            op.weekScheduledHours += Number(shift.scheduledHours) || 0
            /* Yards delivered on this shift — pulled from the tickets
             * roll-up keyed by the operator's canonical name. Falls back
             * to 0 if there's no match (non-mixer operator, name
             * mismatch). */
            const canon = canonicalNameKey(shift.name)
            const yardsThisDay = canon ? yardageByOperatorByDay.get(canon)?.[shift.shiftDate] || 0 : 0
            if (yardsThisDay > 0) {
                op.yardageByDay[shift.shiftDate] = yardsThisDay
                op.weekYardage += yardsThisDay
            }
            /* Use the filtered exception text so padded-shift cases
             * (early-in / late-out) don't get counted as real exceptions
             * in the per-operator rollup. */
            const effExc = filterExceptionText(shift.exceptionText)
            if (effExc) op.exceptions += 1
            /* Per-shift YPH check — when actualHours > 0 and yards > 0
             * and yph < target, count as a red flag. Re-evaluated here
             * (not just in the cell) so the right-column rollup stays
             * in lockstep with what the cell renders. */
            const shiftHours = Number(shift.actualHours) || 0
            const isLowYphHere = shiftHours > 0 && yardsThisDay > 0 && yardsThisDay / shiftHours < YPH_TARGET
            if (shiftHasRedFlag(shift) || isLowYphHere) {
                op.redFlags += 1
                /* Red-flagged shifts always count as exceptions for the
                 * total, even if Dayforce didn't tag them. Keeps the
                 * "X exc." rollup honest when a long shift slipped past
                 * the platform's own exception flags. */
                if (!effExc) op.exceptions += 1
            }
        }

        return [...weekBuckets.entries()]
            .map(([monday, opMap]) => {
                const days = WEEKDAYS.map((wd) => ({
                    full: wd.full,
                    iso: addDays(monday, wd.offset),
                    label: wd.label
                }))
                const operatorRows = [...opMap.values()].sort(sortRow)
                const totalsByDay = {}
                let weekTotal = 0
                let weekYardageTotal = 0
                for (const op of operatorRows) {
                    weekYardageTotal += op.weekYardage || 0
                    for (const day of days) {
                        const s = op.byDay[day.iso]
                        if (!s || s.isPto) continue
                        totalsByDay[day.iso] = (totalsByDay[day.iso] || 0) + (Number(s.actualHours) || 0)
                        weekTotal += Number(s.actualHours) || 0
                    }
                }
                return {
                    days,
                    monday,
                    operatorRows,
                    totalsByDay,
                    weekLabel: fmtWeekLabel(monday),
                    weekTotal,
                    weekYardageTotal
                }
            })
            .sort((a, b) => b.monday.localeCompare(a.monday))
    }, [filters.controls.sort, filters.filtered, yardageByOperatorByDay])

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
                        message="No shifts match these filters. Widen the date range above or clear the search / role filters."
                    />
                </Panel>
            ) : (
                <WeekCarousel
                    accent={accent}
                    activeWeekIndex={activeWeekIndex}
                    setActiveWeekIndex={setActiveWeekIndex}
                    weekTables={weekTables}
                />
            )}
        </div>
    )
}

export default DayforceSchedulesPage
