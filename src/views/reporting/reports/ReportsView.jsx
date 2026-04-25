import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import { exportLostLoadReports } from '../../../app/components/modules/export/reports/LostLoadExport'
import LostLoadDetailModal from '../../../app/components/reports/LostLoadDetailModal'
import LostLoadReportModal from '../../../app/components/reports/LostLoadReportModal'
import LostLoadsList from '../../../app/components/reports/LostLoadsList'
import QCStrengthDetailModal from '../../../app/components/reports/QCStrengthDetailModal'
import QCStrengthReportModal from '../../../app/components/reports/QCStrengthReportModal'
import ReportsEmptyState from '../../../app/components/reports/ReportsEmptyState'
import ReportsToolbar, {
    LossFilterBar,
    MobileFilterShell,
    QcFilterBar,
    ReportsActionBar,
    ReviewFilterBar
} from '../../../app/components/reports/ReportsToolbar'
import ThirdPartyLabDetailModal from '../../../app/components/reports/ThirdPartyLabDetailModal'
import ThirdPartyLabReportModal from '../../../app/components/reports/ThirdPartyLabReportModal'
import DeadlineFuse from '../../../app/components/reports/v2/DeadlineFuse'
import MergedReviewList from '../../../app/components/reports/v2/MergedReviewList'
import MissingPanel from '../../../app/components/reports/v2/MissingPanel'
import MyOneOffRail from '../../../app/components/reports/v2/MyOneOffRail'
import OverdueBanner from '../../../app/components/reports/v2/OverdueBanner'
import QuickRail from '../../../app/components/reports/v2/QuickRail'
import TrackCard from '../../../app/components/reports/v2/TrackCard'
import WeekRibbon from '../../../app/components/reports/v2/WeekRibbon'
import { usePagination } from '../../../app/hooks/usePagination'
import { useReportsData } from '../../../app/hooks/useReportsData'
import { useReportSubmission } from '../../../app/hooks/useReportSubmission'
import { reportTypeMap, reportTypes } from '../../../app/types/ReportTypes'
import { Database } from '../../../services/DatabaseService'
import { ReportService } from '../../../services/ReportService'
import { UserService } from '../../../services/UserService'
import { ReportUtility } from '../../../utils/ReportUtility'
import ReportsReviewView from './ReportsReviewView'
import ReportsSubmitView from './ReportsSubmitView'

const _now = new Date()
const currentMonthStartIso = new Date(_now.getFullYear(), _now.getMonth(), 1).toISOString().slice(0, 10)
const currentMonthEndIso = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().slice(0, 10)

const REPORTS_START_DATE = new Date('2025-07-20')

const labelForOffset = (weeksAgo) => {
    if (weeksAgo === -1) return 'Next Week'
    if (weeksAgo === 0) return 'This Week'
    if (weeksAgo === 1) return 'Last Week'
    if (weeksAgo < 0) return `${Math.abs(weeksAgo)} weeks ahead`
    return `${weeksAgo} weeks ago`
}

const formatRange = (weekIso) => {
    if (!weekIso) return ''
    const { monday, saturday } = ReportUtility.getWeekDatesFromIso(weekIso)
    if (!monday || !saturday) return ''
    const left = monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    const right = saturday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    return `${left} – ${right}`
}

const addDays = (date, days) => {
    const out = new Date(date)
    out.setDate(out.getDate() + days)
    return out
}

const isoOf = (date) => date.toISOString().slice(0, 10)

const weekIsoOffset = (baseIso, weeksOffset) => {
    if (!baseIso) return ''
    const base = new Date(baseIso)
    if (Number.isNaN(base.getTime())) return ''
    return isoOf(addDays(base, weeksOffset * 7))
}

/**
 * Top-level reports hub. Presents a week-timeline layout for "My Reports",
 * a merged Review & Missing queue for reviewers, and standalone tabs for
 * Quality and Loss reports. Drill-down into the submit / review forms is
 * preserved, along with manager-edit-on-behalf-of.
 */
function ReportsView() {
    const {
        addLostLoadReport,
        deleteLostLoadReport,
        fetchProfilesFor,
        getUserName,
        hasAnyReviewPermission,
        hasAssigned,
        hasLostLoadsDeletePermission,
        hasLostLoadsPermission,
        hasOneOffReviewPermission,
        hasQCStrengthPermission,
        hasReviewPermission,
        isLoadingLostLoads,
        isLoadingMy,
        isLoadingPermissions,
        isLoadingReview,
        isLoadingUser,
        isRefreshing,
        loadError,
        loadLostLoadReports,
        loadReviewReports,
        loadingReporterPlants,
        lostLoadReports,
        markReportReviewed,
        myReportsByWeek,
        plants,
        preferences,
        regionPlantCodes,
        regionPlantsWithDistricts,
        regionType,
        reporterPlantMap,
        reviewableReports,
        reviewedByCurrentUser,
        setLoadError,
        triggerRefresh,
        updateLocalReport,
        user,
        userAdditionalPlants,
        userPlantCode,
        userProfiles
    } = useReportsData()
    const { submitReport, submitManagerEdit, fetchReportForEdit } = useReportSubmission({
        setLoadError,
        updateLocalReport,
        user
    })

    const [showForm, setShowForm] = useState(null)
    const [showReview, setShowReview] = useState(null)
    const [reviewData, setReviewData] = useState(null)
    const [tab, setTab] = useState(null)
    const [activeWeekIso, setActiveWeekIso] = useState(null)
    const [railCollapsed, setRailCollapsed] = useState(false)
    const railRef = useRef(null)
    const [showLostLoadModal, setShowLostLoadModal] = useState(false)
    const [showQCStrengthModal, setShowQCStrengthModal] = useState(false)
    const [showLabReportModal, setShowLabReportModal] = useState(false)
    const [editingLostLoad, setEditingLostLoad] = useState(null)
    const [editingQcReport, setEditingQcReport] = useState(null)
    const [editingLabReport, setEditingLabReport] = useState(null)
    const [qcReports, setQcReports] = useState([])
    const [isLoadingQC, setIsLoadingQC] = useState(false)
    const [qcLoaded, setQcLoaded] = useState(false)
    const [missingReports, setMissingReports] = useState([])
    const [isLoadingMissing, setIsLoadingMissing] = useState(false)
    const [missingLoaded, setMissingLoaded] = useState(false)
    const [selectedQCReport, setSelectedQCReport] = useState(null)
    const [selectedLabReport, setSelectedLabReport] = useState(null)
    const [currentUserWeight, setCurrentUserWeight] = useState(0)
    const [userWeights, setUserWeights] = useState({})
    const [selectedLostLoad, setSelectedLostLoad] = useState(null)
    const [submitInitialData, setSubmitInitialData] = useState(null)
    const [filterReportType, setFilterReportType] = useState('')
    const [filterPlant, setFilterPlant] = useState('')
    const [managerEditUser, setManagerEditUser] = useState(null)
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const [searchInput, setSearchInput] = useState('')
    const [qcTypeFilter, setQcTypeFilter] = useState('all')
    const [qcStatusFilter, setQcStatusFilter] = useState('all')
    const [qcSort, setQcSort] = useState('newest')
    const [qcDateFrom, setQcDateFrom] = useState(currentMonthStartIso)
    const [qcDateTo, setQcDateTo] = useState(currentMonthEndIso)
    const [reviewStatusFilter, setReviewStatusFilter] = useState('all')
    const [reviewSort, setReviewSort] = useState('newest')
    const [reviewDateFrom, setReviewDateFrom] = useState(currentMonthStartIso)
    const [reviewDateTo, setReviewDateTo] = useState(currentMonthEndIso)
    const [lossSort, setLossSort] = useState('newest')
    const [lossDateFrom, setLossDateFrom] = useState(currentMonthStartIso)
    const [lossDateTo, setLossDateTo] = useState(currentMonthEndIso)
    const [lossDumpLocation, setLossDumpLocation] = useState('all')
    const [lossReason, setLossReason] = useState('all')

    const searchLower = searchInput.trim().toLowerCase()

    const myPlantCodesSet = useMemo(() => {
        if (!userPlantCode && !userAdditionalPlants.length) return null
        const codes = new Set()
        if (userPlantCode) codes.add(userPlantCode)
        userAdditionalPlants.forEach((code) => codes.add(code))
        return codes
    }, [userPlantCode, userAdditionalPlants])

    const districtPlantSet = useMemo(() => {
        if (!filterPlant?.startsWith('DISTRICT:')) return null
        const districtName = filterPlant.slice(9)
        const codes = new Set()
        regionPlantsWithDistricts.forEach((p) => {
            const dists = p.districts || []
            if (dists.some((d) => (typeof d === 'string' ? d : d?.name) === districtName)) {
                codes.add(p.plantCode || p.plant_code)
            }
        })
        return codes
    }, [filterPlant, regionPlantsWithDistricts])

    /* ─────────────────────────────────────────────────────────────
       Week timeline — derive this/prev/prev2/next week ISOs, plus
       per-week status hints for the ribbon and day-countdown math
       for the deadline fuse.
       ───────────────────────────────────────────────────────────── */
    const thisWeekIso = useMemo(() => ReportUtility.getLastNWeekIsos(1, new Date())[0] || '', [])
    const prevWeekIso = useMemo(() => weekIsoOffset(thisWeekIso, -1), [thisWeekIso])
    const prev2WeekIso = useMemo(() => weekIsoOffset(thisWeekIso, -2), [thisWeekIso])
    const nextWeekIso = useMemo(() => weekIsoOffset(thisWeekIso, 1), [thisWeekIso])

    const cutoffForWeek = useCallback((weekIso) => {
        const { saturday } = ReportUtility.getWeekDatesFromIso(weekIso)
        if (!saturday) return null
        const cutoff = new Date(saturday)
        cutoff.setHours(23, 59, 59, 999)
        return cutoff
    }, [])

    const daysLeftThisWeek = useMemo(() => {
        const cutoff = cutoffForWeek(thisWeekIso)
        if (!cutoff) return 0
        const diff = cutoff.getTime() - Date.now()
        if (diff <= 0) return 0
        return Math.min(7, Math.max(0, Math.ceil(diff / 86400000)))
    }, [cutoffForWeek, thisWeekIso])

    const todayDayIndex = useMemo(() => {
        const { monday } = ReportUtility.getWeekDatesFromIso(thisWeekIso)
        if (!monday) return 0
        const now = new Date()
        const diffDays = Math.floor((now - monday) / 86400000)
        return Math.max(0, Math.min(6, diffDays))
    }, [thisWeekIso])

    const overdueSourceItems = useMemo(() => {
        const pool = []
        ;[prevWeekIso, prev2WeekIso].forEach((iso) => {
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
            const isThis = idx === 0
            if (isThis) {
                rows.push({
                    hint: daysLeftThisWeek === 0 ? 'Closes today' : `${daysLeftThisWeek}d left`,
                    iso,
                    label: 'This Week',
                    range: formatRange(iso),
                    status: 'open'
                })
                return
            }
            const missing = countUnfinished(iso)
            rows.push({
                hint: missing > 0 ? `${missing} overdue` : 'Closed',
                iso,
                label: labelForOffset(idx),
                range: formatRange(iso),
                status: missing > 0 ? 'late' : 'closed'
            })
        })
        return rows
    }, [daysLeftThisWeek, myReportsByWeek, nextWeekIso])

    const selectedWeekIso = activeWeekIso || thisWeekIso

    const fuseForSelectedWeek = useMemo(() => {
        const { monday, saturday } = ReportUtility.getWeekDatesFromIso(selectedWeekIso)
        if (!monday || !saturday) {
            return { caption: 'days left', daysLeft: 0, mode: 'current', todayIndex: -1 }
        }
        const now = Date.now()
        const cutoff = new Date(saturday)
        cutoff.setHours(23, 59, 59, 999)
        if (now < monday.getTime()) {
            const daysUntil = Math.max(0, Math.ceil((monday.getTime() - now) / 86400000))
            return { caption: 'until opens', daysLeft: daysUntil, mode: 'future', todayIndex: -1 }
        }
        if (now > cutoff.getTime()) {
            return { caption: 'week closed', daysLeft: 0, mode: 'past', todayIndex: -1 }
        }
        const elapsed = Math.max(0, Math.min(6, Math.floor((now - monday.getTime()) / 86400000)))
        const daysLeft = Math.min(7, Math.max(0, Math.ceil((cutoff.getTime() - now) / 86400000)))
        return { caption: `day${daysLeft === 1 ? '' : 's'} left`, daysLeft, mode: 'current', todayIndex: elapsed }
    }, [selectedWeekIso])

    /* If the selected week falls outside a tab's date-range filter,
       expand that filter to include it. Keeps reports visible when the
       user scrubs the ribbon to a week outside the default month window. */
    useEffect(() => {
        if (!selectedWeekIso) return
        const { monday, saturday } = ReportUtility.getWeekDatesFromIso(selectedWeekIso)
        if (!monday || !saturday) return
        const mondayIso = monday.toISOString().slice(0, 10)
        const saturdayIso = saturday.toISOString().slice(0, 10)
        const coversReview = tab === 'review'
        const coversLoss = tab === 'lost_loads'
        const coversQuality = tab === 'quality'
        if (coversReview) {
            if (reviewDateFrom && mondayIso < reviewDateFrom) setReviewDateFrom(mondayIso)
            if (reviewDateTo && saturdayIso > reviewDateTo) setReviewDateTo(saturdayIso)
        }
        if (coversLoss) {
            if (lossDateFrom && mondayIso < lossDateFrom) setLossDateFrom(mondayIso)
            if (lossDateTo && saturdayIso > lossDateTo) setLossDateTo(saturdayIso)
        }
        if (coversQuality) {
            if (qcDateFrom && mondayIso < qcDateFrom) setQcDateFrom(mondayIso)
            if (qcDateTo && saturdayIso > qcDateTo) setQcDateTo(saturdayIso)
        }
    }, [selectedWeekIso, tab, reviewDateFrom, reviewDateTo, lossDateFrom, lossDateTo, qcDateFrom, qcDateTo])

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
        const submitted = flattened
            .filter((i) => i.completed && (i.report?.submitted_at || i.submittedAt))
            .map((i) => ({
                id: i.id,
                kind:
                    i.name === 'qc_strength' ? 'qc_strength' : i.name === 'third_party_lab' ? 'third_party_lab' : null,
                title: i.title || i.name,
                when: ReportUtility.formatDate(i.report?.submitted_at || i.submittedAt)
            }))
            .sort((a, b) => (a.when < b.when ? 1 : -1))
        return submitted.slice(0, 3)
    }, [myReportsByWeek])

    /* ─────────────────────────────────────────────────────────────
       Review & Missing — merged data for the reviewers' tab.
       ───────────────────────────────────────────────────────────── */
    const visibleReviewReports = useMemo(
        () =>
            reviewableReports.filter((report) => {
                const reporterPlant = reporterPlantMap[report.userId] || ''
                const matchPlant =
                    !filterPlant ||
                    filterPlant === 'All' ||
                    (filterPlant === 'MY_PLANTS'
                        ? myPlantCodesSet?.has(reporterPlant)
                        : filterPlant.startsWith('DISTRICT:')
                          ? districtPlantSet?.has(reporterPlant)
                          : reporterPlant === filterPlant)
                const matchRegion =
                    !preferences.selectedRegion?.code ||
                    !regionPlantCodes ||
                    regionPlantCodes.has(reporterPlant) ||
                    report.name === 'general_manager'
                const matchSearch =
                    !searchLower ||
                    report.title?.toLowerCase().includes(searchLower) ||
                    report.name?.toLowerCase().includes(searchLower) ||
                    getUserName(report.userId)?.toLowerCase().includes(searchLower)
                return (
                    (!filterReportType || report.name === filterReportType) && matchPlant && matchRegion && matchSearch
                )
            }),
        [
            reviewableReports,
            filterReportType,
            filterPlant,
            preferences.selectedRegion?.code,
            regionPlantCodes,
            reporterPlantMap,
            searchLower,
            getUserName,
            myPlantCodesSet,
            districtPlantSet
        ]
    )

    const submittedReviewKeys = useMemo(() => {
        const keys = new Set()
        reviewableReports.forEach((r) => {
            if (!r.userId || !r.name || !r.week) return
            keys.add(`${r.userId}::${r.name}::${ReportUtility.normalizeWeekStr(r.week)}`)
        })
        return keys
    }, [reviewableReports])

    const visibleMissingReports = useMemo(() => {
        const selectedNormalized = ReportUtility.normalizeWeekStr(selectedWeekIso)
        return missingReports.filter((item) => {
            const plantCode = item.plant_code || ''
            if (ReportUtility.normalizeWeekStr(item.week) !== selectedNormalized) return false
            const key = `${item.userId}::${item.report_name}::${ReportUtility.normalizeWeekStr(item.week)}`
            if (submittedReviewKeys.has(key)) return false
            if (preferences.selectedRegion?.code && regionPlantCodes && !regionPlantCodes.has(plantCode)) return false
            if (filterReportType && item.report_name !== filterReportType) return false
            if (filterPlant && filterPlant !== 'All') {
                if (filterPlant === 'MY_PLANTS') {
                    if (!myPlantCodesSet?.has(plantCode)) return false
                } else if (filterPlant.startsWith('DISTRICT:')) {
                    if (!districtPlantSet?.has(plantCode)) return false
                } else if (plantCode !== filterPlant) {
                    return false
                }
            }
            if (searchLower) {
                const reporterFull = `${item.first_name || ''} ${item.last_name || ''}`.trim().toLowerCase()
                const matchSearch =
                    plantCode.toLowerCase().includes(searchLower) ||
                    (item.report_name || '').toLowerCase().includes(searchLower) ||
                    reporterFull.includes(searchLower)
                if (!matchSearch) return false
            }
            return true
        })
    }, [
        missingReports,
        selectedWeekIso,
        submittedReviewKeys,
        preferences.selectedRegion?.code,
        regionPlantCodes,
        filterReportType,
        filterPlant,
        myPlantCodesSet,
        districtPlantSet,
        searchLower
    ])

    const submittedTsOf = (item) => item.completedDate || item.submitted_at || item.submittedAt || null

    const filteredReviewReports = useMemo(() => {
        const selectedNormalized = ReportUtility.normalizeWeekStr(selectedWeekIso)
        let rows = visibleReviewReports.filter((r) => ReportUtility.normalizeWeekStr(r.week) === selectedNormalized)
        if (reviewStatusFilter === 'pending') rows = rows.filter((r) => !reviewedByCurrentUser.has(r.id))
        else if (reviewStatusFilter === 'reviewed') rows = rows.filter((r) => reviewedByCurrentUser.has(r.id))
        if (reviewDateFrom) {
            const from = new Date(reviewDateFrom + 'T00:00:00')
            rows = rows.filter((r) => {
                const ts = submittedTsOf(r)
                return !ts || new Date(ts) >= from
            })
        }
        if (reviewDateTo) {
            const to = new Date(reviewDateTo + 'T23:59:59')
            rows = rows.filter((r) => {
                const ts = submittedTsOf(r)
                return !ts || new Date(ts) <= to
            })
        }
        return [...rows].sort((a, b) => {
            const aTs = new Date(submittedTsOf(a) || 0).getTime()
            const bTs = new Date(submittedTsOf(b) || 0).getTime()
            return reviewSort === 'oldest' ? aTs - bTs : bTs - aTs
        })
    }, [
        visibleReviewReports,
        reviewStatusFilter,
        reviewDateFrom,
        reviewDateTo,
        reviewSort,
        reviewedByCurrentUser,
        selectedWeekIso
    ])

    const reviewHasActiveFilters =
        reviewStatusFilter !== 'all' ||
        reviewSort !== 'newest' ||
        reviewDateFrom !== currentMonthStartIso ||
        reviewDateTo !== currentMonthEndIso ||
        !!filterReportType
    const clearReviewFilters = () => {
        setReviewStatusFilter('all')
        setReviewSort('newest')
        setReviewDateFrom(currentMonthStartIso)
        setReviewDateTo(currentMonthEndIso)
        setFilterReportType('')
    }
    const reviewTypeOptions = useMemo(
        () =>
            reportTypes.filter(
                (rt) =>
                    (hasAssigned[rt.name] || hasReviewPermission[rt.name]) &&
                    (regionType !== 'office' || rt.name === 'general_manager')
            ),
        [hasAssigned, hasReviewPermission, regionType]
    )

    const pendingReviewCount = visibleReviewReports.filter((r) => !reviewedByCurrentUser.has(r.id)).length
    const pendingQcCount = qcReports.filter((r) => !r.reviewed).length

    /* ─────────────────────────────────────────────────────────────
       Loss / QC tab data & pagination (unchanged from prior version)
       ───────────────────────────────────────────────────────────── */
    const visibleLostLoads = useMemo(() => {
        const filtered = lostLoadReports.filter((r) => {
            const reportPlant = r.data?.plant || ''
            const matchPlant =
                !filterPlant ||
                filterPlant === 'All' ||
                (filterPlant === 'MY_PLANTS'
                    ? myPlantCodesSet?.has(reportPlant)
                    : filterPlant.startsWith('DISTRICT:')
                      ? districtPlantSet?.has(reportPlant)
                      : reportPlant === filterPlant)
            const matchSearch =
                !searchLower ||
                reportPlant.toLowerCase().includes(searchLower) ||
                r.data?.truck_number?.toLowerCase().includes(searchLower) ||
                r.data?.reason?.toLowerCase().includes(searchLower) ||
                getUserName(r.userId)?.toLowerCase().includes(searchLower)
            if (!matchPlant || !matchSearch) return false
            if (lossDumpLocation && lossDumpLocation !== 'all') {
                if ((r.data?.dump_location || '') !== lossDumpLocation) return false
            }
            if (lossReason && lossReason !== 'all') {
                const reasonText = r.data?.reason || ''
                const category = reasonText.split(':')[0]?.trim()
                if (category !== lossReason) return false
            }
            if (lossDateFrom) {
                const from = new Date(lossDateFrom + 'T00:00:00')
                const ts = r.submitted_at
                if (!ts || new Date(ts) < from) return false
            }
            if (lossDateTo) {
                const to = new Date(lossDateTo + 'T23:59:59')
                const ts = r.submitted_at
                if (!ts || new Date(ts) > to) return false
            }
            return true
        })
        return [...filtered].sort((a, b) => {
            const aTs = new Date(a.submitted_at || 0).getTime()
            const bTs = new Date(b.submitted_at || 0).getTime()
            return lossSort === 'oldest' ? aTs - bTs : bTs - aTs
        })
    }, [
        lostLoadReports,
        filterPlant,
        myPlantCodesSet,
        districtPlantSet,
        searchLower,
        getUserName,
        lossDateFrom,
        lossDateTo,
        lossSort,
        lossDumpLocation,
        lossReason
    ])
    const myQualityReports = useMemo(
        () =>
            qcReports
                .filter((r) => r.userId === user?.id)
                .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
                .slice(0, 20),
        [qcReports, user?.id]
    )
    const myLostLoadReports = useMemo(
        () =>
            (Array.isArray(lostLoadReports) ? lostLoadReports : [])
                .filter((r) => r.userId === user?.id)
                .map((r) => ({ ...r, name: 'lost_load' }))
                .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))
                .slice(0, 20),
        [lostLoadReports, user?.id]
    )
    const handleEditMyOneOff = useCallback((report) => {
        if (!report) return
        if (report.name === 'qc_strength') setEditingQcReport(report)
        else if (report.name === 'third_party_lab') setEditingLabReport(report)
        else if (report.name === 'lost_load') setEditingLostLoad(report)
    }, [])
    const lossHasActiveFilters =
        lossSort !== 'newest' ||
        lossDateFrom !== currentMonthStartIso ||
        lossDateTo !== currentMonthEndIso ||
        lossDumpLocation !== 'all' ||
        lossReason !== 'all'
    const clearLossFilters = () => {
        setLossSort('newest')
        setLossDateFrom(currentMonthStartIso)
        setLossDateTo(currentMonthEndIso)
        setLossDumpLocation('all')
        setLossReason('all')
    }
    const lostLoadsPagination = usePagination({
        initialPageSize: 25,
        items: visibleLostLoads,
        resetDependencies: [filterPlant, searchInput, lossSort, lossDateFrom, lossDateTo, lossDumpLocation, lossReason]
    })
    const regionalPlants = useMemo(() => {
        const filtered = plants.filter(
            (p) => !preferences.selectedRegion?.code || !regionPlantCodes || regionPlantCodes.has(p.plant_code)
        )
        if (!regionPlantsWithDistricts.length) return filtered
        const districtMap = {}
        regionPlantsWithDistricts.forEach((rp) => {
            const code = rp.plantCode || rp.plant_code
            if (code && rp.districts?.length) districtMap[code] = rp.districts
        })
        return filtered.map((p) => (districtMap[p.plant_code] ? { ...p, districts: districtMap[p.plant_code] } : p))
    }, [plants, preferences.selectedRegion?.code, regionPlantCodes, regionPlantsWithDistricts])
    const selectedPlantObj = regionalPlants.find((p) => p.plant_code === filterPlant)
    const plantDisplayText = (() => {
        if (!filterPlant || filterPlant === 'All') return 'All Plants'
        if (filterPlant === 'MY_PLANTS') return 'My Plants'
        if (filterPlant.startsWith('DISTRICT:')) return filterPlant.slice(9)
        if (selectedPlantObj) return `(${selectedPlantObj.plant_code}) ${selectedPlantObj.plant_name}`
        return 'All Plants'
    })()
    const isMyReportsLoading = isLoadingUser || isLoadingMy || isLoadingPermissions
    const isReviewLoading = isLoadingUser || isLoadingPermissions || loadingReporterPlants || isLoadingReview

    /* ─────────────────────────────────────────────────────────────
       QC / Missing loaders (unchanged from prior version)
       ───────────────────────────────────────────────────────────── */
    const loadQCReports = useCallback(async () => {
        if (!user || qcLoaded) return
        setIsLoadingQC(true)
        try {
            const { data, error } = await Database.from('reports')
                .select('id,report_name,user_id,submitted_at,data,completed,week,been_reviewed')
                .in('report_name', ['qc_strength', 'third_party_lab'])
                .eq('completed', true)
                .order('submitted_at', { ascending: false })
            if (!error && Array.isArray(data)) {
                const mapped = data.map((r) => ({
                    data: r.data,
                    id: r.id,
                    name: r.report_name,
                    reviewed: r.been_reviewed,
                    submittedAt: r.submitted_at,
                    userId: r.user_id,
                    week: r.week
                }))
                setQcReports(mapped)
                const uniqueUserIds = [...new Set(mapped.map((r) => r.userId).filter(Boolean))]
                if (uniqueUserIds.length > 0) fetchProfilesFor(uniqueUserIds)
            }
        } catch (err) {
            console.error('Failed to load QC reports:', err)
        }
        setIsLoadingQC(false)
        setQcLoaded(true)
        UserService.getUserWeight(user.id)
            .then(setCurrentUserWeight)
            .catch(() => {})
    }, [user, qcLoaded, fetchProfilesFor])

    const previousTwoWeekIsos = useMemo(() => {
        const now = new Date()
        const candidates = ReportUtility.getLastNWeekIsos(4, now)
        const completed = []
        for (const iso of candidates) {
            const { saturday } = ReportUtility.getWeekDatesFromIso(iso)
            if (saturday && saturday < now) {
                completed.push(iso)
                if (completed.length === 2) break
            }
        }
        return completed
    }, [])

    const allowedReviewReportNames = useMemo(() => {
        if (isLoadingPermissions) return []
        if (regionType === 'office') return hasReviewPermission['general_manager'] ? ['general_manager'] : []
        return reportTypes
            .filter((rt) => hasReviewPermission[rt.name] && rt.name !== 'general_manager')
            .map((rt) => rt.name)
    }, [hasReviewPermission, regionType, isLoadingPermissions])

    const loadMissingReports = useCallback(async () => {
        if (!user || isLoadingPermissions || missingLoaded) return
        if (allowedReviewReportNames.length === 0) {
            setMissingReports([])
            setMissingLoaded(true)
            return
        }
        setIsLoadingMissing(true)
        try {
            const overdue = await ReportService.fetchOverdueAssignments(new Date(), {
                allowedReview: allowedReviewReportNames
            })
            const weekSet = new Set(previousTwoWeekIsos)
            setMissingReports(
                (Array.isArray(overdue) ? overdue : []).filter((item) => item.week && weekSet.has(item.week))
            )
        } catch (err) {
            console.error('Failed to load missing reports:', err)
            setMissingReports([])
        }
        setIsLoadingMissing(false)
        setMissingLoaded(true)
    }, [user, isLoadingPermissions, missingLoaded, allowedReviewReportNames, previousTwoWeekIsos])

    useEffect(() => {
        if (tab === 'review') {
            loadReviewReports()
            loadMissingReports()
        }
        if (tab === 'lost_loads') loadLostLoadReports()
        if (tab === 'quality') loadQCReports()
    }, [tab, loadReviewReports, loadLostLoadReports, loadQCReports, loadMissingReports])

    const hasAnyAssigned = Object.values(hasAssigned || {}).some(Boolean)

    // Collapse the right-side rail (fading the column out and letting the
    // main list span full width) once the user has scrolled past the rail.
    // Uses scrollHeight (natural content height) so the trigger point stays
    // stable once collapsed, plus a hysteresis gap so scroll jitter near the
    // boundary doesn't oscillate the state.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined
        const scrollContainer = document.querySelector('[data-content-scroll]') || window
        const isWindow = scrollContainer === window
        const getContainerTop = () => (isWindow ? 0 : scrollContainer.getBoundingClientRect().top)
        const HYSTERESIS = 48
        const update = () => {
            const node = railRef.current
            if (!node) {
                setRailCollapsed(false)
                return
            }
            const rect = node.getBoundingClientRect()
            const naturalBottom = rect.top + node.scrollHeight
            const threshold = getContainerTop()
            setRailCollapsed((prev) => {
                if (prev) return naturalBottom <= threshold + HYSTERESIS
                return naturalBottom <= threshold + 8
            })
        }
        update()
        const target = isWindow ? window : scrollContainer
        target.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)
        const ro = new ResizeObserver(update)
        if (railRef.current) ro.observe(railRef.current)
        return () => {
            target.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
            ro.disconnect()
        }
    }, [tab])
    const selectTab = useCallback(
        (nextTab) => {
            setTab(nextTab)
            setActiveWeekIso(nextTab === 'review' ? prevWeekIso : thisWeekIso)
            if (typeof document !== 'undefined') {
                const scrollers = document.querySelectorAll('[data-content-scroll]')
                scrollers.forEach((el) => el.scrollTo({ behavior: 'smooth', top: 0 }))
                if (typeof window !== 'undefined') window.scrollTo({ behavior: 'smooth', top: 0 })
            }
        },
        [prevWeekIso, thisWeekIso]
    )
    useEffect(() => {
        if (tab !== null || isLoadingPermissions) return
        if (hasAnyAssigned) return selectTab('all')
        if (hasAnyReviewPermission) return selectTab('review')
        if (hasOneOffReviewPermission?.qc_strength || hasQCStrengthPermission) return selectTab('quality')
        if (hasLostLoadsPermission) return selectTab('lost_loads')
    }, [
        tab,
        isLoadingPermissions,
        hasAnyAssigned,
        hasAnyReviewPermission,
        hasOneOffReviewPermission,
        hasQCStrengthPermission,
        hasLostLoadsPermission,
        selectTab
    ])

    const fetchWeightForUser = useCallback(
        async (userId) => {
            if (userWeights[userId] !== undefined) return userWeights[userId]
            const weight = await UserService.getUserWeight(userId).catch(() => 0)
            setUserWeights((prev) => ({ ...prev, [userId]: weight }))
            return weight
        },
        [userWeights]
    )
    const handleDeleteQCReport = useCallback(
        async (report) => {
            const submitterWeight = await fetchWeightForUser(report.userId)
            if (currentUserWeight < submitterWeight) return
            if (!window.confirm('Delete this QC Strength Report?')) return
            await Database.from('reports').delete().eq('id', report.id)
            setQcReports((prev) => prev.filter((r) => r.id !== report.id))
        },
        [currentUserWeight, fetchWeightForUser]
    )

    /* ─────────────────────────────────────────────────────────────
       Navigation handlers (unchanged)
       ───────────────────────────────────────────────────────────── */
    const handleSubmitReport = async (formData, completed = true) => {
        const result = await submitReport({ completed, formData, showForm })
        if (result.success) setShowForm(null)
    }
    const handleManagerEditSubmit = async (formData) => {
        const result = await submitManagerEdit({ formData, managerEditUser, showForm })
        if (result.success) {
            setShowForm(null)
            setManagerEditUser(null)
        }
    }
    const handleReview = async (report) => {
        if (report.userId !== user?.id) {
            const success = await ReportService.markReviewed(report.id, user.id)
            if (success) markReportReviewed(report.id)
        }
        setReviewData(report)
        setShowReview(reportTypes.find((rt) => rt.name === report.name))
    }
    const handleManagerEdit = (reportType, reportData) => {
        setShowReview(null)
        setReviewData(null)
        setShowForm({ ...reportType, name: reportType.name, weekIso: reportData.week || reportData.data?.week })
        setSubmitInitialData({ ...reportData, data: reportData.data })
        setManagerEditUser(reportData.userId)
    }
    const handleShowForm = useCallback(
        async (item) => {
            setSubmitInitialData(null)
            if (user && item?.name && item.weekIso) {
                const existingData = await fetchReportForEdit({ item, userId: user.id })
                if (existingData) setSubmitInitialData(existingData)
            }
            setShowForm(item)
        },
        [fetchReportForEdit, user]
    )
    const handleBack = () => {
        setShowForm(null)
        setManagerEditUser(null)
    }
    const handleReviewBack = () => {
        setShowReview(null)
        setReviewData(null)
    }
    const handleFormSubmit = (form, submitType) => {
        managerEditUser ? handleManagerEditSubmit(form) : handleSubmitReport(form, submitType === 'submit')
    }
    const handleTrackAction = useCallback(
        (item) => {
            handleShowForm({ ...item, weekIso: item.weekIso || selectedWeekIso })
        },
        [handleShowForm, selectedWeekIso]
    )

    const handleSubmitOldestOverdue = useCallback(() => {
        const oldest = overdueSourceItems[0]
        if (!oldest) return
        handleShowForm({ ...oldest, weekIso: oldest.weekIso })
    }, [handleShowForm, overdueSourceItems])

    const handleNudge = useCallback(
        (item) => {
            const name = item?.submitter || (item?.user_id ? getUserName?.(item.user_id) : 'the submitter')
            // Nudge is currently a client-side acknowledgement until a notification hook is wired.
            window.alert(`Nudged ${name} about: ${item?.reportTitle || item?.title || item?.report_name}`)
        },
        [getUserName]
    )

    /* ─────────────────────────────────────────────────────────────
       Branching: form / review / main layout
       ───────────────────────────────────────────────────────────── */
    const visibleQcReports = useMemo(() => {
        let result = qcReports
        if (qcTypeFilter !== 'all') result = result.filter((r) => r.name === qcTypeFilter)
        if (qcStatusFilter === 'pending') result = result.filter((r) => !r.reviewed)
        else if (qcStatusFilter === 'reviewed') result = result.filter((r) => r.reviewed)
        if (qcDateFrom) {
            const from = new Date(qcDateFrom + 'T00:00:00')
            result = result.filter((r) => r.submittedAt && new Date(r.submittedAt) >= from)
        }
        if (qcDateTo) {
            const to = new Date(qcDateTo + 'T23:59:59')
            result = result.filter((r) => r.submittedAt && new Date(r.submittedAt) <= to)
        }
        if (filterPlant && filterPlant !== 'All') {
            result = result.filter((r) => {
                const plant = r.data?.plant || ''
                if (filterPlant === 'MY_PLANTS') return myPlantCodesSet?.has(plant)
                if (filterPlant.startsWith('DISTRICT:')) return districtPlantSet?.has(plant)
                return plant === filterPlant
            })
        }
        if (searchLower) {
            result = result.filter((r) => {
                const d = r.data || {}
                const title = d.contractor || d.project || d.lab_company_name || ''
                const reporter = getUserName(r.userId) || ''
                return (
                    title.toLowerCase().includes(searchLower) ||
                    reporter.toLowerCase().includes(searchLower) ||
                    (d.plant || '').toLowerCase().includes(searchLower) ||
                    (d.customer || '').toLowerCase().includes(searchLower)
                )
            })
        }
        return [...result].sort((a, b) => {
            if (qcSort === 'oldest') return new Date(a.submittedAt) - new Date(b.submittedAt)
            if (qcSort === 'cast_asc') return (a.data?.date_molded || '') < (b.data?.date_molded || '') ? -1 : 1
            if (qcSort === 'cast_desc') return (a.data?.date_molded || '') > (b.data?.date_molded || '') ? -1 : 1
            return new Date(b.submittedAt) - new Date(a.submittedAt)
        })
    }, [qcReports, qcTypeFilter, qcStatusFilter, qcSort, qcDateFrom, qcDateTo])
    const qcHasActiveFilters =
        qcTypeFilter !== 'all' ||
        qcStatusFilter !== 'all' ||
        qcSort !== 'newest' ||
        qcDateFrom !== currentMonthStartIso ||
        qcDateTo !== currentMonthEndIso
    const clearQcFilters = () => {
        setQcTypeFilter('all')
        setQcStatusFilter('all')
        setQcSort('newest')
        setQcDateFrom(currentMonthStartIso)
        setQcDateTo(currentMonthEndIso)
    }

    if (showForm) {
        const report = reportTypeMap[showForm.name]
            ? { ...reportTypeMap[showForm.name], weekIso: showForm.weekIso }
            : showForm
        return (
            <div className="bg-slate-50 min-h-screen w-full pb-16">
                <ReportsSubmitView
                    report={report}
                    initialData={submitInitialData}
                    onBack={handleBack}
                    onSubmit={handleFormSubmit}
                    user={user}
                    readOnly={showReview === null && reviewData !== null}
                    managerEditUser={managerEditUser}
                    userProfiles={userProfiles}
                />
            </div>
        )
    }
    if (showReview) {
        return (
            <div className="bg-slate-50 min-h-screen w-full pb-16">
                <ReportsReviewView
                    report={reportTypeMap[showReview.name] || showReview}
                    initialData={reviewData}
                    onBack={handleReviewBack}
                    user={user}
                    completedByUser={reviewData?.userId ? userProfiles[reviewData.userId] : undefined}
                    onManagerEdit={handleManagerEdit}
                />
            </div>
        )
    }

    const isCurrentTabLoading =
        tab === 'all'
            ? isMyReportsLoading
            : tab === 'review'
              ? isReviewLoading
              : tab === 'quality'
                ? isLoadingQC
                : isLoadingLostLoads

    const pillTabs = [
        ...(hasAnyAssigned ? [{ icon: 'fa-file-alt', key: 'all', label: 'My Reports' }] : []),
        ...(hasAnyReviewPermission ? [{ icon: 'fa-clipboard-check', key: 'review', label: 'Review' }] : []),
        ...(hasOneOffReviewPermission?.qc_strength || hasQCStrengthPermission
            ? [{ icon: 'fa-flask', key: 'quality', label: 'Quality Reports' }]
            : []),
        ...(hasLostLoadsPermission ? [{ icon: 'fa-truck', key: 'lost_loads', label: 'Loss Reports' }] : [])
    ]

    const accent = preferences.accentColor || '#1e3a5f'
    const selectedWeekRange = formatRange(selectedWeekIso)
    const isSelectedWeekFuture = selectedWeekIso === nextWeekIso
    const isSelectedWeekThis = selectedWeekIso === thisWeekIso

    const ribbonSkeleton = (
        <div className="flex gap-2.5 py-1">
            {[1, 2, 3, 4].map((i) => (
                <div
                    key={i}
                    className="flex-1 bg-white border border-border-light rounded-xl px-4 py-3.5 animate-pulse"
                >
                    <div className="h-2.5 w-16 rounded bg-slate-200 mb-2" />
                    <div className="h-4 w-24 rounded bg-slate-200 mb-2.5" />
                    <div className="h-2.5 w-20 rounded bg-slate-100" />
                </div>
            ))}
        </div>
    )
    const fuseSkeleton = (
        <div className="bg-white border border-border-light rounded-xl px-5 py-4 flex items-center gap-5 animate-pulse">
            <div className="hidden sm:block">
                <div className="h-2.5 w-14 rounded bg-slate-200 mb-2" />
                <div className="h-4 w-28 rounded bg-slate-200" />
            </div>
            <div className="flex-1 h-2 bg-slate-100 rounded-full" />
            <div className="hidden sm:block text-right">
                <div className="h-7 w-10 rounded bg-slate-200 mb-1" />
                <div className="h-2.5 w-16 rounded bg-slate-100" />
            </div>
        </div>
    )
    const trackGridSkeleton = (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-border-light overflow-hidden animate-pulse">
                    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-light">
                        <div className="w-9 h-9 rounded-lg bg-slate-200" />
                        <div className="flex-1">
                            <div className="h-3.5 w-48 rounded bg-slate-200 mb-1.5" />
                            <div className="h-2.5 w-32 rounded bg-slate-100" />
                        </div>
                        <div className="h-5 w-16 rounded-full bg-slate-200" />
                    </div>
                    <div className="flex gap-1 px-4 py-2.5">
                        <div className="w-6 h-2 rounded bg-slate-200 mr-1" />
                        {[1, 2, 3, 4, 5].map((j) => (
                            <div key={j} className="flex-1 h-1.5 rounded bg-slate-100" />
                        ))}
                    </div>
                    <div className="flex items-center justify-end px-4 pb-3.5 pt-1">
                        <div className="h-7 w-20 rounded-lg bg-slate-200" />
                    </div>
                </div>
            ))}
        </div>
    )
    const listRowsSkeleton = (
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border-light last:border-b-0 animate-pulse"
                >
                    <div className="w-9 h-9 rounded-lg bg-slate-200" />
                    <div className="flex-1">
                        <div className="h-3.5 w-56 rounded bg-slate-200 mb-1.5" />
                        <div className="h-2.5 w-40 rounded bg-slate-100" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-slate-200" />
                    <div className="h-7 w-16 rounded-md bg-slate-200 hidden sm:block" />
                </div>
            ))}
        </div>
    )
    const railSkeleton = (
        <aside className="bg-white border border-border-light rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 rounded bg-slate-200" />
                <div className="h-3.5 w-28 rounded bg-slate-200" />
            </div>
            <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-slate-100" />
                ))}
            </div>
        </aside>
    )
    const renderV2Skeleton = (variant) => (
        <div className="flex flex-col gap-4">
            {ribbonSkeleton}
            {fuseSkeleton}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
                <div className="flex flex-col gap-3">
                    <div className="h-3 w-48 rounded bg-slate-200 animate-pulse" />
                    {variant === 'list' ? listRowsSkeleton : trackGridSkeleton}
                </div>
                {railSkeleton}
            </div>
        </div>
    )

    const showAllSkeleton = tab === 'all' && isMyReportsLoading
    const showReviewSkeleton = tab === 'review' && (isReviewLoading || isLoadingMissing)
    const showBootSkeleton = tab === null

    return (
        <div className="bg-slate-50 min-h-screen w-full pb-16">
            <style>{`
                /* Flex-based split so the rail width can truly interpolate
                   instead of snapping (grid-template-columns doesn't animate
                   consistently across browsers). */
                .rv-split {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    align-items: stretch;
                }
                .rv-split > .rv-left { flex: 1 1 auto; min-width: 0; }
                .rv-split > .rv-rail-slot {
                    min-width: 0;
                    overflow: hidden;
                }
                @media (min-width: 1024px) {
                    .rv-split {
                        flex-direction: row;
                        align-items: flex-start;
                    }
                    .rv-split > .rv-rail-slot {
                        width: 320px;
                        margin-left: 0;
                        opacity: 1;
                        transform: translateX(0);
                        transition:
                            width 900ms cubic-bezier(0.65, 0, 0.35, 1),
                            margin-left 900ms cubic-bezier(0.65, 0, 0.35, 1),
                            opacity 650ms cubic-bezier(0.4, 0, 0.2, 1),
                            transform 900ms cubic-bezier(0.65, 0, 0.35, 1);
                        transform-origin: right top;
                        will-change: width, opacity, transform;
                    }
                    .rv-split.rv-split-collapsed > .rv-rail-slot {
                        width: 0;
                        /* Pull left by the gap so the main column truly spans
                           edge-to-edge when the rail is gone. */
                        margin-left: -1rem;
                        opacity: 0;
                        transform: translateX(28px);
                    }
                }
                /* On mobile/tablet the rail stacks below the main column and
                   should fill the viewport. Pin to 320px only at lg+ where the
                   rail sits beside the content and collapsing must clip cleanly
                   (so scrollHeight stays stable and the trigger doesn't oscillate). */
                .rv-rail-fixed { width: 100%; }
                @media (min-width: 1024px) {
                    .rv-rail-fixed { width: 320px; }
                }
            `}</style>
            {loadError && (
                <div className="flex items-center gap-2 m-3 sm:m-4 p-3 sm:p-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                    <i className="fas fa-exclamation-circle" />
                    {loadError}
                </div>
            )}
            <ReportsToolbar
                isLoading={isCurrentTabLoading}
                plantDisplayText={plantDisplayText}
                onPlantModalOpen={() => setIsPlantModalOpen(true)}
                searchInput={searchInput}
                onSearchInputChange={setSearchInput}
                onClearSearch={() => setSearchInput('')}
            />
            <ReportsActionBar
                tabs={pillTabs}
                activeTab={tab}
                onTabChange={selectTab}
                isRefreshing={isRefreshing}
                onRefresh={triggerRefresh}
            />

            <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4">
                {showBootSkeleton && renderV2Skeleton('grid')}
                {showAllSkeleton && renderV2Skeleton('grid')}
                {showReviewSkeleton && renderV2Skeleton('list')}
                {!showBootSkeleton && !showAllSkeleton && tab === 'all' && (
                    <div className="flex flex-col gap-4">
                        <WeekRibbon
                            weeks={weekRibbonData}
                            activeIso={selectedWeekIso}
                            onPick={(iso) => iso && setActiveWeekIso(iso)}
                        />
                        <DeadlineFuse
                            daysLeft={fuseForSelectedWeek.daysLeft}
                            cutoffLabel="Sat · 11:59 PM"
                            todayIndex={fuseForSelectedWeek.todayIndex}
                            mode={fuseForSelectedWeek.mode}
                            caption={fuseForSelectedWeek.caption}
                        />
                        {overdueSourceItems.length > 0 && (
                            <OverdueBanner
                                count={overdueSourceItems.length}
                                title={overdueSourceItems[0]?.title}
                                dueLabel={
                                    overdueSourceItems[0]?.weekIso
                                        ? `week of ${formatRange(overdueSourceItems[0].weekIso)}`
                                        : ''
                                }
                                onSubmit={handleSubmitOldestOverdue}
                            />
                        )}
                        <div className={`rv-split ${railCollapsed ? 'rv-split-collapsed' : ''}`}>
                            <div className="rv-left flex flex-col gap-3 min-w-0">
                                <div
                                    className="text-xs font-bold uppercase tracking-[.06em] text-slate-500"
                                    style={{ fontFamily: 'var(--font-heading)' }}
                                >
                                    {isSelectedWeekFuture
                                        ? `Next Week · ${selectedWeekRange}`
                                        : isSelectedWeekThis
                                          ? `Weekly reports · Track · ${selectedWeekRange}`
                                          : `${selectedWeekRange} · Archive`}
                                </div>
                                {isSelectedWeekFuture ? (
                                    <div className="bg-white rounded-xl border border-border-light py-12 px-4 text-center text-slate-400 text-sm">
                                        Next week opens Monday — nothing to file yet.
                                    </div>
                                ) : myItemsForSelectedWeek.length === 0 ? (
                                    <ReportsEmptyState
                                        tab="all"
                                        hasAssigned={hasAssigned}
                                        hasOneOffAccess={hasLostLoadsPermission || hasQCStrengthPermission}
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {myItemsForSelectedWeek.map((item) => (
                                            <TrackCard
                                                key={`${item.name}-${item.weekIso}`}
                                                item={item}
                                                history={getHistoryForName(item.name)}
                                                onStart={handleTrackAction}
                                                onContinue={handleTrackAction}
                                                onView={handleTrackAction}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div ref={railRef} className="rv-rail-slot">
                                <div className="rv-rail-fixed">
                                    <QuickRail
                                        hasQCStrengthPermission={hasQCStrengthPermission}
                                        hasLostLoadsPermission={hasLostLoadsPermission}
                                        onOpenQCStrength={() => setShowQCStrengthModal(true)}
                                        onOpenThirdPartyLab={() => setShowLabReportModal(true)}
                                        onOpenLostLoad={() => setShowLostLoadModal(true)}
                                        recentItems={recentSubmissions}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!showReviewSkeleton && tab === 'review' && (
                    <div className="flex flex-col gap-4">
                        <WeekRibbon
                            weeks={weekRibbonData}
                            activeIso={selectedWeekIso}
                            onPick={(iso) => iso && setActiveWeekIso(iso)}
                        />
                        <DeadlineFuse
                            daysLeft={fuseForSelectedWeek.daysLeft}
                            cutoffLabel="Sat · 11:59 PM"
                            todayIndex={fuseForSelectedWeek.todayIndex}
                            mode={fuseForSelectedWeek.mode}
                            caption={fuseForSelectedWeek.caption}
                        />
                        <MobileFilterShell
                            label="Filters"
                            activeCount={
                                (reviewStatusFilter !== 'all' ? 1 : 0) +
                                (filterReportType ? 1 : 0) +
                                (reviewDateFrom ? 1 : 0) +
                                (reviewDateTo ? 1 : 0)
                            }
                        >
                            <div className="bg-white border border-border-light rounded-xl px-3 py-2.5">
                                <ReviewFilterBar
                                    statusFilter={reviewStatusFilter}
                                    onStatusFilterChange={setReviewStatusFilter}
                                    reportTypeFilter={filterReportType}
                                    onReportTypeFilterChange={setFilterReportType}
                                    reportTypeOptions={reviewTypeOptions}
                                    sort={reviewSort}
                                    onSortChange={setReviewSort}
                                    dateFrom={reviewDateFrom}
                                    onDateFromChange={setReviewDateFrom}
                                    dateTo={reviewDateTo}
                                    onDateToChange={setReviewDateTo}
                                    hasActiveFilters={reviewHasActiveFilters}
                                    onClear={clearReviewFilters}
                                />
                            </div>
                        </MobileFilterShell>
                        <div className={`rv-split ${railCollapsed ? 'rv-split-collapsed' : ''}`}>
                            <div className="rv-left flex flex-col gap-3 min-w-0">
                                <div
                                    className="text-xs font-bold uppercase tracking-[.06em] text-slate-500"
                                    style={{ fontFamily: 'var(--font-heading)' }}
                                >
                                    Submitted · {selectedWeekRange}
                                </div>
                                <MergedReviewList
                                    missing={[]}
                                    review={filteredReviewReports}
                                    reviewedByCurrentUser={reviewedByCurrentUser}
                                    getUserName={getUserName}
                                    onReview={handleReview}
                                    onNudge={handleNudge}
                                />
                            </div>
                            <div ref={railRef} className="rv-rail-slot">
                                <div className="rv-rail-fixed">
                                    <MissingPanel
                                        missing={visibleMissingReports}
                                        getUserName={getUserName}
                                        onNudge={handleNudge}
                                        weekRangeLabel={selectedWeekRange}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'lost_loads' && (
                    <div className={`rv-split ${railCollapsed ? 'rv-split-collapsed' : ''}`}>
                        <div className="rv-left flex flex-col gap-3 min-w-0">
                            {hasLostLoadsPermission && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowLostLoadModal(true)}
                                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-white text-[10.5px] font-semibold uppercase tracking-wider"
                                        style={{ background: accent }}
                                    >
                                        <i className="fas fa-truck text-[10px]" /> Submit Lost Load
                                    </button>
                                </div>
                            )}
                            <MobileFilterShell
                                label="Filters"
                                activeCount={
                                    (lossDumpLocation !== 'all' ? 1 : 0) +
                                    (lossReason !== 'all' ? 1 : 0) +
                                    (lossDateFrom ? 1 : 0) +
                                    (lossDateTo ? 1 : 0)
                                }
                            >
                                <div className="bg-white border border-border-light rounded-xl px-3 py-2.5">
                                    <LossFilterBar
                                        dumpLocationFilter={lossDumpLocation}
                                        onDumpLocationFilterChange={setLossDumpLocation}
                                        reasonFilter={lossReason}
                                        onReasonFilterChange={setLossReason}
                                        sort={lossSort}
                                        onSortChange={setLossSort}
                                        dateFrom={lossDateFrom}
                                        onDateFromChange={setLossDateFrom}
                                        dateTo={lossDateTo}
                                        onDateToChange={setLossDateTo}
                                        hasActiveFilters={lossHasActiveFilters}
                                        onClear={clearLossFilters}
                                        onExport={
                                            visibleLostLoads.length > 0
                                                ? () =>
                                                      exportLostLoadReports({
                                                          getUserName,
                                                          plants: regionalPlants,
                                                          reports: visibleLostLoads
                                                      })
                                                : undefined
                                        }
                                    />
                                </div>
                            </MobileFilterShell>
                            <LostLoadsList
                                isLoading={isLoadingLostLoads}
                                items={lostLoadsPagination.paginatedItems}
                                pageSize={lostLoadsPagination.pageSize}
                                currentPage={lostLoadsPagination.currentPage}
                                totalPages={lostLoadsPagination.totalPages}
                                onPageSizeChange={lostLoadsPagination.changePageSize}
                                onPageChange={lostLoadsPagination.goToPage}
                                getUserName={getUserName}
                                canDelete={hasLostLoadsDeletePermission}
                                onDelete={deleteLostLoadReport}
                                onRowClick={setSelectedLostLoad}
                            />
                        </div>
                        <div ref={railRef} className="rv-rail-slot">
                            <div className="rv-rail-fixed">
                                <MyOneOffRail
                                    reports={myLostLoadReports}
                                    title="Your Lost Loads"
                                    emptyLabel="You haven't submitted a lost load yet"
                                    onEdit={handleEditMyOneOff}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'quality' && (
                    <div className={`rv-split ${railCollapsed ? 'rv-split-collapsed' : ''}`}>
                        <div className="rv-left flex flex-col gap-3 min-w-0">
                            {hasQCStrengthPermission && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowQCStrengthModal(true)}
                                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-white text-[10.5px] font-semibold uppercase tracking-wider"
                                        style={{ background: accent }}
                                    >
                                        <i className="fas fa-flask text-[10px]" /> Submit QC Strength
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowLabReportModal(true)}
                                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-white text-[10.5px] font-semibold uppercase tracking-wider"
                                        style={{ background: '#e11d48' }}
                                    >
                                        <i className="fas fa-vial text-[10px]" /> Submit Lab Report
                                    </button>
                                </div>
                            )}
                            <MobileFilterShell
                                label="Filters"
                                activeCount={
                                    (qcTypeFilter !== 'all' ? 1 : 0) +
                                    (qcStatusFilter !== 'all' ? 1 : 0) +
                                    (qcDateFrom ? 1 : 0) +
                                    (qcDateTo ? 1 : 0)
                                }
                            >
                                <div className="bg-white border border-border-light rounded-xl px-3 py-2.5">
                                    <QcFilterBar
                                        qcTypeFilter={qcTypeFilter}
                                        onQcTypeFilterChange={setQcTypeFilter}
                                        qcStatusFilter={qcStatusFilter}
                                        onQcStatusFilterChange={setQcStatusFilter}
                                        qcSort={qcSort}
                                        onQcSortChange={setQcSort}
                                        qcDateFrom={qcDateFrom}
                                        onQcDateFromChange={setQcDateFrom}
                                        qcDateTo={qcDateTo}
                                        onQcDateToChange={setQcDateTo}
                                        qcHasActiveFilters={qcHasActiveFilters}
                                        onClearQcFilters={clearQcFilters}
                                    />
                                </div>
                            </MobileFilterShell>
                            {isLoadingQC ? (
                                <div
                                    className="rounded overflow-hidden"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2.5 px-3 py-2"
                                            style={{ borderBottom: '1px solid var(--border-light)' }}
                                        >
                                            <div
                                                className="w-6 h-6 rounded animate-pulse shrink-0"
                                                style={{ background: 'var(--bg-tertiary)' }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div
                                                    className="h-3 w-44 rounded animate-pulse mb-1"
                                                    style={{ background: 'var(--bg-tertiary)' }}
                                                />
                                                <div
                                                    className="h-2.5 w-56 rounded animate-pulse"
                                                    style={{ background: 'var(--bg-secondary)' }}
                                                />
                                            </div>
                                            <div
                                                className="h-4 w-16 rounded animate-pulse shrink-0"
                                                style={{ background: 'var(--bg-tertiary)' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : qcReports.length === 0 ? (
                                <div
                                    className="rounded overflow-hidden"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <div
                                        className="flex flex-col items-center justify-center py-10 px-4"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        <i className="fas fa-flask text-2xl mb-2" />
                                        <div className="text-[12px]">No quality reports submitted yet</div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 px-1">
                                        <span
                                            className="text-[10px] font-semibold uppercase tracking-wider"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Quality Reports
                                        </span>
                                        <span
                                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono tabular-nums"
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            {qcHasActiveFilters
                                                ? `${visibleQcReports.length} / ${qcReports.length}`
                                                : qcReports.length}
                                        </span>
                                    </div>
                                    {visibleQcReports.length === 0 ? (
                                        <div
                                            className="rounded overflow-hidden"
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-light)'
                                            }}
                                        >
                                            <div
                                                className="flex flex-col items-center justify-center py-10 px-4"
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                <i className="fas fa-filter text-2xl mb-2" />
                                                <div className="text-[12px]">No reports match your filters</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="rounded overflow-hidden"
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-light)'
                                            }}
                                        >
                                            {visibleQcReports.map((report) => {
                                                const submittedLabel = report.submittedAt
                                                    ? new Date(report.submittedAt).toLocaleDateString(undefined, {
                                                          day: 'numeric',
                                                          month: 'short'
                                                      })
                                                    : ''
                                                const submitterName = getUserName(report.userId) || 'Unknown'
                                                const d = report.data || {}
                                                const isLabReport = report.name === 'third_party_lab'
                                                const meaningfulStr = (val) =>
                                                    val && typeof val === 'string' && val.trim() && val.trim() !== 'N/A'
                                                        ? val.trim()
                                                        : null
                                                const title = isLabReport
                                                    ? meaningfulStr(d.lab_company_name) || 'Third Party Lab Report'
                                                    : meaningfulStr(d.contractor) ||
                                                      meaningfulStr(d.project) ||
                                                      'QC Strength Report'
                                                const iconClass = isLabReport ? 'fa-vial' : 'fa-flask'
                                                const iconTint = isLabReport
                                                    ? { bg: '#ffe4e6', fg: '#9f1239' }
                                                    : { bg: '#ede9fe', fg: '#6d28d9' }
                                                return (
                                                    <div
                                                        key={report.id}
                                                        className="flex items-center px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary"
                                                        style={{ borderBottom: '1px solid var(--border-light)' }}
                                                        onClick={() =>
                                                            isLabReport
                                                                ? setSelectedLabReport(report)
                                                                : setSelectedQCReport(report)
                                                        }
                                                    >
                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                            <div
                                                                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                                                                style={{
                                                                    background: iconTint.bg,
                                                                    color: iconTint.fg
                                                                }}
                                                            >
                                                                <i className={`fas ${iconClass} text-[11px]`} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span
                                                                    className="text-[12px] font-semibold block truncate"
                                                                    style={{ color: 'var(--text-primary)' }}
                                                                >
                                                                    {title}
                                                                </span>
                                                                <div
                                                                    className="flex items-center gap-1.5 mt-0.5 text-[10.5px]"
                                                                    style={{ color: 'var(--text-secondary)' }}
                                                                >
                                                                    <span className="truncate">{submitterName}</span>
                                                                    {submittedLabel && (
                                                                        <>
                                                                            <span
                                                                                style={{
                                                                                    color: 'var(--text-tertiary)'
                                                                                }}
                                                                            >
                                                                                ·
                                                                            </span>
                                                                            <span className="font-mono tabular-nums">
                                                                                {submittedLabel}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {report.reviewed ? (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0"
                                                                style={{
                                                                    background: '#dcfce7',
                                                                    color: '#166534'
                                                                }}
                                                            >
                                                                Reviewed
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0"
                                                                style={{
                                                                    background: '#fef3c7',
                                                                    color: '#92400e'
                                                                }}
                                                            >
                                                                Pending
                                                            </span>
                                                        )}
                                                        <button
                                                            className="ml-2 px-2 py-1 rounded text-white text-[10.5px] font-semibold shrink-0 hidden sm:inline-flex uppercase tracking-wider"
                                                            style={{ background: accent }}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                isLabReport
                                                                    ? setSelectedLabReport(report)
                                                                    : setSelectedQCReport(report)
                                                            }}
                                                        >
                                                            {report.reviewed ? 'View' : 'Review'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDeleteQCReport(report)
                                                            }}
                                                            className="w-6 h-6 flex items-center justify-center rounded shrink-0 ml-1.5 hidden sm:flex transition-colors hover:bg-bg-tertiary"
                                                            style={{ color: 'var(--text-tertiary)' }}
                                                            title="Delete"
                                                        >
                                                            <i className="fas fa-trash-alt text-[10px]" />
                                                        </button>
                                                        <i
                                                            className="fas fa-chevron-right text-[10px] ml-2 sm:hidden"
                                                            style={{ color: 'var(--text-tertiary)' }}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div ref={railRef} className="rv-rail-slot">
                            <div className="rv-rail-fixed">
                                <MyOneOffRail
                                    reports={myQualityReports}
                                    title="Your Quality Reports"
                                    emptyLabel="You haven't submitted a quality report yet"
                                    onEdit={handleEditMyOneOff}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={() => setIsPlantModalOpen(false)}
                    plants={regionalPlants}
                    onSelect={(plantCode) => {
                        setFilterPlant(plantCode)
                        setIsPlantModalOpen(false)
                    }}
                    showAllPlants={true}
                    showMyPlants={false}
                    userPlantCode={userPlantCode}
                />
            )}
            {(showLostLoadModal || editingLostLoad) && (
                <LostLoadReportModal
                    onClose={() => {
                        setShowLostLoadModal(false)
                        setEditingLostLoad(null)
                    }}
                    onSubmitted={(report) => {
                        addLostLoadReport(report)
                        if (!editingLostLoad && tab !== 'lost_loads') setTab('lost_loads')
                    }}
                    plants={regionalPlants}
                    user={user}
                    initialReport={editingLostLoad}
                />
            )}
            {selectedLostLoad && (
                <LostLoadDetailModal
                    report={selectedLostLoad}
                    getUserName={getUserName}
                    onClose={() => setSelectedLostLoad(null)}
                />
            )}
            {(showQCStrengthModal || editingQcReport) && (
                <QCStrengthReportModal
                    onClose={() => {
                        setShowQCStrengthModal(false)
                        setEditingQcReport(null)
                    }}
                    onSubmitted={() => {
                        setQcLoaded(false)
                        if (tab === 'quality') loadQCReports()
                        if (!editingQcReport) triggerRefresh()
                    }}
                    user={user}
                    initialReport={editingQcReport}
                />
            )}
            {selectedLabReport && (
                <ThirdPartyLabDetailModal
                    report={selectedLabReport}
                    getUserName={getUserName}
                    onClose={() => setSelectedLabReport(null)}
                    onReviewed={(id) => {
                        setQcReports((prev) => prev.map((r) => (r.id === id ? { ...r, reviewed: true } : r)))
                        setSelectedLabReport(null)
                    }}
                />
            )}
            {(showLabReportModal || editingLabReport) && (
                <ThirdPartyLabReportModal
                    onClose={() => {
                        setShowLabReportModal(false)
                        setEditingLabReport(null)
                    }}
                    onSubmitted={() => {
                        setQcLoaded(false)
                        if (tab === 'quality') loadQCReports()
                    }}
                    user={user}
                    initialReport={editingLabReport}
                />
            )}
            {selectedQCReport && (
                <QCStrengthDetailModal
                    report={selectedQCReport}
                    getUserName={getUserName}
                    onClose={() => setSelectedQCReport(null)}
                    onReviewed={(id) => {
                        setQcReports((prev) => prev.map((r) => (r.id === id ? { ...r, reviewed: true } : r)))
                        setSelectedQCReport(null)
                    }}
                />
            )}
        </div>
    )
}
export default ReportsView
