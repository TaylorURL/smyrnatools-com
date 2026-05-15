import { useCallback, useMemo } from 'react'

import { formatOrderAddress } from '../../utils/AddressUtility'
import {
    applyLoadingPlantReassignment,
    buildHelpRows,
    buildHelpTransfers,
    clean,
    compareOrders,
    evaluateScheduleSatisfaction,
    extractCityFromFullAddress,
    getFirstLoadOutByPlant,
    getOrderStatus,
    predictScheduleSatisfaction,
    sumField
} from '../../utils/PlanScheduleUtility'
import {
    computeClockInRows,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computePullUpRows,
    computeSendHomeRows,
    computeSuggestedSlots,
    formatMinutesClock,
    getCalculatedTruckCount,
    getEffectiveBase,
    getMissingOperators,
    getPoolDayMultiplier,
    getTodayDate,
    isClosedDay,
    isExcludedOrder,
    PLAN_META_KEY,
    timeToMinutes
} from '../../utils/PlanUtility'
import useCloserPlantLookup from './useCloserPlantLookup'
import useLiveMinuteOfDay from './useLiveMinuteOfDay'
import useLiveTravelTimes from './useLiveTravelTimes'
import usePlanTravelPairs from './usePlanTravelPairs'

const composeAddress = (order) => formatOrderAddress(order, ', ')

/** Sum real-pour yardage across a day's `plant_production` object — mirrors
 *  the liveOrders filter (excludes cancelled + test sentinel orders). The
 *  optional `orderPredicate` lets callers reapply the user's active plant /
 *  product / minYards filters so day-over-day comparisons stay apples-to-
 *  apples when the toolbar is filtered. */
const sumDayYardage = (production, orderPredicate) => {
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

    /** Fallback city lookup: when an order's city is blank, we use the plant's
     *  city so the map/geocoder still lands near the right area. */
    const plantCityByCode = useMemo(() => {
        const out = {}
        Object.entries(plantAddressByCode || {}).forEach(([code, addr]) => {
            const city = extractCityFromFullAddress(addr)
            if (city) out[code] = city
        })
        return out
    }, [plantAddressByCode])

    const plantOptionsForMap = useMemo(() => {
        const codes = new Set([...Object.keys(plantAddressByCode || {}), ...Object.keys(plantNameByCode || {})])
        return Array.from(codes).map((code) => ({
            address: plantAddressByCode?.[code] || '',
            code,
            name: plantNameByCode?.[code] || ''
        }))
    }, [plantAddressByCode, plantNameByCode])

    /** Array of selected plant codes — empty means "all plants". Memoised
     *  so deps that depend on it stay stable when nothing changed. */
    const plantFilters = useMemo(() => (Array.isArray(plantFiltersRaw) ? plantFiltersRaw : []), [plantFiltersRaw])
    const plantFilterSet = useMemo(() => new Set(plantFilters), [plantFilters])
    /** When exactly one plant is selected, "single-plant" affordances
     *  (copy roster, extras toggle, plant-scope chip, pool-aware
     *  computations) light up. With zero or 2+ plants picked, those
     *  features stay disabled — they don't have a single subject. */
    const singlePlant = plantFilters.length === 1 ? plantFilters[0] : null

    /** Flat list of every order with plantCode attached. */
    const allOrders = useMemo(() => {
        const out = []
        Object.entries(plantProduction || {}).forEach(([code, data]) => {
            if (code === PLAN_META_KEY) return
            if (!Array.isArray(data?.orders)) return
            data.orders.forEach((o) => out.push({ ...o, plantCode: code }))
        })
        return out
    }, [plantProduction])

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
    const getTravelOverrides = useCallback(
        (order) => {
            const fallbackCity = clean(order.city) ? '' : plantCityByCode?.[order.plantCode] || ''
            const orderForKey = fallbackCity ? { ...order, city: fallbackCity } : order
            const key = `${order.plantCode}::${composeAddress(orderForKey)}`
            const mins = getLiveTravelMinutes(key)
            if (!Number.isFinite(mins)) return undefined
            return { toJobMin: mins, toPlantMin: mins }
        },
        [getLiveTravelMinutes, plantCityByCode]
    )

    /** Canonical orderKey, mirroring what `computePlantPoolTimeline` builds. */
    const keyForOrder = useCallback((order) => {
        if (order.orderId) return order.orderId
        const mins = timeToMinutes(order?.startTime)
        return `${order.plantCode ?? 'unknown'}-${mins}-${order.orderNum ?? ''}`
    }, [])

    /** Per-plant pool breakdown — surfaced in the Trucks column tooltip so the
     *  dispatcher can see where a plant's starting number comes from.
     *  `starting` is still the effective count (base − send + recv) because
     *  that's what reads cleanly in the tooltip; actual pool timing is now
     *  driven by help-transfer events below. */
    const poolSourceByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const rawBase = Number.isFinite(s.base) ? s.base : 0
            const missing = getMissingOperators(plantProduction, s.code)
            const base = getEffectiveBase(rawBase, s.code, plantProduction, planDate)
            const send = Number.isFinite(s.send) ? s.send : 0
            const recv = Number.isFinite(s.recv) ? s.recv : 0
            out[s.code] = { base, missing, rawBase, recv, send, starting: base - send + recv }
        })
        return out
    }, [stats, plantProduction, planDate])

    /** Effective base operator count per plant — accounts for day-of-week
     *  multiplier and any missing-operator markers. */
    const baseByPlant = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const base = Number.isFinite(s.base) ? s.base : 0
            out[s.code] = getEffectiveBase(base, s.code, plantProduction, planDate)
        })
        return out
    }, [stats, plantProduction, planDate])

    /** Operator clock-in events per plant. Capped at the effective LOCAL
     *  truck count (`base − send + recv`) so the staffing ramp only counts
     *  operators staying at this plant — helpers leaving for other plants
     *  are scheduled separately via `helpRows`. */
    const localBaseByPlant = useMemo(() => {
        const out = {}
        Object.entries(poolSourceByCode).forEach(([code, ps]) => {
            out[code] = Math.max(0, ps.starting ?? ps.base ?? 0)
        })
        return out
    }, [poolSourceByCode])

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

    /** Each plant starts the day with every active assigned mixer physically
     *  on its lot — the "11 active − 3 out" number the tooltip surfaces.
     *  Outbound help trips subtract from this pool at their actual trip
     *  time (via `helpTransfers`), so mid-day pool reflects "trucks at
     *  plant right now" rather than ramping up from zero. */
    const initialPoolByCode = useMemo(() => {
        const out = {}
        Object.entries(baseByPlant).forEach(([code, base]) => {
            out[code] = base
        })
        return out
    }, [baseByPlant])

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

    /** Status counts (Scheduled / Same-day / Cancelled / Test) for the status filter. */
    const statusCounts = useMemo(() => {
        const out = { all: allOrders.length, cancelled: 0, sameDay: 0, scheduled: 0, test: 0 }
        allOrders.forEach((o) => {
            const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind
            if (kind === 'cancelled') out.cancelled += 1
            else if (kind === 'sameDay') out.sameDay += 1
            else if (kind === 'test') out.test += 1
            else out.scheduled += 1
        })
        return out
    }, [allOrders, isViewingToday])

    const productOptions = useMemo(() => {
        const set = new Set()
        allOrders.forEach((o) => {
            const c = clean(o.productCode)
            if (c) set.add(c)
        })
        return Array.from(set).sort()
    }, [allOrders])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
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
    }, [
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
    ])

    /* ── KPI numbers — non-production rows (cancelled at 17:00, test at 18:00)
       stay in the table for transparency but are excluded from yardage /
       truck totals. */
    const liveOrders = useMemo(
        () =>
            filtered.filter((o) => {
                const kind = getOrderStatus(o.startTime)?.kind
                return kind !== 'cancelled' && kind !== 'test'
            }),
        [filtered]
    )
    const totalYards = sumField(liveOrders, 'yardage')
    const totalTrucks = liveOrders.reduce((sum, o) => {
        const n = getCalculatedTruckCount(o, getTravelOverrides ? getTravelOverrides(o) : undefined)
        return sum + (Number.isFinite(n) ? n : 0)
    }, 0)

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
    const uniqueCustomers = new Set(liveOrders.map((o) => (clean(o.customer) || '').toLowerCase()).filter(Boolean)).size
    const startMinutes = liveOrders.map((o) => timeToMinutes(o.startTime)).filter((t) => t != null)
    const earliest = startMinutes.length ? Math.min(...startMinutes) : null
    const latest = startMinutes.length ? Math.max(...startMinutes) : null
    const earliestTime = earliest != null ? formatMinutesClock(earliest) : null
    const latestTime = latest != null ? formatMinutesClock(latest) : null

    const hasAnyOrders = allOrders.length > 0
    const hasActiveFilters =
        !!query ||
        plantFilters.length > 0 ||
        statusFilter !== 'all' ||
        productFilter !== 'all' ||
        (parseFloat(minYards) || 0) > 0 ||
        showCancelled ||
        showTest

    const activeFilterCount =
        (query ? 1 : 0) +
        (plantFilters.length > 0 ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (productFilter !== 'all' ? 1 : 0) +
        ((parseFloat(minYards) || 0) > 0 ? 1 : 0) +
        (showCancelled ? 1 : 0) +
        (showTest ? 1 : 0)

    const groupedByPlant = useMemo(() => {
        const groups = new Map()
        filtered.forEach((o) => {
            if (!groups.has(o.plantCode)) groups.set(o.plantCode, [])
            groups.get(o.plantCode).push(o)
        })
        return Array.from(groups.entries())
            .map(([code, orders]) => ({ code, orders }))
            .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    }, [filtered])

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
    }
}
