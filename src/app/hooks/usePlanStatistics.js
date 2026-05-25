import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { MixerService } from '../../services/MixerService'
import { OperatorService } from '../../services/OperatorService'
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
    /** Per-day detail-order maps (orderId → ticket data) fetched from the
     *  dispatch storage bucket. Feeds `computeCustomerSatisfaction` so this
     *  page produces the EXACT same score the Schedule tab shows for the
     *  current day. Days with no detail data are scored as null. */
    const [detailByDay, setDetailByDay] = useState({})
    const [satisfactionLoading, setSatisfactionLoading] = useState(false)
    /** Active assigned mixers with operators — fetched once when the Operators
     *  sub-page is first visited so we can cross-reference ticket drivers
     *  against each plant's roster. Stays in memory after first fetch since
     *  the roster rarely changes within a session. */
    const [activeMixers, setActiveMixers] = useState(null)
    const [mixersLoading, setMixersLoading] = useState(false)
    /** Full operator roster — fetched once when the Operators sub-page is
     *  first visited so dispatch ticket drivers (keyed by `driver_num` =
     *  `smyrna_id`) can be resolved to the canonical operator record. The
     *  operator's `name` is what the rest of the app shows (Mixer detail,
     *  Tractor detail, verification modal), so the stats page renders the
     *  same name instead of the raw dispatch HTML driver string. */
    const [operatorRoster, setOperatorRoster] = useState(null)
    const [operatorRosterLoading, setOperatorRosterLoading] = useState(false)
    /** Saved plan rows (with `assignments`) for the active range — only the
     *  Help & Cross-Loading sub-page needs these, since the rest of the
     *  Statistics tab reads ordered/loaded production straight from
     *  `dispatch_data`. Indexed by plan_date so per-day pair groupings can
     *  walk one entry at a time. */
    const [plansByDate, setPlansByDate] = useState({})
    // `plansLoading` is held only as a public-API stub for downstream
    // consumers; the plans fetch now rides on the main `loading` flag
    // since plans + dispatch_data are fetched together in one effect.
    const [plansLoading] = useState(false)

    /* Active-mixer + operator-roster fetches.
     *
     * IMPORTANT: the loading flags (`mixersLoading` / `operatorRosterLoading`)
     * are deliberately NOT in the deps arrays. They get flipped to `true`
     * INSIDE the effect, which would otherwise:
     *   1. Trigger a re-render
     *   2. Re-fire the effect (loading flag changed)
     *   3. Run cleanup on the previous closure → `cancelled = true`
     *   4. Skip the guard (loading is true now), bail out
     *   5. The original fetch completes, hits `if (cancelled) return`, and
     *      NEVER calls `setActiveMixers`/`setOperatorRoster`
     * → both rosters stay null forever, every ticket falls into the
     *   unmatched bucket. We swap to a ref-based guard so the loading
     *   flag is still surfaced to the UI but doesn't participate in the
     *   effect's dep diffing. */
    useEffect(() => {
        if (!operatorsEnabled) return undefined
        if (activeMixers !== null) return undefined
        let cancelled = false
        setMixersLoading(true)
        ;(async () => {
            try {
                const mixers = await MixerService.fetchMixers()
                if (cancelled) return
                const active = (mixers || []).filter(
                    (m) => m && m.status === 'Active' && m.assignedOperator && m.truckNumber
                )
                setActiveMixers(active)
            } catch (err) {
                console.warn('[usePlanStatistics] mixer fetch failed', err?.message || err)
                if (!cancelled) setActiveMixers([])
            } finally {
                if (!cancelled) setMixersLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operatorsEnabled, activeMixers])

    useEffect(() => {
        if (!operatorsEnabled) return undefined
        if (operatorRoster !== null) return undefined
        let cancelled = false
        setOperatorRosterLoading(true)
        ;(async () => {
            try {
                const operators = await OperatorService.getAllOperators()
                if (cancelled) return
                setOperatorRoster(operators || [])
            } catch (err) {
                console.warn('[usePlanStatistics] operator fetch failed', err?.message || err)
                if (!cancelled) setOperatorRoster([])
            } finally {
                if (!cancelled) setOperatorRosterLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [operatorsEnabled, operatorRoster])

    /** Name-based index — operators resolve by canonicalised driver name,
     *  which is the primary link between Jonel ticket data and Tools.
     *  Each operator is registered under several canonical variants so
     *  common Jonel spellings still match. */
    const operatorByNormalizedName = useMemo(() => buildOperatorByNormalizedName(operatorRoster), [operatorRoster])
    const mixerByEmployeeId = useMemo(() => buildMixerByEmployeeId(activeMixers), [activeMixers])
    /** Truck number → assigned-operator employeeId. The primary
     *  disambiguator when two active operators share a name: each is on
     *  their own mixer, so the ticket's `truck_num` plus this map
     *  uniquely identifies which operator drove that load. */
    const mixerByTruckNumber = useMemo(() => buildMixerByTruckNumber(activeMixers), [activeMixers])
    /** UUID → operator record. */
    const operatorByEmployeeId = useMemo(() => buildOperatorByEmployeeId(operatorRoster), [operatorRoster])
    /** Direct lookup: normalized operator name → active mixer assignment.
     *  Lets us resolve home plant even when the smyrnaId / driverNum
     *  chain misses — as long as the ticket's driver name matches an
     *  operator who has an active mixer assigned, we know what plant
     *  they belong to. */
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
                // Populate `plansByDate` from the same fetch — the Help &
                // Cross-Loading sub-page consumes it, and consolidating the
                // fetch avoids a second round-trip.
                const map = {}
                ;(plansCurrent || []).forEach((row) => {
                    if (row?.plan_date) map[row.plan_date] = row
                })
                setPlansByDate(map)
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

    /** Fetch detail-order ticket data for every working day in the current
     *  range whose schedule we already loaded. One chunked range request
     *  rather than N per-date round-trips. */
    useEffect(() => {
        if (
            !satisfactionEnabled &&
            !operatorsEnabled &&
            !helpCrossLoadingEnabled &&
            !plantsEnabled &&
            !serviceEnabled &&
            !kickersEnabled &&
            !ticketLookupEnabled
        )
            return undefined
        const allDays = [...currentDays, ...previousDays]
        if (allDays.length === 0) return undefined
        let cancelled = false
        // Defensive filter: drop empty/falsy plan_dates so a malformed row
        // can't fan out to a request storm.
        const dates = [...new Set(allDays.map((d) => d.planDate).filter(Boolean))].filter((d) => !(d in detailByDay))
        if (dates.length === 0) return undefined
        setSatisfactionLoading(true)
        DispatchDataService.fetchDetailByDateRange(dates, scheduleMetaByDate)
            .then((rangeMap) => {
                if (cancelled) return
                setDetailByDay((prev) => {
                    const next = { ...prev }
                    dates.forEach((date) => {
                        next[date] = rangeMap?.[date] || {}
                    })
                    return next
                })
            })
            .catch((err) => {
                if (!cancelled) console.warn('[usePlanStatistics] satisfaction range fetch failed', err)
            })
            .finally(() => {
                if (!cancelled) setSatisfactionLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [
        currentDays,
        previousDays,
        detailByDay,
        scheduleMetaByDate,
        satisfactionEnabled,
        operatorsEnabled,
        helpCrossLoadingEnabled,
        plantsEnabled,
        serviceEnabled,
        kickersEnabled
    ])

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
