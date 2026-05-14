import { useEffect, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { ReportService } from '../../services/ReportService'
import { UserService } from '../../services/UserService'
import { ReportUtility } from '../../utils/ReportUtility'

/** Fetches user display names for every user-id referenced in `reports`.
 *  Returns a `{ userId: "First Last" }` map keyed by id. */
async function fetchUserDisplayNames(userIds) {
    const namesMap = {}
    await Promise.all(
        userIds.map(async (id) => {
            const firstName = await UserService.getUserFirstName(id)
            const lastName = await UserService.getUserLastName(id)
            const fullName = `${firstName} ${lastName}`.trim()
            namesMap[id] = fullName || 'Unknown User'
        })
    )
    return namesMap
}

/** Looks up the home plant-code for each user id via `users_profiles`. */
async function fetchUsersPlantMap(userIds) {
    const usersMap = {}
    if (userIds.length === 0) return usersMap
    const { data: usersData } = await Database.from('users_profiles').select('id, plant_code').in('id', userIds)
    if (usersData) {
        usersData.forEach((u) => {
            usersMap[u.id] = u.plant_code
        })
    }
    return usersMap
}

/** Builds the `{ weekStr: hoursReceived }` map for a given destination
 *  plant by walking every report's `operators_sent_to_help` entries. */
function buildHoursReceivedMap(allData, effectivePlantCode) {
    const hoursReceivedByWeek = {}
    const effectivePlantCodeStr = String(effectivePlantCode || '')
    allData.forEach((report) => {
        const rawWeekStr = report.week.split('T')[0]
        const [y, m, d] = rawWeekStr.split('-').map(Number)
        const weekStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const helpEntries = report.data?.operators_sent_to_help || []
        if (!Array.isArray(helpEntries)) return
        helpEntries.forEach((entry) => {
            const destPlant = String(entry.destination_plant || '')
            if (destPlant !== effectivePlantCodeStr || !Array.isArray(entry.operators)) return
            if (!hoursReceivedByWeek[weekStr]) {
                hoursReceivedByWeek[weekStr] = 0
            }
            entry.operators.forEach((op) => {
                hoursReceivedByWeek[weekStr] += parseFloat(op.hours) || 0
            })
        })
    })
    return hoursReceivedByWeek
}

/** Constructs the full list of weeks in `currentMonth` starting on Sunday. */
function getAllMonthWeeks(currentYear, currentMonth) {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
    const weeks = []
    let weekStart = new Date(firstDayOfMonth)
    const dayOfWeek = weekStart.getDay()
    if (dayOfWeek !== 0) {
        weekStart.setDate(weekStart.getDate() - dayOfWeek)
    }
    while (weekStart <= lastDayOfMonth) {
        const weekStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
        weeks.push(weekStr)
        weekStart.setDate(weekStart.getDate() + 7)
    }
    return weeks
}

/** Loads the current-month timeline data: a chronological list of weeks
 *  with their metrics (raw + adjusted YPH, hours, yardage), plus a flag
 *  for placeholder weeks that don't yet have a submitted report. */
function useHistoricalReports(currentWeekIso, effectivePlantCode) {
    const [historicalData, setHistoricalData] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        async function fetchHistoricalReports() {
            if (!currentWeekIso || !effectivePlantCode) {
                setLoading(false)
                return
            }
            try {
                const weekDateStr = currentWeekIso.split('T')[0]
                const [year, month, day] = weekDateStr.split('-').map(Number)
                const currentDate = new Date(year, month - 1, day)
                const currentMonth = currentDate.getMonth()
                const currentYear = currentDate.getFullYear()
                const startOfMonthDate = new Date(currentYear, currentMonth, 1)
                const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate()
                const endOfMonthDate = new Date(currentYear, currentMonth, lastDay, 23, 59, 59, 999)
                const yearReports = await ReportService.fetchPlantManagerReportsForYear(currentYear)
                if (!mounted) {
                    setLoading(false)
                    return
                }
                const yearData = yearReports || []
                const data = yearData
                    .filter((r) => {
                        if (!r.completed || !r.week) return false
                        const weekTime = new Date(r.week).getTime()
                        return weekTime >= startOfMonthDate.getTime() && weekTime <= endOfMonthDate.getTime()
                    })
                    .sort((a, b) => new Date(a.week) - new Date(b.week))
                const hoursReceivedByWeek = ReportUtility.buildHoursReceivedByWeek(yearData, effectivePlantCode)
                const userIds = [...new Set(data.map((r) => r.user_id).filter(Boolean))]
                const usersMap = await fetchUsersPlantMap(userIds)
                const filteredByPlant = data.filter((report) => {
                    const reportPlant = report.data?.plant || usersMap[report.user_id] || ''
                    return (
                        reportPlant === effectivePlantCode ||
                        (effectivePlantCode && usersMap[report.user_id] === effectivePlantCode)
                    )
                })
                if (!mounted) return
                const currentWeekDateOnly = currentWeekIso.split('T')[0]
                const reportsByWeek = new Map()
                filteredByPlant.forEach((r) => {
                    reportsByWeek.set(r.week.split('T')[0], r)
                })
                const allMonthWeeks = getAllMonthWeeks(currentYear, currentMonth)
                const reports = allMonthWeeks
                    .map((weekStr) =>
                        buildTimelineEntry(weekStr, reportsByWeek, hoursReceivedByWeek, currentWeekDateOnly)
                    )
                    .sort((a, b) => new Date(a.weekIso) - new Date(b.weekIso))
                setHistoricalData(reports)
            } catch (err) {
                console.error('Error fetching historical reports:', err)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        fetchHistoricalReports()
        return () => {
            mounted = false
        }
    }, [currentWeekIso, effectivePlantCode])

    return { historicalData, loading }
}

/** Builds a single timeline entry — looks up the report for `weekStr`,
 *  falling back to a ±1 day match, then either renders a metrics record
 *  or a placeholder. */
function buildTimelineEntry(weekStr, reportsByWeek, hoursReceivedByWeek, currentWeekDateOnly) {
    let report = reportsByWeek.get(weekStr)
    if (!report) {
        for (const [dbWeekStr, dbReport] of reportsByWeek.entries()) {
            const dbDate = new Date(dbWeekStr + 'T12:00:00')
            const weekDate = new Date(weekStr + 'T12:00:00')
            const diffDays = Math.abs((dbDate - weekDate) / (1000 * 60 * 60 * 24))
            if (diffDays <= 1) {
                report = dbReport
                break
            }
        }
    }
    if (!report) {
        return {
            adjustedYph: 0,
            data: null,
            hours: 0,
            hoursReceived: 0,
            hoursSent: 0,
            isCurrentWeek: weekStr === currentWeekDateOnly,
            isPlaceholder: true,
            rawYph: 0,
            userId: null,
            weekIso: weekStr,
            yards: 0,
            yph: 0
        }
    }
    const reportWeekStr = ReportUtility.normalizeWeekStr(report.week)
    const hoursReceived = hoursReceivedByWeek[reportWeekStr] || hoursReceivedByWeek[weekStr] || 0
    const metrics = ReportUtility.calculateAdjustedYph(report.data, hoursReceived)
    return {
        adjustedYph: metrics.adjustedYph,
        data: report.data,
        hours: parseFloat(report.data?.total_hours || 0),
        hoursReceived: metrics.hoursReceived,
        hoursSent: metrics.hoursSent,
        isCurrentWeek: weekStr === currentWeekDateOnly,
        isPlaceholder: false,
        rawYph: metrics.rawYph,
        userId: report.user_id,
        weekIso: weekStr,
        yards: parseFloat(report.data?.yardage || 0),
        yph: metrics.rawYph
    }
}

/** Loads the full year-to-date breakdown: every week from the first
 *  submitted report up to and including last week, marking each as
 *  submitted / draft / missing. */
function useYearlyTotals(currentWeekIso, effectivePlantCode) {
    const [yearlyTotals, setYearlyTotals] = useState(null)

    useEffect(() => {
        let mounted = true
        async function fetchYearlyTotals() {
            if (!effectivePlantCode || !currentWeekIso) return
            try {
                const weekDateStr = currentWeekIso.split('T')[0]
                const [yearNum] = weekDateStr.split('-').map(Number)
                const currentYear = yearNum
                const yearReports = await ReportService.fetchPlantManagerReportsForYear(currentYear)
                if (!mounted) return
                const allData = (yearReports || []).slice().sort((a, b) => new Date(b.week) - new Date(a.week))
                const userIds = [...new Set(allData.map((r) => r.user_id).filter(Boolean))]
                const usersMap = await fetchUsersPlantMap(userIds)
                const hoursReceivedByWeek = buildHoursReceivedMap(allData, effectivePlantCode)
                const filteredData = allData.filter((report) => {
                    const reportPlant = report.data?.plant || usersMap[report.user_id] || ''
                    return (
                        reportPlant === effectivePlantCode ||
                        (effectivePlantCode && usersMap[report.user_id] === effectivePlantCode)
                    )
                })
                if (!mounted) return
                if (filteredData.length === 0) {
                    setYearlyTotals(buildEmptyTotals(currentYear))
                    return
                }
                setYearlyTotals(computeYearlyTotals(filteredData, hoursReceivedByWeek, currentYear))
            } catch (err) {
                console.error('Error fetching yearly totals:', err)
            }
        }
        fetchYearlyTotals()
        return () => {
            mounted = false
        }
    }, [effectivePlantCode, currentWeekIso])

    return yearlyTotals
}

function buildEmptyTotals(year) {
    return {
        avgYph: 0,
        missingWeeks: [],
        notSubmittedWeeks: [],
        reportCount: 0,
        totalHours: 0,
        totalYards: 0,
        weeklyBreakdown: [],
        year
    }
}

/** Picks the best report per week (completed wins; on ties take the most
 *  recently submitted). Returns `{ reportsByWeek, firstReportDate }`. */
function dedupeReportsByWeek(filteredData, currentSunday) {
    const reportsByWeek = new Map()
    const allReportDates = []
    filteredData.forEach((report) => {
        const weekStr = report.week.split('T')[0]
        const weekDate = new Date(weekStr + 'T12:00:00')
        if (weekDate >= currentSunday) return
        if (reportsByWeek.has(weekStr)) {
            const existing = reportsByWeek.get(weekStr)
            if (report.completed && !existing.completed) {
                reportsByWeek.set(weekStr, report)
            } else if (report.completed === existing.completed) {
                const existingDate = new Date(existing.submitted_at || existing.updated_at || 0)
                const reportDate = new Date(report.submitted_at || report.updated_at || 0)
                if (reportDate > existingDate) reportsByWeek.set(weekStr, report)
            }
        } else {
            reportsByWeek.set(weekStr, report)
            allReportDates.push(weekStr)
        }
    })
    allReportDates.sort()
    return { allReportDates, reportsByWeek }
}

/** Builds the chronological list of weeks for the breakdown table —
 *  one entry per week between the first submitted report and last Sunday,
 *  filling gaps with placeholder "missing" rows. */
function buildWeeklyBreakdown(reportsByWeek, allReportDates, currentSunday, hoursReceivedByWeek) {
    const firstDate = allReportDates[0]
    const lastDate = allReportDates[allReportDates.length - 1]
    const allWeeks = []
    let currentDate = new Date(firstDate + 'T12:00:00')
    const endDate = new Date(lastDate + 'T12:00:00')
    const lastSunday = new Date(currentSunday)
    lastSunday.setDate(currentSunday.getDate() - 7)
    while (currentDate <= endDate || currentDate <= lastSunday) {
        const year = currentDate.getFullYear()
        const month = String(currentDate.getMonth() + 1).padStart(2, '0')
        const day = String(currentDate.getDate()).padStart(2, '0')
        const weekStr = `${year}-${month}-${day}`
        const report = reportsByWeek.get(weekStr)
        if (report) {
            const reportWeekStr = ReportUtility.normalizeWeekStr(report.week)
            const hoursReceived = hoursReceivedByWeek[reportWeekStr] || hoursReceivedByWeek[weekStr] || 0
            const metrics = ReportUtility.calculateAdjustedYph(report.data, hoursReceived)
            allWeeks.push({
                adjustedYph: metrics.adjustedYph,
                hours: parseFloat(report.data?.total_hours || 0),
                hoursReceived: metrics.hoursReceived,
                hoursSent: metrics.hoursSent,
                isMissing: false,
                isNotSubmitted: !report.completed,
                rawYph: metrics.rawYph,
                userId: report.user_id,
                week: weekStr,
                yardage: parseFloat(report.data?.yardage || 0),
                yph: metrics.rawYph
            })
        } else if (currentDate >= new Date(firstDate + 'T12:00:00') && currentDate < currentSunday) {
            allWeeks.push({
                adjustedYph: 0,
                hours: 0,
                hoursReceived: 0,
                hoursSent: 0,
                isMissing: true,
                isNotSubmitted: false,
                rawYph: 0,
                userId: null,
                week: weekStr,
                yardage: 0,
                yph: 0
            })
        }
        currentDate.setDate(currentDate.getDate() + 7)
    }
    return allWeeks.reverse()
}

/** Aggregates submitted weeks into year-to-date totals (yardage, hours,
 *  average YPH, efficiency vs. 3.0 target). */
function computeYearlyTotals(filteredData, hoursReceivedByWeek, currentYear) {
    const today = new Date()
    const currentSunday = new Date(today)
    currentSunday.setDate(today.getDate() - today.getDay())
    currentSunday.setHours(0, 0, 0, 0)

    const { allReportDates, reportsByWeek } = dedupeReportsByWeek(filteredData, currentSunday)
    const allWeeks = buildWeeklyBreakdown(reportsByWeek, allReportDates, currentSunday, hoursReceivedByWeek)
    const submittedWeeks = allWeeks.filter((w) => !w.isMissing && !w.isNotSubmitted)
    const notSubmittedWeeks = allWeeks.filter((w) => w.isNotSubmitted)
    const missingWeeks = allWeeks.filter((w) => w.isMissing)

    const totals = submittedWeeks.reduce(
        (acc, week) => ({
            missingWeeks,
            notSubmittedWeeks,
            reportCount: acc.reportCount + 1,
            totalHours: acc.totalHours + week.hours,
            totalYards: acc.totalYards + week.yardage,
            weeklyBreakdown: allWeeks,
            year: currentYear
        }),
        {
            missingWeeks,
            notSubmittedWeeks,
            reportCount: 0,
            totalHours: 0,
            totalYards: 0,
            weeklyBreakdown: allWeeks,
            year: currentYear
        }
    )

    const weeksWithHours = submittedWeeks.filter((w) => w.hours > 0)
    const yardsWithHours = weeksWithHours.reduce((sum, w) => sum + w.yardage, 0)
    const hoursTotal = weeksWithHours.reduce((sum, w) => sum + w.hours, 0)
    totals.avgYph = hoursTotal > 0 ? yardsWithHours / hoursTotal : 0
    const targetYPH = 3.0
    totals.avgEfficiency = totals.avgYph > 0 ? Math.min((totals.avgYph / targetYPH) * 100, 100) : 0
    return totals
}

/** Loads user display names for any rows that have a `userId`. */
function useUserNames(rows, getUserIds) {
    const [userNames, setUserNames] = useState({})
    useEffect(() => {
        let mounted = true
        async function load() {
            if (!rows || rows.length === 0) return
            const userIds = getUserIds(rows)
            if (userIds.length === 0) return
            try {
                const namesMap = await fetchUserDisplayNames(userIds)
                if (mounted) setUserNames(namesMap)
            } catch (err) {
                console.error('Error fetching user names:', err)
            }
        }
        load()
        return () => {
            mounted = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows])
    return userNames
}

/** Top-level hook for the Plant Manager trends section — exposes the
 *  timeline (`historicalData`), the year-to-date breakdown
 *  (`yearlyTotals`), and the user-name maps for both. */
export function usePmTrendsData(currentWeekIso, effectivePlantCode) {
    const { historicalData, loading } = useHistoricalReports(currentWeekIso, effectivePlantCode)
    const yearlyTotals = useYearlyTotals(currentWeekIso, effectivePlantCode)
    const timelineUserNames = useUserNames(historicalData, (rows) =>
        Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)))
    )
    const userNames = useUserNames(yearlyTotals?.weeklyBreakdown, (rows) =>
        Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)))
    )
    return { historicalData, loading, timelineUserNames, userNames, yearlyTotals }
}
