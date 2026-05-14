import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ReportsModalsHostConnected from '../../../app/components/reports/ReportsModalsHostConnected'
import ReportsToolbar, { ReportsActionBar } from '../../../app/components/reports/ReportsToolbar'
import { ReportsViewSkeleton } from '../../../app/components/reports/ReportsViewSkeletons'
import LostLoadsTabPanel from '../../../app/components/reports/tabs/lost-loads/LostLoadsTabPanel'
import MyReportsTabPanel from '../../../app/components/reports/tabs/my-reports/MyReportsTabPanel'
import QualityTabPanel from '../../../app/components/reports/tabs/quality/QualityTabPanel'
import ReviewTabPanel from '../../../app/components/reports/tabs/review/ReviewTabPanel'
import { usePagination } from '../../../app/hooks/usePagination'
import { useReportsData } from '../../../app/hooks/useReportsData'
import { useReportsFilters } from '../../../app/hooks/useReportsFilters'
import { useReportsHandlers } from '../../../app/hooks/useReportsHandlers'
import { useReportsMissing } from '../../../app/hooks/useReportsMissing'
import { useReportsModals } from '../../../app/hooks/useReportsModals'
import { useReportsQc } from '../../../app/hooks/useReportsQc'
import { useReportsRailCollapse } from '../../../app/hooks/useReportsRailCollapse'
import { useReportSubmission } from '../../../app/hooks/useReportSubmission'
import { useReportsWeekTimeline } from '../../../app/hooks/useReportsWeekTimeline'
import { reportTypeMap, reportTypes } from '../../../app/types/ReportTypes'
import { ReportUtility } from '../../../utils/ReportUtility'
import QualityIssuesView from '../quality/QualityIssuesView'
import ReportsReviewView from './ReportsReviewView'
import ReportsSubmitView from './ReportsSubmitView'

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
        hasLoadedReviewOnce,
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
        prefetchRemainingReviewWeeks,
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

    /* ── Tab + form/review nav state ───────────────────────────── */
    const [showForm, setShowForm] = useState(null)
    const [showReview, setShowReview] = useState(null)
    const [reviewData, setReviewData] = useState(null)
    const [tab, setTab] = useState(null)
    const [activeWeekIso, setActiveWeekIso] = useState(null)
    const [submitInitialData, setSubmitInitialData] = useState(null)
    const [managerEditUser, setManagerEditUser] = useState(null)
    /* `searchInput` lives here (not in `useReportsFilters`) because the week
     * timeline hook also depends on it — keeping the source state in the
     * orchestrator avoids a circular dependency between the two hooks. */
    const [searchInput, setSearchInput] = useState('')
    const searchLower = searchInput.trim().toLowerCase()

    const modals = useReportsModals()

    /* ── Plant scoping ─────────────────────────────────────────── */
    const myPlantCodesSet = useMemo(() => {
        if (!userPlantCode && !userAdditionalPlants.length) return null
        const codes = new Set()
        if (userPlantCode) codes.add(userPlantCode)
        userAdditionalPlants.forEach((code) => codes.add(code))
        return codes
    }, [userPlantCode, userAdditionalPlants])

    /* ── Review permission scoping ─────────────────────────────── */
    const reviewTypeOptions = useMemo(
        () =>
            reportTypes.filter(
                (rt) =>
                    (hasAssigned[rt.name] || hasReviewPermission[rt.name]) &&
                    (regionType !== 'office' || rt.name === 'general_manager')
            ),
        [hasAssigned, hasReviewPermission, regionType]
    )
    const allowedReviewReportNames = useMemo(() => {
        if (isLoadingPermissions) return []
        if (regionType === 'office') return hasReviewPermission['general_manager'] ? ['general_manager'] : []
        return reportTypes
            .filter((rt) => hasReviewPermission[rt.name] && rt.name !== 'general_manager')
            .map((rt) => rt.name)
    }, [hasReviewPermission, regionType, isLoadingPermissions])
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

    /* ── QC + Missing loaders (hooks) ──────────────────────────── */
    const qc = useReportsQc({ fetchProfilesFor, user })
    const missing = useReportsMissing({
        allowedReviewReportNames,
        isLoadingPermissions,
        previousTwoWeekIsos,
        user
    })

    /* ── Week timeline + my-reports memos (hook) ───────────────── */
    /* Declared before `filters` because filters needs the resolved
     * `selectedWeekIso` from the timeline, and the timeline only depends on
     * `searchLower` which the orchestrator owns. */
    const timeline = useReportsWeekTimeline({
        activeWeekIso,
        myReportsByWeek,
        searchLower
    })

    /* ── Filters + visible memos (hook) ────────────────────────── */
    const filters = useReportsFilters({
        getUserName,
        lostLoadReports,
        missingReports: missing.missingReports,
        myPlantCodesSet,
        qcReports: qc.qcReports,
        regionPlantCodes,
        regionPlantsWithDistricts,
        reporterPlantMap,
        reviewableReports,
        reviewedByCurrentUser,
        searchLower,
        selectedRegionCode: preferences.selectedRegion?.code,
        selectedWeekIso: timeline.selectedWeekIso,
        user
    })

    /* If the selected week falls outside a tab's date-range filter, expand
     * that filter to include it. Keeps reports visible when the user scrubs
     * the ribbon to a week outside the default month window. */
    useEffect(() => {
        const iso = timeline.selectedWeekIso
        if (!iso) return
        const { monday, saturday } = ReportUtility.getWeekDatesFromIso(iso)
        if (!monday || !saturday) return
        const mondayIso = monday.toISOString().slice(0, 10)
        const saturdayIso = saturday.toISOString().slice(0, 10)
        if (tab === 'review') {
            if (filters.reviewDateFrom && mondayIso < filters.reviewDateFrom) filters.setReviewDateFrom(mondayIso)
            if (filters.reviewDateTo && saturdayIso > filters.reviewDateTo) filters.setReviewDateTo(saturdayIso)
        } else if (tab === 'lost_loads') {
            if (filters.lossDateFrom && mondayIso < filters.lossDateFrom) filters.setLossDateFrom(mondayIso)
            if (filters.lossDateTo && saturdayIso > filters.lossDateTo) filters.setLossDateTo(saturdayIso)
        } else if (tab === 'quality') {
            if (filters.qcDateFrom && mondayIso < filters.qcDateFrom) filters.setQcDateFrom(mondayIso)
            if (filters.qcDateTo && saturdayIso > filters.qcDateTo) filters.setQcDateTo(saturdayIso)
        }
    }, [timeline.selectedWeekIso, tab, filters])

    /* ── Plant rolldown ────────────────────────────────────────── */
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

    const selectedPlantObj = regionalPlants.find((p) => p.plant_code === filters.filterPlant)
    const plantDisplayText = (() => {
        if (!filters.filterPlant || filters.filterPlant === 'All') return 'All Plants'
        if (filters.filterPlant === 'MY_PLANTS') return 'My Plants'
        if (filters.filterPlant.startsWith('DISTRICT:')) return filters.filterPlant.slice(9)
        if (selectedPlantObj) return `(${selectedPlantObj.plant_code}) ${selectedPlantObj.plant_name}`
        return 'All Plants'
    })()

    /* ── Rail collapse on scroll ───────────────────────────────── */
    const { railCollapsed, railRef } = useReportsRailCollapse(tab)

    /* ── Pagination (Loss tab) ─────────────────────────────────── */
    const lostLoadsPagination = usePagination({
        initialPageSize: 25,
        items: filters.visibleLostLoads,
        resetDependencies: [
            filters.filterPlant,
            searchInput,
            filters.lossSort,
            filters.lossDateFrom,
            filters.lossDateTo,
            filters.lossDumpLocation,
            filters.lossReason
        ]
    })

    /* ── Tab loader fan-out ────────────────────────────────────── */
    const loadMissingReports = missing.loadMissingReports
    const loadQCReports = qc.loadQCReports
    useEffect(() => {
        if (tab === 'review') {
            loadReviewReports(timeline.selectedWeekIso ? [timeline.selectedWeekIso] : null)
            loadMissingReports()
        }
        if (tab === 'lost_loads') loadLostLoadReports()
        if (tab === 'quality') loadQCReports()
    }, [tab, timeline.selectedWeekIso, loadReviewReports, loadLostLoadReports, loadQCReports, loadMissingReports])

    const reviewHistoryPrefetchedRef = useRef(false)
    useEffect(() => {
        if (tab !== 'review') return undefined
        if (reviewHistoryPrefetchedRef.current) return undefined
        if (isLoadingReview) return undefined
        const handle = setTimeout(() => {
            reviewHistoryPrefetchedRef.current = true
            prefetchRemainingReviewWeeks()
        }, 1200)
        return () => clearTimeout(handle)
    }, [tab, isLoadingReview, prefetchRemainingReviewWeeks])

    /* ── Initial tab selection (once permissions resolve) ──────── */
    const hasAnyAssigned = Object.values(hasAssigned || {}).some(Boolean)
    const selectTab = useCallback(
        (nextTab) => {
            setTab(nextTab)
            setActiveWeekIso(nextTab === 'review' ? timeline.prevWeekIso : timeline.thisWeekIso)
            if (typeof document !== 'undefined') {
                document
                    .querySelectorAll('[data-content-scroll]')
                    .forEach((el) => el.scrollTo({ behavior: 'smooth', top: 0 }))
                if (typeof window !== 'undefined') window.scrollTo({ behavior: 'smooth', top: 0 })
            }
        },
        [timeline.prevWeekIso, timeline.thisWeekIso]
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

    /* ── Handlers ──────────────────────────────────────────────── */
    const handlers = useReportsHandlers({
        fetchReportForEdit,
        getUserName,
        managerEditUser,
        markReportReviewed,
        overdueSourceItems: timeline.overdueSourceItems,
        selectedWeekIso: timeline.selectedWeekIso,
        setEditingLabReport: modals.setEditingLabReport,
        setEditingLostLoad: modals.setEditingLostLoad,
        setEditingQcReport: modals.setEditingQcReport,
        setManagerEditUser,
        setReviewData,
        setShowForm,
        setShowReview,
        setSubmitInitialData,
        showForm,
        submitManagerEdit,
        submitReport,
        user
    })

    /* ── Pre-render branches ───────────────────────────────────── */
    if (showForm) {
        const report = reportTypeMap[showForm.name]
            ? { ...reportTypeMap[showForm.name], weekIso: showForm.weekIso }
            : showForm
        return (
            <div className="bg-slate-50 min-h-screen w-full pb-16">
                <ReportsSubmitView
                    report={report}
                    initialData={submitInitialData}
                    onBack={handlers.handleBack}
                    onSubmit={handlers.handleFormSubmit}
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
                    onBack={handlers.handleReviewBack}
                    user={user}
                    completedByUser={reviewData?.userId ? userProfiles[reviewData.userId] : undefined}
                    onManagerEdit={handlers.handleManagerEdit}
                />
            </div>
        )
    }

    /* ── Tab routing + skeletons ───────────────────────────────── */
    const isMyReportsLoading = isLoadingUser || isLoadingMy || isLoadingPermissions
    const isReviewLoading = isLoadingUser || isLoadingPermissions || loadingReporterPlants || isLoadingReview
    const isCurrentTabLoading =
        tab === 'all'
            ? isMyReportsLoading
            : tab === 'review'
              ? isReviewLoading
              : tab === 'quality'
                ? qc.isLoadingQC
                : isLoadingLostLoads
    const showAllSkeleton = tab === 'all' && isMyReportsLoading
    const showReviewSkeleton = tab === 'review' && (isReviewLoading || missing.isLoadingMissing) && !hasLoadedReviewOnce
    const showBootSkeleton = tab === null

    const pillTabs = [
        ...(hasAnyAssigned ? [{ icon: 'fa-file-alt', key: 'all', label: 'My Reports' }] : []),
        ...(hasAnyReviewPermission ? [{ icon: 'fa-clipboard-check', key: 'review', label: 'Review' }] : []),
        ...(hasLostLoadsPermission ? [{ icon: 'fa-truck', key: 'lost_loads', label: 'Loss Reports' }] : []),
        ...(hasOneOffReviewPermission?.qc_strength || hasQCStrengthPermission
            ? [{ icon: 'fa-flask', key: 'quality', label: 'Quality Reports' }]
            : []),
        ...(hasOneOffReviewPermission?.qc_strength || hasQCStrengthPermission
            ? [{ icon: 'fa-clipboard-list', key: 'quality_issues', label: 'Quality Issues' }]
            : [])
    ]
    const accent = preferences.accentColor || '#1e3a5f'
    const onPickWeek = (iso) => iso && setActiveWeekIso(iso)

    return (
        <div className="bg-slate-50 min-h-screen w-full pb-16">
            {loadError && (
                <div className="flex items-center gap-2 m-3 sm:m-4 p-3 sm:p-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                    <i className="fas fa-exclamation-circle" />
                    {loadError}
                </div>
            )}
            <ReportsToolbar
                isLoading={isCurrentTabLoading}
                plantDisplayText={plantDisplayText}
                onPlantModalOpen={() => modals.setIsPlantModalOpen(true)}
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

            <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-5">
                {showBootSkeleton && <ReportsViewSkeleton variant="grid" />}
                {showAllSkeleton && <ReportsViewSkeleton variant="grid" />}
                {showReviewSkeleton && <ReportsViewSkeleton variant="list" />}

                {!showBootSkeleton && !showAllSkeleton && tab === 'all' && (
                    <MyReportsTabPanel
                        accent={accent}
                        handlers={handlers}
                        hasAssigned={hasAssigned}
                        hasLostLoadsPermission={hasLostLoadsPermission}
                        hasQCStrengthPermission={hasQCStrengthPermission}
                        onOpenLostLoad={() => modals.setShowLostLoadModal(true)}
                        onOpenQCStrength={() => modals.setShowQCStrengthModal(true)}
                        onOpenThirdPartyLab={() => modals.setShowLabReportModal(true)}
                        onPickWeek={onPickWeek}
                        railCollapsed={railCollapsed}
                        railRef={railRef}
                        timeline={timeline}
                    />
                )}

                {!showReviewSkeleton && tab === 'review' && (
                    <ReviewTabPanel
                        filters={filters}
                        getUserName={getUserName}
                        handlers={handlers}
                        onPickWeek={onPickWeek}
                        railCollapsed={railCollapsed}
                        railRef={railRef}
                        reviewTypeOptions={reviewTypeOptions}
                        reviewedByCurrentUser={reviewedByCurrentUser}
                        timeline={timeline}
                    />
                )}

                {tab === 'lost_loads' && (
                    <LostLoadsTabPanel
                        accent={accent}
                        deleteLostLoadReport={deleteLostLoadReport}
                        filters={filters}
                        getUserName={getUserName}
                        handlers={handlers}
                        hasLostLoadsDeletePermission={hasLostLoadsDeletePermission}
                        hasLostLoadsPermission={hasLostLoadsPermission}
                        isLoadingLostLoads={isLoadingLostLoads}
                        lostLoadsPagination={lostLoadsPagination}
                        onOpenLostLoadModal={() => modals.setShowLostLoadModal(true)}
                        onSetSelectedLostLoad={modals.setSelectedLostLoad}
                        railCollapsed={railCollapsed}
                        railRef={railRef}
                        regionalPlants={regionalPlants}
                    />
                )}

                {tab === 'quality' && (
                    <QualityTabPanel
                        accent={accent}
                        filters={filters}
                        getUserName={getUserName}
                        handlers={handlers}
                        hasQCStrengthPermission={hasQCStrengthPermission}
                        onOpenLabReportModal={() => modals.setShowLabReportModal(true)}
                        onOpenQcStrengthModal={() => modals.setShowQCStrengthModal(true)}
                        onOpenQualityIssueModal={() => modals.setShowQualityIssueModal(true)}
                        onSetSelectedLabReport={modals.setSelectedLabReport}
                        onSetSelectedQCReport={modals.setSelectedQCReport}
                        qc={qc}
                        railCollapsed={railCollapsed}
                        railRef={railRef}
                    />
                )}

                {tab === 'quality_issues' && (
                    <QualityIssuesView plants={regionalPlants} regionCode={preferences?.selectedRegion?.code || ''} />
                )}
            </div>

            <ReportsModalsHostConnected
                addLostLoadReport={addLostLoadReport}
                filters={filters}
                getUserName={getUserName}
                modals={modals}
                qc={qc}
                regionCode={preferences?.selectedRegion?.code || ''}
                regionalPlants={regionalPlants}
                selectTab={selectTab}
                setTab={setTab}
                tab={tab}
                triggerRefresh={triggerRefresh}
                user={user}
                userPlantCode={userPlantCode}
            />
        </div>
    )
}

export default ReportsView
