// Plan Schedule — per-order status sentinels and per-order service evaluator.

import { clean } from './PlanScheduleFormat'
import {
    BAD_SERVICE_LATE_THRESHOLD_MIN,
    computeActualYardsPerHour,
    computeRequestedYardsPerHour,
    isExcludedOrder,
    parseDurationMinutes,
    scoreOrderExperience,
    timeToMinutes
} from './PlanUtility'

/**
 * Sentinel start times the dispatch system uses to mark special order states.
 *  - `15:00` → same-day order (only meaningful on today's schedule)
 *  - `17:00` → order was cancelled
 *  - `18:00` → dispatcher test order
 */
export const ORDER_STATUS_BY_START = {
    '15:00': { color: '#d97706', icon: 'fa-bolt', kind: 'sameDay', label: 'Same-day' },
    '17:00': { color: '#dc2626', icon: 'fa-ban', kind: 'cancelled', label: 'Cancelled' },
    '18:00': { color: '#6366f1', icon: 'fa-flask', kind: 'test', label: 'Test' }
}

/**
 * Resolve a start-time sentinel to its dispatch status descriptor.
 * The `15:00` sentinel only flags an order as same-day when the schedule
 * being viewed is actually today; on historical or future schedules a real
 * 3:00 PM start can legitimately exist, so the badge is suppressed there.
 */
export const getOrderStatus = (startTime, { isToday = true } = {}) => {
    const v = clean(startTime)
    if (!v) return null
    const status = ORDER_STATUS_BY_START[v.padStart(5, '0')] || null
    if (status?.kind === 'sameDay' && !isToday) return null
    return status
}

/* Per-order service evaluator. Same pace + on-time logic as the day-level
 * Customer Satisfaction calc, but resolved into a discrete status that drives
 * an inline badge on each schedule row:
 *
 *   good     — pour completed, no flags
 *   bad      — pour completed, late start and/or slow pace
 *   ongoing  — has tickets, more expected (still loading)
 *   pending  — no tickets yet but the start time has passed
 *   null     — order hasn't started, or has no usable signal
 *
 * `nowMin` is the current minute-of-day; pass null for past days where
 * "now" doesn't apply (every order is by definition completed).            */
export const evaluateOrderService = (order, detail, nowMin) => {
    if (!order || isExcludedOrder(order)) return null
    const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
    const loadedTimes = tickets
        .map((t) => timeToMinutes(t?.loadedTime))
        .filter((mins) => Number.isFinite(mins))
        .sort((a, b) => a - b)
    const totalYardage = parseFloat(order.yardage) || 0
    const loadSize = parseFloat(order.loadSize) || 0
    const expectedTrucks =
        loadSize > 0 && totalYardage > 0 ? Math.max(1, Math.ceil(totalYardage / loadSize)) : loadedTimes.length || null
    const startMin = timeToMinutes(order.startTime)
    const spacing = parseDurationMinutes(order.rate) ?? 5
    const expectedEnd =
        Number.isFinite(startMin) && expectedTrucks ? startMin + Math.max(0, expectedTrucks - 1) * spacing + 30 : null

    if (!loadedTimes.length) {
        // No tickets yet. Only flag "pending" once the start time is at
        // least a few minutes past — otherwise the row is just upcoming.
        // When the gap blows past `BAD_SERVICE_LATE_THRESHOLD_MIN` the
        // pending state escalates to "late" so the badge can switch from
        // a soft "Awaiting Truck" to a red "Late · Xh Ym". `startLateness`
        // here is `nowMin - startMin` (clock time since scheduled start)
        // because no truck has loaded — there's no actual load time to
        // measure lateness against.
        if (Number.isFinite(nowMin) && Number.isFinite(startMin) && nowMin > startMin + 5) {
            const startLateness = Math.max(0, nowMin - startMin)
            return {
                expectedTrucks: expectedTrucks ?? null,
                isLate: startLateness > BAD_SERVICE_LATE_THRESHOLD_MIN,
                startLateness,
                status: 'pending',
                ticketsLoaded: 0
            }
        }
        return null
    }

    // Delegate the bad/late/slow verdict to `scoreOrderExperience` so the
    // schedule badge applies the EXACT same classification — same
    // kicker-aware split, same paceYardage source (actual ticket sum,
    // with proration as fallback), same thresholds — that
    // `computeCustomerSatisfaction` uses in the Statistics page. Before
    // this, both code paths computed similar but subtly different pace
    // numbers, which let an order read "Bad Experience" on the badge
    // while statistics counted it as good (or vice versa).
    const verdict = scoreOrderExperience(order, detail)

    const allTrucksLoaded = expectedTrucks ? loadedTimes.length >= expectedTrucks : false
    // For past days, `nowMin` is null and we treat everything with tickets
    // as completed. For today we wait for either all expected trucks to
    // have loaded or for the planned window (+ one cycle) to elapse.
    const windowElapsed = Number.isFinite(nowMin) && expectedEnd !== null ? nowMin > expectedEnd : true
    const isCompleted = !Number.isFinite(nowMin) || allTrucksLoaded || windowElapsed

    if (!isCompleted) {
        return {
            expectedTrucks: expectedTrucks ?? null,
            isLate: verdict.isLate,
            startLateness: verdict.latenessMin,
            status: 'ongoing',
            ticketsLoaded: loadedTimes.length
        }
    }

    const requestedYdPerHr = computeRequestedYardsPerHour(loadSize, spacing)
    const actualDuration = Math.max(0, loadedTimes[loadedTimes.length - 1] - loadedTimes[0])
    const actualYdPerHr = computeActualYardsPerHour(verdict.paceYardage, actualDuration)
    return {
        actualYdPerHr,
        expectedTrucks: expectedTrucks ?? null,
        isLate: verdict.isLate,
        isSlow: verdict.isSlow,
        paceScore: verdict.paceScore == null ? 1 : verdict.paceScore,
        requestedYdPerHr,
        startLateness: verdict.latenessMin,
        status: verdict.isBad ? 'bad' : 'good',
        ticketsLoaded: loadedTimes.length
    }
}
