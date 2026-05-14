import { useCallback, useMemo } from 'react'

import { ReportUtility } from '../../utils/ReportUtility'
import { formatRange, labelForOffset, REPORTS_START_DATE, weekIsoOffset } from '../constants/reportsViewConstants'

/**
 * Computes everything the My Reports / Review tabs need to render the week
 * ribbon, the deadline fuse, the overdue carryover banner, and the per-week
 * track-card data — all derived from `myReportsByWeek` and the active
 * `activeWeekIso` selection. Centralised here so the orchestrator stays a
 * thin shell.
 */
export function useReportsWeekTimeline({ activeWeekIso, myReportsByWeek, searchLower }) {
    const thisWeekIso = useMemo(() => ReportUtility.getLastNWeekIsos(1, new Date())[0] || '', [])
    const prevWeekIso = useMemo(() => weekIsoOffset(thisWeekIso, -1), [thisWeekIso])
    const prev2WeekIso = useMemo(() => weekIsoOffset(thisWeekIso, -2), [thisWeekIso])
    const nextWeekIso = useMemo(() => weekIsoOffset(thisWeekIso, 1), [thisWeekIso])
    const selectedWeekIso = activeWeekIso || thisWeekIso
    const selectedWeekRange = formatRange(selectedWeekIso)
    const isSelectedWeekFuture = selectedWeekIso === nextWeekIso
    const isSelectedWeekThis = selectedWeekIso === thisWeekIso

    const daysLeftThisWeek = useMemo(() => {
        const cutoff = ReportUtility.getLateCutoff(thisWeekIso)
        if (!cutoff) return 0
        const diff = cutoff.getTime() - Date.now()
        if (diff <= 0) return 0
        return Math.min(8, Math.max(0, Math.ceil(diff / 86400000)))
    }, [thisWeekIso])

    const overdueSourceItems = useMemo(() => {
        const now = Date.now()
        const pool = []
        ;[prevWeekIso, prev2WeekIso].forEach((iso) => {
            const cutoff = ReportUtility.getLateCutoff(iso)
            if (!cutoff || cutoff.getTime() >= now) return
            const items = myReportsByWeek?.[iso]
            if (Array.isArray(items)) {
                items.forEach((it) => {
                    if (!it.completed) pool.push({ ...it, weekIso: iso })
                })
            }
        })
        return pool
    }, [myReportsByWeek, prevWeekIso, prev2WeekIso])

    const weekRibbonData = useMemo(() => {
        const now = Date.now()
        const countUnfinished = (iso) => (myReportsByWeek?.[iso] || []).filter((i) => !i.completed).length
        const weeksSinceStart = Math.max(4, ReportUtility.getTotalWeeksSince(REPORTS_START_DATE))
        const pastIsos = ReportUtility.getLastNWeekIsos(weeksSinceStart, new Date())
        const rows = [
            {
                hint: 'Opens Mon',
                iso: nextWeekIso,
                label: 'Next Week',
                range: formatRange(nextWeekIso),
                status: 'future'
            }
        ]
        pastIsos.forEach((iso, idx) => {
            if (idx === 0) {
                rows.push({
                    hint: daysLeftThisWeek === 0 ? 'Closes today' : `${daysLeftThisWeek}d left`,
                    iso,
                    label: 'This Week',
                    range: formatRange(iso),
                    status: 'open'
                })
                return
            }
            const cutoff = ReportUtility.getLateCutoff(iso)
            const cutoffPassed = !cutoff || cutoff.getTime() < now
            const missing = countUnfinished(iso)
            const isLate = cutoffPassed && missing > 0
            rows.push({
                hint: isLate ? `${missing} overdue` : !cutoffPassed ? 'Grace period' : 'Closed',
                iso,
                label: labelForOffset(idx),
                range: formatRange(iso),
                status: isLate ? 'late' : 'closed'
            })
        })
        return rows
    }, [daysLeftThisWeek, myReportsByWeek, nextWeekIso])

    const fuseForSelectedWeek = useMemo(() => {
        const { monday } = ReportUtility.getWeekDatesFromIso(selectedWeekIso)
        const cutoff = ReportUtility.getLateCutoff(selectedWeekIso)
        if (!monday || !cutoff) return { caption: 'days left', daysLeft: 0, mode: 'current', todayIndex: -1 }
        const now = Date.now()
        if (now < monday.getTime()) {
            const daysUntil = Math.max(0, Math.ceil((monday.getTime() - now) / 86400000))
            return { caption: 'until opens', daysLeft: daysUntil, mode: 'future', todayIndex: -1 }
        }
        if (now > cutoff.getTime()) return { caption: 'week closed', daysLeft: 0, mode: 'past', todayIndex: -1 }
        const elapsed = Math.max(0, Math.min(6, Math.floor((now - monday.getTime()) / 86400000)))
        const daysLeft = Math.min(8, Math.max(0, Math.ceil((cutoff.getTime() - now) / 86400000)))
        return { caption: `day${daysLeft === 1 ? '' : 's'} left`, daysLeft, mode: 'current', todayIndex: elapsed }
    }, [selectedWeekIso])

    /* ── My Reports derived data ───────────────────────────────── */
    const myItemsForSelectedWeek = useMemo(() => {
        const items = myReportsByWeek?.[selectedWeekIso] || []
        if (!searchLower) return items
        return items.filter(
            (item) => item.title?.toLowerCase().includes(searchLower) || item.name?.toLowerCase().includes(searchLower)
        )
    }, [myReportsByWeek, selectedWeekIso, searchLower])

    const historyWeekIsos = useMemo(() => ReportUtility.getLastNWeekIsos(5, new Date()).slice(1), [])
    const historyByReportName = useMemo(() => {
        const out = {}
        historyWeekIsos.forEach((iso) => {
            const items = myReportsByWeek?.[iso] || []
            items.forEach((item) => {
                if (!out[item.name]) out[item.name] = {}
                out[item.name][iso] = item.completed ? 'done' : 'miss'
            })
        })
        return out
    }, [historyWeekIsos, myReportsByWeek])
    const getHistoryForName = useCallback(
        (name) => historyWeekIsos.map((iso) => historyByReportName[name]?.[iso] || 'due').reverse(),
        [historyByReportName, historyWeekIsos]
    )
    const recentSubmissions = useMemo(() => {
        const flattened = Object.values(myReportsByWeek || {}).flat()
        return flattened
            .filter((i) => i.completed && (i.report?.submitted_at || i.submittedAt))
            .map((i) => ({
                id: i.id,
                kind:
                    i.name === 'qc_strength' ? 'qc_strength' : i.name === 'third_party_lab' ? 'third_party_lab' : null,
                title: i.title || i.name,
                when: ReportUtility.formatDate(i.report?.submitted_at || i.submittedAt)
            }))
            .sort((a, b) => (a.when < b.when ? 1 : -1))
            .slice(0, 3)
    }, [myReportsByWeek])

    const myReportsSummary = useMemo(() => {
        const items = myReportsByWeek?.[selectedWeekIso] || []
        const submitted = items.filter((i) => i.completed).length
        const pending = items.length - submitted
        return { assigned: items.length, overdueCarryover: overdueSourceItems.length, pending, submitted }
    }, [myReportsByWeek, selectedWeekIso, overdueSourceItems])

    return {
        daysLeftThisWeek,
        fuseForSelectedWeek,
        getHistoryForName,
        isSelectedWeekFuture,
        isSelectedWeekThis,
        myItemsForSelectedWeek,
        myReportsSummary,
        nextWeekIso,
        overdueSourceItems,
        prev2WeekIso,
        prevWeekIso,
        recentSubmissions,
        selectedWeekIso,
        selectedWeekRange,
        thisWeekIso,
        weekRibbonData
    }
}
