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
import { getTodayDate, PLAN_META_KEY, skipSundayDate } from '../../../utils/PlanUtility'
import PlanDashboardView from './PlanDashboardView'
import PlanDemandView from './PlanDemandView'
import PlanFlowView from './PlanFlowView'
import PlanRealtimeView from './PlanRealtimeView'
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

    /* Mobile users are routed to the Schedule tab regardless of `viewMode`
     * because Planner / Dashboard / etc. depend on wide layouts (zoomable
     * canvas, sticky scrollspy) that don't fit a phone. */
    const [viewMode, setViewModeRaw] = useState('dashboard')
    const effectiveViewMode = isMobile ? 'schedule' : viewMode
    const { planDate, setPlanDate } = usePlanDate(effectiveViewMode)

    // `startTransition` marks the tab swap as low-priority. The current tab
    // stays visible and interactive while React renders the new tab in the
    // background — without this, the Schedule tab's heavy useMemos (table
    // rows, pool timelines, closer-plant lookups) ran synchronously on the
    // click path and froze the page for 5–10s.
    // eslint-disable-next-line no-unused-vars
    const [, startTabTransition] = useTransition()

    const setViewMode = useCallback(
        (mode) => {
            // Date snap stays synchronous (it's cheap) — only the heavy
            // tab render itself is deferred via startTransition.
            if (mode === 'realtime') setPlanDate(skipSundayDate(getTodayDate(), 1))
            startTabTransition(() => {
                setViewModeRaw(mode)
            })
        },
        [setPlanDate]
    )

    const {
        adjacentProduction,
        assignments,
        canEdit,
        getTravelTime,
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
        showSettings,
        updateAssignment
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

    const { canSeeYourTab, hasDefaultPlantPermission, userPlantCode, userRoleNames } = usePlanUserContext(userId)

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
            className="global-dashboard-container dashboard-container global-flush-top flush-top plan-view"
            style={{ display: 'flex', flexDirection: 'column', inset: 0, overflow: 'hidden', position: 'absolute' }}
        >
            <PlanHeader
                accentColor={accentColor}
                canEdit={canEdit}
                copied={copied}
                isDark={isDark}
                isMobile={isMobile}
                isRealtime={effectiveViewMode === 'realtime'}
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
            <div
                className="w-full max-w-full overflow-x-hidden"
                style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
            >
                {/* Show the skeleton through the WHOLE bootstrap, not just
                    the plants-list fetch. `isLoading` flips false as soon as
                    plants land, but plantProduction (the schedule HTML
                    parse) lands a beat later — and when it does, the heavy
                    useMemos in the tab views fire at once and freeze the
                    page. Holding the skeleton until either we have parsed
                    schedule data OR the initial sync has finished gives the
                    browser something to paint while that work happens. */}
                {(() => {
                    const productionKeys = Object.keys(plantProduction || {}).filter((k) => k !== PLAN_META_KEY)
                    const hasScheduleData = productionKeys.length > 0
                    return isLoading || (isSchedulesSyncing && !hasScheduleData)
                })() ? (
                    <PlanTabSkeleton mode={effectiveViewMode} />
                ) : (
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
                                earliestClockIn={earliestClockIn}
                                getTravelTime={getTravelTime}
                                mixerCountsByPlant={mixerCountsByPlant}
                                notes={notes}
                                onSwitchToPlanner={() => setViewMode('flow')}
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
                            <PlanFlowView
                                accentColor={accentColor}
                                assignments={assignments}
                                calcClockIn={calcClockIn}
                                canEdit={canEdit}
                                getTravelTime={getTravelTime}
                                mixerCountsByPlant={mixerCountsByPlant}
                                onSwitchToPlanner={() => setViewMode('dashboard')}
                                planDate={planDate}
                                plantProduction={plantProduction}
                                plants={plants}
                                setAssignments={setAssignments}
                                setPlantProduction={setPlantProduction}
                                stats={stats}
                                updateAssignment={updateAssignment}
                            />
                        )}

                        {effectiveViewMode === 'schedule' && (
                            <PlanScheduleView
                                accentColor={accentColor}
                                adjacentProduction={adjacentProduction}
                                assignments={assignments}
                                getTravelTime={getTravelTime}
                                isMobile={isMobile}
                                onSwitchToPlanner={isMobile ? null : () => setViewMode('flow')}
                                planDate={planDate}
                                plantAddressByCode={plantAddressByCode}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plants}
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

                        {effectiveViewMode === 'realtime' && (
                            <PlanRealtimeView
                                accentColor={accentColor}
                                assignments={assignments}
                                defaultPlantCode={hasDefaultPlantPermission ? userPlantCode : ''}
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
                    </div>
                )}
            </div>
        </div>
    )
}

export default PlanView
