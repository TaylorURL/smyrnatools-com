import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ReportsModalsHostConnected from '../../../app/components/reports/ReportsModalsHostConnected'
import ReportsToolbar, { ReportsActionBar } from '../../../app/components/reports/ReportsToolbar'
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
import { ReportUtility } from '../../../utils/ReportUtility'
import ReportsTabContent from './parts/ReportsTabContent'
import { ReportsHomeOfficeBranch, ReportsReviewBranch, ReportsSubmitBranch } from './parts/ReportsViewBranches'
import {
    buildAllowedReviewReportNames,
    buildMyPlantCodesSet,
    buildPillTabs,
    buildRegionalPlants,
    buildReviewTypeOptions,
    getPreviousTwoCompletedWeekIsos,
    resolvePlantDisplayText
} from './parts/reportsHelpers'

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

    /* ── Plant + review permission scoping ─────────────────────── */
    const myPlantCodesSet = useMemo(
        () => buildMyPlantCodesSet({ userAdditionalPlants, userPlantCode }),
        [userPlantCode, userAdditionalPlants]
    )
    const reviewTypeOptions = useMemo(
        () => buildReviewTypeOptions({ hasAssigned, hasReviewPermission, regionType }),
        [hasAssigned, hasReviewPermission, regionType]
    )
    const allowedReviewReportNames = useMemo(
        () => buildAllowedReviewReportNames({ hasReviewPermission, isLoadingPermissions, regionType }),
        [hasReviewPermission, regionType, isLoadingPermissions]
    )
    const previousTwoWeekIsos = useMemo(() => getPreviousTwoCompletedWeekIsos(), [])

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
    const regionalPlants = useMemo(
        () =>
            buildRegionalPlants({
                plants,
                regionPlantCodes,
                regionPlantsWithDistricts,
                selectedRegionCode: preferences.selectedRegion?.code
            }),
        [plants, preferences.selectedRegion?.code, regionPlantCodes, regionPlantsWithDistricts]
    )
    const plantDisplayText = resolvePlantDisplayText({ filterPlant: filters.filterPlant, regionalPlants })

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
    if (String(regionType || '').toLowerCase() === 'office') {
        return <ReportsHomeOfficeBranch userId={user?.id} />
    }
    if (showForm) {
        return (
            <ReportsSubmitBranch
                handlers={handlers}
                managerEditUser={managerEditUser}
                reviewData={reviewData}
                showForm={showForm}
                showReview={showReview}
                submitInitialData={submitInitialData}
                user={user}
                userProfiles={userProfiles}
            />
        )
    }
    if (showReview) {
        return (
            <ReportsReviewBranch
                handlers={handlers}
                reviewData={reviewData}
                showReview={showReview}
                user={user}
                userProfiles={userProfiles}
            />
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

    const pillTabs = buildPillTabs({
        hasAnyAssigned,
        hasAnyReviewPermission,
        hasLostLoadsPermission,
        hasOneOffReviewPermission,
        hasQCStrengthPermission
    })
    const accent = preferences.accentColor || '#1e3a5f'
    const onPickWeek = (iso) => iso && setActiveWeekIso(iso)

    return (
        <div className="bg-bg-secondary min-h-screen w-full pb-16">
            {loadError && (
                <div
                    className="m-3 flex items-center gap-2 rounded-card border border-status-danger/30 bg-status-danger/10 p-3 text-sm font-medium text-text-primary animate-fade-slide-in sm:m-4 sm:p-4"
                    role="alert"
                >
                    <i className="fas fa-exclamation-circle text-status-danger" aria-hidden="true" />
                    <span>{loadError}</span>
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

            <ReportsTabContent
                accent={accent}
                deleteLostLoadReport={deleteLostLoadReport}
                filters={filters}
                getUserName={getUserName}
                handlers={handlers}
                hasAssigned={hasAssigned}
                hasLostLoadsDeletePermission={hasLostLoadsDeletePermission}
                hasLostLoadsPermission={hasLostLoadsPermission}
                hasQCStrengthPermission={hasQCStrengthPermission}
                isLoadingLostLoads={isLoadingLostLoads}
                lostLoadsPagination={lostLoadsPagination}
                modals={modals}
                onPickWeek={onPickWeek}
                preferences={preferences}
                qc={qc}
                railCollapsed={railCollapsed}
                railRef={railRef}
                regionalPlants={regionalPlants}
                reviewTypeOptions={reviewTypeOptions}
                reviewedByCurrentUser={reviewedByCurrentUser}
                showAllSkeleton={showAllSkeleton}
                showBootSkeleton={showBootSkeleton}
                showReviewSkeleton={showReviewSkeleton}
                tab={tab}
                timeline={timeline}
            />

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
