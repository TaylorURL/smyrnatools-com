import React, { useEffect, useMemo, useState } from 'react'

import PlanScheduleChangeStrip from '../../../app/components/plan/tabs/schedule/PlanScheduleChangeStrip'
import PlanScheduleClosedBanner from '../../../app/components/plan/tabs/schedule/PlanScheduleClosedBanner'
import PlanScheduleEmptyState from '../../../app/components/plan/tabs/schedule/PlanScheduleEmptyState'
import PlanScheduleFilterDrawer from '../../../app/components/plan/tabs/schedule/PlanScheduleFilterDrawer'
import PlanScheduleGroupedCards from '../../../app/components/plan/tabs/schedule/PlanScheduleGroupedCards'
import PlanScheduleSplitView from '../../../app/components/plan/tabs/schedule/PlanScheduleSplitView'
import PlanScheduleStatStrip from '../../../app/components/plan/tabs/schedule/PlanScheduleStatStrip'
import PlanScheduleTable from '../../../app/components/plan/tabs/schedule/PlanScheduleTable'
import PlanScheduleTitleRow from '../../../app/components/plan/tabs/schedule/PlanScheduleTitleRow'
import JobMapModal from '../../../app/components/schedule/JobMapModal'
import OrderAuditModal from '../../../app/components/schedule/OrderAuditModal'
import OrderInfoModal from '../../../app/components/schedule/OrderInfoModal'
import OrderTicketsModal from '../../../app/components/schedule/OrderTicketsModal'
import { DEFAULT_SCHEDULE_FILTERS } from '../../../app/constants/planScheduleViewConstants'
import { usePlanScheduleAdjacentTotals } from '../../../app/hooks/usePlanScheduleAdjacentTotals'
import { usePlanScheduleData } from '../../../app/hooks/usePlanScheduleData'
import { usePlanScheduleFilterSetters } from '../../../app/hooks/usePlanScheduleFilterSetters'
import { usePlanScheduleMaximize } from '../../../app/hooks/usePlanScheduleMaximize'
import { usePlanScheduleSnapshotPrediction } from '../../../app/hooks/usePlanScheduleSnapshotPrediction'
import { ScheduleSnapshotService } from '../../../services/ScheduleSnapshotService'
import { buildOrderCoveragePayload, computeScheduleHeadlineMetrics } from '../../../utils/PlanScheduleUtility'

/**
 * Schedule view — flat, filterable, sortable table (or grouped cards) of every
 * dispatch order auto-ingested for the day. Dispatchers can narrow by plant,
 * customer, product, time bucket, truck class, minimum yardage, and a
 * free-text search across customer/address/PO.
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
    /** Behavioural risk index keyed by customer name. Threaded through to
     *  every order row so the customer cell can render the "Likely to
     *  Kick" / "Likely to Cancel/Move" badges sourced from the trailing
     *  60-day history. Owned by `OperationsView` via `useCustomerRiskIndex`. */
    customerRiskIndex,
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
        getJobTravelMin,
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
        predictedSatisfaction,
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
    // "View order" / "View tickets" modal targets. Owned here (not in the
    // table) so the desktop right-click menu, the compare split-view, AND
    // the mobile order cards can all open the same single modal instance.
    const [infoOrder, setInfoOrder] = useState(null)
    const [ticketsOrder, setTicketsOrder] = useState(null)
    // Order audit (right-click → diff this order against the 5:30 PM
    // snapshot) is still a modal — per-order popup. The compare flow is
    // NOT modal: `compareMode` flips the whole schedule body into a
    // two-column split view that respects the same filter drawer state.
    const [auditOrder, setAuditOrder] = useState(null)
    const [compareMode, setCompareMode] = useState(false)
    /** When compareMode is on, load the snapshot once here so the stat
     *  strip can show before/after deltas AND the split view can read
     *  the same in-memory copy (ScheduleSnapshotService caches by date,
     *  so the second `getSnapshot` call from the split view is a no-op). */
    const [compareSnapshot, setCompareSnapshot] = useState(null)
    useEffect(() => {
        if (!compareMode || !planDate) {
            setCompareSnapshot(null)
            return undefined
        }
        let cancelled = false
        ;(async () => {
            const result = await ScheduleSnapshotService.getSnapshot(planDate)
            if (!cancelled) setCompareSnapshot(result)
        })()
        return () => {
            cancelled = true
        }
    }, [compareMode, planDate])

    /* If the dispatcher is in compare mode and then navigates forward
     * to a future date, the toggle button hides — but `compareMode` is
     * sticky, so without this effect they'd be stuck looking at an
     * empty split view with no way out. Flip the flag off the moment
     * we land on a date with no snapshot to compare against. */
    useEffect(() => {
        if (compareMode && !isViewingToday && !isPastDay) {
            setCompareMode(false)
        }
    }, [compareMode, isViewingToday, isPastDay])

    /** Memoized active filter scope. Shared by both snapshot-based readouts —
     *  the compare baseline and the past-day predicted satisfaction — so they
     *  react to the toolbar without rebuilding the object every render and stay
     *  apples-to-apples with the live stat strip. */
    const scheduleFilterScope = useMemo(
        () => ({ minYards, plantFilterSet, productFilter, query, showCancelled, showTest, sortKey, statusFilter }),
        [minYards, plantFilterSet, productFilter, query, showCancelled, showTest, sortKey, statusFilter]
    )

    /** Schedule headline metrics computed off the snapshot's plant
     *  production, run through the SAME filter pipeline the live stats
     *  use so the strip's `-20%` reads as an apples-to-apples delta and
     *  not "snapshot saw 50 orders, live filtered down to 12, somehow -76%." */
    const compareBaseline = useMemo(() => {
        if (!compareMode || !compareSnapshot?.plant_production) return null
        return computeScheduleHeadlineMetrics(compareSnapshot.plant_production, scheduleFilterScope, isViewingToday)
    }, [compareMode, compareSnapshot, scheduleFilterScope, isViewingToday])

    /** On past days the live schedule has drifted from what was finalized, so
     *  the "predicted" stat is recomputed from the 5:30 PM snapshot — the
     *  forecast as it stood when the schedule locked. Null on today / future
     *  days, where `usePlanScheduleData` owns the live forecast instead. */
    const snapshotPredictedSatisfaction = usePlanScheduleSnapshotPrediction({
        assignments,
        filters: scheduleFilterScope,
        getTravelTime,
        isPastDay,
        planDate,
        stats
    })

    const clearAllFilters = () => {
        setQuery('')
        setPlantFilters([])
        setStatusFilter('all')
        setProductFilter('all')
        setMinYards('')
        setShowCancelled(false)
        setShowTest(false)
    }

    /** Single-plant affordances (extras toggle, plant scope chip) only
     *  light up when exactly one plant is selected. */
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
                            compareMode={compareMode}
                            filteredCount={filtered.length}
                            filtersOpen={filtersOpen}
                            hasAnyOrders={hasAnyOrders}
                            isMobile={isMobile}
                            onSwitchToPlanner={onSwitchToPlanner}
                            /* The compare flow diffs against the 5:30 PM snapshot
                             * that captured this date's schedule the evening
                             * before. Future plans haven't been snapshotted yet,
                             * so there's nothing to compare against — hide the
                             * toggle entirely instead of letting the dispatcher
                             * land on an empty split view. Today + past dates
                             * keep the button. */
                            onToggleCompare={
                                !isViewingToday && !isPastDay ? undefined : () => setCompareMode((v) => !v)
                            }
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
                                    compareBaseline={compareBaseline}
                                    customerSatisfaction={customerSatisfaction}
                                    earliestTime={earliestTime}
                                    filteredCount={filtered.length}
                                    hasActiveFilters={hasActiveFilters}
                                    latestTime={latestTime}
                                    liveOrdersCount={liveOrders.length}
                                    predictedSatisfaction={predictedSatisfaction ?? snapshotPredictedSatisfaction}
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
                            {!effectiveMaximized && compareMode && compareSnapshot && (
                                <PlanScheduleChangeStrip
                                    filters={{
                                        minYards,
                                        plantFilterSet,
                                        productFilter,
                                        query,
                                        showCancelled,
                                        showTest,
                                        statusFilter
                                    }}
                                    isViewingToday={isViewingToday}
                                    rawPlantProduction={rawPlantProduction}
                                    snapshot={compareSnapshot}
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
                                    onExitMaximized={effectiveMaximized ? () => setMaximized(false) : null}
                                    onToggleExtraRows={() => setShowExtraRows((v) => !v)}
                                    onTogglePlantFilter={togglePlantFilter}
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

                            {compareMode ? (
                                <PlanScheduleSplitView
                                    accentColor={accentColor}
                                    detailByOrderId={detailByOrderId}
                                    filters={{
                                        minYards,
                                        planDate,
                                        plantFilterSet,
                                        productFilter,
                                        query,
                                        showCancelled,
                                        showTest,
                                        sortKey,
                                        statusFilter
                                    }}
                                    snapshot={compareSnapshot}
                                    firstLoadOutByPlant={firstLoadOutByPlant}
                                    getCloserPlantForOrder={getCloserPlantForOrder}
                                    getJobTravelMin={getJobTravelMin}
                                    getTravelOverrides={getTravelOverrides}
                                    isMaximized={effectiveMaximized}
                                    isPastDay={isPastDay}
                                    isToday={isViewingToday}
                                    keyForOrder={keyForOrder}
                                    nowMin={nowMin}
                                    onOpenAudit={setAuditOrder}
                                    onOpenLocation={setMapOrder}
                                    onViewOrder={setInfoOrder}
                                    onViewTickets={setTicketsOrder}
                                    plantCityByCode={plantCityByCode}
                                    plantNameByCode={plantNameByCode}
                                    poolSourceByCode={poolSourceByCode}
                                    poolTimeline={poolTimeline}
                                    poolTimelinesByPlant={poolTimelinesByPlant}
                                    rawPlantProduction={rawPlantProduction}
                                    singlePlant={singlePlant}
                                />
                            ) : filtered.length === 0 ? (
                                <div className="rounded-xl p-10 text-center italic bg-bg-primary border border-border-medium text-text-tertiary">
                                    No orders match the current filters.
                                </div>
                            ) : viewMode === 'table' && !isMobile ? (
                                <PlanScheduleTable
                                    accentColor={accentColor}
                                    clockInRows={clockInRows}
                                    customerRiskIndex={customerRiskIndex}
                                    detailByOrderId={detailByOrderId}
                                    filteredPlantCode={singlePlant}
                                    firstLoadOutByPlant={firstLoadOutByPlant}
                                    getCloserPlantForOrder={getCloserPlantForOrder}
                                    getJobTravelMin={getJobTravelMin}
                                    getTravelOverrides={getTravelOverrides}
                                    helpRows={helpRows}
                                    isMaximized={effectiveMaximized}
                                    isPastDay={isPastDay}
                                    isPlantFiltered={!!singlePlant}
                                    isToday={isViewingToday}
                                    keyForOrder={keyForOrder}
                                    nowMin={nowMin}
                                    onOpenAudit={setAuditOrder}
                                    onOpenLocation={setMapOrder}
                                    onViewOrder={setInfoOrder}
                                    onViewTickets={setTicketsOrder}
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
                                    onViewOrder={setInfoOrder}
                                    onViewTickets={setTicketsOrder}
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
            {auditOrder && (
                <OrderAuditModal
                    accentColor={accentColor}
                    onClose={() => setAuditOrder(null)}
                    order={auditOrder}
                    planDate={planDate}
                />
            )}
            {ticketsOrder && (
                <OrderTicketsModal
                    accentColor={accentColor}
                    detail={ticketsOrder.orderId ? detailByOrderId[ticketsOrder.orderId] : null}
                    getJobTravelMin={getJobTravelMin}
                    onClose={() => setTicketsOrder(null)}
                    order={ticketsOrder}
                    plantNameByCode={plantNameByCode}
                />
            )}
            {infoOrder && (
                <OrderInfoModal
                    accentColor={accentColor}
                    closerPlant={getCloserPlantForOrder ? getCloserPlantForOrder(infoOrder) : null}
                    coverage={buildOrderCoveragePayload(infoOrder, {
                        poolSourceByCode,
                        poolTimeline,
                        poolTimelinesByPlant,
                        rowKey: keyForOrder(infoOrder),
                        travelOverrides: getTravelOverrides ? getTravelOverrides(infoOrder) : undefined
                    })}
                    onClose={() => setInfoOrder(null)}
                    onOpenLocation={(o) => {
                        setInfoOrder(null)
                        setMapOrder(o)
                    }}
                    onViewTickets={(o) => {
                        setInfoOrder(null)
                        setTicketsOrder(o)
                    }}
                    order={infoOrder}
                    plantName={plantNameByCode?.[infoOrder.plantCode] || ''}
                    ticketCount={infoOrder.orderId ? (detailByOrderId?.[infoOrder.orderId]?.ticketCount ?? null) : null}
                />
            )}
        </div>
    )
}

export default PlanScheduleView
