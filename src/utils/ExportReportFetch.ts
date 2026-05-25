import { Database } from '../services/DatabaseService'
import { EMPTY_WEEK_RESULT, REPORT_COLUMNS_FULL, REPORT_COLUMNS_SHORT } from './ExportConstants'
import { anchorMatchesMonday, resolveWeekWindow, toMondayIso, toMonthKey } from './ExportDateHelpers'
import { normNumeric, normUpper, numericPlantComparator } from './ExportPlantHelpers'

/**
 * Report fetching + de-duplication. Reports may be stored against either the
 * `week` column or a `report_date_range_start` range column; the dual-query
 * fetcher unions both and dedupes. `isBetterReport`/`pickBestReport`
 * encapsulate the "completed beats incomplete, newer beats older" rule used
 * to collapse duplicate submissions for the same week/plant.
 */

export function isBetterReport(candidate, existing) {
    if (candidate.completed !== existing.completed) return candidate.completed
    return (candidate.submitted_at || '') > (existing.submitted_at || '')
}

export function pickBestReport(reports) {
    if (!reports.length) return null
    return reports.reduce((best, current) => (isBetterReport(current, best) ? current : best))
}

export function deduplicateByWeek(reports, dateFieldExtractor, upToIso) {
    const bestByWeek = new Map()
    for (const report of reports) {
        const mondayIso = toMondayIso(dateFieldExtractor(report))
        if (!mondayIso || (upToIso && mondayIso > upToIso)) continue
        const existing = bestByWeek.get(mondayIso)
        if (!existing || isBetterReport(report, existing)) bestByWeek.set(mondayIso, report)
    }
    return bestByWeek
}

async function fetchReportsByWeekWindow(reportName, weekIso) {
    const window = resolveWeekWindow(weekIso)
    if (!window) return EMPTY_WEEK_RESULT
    const { targetMondayIso, qStart, qEnd } = window
    const { data } = await Database.from('reports')
        .select(REPORT_COLUMNS_SHORT)
        .eq('report_name', reportName)
        .gte('week', qStart)
        .lt('week', qEnd)
    const filtered = (Array.isArray(data) ? data : []).filter((report) => anchorMatchesMonday(report, targetMondayIso))
    return { reports: filtered, targetMondayIso }
}

async function fetchReportsDualQuery(reportName, weekIso) {
    const window = resolveWeekWindow(weekIso)
    if (!window) return EMPTY_WEEK_RESULT
    const { targetMondayIso, qStart, qEnd } = window
    const [byWeek, byRange] = await Promise.all([
        Database.from('reports')
            .select(REPORT_COLUMNS_FULL)
            .eq('report_name', reportName)
            .gte('week', qStart)
            .lt('week', qEnd),
        Database.from('reports')
            .select(REPORT_COLUMNS_FULL)
            .eq('report_name', reportName)
            .gte('report_date_range_start', qStart)
            .lt('report_date_range_start', qEnd)
    ])
    const mergedMap = new Map()
    for (const report of [...(byWeek.data || []), ...(byRange.data || [])]) {
        if (report && !mergedMap.has(report.id)) mergedMap.set(report.id, report)
    }
    const filtered = [...mergedMap.values()].filter((report) => anchorMatchesMonday(report, targetMondayIso))
    return { reports: filtered, targetMondayIso }
}

export async function fetchEfficiencyReports(plants, weekIso) {
    const plantCodes = Array.isArray(plants) ? plants.map((p) => p.plant_code).filter(Boolean) : []
    if (!weekIso || plantCodes.length === 0) return []
    const { reports } = await fetchReportsDualQuery('plant_production', weekIso)
    const upperCodeSet = new Set(plantCodes.map(normUpper))
    const numericCodeSet = new Set(plantCodes.map(normNumeric))
    const matchingReports = reports.filter((report) => {
        const plantCode = report?.data?.plant
        if (!plantCode) return false
        return upperCodeSet.has(normUpper(plantCode)) || numericCodeSet.has(normNumeric(plantCode))
    })
    const bestByPlant = new Map()
    for (const report of matchingReports) {
        const key = normUpper(report.data.plant)
        const existing = bestByPlant.get(key)
        if (!existing || isBetterReport(report, existing)) bestByPlant.set(key, report)
    }
    return [...bestByPlant.values()]
        .sort((a, b) => numericPlantComparator(String(a.data?.plant || ''), String(b.data?.plant || '')))
        .map((report) => ({
            completed: report.completed,
            data: report.data,
            id: report.id,
            plant_code: report.data.plant,
            plant_name: report.data.plant,
            report_date: report.data.report_date || '',
            rows: Array.isArray(report.data.rows) ? report.data.rows : [],
            submitted_at: report.submitted_at
        }))
}

export async function fetchAggregateProductionReport(weekIso) {
    if (!weekIso) return null
    const { reports } = await fetchReportsDualQuery('aggregate_production', weekIso)
    return pickBestReport(reports)
}

export async function fetchAllAggregateReports(upToWeekIso) {
    const { data: reports } = await Database.from('reports')
        .select(REPORT_COLUMNS_FULL)
        .eq('report_name', 'aggregate_production')
        .order('week', { ascending: false })
    if (!Array.isArray(reports)) return { monthly: [], yearly: [] }
    const bestByWeek = deduplicateByWeek(
        reports,
        (report) => report.week || report.report_date_range_start,
        upToWeekIso
    )
    const currentDate = new Date(upToWeekIso + 'T00:00:00Z')
    const currentMonthKey = toMonthKey(currentDate)
    const currentYear = currentDate.getUTCFullYear()
    const monthly = []
    const yearly = []
    bestByWeek.forEach((report, mondayIso) => {
        const weekDate = new Date(mondayIso + 'T00:00:00Z')
        if (toMonthKey(weekDate) === currentMonthKey) monthly.push(report.data)
        if (weekDate.getUTCFullYear() === currentYear) yearly.push(report.data)
    })
    return { monthly, yearly }
}

export async function fetchRMIReport(weekIso) {
    if (!weekIso) return null
    const { reports } = await fetchReportsByWeekWindow('ready_mix_instructor', weekIso)
    return pickBestReport(reports)?.data ?? null
}

export async function fetchAllMonthlyGMReports() {
    const { data: reports } = await Database.from('reports')
        .select(REPORT_COLUMNS_SHORT)
        .eq('report_name', 'general_manager')
        .order('week', { ascending: false })
    if (!Array.isArray(reports)) return []
    const bestByWeek = deduplicateByWeek(reports, (report) => report.week)
    const countWeeksInMonth = (year, month) => {
        const lastDay = new Date(Date.UTC(year, month, 0))
        let count = 0
        const cursor = new Date(Date.UTC(year, month - 1, 1))
        while (cursor.getUTCDay() !== 1) cursor.setUTCDate(cursor.getUTCDate() + 1)
        while (cursor <= lastDay) {
            count++
            cursor.setUTCDate(cursor.getUTCDate() + 7)
        }
        return count || 4
    }
    let minDate = null
    let maxDate = null
    bestByWeek.forEach((_report, mondayIso) => {
        const weekDate = new Date(mondayIso + 'T00:00:00Z')
        if (!minDate || weekDate < minDate) minDate = weekDate
        if (!maxDate || weekDate > maxDate) maxDate = weekDate
    })
    const byMonth = new Map()
    if (minDate && maxDate) {
        const cursor = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1))
        const endBoundary = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1))
        while (cursor >= endBoundary) {
            const year = cursor.getUTCFullYear()
            const month = cursor.getUTCMonth() + 1
            const monthKey = `${year}-${String(month).padStart(2, '0')}`
            const monthName = cursor.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC', year: 'numeric' })
            byMonth.set(monthKey, {
                monthKey,
                monthName,
                reports: [],
                totalWeeks: countWeeksInMonth(year, month),
                weekIsos: new Set()
            })
            cursor.setUTCMonth(cursor.getUTCMonth() - 1)
        }
    }
    bestByWeek.forEach((report, mondayIso) => {
        const monthKey = toMonthKey(new Date(mondayIso + 'T00:00:00Z'))
        const monthEntry = byMonth.get(monthKey)
        if (monthEntry) {
            monthEntry.reports.push({ data: report.data, weekIso: mondayIso })
            monthEntry.weekIsos.add(mondayIso)
        }
    })
    return [...byMonth.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}
