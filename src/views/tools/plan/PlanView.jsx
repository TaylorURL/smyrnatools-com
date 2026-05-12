import React, { useCallback, useState, useTransition } from 'react'

import { PlanTabSkeleton } from '../../../app/components/common/PlanSkeletons'
import { PlanHeader } from '../../../app/components/plan/PlanHeader'
import { PlanReadOnlyBanner } from '../../../app/components/plan/PlanReadOnlyBanner'
import { PlanScheduleStaleBanner } from '../../../app/components/plan/PlanScheduleStaleBanner'
import PlanSettingsModal from '../../../app/components/plan/PlanSettingsModal'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { usePlanActions } from '../../../app/hooks/usePlanActions'
import { usePlanData } from '../../../app/hooks/usePlanData'
import { usePlanDate } from '../../../app/hooks/usePlanDate'
import { usePlanInsights } from '../../../app/hooks/usePlanInsights'
import { usePlanLookups } from '../../../app/hooks/usePlanLookups'
import { usePlanUserContext } from '../../../app/hooks/usePlanUserContext'
import { buildPlanDispatchText } from '../../../utils/PlanCopyUtility'
import { PLAN_META_KEY } from '../../../utils/PlanUtility'
import BookOrderView from './BookOrderView'
import CallListView from './CallListView'
import PlanDashboardView from './PlanDashboardView'
import PlanDemandView from './PlanDemandView'
import PlanFlowMapView from './PlanFlowMapView'
import PlanScheduleView from './PlanScheduleView'
import PlanStatisticsView from './PlanStatisticsView'

/**
 * PlanView — plant-centric dispatch planner.
 *
 * Dispatchers create daily assignment plans: which plant sends operators
 * to which plant, with arrival times, stagger intervals, and custom
 * per-operator overrides. Generates a copyable text summary for dispatch
 * and auto-saves to the database with realtime sync across users.
 *
 * This file is the shell — header, banners, settings modal, and the tab
 * router. Each tab's heavy logic lives in its own dedicated view file.
 */
function PlanView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isDark = preferences.themeMode === 'dark'
    const isMobile = useIsMobile()

    /* Mobile users get a focused two-tab Plan surface — Dashboard
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
        detailByOrderId,
        getTravelTime,
        isDetailOrdersLoading,
        isLoading,
        isSchedulesSyncing,
        mixerCountsByPlant,
        notes,
        plantProduction,
        plants,
        refreshSchedule,
        refreshTravelTimes,
        regionPlants,
        scheduleFileUpdatedAt,
        scheduleLastSyncedAt,
        setAssignments,
        setNotes,
        setPlantProduction,
        travelTimes,
        userId
    } = usePlanData(planDate)

    const {
        addTravelTime,
        calcClockIn,
        copied,
        copyToClipboard,
        newTravelTime,
        removeTravelTime,
        setNewTravelTime,
        setShowSettings,
        showSettings
    } = usePlanActions({
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
        plants,
        travelTimes
    })

    const { canSeeYourTab, userPlantCode, userRoleNames } = usePlanUserContext(userId)

    const { plantAddressByCode, plantNameByCode, plantsWithDistricts, yourPlantScope } = usePlanLookups({
        canSeeYourTab,
        plants,
        regionPlants,
        userPlantCode,
        userRoleNames
    })

    const handleCopyPlan = useCallback(
        () => copyToClipboard(buildPlanDispatchText({ assignments, planDate, plantProduction })),
        [assignments, copyToClipboard, planDate, plantProduction]
    )

    const handleToggleSettings = useCallback(() => setShowSettings((prev) => !prev), [setShowSettings])

    return (
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top plan-view flex flex-col overflow-hidden absolute"
            style={{ inset: 0 }}
        >
            <PlanHeader
                accentColor={accentColor}
                canEdit={canEdit}
                copied={copied}
                isDark={isDark}
                isMobile={isMobile}
                isRealtime={false}
                isSchedulesSyncing={isSchedulesSyncing}
                onChangeDate={setPlanDate}
                onChangeViewMode={setViewMode}
                onCopyPlan={handleCopyPlan}
                onRefresh={refreshSchedule}
                onToggleSettings={handleToggleSettings}
                planDate={planDate}
                scheduleLastSyncedAt={scheduleLastSyncedAt}
                showSettings={showSettings}
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
                        {!canEdit && <PlanReadOnlyBanner accentColor={accentColor} />}
                        <PlanScheduleStaleBanner planDate={planDate} scheduleFileUpdatedAt={scheduleFileUpdatedAt} />

                        {showSettings && (
                            <PlanSettingsModal
                                accentColor={accentColor}
                                addTravelTime={addTravelTime}
                                newTravelTime={newTravelTime}
                                onClose={() => setShowSettings(false)}
                                plants={plants}
                                removeTravelTime={removeTravelTime}
                                setNewTravelTime={setNewTravelTime}
                                travelTimes={travelTimes}
                            />
                        )}

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
                    </div>
                )}
            </div>
        </div>
    )
}

export default PlanView
