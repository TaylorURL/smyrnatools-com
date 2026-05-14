import React, { useState } from 'react'

import PlanScheduleClosedBanner from '../../../app/components/plan/tabs/schedule/PlanScheduleClosedBanner'
import PlanScheduleEmptyState from '../../../app/components/plan/tabs/schedule/PlanScheduleEmptyState'
import PlanScheduleFilterDrawer from '../../../app/components/plan/tabs/schedule/PlanScheduleFilterDrawer'
import PlanScheduleGroupedCards from '../../../app/components/plan/tabs/schedule/PlanScheduleGroupedCards'
import PlanScheduleStatStrip from '../../../app/components/plan/tabs/schedule/PlanScheduleStatStrip'
import PlanScheduleTable from '../../../app/components/plan/tabs/schedule/PlanScheduleTable'
import PlanScheduleTitleRow from '../../../app/components/plan/tabs/schedule/PlanScheduleTitleRow'
import JobMapModal from '../../../app/components/schedule/JobMapModal'
import { DEFAULT_SCHEDULE_FILTERS } from '../../../app/constants/planScheduleViewConstants'
import { usePlanScheduleAdjacentTotals } from '../../../app/hooks/usePlanScheduleAdjacentTotals'
import { usePlanScheduleData } from '../../../app/hooks/usePlanScheduleData'
import { usePlanScheduleFilterSetters } from '../../../app/hooks/usePlanScheduleFilterSetters'
import { usePlanScheduleMaximize } from '../../../app/hooks/usePlanScheduleMaximize'
import { usePlanScheduleRoster } from '../../../app/hooks/usePlanScheduleRoster'

/**
 * Schedule view — flat, filterable, sortable table (or grouped cards) of every
 * order pulled from the Daily Order Listing HTML import. Dispatchers can
 * narrow by plant, customer, product, time bucket, truck class, minimum
 * yardage, and a free-text search across customer/address/PO.
 *
 * Stays a thin orchestrator: every derived value lives in `usePlanScheduleData`
 * (and the smaller setter / maximize / roster / adjacent-totals hooks), every
 * chunk of UI lives in a focused sub-component. The only state owned locally
 * is the open JobMapModal target — by design, since closing this view should
 * drop the open map (the order no longer exists in the new day).
 */
function PlanScheduleView({
    accentColor,
    adjacentProduction = {},
    assignments = [],
    detailByOrderId = {},
    filters = DEFAULT_SCHEDULE_FILTERS,
    getTravelTime,
    isMaximized = false,
    isMobile = false,
    onChangeFilter,
    onChangeMaximized,
    onSwitchToPlanner,
    planDate,
    plantAddressByCode,
    plantNameByCode,
    plantProduction: rawPlantProduction,
    /** Plants with district memberships — fed to PlantDropdownModal so the
     *  multi-select plant filter can offer district-level toggling. */
    plants = [],
    stats = []
}) {
    const {
        filtersOpen,
        minYards,
        productFilter,
        query,
        showCancelled,
        showExtraRows,
        showTest,
        sortKey,
        statusFilter,
        viewMode
    } = filters

    const {
        setFiltersOpen,
        setMinYards,
        setPlantFilters,
        setProductFilter,
        setQuery,
        setShowCancelled,
        setShowExtraRows,
        setShowTest,
        setSortKey,
        setStatusFilter,
        setViewMode
    } = usePlanScheduleFilterSetters(onChangeFilter)

    const { effectiveMaximized, setMaximized } = usePlanScheduleMaximize({
        isMaximized,
        isMobile,
        onChangeMaximized
    })

    const data = usePlanScheduleData({
        assignments,
        detailByOrderId,
        filters,
        getTravelTime,
        planDate,
        plantAddressByCode,
        plantNameByCode,
        rawPlantProduction,
        stats
    })

    const {
        activeFilterCount,
        allOrders,
        clockInRows,
        firstLoadOutByPlant,
        customerSatisfaction,
        earliestTime,
        filtered,
        getCloserPlantForOrder,
        getTravelOverrides,
        groupedByPlant,
        hasActiveFilters,
        hasAnyOrders,
        helpRows,
        isPastDay,
        isSaturday,
        isViewingToday,
        keyForOrder,
        latestTime,
        liveOrders,
        nowMin,
        plantCityByCode,
        plantFilterSet,
        plantFilters,
        plantOptions,
        plantOptionsForMap,
        plantsClosed,
        poolSourceByCode,
        poolTimeline,
        poolTimelinesByPlant,
        productOptions,
        pullUpRows,
        sendHomeRows,
        singlePlant,
        statusCounts,
        suggestedSlotRows,
        sumDayYardage,
        totalTrucks,
        totalYards,
        uniqueCustomers,
        uniquePlants
    } = data

    const { previousBusinessDayLabel, previousBusinessDayYardage, weekYardage, yardageDeltaPct } =
        usePlanScheduleAdjacentTotals({
            adjacentProduction,
            minYards,
            planDate,
            plantFilterSet,
            productFilter,
            sumDayYardage,
            totalYards
        })

    const { copyOperatorRoster, operatorRosterCopied, operatorRosterText } = usePlanScheduleRoster({
        clockInRows,
        poolSourceByCode,
        singlePlant
    })

    /** Toggle a plant in the multi-select array — used both by the
     *  PlantDropdownModal (per-event) and by code that wants to flip a
     *  single chip on/off. */
    const togglePlantFilter = (code) => {
        setPlantFilters((prev) => {
            const arr = Array.isArray(prev) ? prev : []
            return arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code]
        })
    }

    // mapOrder is the only schedule-local state that genuinely shouldn't
    // persist across date changes — closing this view should drop the open
    // map modal (the order it points at no longer exists in the new day).
    const [mapOrder, setMapOrder] = useState(null)

    const clearAllFilters = () => {
        setQuery('')
        setPlantFilters([])
        setStatusFilter('all')
        setProductFilter('all')
        setMinYards('')
        setShowCancelled(false)
        setShowTest(false)
    }

    /** Single-plant affordances (copy roster, extras toggle, plant scope
     *  chip) only light up when exactly one plant is selected. */
    const operatorRosterReady = !!singlePlant && !!operatorRosterText
    const activePlantName = singlePlant ? plantNameByCode?.[singlePlant] || '' : ''

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="flex w-full">
                <div className="flex-1 min-w-0 px-3 sm:px-4 lg:pl-2 lg:pr-6 py-4 sm:py-5 flex flex-col gap-3 sm:gap-4">
                    {!effectiveMaximized && (
                        <PlanScheduleClosedBanner isSaturday={isSaturday} plantsClosed={plantsClosed} />
                    )}
                    {!effectiveMaximized && (
                        <PlanScheduleTitleRow
                            accentColor={accentColor}
                            activeFilterCount={activeFilterCount}
                            allOrdersCount={allOrders.length}
                            filteredCount={filtered.length}
                            filtersOpen={filtersOpen}
                            hasAnyOrders={hasAnyOrders}
                            isMobile={isMobile}
                            onSwitchToPlanner={onSwitchToPlanner}
                            onToggleFilters={() => setFiltersOpen((v) => !v)}
                            onToggleMaximized={() => setMaximized(true)}
                            setViewMode={setViewMode}
                            viewMode={viewMode}
                        />
                    )}

                    {!hasAnyOrders ? (
                        <PlanScheduleEmptyState />
                    ) : (
                        <>
                            {!effectiveMaximized && (
                                <PlanScheduleStatStrip
                                    allOrdersCount={allOrders.length}
                                    customerSatisfaction={customerSatisfaction}
                                    earliestTime={earliestTime}
                                    filteredCount={filtered.length}
                                    hasActiveFilters={hasActiveFilters}
                                    latestTime={latestTime}
                                    liveOrdersCount={liveOrders.length}
                                    previousBusinessDayLabel={previousBusinessDayLabel}
                                    previousBusinessDayYardage={previousBusinessDayYardage}
                                    totalTrucks={totalTrucks}
                                    totalYards={totalYards}
                                    uniqueCustomers={uniqueCustomers}
                                    uniquePlants={uniquePlants}
                                    weekYardage={weekYardage}
                                    yardageDeltaPct={yardageDeltaPct}
                                />
                            )}

                            {/* The same single-row filter drawer is the
                                control surface in BOTH normal and maximized
                                mode. In maximized mode it carries an inline
                                "Exit" button so the dispatcher can drop back
                                without rebuilding a separate compact toolbar.
                                On mobile the dispatcher can collapse it via
                                the Filters button above; desktop always
                                shows it. */}
                            {(!isMobile || filtersOpen) && (
                                <PlanScheduleFilterDrawer
                                    accent={accentColor}
                                    activePlantName={activePlantName}
                                    minYards={minYards}
                                    onChangeMinYards={setMinYards}
                                    onChangeProduct={setProductFilter}
                                    onChangeQuery={setQuery}
                                    onChangeShowCancelled={setShowCancelled}
                                    onChangeShowTest={setShowTest}
                                    onChangeSort={setSortKey}
                                    onChangeStatus={setStatusFilter}
                                    onClearFilters={hasActiveFilters ? clearAllFilters : null}
                                    onCopyRoster={copyOperatorRoster}
                                    onExitMaximized={effectiveMaximized ? () => setMaximized(false) : null}
                                    onToggleExtraRows={() => setShowExtraRows((v) => !v)}
                                    onTogglePlantFilter={togglePlantFilter}
                                    operatorRosterCopied={operatorRosterCopied}
                                    operatorRosterReady={operatorRosterReady}
                                    plantFilters={plantFilters}
                                    plantNameByCode={plantNameByCode}
                                    plantOptions={plantOptions}
                                    plants={plants}
                                    productFilter={productFilter}
                                    productOptions={productOptions}
                                    query={query}
                                    showCancelled={showCancelled}
                                    showExtraRows={showExtraRows}
                                    showTest={showTest}
                                    sortKey={sortKey}
                                    statusCounts={statusCounts}
                                    statusFilter={statusFilter}
                                    totalShown={filtered.length}
                                    totalUnfiltered={allOrders.length}
                                />
                            )}

                            {filtered.length === 0 ? (
                                <div className="rounded-xl p-10 text-center italic bg-bg-primary border border-border-medium text-text-tertiary">
                                    No orders match the current filters.
                                </div>
                            ) : viewMode === 'table' && !isMobile ? (
                                <PlanScheduleTable
                                    accentColor={accentColor}
                                    clockInRows={clockInRows}
                                    detailByOrderId={detailByOrderId}
                                    filteredPlantCode={singlePlant}
                                    firstLoadOutByPlant={firstLoadOutByPlant}
                                    getCloserPlantForOrder={getCloserPlantForOrder}
                                    getTravelOverrides={getTravelOverrides}
                                    helpRows={helpRows}
                                    isMaximized={effectiveMaximized}
                                    isPastDay={isPastDay}
                                    isPlantFiltered={!!singlePlant}
                                    isToday={isViewingToday}
                                    keyForOrder={keyForOrder}
                                    nowMin={nowMin}
                                    onOpenLocation={setMapOrder}
                                    orders={filtered}
                                    plantCityByCode={plantCityByCode}
                                    plantNameByCode={plantNameByCode}
                                    poolSourceByCode={poolSourceByCode}
                                    poolTimeline={poolTimeline}
                                    poolTimelinesByPlant={poolTimelinesByPlant}
                                    pullUpRows={pullUpRows}
                                    sendHomeRows={sendHomeRows}
                                    showExtraRows={showExtraRows}
                                    suggestedSlotRows={suggestedSlotRows}
                                />
                            ) : (
                                <PlanScheduleGroupedCards
                                    accentColor={accentColor}
                                    detailByOrderId={detailByOrderId}
                                    firstLoadOutByPlant={firstLoadOutByPlant}
                                    getCloserPlantForOrder={getCloserPlantForOrder}
                                    getTravelOverrides={getTravelOverrides}
                                    groupedByPlant={groupedByPlant}
                                    isViewingToday={isViewingToday}
                                    nowMin={nowMin}
                                    onOpenLocation={setMapOrder}
                                    onPickPlant={togglePlantFilter}
                                    onPickProduct={(p) => setProductFilter((prev) => (prev === p ? 'all' : p))}
                                    onPickStatus={(s) => setStatusFilter((prev) => (prev === s ? 'all' : s))}
                                    plantFilterSet={plantFilterSet}
                                    plantNameByCode={plantNameByCode}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
            {mapOrder && (
                <JobMapModal
                    accentColor={accentColor}
                    onClose={() => setMapOrder(null)}
                    order={mapOrder}
                    plantAddress={plantAddressByCode?.[mapOrder?.plantCode] || ''}
                    plantCode={mapOrder?.plantCode}
                    plantName={plantNameByCode?.[mapOrder?.plantCode] || ''}
                    plants={plantOptionsForMap}
                />
            )}
        </div>
    )
}

export default PlanScheduleView
