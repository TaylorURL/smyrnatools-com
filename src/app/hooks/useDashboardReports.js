import { useEffect, useMemo, useState } from 'react'

import { ReportService } from '../../services/ReportService'
import ReportUtility from '../../utils/ReportUtility'
import { oneOffReportTypeMap, reportTypeMap } from '../types/ReportTypes'

/** snake_case report name → human title from reportTypes config. */
const formatReportName = (name) => reportTypeMap[name]?.title || oneOffReportTypeMap[name]?.title || name

/**
 * Bootstrap report-system data for the Dashboard. Fetches the year's
 * plant manager reports + this week's overdue assignments, then derives
 * compact rollups (this-week submission count, draft count, top overdue
 * report names, etc.) used by `DashboardReportsSection`.
 */
export function useDashboardReports({ refreshKey } = {}) {
    const [overdue, setOverdue] = useState([])
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const todayIso = ReportUtility.getTodayISODate()
    const currentMondayIso = useMemo(() => ReportUtility.getMondayISO(todayIso), [todayIso])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        const year = new Date().getFullYear()
        Promise.all([
            ReportService.fetchPlantManagerReportsForYear(year).catch(() => []),
            ReportService.fetchOverdueAssignments(new Date()).catch(() => [])
        ])
            .then(([yearReports, overdueRows]) => {
                if (cancelled) return
                setReports(Array.isArray(yearReports) ? yearReports : [])
                setOverdue(Array.isArray(overdueRows) ? overdueRows : [])
                setLoading(false)
            })
            .catch(() => {
                if (cancelled) return
                setReports([])
                setOverdue([])
                setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [refreshKey])

    return useMemo(() => {
        const reportsThisWeek = reports.filter((r) => {
            if (!r?.week) return false
            const monday = ReportUtility.getMondayISO(new Date(r.week))
            return monday === currentMondayIso
        })
        const submittedThisWeek = reportsThisWeek.filter((r) => r.completed).length

        // "Expected this week" = what's been submitted plus what's still
        // overdue for the current week. Lets us derive an at-a-glance
        // weekly completion rate the dashboard can colour by health.
        const overdueThisWeek = overdue.filter((row) => row?.week === currentMondayIso).length
        const expectedThisWeek = submittedThisWeek + overdueThisWeek
        const weeklyCompletionRate =
            expectedThisWeek > 0 ? Math.round((submittedThisWeek / expectedThisWeek) * 100) : null

        // Group overdue rows by report type for the top-N summary, formatted
        // to the human-readable title from reportTypes config.
        const overdueByReport = overdue.reduce((acc, row) => {
            const key = row?.report_name || 'unknown'
            acc[key] = (acc[key] || 0) + 1
            return acc
        }, {})
        const topOverdueReports = Object.entries(overdueByReport)
            .map(([name, count]) => ({ count, name: formatReportName(name) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

        // Bucket overdue rows by user so the dashboard can call out the
        // names that owe the most reports.
        const overdueByUser = overdue.reduce((acc, row) => {
            const key = row?.userId || 'unknown'
            const display = `${row?.first_name || ''} ${row?.last_name || ''}`.trim() || 'Unknown'
            const plant = row?.plant_code || ''
            if (!acc[key]) acc[key] = { count: 0, name: display, plant }
            acc[key].count += 1
            return acc
        }, {})
        const topOverdueUsers = Object.values(overdueByUser)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

        return {
            currentMondayIso,
            expectedThisWeek,
            loading,
            overdueCount: overdue.length,
            submittedThisWeek,
            topOverdueReports,
            topOverdueUsers,
            weeklyCompletionRate,
            yearReportCount: reports.length
        }
    }, [reports, overdue, loading, currentMondayIso])
}
