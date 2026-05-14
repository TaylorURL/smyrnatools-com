import {
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_POUR_TAIL_MIN,
    DEFAULT_TRAVEL_OUT_MIN,
    DEFAULT_TRUCK_SPACING_MIN,
    POUR_METHOD_OPTIONS
} from '../../app/constants/bookOrderConstants'
import { isExcludedOrder, parseDurationMinutes, timeToMinutes } from '../PlanUtility'

/** Look up a pour-method profile by its `value` key. Returns null when the
 *  dispatcher hasn't picked one (the duration math then falls back to the
 *  spacing field + DEFAULT_POUR_TAIL_MIN). */
export const getPourMethodTimings = (value) => POUR_METHOD_OPTIONS.find((option) => option.value === value) || null

/** Trucks needed to sustain the requested pour. Falls back to defaults when
 *  the dispatcher hasn't filled in load size / spacing / pour method. */
export const estimateRequiredTrucks = ({ yardage, loadSize, spacingMin, tailMin, travelMin }) => {
    const yards = Number(yardage) || 0
    if (yards <= 0) return 0
    const load = Number(loadSize) > 0 ? Number(loadSize) : DEFAULT_LOAD_SIZE_YARDS
    const spacing = Number(spacingMin) > 0 ? Number(spacingMin) : DEFAULT_TRUCK_SPACING_MIN
    const tail = Number(tailMin) > 0 ? Number(tailMin) : DEFAULT_POUR_TAIL_MIN
    const travel = Number(travelMin) > 0 ? Number(travelMin) : DEFAULT_TRAVEL_OUT_MIN
    const trips = Math.max(1, Math.ceil(yards / load))
    const cycleMin = travel * 2 + tail
    const rotation = Math.max(1, Math.ceil(cycleMin / spacing))
    return Math.min(trips, rotation)
}

/** End-to-end pour duration from first load to last truck back at plant. */
export const estimatePourDurationMinutes = ({ yardage, loadSize, spacingMin, tailMin, travelMin }) => {
    const yards = Number(yardage) || 0
    if (yards <= 0) return 0
    const load = Number(loadSize) > 0 ? Number(loadSize) : DEFAULT_LOAD_SIZE_YARDS
    const spacing = Number(spacingMin) > 0 ? Number(spacingMin) : DEFAULT_TRUCK_SPACING_MIN
    const tail = Number(tailMin) > 0 ? Number(tailMin) : DEFAULT_POUR_TAIL_MIN
    const travel = Number(travelMin) > 0 ? Number(travelMin) : DEFAULT_TRAVEL_OUT_MIN
    const trips = Math.max(1, Math.ceil(yards / load))
    return (trips - 1) * spacing + travel + tail
}

/** Per-order schedule footprint — `{ startMin, endMin, trips }` based on
 *  yardage / load / spacing with conservative defaults for missing fields. */
export const orderTimeWindow = (order) => {
    const startMin = timeToMinutes(order?.startTime)
    if (!Number.isFinite(startMin)) return null
    const yards = parseFloat(order?.yardage) || 0
    const load = parseFloat(order?.loadSize) || DEFAULT_LOAD_SIZE_YARDS
    const spacing = parseDurationMinutes(order?.rate) ?? DEFAULT_TRUCK_SPACING_MIN
    const trips = yards > 0 && load > 0 ? Math.max(1, Math.ceil(yards / load)) : 1
    const duration = (trips - 1) * spacing + DEFAULT_TRAVEL_OUT_MIN + DEFAULT_POUR_TAIL_MIN
    return { endMin: startMin + duration, startMin, trips }
}

const overlapsWindow = (window, requestStart, requestEnd) => {
    if (!window) return false
    return window.startMin < requestEnd && window.endMin > requestStart
}

/** Sum of trucks already engaged at this plant during the requested window.
 *  Used to discount the plant's pool size when scoring availability. */
export const computeConcurrentTrucks = (plantOrders, requestStart, requestEnd) => {
    if (!Array.isArray(plantOrders) || requestEnd <= requestStart) return 0
    let busy = 0
    for (const order of plantOrders) {
        if (isExcludedOrder(order)) continue
        const window = orderTimeWindow(order)
        if (!overlapsWindow(window, requestStart, requestEnd)) continue
        const explicit = parseFloat(order?.truckCount)
        const trucks = Number.isFinite(explicit) && explicit > 0 ? explicit : window.trips
        busy += trucks
    }
    return Math.round(busy)
}

/** Count of non-excluded orders at `plant` whose `startTime` matches
 *  `startMin` exactly. Used by every slot scanner to enforce the
 *  per-plant launch cap. Cancelled / test orders are skipped so they
 *  don't block real bookings. */
export const countOrdersAtSameStart = (orders, startMin) => {
    if (!Array.isArray(orders) || !Number.isFinite(startMin)) return 0
    let count = 0
    for (const order of orders) {
        if (!order || isExcludedOrder(order)) continue
        const orderStart = timeToMinutes(order?.startTime)
        if (orderStart === startMin) count += 1
    }
    return count
}
