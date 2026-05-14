import { useCallback, useMemo, useState } from 'react'

import { ReportUtility } from '../../utils/ReportUtility'
import {
    currentMonthEndIso,
    currentMonthStartIso,
    currentYearEndIso,
    currentYearStartIso
} from '../constants/reportsViewConstants'

const submittedTsOf = (item) => item.completedDate || item.submitted_at || item.submittedAt || null

/**
 * Owns all filter state and derived `visible*` / `filtered*` lists for the
 * Reports hub tabs (Review, Loss, Quality). State lives here so the main
 * view doesn't carry two dozen filter setters; the derived memos depend on
 * the source lists passed in, plus the user / region scoping inputs.
 */
export function useReportsFilters({
    getUserName,
    lostLoadReports,
    missingReports,
    myPlantCodesSet,
    qcReports,
    regionPlantCodes,
    regionPlantsWithDistricts,
    reporterPlantMap,
    reviewableReports,
    reviewedByCurrentUser,
    searchLower,
    selectedRegionCode,
    selectedWeekIso,
    user
}) {
    /* `searchInput` lives in the orchestrator (not here) because the week
     * timeline hook also depends on it — keeping it outside breaks the
     * circular dependency between the two hooks. */
    const [filterPlant, setFilterPlant] = useState('')
    const [filterReportType, setFilterReportType] = useState('')

    /* `districtPlantSet` is derived from the active plant-district filter and
     * the region's plant-district map. Owned here so consumers can reference
     * it via the returned object without setting up a parallel memo. */
    const districtPlantSet = useMemo(() => {
        if (!filterPlant?.startsWith('DISTRICT:')) return null
        const districtName = filterPlant.slice(9)
        const codes = new Set()
        ;(regionPlantsWithDistricts || []).forEach((p) => {
            const dists = p.districts || []
            if (dists.some((d) => (typeof d === 'string' ? d : d?.name) === districtName)) {
                codes.add(p.plantCode || p.plant_code)
            }
        })
        return codes
    }, [filterPlant, regionPlantsWithDistricts])

    /* ── Review tab ────────────────────────────────────────────── */
    const [reviewStatusFilter, setReviewStatusFilter] = useState('all')
    const [reviewSort, setReviewSort] = useState('newest')
    const [reviewDateFrom, setReviewDateFrom] = useState(currentMonthStartIso)
    const [reviewDateTo, setReviewDateTo] = useState(currentMonthEndIso)

    /* ── Loss tab ──────────────────────────────────────────────── */
    const [lossSort, setLossSort] = useState('newest')
    const [lossDateFrom, setLossDateFrom] = useState(currentYearStartIso)
    const [lossDateTo, setLossDateTo] = useState(currentYearEndIso)
    const [lossDumpLocation, setLossDumpLocation] = useState('all')
    const [lossReason, setLossReason] = useState('all')

    /* ── Quality tab ───────────────────────────────────────────── */
    const [qcTypeFilter, setQcTypeFilter] = useState('all')
    const [qcStatusFilter, setQcStatusFilter] = useState('all')
    const [qcSort, setQcSort] = useState('newest')
    const [qcDateFrom, setQcDateFrom] = useState(currentMonthStartIso)
    const [qcDateTo, setQcDateTo] = useState(currentMonthEndIso)

    /* ── Review tab: visible + filtered ────────────────────────── */
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
                    !selectedRegionCode ||
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
            selectedRegionCode,
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
            if (selectedRegionCode && regionPlantCodes && !regionPlantCodes.has(plantCode)) return false
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
        selectedRegionCode,
        regionPlantCodes,
        filterReportType,
        filterPlant,
        myPlantCodesSet,
        districtPlantSet,
        searchLower
    ])

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
    const clearReviewFilters = useCallback(() => {
        setReviewStatusFilter('all')
        setReviewSort('newest')
        setReviewDateFrom(currentMonthStartIso)
        setReviewDateTo(currentMonthEndIso)
        setFilterReportType('')
    }, [])

    /* ── Loss tab: visible ─────────────────────────────────────── */
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

    const lossHasActiveFilters =
        lossSort !== 'newest' ||
        lossDateFrom !== currentMonthStartIso ||
        lossDateTo !== currentMonthEndIso ||
        lossDumpLocation !== 'all' ||
        lossReason !== 'all'
    const clearLossFilters = useCallback(() => {
        setLossSort('newest')
        setLossDateFrom(currentMonthStartIso)
        setLossDateTo(currentMonthEndIso)
        setLossDumpLocation('all')
        setLossReason('all')
    }, [])

    /* ── Quality tab: visible + personal ───────────────────────── */
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
    }, [
        qcReports,
        qcTypeFilter,
        qcStatusFilter,
        qcSort,
        qcDateFrom,
        qcDateTo,
        districtPlantSet,
        filterPlant,
        getUserName,
        myPlantCodesSet,
        searchLower
    ])

    const qcHasActiveFilters =
        qcTypeFilter !== 'all' ||
        qcStatusFilter !== 'all' ||
        qcSort !== 'newest' ||
        qcDateFrom !== currentMonthStartIso ||
        qcDateTo !== currentMonthEndIso
    const clearQcFilters = useCallback(() => {
        setQcTypeFilter('all')
        setQcStatusFilter('all')
        setQcSort('newest')
        setQcDateFrom(currentMonthStartIso)
        setQcDateTo(currentMonthEndIso)
    }, [])

    /* ── Personal one-off rails ────────────────────────────────── */
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

    return {
        clearLossFilters,
        clearQcFilters,
        clearReviewFilters,
        districtPlantSet,
        filterPlant,
        filterReportType,
        filteredReviewReports,
        lossDateFrom,
        lossDateTo,
        lossDumpLocation,
        lossHasActiveFilters,
        lossReason,
        lossSort,
        myLostLoadReports,
        myQualityReports,
        qcDateFrom,
        qcDateTo,
        qcHasActiveFilters,
        qcSort,
        qcStatusFilter,
        qcTypeFilter,
        reviewDateFrom,
        reviewDateTo,
        reviewHasActiveFilters,
        reviewSort,
        reviewStatusFilter,
        setFilterPlant,
        setFilterReportType,
        setLossDateFrom,
        setLossDateTo,
        setLossDumpLocation,
        setLossReason,
        setLossSort,
        setQcDateFrom,
        setQcDateTo,
        setQcSort,
        setQcStatusFilter,
        setQcTypeFilter,
        setReviewDateFrom,
        setReviewDateTo,
        setReviewSort,
        setReviewStatusFilter,
        visibleLostLoads,
        visibleMissingReports,
        visibleQcReports,
        visibleReviewReports
    }
}
