import React, { useEffect, useState } from 'react'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'
import { usePreferences } from '../../../../app/context/PreferencesContext'
import { Database } from '../../../../services/DatabaseService'
import { ReportService } from '../../../../services/ReportService'
import { UserService } from '../../../../services/UserService'
import { ReportUtility } from '../../../../utils/ReportUtility'
import OperatorSelectModal from '../../../assets/mixers/OperatorSelectModal'

/* ── Plan-tab design tokens ────────────────────────────────────────────────
 *  Same pattern used by MaintenanceFormReview, NRMCAView, the Plan toolbar,
 *  and the District Manager redesign — CSS custom properties for theme
 *  awareness, compact 10–13px typography, 4px corner radius. */
const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const PM_TH = `${SECTION_LABEL_CLASS} text-left px-3 py-2 whitespace-nowrap`
const PM_TH_STYLE = {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-light)'
}
const PM_TD = 'px-3 py-2 text-[12px] align-top'
const PM_TD_STYLE = { color: 'var(--text-primary)', borderTop: '1px solid var(--border-light)' }
const PM_INPUT =
    'rounded px-2.5 py-1.5 text-[12.5px] outline-none focus:ring-1 focus:ring-[var(--border-medium)] box-border'
const GRADE_COLORS = { average: '#d97706', excellent: '#16a34a', good: '#0ea5e9', poor: '#dc2626' }
const YPH_GRADES = ['excellent', 'good', 'average', 'poor']

/** Compact card header — icon chip + label/title — matching the look used
 *  by the District Manager report and the Plan-tab toolbars. */
function CardHeader({ icon, label, sub, title, right }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    <i className={`fas ${icon} text-[11px]`} />
                </div>
                <div className="min-w-0 flex-1">
                    {label && (
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {label}
                        </div>
                    )}
                    <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </div>
                    {sub && (
                        <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {sub}
                        </div>
                    )}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    )
}

/** Compact icon button — same chrome as the Plan-tab toolbar buttons. */
function IconChip({ accent = 'var(--text-secondary)', icon, label, onClick, title, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            title={title}
            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer disabled:opacity-50"
            style={{
                background: 'var(--bg-secondary)',
                border: `1px solid var(--border-light)`,
                color: accent
            }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {label}
        </button>
    )
}
function formatYphValue(v) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    return Number.isFinite(n) ? n.toFixed(2) : '--'
}
function GradeScale({ grade }) {
    return (
        <div className="flex gap-1 flex-wrap">
            {YPH_GRADES.map((g) => {
                const active = grade === g
                return (
                    <span
                        key={g}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                            background: active ? GRADE_COLORS[g] : 'var(--bg-tertiary)',
                            color: active ? '#fff' : 'var(--text-tertiary)',
                            border: `1px solid ${active ? GRADE_COLORS[g] : 'var(--border-light)'}`
                        }}
                    >
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                    </span>
                )
            })}
        </div>
    )
}

function YphMetricCard({ grade, label, yph }) {
    const adjustedGrade = grade?.adjusted ?? grade
    const labelText = label?.adjusted ?? label
    const gradeColor = GRADE_COLORS[adjustedGrade] || 'var(--text-secondary)'
    return (
        <div
            className="rounded p-3 flex flex-col gap-2"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div className="flex items-center gap-1.5">
                <i className="fas fa-tachometer-alt text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    Yards per man-hour
                </span>
            </div>
            <div
                className="flex items-baseline gap-1.5 font-mono tabular-nums"
                style={{ color: 'var(--text-primary)' }}
                title="Raw / Adjusted (for help sent)"
            >
                <span className="text-[22px] font-bold leading-none">{formatYphValue(yph?.raw ?? yph)}</span>
                <span className="text-[16px]" style={{ color: 'var(--text-tertiary)' }}>
                    /
                </span>
                <span className="text-[22px] font-bold leading-none">{formatYphValue(yph?.adjusted ?? yph)}</span>
            </div>
            <div className="flex gap-4 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                <span>Raw</span>
                <span>Adjusted</span>
            </div>
            {labelText && (
                <div className="text-[12px] font-semibold" style={{ color: gradeColor }}>
                    {labelText}
                </div>
            )}
            <GradeScale grade={adjustedGrade} />
        </div>
    )
}

function MetricsSection({ yph, yphGrade, yphLabel }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-chart-bar"
                label="Performance"
                title="Weekly Performance Metrics"
                sub="Key indicators for this reporting period."
            />
            <YphMetricCard yph={yph} grade={yphGrade} label={yphLabel} />
        </div>
    )
}
function useYphCalculation(weekIso, plantCode, form) {
    const [yph, setYph] = useState({ adjusted: 0, raw: 0 })
    const [grade, setGrade] = useState({ adjusted: '', raw: '' })
    const [label, setLabel] = useState({ adjusted: '', raw: '' })
    useEffect(() => {
        let mounted = true
        async function calculate() {
            const applyMetrics = (hoursReceived) => {
                const metrics = ReportUtility.getFullYphMetrics(form, hoursReceived)
                if (!mounted) return
                setYph({ adjusted: metrics.adjusted, raw: metrics.raw })
                setGrade({ adjusted: metrics.adjustedGrade, raw: metrics.rawGrade })
                setLabel({ adjusted: metrics.adjustedLabel, raw: metrics.rawLabel })
            }
            if (!weekIso || !plantCode) {
                applyMetrics(0)
                return
            }
            try {
                const [year] = weekIso.split('T')[0].split('-').map(Number)
                const allReports = await ReportService.fetchPlantManagerReportsForYear(year)
                if (!mounted) return
                const completedReports = (allReports || []).filter((r) => r.completed)
                const hoursReceived = ReportUtility.calculateHoursReceivedForWeek(completedReports, weekIso, plantCode)
                applyMetrics(hoursReceived)
            } catch (err) {
                console.error('Error calculating YPH:', err)
                applyMetrics(0)
            }
        }
        calculate()
        return () => {
            mounted = false
        }
    }, [weekIso, plantCode, form])
    return { grade, label, yph }
}
function WeeklyTrendsSection({ currentWeekIso, plantCode, user }) {
    const [historicalData, setHistoricalData] = useState([])
    const [loading, setLoading] = useState(true)
    const [yearlyTotals, setYearlyTotals] = useState(null)
    const [_yearlyLoading, setYearlyLoading] = useState(true)
    const [userNames, setUserNames] = useState({})
    const [timelineUserNames, setTimelineUserNames] = useState({})
    const effectivePlantCode = plantCode || user?.plant_code || ''
    useEffect(() => {
        let mounted = true
        async function fetchTimelineUserNames() {
            if (!historicalData || historicalData.length === 0) return
            const userIds = new Set()
            historicalData.forEach((report) => {
                if (report.userId) {
                    userIds.add(report.userId)
                }
            })
            if (userIds.size === 0) return
            try {
                const namesMap = {}
                await Promise.all(
                    Array.from(userIds).map(async (id) => {
                        const firstName = await UserService.getUserFirstName(id)
                        const lastName = await UserService.getUserLastName(id)
                        const fullName = `${firstName} ${lastName}`.trim()
                        namesMap[id] = fullName || 'Unknown User'
                    })
                )
                if (mounted) {
                    setTimelineUserNames(namesMap)
                }
            } catch (err) {
                console.error('Error fetching timeline user names:', err)
            }
        }
        fetchTimelineUserNames()
        return () => {
            mounted = false
        }
    }, [historicalData])
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
                const usersMap = {}
                if (userIds.length > 0) {
                    const { data: usersData } = await Database.from('users_profiles')
                        .select('id, plant_code')
                        .in('id', userIds)
                    if (usersData) {
                        usersData.forEach((u) => {
                            usersMap[u.id] = u.plant_code
                        })
                    }
                }
                const filteredByPlant = data.filter((report) => {
                    const reportPlant = report.data?.plant || usersMap[report.user_id] || ''
                    const matches =
                        reportPlant === effectivePlantCode ||
                        (effectivePlantCode && usersMap[report.user_id] === effectivePlantCode)
                    return matches
                })
                if (mounted && filteredByPlant) {
                    const currentWeekDateOnly = currentWeekIso.split('T')[0]
                    const reportsByWeek = new Map()
                    filteredByPlant.forEach((r) => {
                        const weekStr = r.week.split('T')[0]
                        reportsByWeek.set(weekStr, r)
                    })
                    const allMonthWeeks = []
                    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
                    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
                    let weekStart = new Date(firstDayOfMonth)
                    const dayOfWeek = weekStart.getDay()
                    if (dayOfWeek !== 0) {
                        weekStart.setDate(weekStart.getDate() - dayOfWeek)
                    }
                    while (weekStart <= lastDayOfMonth) {
                        const weekStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
                        allMonthWeeks.push(weekStr)
                        weekStart.setDate(weekStart.getDate() + 7)
                    }
                    const reports = allMonthWeeks
                        .map((weekStr) => {
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
                            if (report) {
                                const reportWeekStr = ReportUtility.normalizeWeekStr(report.week)
                                const hoursReceived =
                                    hoursReceivedByWeek[reportWeekStr] || hoursReceivedByWeek[weekStr] || 0
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
                            } else {
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
                        })
                        .sort((a, b) => new Date(a.weekIso) - new Date(b.weekIso))
                    setHistoricalData(reports)
                }
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
    useEffect(() => {
        let mounted = true
        async function fetchYearlyTotals() {
            if (!effectivePlantCode || !currentWeekIso) {
                setYearlyLoading(false)
                return
            }
            try {
                const weekDateStr = currentWeekIso.split('T')[0]
                const [yearNum] = weekDateStr.split('-').map(Number)
                const currentYear = yearNum
                const yearReports = await ReportService.fetchPlantManagerReportsForYear(currentYear)
                if (!mounted) {
                    setYearlyLoading(false)
                    return
                }
                const allData = (yearReports || []).slice().sort((a, b) => new Date(b.week) - new Date(a.week))
                const userIds = [...new Set(allData.map((r) => r.user_id).filter(Boolean))]
                const usersMap = {}
                if (userIds.length > 0) {
                    const { data: usersData } = await Database.from('users_profiles')
                        .select('id, plant_code')
                        .in('id', userIds)
                    if (usersData) {
                        usersData.forEach((u) => {
                            usersMap[u.id] = u.plant_code
                        })
                    }
                }
                const hoursReceivedByWeek = {}
                const effectivePlantCodeStr = String(effectivePlantCode || '')
                allData.forEach((report) => {
                    const rawWeekStr = report.week.split('T')[0]
                    const [y, m, d] = rawWeekStr.split('-').map(Number)
                    const weekStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    const helpEntries = report.data?.operators_sent_to_help || []
                    if (Array.isArray(helpEntries)) {
                        helpEntries.forEach((entry) => {
                            const destPlant = String(entry.destination_plant || '')
                            if (
                                destPlant === effectivePlantCodeStr &&
                                entry.operators &&
                                Array.isArray(entry.operators)
                            ) {
                                if (!hoursReceivedByWeek[weekStr]) {
                                    hoursReceivedByWeek[weekStr] = 0
                                }
                                entry.operators.forEach((op) => {
                                    hoursReceivedByWeek[weekStr] += parseFloat(op.hours) || 0
                                })
                            }
                        })
                    }
                })
                const filteredData = allData.filter((report) => {
                    const reportPlant = report.data?.plant || usersMap[report.user_id] || ''
                    return (
                        reportPlant === effectivePlantCode ||
                        (effectivePlantCode && usersMap[report.user_id] === effectivePlantCode)
                    )
                })
                if (mounted && filteredData) {
                    if (filteredData.length === 0) {
                        setYearlyTotals({
                            avgYph: 0,
                            missingWeeks: [],
                            notSubmittedWeeks: [],
                            reportCount: 0,
                            totalHours: 0,
                            totalYards: 0,
                            weeklyBreakdown: [],
                            year: currentYear
                        })
                        return
                    }
                    const reportsByWeek = new Map()
                    const allReportDates = []
                    const today = new Date()
                    const currentSunday = new Date(today)
                    currentSunday.setDate(today.getDate() - today.getDay())
                    currentSunday.setHours(0, 0, 0, 0)
                    filteredData.forEach((report) => {
                        const weekStr = report.week.split('T')[0]
                        const weekDate = new Date(weekStr + 'T12:00:00')
                        if (weekDate >= currentSunday) {
                            return
                        }
                        if (reportsByWeek.has(weekStr)) {
                            const existing = reportsByWeek.get(weekStr)
                            if (report.completed && !existing.completed) {
                                reportsByWeek.set(weekStr, report)
                            } else if (report.completed === existing.completed) {
                                const existingDate = new Date(existing.submitted_at || existing.updated_at || 0)
                                const reportDate = new Date(report.submitted_at || report.updated_at || 0)
                                if (reportDate > existingDate) {
                                    reportsByWeek.set(weekStr, report)
                                }
                            }
                        } else {
                            reportsByWeek.set(weekStr, report)
                            allReportDates.push(weekStr)
                        }
                    })
                    allReportDates.sort()
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
                            const hoursReceived =
                                hoursReceivedByWeek[reportWeekStr] || hoursReceivedByWeek[weekStr] || 0
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
                    allWeeks.reverse()
                    const submittedWeeks = allWeeks.filter((w) => !w.isMissing && !w.isNotSubmitted)
                    const notSubmittedWeeks = allWeeks.filter((w) => w.isNotSubmitted)
                    const missingWeeks = allWeeks.filter((w) => w.isMissing)
                    const totals = submittedWeeks.reduce(
                        (acc, week) => {
                            return {
                                missingWeeks,
                                notSubmittedWeeks,
                                reportCount: acc.reportCount + 1,
                                totalHours: acc.totalHours + week.hours,
                                totalYards: acc.totalYards + week.yardage,
                                weeklyBreakdown: allWeeks,
                                year: currentYear
                            }
                        },
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
                    const yphEfficiency = totals.avgYph > 0 ? Math.min((totals.avgYph / targetYPH) * 100, 100) : 0
                    totals.avgEfficiency = yphEfficiency
                    setYearlyTotals(totals)
                }
            } catch (err) {
                console.error('Error fetching yearly totals:', err)
            } finally {
                if (mounted) setYearlyLoading(false)
            }
        }
        fetchYearlyTotals()
        return () => {
            mounted = false
        }
    }, [effectivePlantCode, currentWeekIso])
    useEffect(() => {
        let mounted = true
        async function fetchUserNames() {
            if (!yearlyTotals || !yearlyTotals.weeklyBreakdown) return
            const userIds = new Set()
            yearlyTotals.weeklyBreakdown.forEach((week) => {
                if (week.userId) {
                    userIds.add(week.userId)
                }
            })
            if (userIds.size === 0) return
            try {
                const namesMap = {}
                await Promise.all(
                    Array.from(userIds).map(async (id) => {
                        const firstName = await UserService.getUserFirstName(id)
                        const lastName = await UserService.getUserLastName(id)
                        const fullName = `${firstName} ${lastName}`.trim()
                        namesMap[id] = fullName || 'Unknown User'
                    })
                )
                if (mounted) {
                    setUserNames(namesMap)
                }
            } catch (err) {
                console.error('Error fetching user names:', err)
            }
        }
        fetchUserNames()
        return () => {
            mounted = false
        }
    }, [yearlyTotals])
    if (loading) {
        return (
            <div className="rounded p-3" style={CARD_STYLE}>
                <CardHeader icon="fa-chart-line" label="Trends" title="Monthly Performance Trends" />
                <div
                    className="flex items-center justify-center gap-2 py-6 text-[12px]"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                    Loading historical data…
                </div>
            </div>
        )
    }
    const weekDateStrForMonth = currentWeekIso.split('T')[0]
    const [yearForMonth, monthForMonth] = weekDateStrForMonth.split('-').map(Number)
    const monthName = new Date(yearForMonth, monthForMonth - 1, 15).toLocaleString('default', {
        month: 'long',
        year: 'numeric'
    })
    if (historicalData.length === 0) {
        return (
            <div className="rounded p-3" style={CARD_STYLE}>
                <CardHeader
                    icon="fa-calendar-alt"
                    label="Trends"
                    title={`${monthName} — Weekly Performance`}
                    sub="No reports found for this month."
                />
            </div>
        )
    }
    const calculateVariance = (current, previous) => {
        if (!previous || previous.isPlaceholder) return null
        return ((current - previous) / previous) * 100
    }
    const weeksWithData = historicalData.filter((r) => !r.isPlaceholder).length
    return (
        <div className="rounded p-3 flex flex-col gap-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-chart-line"
                label="Trends"
                title={`${monthName} Performance Timeline`}
                sub={`${weeksWithData} of ${historicalData.length} ${historicalData.length === 1 ? 'week' : 'weeks'} with data`}
            />
            <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px" style={{ background: 'var(--border-light)' }} />

                <div className="flex flex-col relative">
                    {historicalData.map((report, idx) => {
                        const [year, month, day] = report.weekIso.split('-').map(Number)
                        const weekDate = new Date(year, month - 1, day)
                        weekDate.setDate(weekDate.getDate() + 1)
                        const weekLabel = weekDate.toLocaleDateString()
                        const previousReportWithData = historicalData
                            .slice(0, idx)
                            .filter((r) => !r.isPlaceholder)
                            .pop()
                        const yphVariance = !report.isPlaceholder
                            ? calculateVariance(report.yph, previousReportWithData?.yph)
                            : null
                        const userName = report.userId ? timelineUserNames[report.userId] || 'Loading...' : null
                        const varianceColor = yphVariance != null && yphVariance >= 0 ? '#16a34a' : '#dc2626'
                        return (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 py-2 relative"
                                style={{ opacity: report.isPlaceholder ? 0.6 : 1 }}
                            >
                                <div
                                    className="flex items-center justify-center relative z-[1] shrink-0"
                                    style={{ width: 24, height: 24 }}
                                >
                                    <div
                                        className="rounded-full"
                                        style={{
                                            width: 10,
                                            height: 10,
                                            background: report.isPlaceholder
                                                ? 'var(--border-medium)'
                                                : 'var(--accent, #1e3a5f)',
                                            boxShadow: '0 0 0 3px var(--bg-primary), 0 0 0 4px var(--border-light)'
                                        }}
                                    />
                                </div>
                                <div
                                    className="flex-1 rounded p-2.5"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <div
                                        className="flex items-center gap-1.5 text-[12px] font-semibold mb-1"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {weekLabel}
                                        {report.isCurrentWeek && (
                                            <span
                                                className="rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                                                style={{ background: 'var(--accent, #1e3a5f)', color: '#fff' }}
                                            >
                                                Current
                                            </span>
                                        )}
                                    </div>
                                    {report.isPlaceholder ? (
                                        <div
                                            className="flex items-center gap-1.5 text-[11.5px]"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            <i className="fas fa-clock text-[10px]" />
                                            <span>Pending</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="flex items-center gap-1.5 text-[11px] mb-1.5"
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                <i className="fas fa-user text-[9px]" />
                                                {userName || 'Unknown'}
                                            </div>
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <span
                                                    className="flex items-baseline gap-1 font-mono tabular-nums"
                                                    style={{ color: 'var(--text-primary)' }}
                                                    title="Raw / Adjusted YPH"
                                                >
                                                    <span className="text-[16px] font-bold leading-none">
                                                        {(report.rawYph ?? report.yph).toFixed(2)}
                                                    </span>
                                                    <span
                                                        className="text-[11px]"
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        /
                                                    </span>
                                                    <span className="text-[16px] font-bold leading-none">
                                                        {(report.adjustedYph ?? report.yph).toFixed(2)}
                                                    </span>
                                                </span>
                                                <span
                                                    className={SECTION_LABEL_CLASS}
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                >
                                                    YPH
                                                </span>
                                                {yphVariance !== null && (
                                                    <span
                                                        className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums"
                                                        style={{ color: varianceColor }}
                                                    >
                                                        <i
                                                            className={`fas fa-arrow-${yphVariance >= 0 ? 'up' : 'down'} text-[9px]`}
                                                        />
                                                        {Math.abs(yphVariance).toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            {yearlyTotals && yearlyTotals.weeklyBreakdown && yearlyTotals.weeklyBreakdown.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <div className={`${SECTION_LABEL_CLASS}`} style={{ color: 'var(--text-secondary)' }}>
                        Weekly Breakdown
                    </div>
                    <div className="overflow-x-auto rounded" style={CARD_STYLE}>
                        <table className="w-full min-w-[700px]" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {[
                                        'Submitted By',
                                        'Week Starting',
                                        'Yardage',
                                        'Hours',
                                        'YPH',
                                        'Daily Avg',
                                        'Efficiency'
                                    ].map((h) => (
                                        <th key={h} className={PM_TH} style={PM_TH_STYLE}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {yearlyTotals.weeklyBreakdown.map((week, idx) => {
                                    const weekDate = new Date(week.week + 'T12:00:00')
                                    const weekLabel = ReportUtility.formatDate(weekDate)
                                    const userName = week.userId ? userNames[week.userId] || 'Loading...' : null
                                    const dailyAvg = Math.round(week.yardage / 6)
                                    const targetYPH = 3.0
                                    const yphEfficiency =
                                        week.hours > 0 ? Math.min((week.yph / targetYPH) * 100, 100) : 0
                                    const overallEfficiency = yphEfficiency
                                    const isMissingRow = week.isMissing || week.isNotSubmitted
                                    const rowStyle = {
                                        ...PM_TD_STYLE,
                                        background: isMissingRow ? 'rgba(220, 38, 38, 0.04)' : undefined
                                    }
                                    return (
                                        <tr key={idx} style={{ borderTop: '1px solid var(--border-light)' }}>
                                            <td className={PM_TD} style={rowStyle}>
                                                {week.isNotSubmitted && (
                                                    <span
                                                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                                                        style={{
                                                            background: 'rgba(217, 119, 6, 0.12)',
                                                            color: '#b45309'
                                                        }}
                                                    >
                                                        Not Submitted
                                                    </span>
                                                )}
                                                {week.isMissing && (
                                                    <span
                                                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                                                        style={{
                                                            background: 'rgba(220, 38, 38, 0.12)',
                                                            color: '#b91c1c'
                                                        }}
                                                    >
                                                        Missing
                                                    </span>
                                                )}
                                                {!week.isMissing && !week.isNotSubmitted && userName}
                                            </td>
                                            <td className={`${PM_TD} whitespace-nowrap tabular-nums`} style={rowStyle}>
                                                {weekLabel}
                                            </td>
                                            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                                                {isMissingRow ? '—' : week.yardage.toLocaleString()}
                                            </td>
                                            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                                                {isMissingRow ? '—' : week.hours.toLocaleString()}
                                            </td>
                                            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                                                {isMissingRow ? (
                                                    '—'
                                                ) : (
                                                    <span
                                                        className="inline-flex items-baseline gap-0.5"
                                                        title="Raw / Adjusted YPH"
                                                    >
                                                        <span>{(week.rawYph ?? week.yph).toFixed(2)}</span>
                                                        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                                                        <span>{(week.adjustedYph ?? week.yph).toFixed(2)}</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                                                {isMissingRow ? '—' : dailyAvg.toLocaleString()}
                                            </td>
                                            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                                                {isMissingRow ? '—' : `${overallEfficiency.toFixed(1)}%`}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {yearlyTotals.notSubmittedWeeks?.length > 0 && (
                        <div
                            className="rounded p-2.5"
                            style={{
                                background: 'rgba(217, 119, 6, 0.08)',
                                border: '1px solid rgba(217, 119, 6, 0.35)'
                            }}
                        >
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <i className="fas fa-circle-exclamation text-[11px]" style={{ color: '#b45309' }} />
                                <span className="text-[12px] font-semibold" style={{ color: '#92400e' }}>
                                    {yearlyTotals.notSubmittedWeeks.length} Draft{' '}
                                    {yearlyTotals.notSubmittedWeeks.length === 1 ? 'Report' : 'Reports'}
                                </span>
                            </div>
                            <div className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                                The following weeks have saved drafts that need to be submitted:
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {yearlyTotals.notSubmittedWeeks.map((week, idx) => (
                                        <span
                                            key={idx}
                                            className="rounded px-2 py-0.5 text-[11px] tabular-nums"
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-light)',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {ReportUtility.formatDate(new Date(week.week + 'T12:00:00'))}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {yearlyTotals.missingWeeks?.length > 0 && (
                        <div
                            className="rounded p-2.5"
                            style={{
                                background: 'rgba(220, 38, 38, 0.08)',
                                border: '1px solid rgba(220, 38, 38, 0.35)'
                            }}
                        >
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <i className="fas fa-triangle-exclamation text-[11px]" style={{ color: '#b91c1c' }} />
                                <span className="text-[12px] font-semibold" style={{ color: '#991b1b' }}>
                                    {yearlyTotals.missingWeeks.length} Missing{' '}
                                    {yearlyTotals.missingWeeks.length === 1 ? 'Report' : 'Reports'}
                                </span>
                            </div>
                            <div className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                                The following weeks need reports to be created and submitted:
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {yearlyTotals.missingWeeks.map((week, idx) => (
                                        <span
                                            key={idx}
                                            className="rounded px-2 py-0.5 text-[11px] tabular-nums"
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-light)',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {ReportUtility.formatDate(new Date(week.week + 'T12:00:00'))}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
function OperatorsSentToHelp({ entries, onUpdate, weekIso, readOnly, user, plantCode, regionalPlants }) {
    const [plants, setPlants] = useState([])
    const [operators, setOperators] = useState([])
    const [loading, setLoading] = useState(true)
    const [showPlantModal, setShowPlantModal] = useState(false)
    const [selectedEntryIdForPlant, setSelectedEntryIdForPlant] = useState(null)
    const [showOperatorModal, setShowOperatorModal] = useState(false)
    const [selectedEntryIdForOperator, setSelectedEntryIdForOperator] = useState(null)
    const [selectedOperatorIndex, setSelectedOperatorIndex] = useState(null)
    const getValidDate = (iso) => {
        if (!iso) return new Date()
        const d = new Date(iso + 'T00:00:00')
        return isNaN(d.getTime()) ? new Date() : d
    }
    const weekStartDate = getValidDate(weekIso)
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekEndDate.getDate() + 5)
    const minDate = weekStartDate.toISOString().split('T')[0]
    const maxDate = weekEndDate.toISOString().split('T')[0]
    const currentPlantCode = plantCode || user?.plant_code
    useEffect(() => {
        let mounted = true
        async function fetchData() {
            try {
                if (regionalPlants && regionalPlants.length > 0) {
                    const mappedPlants = regionalPlants.map((p) => ({
                        plantCode: p.plantCode || p.plant_code,
                        plantName: p.plantName || p.plant_name
                    }))
                    setPlants(mappedPlants)
                } else if (currentPlantCode) {
                    let regionPlantCodes = []
                    const { data: regionData } = await Database.from('regions_plants')
                        .select('region_id')
                        .eq('plant_code', currentPlantCode)
                        .limit(1)
                        .maybeSingle()
                    if (regionData?.region_id) {
                        const { data: regionPlantsData } = await Database.from('regions_plants')
                            .select('plant_code')
                            .eq('region_id', regionData.region_id)
                        regionPlantCodes = (regionPlantsData || []).map((rp) => rp.plant_code).filter(Boolean)
                    }
                    if (regionPlantCodes.length > 0) {
                        const { data: plantsData } = await Database.from('plants')
                            .select('plant_code, plant_name')
                            .in('plant_code', regionPlantCodes)
                            .order('plant_code')
                        if (!mounted) return
                        setPlants(
                            (plantsData || []).map((p) => ({
                                plantCode: p.plant_code,
                                plantName: p.plant_name
                            }))
                        )
                    }
                }
                const operatorPlantCode = currentPlantCode
                if (operatorPlantCode) {
                    const { data: operatorsData } = await Database.from('operators')
                        .select('employee_id, name, status, plant_code, smyrna_id, position')
                        .eq('status', 'Active')
                        .eq('plant_code', operatorPlantCode)
                        .eq('position', 'Mixer Operator')
                        .order('name')
                    if (!mounted) return
                    const transformedOperators = (operatorsData || []).map((op) => ({
                        employeeId: op.employee_id,
                        name: op.name,
                        plantCode: op.plant_code,
                        position: op.position,
                        smyrnaId: op.smyrna_id,
                        status: op.status
                    }))
                    setOperators(transformedOperators)
                }
            } catch (err) {
            } finally {
                if (mounted) setLoading(false)
            }
        }
        fetchData()
        return () => {
            mounted = false
        }
    }, [currentPlantCode, regionalPlants])
    const addEntry = () => {
        const defaultDate = minDate || new Date().toISOString().split('T')[0]
        const newEntry = {
            date: defaultDate,
            destination_plant: '',
            id: Date.now(),
            operators: [{ hours: '', operator_id: '' }]
        }
        onUpdate([...(entries || []), newEntry])
    }
    const removeEntry = (entryId) => {
        onUpdate((entries || []).filter((e) => e.id !== entryId))
    }
    const updateEntry = (entryId, field, value) => {
        onUpdate((entries || []).map((e) => (e.id === entryId ? { ...e, [field]: value } : e)))
    }
    const addOperator = (entryId) => {
        onUpdate(
            (entries || []).map((e) =>
                e.id === entryId ? { ...e, operators: [...e.operators, { hours: '', operator_id: '' }] } : e
            )
        )
    }
    const removeOperator = (entryId, operatorIndex) => {
        onUpdate(
            (entries || []).map((e) =>
                e.id === entryId ? { ...e, operators: e.operators.filter((_, i) => i !== operatorIndex) } : e
            )
        )
    }
    const updateOperator = (entryId, operatorIndex, field, value) => {
        let processedValue = value
        if (field === 'hours') {
            const numValue = parseFloat(value)
            if (!isNaN(numValue) && numValue > 80) {
                processedValue = '80'
            }
        }
        onUpdate(
            (entries || []).map((e) =>
                e.id === entryId
                    ? {
                          ...e,
                          operators: e.operators.map((op, i) =>
                              i === operatorIndex ? { ...op, [field]: processedValue } : op
                          )
                      }
                    : e
            )
        )
    }
    const getDayName = (dateString) => {
        const date = new Date(dateString + 'T12:00:00')
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'long' })
    }
    if (loading) {
        return (
            <div className="rounded p-3" style={CARD_STYLE}>
                <CardHeader icon="fa-hands-helping" label="Help" title="Operators Sent to Other Plants" />
                <div
                    className="flex items-center justify-center gap-2 py-6 text-[12px]"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                    Loading…
                </div>
            </div>
        )
    }
    return (
        <div className="rounded p-3 flex flex-col gap-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-hands-helping"
                label="Help"
                title="Operators Sent to Other Plants"
                sub="Track operators sent to help other plants during this week."
                right={
                    !readOnly ? (
                        <button
                            type="button"
                            onClick={addEntry}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none"
                            style={{ background: 'var(--accent, #1e3a5f)' }}
                        >
                            <i className="fas fa-plus text-[10px]" />
                            Add Entry
                        </button>
                    ) : null
                }
            />
            <div
                className="rounded p-2.5"
                style={{ background: 'rgba(14, 165, 233, 0.06)', border: '1px solid rgba(14, 165, 233, 0.25)' }}
            >
                <div className="flex items-center gap-1.5 mb-1.5">
                    <i className="fas fa-info-circle text-[11px]" style={{ color: '#0369a1' }} />
                    <span className="text-[11.5px] font-semibold" style={{ color: '#0369a1' }}>
                        How to track operator assistance
                    </span>
                </div>
                <ul
                    className="m-0 pl-4 text-[11px] leading-relaxed [&>li]:mb-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <li>Record each operator who assisted another plant, including travel time in total hours.</li>
                    <li>Create a separate entry for each day an operator helped a different plant.</li>
                    <li>For partial days, enter actual hours (e.g., 4 hours for a half-day).</li>
                    <li>If an operator helped multiple plants in one day, add individual entries for each plant.</li>
                    <li>This data contributes to plant efficiency calculations and leaderboard rankings.</li>
                </ul>
            </div>
            <div className="flex flex-col gap-2">
                {(!entries || entries.length === 0) && (
                    <div
                        className="flex items-center gap-2 rounded p-3 text-[12px]"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px dashed var(--border-medium)',
                            color: 'var(--text-tertiary)'
                        }}
                    >
                        <i className="fas fa-info-circle text-[11px]" />
                        <span>No operators were sent to other plants this week.</span>
                    </div>
                )}
                {(entries || []).map((entry) => (
                    <div
                        key={entry.id}
                        className="rounded overflow-hidden"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                    >
                        <div
                            className="flex items-start justify-between gap-2.5 p-2.5"
                            style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                            <div className="flex flex-wrap gap-2.5 flex-1">
                                <div className="flex flex-col gap-1 min-w-[150px]">
                                    <label className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                                        Date
                                    </label>
                                    {readOnly ? (
                                        <div
                                            className="text-[12.5px] font-semibold"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {getDayName(entry.date)}
                                        </div>
                                    ) : (
                                        <input
                                            type="date"
                                            value={entry.date || ''}
                                            onChange={(e) => updateEntry(entry.id, 'date', e.target.value)}
                                            className={PM_INPUT}
                                            style={FIELD_STYLE}
                                            min={minDate}
                                            max={maxDate}
                                        />
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 min-w-[180px]">
                                    <label className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                                        Destination Plant
                                    </label>
                                    {readOnly ? (
                                        <div
                                            className="text-[12.5px] font-semibold"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {entry.destination_plant
                                                ? (() => {
                                                      if (entry.destination_plant === 'OTHER_REGION')
                                                          return 'Other Region'
                                                      const plant = plants.find(
                                                          (p) =>
                                                              (p.plantCode || p.plant_code) === entry.destination_plant
                                                      )
                                                      return plant
                                                          ? `${plant.plantCode || plant.plant_code} · ${plant.plantName || plant.plant_name}`
                                                          : entry.destination_plant
                                                  })()
                                                : 'No plant selected'}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className={`${PM_INPUT} text-left cursor-pointer min-w-[180px]`}
                                            style={FIELD_STYLE}
                                            onClick={() => {
                                                setSelectedEntryIdForPlant(entry.id)
                                                setShowPlantModal(true)
                                            }}
                                        >
                                            {entry.destination_plant
                                                ? (() => {
                                                      if (entry.destination_plant === 'OTHER_REGION')
                                                          return 'Other Region'
                                                      const plant = plants.find(
                                                          (p) =>
                                                              (p.plantCode || p.plant_code) === entry.destination_plant
                                                      )
                                                      return plant
                                                          ? `${plant.plantCode || plant.plant_code} · ${plant.plantName || plant.plant_name}`
                                                          : entry.destination_plant
                                                  })()
                                                : 'Select Plant'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => removeEntry(entry.id)}
                                    title="Remove entry"
                                    className="flex items-center justify-center rounded border-none cursor-pointer h-7 w-7"
                                    style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#b91c1c' }}
                                >
                                    <i className="fas fa-times text-[10px]" />
                                </button>
                            )}
                        </div>
                        <div className="p-2.5">
                            <div className="flex items-center justify-between mb-2">
                                <span
                                    className="flex items-center gap-1.5 text-[11.5px] font-semibold"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    <i className="fas fa-users text-[10px]" />
                                    Operators
                                </span>
                                {!readOnly && (
                                    <IconChip
                                        accent="#0369a1"
                                        icon="fa-plus"
                                        label="Add Operator"
                                        onClick={() => addOperator(entry.id)}
                                    />
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {entry.operators.map((op, opIdx) => {
                                    const selectedOperator = operators.find((o) => o.employeeId === op.operator_id)
                                    return (
                                        <div
                                            key={opIdx}
                                            className="grid grid-cols-[1fr_110px_auto] items-end gap-2 rounded p-2"
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-light)'
                                            }}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <label
                                                    className={SECTION_LABEL_CLASS}
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                >
                                                    Operator
                                                </label>
                                                {readOnly ? (
                                                    <div
                                                        className="text-[12.5px] font-semibold"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        {selectedOperator ? selectedOperator.name : 'Unknown'}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className={`${PM_INPUT} w-full text-left cursor-pointer`}
                                                        style={FIELD_STYLE}
                                                        onClick={() => {
                                                            setSelectedEntryIdForOperator(entry.id)
                                                            setSelectedOperatorIndex(opIdx)
                                                            setShowOperatorModal(true)
                                                        }}
                                                    >
                                                        {selectedOperator ? selectedOperator.name : 'Select Operator'}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label
                                                    className={SECTION_LABEL_CLASS}
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                >
                                                    Hours
                                                </label>
                                                {readOnly ? (
                                                    <div
                                                        className="text-[12.5px] font-semibold tabular-nums"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        {op.hours || '0'} hrs
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="80"
                                                        step="0.5"
                                                        value={op.hours || ''}
                                                        onChange={(e) =>
                                                            updateOperator(entry.id, opIdx, 'hours', e.target.value)
                                                        }
                                                        className={`${PM_INPUT} w-full tabular-nums`}
                                                        style={FIELD_STYLE}
                                                        placeholder="0"
                                                    />
                                                )}
                                            </div>
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeOperator(entry.id, opIdx)}
                                                    title="Remove operator"
                                                    className="flex items-center justify-center rounded border-none cursor-pointer"
                                                    style={{
                                                        background: 'rgba(220, 38, 38, 0.12)',
                                                        color: '#b91c1c',
                                                        height: 30,
                                                        width: 30
                                                    }}
                                                >
                                                    <i className="fas fa-times text-[10px]" />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {showPlantModal && !loading && (
                <PlantDropdownModal
                    isOpen={showPlantModal}
                    onClose={() => {
                        setShowPlantModal(false)
                        setSelectedEntryIdForPlant(null)
                    }}
                    onSelect={(plantCode) => {
                        if (selectedEntryIdForPlant) {
                            updateEntry(selectedEntryIdForPlant, 'destination_plant', plantCode)
                        }
                        setShowPlantModal(false)
                        setSelectedEntryIdForPlant(null)
                    }}
                    plants={[
                        ...plants.filter(
                            (p) => String(p.plantCode || p.plant_code || '') !== String(currentPlantCode || '')
                        ),
                        { plantCode: 'OTHER_REGION', plantName: 'Other Region' }
                    ]}
                    currentValue={
                        selectedEntryIdForPlant
                            ? entries.find((e) => e.id === selectedEntryIdForPlant)?.destination_plant
                            : ''
                    }
                />
            )}
            {showOperatorModal && !loading && (
                <OperatorSelectModal
                    isOpen={showOperatorModal}
                    onClose={() => {
                        setShowOperatorModal(false)
                        setSelectedEntryIdForOperator(null)
                        setSelectedOperatorIndex(null)
                    }}
                    onSelect={(operatorId) => {
                        if (selectedEntryIdForOperator !== null && selectedOperatorIndex !== null) {
                            updateOperator(selectedEntryIdForOperator, selectedOperatorIndex, 'operator_id', operatorId)
                        }
                        setShowOperatorModal(false)
                        setSelectedEntryIdForOperator(null)
                        setSelectedOperatorIndex(null)
                    }}
                    currentValue={
                        selectedEntryIdForOperator !== null && selectedOperatorIndex !== null
                            ? entries.find((e) => e.id === selectedEntryIdForOperator)?.operators[selectedOperatorIndex]
                                  ?.operator_id
                            : ''
                    }
                    operators={operators.filter((op) => {
                        if (!selectedEntryIdForOperator) return true
                        const currentEntry = entries.find((e) => e.id === selectedEntryIdForOperator)
                        if (!currentEntry) return true
                        const alreadySelected = currentEntry.operators
                            .filter((_, idx) => idx !== selectedOperatorIndex)
                            .map((o) => o.operator_id)
                        return !alreadySelected.includes(op.employeeId)
                    })}
                    assignedPlant={currentPlantCode}
                    mixers={[]}
                    onRefresh={async () => {
                        setLoading(true)
                        try {
                            const { data: operatorsData } = await Database.from('operators')
                                .select('employee_id, name, status, plant_code, smyrna_id, position')
                                .eq('status', 'Active')
                                .eq('plant_code', currentPlantCode)
                                .eq('position', 'Mixer Operator')
                                .order('name')
                            const transformedOperators = (operatorsData || []).map((op) => ({
                                employeeId: op.employee_id,
                                name: op.name,
                                plantCode: op.plant_code,
                                position: op.position,
                                smyrnaId: op.smyrna_id,
                                status: op.status
                            }))
                            setOperators(transformedOperators)
                        } catch (err) {
                            console.error('Error refreshing operators:', err)
                        } finally {
                            setLoading(false)
                        }
                    }}
                />
            )}
        </div>
    )
}
/** Submit-mode plugin for the Plant Manager report — operator metrics, YPH/lost yards, maintenance items, weekly trends, and operator exclusion handling. */
export function PlantManagerSubmitPlugin({
    yph: propYph,
    yphGrade: propYphGrade,
    yphLabel: propYphLabel,
    form,
    setForm,
    weekIso,
    user,
    plants: propPlants,
    userPlantCode: propUserPlantCode
}) {
    const { preferences: _preferences } = usePreferences()
    const userPlantCode = propUserPlantCode || user?.plant_code || ''
    const plantCode = form?.plant || userPlantCode
    const { yph, grade: yphGrade, label: yphLabel } = useYphCalculation(weekIso, plantCode, form)
    const handleOperatorsUpdate = (entries) => {
        setForm({ ...form, operators_sent_to_help: entries })
    }
    return (
        <div className="flex flex-col gap-2.5">
            <OperatorsSentToHelp
                entries={form?.operators_sent_to_help || []}
                onUpdate={handleOperatorsUpdate}
                weekIso={weekIso}
                readOnly={false}
                user={user}
                plantCode={plantCode}
                regionalPlants={propPlants}
            />
            <MetricsSection
                yph={propYph ?? yph}
                yphGrade={propYphGrade ?? yphGrade}
                yphLabel={propYphLabel ?? yphLabel}
            />
            <WeeklyTrendsSection
                currentWeekIso={weekIso}
                plantCode={plantCode || userPlantCode || ''}
                user={{ ...user, plant_code: userPlantCode }}
            />
        </div>
    )
}
/** Review-mode plugin for the Plant Manager report — read-only view of metrics, maintenance items, and weekly trends. */
export function PlantManagerReviewPlugin({
    yph,
    yphGrade,
    yphLabel,
    form,
    weekIso,
    user,
    assignedPlant,
    reportUserId: _reportUserId,
    plants: propPlants
}) {
    const plantCode = assignedPlant || user?.plant_code || form?.plant || ''
    const timelinePlantCode = form?.plant || assignedPlant || user?.plant_code || ''
    return (
        <div className="flex flex-col gap-2.5">
            <OperatorsSentToHelp
                entries={form?.operators_sent_to_help || []}
                onUpdate={() => {}}
                weekIso={weekIso}
                readOnly={true}
                user={user}
                plantCode={plantCode}
                regionalPlants={propPlants}
            />
            <MetricsSection yph={yph} yphGrade={yphGrade} yphLabel={yphLabel} />
            <WeeklyTrendsSection
                currentWeekIso={weekIso}
                plantCode={timelinePlantCode || user?.plant_code || ''}
                user={user}
            />
        </div>
    )
}
