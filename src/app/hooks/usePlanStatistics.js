import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { MixerService } from '../../services/MixerService'
import { OperatorService } from '../../services/OperatorService'
import { PlanService } from '../../services/PlanService'
import { parseIsoLocal } from '../../utils/PlanStatisticsFormatUtility'
import {
    aggregateMetrics,
    buildRange,
    computeScheduleMetrics,
    countWorkingDays,
    isoDate,
    isSundayIso,
    listWorkingDaysInRange,
    padTrend
} from '../../utils/PlanStatisticsUtility'
import { computeCustomerSatisfaction, getTodayDate, isExcludedOrder, PLAN_META_KEY } from '../../utils/PlanUtility'
import { formatPersonName } from './useOperatorNameLookup'

/**
 * Walk every plan row once, emitting a flat `{ planDate, plantCode, order }`
 * record for each live order. Used to build per-plant order buckets without
 * re-running `computeScheduleMetrics` for every (row, plant) pair — the
 * old approach was O(days × plants × orders) and crashed the page on big
 * windows. This pass is O(days × orders).
 */
const flattenLiveOrders = (rows) => {
    const out = []
    if (!Array.isArray(rows)) return out
    rows.forEach((row) => {
        const date = row?.plan_date
        if (!date || isSundayIso(date)) return
        const production = row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
        Object.entries(production).forEach(([plantCode, block]) => {
            if (plantCode === PLAN_META_KEY) return
            const orders = Array.isArray(block?.orders) ? block.orders : []
            orders.forEach((o) => {
                if (isExcludedOrder(o)) return
                out.push({ order: o, planDate: date, plantCode })
            })
        })
    })
    return out
}

/** Trailing generation suffix tokens to strip when normalising a name
 *  ("Bobby Johnson JR" → "Bobby Johnson") so a roster entry without the
 *  suffix still matches a Jonel ticket that has one. */
const NAME_SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'])

/** Build every lookup key a person name should match under. Both sides
 *  of the ticket-to-operator match register/lookup through this list so
 *  Jonel-vs-Tools spelling drift resolves without manual intervention:
 *
 *    "SMITH, JOHN"        → ["JOHN SMITH"]                       (comma flipped)
 *    "JOHN A SMITH"       → ["JOHN A SMITH", "JOHN SMITH"]       (middle name optional)
 *    "JOHN SMITH JR."     → ["JOHN SMITH"]                       (suffix + punctuation stripped)
 *    "MARY-ANNE O'BRIEN"  → ["MARY ANNE O BRIEN", ..., "MARYANNE OBRIEN", ...]
 *
 *  Returns `[]` for genuinely empty / single-word strings (e.g. blanks,
 *  "DEFAULT"); those fall straight into the unmatched bucket.
 */
function nameLookupVariants(name) {
    const raw = String(name ?? '').trim()
    if (!raw) return []
    const upper = raw.toUpperCase()
    /* Detect "LAST, FIRST" vs "JOHN SMITH, JR" by what's BEFORE the comma:
     * one token → last-first → flip; multi token → comma is a separator. */
    let flipped = upper
    if (upper.includes(',')) {
        const [head, ...rest] = upper.split(',')
        const headTokens = head.trim().split(/\s+/).filter(Boolean)
        if (headTokens.length === 1) {
            flipped = `${rest.join(',').trim()} ${head.trim()}`
        } else {
            flipped = upper.replace(/,/g, ' ')
        }
    }
    /* Generate keys for two punctuation policies so compound names match
     * whether the punctuation is collapsed ("OBrien") or spaced
     * ("O Brien"). Without both, "Maria O'Brien" never matches
     * "MARIA OBRIEN" on a ticket. */
    const PUNCT_RE = /[.,'\-]/g
    const spacedBody = flipped.replace(PUNCT_RE, ' ').replace(/\s+/g, ' ').trim()
    const collapsedBody = flipped.replace(PUNCT_RE, '').replace(/\s+/g, ' ').trim()
    const tokenize = (body) => {
        const tokens = body.split(' ').filter(Boolean)
        while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
        return tokens
    }
    const keys = new Set()
    ;[spacedBody, collapsedBody].forEach((body) => {
        if (!body) return
        const tokens = tokenize(body)
        if (tokens.length < 2) return
        keys.add(tokens.join(' '))
        if (tokens.length >= 3) {
            keys.add(`${tokens[0]} ${tokens[tokens.length - 1]}`)
        }
    })
    return [...keys]
}

/**
 * Orchestrates every async + derived state slice for `PlanStatisticsView`.
 *
 * Owns the period/comparison/anchor/plant-filter selectors, fetches plan
 * rows for the active range (and its comparison window), derives per-day
 * + period-aggregate schedule metrics, fetches detail-order ticket data
 * for the satisfaction score, and pre-pads trend data for the chart.
 *
 * Pure orchestration — no rendering, no DOM. Returns a flat object that
 * the view destructures into its presentation components.
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
    colocationMap = null
}) {
    const [period, setPeriod] = useState('week')
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
    const [plansLoading, setPlansLoading] = useState(false)

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
     *  common Jonel spellings still match:
     *    - "SMITH, JOHN"          → "JOHN SMITH"          (comma-flipped)
     *    - "JOHN A SMITH"         → also "JOHN SMITH"     (middle dropped)
     *    - "JOHN SMITH JR"        → also "JOHN SMITH"     (suffix dropped)
     *    - "  John  Smith  "      → "JOHN SMITH"          (whitespace collapsed)
     *  Both sides of the match route through `nameLookupVariants`, which
     *  generates the same set of keys for any input, so a ticket whose
     *  `driver_name` matches any registered variant resolves to the
     *  operator record without manual cleanup. */
    const operatorByNormalizedName = useMemo(() => {
        const out = new Map()
        const register = (key, op) => {
            if (!key) return
            const existing = out.get(key)
            /* Prefer Active records on collisions so an inactive namesake
             * doesn't drag the active roster entry out of the lookup. Two
             * truly-active entries with the same canonical key are
             * unresolvable here — first one wins. */
            if (!existing || (existing.status !== 'Active' && op.status === 'Active')) {
                out.set(key, op)
            }
        }
        ;(operatorRoster || []).forEach((op) => {
            const variants = nameLookupVariants(op?.name)
            variants.forEach((variant) => register(variant, op))
        })
        return out
    }, [operatorRoster])

    const mixerByEmployeeId = useMemo(() => {
        const out = new Map()
        ;(activeMixers || []).forEach((m) => {
            const key = String(m.assignedOperator || '').trim()
            if (!key) return
            out.set(key, {
                assignedPlant: String(m.assignedPlant || '').trim() || null,
                employeeId: key,
                truckNumber: String(m.truckNumber || '').trim() || null
            })
        })
        return out
    }, [activeMixers])

    /** Direct lookup: normalized operator name → active mixer assignment.
     *  Built by joining the active-mixer roster against the operator records
     *  by `employeeId` and keying the result by `operator.name`. Lets us
     *  resolve home plant even when the smyrnaId / driverNum chain misses
     *  — as long as the ticket's driver name matches an operator who has
     *  an active mixer assigned, we know what plant they belong to. */
    const activeAssignmentByName = useMemo(() => {
        if (!activeMixers || !operatorRoster) return new Map()
        const opById = new Map()
        operatorRoster.forEach((op) => {
            if (op?.employeeId) opById.set(op.employeeId, op)
        })
        const out = new Map()
        activeMixers.forEach((m) => {
            const op = opById.get(String(m.assignedOperator || '').trim())
            const name = String(op?.name || '')
                .trim()
                .toUpperCase()
            const plant = String(m.assignedPlant || '').trim()
            const truck = String(m.truckNumber || '').trim()
            if (!name || !plant) return
            out.set(name, {
                assignedPlant: plant,
                employeeId: op?.employeeId || null,
                operatorName: op?.name?.trim() || '',
                truckNumber: truck || null
            })
        })
        return out
    }, [activeMixers, operatorRoster])

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
                // Stats read directly from `dispatch_data` — the imported
                // order + ticket rows are the source of truth for yardage,
                // orders, loads, customers, products, and plants. The
                // `plans` table is the dispatcher's saved scheduling state
                // (assignments, notes); it isn't authoritative for raw
                // production counts and isn't required to exist for a
                // given date. `fetchPlanRowsByDateRange` shapes the
                // dispatch_data order headers into the same
                // `{ plan_date, plant_production }` records the rest of
                // this hook expects.
                const currentDates = listWorkingDaysInRange(range.current.start, range.current.end)
                const previousDates = range.previous
                    ? listWorkingDaysInRange(range.previous.start, range.previous.end)
                    : []
                const [fetchedCurrent, fetchedPrevious] = await Promise.all([
                    DispatchDataService.fetchPlanRowsByDateRange(currentDates),
                    previousDates.length
                        ? DispatchDataService.fetchPlanRowsByDateRange(previousDates)
                        : Promise.resolve([])
                ])
                if (cancelled) return
                setCurrentRows(fetchedCurrent || [])
                setPreviousRows(fetchedPrevious || [])
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
    const currentDays = useMemo(() => {
        let mapped = (currentRows || [])
            .map((row) => computeScheduleMetrics(row, selectedPlant))
            .filter((d) => !isSundayIso(d.planDate))
        const hasPlanDateRow = mapped.some((d) => d.planDate === planDate)
        const planDateInRange = planDate && planDate >= range.current.start && planDate <= range.current.end
        if (!hasPlanDateRow && planDateInRange && liveProduction && !isSundayIso(planDate)) {
            const synthetic = computeScheduleMetrics(
                { plan_date: planDate, plant_production: liveProduction },
                selectedPlant
            )
            if (synthetic.totalYardage > 0 || synthetic.totalLoads > 0 || synthetic.totalOrders > 0) {
                mapped = [...mapped, synthetic].sort((a, b) => a.planDate.localeCompare(b.planDate))
            }
        }
        return mapped
    }, [currentRows, selectedPlant, planDate, liveProduction, range])

    const previousDays = useMemo(
        () =>
            (previousRows || [])
                .map((row) => computeScheduleMetrics(row, selectedPlant))
                .filter((d) => !isSundayIso(d.planDate)),
        [previousRows, selectedPlant]
    )

    /** Distinct plant codes present in the loaded window (not the global
     *  plant directory). Sorted alphabetically. The selected plant is kept
     *  in the list even if the new range has no rows for it so the dropdown
     *  still shows what's currently filtered. */
    const availablePlantCodes = useMemo(() => {
        const codes = new Set()
        ;(currentRows || []).forEach((row) => {
            const production =
                row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
            Object.keys(production).forEach((code) => {
                if (code !== PLAN_META_KEY) codes.add(code)
            })
        })
        if (selectedPlant) codes.add(selectedPlant)
        return [...codes].sort()
    }, [currentRows, selectedPlant])

    /** Fetch detail-order ticket data for every working day in the current
     *  range whose schedule we already loaded. Per-day fetches run in
     *  parallel; cached entries are skipped so changing window/comparison
     *  doesn't redo work. The bucket only retains a few weeks of history
     *  reliably — older days will return empty maps and silently drop out
     *  of the satisfaction score (as expected). */
    useEffect(() => {
        if (!satisfactionEnabled && !operatorsEnabled && !helpCrossLoadingEnabled && !plantsEnabled) return undefined
        const allDays = [...currentDays, ...previousDays]
        if (allDays.length === 0) return undefined
        let cancelled = false
        // Defensive filter: drop empty/falsy plan_dates so a malformed row
        // can't fan out to a request storm.
        const dates = [...new Set(allDays.map((d) => d.planDate).filter(Boolean))].filter((d) => !(d in detailByDay))
        if (dates.length === 0) return undefined
        setSatisfactionLoading(true)
        // ONE chunked range request instead of N per-date round-trips. For a
        // year window this drops from ~313 fetches to ~11. Empty entries
        // come back keyed by date so re-renders don't re-fetch them.
        DispatchDataService.fetchDetailByDateRange(dates)
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
        satisfactionEnabled,
        operatorsEnabled,
        helpCrossLoadingEnabled,
        plantsEnabled
    ])

    /** Saved-plan fetch — only fires when the Help & Cross-Loading
     *  sub-page is mounted. Pulls every plan whose date falls in the
     *  active range so the page can read `assignments` for planned-help
     *  metrics. Range covers the current window only; comparison-window
     *  plans aren't needed since this page doesn't surface deltas. */
    useEffect(() => {
        if (!helpCrossLoadingEnabled) return undefined
        const startIso = range?.current?.start
        const endIso = range?.current?.end
        if (!startIso || !endIso) return undefined
        let cancelled = false
        setPlansLoading(true)
        PlanService.fetchPlansInRange(startIso, endIso)
            .then((rows) => {
                if (cancelled) return
                const map = {}
                ;(rows || []).forEach((row) => {
                    if (row?.plan_date) map[row.plan_date] = row
                })
                setPlansByDate(map)
            })
            .catch((err) => {
                if (!cancelled) console.warn('[usePlanStatistics] plans fetch failed', err?.message || err)
            })
            .finally(() => {
                if (!cancelled) setPlansLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [helpCrossLoadingEnabled, range])

    /** Flat list of every live order in the active window, tagged with its
     *  plant + date. Built ONCE so per-plant memos can bucket without
     *  re-walking rows or calling `computeScheduleMetrics`. Always covers
     *  all plants — the plant comparison chart needs the unfiltered set. */
    const flatOrders = useMemo(
        () => (satisfactionEnabled || helpCrossLoadingEnabled || plantsEnabled ? flattenLiveOrders(currentRows) : []),
        [currentRows, satisfactionEnabled, helpCrossLoadingEnabled, plantsEnabled]
    )

    /** Merged detail map across every loaded date — built once and reused
     *  by every aggregate. `computeCustomerSatisfaction` looks orders up by
     *  orderId so the keys are flat across dates. */
    const mergedDetail = useMemo(() => {
        if (!satisfactionEnabled && !plantsEnabled) return {}
        const out = {}
        Object.values(detailByDay).forEach((map) => {
            if (!map) return
            Object.entries(map).forEach(([orderId, entry]) => {
                out[orderId] = entry
            })
        })
        return out
    }, [detailByDay, satisfactionEnabled, plantsEnabled])

    /** Per-plant load attribution — splits each plant's slice into:
     *
     *    ordered     = sum of order yardage where this plant is the home plant
     *                  (ie. the plant that owns / scheduled the order). Pulled
     *                  from the schedule HTML, not from tickets — represents
     *                  the demand assigned to this plant.
     *    loaded      = sum of TICKET yardage for those same orders, regardless
     *                  of which plant actually loaded the truck. This is what
     *                  the customer ultimately got delivered toward this
     *                  plant's orders.
     *    selfLoaded  = ticket yardage where the loading plant matches the
     *                  order's home plant.
     *    crossInYards = loaded − selfLoaded. Help RECEIVED — sibling plants
     *                  loaded these trucks for this plant's orders.
     *    crossOutYards = ticket yardage where this plant LOADED a truck for
     *                  another plant's order. Help GIVEN.
     *
     *  Plant codes are normalised through `colocationMap.resolvePrimary` so
     *  loads between sibling-site aliases (e.g. 404 → 401) collapse to the
     *  same physical plant and aren't miscounted as cross-loaded. Source of
     *  truth for the home plant is the `flatOrders` wrapper — the raw order
     *  objects don't carry their plant code as a field. */
    const perPlantLoadAttribution = useMemo(() => {
        const resolvePrimary =
            typeof colocationMap?.resolvePrimary === 'function' ? colocationMap.resolvePrimary : (code) => code
        const out = {}
        const getEntry = (code) => {
            if (!out[code]) {
                out[code] = {
                    code,
                    crossInYards: 0,
                    crossOutYards: 0,
                    loaded: 0,
                    ordered: 0,
                    selfLoaded: 0
                }
            }
            return out[code]
        }
        const hasDetail = Object.keys(mergedDetail).length > 0
        flatOrders.forEach(({ order, plantCode }) => {
            const homePlant = resolvePrimary(plantCode)
            if (!homePlant) return
            getEntry(homePlant).ordered += parseFloat(order?.yardage) || 0
            if (!hasDetail || !order?.orderId) return
            const detail = mergedDetail[order.orderId]
            if (!detail || typeof detail.byPlant !== 'object') return
            Object.entries(detail.byPlant).forEach(([rawLoaderPlant, slice]) => {
                const loadedYards = parseFloat(slice?.loadedYardage) || 0
                if (loadedYards <= 0) return
                const loaderPlant = resolvePrimary(rawLoaderPlant)
                const home = getEntry(homePlant)
                home.loaded += loadedYards
                if (loaderPlant === homePlant) {
                    home.selfLoaded += loadedYards
                } else {
                    home.crossInYards += loadedYards
                    getEntry(loaderPlant).crossOutYards += loadedYards
                }
            })
        })
        return out
    }, [flatOrders, mergedDetail, colocationMap])

    /** Per-day satisfaction. Walks each day's orders ONCE, hits the shared
     *  detail map. Null entries mean we have no ticket data for that day. */
    const satisfactionByDay = useMemo(() => {
        if (!satisfactionEnabled) return {}
        const out = {}
        currentDays.forEach((d) => {
            const detail = detailByDay[d.planDate]
            if (!detail) {
                out[d.planDate] = null
                return
            }
            out[d.planDate] = computeCustomerSatisfaction(d.allLiveOrders || [], detail)
        })
        return out
    }, [currentDays, detailByDay, satisfactionEnabled])

    /** Period-aggregated satisfaction — single call across the entire
     *  active window, using each day's plant-filtered allLiveOrders so
     *  the aggregate respects `selectedPlant`. */
    const satisfactionAggregate = useMemo(() => {
        if (!satisfactionEnabled || !currentDays.length) return null
        const orders = []
        currentDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
        if (!orders.length) return null
        return computeCustomerSatisfaction(orders, mergedDetail)
    }, [currentDays, mergedDetail, satisfactionEnabled])

    /** Same shape, computed against the comparison window. Also respects
     *  the active plant filter via `previousDays`. */
    const previousSatisfactionAggregate = useMemo(() => {
        if (!satisfactionEnabled || comparison === 'none') return null
        if (!previousDays.length) return null
        const orders = []
        previousDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
        if (!orders.length) return null
        return computeCustomerSatisfaction(orders, mergedDetail)
    }, [previousDays, mergedDetail, comparison, satisfactionEnabled])

    /** Per-day satisfaction trend across the entire active range, padded so
     *  missing days show as gaps in the chart instead of compressing the
     *  X axis. Each entry carries:
     *    - `score` — that day's good-rate (binary good/bad, can be 0/100)
     *    - `rollingScore` — trailing 7-working-day good-rate (smoother
     *      signal that doesn't whiplash on tiny sample sizes)
     *    - `samples` / `goodService` / `badService` — raw counts the chart
     *      tooltip surfaces
     *
     *  The cursor walk uses `parseIsoLocal` instead of `new Date(iso)` so
     *  the loop actually advances in negative-UTC timezones (a string ISO
     *  date parsed by `new Date` is interpreted as UTC midnight, which
     *  rolls back a day in local time on the western hemisphere — the
     *  previous walk got stuck on `range.current.start`). */
    const satisfactionTrend = useMemo(() => {
        if (!satisfactionEnabled) return []
        if (!currentDays.length) return []
        const cursor = parseIsoLocal(range.current.start)
        const endDate = parseIsoLocal(range.current.end)
        if (!cursor || !endDate) return []

        const dayByDate = new Map(currentDays.map((d) => [d.planDate, d]))

        // Phase 1: walk every working day in range, scoring each individually.
        const dailyStats = []
        let safety = 366 * 5
        while (cursor <= endDate && safety > 0) {
            if (cursor.getDay() !== 0) {
                const iso = isoDate(cursor)
                const day = dayByDate.get(iso) || null
                const detail = detailByDay[iso]
                const result = day && detail ? computeCustomerSatisfaction(day.allLiveOrders || [], detail) : null
                dailyStats.push({
                    badService: result ? result.badService : 0,
                    date: iso,
                    goodService: result ? result.goodService : 0,
                    samples: result ? result.samples : 0,
                    score: result ? Math.round(result.score * 100) : null
                })
            }
            cursor.setDate(cursor.getDate() + 1)
            safety -= 1
        }

        // Phase 2: stamp each row with the trailing 7-working-day good-rate
        // so the chart can render a smooth secondary line. Same totals,
        // just summed across the rolling window — much more stable than
        // single-day binary scores when a day only has a couple orders.
        return dailyStats.map((stat, idx) => {
            const sliceStart = Math.max(0, idx - 6)
            let rollingGood = 0
            let rollingSamples = 0
            for (let i = sliceStart; i <= idx; i += 1) {
                rollingGood += dailyStats[i].goodService
                rollingSamples += dailyStats[i].samples
            }
            return {
                ...stat,
                rollingSamples,
                rollingScore: rollingSamples > 0 ? Math.round((rollingGood / rollingSamples) * 100) : null
            }
        })
    }, [currentDays, detailByDay, satisfactionEnabled, range])

    /** ISO date midway through the active window — used to split each
     *  plant's order set into "first half" vs "second half" so we can show
     *  whether each plant is improving / declining within the period. */
    const windowMidpointIso = useMemo(() => {
        if (!range?.current?.start || !range?.current?.end) return null
        const start = new Date(`${range.current.start}T00:00:00`)
        const end = new Date(`${range.current.end}T00:00:00`)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
        return isoDate(new Date((start.getTime() + end.getTime()) / 2))
    }, [range])

    /** Per-plant satisfaction with first-half vs second-half trajectory.
     *  Single pass over `flatOrders` to bucket by plant + half, then one
     *  satisfaction calc per plant + per-half. Includes a "trajectory" tag
     *  ("improving" / "declining" / "stable") + the delta in points so the
     *  redesigned page can render an arrow next to each plant card. */
    const perPlantSatisfaction = useMemo(() => {
        if (!satisfactionEnabled) return []
        if (!flatOrders.length) return []
        const byPlant = new Map()
        flatOrders.forEach(({ order, plantCode, planDate }) => {
            if (!byPlant.has(plantCode)) {
                byPlant.set(plantCode, { firstHalf: [], orders: [], secondHalf: [], yardage: 0 })
            }
            const bucket = byPlant.get(plantCode)
            bucket.orders.push(order)
            bucket.yardage += parseFloat(order?.yardage) || 0
            if (windowMidpointIso && planDate < windowMidpointIso) bucket.firstHalf.push(order)
            else bucket.secondHalf.push(order)
        })
        const out = []
        byPlant.forEach((entry, code) => {
            const aggregate = computeCustomerSatisfaction(entry.orders, mergedDetail)
            if (!aggregate) return
            const first = entry.firstHalf.length ? computeCustomerSatisfaction(entry.firstHalf, mergedDetail) : null
            const second = entry.secondHalf.length ? computeCustomerSatisfaction(entry.secondHalf, mergedDetail) : null
            const delta = first && second ? Math.round(second.score * 100) - Math.round(first.score * 100) : null
            const trajectory = delta == null ? 'stable' : delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable'
            out.push({
                badService: aggregate.badService,
                code,
                delta,
                goodService: aggregate.goodService,
                samples: aggregate.samples,
                score: Math.round(aggregate.score * 100),
                trajectory,
                yardage: Math.round(entry.yardage)
            })
        })
        return out.sort((a, b) => a.score - b.score)
    }, [flatOrders, mergedDetail, windowMidpointIso, satisfactionEnabled])

    /** Day-of-week satisfaction breakdown — average score Mon–Sat across
     *  the active window. */
    const satisfactionByWeekday = useMemo(() => {
        if (!satisfactionEnabled) return []
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const buckets = labels.map((label) => ({ count: 0, label, samples: 0, scoreSum: 0 }))
        currentDays.forEach((d) => {
            const detail = detailByDay[d.planDate]
            if (!detail) return
            const result = computeCustomerSatisfaction(d.allLiveOrders || [], detail)
            if (!result) return
            const date = d.planDate ? new Date(`${d.planDate}T00:00:00`) : null
            if (!date || Number.isNaN(date.getTime())) return
            const dow = date.getDay() // 0 Sun … 6 Sat
            if (dow === 0) return
            const bucket = buckets[dow - 1]
            bucket.scoreSum += result.score * 100
            bucket.count += 1
            bucket.samples += result.samples
        })
        return buckets.map((b) => ({
            label: b.label,
            samples: b.samples,
            score: b.count > 0 ? Math.round(b.scoreSum / b.count) : null
        }))
    }, [currentDays, detailByDay, satisfactionEnabled])

    /** Per-order scored list — the hottest single pass on the page. Used by
     *  worst-orders, worst-customers, and the score-distribution histogram.
     *  Filters by `selectedPlant` when active. */
    const scoredOrders = useMemo(() => {
        if (!satisfactionEnabled || !flatOrders.length) return []
        const out = []
        flatOrders.forEach(({ order, plantCode, planDate: orderDate }) => {
            if (selectedPlant && plantCode !== selectedPlant) return
            const detail = order?.orderId ? mergedDetail[order.orderId] : null
            const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
            if (!tickets.length) return
            const result = computeCustomerSatisfaction([order], { [order.orderId]: detail })
            if (!result || result.samples === 0) return
            out.push({
                customer: (order.customer || '').trim() || 'Unknown',
                isBad: result.badService > 0,
                orderNum: order.orderNum || '',
                planDate: orderDate,
                plantCode,
                productCode: (order.productCode || '').trim() || '',
                score: Math.round(result.score * 100),
                yardage: parseFloat(order.yardage) || 0
            })
        })
        return out
    }, [flatOrders, mergedDetail, selectedPlant, satisfactionEnabled])

    /** Bad orders surfaced for follow-up — every order flagged "bad" by
     *  the shared late-or-slow rule, sorted by yardage desc so the largest
     *  pours float to the top. The list is now a strict good/bad split,
     *  not a weighted ranking. */
    const satisfactionWorstOrders = useMemo(
        () =>
            scoredOrders
                .filter((row) => row.isBad)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, 8),
        [scoredOrders]
    )

    /** Customers with any bad service in the window. Each row is the count
     *  + yardage of bad orders for that customer; surfaced only when the
     *  customer has at least one bad order. */
    const satisfactionWorstCustomers = useMemo(() => {
        if (!scoredOrders.length) return []
        const byCustomer = new Map()
        scoredOrders.forEach((row) => {
            if (!byCustomer.has(row.customer)) {
                byCustomer.set(row.customer, {
                    badOrders: 0,
                    customer: row.customer,
                    samples: 0,
                    yardage: 0
                })
            }
            const bucket = byCustomer.get(row.customer)
            bucket.samples += 1
            if (row.isBad) {
                bucket.badOrders += 1
                bucket.yardage += row.yardage
            }
        })
        const out = []
        byCustomer.forEach((entry) => {
            if (entry.badOrders === 0) return
            out.push({
                badOrders: entry.badOrders,
                customer: entry.customer,
                samples: entry.samples,
                yardage: Math.round(entry.yardage)
            })
        })
        return out.sort((a, b) => b.badOrders - a.badOrders || b.yardage - a.yardage).slice(0, 6)
    }, [scoredOrders])

    /** Momentum — last 7 working days inside the window vs the 7 before
     *  that, so the user can see whether things are heading the right way
     *  even on a long period. Returns null when the window is too short. */
    const satisfactionMomentum = useMemo(() => {
        if (!satisfactionEnabled || !currentDays.length) return null
        const sorted = [...currentDays].sort((a, b) => (a.planDate || '').localeCompare(b.planDate || ''))
        if (sorted.length < 4) return null
        const recent = sorted.slice(-7)
        const prior = sorted.slice(-14, -7)
        const collectOrders = (days) => {
            const out = []
            days.forEach((d) => (d.allLiveOrders || []).forEach((o) => out.push(o)))
            return out
        }
        const recentResult = computeCustomerSatisfaction(collectOrders(recent), mergedDetail)
        const priorResult = computeCustomerSatisfaction(collectOrders(prior), mergedDetail)
        if (!recentResult && !priorResult) return null
        const recentScore = recentResult ? Math.round(recentResult.score * 100) : null
        const priorScore = priorResult ? Math.round(priorResult.score * 100) : null
        const delta = recentScore != null && priorScore != null ? recentScore - priorScore : null
        return {
            delta,
            prior: priorResult ? { samples: priorResult.samples, score: priorScore } : { samples: 0, score: null },
            recent: recentResult ? { samples: recentResult.samples, score: recentScore } : { samples: 0, score: null },
            trajectory: delta == null ? 'stable' : delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable'
        }
    }, [currentDays, mergedDetail, satisfactionEnabled])

    /** Per-operator load tally across the active window — walks every ticket
     *  in `detailByDay` (filtered to dates inside the current range), groups
     *  by driver, counts loads + sums confirmed yardage, and tracks the set
     *  of trucks driven + plants loaded so the page can flag mismatches
     *  against each plant's assigned-active mixer roster.
     *
     *  Plant filter (`selectedPlant`) scopes by **home plant**: we show
     *  every operator whose assigned mixer (or operator-record plant)
     *  belongs to the selected plant, and we count ALL their loads — even
     *  ones run at other plants. Cross-plant work then surfaces as
     *  non-home plant chips on the row plus a `wrongPlant` flag. Skips
     *  work unless the Operators page is actually mounted.
     *
     *  Each ticket's driver is resolved through the canonical operator
     *  roster (`driver_num` → `operator.smyrna_id` → `operator`) so the
     *  displayed name matches Mixer / Tractor / Verification screens, and
     *  the mixer cross-reference uses the operator's UUID `employee_id`
     *  (the foreign key on `mixer.assigned_operator`). */
    const loadsByOperator = useMemo(() => {
        if (!operatorsEnabled) return []
        const startIso = range?.current?.start
        const endIso = range?.current?.end
        if (!startIso || !endIso) return []
        const byOperator = new Map()
        /* Every ticket whose driver name doesn't resolve to an operator
         * record gets collapsed here. Per the operations team this is
         * almost always a Jonel-↔-Tools spelling mismatch (a driver
         * created on the dispatch side with a slightly different name,
         * or a ticket carrying a stale "DEFAULT, DEFAULT" placeholder).
         * Bundling them into ONE row instead of N "Unassigned" rows
         * keeps the table honest about which loads are unverifiable
         * AND points the dispatcher at the root cause. */
        const unmatchedBucket = {
            driverNum: null,
            employeeId: null,
            key: '__unmatched__',
            loads: 0,
            loadsByPlant: new Map(),
            name: 'Unmatched drivers',
            operatorHomePlant: null,
            operatorStatus: null,
            sampleNames: new Set(),
            trucksDriven: new Set(),
            unmatched: true,
            yardage: 0
        }
        Object.entries(detailByDay).forEach(([dayIso, dayMap]) => {
            if (!dayMap) return
            if (dayIso < startIso || dayIso > endIso) return
            Object.values(dayMap).forEach((detail) => {
                const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
                tickets.forEach((ticket) => {
                    const loaderPlant = (ticket?.plantId || '').toString().trim()
                    const rawName = (ticket?.driverName || '').toString().trim()
                    const driverNum = (ticket?.driverNum || '').toString().trim()
                    const truckNum = (ticket?.truckNum || '').toString().trim()
                    /* Match the ticket's `driver_name` against the operator
                     * roster by canonicalised name. Names are the only link
                     * between Jonel ticket data and the Tools operator
                     * records — we deliberately do NOT look at the
                     * dispatch `driver_num` column, which is a Jonel-side
                     * identifier the operator records don't carry.
                     *
                     * Lookup tries ALL variants of the ticket name (full
                     * canonical + first+last short key) so the match
                     * succeeds whichever side carries the middle name. A
                     * roster entry of "Bobby Johnson" matches a ticket
                     * reading "BOBBY A JOHNSON" because the ticket's short
                     * variant is "BOBBY JOHNSON" — the registered key. */
                    const nameVariants = nameLookupVariants(rawName)
                    let operator = null
                    for (const variant of nameVariants) {
                        const hit = operatorByNormalizedName.get(variant)
                        if (hit) {
                            operator = hit
                            break
                        }
                    }
                    const yardage = parseFloat(ticket?._confirmedQuantity) || parseFloat(ticket?.quantity) || 0
                    /* No operator record — collapse into the single
                     * unmatched bucket so dispatchers see ONE row labelled
                     * with the root cause instead of N anonymous "Driver #..."
                     * rows. The bucket still aggregates loads, yardage,
                     * trucks, and load-plants so the impact is visible. */
                    if (!operator) {
                        unmatchedBucket.loads += 1
                        unmatchedBucket.yardage += yardage
                        if (truckNum) unmatchedBucket.trucksDriven.add(truckNum)
                        if (loaderPlant) {
                            unmatchedBucket.loadsByPlant.set(
                                loaderPlant,
                                (unmatchedBucket.loadsByPlant.get(loaderPlant) || 0) + 1
                            )
                        }
                        const sampleLabel = rawName || (driverNum ? `Driver #${driverNum}` : 'Unknown')
                        if (sampleLabel && unmatchedBucket.sampleNames.size < 12) {
                            unmatchedBucket.sampleNames.add(sampleLabel)
                        }
                        return
                    }
                    const canonicalName = operator.name?.trim() || rawName
                    const name = formatPersonName(canonicalName)
                    /* Operator's UUID dedupes two spellings of the same
                     * driver into one row — that's the whole point of
                     * normalising through the operator record first. */
                    const fallbackKeySource = nameVariants[0] || rawName.toUpperCase()
                    const key = operator.employeeId || `op:${fallbackKeySource}`
                    if (!byOperator.has(key)) {
                        byOperator.set(key, {
                            driverNum: driverNum || null,
                            employeeId: operator.employeeId || null,
                            key,
                            loads: 0,
                            loadsByPlant: new Map(),
                            name,
                            operatorHomePlant: operator.plantCode || null,
                            operatorStatus: operator.status || null,
                            trucksDriven: new Set(),
                            unmatched: false,
                            yardage: 0
                        })
                    }
                    const entry = byOperator.get(key)
                    entry.loads += 1
                    entry.yardage += yardage
                    if (truckNum) entry.trucksDriven.add(truckNum)
                    if (loaderPlant) {
                        entry.loadsByPlant.set(loaderPlant, (entry.loadsByPlant.get(loaderPlant) || 0) + 1)
                    }
                })
            })
        })
        /* Sample names get materialised here so the consumer sees a plain
         * sorted array rather than a Set + insertion order. */
        if (unmatchedBucket.loads > 0) {
            byOperator.set('__unmatched__', {
                ...unmatchedBucket,
                sampleNames: [...unmatchedBucket.sampleNames].sort()
            })
        }
        /** Mismatch classifier — runs only after BOTH the operator roster
         *  and the active-mixer roster have loaded so we don't flash false
         *  "unassigned" badges on every row during the initial fetch. */
        const rosterReady = activeMixers !== null && operatorRoster !== null
        return (
            [...byOperator.values()]
                .map((entry) => {
                    const trucksDriven = [...entry.trucksDriven].sort()
                    /* Per-plant load counts sorted by loads desc, then plant code
                     * — gives the row a stable "busiest plant first" reading
                     * order and lets the wrong-plant check use a plain Set. */
                    const plantLoads = [...entry.loadsByPlant.entries()]
                        .map(([plant, loads]) => ({ loads, plant }))
                        .sort((a, b) => b.loads - a.loads || a.plant.localeCompare(b.plant))
                    const plantsLoaded = plantLoads.map((p) => p.plant)
                    /* The synthetic unmatched bucket carries pre-aggregated
                     * load / yardage data but no operator-record link, so
                     * roster-derived columns (assigned plant, assigned truck,
                     * mismatch flags) don't apply. Return it untouched so the
                     * UI can render it with the dedicated unmatched layout. */
                    if (entry.unmatched) {
                        return {
                            ...entry,
                            assignedPlant: null,
                            assignedTruck: null,
                            homePlant: null,
                            mismatches: [],
                            plantLoads,
                            plantsLoaded,
                            trucksDriven
                        }
                    }
                    /* Active-mixer lookup with a name fallback. The
                     * primary key is `operator.employeeId` (when the
                     * smyrnaId or operator-record bridge produced one);
                     * if that misses, we look the operator up directly by
                     * their dispatch name against the active-mixer roster.
                     * This double-bridge means a row resolves to a home
                     * plant as long as the operator is on ANY active
                     * mixer — even when DB id fields are sparse. */
                    const fromMixerId = entry.employeeId ? mixerByEmployeeId.get(entry.employeeId) : null
                    const normalizedNameForLookup = String(entry.name || '')
                        .trim()
                        .toUpperCase()
                    const fromMixerName = normalizedNameForLookup
                        ? activeAssignmentByName.get(normalizedNameForLookup)
                        : null
                    const assigned = fromMixerId || fromMixerName || null
                    /* `homePlant` is the plant on this operator's ACTIVE
                     * MIXER assignment — that's the dispatch roster the rest
                     * of the app treats as the active-operators list. The
                     * operator-record `plant_code` field is the secondary
                     * fallback for spare drivers without a fixed mixer.
                     * Drivers we couldn't link by name fall into the
                     * unmatched bucket above instead of carrying a guessed
                     * plant here — operators aren't "assigned" to a plant
                     * by where they happened to load. */
                    const homePlant = assigned?.assignedPlant || entry.operatorHomePlant || null
                    const mismatches = []
                    /* Multi-truck is its own offense — we can detect it from
                     * tickets alone, no roster lookup needed. Render it as
                     * soon as the data is in so the badge doesn't disappear
                     * while waiting on the mixer/operator fetches. */
                    if (trucksDriven.length > 1) mismatches.push('multiTruck')
                    if (rosterReady) {
                        if (!assigned) {
                            mismatches.push('unassigned')
                        } else {
                            if (
                                assigned.truckNumber &&
                                trucksDriven.length > 0 &&
                                !trucksDriven.includes(assigned.truckNumber)
                            ) {
                                mismatches.push('wrongTruck')
                            }
                            if (
                                assigned.assignedPlant &&
                                plantsLoaded.length > 0 &&
                                !plantsLoaded.includes(assigned.assignedPlant)
                            ) {
                                mismatches.push('wrongPlant')
                            }
                        }
                    }
                    return {
                        ...entry,
                        assignedPlant: homePlant,
                        assignedTruck: assigned?.truckNumber || null,
                        homePlant,
                        mismatches,
                        plantLoads,
                        plantsLoaded,
                        trucksDriven
                    }
                })
                /* Plant filter — match the rest of the Statistics tab,
                 * which scopes by WHERE THE WORK HAPPENED, not by an
                 * inferred roster relationship. A driver appears under
                 * plant X's filter when either:
                 *   - They loaded at least one ticket at plant X
                 *     (the same load-plant semantics the yardage,
                 *     satisfaction, and YPH sub-pages already use)
                 *   - OR their active-mixer home plant is X (keeps
                 *     assigned drivers visible even on a day they
                 *     didn't drive)
                 * The previous "home-plant only" rule silently dropped
                 * every driver whose smyrna_id / name / mixer link had
                 * any gap — which is most drivers in practice — so
                 * any plant filter returned an empty list. Cross-plant
                 * work still surfaces via the existing `wrongPlant`
                 * flag on the row. */
                .filter((row) => {
                    if (!selectedPlant) return true
                    const target = String(selectedPlant).trim()
                    if (!target) return true
                    const loadedAtTarget = (row.plantsLoaded || []).some((code) => String(code).trim() === target)
                    if (loadedAtTarget) return true
                    if (row.homePlant && String(row.homePlant).trim() === target) return true
                    return false
                })
                /* Unmatched bucket sorts to the very bottom regardless of
                 * load count — it's a quality-of-data row, not part of
                 * the per-driver ranking. */
                .sort((a, b) => {
                    if (a.unmatched && !b.unmatched) return 1
                    if (!a.unmatched && b.unmatched) return -1
                    return b.loads - a.loads || b.yardage - a.yardage
                })
        )
    }, [
        detailByDay,
        operatorsEnabled,
        range,
        selectedPlant,
        activeMixers,
        operatorRoster,
        operatorByNormalizedName,
        mixerByEmployeeId,
        activeAssignmentByName
    ])

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
