import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import DashboardHeader from '../../../app/components/dashboard/DashboardHeader'
import DashboardPeopleSection from '../../../app/components/dashboard/DashboardPeopleSection'
import DashboardSidebar from '../../../app/components/dashboard/DashboardSidebar'
import DashboardSkeleton from '../../../app/components/dashboard/DashboardSkeleton'
import EmbeddedViewModal from '../../../app/components/dashboard/EmbeddedViewModal'
import FleetOverviewSection from '../../../app/components/dashboard/FleetOverviewSection'
import KeyMetricsStrip from '../../../app/components/dashboard/KeyMetricsStrip'
import { INITIAL_EXPANDED_SECTIONS } from '../../../app/constants/dashboardConstants'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useDashboardAssets, useIssueCommentCounts, usePlantFilter } from '../../../app/hooks/useDashboardData'
import { useAnimatedStats, useDateFilter } from '../../../app/hooks/useDashboardEffects'
import { useDashboardInit } from '../../../app/hooks/useDashboardInit'
import { useDashboardManagers } from '../../../app/hooks/useDashboardManagers'
import { useDashboardStats } from '../../../app/hooks/useDashboardStats'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { useLeaderboardMetrics, usePlantNotifications } from '../../../app/hooks/usePlantNotifications'
import { useStatusHistory } from '../../../app/hooks/useStatusHistory'
import { PlantService } from '../../../services/PlantService'
/**
 * Primary dashboard view with a sidebar + main content layout.
 * The sidebar houses alerts, people pipeline, AI insights, and plant rankings.
 * The main content displays key metrics, fleet overview, analytics, people, and maintenance.
 */
export default function DashboardView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isMobile = useIsMobile()
    const [expandedSections, setExpandedSections] = useState(INITIAL_EXPANDED_SECTIONS)
    const [embeddedView, setEmbeddedView] = useState(null)
    const [embeddedViewSearch, setEmbeddedViewSearch] = useState('')
    const [, startTransition] = useTransition()
    const filterTimeoutRef = useRef(null)
    const { plantSetRef } = usePlantFilter('', '', [], [])
    const {
        allPlants,
        allPlantsCount,
        dashboardPlant,
        dashboardRegionCode,
        dashboardRegionName,
        hasAllRegionsPermission,
        isPlantManager,
        onRefresh,
        permittedRegions,
        plantModalOpen,
        refreshKey,
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
        userRoleName,
        userRoleWeight
    } = useDashboardInit({ plantSetRef, preferences })
    const myPlantCodesSet = useMemo(() => {
        if (!userPlantCode && !userAdditionalPlants.length) return null
        const codes = new Set()
        if (userPlantCode) codes.add(userPlantCode)
        userAdditionalPlants.forEach((code) => codes.add(code))
        return codes
    }, [userPlantCode, userAdditionalPlants])
    const isMultiPlantFilter = dashboardPlant === 'MY_PLANTS' || dashboardPlant?.startsWith('DISTRICT:')
    const isPlantMode = !!dashboardPlant && !isMultiPlantFilter
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
        lightDutyOperators,
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
    const {
        handleQuickDateFilter,
        historyEndDate,
        historyStartDate,
        setHistoryEndDate,
        setHistoryStartDate,
        setOldestHistoryDate
    } = useDateFilter()
    const { historyLoaded, historyRecordsRef, statusHistoryData } = useStatusHistory({
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
    const { filterByPlantSet, plantNotifications, setPlantNotifications } = usePlantNotifications({
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

    // Scope operator status lists to the active plant set
    const filteredTrainingOperators = filterByPlantSet(
        trainingOperators,
        activePlantSetRef.current,
        'operatorPlant',
        'trainerPlant'
    )
    const filteredPendingStartOperators = filterByPlantSet(
        pendingStartOperators,
        activePlantSetRef.current,
        'operatorPlant',
        'trainerPlant'
    )
    const filteredLightDutyOperators = filterByPlantSet(lightDutyOperators, activePlantSetRef.current, 'plant')
    // Snapshot the plant scope so the manager hook re-derives when filters change.
    const managerPlantSet = useMemo(() => {
        const set = activePlantSetRef.current
        if (!set || set.size === 0) return null
        return new Set(set)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dashboardPlant, dashboardRegionCode, stats.fleetTotal])
    const managerStats = useDashboardManagers({ plantSet: managerPlantSet })
    // Resolve display labels
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

    // Reveal animation state
    const wasLoadingRef = useRef(true)
    const hasRevealedRef = useRef(false)
    const [revealContent, setRevealContent] = useState(false)
    useEffect(() => {
        if (wasLoadingRef.current && !showSkeleton && !hasRevealedRef.current) {
            hasRevealedRef.current = true
            setRevealContent(true)
            const timer = setTimeout(() => setRevealContent(false), 1500)
            return () => clearTimeout(timer)
        }
        wasLoadingRef.current = showSkeleton
    }, [showSkeleton])
    const REVEAL_DIRECTION_MAP = { left: 'animate-reveal-left', right: 'animate-reveal-right', up: 'animate-reveal-up' }
    const revealClass = (direction) => (revealContent ? REVEAL_DIRECTION_MAP[direction] || '' : '')
    const revealStyle = (delay) => (revealContent ? { animationDelay: `${delay}ms` } : undefined)

    return (
        <div className="dashboard-full-width min-h-screen bg-bg-secondary text-text-primary">
            <div className="flex min-h-screen">
                {/* Sidebar — left rail */}
                {!isMobile && (
                    <DashboardSidebar
                        accentColor={accentColor}
                        dashboardPlant={dashboardPlant}
                        dashboardRegionCode={dashboardRegionCode}
                        dataReady={dataReady}
                        expandedSections={expandedSections}
                        isPlantManager={isPlantManager}
                        isPlantMode={isPlantMode}
                        onRefresh={onRefresh}
                        plantNotifications={plantNotifications}
                        refreshing={refreshing}
                        regionDisplayName={regionDisplayName}
                        regionPlants={regionPlants}
                        selectedRegion={selectedRegion}
                        setEmbeddedView={setEmbeddedView}
                        setEmbeddedViewSearch={setEmbeddedViewSearch}
                        setExpandedSections={setExpandedSections}
                        setPlantModalOpen={setPlantModalOpen}
                        userPlantCode={userPlantCode}
                        userRoleName={userRoleName}
                    />
                )}
                {/* Main content */}
                <main className="flex-1 min-w-0 flex flex-col">
                    <DashboardHeader
                        accentColor={accentColor}
                        isMobile={isMobile}
                        regionDisplayName={regionDisplayName}
                        heroRegionSub={heroRegionSub}
                        isLoading={showSkeleton}
                        onPlantFilterClick={() => setPlantModalOpen(true)}
                    />
                    <div className={`w-full flex-1 ${isMobile ? 'p-3' : 'px-4 lg:px-6 py-5'}`}>
                        {error && (
                            <div
                                className="flex items-center justify-between rounded text-red-600 mb-4 px-4 py-3"
                                style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.3)' }}
                            >
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
                            <div className={`flex flex-col ${isMobile ? 'gap-4' : 'gap-5'}`}>
                                <div className={revealClass('up')} style={revealStyle(0)}>
                                    <KeyMetricsStrip
                                        displayStats={displayStats}
                                        plantNotifications={plantNotifications}
                                        isPlantMode={isPlantMode}
                                        accentColor={accentColor}
                                        isMobile={isMobile}
                                    />
                                </div>

                                <div className={revealClass('left')} style={revealStyle(80)}>
                                    <FleetOverviewSection
                                        displayStats={displayStats}
                                        stats={stats}
                                        isAggregate={isAggregate}
                                        selectedRegion={selectedRegion}
                                        accentColor={accentColor}
                                        isMobile={isMobile}
                                    />
                                </div>

                                <div className={revealClass('up')} style={revealStyle(160)}>
                                    <DashboardPeopleSection
                                        displayStats={displayStats}
                                        isAggregate={isAggregate}
                                        managerStats={managerStats}
                                        accentColor={accentColor}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <PlantDropdownModal
                isOpen={plantModalOpen}
                onClose={() => setPlantModalOpen(false)}
                plants={regionPlants}
                onSelect={(plantCode) => setDashboardPlant(plantCode === 'All' ? '' : plantCode)}
                showAllPlants={true}
                showMyPlants={false}
                userPlantCode={userPlantCode}
            />
            {embeddedView && (
                <EmbeddedViewModal
                    embeddedView={embeddedView}
                    embeddedViewSearch={embeddedViewSearch}
                    accentColor={accentColor}
                    onClose={() => {
                        setEmbeddedView(null)
                        setEmbeddedViewSearch('')
                    }}
                />
            )}
        </div>
    )
}
