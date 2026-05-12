import { useEffect, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { ReportUtility } from '../../utils/ReportUtility'

const EMPTY_ARRAY = []
function toMondayIso(dateInput) {
    if (!dateInput) return ''
    const dt = new Date(dateInput)
    if (isNaN(dt)) return ''
    return ReportUtility.getMondayISO(dt)
}
function sameIsoDay(a, b) {
    return a && b && a.slice(0, 10) === b.slice(0, 10)
}
function buildDateWindow(targetMondayIso, offsetWeeks = 0) {
    const targetMondayDate = new Date(targetMondayIso + 'T00:00:00Z')
    targetMondayDate.setUTCDate(targetMondayDate.getUTCDate() + offsetWeeks * 7)
    const prevSunday = new Date(targetMondayDate)
    prevSunday.setUTCDate(prevSunday.getUTCDate() - 1)
    const windowEnd = new Date(targetMondayDate)
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 8)
    return {
        mondayDate: targetMondayDate,
        mondayIso: ReportUtility.getMondayISO(targetMondayDate),
        qEnd: windowEnd.toISOString(),
        qStart: prevSunday.toISOString()
    }
}
async function fetchReportsByDateRange(reportName, qStart, qEnd, extraFilters = {}) {
    let query = Database.from('reports')
        .select('id,data,week,report_date_range_start,completed,submitted_at,user_id')
        .eq('report_name', reportName)
        .gte('week', qStart)
        .lt('week', qEnd)
    Object.entries(extraFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query = query.eq(key, value)
    })
    let { data } = await query
    if (!Array.isArray(data)) data = EMPTY_ARRAY
    if (data.length === 0) {
        let fallbackQuery = Database.from('reports')
            .select('id,data,week,report_date_range_start,completed,submitted_at,user_id')
            .eq('report_name', reportName)
            .gte('report_date_range_start', qStart)
            .lt('report_date_range_start', qEnd)
        Object.entries(extraFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) fallbackQuery = fallbackQuery.eq(key, value)
        })
        const resp = await fallbackQuery
        if (Array.isArray(resp.data)) data = resp.data
    }
    return data
}
function filterByMondayIso(reports, targetMondayIso) {
    return reports.filter((r) => {
        const weekField = r.week || r.report_date_range_start
        const mondayIso = toMondayIso(weekField)
        return sameIsoDay(mondayIso, targetMondayIso)
    })
}
function sortByCompletedThenSubmittedAt(reports) {
    return [...reports].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? -1 : 1
        return (b.submitted_at || '').localeCompare(a.submitted_at || '')
    })
}
function pickBestReport(reports) {
    const sorted = sortByCompletedThenSubmittedAt(reports)
    return sorted.find((r) => r.completed) || sorted[0] || null
}
/** Fetches the report from the week prior to the given weekIso for week-over-week comparison. */
export function usePreviousWeekReport(weekIso, reportName, extraFilters = {}) {
    const [previousReport, setPreviousReport] = useState(null)
    const [loading, setLoading] = useState(false)
    const extraFiltersKey = JSON.stringify(extraFilters)
    useEffect(() => {
        const parsedFilters = JSON.parse(extraFiltersKey)
        let cancelled = false
        async function load() {
            if (!weekIso) {
                setPreviousReport(null)
                return
            }
            const targetMondayIso = ReportUtility.getMondayISO(weekIso)
            if (!targetMondayIso) {
                setPreviousReport(null)
                return
            }
            setLoading(true)
            const { qStart, qEnd, mondayIso } = buildDateWindow(targetMondayIso, -1)
            try {
                const reports = await fetchReportsByDateRange(reportName, qStart, qEnd, parsedFilters)
                const filtered = filterByMondayIso(reports, mondayIso)
                const pick = pickBestReport(filtered)
                if (!cancelled) setPreviousReport(pick)
            } catch (err) {
                console.error(`Error loading previous ${reportName}:`, err)
                if (!cancelled) setPreviousReport(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [weekIso, reportName, extraFiltersKey])
    return { loading, previousReport }
}
/** Fetches a single report matching the given week and report type, with optional extra database filters. */
export function useReportForWeek(weekIso, reportName, extraFilters = {}) {
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(false)
    const extraFiltersKey = JSON.stringify(extraFilters)
    useEffect(() => {
        const parsedFilters = JSON.parse(extraFiltersKey)
        let cancelled = false
        async function load() {
            if (!weekIso) {
                setReport(null)
                return
            }
            const targetMondayIso = ReportUtility.getMondayISO(weekIso)
            if (!targetMondayIso) {
                setReport(null)
                return
            }
            setLoading(true)
            const { qStart, qEnd, mondayIso } = buildDateWindow(targetMondayIso, 0)
            try {
                const reports = await fetchReportsByDateRange(reportName, qStart, qEnd, parsedFilters)
                const filtered = filterByMondayIso(reports, mondayIso)
                const pick = pickBestReport(filtered)
                if (!cancelled) setReport(pick)
            } catch (err) {
                console.error(`Error loading ${reportName}:`, err)
                if (!cancelled) setReport(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [weekIso, reportName, extraFiltersKey])
    return { loading, report }
}
/** Resolves the set of plant codes the current user's region is allowed to access. */
export function useAllowedPlantCodes(regionCode, service) {
    const [allowedCodes, setAllowedCodes] = useState(null)
    useEffect(() => {
        let mounted = true
        async function loadCodes() {
            if (!service || !regionCode) {
                setAllowedCodes(null)
                return
            }
            const codes = await service.getAllowedPlantCodes(regionCode)
            if (mounted) setAllowedCodes(codes)
        }
        loadCodes()
        return () => {
            mounted = false
        }
    }, [regionCode, service])
    return allowedCodes
}
/** Filters maintenance items to only those belonging to plants within the allowed plant code set. */
export function filterMaintenanceItemsByPlant(maintenanceItems, plants, allowedCodes) {
    const plantCodes = plants ? new Set(plants.map((p) => p.plant_code || p.code).filter(Boolean)) : null
    const baseFiltered =
        maintenanceItems && plantCodes
            ? maintenanceItems.filter((item) => plantCodes.has(item.plant_code))
            : maintenanceItems || EMPTY_ARRAY
    if (!allowedCodes) return baseFiltered
    return baseFiltered.filter((item) =>
        allowedCodes.has(
            String(item.plant_code || '')
                .trim()
                .toUpperCase()
        )
    )
}
