import {
    BIG_POUR_MIN_TRUCKS,
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
    CANCELLED_ORDER_START,
    TEST_ORDER_START,
    TRUCK_ON_SITE_MINUTES
} from '../../app/constants/planConstants'
import { parseDurationMinutes } from './planTime'

const matchesStartSentinel = (order, sentinel) => {
    const t = String(order?.startTime || '').trim()
    if (!t) return false
    return t.padStart(5, '0') === sentinel
}

/** True if an order's start time matches the cancellation sentinel. */
export const isCancelledOrder = (order) => matchesStartSentinel(order, CANCELLED_ORDER_START)

/** True if an order's start time matches the dispatcher test-order sentinel. */
export const isTestOrder = (order) => matchesStartSentinel(order, TEST_ORDER_START)

/** True for any order that should be excluded from yardage / truck / pool
 *  math (test + cancelled). Callers that show the row for transparency
 *  should still check `isTestOrder` / `isCancelledOrder` individually. */
export const isExcludedOrder = (order) => isCancelledOrder(order) || isTestOrder(order)

/** Pour rate (yd/hr) for a single order — `(60 / rate) × loadSize`.
 *  Returns null when either input is missing. */
export const getOrderPourRate = (order) => {
    const rateMin = parseDurationMinutes(order?.rate)
    const loadSize = parseFloat(order?.loadSize)
    if (!rateMin || !Number.isFinite(loadSize) || loadSize <= 0) return null
    return Math.round((60 / rateMin) * loadSize * 10) / 10
}

/** True for orders that trigger the 12-truck floor — total yardage ≥ 120 yd
 *  AND spacing between trucks < 10 min (back-to-back loading). */
export const isBigPourOrder = (order) => {
    const yardage = parseFloat(order?.yardage) || 0
    const spacingMin = parseDurationMinutes(order?.rate)
    if (yardage < BIG_POUR_YARDAGE_THRESHOLD) return false
    if (spacingMin == null || spacingMin >= BIG_POUR_SPACING_THRESHOLD_MIN) return false
    return true
}

/**
 * Trucks needed to sustain 120 yd/hr LOADED on a big pour given the actual
 * travel cycle. At 120 yd/hr the target spacing is `loadSize / 2` minutes
 * (e.g. 10-yd loads need 5-min spacing), so required rotation is
 * `ceil(cycleMin / targetSpacing)`. This is what drives the big-pour
 * requirement when travel is long enough that 12 isn't actually enough.
 */
export const trucksToHitBigPourGoal = (order, overrides) => {
    const opts = overrides || {}
    const loadSize = parseFloat(order?.loadSize) || 0
    if (loadSize <= 0) return null
    const toJobMin = Number.isFinite(opts.toJobMin) ? opts.toJobMin : parseDurationMinutes(order?.toJobTime)
    const toPlantMin = Number.isFinite(opts.toPlantMin)
        ? opts.toPlantMin
        : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
    if (toJobMin == null) return null
    const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
    const targetSpacingMin = loadSize / 2
    if (targetSpacingMin <= 0) return null
    return Math.max(1, Math.ceil(cycleMin / targetSpacingMin))
}

/** Estimated time to complete the pour at the scheduled rate, in minutes.
 *  Used as informational context alongside required truck count. */
export const getOrderPourDurationMinutes = (order) => {
    const rateMin = parseDurationMinutes(order?.rate)
    const loadSize = parseFloat(order?.loadSize) || 0
    const yardage = parseFloat(order?.yardage) || 0
    if (!rateMin || loadSize <= 0 || yardage <= 0) return null
    const trips = Math.ceil(yardage / loadSize)
    if (trips <= 0) return null
    return (trips - 1) * rateMin + TRUCK_ON_SITE_MINUTES
}

/**
 * Trucks required to sustain the order's scheduled pour rate given its
 * per-order travel times. Capped at the total number of trips in the pour —
 * a 50-yd pour with 10-yd loads has only 5 trips, so it never needs more
 * than 5 trucks no matter how long the cycle is.
 *
 *   trips      = ceil(yardage / loadSize)
 *   cycleMin   = toJobTime + toPlantTime + TRUCK_ON_SITE_MINUTES
 *   rotation   = ceil(cycleMin / rateMin)
 *   required   = min(rotation, trips)
 *
 * Returns null when rate and both travel sources are missing.
 */
export const getRequiredTrucksForPourRate = (order, overrides) => {
    const opts = overrides || {}
    const rateMin = parseDurationMinutes(order?.rate)
    const toJobMin = Number.isFinite(opts.toJobMin) ? opts.toJobMin : parseDurationMinutes(order?.toJobTime)
    const toPlantMin = Number.isFinite(opts.toPlantMin)
        ? opts.toPlantMin
        : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
    if (!rateMin || toJobMin == null) return null
    const cycleMin = toJobMin + toPlantMin + TRUCK_ON_SITE_MINUTES
    const rotation = Math.max(1, Math.ceil(cycleMin / rateMin))
    const loadSize = parseFloat(order?.loadSize) || 0
    const yardage = parseFloat(order?.yardage) || 0
    if (loadSize > 0 && yardage > 0) {
        const trips = Math.ceil(yardage / loadSize)
        return Math.max(1, Math.min(rotation, trips))
    }
    return rotation
}

/** Effective minimum trucks — max of:
 *    - the travel-derived rotation at the ORDER's scheduled spacing,
 *    - the big-pour floor (12) when the rule fires,
 *    - the travel-derived rotation needed to actually hit 120 yd/hr LOADED
 *      (big pours only — long travel makes the 12-truck floor insufficient).
 *  Then capped at the pour's total trips so a short pour never demands more
 *  trucks than it has loads. */
export const getEffectiveMinTrucks = (order, overrides) => {
    const opts = overrides || {}
    const calculated = getRequiredTrucksForPourRate(order, opts)
    const isBig = isBigPourOrder(order)
    const bigPourFloor = isBig ? BIG_POUR_MIN_TRUCKS : 0
    const bigPourGoalTrucks = isBig ? (trucksToHitBigPourGoal(order, opts) ?? 0) : 0
    if (calculated == null && bigPourFloor === 0 && bigPourGoalTrucks === 0) return null
    let effective = Math.max(calculated ?? 0, bigPourFloor, bigPourGoalTrucks)
    const loadSize = parseFloat(order?.loadSize) || 0
    const yardage = parseFloat(order?.yardage) || 0
    if (loadSize > 0 && yardage > 0) {
        const trips = Math.ceil(yardage / loadSize)
        effective = Math.min(effective, trips)
    }
    return effective > 0 ? effective : null
}

/**
 * Our canonical truck count for an order — what the dispatch *should* book.
 * Uses the same travel-aware rotation math as `getEffectiveMinTrucks`, with
 * the big-pour floor and trip cap already applied. Prefer this over the
 * dispatch report's raw `truckCount` anywhere we display or aggregate trucks
 * so the number stays consistent across the UI.
 */
export const getCalculatedTruckCount = (order, overrides) => {
    const computed = getEffectiveMinTrucks(order, overrides || {})
    if (computed != null) return computed
    const scheduled = parseFloat(order?.truckCount)
    return Number.isFinite(scheduled) && scheduled > 0 ? scheduled : null
}
