import {
    BAD_SERVICE_LATE_THRESHOLD_MIN,
    BAD_SERVICE_PACE_THRESHOLD,
    SMALL_JOB_TRUCK_THRESHOLD,
    SMALL_JOB_YARDAGE_THRESHOLD
} from '../../app/constants/planConstants'
import { parseDurationMinutes, timeToMinutes } from './planTime'

/** Convert truck `loadSize` (yards) and `spacing` (minutes between trucks)
 *  into the requested pour rate the schedule plan implies. Returns null
 *  when either input is missing so callers can skip ratio-based checks. */
export const computeRequestedYardsPerHour = (loadSize, spacingMinutes) => {
    if (!(loadSize > 0) || !(spacingMinutes > 0)) return null
    return (loadSize * 60) / spacingMinutes
}

/** Actual pour rate over the loaded-truck window. `actualDurationMinutes`
 *  is the gap between first and last loaded times — when only one truck has
 *  loaded the window is zero, so we return null instead of dividing by 0. */
export const computeActualYardsPerHour = (totalYardage, actualDurationMinutes) => {
    if (!(totalYardage > 0) || !(actualDurationMinutes > 0)) return null
    return (totalYardage / actualDurationMinutes) * 60
}

/** True when a pour is small enough that the slow-pace check should be
 *  suppressed. Either dimension on its own is sufficient — a 3-truck job
 *  or a sub-30-yard job both qualify. */
export const isSmallPourJob = (expectedTrucks, totalYardage) => {
    const trucks = Number(expectedTrucks) || 0
    const yards = Number(totalYardage) || 0
    return (trucks > 0 && trucks <= SMALL_JOB_TRUCK_THRESHOLD) || (yards > 0 && yards <= SMALL_JOB_YARDAGE_THRESHOLD)
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Per-order verdict: an order is "bad" if dispatch was late starting
 *  (>15 min past the scheduled start) OR — for non-small jobs — the
 *  actual pour rate fell below 70% of the requested rate. Small pours
 *  (≤3 trucks or ≤30 yd) skip the slow check; their cadence is set by
 *  the customer's finishing crew, not dispatch. */
export const computeCustomerSatisfaction = (orders, detailByOrderId) => {
    if (!Array.isArray(orders) || !orders.length) return null
    let samples = 0
    let badService = 0

    orders.forEach((order) => {
        const detail = order?.orderId ? detailByOrderId?.[order.orderId] : null
        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
        const loadedTimes = tickets
            .map((t) => timeToMinutes(t?.loadedTime))
            .filter((mins) => Number.isFinite(mins))
            .sort((a, b) => a - b)
        if (!loadedTimes.length) return

        const totalYardage = parseFloat(order.yardage) || 0
        const loadSize = parseFloat(order.loadSize) || 0
        const numTrucks =
            loadSize > 0 && totalYardage > 0 ? Math.max(1, Math.ceil(totalYardage / loadSize)) : loadedTimes.length
        const startMin = timeToMinutes(order.startTime)
        const spacing = parseDurationMinutes(order.rate) ?? 5

        const firstLoad = loadedTimes[0]
        const lastLoad = loadedTimes[loadedTimes.length - 1]
        const actualDuration = Math.max(0, lastLoad - firstLoad)
        const startLateness = Number.isFinite(startMin) ? Math.max(0, firstLoad - startMin) : 0

        // Pace verdict compares actual yd/hr to the requested yd/hr the
        // schedule plan implies (loadSize / spacing). When either input is
        // missing we can't compute a ratio, so we don't penalize the order.
        const requestedYdPerHr = computeRequestedYardsPerHour(loadSize, spacing)
        const actualYdPerHr = computeActualYardsPerHour(totalYardage, actualDuration)
        const paceScore = requestedYdPerHr && actualYdPerHr ? clamp01(actualYdPerHr / requestedYdPerHr) : 1

        samples += 1
        const isLate = startLateness > BAD_SERVICE_LATE_THRESHOLD_MIN
        const isSlow = !isSmallPourJob(numTrucks, totalYardage) && paceScore < BAD_SERVICE_PACE_THRESHOLD
        if (isLate || isSlow) badService += 1
    })

    if (samples === 0) return null
    const goodService = samples - badService
    return {
        badService,
        goodService,
        samples,
        score: goodService / samples
    }
}
