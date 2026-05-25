import { useCallback, useMemo } from 'react'

import {
    buildBaseByPlant,
    buildInitialPoolByCode,
    buildLocalBaseByPlant,
    buildPlantCityByCode,
    buildPlantOptionsForMap,
    buildPoolSourceByCode,
    buildProductOptions,
    buildStatusCounts,
    computeTimeBounds,
    countUniqueCustomers,
    enrichHelpRowsWithHomePool,
    filterAndSortOrders,
    flattenPlantOrders,
    groupOrdersByPlant,
    keyForOrder as buildKeyForOrder,
    makeGetJobTravelMin,
    makeGetTravelOverrides,
    selectLiveOrders,
    summarizeActiveFilters,
    sumDayYardage,
    sumLiveTrucks,
    sumLiveYards
} from '../../utils/PlanScheduleDataUtility'
import {
    applyLoadingPlantReassignment,
    buildHelpRows,
    buildHelpTransfers,
    evaluateScheduleSatisfaction,
    getFirstLoadOutByPlant,
    predictScheduleSatisfaction
} from '../../utils/PlanScheduleUtility'
import {
    computeClockInRows,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computePullUpRows,
    computeSendHomeRows,
    computeSuggestedSlots,
    getPoolDayMultiplier,
    getTodayDate,
    isClosedDay
} from '../../utils/PlanUtility'
import useCloserPlantLookup from './useCloserPlantLookup'
import useLiveMinuteOfDay from './useLiveMinuteOfDay'
import useLiveTravelTimes from './useLiveTravelTimes'
import usePlanTravelPairs from './usePlanTravelPairs'

/**
 * Single big data hook for PlanScheduleView. Bundles every memo / derived
 * value the orchestrator needs so the view file can stay a thin shell that
 * just wires props into sub-components.
 *
 * Pure delegation — every helper still lives in src/utils/*. This hook
 * exists strictly to localise the dozens of intertwined useMemo / useCallback
 * blocks that PlanScheduleView used to inline.
 */
export function usePlanScheduleData({
    assignments,
    detailByOrderId,
    filters,
    getTravelTime,
    planDate,
    plantAddressByCode,
    plantNameByCode,
    rawPlantProduction,
    stats
}) {
    const {
        minYards,
        plantFilters: plantFiltersRaw,
        productFilter,
        query,
        showCancelled,
        showTest,
        sortKey,
        statusFilter
    } = filters

    /** Reassign fully-loaded orders to the plant that actually loaded them
     *  (e.g. dispatch parked it on 401 but every ticket came from 402). The
     *  schedule view then renders the order under the working plant. */
    const plantProduction = useMemo(
        () => applyLoadingPlantReassignment(rawPlantProduction, detailByOrderId),
        [rawPlantProduction, detailByOrderId]
    )

    const poolDayMultiplier = getPoolDayMultiplier(planDate)
    const plantsClosed = isClosedDay(planDate)
    const isSaturday = poolDayMultiplier === 0.5
    /* "Same-day" badge gating — the 15:00 sentinel only means "same day" when
     * the schedule being viewed is actually today; on past/future schedules a
     * real 3:00 PM start is legitimate, so suppress the badge there. */
    const isViewingToday = planDate === getTodayDate()

    const plantCityByCode = useMemo(() => buildPlantCityByCode(plantAddressByCode), [plantAddressByCode])

    const plantOptionsForMap = useMemo(
        () => buildPlantOptionsForMap(plantAddressByCode, plantNameByCode),
        [plantAddressByCode, plantNameByCode]
    )

    /** Array of selected plant codes — empty means "all plants". Memoised
     *  so deps that depend on it stay stable when nothing changed. */
    const plantFilters = useMemo(() => (Array.isArray(plantFiltersRaw) ? plantFiltersRaw : []), [plantFiltersRaw])
    const plantFilterSet = useMemo(() => new Set(plantFilters), [plantFilters])
    /** When exactly one plant is selected, "single-plant" affordances
     *  (copy roster, extras toggle, plant-scope chip, pool-aware
     *  computations) light up. With zero or 2+ plants picked, those
     *  features stay disabled — they don't have a single subject. */
    const singlePlant = plantFilters.length === 1 ? plantFilters[0] : null

    const allOrders = useMemo(() => flattenPlantOrders(plantProduction), [plantProduction])

    const plantOptions = useMemo(() => {
        const codes = new Set(allOrders.map((o) => o.plantCode))
        return Array.from(codes).sort()
    }, [allOrders])

    /* Live travel + closer-plant chain. Each hook only reads what it needs;
     * the pair list comes first (no live data required), then the prefetch
     * hook turns it into a `getMinutes` lookup, then the closer-plant memo
     * compares per-job. Linear, no circular call, no stub callbacks. */
    const closerPlantInputs = useMemo(
        () => ({ allOrders, plantCityByCode, plantOptionsForMap }),
        [allOrders, plantCityByCode, plantOptionsForMap]
    )
    const travelPairs = usePlanTravelPairs(closerPlantInputs)
    const { getMinutes: getLiveTravelMinutes } = useLiveTravelTimes(travelPairs)
    const { getCloserPlantForOrder } = useCloserPlantLookup({ ...closerPlantInputs, getLiveTravelMinutes })

    /** Travel overrides for an order — pulls live Google minutes when we have
     *  them, otherwise falls back to letting the helper use the order's own
     *  `toJobTime` field from the dispatch report. */
    const getTravelOverrides = useMemo(
        () => makeGetTravelOverrides(getLiveTravelMinutes, plantCityByCode),
        [getLiveTravelMinutes, plantCityByCode]
    )

    /** Live travel-time lookup for ANY plant against this order's job
     *  address. Same key shape as `getTravelOverrides` but parameterised
     *  on the loading plant instead of assuming the order's home plant. */
    const getJobTravelMin = useMemo(
        () => makeGetJobTravelMin(getLiveTravelMinutes, plantCityByCode),
        [getLiveTravelMinutes, plantCityByCode]
    )

    /** Canonical orderKey, mirroring what `computePlantPoolTimeline` builds. */
    const keyForOrder = useCallback(buildKeyForOrder, [])

    const poolSourceByCode = useMemo(
        () => buildPoolSourceByCode(stats, plantProduction, planDate),
        [stats, plantProduction, planDate]
    )

    const baseByPlant = useMemo(
        () => buildBaseByPlant(stats, plantProduction, planDate),
        [stats, plantProduction, planDate]
    )

    /** Operator clock-in events per plant. Capped at the effective LOCAL
     *  truck count (`base − send + recv`) so the staffing ramp only counts
     *  operators staying at this plant — helpers leaving for other plants
     *  are scheduled separately via `helpRows`. */
    const localBaseByPlant = useMemo(() => buildLocalBaseByPlant(poolSourceByCode), [poolSourceByCode])

    const clockInRows = useMemo(
        () => computeClockInRows(allOrders, localBaseByPlant, getTravelOverrides),
        [allOrders, localBaseByPlant, getTravelOverrides]
    )

    /** Per-driver help rows — grouped into 30-minute buckets per assignment +
     *  direction so a staggered crew arriving over an hour reads as two rows.
     *  Return rows honor the assignment's `returnPlant` so trucks can be sent
     *  back to a different plant after pouring. */
    const helpRows = useMemo(
        () => buildHelpRows(assignments, plantProduction, getTravelTime),
        [assignments, plantProduction, getTravelTime]
    )

    const initialPoolByCode = useMemo(() => buildInitialPoolByCode(baseByPlant), [baseByPlant])

    /** Help transfers in the format expected by `computePlantPoolTimeline`. */
    const helpTransfers = useMemo(() => buildHelpTransfers(helpRows, clockInRows), [helpRows, clockInRows])

    const poolTimeline = useMemo(
        () => computePlantPoolTimeline(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    const poolTimelinesByPlant = useMemo(
        () => computePlantPoolTimelines(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Help rows enriched with the resulting pool at the home plant for
     *  return legs. Lets the schedule render "HELP RETURNING · 406 now has
     *  N operators available" so the dispatcher SEES the +N credited back
     *  into the home pool. */
    const enrichedHelpRows = useMemo(
        () => enrichHelpRowsWithHomePool(helpRows, poolTimelinesByPlant),
        [helpRows, poolTimelinesByPlant]
    )

    const sendHomeRows = useMemo(
        () => computeSendHomeRows(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    const suggestedSlotRows = useMemo(
        () => computeSuggestedSlots(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    const pullUpRows = useMemo(
        () => computePullUpRows(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    const statusCounts = useMemo(() => buildStatusCounts(allOrders, isViewingToday), [allOrders, isViewingToday])

    const productOptions = useMemo(() => buildProductOptions(allOrders), [allOrders])

    const filtered = useMemo(
        () =>
            filterAndSortOrders(allOrders, {
                isViewingToday,
                minYards,
                plantFilterSet,
                productFilter,
                query,
                showCancelled,
                showTest,
                sortKey,
                statusFilter
            }),
        [
            allOrders,
            isViewingToday,
            statusFilter,
            minYards,
            plantFilterSet,
            productFilter,
            query,
            showCancelled,
            showTest,
            sortKey
        ]
    )

    const liveOrders = useMemo(() => selectLiveOrders(filtered), [filtered])
    const totalYards = sumLiveYards(liveOrders)
    const totalTrucks = sumLiveTrucks(liveOrders, getTravelOverrides)

    const today = getTodayDate()
    const isPastDay = !!planDate && planDate < today
    const isToday = !!planDate && planDate === today
    const nowMin = useLiveMinuteOfDay(isToday)
    const customerSatisfaction = useMemo(
        () => evaluateScheduleSatisfaction({ detailByOrderId, isPastDay, isToday, liveOrders, nowMin }),
        [detailByOrderId, isPastDay, isToday, liveOrders, nowMin]
    )

    /** Predicted customer satisfaction for FUTURE days — derived from the
     *  pool simulation's NEEDS HELP signals (orders where the effective
     *  pool goes negative). For past / today we rely on the actual
     *  `customerSatisfaction` score from ticket data instead. */
    const predictedSatisfaction = useMemo(() => {
        if (isPastDay || isToday) return null
        return predictScheduleSatisfaction({ getTravelOverrides, keyForOrder, liveOrders, poolTimeline })
    }, [isPastDay, isToday, getTravelOverrides, keyForOrder, liveOrders, poolTimeline])

    const uniquePlants = new Set(liveOrders.map((o) => o.plantCode)).size
    const uniqueCustomers = countUniqueCustomers(liveOrders)
    const { earliestTime, latestTime } = computeTimeBounds(liveOrders)

    const hasAnyOrders = allOrders.length > 0
    const { activeFilterCount, hasActiveFilters } = summarizeActiveFilters({
        minYards,
        plantFilters,
        productFilter,
        query,
        showCancelled,
        showTest,
        statusFilter
    })

    const groupedByPlant = useMemo(() => groupOrdersByPlant(filtered), [filtered])

    /* Per-plant anchor for the 14h driver-shift check. Each plant's
     * badge is computed against THAT plant's own day-start (first own
     * order or first outbound help) — never against the day's earliest
     * job at a different plant. Built from the unfiltered order set so
     * the anchor stays stable when the user filters the schedule down. */
    const firstLoadOutByPlant = useMemo(() => getFirstLoadOutByPlant(allOrders, helpRows), [allOrders, helpRows])

    return {
        activeFilterCount,
        allOrders,
        clockInRows,
        customerSatisfaction,
        earliestTime,
        filtered,
        firstLoadOutByPlant,
        getCloserPlantForOrder,
        getJobTravelMin,
        getTravelOverrides,
        groupedByPlant,
        hasActiveFilters,
        hasAnyOrders,
        helpRows: enrichedHelpRows,
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
    }
}
