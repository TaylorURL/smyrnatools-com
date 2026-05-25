import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { PlanService } from '../../services/PlanService'
import {
    buildActiveAssignmentByName,
    buildCurrentDays,
    buildLoadsByOperator,
    buildMergedDetail,
    buildMixerByEmployeeId,
    buildMixerByTruckNumber,
    buildOperatorByEmployeeId,
    buildOperatorByNormalizedName,
    buildOrderScheduleByOrderId,
    buildPerPlantLoadAttribution,
    buildPerPlantSatisfaction,
    buildPreviousSatisfactionAggregate,
    buildSatisfactionAggregate,
    buildSatisfactionByDay,
    buildSatisfactionByWeekday,
    buildSatisfactionMomentum,
    buildSatisfactionTrend,
    buildSatisfactionWorstCustomers,
    buildSatisfactionWorstOrders,
    buildScheduleMetaByDate,
    buildScoredOrders,
    collectAvailablePlantCodes,
    computeWindowMidpointIso
} from '../../utils/PlanStatisticsAggregators'
import { flattenLiveOrders, mergePlanAndDispatchRows } from '../../utils/PlanStatisticsMergeUtility'
import {
    aggregateMetrics,
    buildRange,
    computeScheduleMetrics,
    countWorkingDays,
    isSundayIso,
    listWorkingDaysInRange,
    padTrend
} from '../../utils/PlanStatisticsUtility'
import { getTodayDate } from '../../utils/PlanUtility'
import { usePlanStatisticsDetailByDay } from './usePlanStatisticsDetailByDay'
import { usePlanStatisticsPlans } from './usePlanStatisticsPlans'
import { usePlanStatisticsRoster } from './usePlanStatisticsRoster'

/**
 * Orchestrates every async + derived state slice for `PlanStatisticsView`.
 *
 * Owns the period/comparison/anchor/plant-filter selectors, fetches plan
 * rows for the active range (and its comparison window), derives per-day
 * + period-aggregate schedule metrics, fetches detail-order ticket data
 * for the satisfaction score, and pre-pads trend data for the chart.
 *
 * Pure orchestration — no rendering, no DOM. Returns a flat object that
 * the view destructures into its presentation components. The pure
 * aggregator + lookup-builder bodies live in
 * `src/utils/PlanStatisticsAggregators.js`; this hook supplies the React
 * lifecycle wrapping (state, effects, memo deps) around them.
 *
 * @param {Object} args
 * @param {string} args.planDate - Active plan date.
 * @param {Object} args.liveProduction - Latest in-memory plant_production
 *   used as a synthetic row when the active range covers `planDate` but
 *   the server doesn't have a saved row for it yet.
 * @param {boolean} [args.satisfactionEnabled=true] - When false, the
 *   satisfaction-side computations (per-plant rank, trend, aggregate, ticket
 *   fetches) skip work entirely and return null/empty. Lets the view defer
 *   the most expensive memos until the satisfaction sub-page is actually
 *   visible — without it, "Statistics → Overview" would re-run thousands of
 *   ops every render even though no chart was reading the result.
 * @param {boolean} [args.operatorsEnabled=false] - When true, also fetch
 *   per-day ticket detail data (same source the satisfaction page uses) so
 *   the Operators sub-page can group loads by driver. Independent of
 *   satisfaction so loading the Operators page doesn't pay for the
 *   satisfaction memos as well.
 * @param {boolean} [args.helpCrossLoadingEnabled=false] - When true, fetch
 *   saved `plans` rows for the active range (assignments + plant_production)
 *   so the Help & Cross-Loading sub-page can correlate planned help against
 *   actual delivered tickets. Also enables the per-day ticket detail fetch
 *   used by the cross-loading half of that page.
 * @param {boolean} [args.plantsEnabled=false] - When true, fetch ticket
 *   detail data so the Plants sub-page can show "loaded" + cross-loaded
 *   yardage per plant alongside the schedule's "ordered" numbers. Without
 *   this flag the per-plant load-attribution stays at all zeros.
 * @param {Object} [args.colocationMap] - Optional plant co-location map
 *   exposing `resolvePrimary(code)`. When provided, the per-plant load
 *   attribution collapses sibling-site aliases (e.g. 404 → 401) so a load
 *   inside the same physical plant isn't miscounted as cross-loaded.
 */
export function usePlanStatistics({
    planDate,
    liveProduction,
    satisfactionEnabled = true,
    operatorsEnabled = false,
    helpCrossLoadingEnabled = false,
    plantsEnabled = false,
    serviceEnabled = false,
    kickersEnabled = false,
    ticketLookupEnabled = false,
    colocationMap = null
}) {
    const [period, setPeriod] = useState('month')
    const [comparison, setComparison] = useState('none')
    /* Default to today's CST calendar date when the caller didn't pass
     * a `planDate` — keeps the dispatcher's "today" stable across
     * timezones so the Statistics tab opens on the same anchor whether
     * the browser is in Houston, New York, or Tokyo. */
    const [anchor, setAnchor] = useState(planDate || getTodayDate())
    const [customStart, setCustomStart] = useState(planDate || getTodayDate())
    const [customEnd, setCustomEnd] = useState(planDate || getTodayDate())
    const [loading, setLoading] = useState(true)
    /** Raw plan rows from the database — kept un-aggregated so the plant
     *  filter can re-derive every metric without a re-fetch. */
    const [currentRows, setCurrentRows] = useState([])
    const [previousRows, setPreviousRows] = useState([])
    /** null = all plants; otherwise a plant_code that scopes every
     *  aggregation, chart, and table on the page. */
    const [selectedPlant, setSelectedPlant] = useState(null)
    // `plansLoading` is held only as a public-API stub for downstream
    // consumers; the plans fetch now rides on the main `loading` flag
    // since plans + dispatch_data are fetched together in one effect.
    const [plansLoading] = useState(false)

    const { activeMixers, operatorRoster, operatorRosterLoading } = usePlanStatisticsRoster({ operatorsEnabled })

    /* Driver resolution lookup maps. Tickets identify drivers by a mix of
     * normalized name, employeeId, and truck number — these maps bridge
     * every variant back to a canonical operator + mixer assignment so
     * loads-by-operator can attribute correctly even when only one of the
     * keys is present on the ticket. See the underlying `build*` helpers
     * for the exact match semantics. */
    const operatorByNormalizedName = useMemo(() => buildOperatorByNormalizedName(operatorRoster), [operatorRoster])
    const mixerByEmployeeId = useMemo(() => buildMixerByEmployeeId(activeMixers), [activeMixers])
    const mixerByTruckNumber = useMemo(() => buildMixerByTruckNumber(activeMixers), [activeMixers])
    const operatorByEmployeeId = useMemo(() => buildOperatorByEmployeeId(operatorRoster), [operatorRoster])
    const activeAssignmentByName = useMemo(
        () => buildActiveAssignmentByName(activeMixers, operatorRoster),
        [activeMixers, operatorRoster]
    )

    useEffect(() => {
        if (planDate) setAnchor(planDate)
    }, [planDate])

    const range = useMemo(
        () => buildRange(period, anchor, comparison, customStart, customEnd),
        [period, anchor, comparison, customStart, customEnd]
    )

    /** True when the user is looking at a single calendar day — unlocks
     *  truck-utilization status pills that need a per-day shift span. */
    const isSingleDay = useMemo(
        () => period === 'day' || (period === 'custom' && customStart === customEnd),
        [period, customStart, customEnd]
    )

    /** Working-day count for the current window (Sundays excluded), used as
     *  the denominator for "X of Y days" KPI hints. */
    const workingDayCount = useMemo(() => countWorkingDays(range.current.start, range.current.end), [range])

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            try {
                // Statistics pulls schedule data from BOTH the curated
                // `plans` table (where the dispatcher's yardage edits land)
                // AND the imported `dispatch_data` table (every day's
                // dispatch report). For days the dispatcher curated, the
                // plans row is authoritative — `dispatch_data` frequently
                // arrives with null `scheduled_yardage` on cross-plant
                // order headers, which would silently zero out yardage on
                // every Statistics sub-page if we relied on dispatch_data
                // alone. For days the dispatcher never opened, dispatch_data
                // is the only thing we have. So we fetch both in parallel
                // and merge per-date: plans wins when present, dispatch_data
                // fills the gaps.
                const currentDates = listWorkingDaysInRange(range.current.start, range.current.end)
                const previousDates = range.previous
                    ? listWorkingDaysInRange(range.previous.start, range.previous.end)
                    : []
                const [dispatchCurrent, dispatchPrevious, plansCurrent, plansPrevious] = await Promise.all([
                    DispatchDataService.fetchPlanRowsByDateRange(currentDates),
                    previousDates.length
                        ? DispatchDataService.fetchPlanRowsByDateRange(previousDates)
                        : Promise.resolve([]),
                    PlanService.fetchPlansInRange(range.current.start, range.current.end).catch(() => []),
                    range.previous
                        ? PlanService.fetchPlansInRange(range.previous.start, range.previous.end).catch(() => [])
                        : Promise.resolve([])
                ])
                if (cancelled) return
                setCurrentRows(mergePlanAndDispatchRows(plansCurrent, dispatchCurrent))
                setPreviousRows(mergePlanAndDispatchRows(plansPrevious, dispatchPrevious))
            } catch {
                if (cancelled) return
                setCurrentRows([])
                setPreviousRows([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [range])

    /** Saved plan rows (with `assignments`) for the active range — only the
     *  Help & Cross-Loading sub-page needs these, so the fetch is gated. */
    const { plansByDate } = usePlanStatisticsPlans({ helpCrossLoadingEnabled, range })

    /** Derive per-day metrics from the raw rows. Re-runs cheaply when the
     *  plant filter changes — no re-fetch needed. The live-production
     *  fallback runs here so it picks up the same plant filter. */
    const currentDays = useMemo(
        () => buildCurrentDays({ currentRows, liveProduction, planDate, range, selectedPlant }),
        [currentRows, selectedPlant, planDate, liveProduction, range]
    )

    const previousDays = useMemo(
        () =>
            (previousRows || [])
                .map((row) => computeScheduleMetrics(row, selectedPlant))
                .filter((d) => !isSundayIso(d.planDate)),
        [previousRows, selectedPlant]
    )

    /** Distinct plant codes present in the loaded window (not the global
     *  plant directory). Sorted alphabetically. */
    const availablePlantCodes = useMemo(
        () => collectAvailablePlantCodes(currentRows, selectedPlant),
        [currentRows, selectedPlant]
    )

    /** Per-date Map<orderId, {scheduledYardage, loadSize}> derived from the
     *  merged `currentRows` + `previousRows`. Carries the dispatcher's
     *  curated yardage — exactly what the detail allocator needs to fill
     *  in for cross-plant orders whose dispatch_data header row has a
     *  null `scheduled_yardage`. Passed into `fetchDetailByDateRange` as
     *  the external fallback so ticket quantities, `byPlant` totals, and
     *  downstream cross-load attribution all reflect the right numbers. */
    const scheduleMetaByDate = useMemo(
        () => buildScheduleMetaByDate(currentRows, previousRows),
        [currentRows, previousRows]
    )

    /** Per-day detail-order ticket data fetched from the dispatch storage
     *  bucket. Feeds `computeCustomerSatisfaction` so this page produces
     *  the EXACT same score the Schedule tab shows for the current day.
     *  Days with no detail data are scored as null. */
    const { detailByDay, satisfactionLoading } = usePlanStatisticsDetailByDay({
        currentDays,
        previousDays,
        scheduleMetaByDate,
        satisfactionEnabled,
        operatorsEnabled,
        helpCrossLoadingEnabled,
        plantsEnabled,
        serviceEnabled,
        kickersEnabled,
        ticketLookupEnabled
    })

    /** Flat list of every live order in the active window, tagged with its
     *  plant + date. Built ONCE so per-plant memos can bucket without
     *  re-walking rows or calling `computeScheduleMetrics`. Always covers
     *  all plants — the plant comparison chart needs the unfiltered set. */
    const flatOrders = useMemo(
        () =>
            satisfactionEnabled ||
            helpCrossLoadingEnabled ||
            plantsEnabled ||
            serviceEnabled ||
            kickersEnabled ||
            ticketLookupEnabled
                ? flattenLiveOrders(currentRows)
                : [],
        [
            currentRows,
            satisfactionEnabled,
            helpCrossLoadingEnabled,
            plantsEnabled,
            serviceEnabled,
            kickersEnabled,
            ticketLookupEnabled
        ]
    )

    /** Flat `orderId → {scheduledYardage, loadSize}` lookup derived from
     *  the merged `flatOrders`. Used as the client-side fallback when a
     *  ticket's `quantity` arrives at zero — same data the service-layer
     *  allocator gets via `scheduleMetaByDate`, but accessible at the
     *  `mergedDetail` merge step where we can post-process detail entries
     *  whose service-side allocation didn't pick up the schedule yardage. */
    const orderScheduleByOrderId = useMemo(() => buildOrderScheduleByOrderId(flatOrders), [flatOrders])

    /** Merged detail map across every loaded date — built once and reused
     *  by every aggregate. Belt-and-suspenders schedule backfill applies
     *  per entry so consumers see corrected ticket quantities even when
     *  the service-layer fetch landed before plans data was available. */
    const mergedDetail = useMemo(
        () => (satisfactionEnabled || plantsEnabled ? buildMergedDetail(detailByDay, orderScheduleByOrderId) : {}),
        [detailByDay, satisfactionEnabled, plantsEnabled, orderScheduleByOrderId]
    )

    /** Per-plant load attribution — splits each plant's slice into
     *  ordered / loaded / selfLoaded / crossInYards / crossOutYards.
     *  Plant codes normalise through `colocationMap.resolvePrimary` so
     *  sibling-site aliases collapse to the same physical plant. */
    const perPlantLoadAttribution = useMemo(
        () => buildPerPlantLoadAttribution(flatOrders, mergedDetail, colocationMap),
        [flatOrders, mergedDetail, colocationMap]
    )

    /** Per-day satisfaction. Null entries mean we have no ticket data for
     *  that day. */
    const satisfactionByDay = useMemo(
        () => (satisfactionEnabled ? buildSatisfactionByDay(currentDays, detailByDay) : {}),
        [currentDays, detailByDay, satisfactionEnabled]
    )

    /** Period-aggregated satisfaction — single call across the entire
     *  active window, using each day's plant-filtered allLiveOrders so
     *  the aggregate respects `selectedPlant`. */
    const satisfactionAggregate = useMemo(
        () => (satisfactionEnabled ? buildSatisfactionAggregate(currentDays, mergedDetail) : null),
        [currentDays, mergedDetail, satisfactionEnabled]
    )

    /** Same shape, computed against the comparison window. */
    const previousSatisfactionAggregate = useMemo(
        () => (satisfactionEnabled ? buildPreviousSatisfactionAggregate(previousDays, mergedDetail, comparison) : null),
        [previousDays, mergedDetail, comparison, satisfactionEnabled]
    )

    /** Per-day satisfaction trend across the entire active range, padded
     *  so missing days show as gaps in the chart. Each entry carries the
     *  raw score plus a trailing 7-working-day rolling good-rate. */
    const satisfactionTrend = useMemo(
        () => (satisfactionEnabled ? buildSatisfactionTrend(currentDays, detailByDay, range) : []),
        [currentDays, detailByDay, satisfactionEnabled, range]
    )

    /** ISO date midway through the active window — used to split each
     *  plant's order set into "first half" vs "second half" so we can show
     *  whether each plant is improving / declining within the period. */
    const windowMidpointIso = useMemo(() => computeWindowMidpointIso(range), [range])

    /** Per-plant satisfaction with first-half vs second-half trajectory. */
    const perPlantSatisfaction = useMemo(
        () => (satisfactionEnabled ? buildPerPlantSatisfaction(flatOrders, mergedDetail, windowMidpointIso) : []),
        [flatOrders, mergedDetail, windowMidpointIso, satisfactionEnabled]
    )

    /** Day-of-week satisfaction breakdown — average score Mon–Sat. */
    const satisfactionByWeekday = useMemo(
        () => (satisfactionEnabled ? buildSatisfactionByWeekday(currentDays, detailByDay) : []),
        [currentDays, detailByDay, satisfactionEnabled]
    )

    /** Per-order scored list — the hottest single pass on the page. Used
     *  by worst-orders, worst-customers, and the score-distribution
     *  histogram. Filters by `selectedPlant` when active. */
    const scoredOrders = useMemo(
        () => (satisfactionEnabled ? buildScoredOrders(flatOrders, mergedDetail, selectedPlant) : []),
        [flatOrders, mergedDetail, selectedPlant, satisfactionEnabled]
    )

    /** Bad orders surfaced for follow-up — every order flagged "bad" by
     *  the shared late-or-slow rule, sorted by yardage desc. */
    const satisfactionWorstOrders = useMemo(() => buildSatisfactionWorstOrders(scoredOrders), [scoredOrders])

    /** Customers with any bad service in the window. */
    const satisfactionWorstCustomers = useMemo(() => buildSatisfactionWorstCustomers(scoredOrders), [scoredOrders])

    /** Momentum — last 7 working days inside the window vs the 7 before
     *  that, so the user can see whether things are heading the right way
     *  even on a long period. */
    const satisfactionMomentum = useMemo(
        () => (satisfactionEnabled ? buildSatisfactionMomentum(currentDays, mergedDetail) : null),
        [currentDays, mergedDetail, satisfactionEnabled]
    )

    /** Per-operator load tally across the active window. Walks every
     *  ticket in `detailByDay`, resolves drivers via truck-number +
     *  name-variant bridges, and emits a sorted row list with mismatch
     *  classifications (unassigned / wrongPlant / wrongTruck / multiTruck).
     *  Unresolvable tickets collapse into a single synthetic "Unmatched
     *  operators" row that still tracks per-unique-spelling aggregates
     *  for actionable dispatcher fixes. */
    const loadsByOperator = useMemo(
        () =>
            operatorsEnabled
                ? buildLoadsByOperator({
                      activeAssignmentByName,
                      activeMixers,
                      detailByDay,
                      mixerByEmployeeId,
                      mixerByTruckNumber,
                      operatorByEmployeeId,
                      operatorByNormalizedName,
                      operatorRoster,
                      range,
                      selectedPlant
                  })
                : [],
        [
            detailByDay,
            operatorsEnabled,
            range,
            selectedPlant,
            activeMixers,
            operatorRoster,
            operatorByNormalizedName,
            operatorByEmployeeId,
            mixerByEmployeeId,
            mixerByTruckNumber,
            activeAssignmentByName
        ]
    )

    const currentSummary = useMemo(() => aggregateMetrics(currentDays), [currentDays])
    const previousSummary = useMemo(
        () => (comparison === 'none' ? null : aggregateMetrics(previousDays)),
        [previousDays, comparison]
    )

    const trendData = useMemo(
        () => (currentDays.length === 0 ? [] : padTrend(range.current.start, range.current.end, currentDays)),
        [currentDays, range]
    )
    const trendComparison = useMemo(
        () =>
            comparison !== 'none' && range.previous && previousDays.length > 0
                ? padTrend(range.previous.start, range.previous.end, previousDays)
                : null,
        [previousDays, range, comparison]
    )

    /** True only when the operator roster has finished loading AND came
     *  back with at least one operator. Lets the Operators page distinguish
     *  "roster failed to load" (empty array after fetch completes) from
     *  "names genuinely don't match" — the unmatched bucket message swaps
     *  between the two so the dispatcher knows which problem to chase. */
    const operatorRosterReady = operatorsEnabled && operatorRoster !== null && !operatorRosterLoading
    const operatorRosterCount = Array.isArray(operatorRoster) ? operatorRoster.length : 0
    return {
        anchor,
        availablePlantCodes,
        comparison,
        currentDays,
        currentRows,
        currentSummary,
        customEnd,
        customStart,
        detailByDay,
        flatOrders,
        isSingleDay,
        loading,
        loadsByOperator,
        operatorRosterCount,
        operatorRosterReady,
        perPlantLoadAttribution,
        perPlantSatisfaction,
        period,
        plansByDate,
        plansLoading,
        previousSatisfactionAggregate,
        previousSummary,
        range,
        satisfactionAggregate,
        satisfactionByDay,
        satisfactionByWeekday,
        satisfactionLoading,
        satisfactionMomentum,
        satisfactionTrend,
        satisfactionWorstCustomers,
        satisfactionWorstOrders,
        selectedPlant,
        setAnchor,
        setComparison,
        setCustomEnd,
        setCustomStart,
        setPeriod,
        setSelectedPlant,
        trendComparison,
        trendData,
        workingDayCount
    }
}

export default usePlanStatistics
