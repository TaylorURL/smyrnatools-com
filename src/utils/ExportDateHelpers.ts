import { ReportUtility } from './ReportUtility'

/**
 * Date helpers for week-window math used by report fetching. Reports are
 * keyed by the Monday of the ISO week they represent, so most helpers here
 * either normalize an arbitrary date into that Monday or derive a query
 * window that brackets it.
 */

export function sameIsoDay(a, b) {
    return a && b && a.slice(0, 10) === b.slice(0, 10)
}

export function toMondayIso(dateValue) {
    if (!dateValue) return ''
    const parsed = new Date(dateValue)
    return isNaN(parsed) ? '' : ReportUtility.getMondayISO(parsed)
}

export function formatDateIso(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function toMonthKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function getPreviousWeekIso(weekIso) {
    if (!weekIso) return null
    const normalized = toMondayIso(weekIso) || String(weekIso).slice(0, 10)
    const [year, month, day] = normalized.split('-').map(Number)
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() - 7)
    return formatDateIso(date)
}

export function getWeekWindow(weekIso) {
    const targetMondayIso = ReportUtility.getMondayISO(weekIso)
    if (!targetMondayIso) return null
    const targetMondayDate = new Date(targetMondayIso + 'T00:00:00Z')
    const prevSunday = new Date(targetMondayDate)
    prevSunday.setUTCDate(prevSunday.getUTCDate() - 1)
    const windowEnd = new Date(targetMondayDate)
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 8)
    return { qEnd: windowEnd.toISOString(), qStart: prevSunday.toISOString(), targetMondayIso }
}

/**
 * Shared guard for week-window queries. Returns the window or null when the
 * ISO date is unparseable so the caller can short-circuit with EMPTY_WEEK_RESULT.
 */
export function resolveWeekWindow(weekIso) {
    const window = getWeekWindow(weekIso)
    return window ?? null
}

export function anchorMatchesMonday(report, targetMondayIso) {
    const weekField = report.week || report.report_date_range_start || report?.data?.report_date
    return sameIsoDay(toMondayIso(weekField), targetMondayIso)
}
