import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import DashboardAlertsPanel from '../../../app/components/dashboard/DashboardAlertsPanel'
import { DashboardAtAGlance } from '../../../app/components/dashboard/DashboardAtAGlance'
import DashboardHeader from '../../../app/components/dashboard/DashboardHeader'
import DashboardPeopleSection from '../../../app/components/dashboard/DashboardPeopleSection'
import DashboardScheduleSection from '../../../app/components/dashboard/DashboardScheduleSection'
import { DASHBOARD_NAV_SECTIONS, DashboardScrollSpyNav } from '../../../app/components/dashboard/DashboardScrollSpyNav'
import DashboardSkeleton from '../../../app/components/dashboard/DashboardSkeleton'
import EmbeddedViewModal from '../../../app/components/dashboard/EmbeddedViewModal'
import FleetOverviewSection from '../../../app/components/dashboard/FleetOverviewSection'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useDashboardAssets, useIssueCommentCounts, usePlantFilter } from '../../../app/hooks/useDashboardData'
import { useAnimatedStats, useDateFilter } from '../../../app/hooks/useDashboardEffects'
import { useDashboardInit } from '../../../app/hooks/useDashboardInit'
import { useDashboardManagers } from '../../../app/hooks/useDashboardManagers'
import { useDashboardSchedule } from '../../../app/hooks/useDashboardSchedule'
import { useDashboardStats } from '../../../app/hooks/useDashboardStats'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { usePlanScrollSpy } from '../../../app/hooks/usePlanScrollSpy'
import { useLeaderboardMetrics, usePlantNotifications } from '../../../app/hooks/usePlantNotifications'
import { useStatusHistory } from '../../../app/hooks/useStatusHistory'
import { PlantService } from '../../../services/PlantService'

/**
 * Primary dashboard view — Plan-tab-style 3-column layout.
 * Left: sticky scrollspy side nav with section anchors.
 * Center: KPI strip, fleet table, people table, alerts list.
 * Right: at-a-glance rail with vertical label/value snapshot.
 */
export default function DashboardView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isMobile = useIsMobile()
    const [embeddedView, setEmbeddedView] = useState(null)
    const [embeddedViewSearch, setEmbeddedViewSearch] = useState('')
    const [, startTransition] = useTransition()
    const filterTimeoutRef = useRef(null)
    const scrollContainerRef = useRef(null)
    const { plantSetRef } = usePlantFilter('', '', [], [])
    const {
        allPlants,
        allPlantsCount,
        dashboardPlant,
        dashboardRegionCode,
        dashboardRegionName,
        hasAllRegionsPermission,
        onRefresh,
        permittedRegions,
        plantModalOpen,
        refreshing,
        regionPlants,
        regionPlantsLoaded,
        setDashboardPlant,
        setPlantModalOpen,
        setRefreshKey,
        totalAggregateLocations,
        totalPlantsExcludingAggregate,
        totalRegionsExcludingOffice,
        userAdditionalPlants,
        userPlantCode,
        refreshKey
    } = useDashboardInit({ plantSetRef, preferences })
    const myPlantCodesSet = useMemo(() => {
        if (!userPlantCode && !userAdditionalPlants.length) return null
        const codes = new Set()
        if (userPlantCode) codes.add(userPlantCode)
        userAdditionalPlants.forEach((code) => codes.add(code))
        return codes
    }, [userPlantCode, userAdditionalPlants])
    const plantFilter = usePlantFilter(dashboardRegionCode, dashboardPlant, regionPlants, allPlants, myPlantCodesSet)
    const {
        createFilterFn: activeCreateFilterFn,
        plantSetRef: activePlantSetRef,
        updatePlantSet: activeUpdatePlantSet
    } = plantFilter
    const {
        allEquipmentRef,
        allMixersRef,
        allOperatorsRef,
        allPickupsRef,
        allTractorsRef,
        allTrailersRef,
        computeStats,
        countsRef,
        stats
    } = useDashboardStats({
        createFilterFn: activeCreateFilterFn,
        dashboardRegionCode,
        updatePlantSet: activeUpdatePlantSet
    })
    const {
        allOperatorsFullRef,
        dataReady,
        error,
        lightDutyOperators: _lightDutyOperators,
        loading,
        pendingStartOperators,
        trainingOperators
    } = useDashboardAssets({
        allEquipmentRef,
        allMixersRef,
        allOperatorsRef,
        allPickupsRef,
        allTractorsRef,
        allTrailersRef,
        computeStats,
        refreshKey
    })
    const { assetIssueDetails, fetchIssueCommentCounts } = useIssueCommentCounts({
        allEquipmentRef,
        allMixersRef,
        allTractorsRef,
        allTrailersRef,
        computeStats,
        countsRef
    })
    const { historyEndDate, historyStartDate, setHistoryEndDate, setHistoryStartDate, setOldestHistoryDate } =
        useDateFilter()
    const { historyLoaded, historyRecordsRef } = useStatusHistory({
        allEquipmentRef,
        allMixersRef,
        allPickupsRef,
        allTractorsRef,
        allTrailersRef,
        createFilterFn: activeCreateFilterFn,
        dashboardRegionCode,
        dataReady,
        historyEndDate,
        historyStartDate,
        loading,
        refreshKey,
        setHistoryEndDate,
        setHistoryStartDate,
        setOldestHistoryDate,
        updatePlantSet: activeUpdatePlantSet
    })
    const { plantNotifications, setPlantNotifications } = usePlantNotifications({
        allEquipmentRef,
        allMixersRef,
        allOperatorsFullRef,
        allTractorsRef,
        allTrailersRef,
        assetIssueDetails,
        createFilterFn: activeCreateFilterFn,
        dataReady,
        historyLoaded,
        historyRecordsRef,
        pendingStartOperators,
        plantSetRef: activePlantSetRef,
        trainingOperators
    })
    useLeaderboardMetrics({
        allEquipmentRef,
        allMixersRef,
        allOperatorsFullRef,
        allTractorsRef,
        allTrailersRef,
        dashboardPlant,
        dashboardRegionCode,
        dataReady,
        setPlantNotifications
    })
    const displayStats = useAnimatedStats(stats, regionPlantsLoaded, dashboardRegionCode)

    // Debounce stat recomputation (30ms) to batch rapid plant/region filter changes.
    const applyFilters = useCallback(() => {
        if (loading) {
            computeStats()
            return
        }
        if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current)
        filterTimeoutRef.current = setTimeout(() => startTransition(() => computeStats()), 30)
    }, [computeStats, loading])
    useEffect(
        () => () => {
            if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current)
        },
        []
    )
    useEffect(() => {
        applyFilters()
    }, [dashboardPlant, regionPlants, applyFilters])
    useEffect(() => {
        if (!loading) fetchIssueCommentCounts()
    }, [stats.fleetTotal, loading, fetchIssueCommentCounts])
    const selectedRegion = PlantService.getRegionByCode(dashboardRegionCode)
    const isAggregate = selectedRegion?.type === 'Aggregate'
    const showSkeleton = !dataReady

    const activePlantSet = useMemo(() => {
        const set = activePlantSetRef.current
        if (!set || set.size === 0) return null
        return new Set(set)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dashboardPlant, dashboardRegionCode, stats.fleetTotal])
    const managerStats = useDashboardManagers({ plantSet: activePlantSet })
    const scheduleData = useDashboardSchedule({ plantSet: activePlantSet, refreshKey })

    const regionDisplayName = (() => {
        if (selectedRegion?.type === 'Office') return 'Home Office'
        return dashboardRegionCode
            ? dashboardRegionName || dashboardRegionCode
            : hasAllRegionsPermission
              ? 'All Regions'
              : permittedRegions[0]?.regionName || 'Region'
    })()
    const heroRegionSub = (() => {
        const isOffice = selectedRegion?.type === 'Office'
        if (isOffice) {
            return `${totalRegionsExcludingOffice} Region${totalRegionsExcludingOffice !== 1 ? 's' : ''}, ${totalPlantsExcludingAggregate} Concrete Plant${totalPlantsExcludingAggregate !== 1 ? 's' : ''}, ${totalAggregateLocations} Aggregate Location${totalAggregateLocations !== 1 ? 's' : ''}`
        }
        const plantLabel = isAggregate ? 'Aggregate Location' : 'Concrete Plant'
        if (dashboardPlant === 'MY_PLANTS') return 'My Plants'
        if (dashboardPlant?.startsWith('DISTRICT:')) return dashboardPlant.slice(9)
        return dashboardPlant
            ? `${plantLabel} ${dashboardPlant}`
            : dashboardRegionCode
              ? `${regionPlants.length} ${plantLabel}${regionPlants.length !== 1 ? 's' : ''}`
              : `${allPlantsCount} ${plantLabel}${allPlantsCount !== 1 ? 's' : ''}`
    })()

    const alertCount =
        (plantNotifications.longTermShopAssets?.length || 0) +
        (plantNotifications.shopIssue ? 1 : 0) +
        (plantNotifications.unassignedOperators?.length > 0 ? 1 : 0) +
        (plantNotifications.pendingOperators?.length > 0 ? 1 : 0) +
        (plantNotifications.trainingOperators?.length > 0 ? 1 : 0)
    const peopleCount = (managerStats?.total || 0) + (stats.operators?.total || 0)
    const openIssues =
        (stats.mixers?.issues || 0) +
        (stats.tractors?.issues || 0) +
        (stats.trailers?.issues || 0) +
        (stats.equipment?.issues || 0)

    const [activeSection, jumpTo] = usePlanScrollSpy({
        deps: [showSkeleton, alertCount, peopleCount, scheduleData.loading],
        scrollContainerRef,
        sections: DASHBOARD_NAV_SECTIONS
    })

    return (
        <div
            className="dashboard-full-width global-flush-top flush-top text-text-primary bg-bg-secondary flex flex-col overflow-hidden absolute"
            style={{ inset: 0 }}
        >
            <DashboardHeader
                accentColor={accentColor}
                heroRegionSub={heroRegionSub}
                isLoading={showSkeleton}
                isMobile={isMobile}
                onPlantFilterClick={() => setPlantModalOpen(true)}
                onRefresh={onRefresh}
                refreshing={refreshing}
                regionDisplayName={regionDisplayName}
            />
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
                <div className="w-full px-3 sm:px-4 lg:px-6 flex gap-4">
                    {!isMobile && (
                        <DashboardScrollSpyNav
                            accent={accentColor}
                            activeId={activeSection}
                            alertCount={alertCount}
                            onJump={jumpTo}
                            peopleCount={peopleCount}
                            sections={DASHBOARD_NAV_SECTIONS}
                        />
                    )}

                    <main className="flex-1 min-w-0 py-3 sm:py-5 flex flex-col gap-3 sm:gap-5">
                        {error && (
                            <div className="flex items-center justify-between rounded text-red-600 px-4 py-3 bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.3)]">
                                <span className="text-[13px] font-semibold">{error}</span>
                                <button
                                    onClick={() => setRefreshKey((v) => v + 1)}
                                    className="bg-transparent border-none text-red-600 cursor-pointer font-semibold text-[12px]"
                                >
                                    Retry
                                </button>
                            </div>
                        )}
                        {showSkeleton ? (
                            <DashboardSkeleton isMobile={isMobile} />
                        ) : (
                            <>
                                <DashboardAlertsPanel
                                    plantNotifications={plantNotifications}
                                    setEmbeddedView={setEmbeddedView}
                                    setEmbeddedViewSearch={setEmbeddedViewSearch}
                                />
                                <DashboardScheduleSection schedule={scheduleData} />
                                <FleetOverviewSection
                                    accentColor={accentColor}
                                    displayStats={displayStats}
                                    isAggregate={isAggregate}
                                    selectedRegion={selectedRegion}
                                    stats={stats}
                                />
                                <DashboardPeopleSection
                                    accentColor={accentColor}
                                    displayStats={displayStats}
                                    isAggregate={isAggregate}
                                    managerStats={managerStats}
                                />
                                <div className="h-8" />
                            </>
                        )}
                    </main>

                    <DashboardAtAGlance
                        alertCount={alertCount}
                        displayStats={displayStats}
                        loading={showSkeleton}
                        openIssues={openIssues}
                    />
                </div>
            </div>

            <PlantDropdownModal
                isOpen={plantModalOpen}
                onClose={() => setPlantModalOpen(false)}
                onSelect={(plantCode) => setDashboardPlant(plantCode === 'All' ? '' : plantCode)}
                plants={regionPlants}
                showAllPlants={true}
                showMyPlants={false}
                userPlantCode={userPlantCode}
            />
            {embeddedView && (
                <EmbeddedViewModal
                    accentColor={accentColor}
                    embeddedView={embeddedView}
                    embeddedViewSearch={embeddedViewSearch}
                    onClose={() => {
                        setEmbeddedView(null)
                        setEmbeddedViewSearch('')
                    }}
                />
            )}
        </div>
    )
}
