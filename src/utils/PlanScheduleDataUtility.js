/* Pure helpers extracted from `usePlanScheduleData`. Kept hook-free so the
 * orchestrator stays small and these stay easy to reason about / test in
 * isolation. Anything that touches React state belongs in the hook. */

import { formatOrderAddress } from './AddressUtility'
import {
    buildHelpRows,
    buildHelpTransfers,
    clean,
    compareOrders,
    extractCityFromFullAddress,
    getOrderStatus,
    predictScheduleSatisfaction,
    sumField
} from './PlanScheduleUtility'
import {
    computePlantPoolTimeline,
    formatMinutesClock,
    getCalculatedTruckCount,
    getEffectiveBase,
    getMissingOperators,
    isExcludedOrder,
    PLAN_META_KEY,
    poolAtTime,
    timeToMinutes
} from './PlanUtility'

export const composeOrderAddress = (order) => formatOrderAddress(order, ', ')

/** Sum real-pour yardage across a day's `plant_production` object — mirrors
 *  the liveOrders filter (excludes cancelled + test sentinel orders). The
 *  optional `orderPredicate` lets callers reapply the user's active plant /
 *  product / minYards filters so day-over-day comparisons stay apples-to-
 *  apples when the toolbar is filtered. */
export function sumDayYardage(production, orderPredicate) {
    if (!production || typeof production !== 'object') return 0
    let sum = 0
    Object.entries(production).forEach(([code, prod]) => {
        if (code === PLAN_META_KEY) return
        const list = Array.isArray(prod?.orders) ? prod.orders : []
        list.forEach((o) => {
            if (isExcludedOrder(o)) return
            if (orderPredicate && !orderPredicate(o)) return
            sum += parseFloat(o?.yardage) || 0
        })
    })
    return sum
}

/** Fallback city lookup: when an order's city is blank, we use the plant's
 *  city so the map/geocoder still lands near the right area. */
export function buildPlantCityByCode(plantAddressByCode) {
    const out = {}
    Object.entries(plantAddressByCode || {}).forEach(([code, addr]) => {
        const city = extractCityFromFullAddress(addr)
        if (city) out[code] = city
    })
    return out
}

export function buildPlantOptionsForMap(plantAddressByCode, plantNameByCode) {
    const codes = new Set([...Object.keys(plantAddressByCode || {}), ...Object.keys(plantNameByCode || {})])
    return Array.from(codes).map((code) => ({
        address: plantAddressByCode?.[code] || '',
        code,
        name: plantNameByCode?.[code] || ''
    }))
}

/** Flat list of every order with plantCode attached. */
export function flattenPlantOrders(plantProduction) {
    const out = []
    Object.entries(plantProduction || {}).forEach(([code, data]) => {
        if (code === PLAN_META_KEY) return
        if (!Array.isArray(data?.orders)) return
        data.orders.forEach((o) => out.push({ ...o, plantCode: code }))
    })
    return out
}

/** Per-plant pool breakdown — surfaced in the Trucks column tooltip so the
 *  dispatcher can see where a plant's starting number comes from.
 *  `starting` is still the effective count (base − send + recv) because
 *  that's what reads cleanly in the tooltip; actual pool timing is now
 *  driven by help-transfer events elsewhere. */
export function buildPoolSourceByCode(stats, plantProduction, planDate) {
    const out = {}
    ;(stats || []).forEach((s) => {
        if (!s?.code) return
        // Pass the raw roster into getEffectiveBase — the function
        // reapplies the day-of-week multiplier (and Saturday override)
        // itself, so feeding it the already-adjusted `s.base` would
        // double-halve the count on Saturdays.
        const roster = Number.isFinite(s.rawBase) ? s.rawBase : Number.isFinite(s.base) ? s.base : 0
        const missing = getMissingOperators(plantProduction, s.code)
        const base = getEffectiveBase(roster, s.code, plantProduction, planDate)
        const send = Number.isFinite(s.send) ? s.send : 0
        const recv = Number.isFinite(s.recv) ? s.recv : 0
        out[s.code] = { base, missing, rawBase: roster, recv, send, starting: base - send + recv }
    })
    return out
}

/** Effective base operator count per plant — accounts for day-of-week
 *  multiplier, Saturday override, and any missing-operator markers. */
export function buildBaseByPlant(stats, plantProduction, planDate) {
    const out = {}
    ;(stats || []).forEach((s) => {
        if (!s?.code) return
        const roster = Number.isFinite(s.rawBase) ? s.rawBase : Number.isFinite(s.base) ? s.base : 0
        out[s.code] = getEffectiveBase(roster, s.code, plantProduction, planDate)
    })
    return out
}

/** Effective LOCAL truck count per plant (`base − send + recv`). Operator
 *  clock-in rows cap on this so helpers leaving for other plants are
 *  scheduled separately rather than counted into the home staffing ramp. */
export function buildLocalBaseByPlant(poolSourceByCode) {
    const out = {}
    Object.entries(poolSourceByCode).forEach(([code, ps]) => {
        out[code] = Math.max(0, ps.starting ?? ps.base ?? 0)
    })
    return out
}

/** Each plant starts the day with every active assigned mixer physically on
 *  its lot. Outbound help trips subtract from this pool at trip time via the
 *  help-transfer feed, so mid-day pool reflects "trucks at plant right now"
 *  rather than ramping up from zero. */
export function buildInitialPoolByCode(baseByPlant) {
    const out = {}
    Object.entries(baseByPlant).forEach(([code, base]) => {
        out[code] = base
    })
    return out
}

/** Annotate return-direction help rows with the home plant's pool snapshot
 *  at the moment the trucks land back, so the schedule can show
 *  "HELP RETURNING · 406 now has N operators available" instead of just
 *  "+N goes to the home plant". */
export function enrichHelpRowsWithHomePool(helpRows, poolTimelinesByPlant) {
    return helpRows.map((row) => {
        if (row.direction !== 'return') return row
        const home = row.returnPlant || row.fromPlant
        const timeline = poolTimelinesByPlant?.[home]
        if (!Array.isArray(timeline)) return row
        const poolAfter = poolAtTime(timeline, row.time)
        return Number.isFinite(poolAfter) ? { ...row, homePlant: home, poolAfterAtHome: poolAfter } : row
    })
}

/** Status counts (Scheduled / Same-day / Cancelled / Test) for the status filter. */
export function buildStatusCounts(allOrders, isViewingToday) {
    const out = { all: allOrders.length, cancelled: 0, sameDay: 0, scheduled: 0, test: 0 }
    allOrders.forEach((o) => {
        const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind
        if (kind === 'cancelled') out.cancelled += 1
        else if (kind === 'sameDay') out.sameDay += 1
        else if (kind === 'test') out.test += 1
        else out.scheduled += 1
    })
    return out
}

export function buildProductOptions(allOrders) {
    const set = new Set()
    allOrders.forEach((o) => {
        const c = clean(o.productCode)
        if (c) set.add(c)
    })
    return Array.from(set).sort()
}

/** Apply all toolbar filters (status / plant / product / yardage / query) and
 *  sort the result by the active sort key. Pure derivation — the orchestrator
 *  feeds in already-normalised inputs (e.g. `plantFilterSet`). */
export function filterAndSortOrders(allOrders, options) {
    const {
        isViewingToday,
        minYards,
        plantFilterSet,
        productFilter,
        query,
        showCancelled,
        showTest,
        sortKey,
        statusFilter
    } = options
    const q = String(query || '')
        .trim()
        .toLowerCase()
    const minYd = parseFloat(minYards) || 0
    return allOrders
        .filter((o) => {
            if (plantFilterSet.size > 0 && !plantFilterSet.has(o.plantCode)) return false
            const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind || 'scheduled'
            if (kind === 'cancelled' && !showCancelled) return false
            if (kind === 'test' && !showTest) return false
            if (statusFilter !== 'all' && kind !== statusFilter) return false
            if (productFilter !== 'all' && clean(o.productCode) !== productFilter) return false
            if (minYd > 0 && (parseFloat(o.yardage) || 0) < minYd) return false
            if (q) {
                const haystack = [
                    o.orderNum,
                    o.customer,
                    o.customerNum,
                    o.address,
                    o.city,
                    o.productCode,
                    o.description,
                    o.contact,
                    o.phone,
                    o.poNumber,
                    o.jobNumber,
                    o.plantCode
                ]
                    .filter(Boolean)
                    .map((v) => String(v).toLowerCase())
                    .join(' | ')
                if (!haystack.includes(q)) return false
            }
            return true
        })
        .sort((a, b) => compareOrders(a, b, sortKey))
}

/** KPI numbers — non-production rows (cancelled at 17:00, test at 18:00)
 *  stay in the table for transparency but are excluded from yardage / truck
 *  totals. */
export function selectLiveOrders(filteredOrders) {
    return filteredOrders.filter((o) => {
        const kind = getOrderStatus(o.startTime)?.kind
        return kind !== 'cancelled' && kind !== 'test'
    })
}

/** Total real-pour truck count across the live order set, using the
 *  per-order travel overrides for an accurate count. */
export function sumLiveTrucks(liveOrders, getTravelOverrides) {
    return liveOrders.reduce((sum, o) => {
        const n = getCalculatedTruckCount(o, getTravelOverrides ? getTravelOverrides(o) : undefined)
        return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
}

/** Earliest / latest start-time bounds across an order set, formatted as
 *  `HH:MM` strings (or `null` when the set is empty). */
export function computeTimeBounds(liveOrders) {
    const startMinutes = liveOrders.map((o) => timeToMinutes(o.startTime)).filter((t) => t != null)
    if (!startMinutes.length) return { earliestTime: null, latestTime: null }
    return {
        earliestTime: formatMinutesClock(Math.min(...startMinutes)),
        latestTime: formatMinutesClock(Math.max(...startMinutes))
    }
}

/** Count distinct customer names (lowercased, trimmed) across the live order
 *  set. */
export function countUniqueCustomers(liveOrders) {
    return new Set(liveOrders.map((o) => (clean(o.customer) || '').toLowerCase()).filter(Boolean)).size
}

/** Bundle of the toolbar's active-filter signals — whether any filter is
 *  active and how many distinct facets are non-default. Kept together because
 *  the two values share every input. */
export function summarizeActiveFilters(filters) {
    const { minYards, plantFilters, productFilter, query, showCancelled, showTest, statusFilter } = filters
    const minYd = parseFloat(minYards) || 0
    const flags = [
        !!query,
        plantFilters.length > 0,
        statusFilter !== 'all',
        productFilter !== 'all',
        minYd > 0,
        !!showCancelled,
        !!showTest
    ]
    const activeFilterCount = flags.reduce((n, on) => n + (on ? 1 : 0), 0)
    return { activeFilterCount, hasActiveFilters: activeFilterCount > 0 }
}

/** Filtered orders bucketed by plant code, ordered alphabetically — feeds the
 *  per-plant accordion in the schedule view. */
export function groupOrdersByPlant(filteredOrders) {
    const groups = new Map()
    filteredOrders.forEach((o) => {
        if (!groups.has(o.plantCode)) groups.set(o.plantCode, [])
        groups.get(o.plantCode).push(o)
    })
    return Array.from(groups.entries())
        .map(([code, orders]) => ({ code, orders }))
        .sort((a, b) => String(a.code).localeCompare(String(b.code)))
}

/** Build the `getTravelOverrides(order)` lookup used everywhere downstream.
 *  Returns live Google minutes when we have them, otherwise undefined so the
 *  helper falls back to the order's own `toJobTime` field. */
export function makeGetTravelOverrides(getLiveTravelMinutes, plantCityByCode) {
    return (order) => {
        const fallbackCity = clean(order.city) ? '' : plantCityByCode?.[order.plantCode] || ''
        const orderForKey = fallbackCity ? { ...order, city: fallbackCity } : order
        const key = `${order.plantCode}::${composeOrderAddress(orderForKey)}`
        const mins = getLiveTravelMinutes(key)
        if (!Number.isFinite(mins)) return undefined
        return { toJobMin: mins, toPlantMin: mins }
    }
}

/** Live travel-time lookup for ANY plant against an order's job address.
 *  Same key shape as `getTravelOverrides` but parameterised on the loading
 *  plant instead of assuming the order's home plant — used by the Tickets
 *  modal to compute the effective gap between consecutive loads at the JOB
 *  (not at the plant) so cross-plant loads from a closer yard read as a
 *  smaller gap and from a farther yard as a bigger gap. Returns null when no
 *  live measurement is available so callers can degrade gracefully. */
export function makeGetJobTravelMin(getLiveTravelMinutes, plantCityByCode) {
    return (order, loadingPlant) => {
        if (!order || !loadingPlant) return null
        const fallbackCity = clean(order.city) ? '' : plantCityByCode?.[order.plantCode] || ''
        const orderForKey = fallbackCity ? { ...order, city: fallbackCity } : order
        const jobAddr = composeOrderAddress(orderForKey)
        if (!jobAddr) return null
        const mins = getLiveTravelMinutes(`${loadingPlant}::${jobAddr}`)
        return Number.isFinite(mins) ? mins : null
    }
}

/** Canonical orderKey, mirroring what `computePlantPoolTimeline` builds. */
export function keyForOrder(order) {
    if (order.orderId) return order.orderId
    const mins = timeToMinutes(order?.startTime)
    return `${order.plantCode ?? 'unknown'}-${mins}-${order.orderNum ?? ''}`
}

/** Total yardage across the live order set — re-exported helper so the hook
 *  doesn't need to import sumField directly. */
export function sumLiveYards(liveOrders) {
    return sumField(liveOrders, 'yardage')
}

/**
 * Forecast customer satisfaction from a FINALIZED schedule blob — the 5:30 PM
 * `end_of_day` snapshot's `plant_production` — instead of the live, still-
 * changing schedule. Mirrors the future-day pipeline in `usePlanScheduleData`
 * (base pool from the plant fleet, help transfers from the day's assignments,
 * travel falling back to each order's frozen `toJobTime`) and runs the very
 * same `predictScheduleSatisfaction`, so a past day can surface "what we
 * forecast when the schedule was locked" beside its actual ticket-based score.
 *
 * Travel never uses live Google minutes here — those don't apply to a day
 * that's already happened — so the pool simulation reads each order's own
 * dispatch `toJobTime` / `toPlantTime`, exactly as they stood at 5:30 PM.
 *
 * Returns the standard satisfaction envelope tagged `isSnapshot: true`, or
 * null when the blob is empty or yields no scoreable orders.
 *
 * @param {Record<string, any>} plantProduction snapshot `plant_production` blob
 * @param {object} context
 * @param {Array} [context.assignments] current (frozen) planner help assignments
 * @param {object} [context.filters] active schedule filters — keeps the forecast apples-to-apples with the strip
 * @param {Function} [context.getTravelTime] `(fromPlant, toPlant) => minutes` for help-row clock-ins
 * @param {string} context.planDate `YYYY-MM-DD` of the schedule day (drives the Saturday pool multiplier)
 * @param {Array} [context.stats] per-plant insight rows feeding the base pool
 */
export function predictSatisfactionFromPlanProduction(
    plantProduction,
    { assignments = [], filters = {}, getTravelTime, planDate, stats = [] } = {}
) {
    if (!plantProduction || typeof plantProduction !== 'object') return null
    const allOrders = flattenPlantOrders(plantProduction)
    if (allOrders.length === 0) return null

    // Undefined overrides → the pool + prediction helpers fall back to each
    // order's own frozen dispatch travel rather than any live measurement.
    const getTravelOverrides = () => undefined

    const initialPoolByCode = buildInitialPoolByCode(buildBaseByPlant(stats, plantProduction, planDate))
    const helpTransfers = buildHelpTransfers(buildHelpRows(assignments, plantProduction, getTravelTime))
    const poolTimeline = computePlantPoolTimeline(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers)

    const {
        minYards = '',
        plantFilterSet = new Set(),
        productFilter = 'all',
        query = '',
        showCancelled = false,
        showTest = false,
        sortKey,
        statusFilter = 'all'
    } = filters
    const liveOrders = selectLiveOrders(
        filterAndSortOrders(allOrders, {
            isViewingToday: false,
            minYards,
            plantFilterSet,
            productFilter,
            query,
            showCancelled,
            showTest,
            sortKey,
            statusFilter
        })
    )

    const result = predictScheduleSatisfaction({ getTravelOverrides, keyForOrder, liveOrders, poolTimeline })
    return result ? { ...result, isSnapshot: true } : null
}
