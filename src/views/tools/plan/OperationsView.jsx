import React, { useCallback, useEffect, useState, useTransition } from 'react'

import { PlanTabSkeleton } from '../../../app/components/common/PlanSkeletons'
import { PlanHeader } from '../../../app/components/plan/PlanHeader'
import { PlanLoadErrorBanner } from '../../../app/components/plan/PlanLoadErrorBanner'
import { PlanPresenceOverlay } from '../../../app/components/plan/PlanPresenceOverlay'
import { PlanReadOnlyBanner } from '../../../app/components/plan/PlanReadOnlyBanner'
import { PlanReviewSendModal } from '../../../app/components/plan/PlanReviewSendModal'
import { PlanScheduleStaleBanner } from '../../../app/components/plan/tabs/schedule/PlanScheduleStaleBanner'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { usePlanActions } from '../../../app/hooks/usePlanActions'
import { usePlanData } from '../../../app/hooks/usePlanData'
import { usePlanDate } from '../../../app/hooks/usePlanDate'
import { usePlanInsights } from '../../../app/hooks/usePlanInsights'
import { usePlanLookups } from '../../../app/hooks/usePlanLookups'
import { usePlanPresence } from '../../../app/hooks/usePlanPresence'
import { usePlanUserContext } from '../../../app/hooks/usePlanUserContext'
import { PLAN_META_KEY } from '../../../utils/PlanUtility'
import BookOrderView from './BookOrderView'
import CallListView from './CallListView'
import PlanDashboardView from './PlanDashboardView'
import PlanDemandView from './PlanDemandView'
import PlanFlowMapView from './PlanFlowMapView'
import PlanScheduleView from './PlanScheduleView'
import PlanSettingsView from './PlanSettingsView'
import PlanStatisticsView from './PlanStatisticsView'

/**
 * OperationsView — plant-centric dispatch operations shell.
 *
 * Dispatchers create daily assignment plans: which plant sends operators
 * to which plant, with arrival times, stagger intervals, and custom
 * per-operator overrides. Generates a copyable text summary for dispatch
 * and auto-saves to the database with realtime sync across users.
 *
 * This file is the shell — header, banners, settings modal, and the tab
 * router. Each tab's heavy logic lives in its own dedicated view file.
 */
/** Temporary region gate — Operations is only available in Houston Concrete while
 *  the statewide rollout is staged. Remove this constant + the early return below
 *  to re-enable everywhere. */
const OPERATIONS_ALLOWED_REGION_NAME = 'Houston Concrete'

/** Out-of-region message — `usePreferences` is the only hook used here so
 *  the rules-of-hooks check is happy with this returning early. The full
 *  Operations UI lives in `<OperationsViewImpl />` below and is only
 *  mounted once the region check passes. */
function OperationsRegionBlocker({ accentColor }) {
    return (
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top plan-view absolute flex items-center justify-center bg-bg-primary"
            style={{ inset: 0 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="operations-region-blocker-title"
        >
            <div className="max-w-md mx-6 rounded-xl border border-border-light bg-bg-secondary px-6 py-8 text-center shadow-lg">
                <i
                    className="fas fa-triangle-exclamation text-2xl mb-3"
                    style={{ color: accentColor }}
                    aria-hidden="true"
                />
                <h2 id="operations-region-blocker-title" className="text-lg font-semibold text-text-primary mb-2">
                    Operations unavailable
                </h2>
                <p className="text-sm text-text-secondary">This functionality is not available in your region yet.</p>
            </div>
        </div>
    )
}

function OperationsView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isDark = preferences.themeMode === 'dark'
    if (preferences.selectedRegion?.name !== OPERATIONS_ALLOWED_REGION_NAME) {
        return <OperationsRegionBlocker accentColor={accentColor} />
    }
    return <OperationsViewImpl accentColor={accentColor} isDark={isDark} />
}

/** Real Operations shell — all heavy hooks live here so they're called in
 *  the same order on every render of THIS component. The wrapper above only
 *  mounts this once the region gate passes, so an out-of-region user never
 *  instantiates these hooks. */
function OperationsViewImpl({ accentColor, isDark }) {
    const isMobile = useIsMobile()

    /* Mobile users get a focused two-tab Operations surface — Dashboard
     * (manager "Your Plant / District / Region" view + clock-ins) and
     * Schedule (the full daily order list in card mode). Any other tab
     * (Planner, Demand, Statistics, etc.) falls back to Dashboard
     * because their wide layouts don't fit a phone. */
    const MOBILE_VIEW_MODES = new Set(['dashboard', 'schedule'])
    const [viewMode, setViewModeRaw] = useState('dashboard')
    const effectiveViewMode = isMobile && !MOBILE_VIEW_MODES.has(viewMode) ? 'dashboard' : viewMode
    const { planDate, setPlanDate } = usePlanDate(effectiveViewMode)

    /* Schedule tab's "maximize" toggle lives here so it survives the data
     * skeleton swap. On a date change `usePlanData` flips `isLoading` true,
     * which routes the body to `PlanTabSkeleton` and unmounts the Schedule
     * view — when state lived inside the view, that unmount silently dropped
     * the maximized flag back to false. Lifted up, it persists across both
     * date changes and tab switches. */
    const [isScheduleMaximized, setIsScheduleMaximized] = useState(false)

    /* Schedule tab's filter / view / sort state — same lift-up rationale as
     * `isScheduleMaximized`. The dispatcher's plant filter, search query,
     * status / product / min-yards filters, sort key, view mode, drawer
     * open-state, and "show extra rows" toggle all need to survive the
     * loading skeleton swap that fires on every date change. */
    const [scheduleFilters, setScheduleFilters] = useState(() => ({
        filtersOpen: !isMobile,
        minYards: '',
        // Multi-select plant filter: empty array = all plants. Keeping
        // an array (not a single code) lets the dispatcher pick whole
        // districts / arbitrary permutations from PlantDropdownModal.
        plantFilters: [],
        productFilter: 'all',
        query: '',
        showCancelled: false,
        showExtraRows: false,
        showTest: false,
        sortKey: 'plantThenTime',
        statusFilter: 'all',
        viewMode: isMobile ? 'cards' : 'table'
    }))
    const updateScheduleFilter = useCallback((key, value) => {
        setScheduleFilters((prev) => ({
            ...prev,
            [key]: typeof value === 'function' ? value(prev[key]) : value
        }))
    }, [])

    // `startTransition` marks the tab swap as low-priority. The current tab
    // stays visible and interactive while React renders the new tab in the
    // background — without this, the Schedule tab's heavy useMemos (table
    // rows, pool timelines, closer-plant lookups) ran synchronously on the
    // click path and froze the page for 5–10s.
    // eslint-disable-next-line no-unused-vars
    const [, startTabTransition] = useTransition()

    const setViewMode = useCallback((mode) => {
        startTabTransition(() => {
            setViewModeRaw(mode)
        })
    }, [])

    const {
        adjacentProduction,
        assignments,
        canEdit,
        isPastPlanDate,
        detailByOrderId,
        getTravelTime,
        isDetailOrdersLoading,
        isLoading,
        isSchedulesSyncing,
        mixerCountsByPlant,
        notes,
        planLoadError,
        plantProduction,
        plants,
        refreshSchedule,
        refreshTravelTimes,
        regionPlants,
        retryPlanLoad,
        scheduleFileUpdatedAt,
        scheduleLastSyncedAt,
        setAssignments,
        setNotes,
        setPlantProduction,
        syncStatus,
        travelTimes,
        userId
    } = usePlanData(planDate)

    const { addTravelTime, calcClockIn, newTravelTime, removeTravelTime, setNewTravelTime } = usePlanActions({
        assignments,
        getTravelTime,
        notes,
        planDate,
        refreshTravelTimes,
        setAssignments,
        setNotes,
        setPlantProduction,
        userId
    })

    const { earliestClockIn, planInsights, shiftSpanHours, stats, totalOps, validAssignmentCount } = usePlanInsights({
        assignments,
        calcClockIn,
        getTravelTime,
        mixerCountsByPlant,
        planDate,
        plantProduction,
        plants,
        travelTimes
    })

    const { canSeeSettingsTab, canSeeYourTab, userPlantCode, userRoleNames } = usePlanUserContext(userId)

    /* Live "who's on this plan right now" roster — feeds the avatar
     * overlay on the Planner tab. `editing` mirrors the autosave bus so
     * remote chips ring red while a teammate is actively saving. */
    const { users: presenceUsers } = usePlanPresence(planDate, {
        isEditing: syncStatus === 'saving',
        userId
    })

    /* Bounce a user off the Settings tab if they ever land there without
     * the `plan.settings` permission (revoked mid-session, deep link, etc.).
     * Belt-and-suspenders — the tab is already hidden from the switcher. */
    useEffect(() => {
        if (viewMode === 'settings' && !canSeeSettingsTab) setViewModeRaw('dashboard')
    }, [viewMode, canSeeSettingsTab])

    const { plantAddressByCode, plantColocationMap, plantNameByCode, plantsWithDistricts, yourPlantScope } =
        usePlanLookups({
            canSeeYourTab,
            plants,
            regionPlants,
            userPlantCode,
            userRoleNames
        })

    /* Review & Send modal — the daily-plan email pipeline. Replaces the
     * old "Copy Plan" affordance: the dispatcher reviews each plant's
     * rendered message + resolved recipients, then ships them in one
     * confirm. While testing every send routes to the redirect inbox
     * baked into the edge function. */
    const [reviewSendOpen, setReviewSendOpen] = useState(false)
    const openReviewSend = useCallback(() => setReviewSendOpen(true), [])
    const closeReviewSend = useCallback(() => setReviewSendOpen(false), [])

    return (
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top plan-view flex flex-col overflow-hidden absolute"
            style={{ inset: 0 }}
        >
            <PlanHeader
                accentColor={accentColor}
                canSeeSettings={canSeeSettingsTab}
                isDark={isDark}
                isMobile={isMobile}
                isRealtime={false}
                isSchedulesSyncing={isSchedulesSyncing}
                onChangeDate={setPlanDate}
                onChangeViewMode={setViewMode}
                onRefresh={refreshSchedule}
                onReviewSend={openReviewSend}
                planDate={planDate}
                scheduleLastSyncedAt={scheduleLastSyncedAt}
                syncStatus={syncStatus}
                viewMode={viewMode}
            />
            <div className="w-full max-w-full overflow-x-hidden flex flex-1 flex-col min-h-0 overflow-hidden">
                {/* Show the skeleton through the WHOLE bootstrap, not just
                    the plants-list fetch. We hold until:
                      • plants list loads (`isLoading`)
                      • the initial schedule sync resolves (or schedule data
                        is already on screen — late background syncs don't
                        re-trigger the skeleton)
                      • the first ticket-detail fetch resolves so cards that
                        depend on ticket data don't pop in after the layout
                        already painted.
                    Each gate clears as soon as that data type lands, so a
                    date with genuinely no schedule / no tickets still drops
                    the skeleton in well under a second. */}
                {(() => {
                    /* Book An Order owns its own form state and lazy-renders
                     * its recommendation panel once data is in. Swapping the
                     * whole view to a skeleton on every date change made the
                     * tab flicker out to a dashboard-shaped placeholder and
                     * back, which read as "the date control bounced me to
                     * another tab." Keep the view mounted and let the panel
                     * handle empty data internally. */
                    if (effectiveViewMode === 'book-order') return false
                    const productionKeys = Object.keys(plantProduction || {}).filter((k) => k !== PLAN_META_KEY)
                    const hasScheduleData = productionKeys.length > 0
                    return isLoading || (isSchedulesSyncing && !hasScheduleData) || isDetailOrdersLoading
                })() ? (
                    <PlanTabSkeleton mode={effectiveViewMode} />
                ) : (
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in-fast">
                        {planLoadError && <PlanLoadErrorBanner message={planLoadError} onRetry={retryPlanLoad} />}
                        {!canEdit && (
                            <PlanReadOnlyBanner
                                accentColor={accentColor}
                                reason={isPastPlanDate ? 'past-day' : 'permission'}
                            />
                        )}
                        <PlanScheduleStaleBanner planDate={planDate} scheduleFileUpdatedAt={scheduleFileUpdatedAt} />

                        {effectiveViewMode === 'dashboard' && (
                            <PlanDashboardView
                                accentColor={accentColor}
                                assignments={assignments}
                                calcClockIn={calcClockIn}
                                canEdit={canEdit}
                                detailByOrderId={detailByOrderId}
                                earliestClockIn={earliestClockIn}
                                getTravelTime={getTravelTime}
                                mixerCountsByPlant={mixerCountsByPlant}
                                notes={notes}
                                onSwitchToPlanner={isMobile ? null : () => setViewMode('flow')}
                                planDate={planDate}
                                planInsights={planInsights}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plants}
                                setNotes={setNotes}
                                setPlantProduction={setPlantProduction}
                                shiftSpanHours={shiftSpanHours}
                                stats={stats}
                                totalOps={totalOps}
                                validAssignmentCount={validAssignmentCount}
                                yourPlantScope={yourPlantScope}
                            />
                        )}

                        {effectiveViewMode === 'flow' && (
                            <div className="relative flex flex-1 min-h-0 w-full flex-col">
                                <PlanFlowMapView
                                    accentColor={accentColor}
                                    assignments={assignments}
                                    calcClockIn={calcClockIn}
                                    canEdit={canEdit}
                                    getTravelTime={getTravelTime}
                                    mixerCountsByPlant={mixerCountsByPlant}
                                    planDate={planDate}
                                    plantProduction={plantProduction}
                                    plants={plants}
                                    setAssignments={setAssignments}
                                    setPlantProduction={setPlantProduction}
                                    stats={stats}
                                />
                                <PlanPresenceOverlay users={presenceUsers} />
                            </div>
                        )}

                        {effectiveViewMode === 'schedule' && (
                            <PlanScheduleView
                                accentColor={accentColor}
                                adjacentProduction={adjacentProduction}
                                assignments={assignments}
                                detailByOrderId={detailByOrderId}
                                filters={scheduleFilters}
                                getTravelTime={getTravelTime}
                                isMaximized={isScheduleMaximized}
                                isMobile={isMobile}
                                onChangeFilter={updateScheduleFilter}
                                onChangeMaximized={setIsScheduleMaximized}
                                onSwitchToPlanner={isMobile ? null : () => setViewMode('flow')}
                                planDate={planDate}
                                plantAddressByCode={plantAddressByCode}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                /* PlantDropdownModal in the filter bar reads
                                 * `plant.districts` for the district groups —
                                 * pass the enriched list. */
                                plants={plantsWithDistricts}
                                stats={stats}
                            />
                        )}

                        {effectiveViewMode === 'demand' && (
                            <PlanDemandView
                                accentColor={accentColor}
                                planDate={planDate}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plantsWithDistricts}
                                stats={stats}
                                userPlantCode={userPlantCode}
                            />
                        )}

                        {effectiveViewMode === 'statistics' && (
                            <PlanStatisticsView
                                accentColor={accentColor}
                                liveProduction={plantProduction}
                                mixerCountsByPlant={mixerCountsByPlant}
                                planColocationMap={plantColocationMap}
                                planDate={planDate}
                                plantNameByCode={plantNameByCode}
                            />
                        )}

                        {effectiveViewMode === 'call-list' && <CallListView accentColor={accentColor} />}

                        {effectiveViewMode === 'book-order' && (
                            <BookOrderView
                                accentColor={accentColor}
                                mixerCountsByPlant={mixerCountsByPlant}
                                onChangePlanDate={setPlanDate}
                                planDate={planDate}
                                plantProduction={plantProduction}
                                plants={plants}
                            />
                        )}

                        {effectiveViewMode === 'settings' && canSeeSettingsTab && (
                            <PlanSettingsView
                                accentColor={accentColor}
                                addTravelTime={addTravelTime}
                                newTravelTime={newTravelTime}
                                plants={plants}
                                removeTravelTime={removeTravelTime}
                                setNewTravelTime={setNewTravelTime}
                                travelTimes={travelTimes}
                            />
                        )}
                    </div>
                )}
            </div>
            {reviewSendOpen && (
                <PlanReviewSendModal
                    accentColor={accentColor}
                    assignments={assignments}
                    detailByOrderId={detailByOrderId}
                    getTravelTime={getTravelTime}
                    notes={notes}
                    onClose={closeReviewSend}
                    planDate={planDate}
                    plantAddressByCode={plantAddressByCode}
                    plantNameByCode={plantNameByCode}
                    plantProduction={plantProduction}
                    stats={stats}
                />
            )}
        </div>
    )
}

export default OperationsView
