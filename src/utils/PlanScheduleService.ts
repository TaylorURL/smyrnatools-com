// Plan Schedule — service-level helpers: first-load anchor + DOT hours-limit +
// coverage payload + satisfaction scoring (both retrospective and predictive).

import { clean } from './PlanScheduleFormat'
import {
    HOURS_LIMIT_MINUTES,
    HOURS_LIMIT_POUR_MINUTES,
    HOURS_LIMIT_SLUMP_MINUTES,
    sanitizeTravelMinutes
} from './PlanScheduleSettings'
import {
    computeCustomerSatisfaction,
    estimateOrderTiming,
    findNextViableStart,
    getCalculatedTruckCount,
    isBigPourOrder,
    isExcludedOrder,
    LOAD_MINUTES,
    parseDurationMinutes,
    timeToMinutes
} from './PlanUtility'

/** Minimum savings (minutes) for a non-assigned plant to count as "closer"
 *  in the Schedule's address column. Below this we don't surface it — the
 *  variance in live traffic estimates is enough that small savings aren't
 *  reliable. */
export const CLOSER_PLANT_MIN_SAVINGS = 5

/**
 * Earliest "load-out" minute of the day PER PLANT — the anchor for each
 * plant's 14-hour DOT shift check. For plant P this is the earliest of:
 * (1) P's first own order start time, and (2) P's first outbound help
 * dispatch clock-in (when a P operator first clocked in to drive to
 * another plant). Inbound help arriving at P does NOT anchor P's day —
 * those operators clocked in at their source plant, not at P. Return
 * events similarly don't anchor — they're just an operator coming back.
 * Excluded orders (cancelled / test) are skipped.
 *
 * Returns `Map<plantCode, anchorMin>`. Plants with no qualifying activity
 * are absent from the map — callers should treat that as "no anchor" and
 * skip the 14h badge for those orders.
 *
 * The fix: previously this was a single scalar across ALL orders, so an
 * order at plant A could get anchored by plant B's earlier first job
 * when the dispatcher viewed the schedule unfiltered. Each plant now
 * gets its own day-start, so the badge only fires when THIS plant's
 * operator actually exceeds 14h.
 */
export const getFirstLoadOutByPlant = (orders, helpRows) => {
    const byPlant = new Map()
    const consider = (code, min) => {
        if (!code || !Number.isFinite(min)) return
        const existing = byPlant.get(code)
        if (existing == null || min < existing) byPlant.set(code, min)
    }
    for (const order of orders || []) {
        if (!order || isExcludedOrder(order)) continue
        consider(order.plantCode, timeToMinutes(order?.startTime))
    }
    for (const row of helpRows || []) {
        if (!row || row.direction !== 'outbound') continue
        /* Only count outbound help when we can pin the operator's actual
         * clock-in at the FROM plant. Without travel data we'd otherwise
         * fall back to the arrival time at the destination, which is
         * later than the real clock-in and would shorten the 14h window. */
        consider(row.fromPlant, row.clockInRangeStart)
    }
    return byPlant
}

/**
 * Project the operator's "back at yard" minute for one dispatch order:
 *   load → slump → travel out → pour → travel back
 * and check whether the total elapsed time from `firstLoadOutMin` exceeds
 * the 14-hour DOT limit. Travel times come from the order's own
 * `toJobTime` / `toPlantTime` (HH:MM dispatch values); a missing back-leg
 * falls back to the out-leg estimate. Returns null when we lack enough
 * signal to compute a meaningful answer.
 */
export const evaluateHoursLimit = (order, firstLoadOutMin) => {
    if (!order || isExcludedOrder(order)) return null
    if (!Number.isFinite(firstLoadOutMin)) return null
    const startMin = timeToMinutes(order?.startTime)
    if (!Number.isFinite(startMin)) return null
    /* Travel legs run through `sanitizeTravelMinutes` so dispatch values
     * mis-shaped as clock times (e.g. "18:20" → 1100 min) get clamped to
     * null instead of producing absurd elapsed-hour readings. Symmetric
     * fallback: when one leg is null but the other is finite, mirror the
     * finite leg into both — assumes return time ≈ outbound time, which
     * is realistic for ready-mix delivery. Bails entirely when both
     * legs are null (no usable signal to compute against). */
    const rawOut = sanitizeTravelMinutes(parseDurationMinutes(order?.toJobTime))
    const rawBack = sanitizeTravelMinutes(parseDurationMinutes(order?.toPlantTime))
    const travelOut = Number.isFinite(rawOut) ? rawOut : rawBack
    const travelBack = Number.isFinite(rawBack) ? rawBack : rawOut
    if (!Number.isFinite(travelOut) && !Number.isFinite(travelBack)) return null
    const segments = {
        load: LOAD_MINUTES,
        pour: HOURS_LIMIT_POUR_MINUTES,
        slump: HOURS_LIMIT_SLUMP_MINUTES,
        travelBack: Number.isFinite(travelBack) ? travelBack : 0,
        travelOut: Number.isFinite(travelOut) ? travelOut : 0
    }
    const finishMin =
        startMin + segments.load + segments.slump + segments.travelOut + segments.pour + segments.travelBack
    const elapsedMin = finishMin - firstLoadOutMin
    return {
        elapsedHours: elapsedMin / 60,
        elapsedMin,
        exceeds: elapsedMin >= HOURS_LIMIT_MINUTES,
        finishMin,
        firstLoadOutMin,
        segments,
        startMin
    }
}

/**
 * Build the truck-coverage payload for a single dispatch order — the same
 * shape `TruckCoveragePanelBody` consumes. Pure: takes the order plus a
 * context bag and returns the assembled payload, no React state.
 *
 * Lives here (not in `PlanScheduleOrderRow`) so both the schedule's order
 * row AND the "Plan" tab inside `OrderInfoModal` derive coverage from the
 * exact same logic. `rowKey` defaults to `order.orderId` when not provided
 * so the modal call site doesn't need to pass it.
 */
export const buildOrderCoveragePayload = (
    order,
    { poolSourceByCode, poolTimeline, poolTimelinesByPlant, rowKey, travelOverrides } = {}
) => {
    if (!order) return null
    const computed = getCalculatedTruckCount(order, travelOverrides)
    const dispatchTrucks = parseFloat(order.truckCount) || 0
    const differsFromDispatch = computed != null && dispatchTrucks > 0 && computed !== dispatchTrucks
    const key = rowKey || order.orderId || ''
    const poolEntry = poolTimeline?.[key]
    const poolAtStart = poolEntry?.poolAtDispatch
    const poolAfter = poolEntry?.poolAfterDispatch
    const poolAfterEffective = Number.isFinite(poolEntry?.poolAfterDispatchEffective)
        ? poolEntry.poolAfterDispatchEffective
        : poolAfter
    const helpInWindow = poolEntry?.inboundDuringPour || 0
    const overbooked = Number.isFinite(poolAfterEffective) && poolAfterEffective < 0
    let recommendedMoveTime = null
    if (overbooked && Number.isFinite(computed) && poolEntry) {
        const timeline = poolTimelinesByPlant?.[order.plantCode]
        const pourDuration = Math.max(0, (poolEntry.lastReturnMinutes ?? 0) - (poolEntry.dispatchMinutes ?? 0))
        recommendedMoveTime = findNextViableStart(
            timeline,
            computed,
            (poolEntry.dispatchMinutes ?? 0) + 1,
            pourDuration
        )
    }
    const poolSource = poolSourceByCode?.[order.plantCode]
    const timing = overbooked && poolEntry ? estimateOrderTiming(order, poolEntry, travelOverrides) : null
    return {
        bigPour: isBigPourOrder(order),
        computed,
        customer: clean(order.customer),
        differsFromDispatch,
        dispatchTrucks,
        helpInWindow,
        kickerBigPourActive: !!poolEntry?.kickerBigPourActive,
        kickerHeld: poolEntry?.kickerHeldAtDispatch || 0,
        liveTravel: !!travelOverrides,
        orderNum: order.orderNum,
        overbooked,
        plantCode: order.plantCode,
        poolAfter,
        poolAfterEffective,
        poolAtStart,
        poolSource,
        recommendedMoveTime,
        rowKey: key,
        timing,
        yardage: parseFloat(order.yardage) || 0
    }
}

/** Buffer past the last expected load (~one full cycle) so a pour still
 *  wrapping up doesn't get scored before its closing trucks load. */
export const SETTLE_BUFFER_MIN = 30

/**
 * Customer-satisfaction score for the current schedule day. For past days
 * the score covers every order; for today it covers only orders that have
 * settled (every expected truck loaded, or the planned pour window plus one
 * full cycle has elapsed) so in-progress pours don't drag pace down.
 *
 * Returns the underlying `{ score, samples, goodService, badService }`
 * envelope from `computeCustomerSatisfaction`, augmented with
 *   - `isLive` — true on today's schedule
 *   - `inProgress` — count of orders that haven't settled yet (live mode)
 *
 * `nowMin` should be the current minute-of-day on today's schedule, or null
 * for past/future days.
 */
export const evaluateScheduleSatisfaction = ({ detailByOrderId, isPastDay, isToday, liveOrders, nowMin }) => {
    if (!isPastDay && !isToday) return null
    if (isPastDay) {
        const result = computeCustomerSatisfaction(liveOrders, detailByOrderId)
        return result ? { ...result, inProgress: 0, isLive: false } : null
    }
    const scoreable = []
    let inProgress = 0
    for (const order of liveOrders) {
        const detail = order?.orderId ? detailByOrderId?.[order.orderId] : null
        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
        if (!tickets.length) continue
        const totalYardage = parseFloat(order.yardage) || 0
        const loadSize = parseFloat(order.loadSize) || 0
        const expectedTrucks =
            loadSize > 0 && totalYardage > 0 ? Math.max(1, Math.ceil(totalYardage / loadSize)) : tickets.length
        const startMin = timeToMinutes(order.startTime) ?? 0
        const spacing = parseDurationMinutes(order.rate) ?? 5
        const expectedEnd = startMin + Math.max(0, expectedTrucks - 1) * spacing + SETTLE_BUFFER_MIN
        const allTrucksLoaded = tickets.length >= expectedTrucks
        const windowElapsed = Number.isFinite(nowMin) && nowMin > expectedEnd
        if (allTrucksLoaded || windowElapsed) scoreable.push(order)
        else inProgress += 1
    }
    if (!scoreable.length) return null
    const result = computeCustomerSatisfaction(scoreable, detailByOrderId)
    return result ? { ...result, inProgress, isLive: true } : null
}

/**
 * Forecast customer satisfaction for a future-day schedule based on the
 * `NEEDS HELP` orders the pool simulation surfaces. For each order we read
 * `poolAfterDispatchEffective` from the timeline — when it's negative the
 * pour will run short by that many trucks, and the matching yardage is
 * considered "at-risk" (it ships, but slower than scheduled, eroding
 * service quality).
 *
 * The score is yardage-weighted:
 *   penalty = sum(orderYardage × trucksShort / trucksNeeded)
 *   score   = 1 − penalty / totalYardage
 *
 * Each big order under-trucked drags the score harder than a tiny one,
 * which matches how a dispatcher would size up the day. Returns the same
 * envelope as `evaluateScheduleSatisfaction` so the badge / strip render
 * paths reuse cleanly (`isLive: false`, `isPrediction: true`).
 */
export const predictScheduleSatisfaction = ({ getTravelOverrides, keyForOrder, liveOrders, poolTimeline }) => {
    if (!Array.isArray(liveOrders) || liveOrders.length === 0) return null
    if (!poolTimeline) return null
    let totalYards = 0
    let weightedPenalty = 0
    let goodService = 0
    let badService = 0
    let totalTrucksShort = 0
    for (const order of liveOrders) {
        if (!order || isExcludedOrder(order)) continue
        const yardage = parseFloat(order.yardage) || 0
        if (yardage <= 0) continue
        const overrides = typeof getTravelOverrides === 'function' ? getTravelOverrides(order) || {} : {}
        const truckCount = getCalculatedTruckCount(order, overrides)
        if (!Number.isFinite(truckCount) || truckCount <= 0) continue
        const key = typeof keyForOrder === 'function' ? keyForOrder(order) : order.orderId
        const entry = poolTimeline[key]
        const afterEff = entry?.poolAfterDispatchEffective
        const trucksShort = Number.isFinite(afterEff) && afterEff < 0 ? -afterEff : 0
        totalYards += yardage
        if (trucksShort > 0) {
            badService += 1
            totalTrucksShort += trucksShort
            const lateFraction = Math.min(1, trucksShort / truckCount)
            weightedPenalty += yardage * lateFraction
        } else {
            goodService += 1
        }
    }
    if (totalYards <= 0) return null
    const score = Math.max(0, Math.min(1, 1 - weightedPenalty / totalYards))
    return {
        badService,
        goodService,
        inProgress: 0,
        isLive: false,
        isPrediction: true,
        samples: goodService + badService,
        score,
        trucksShort: totalTrucksShort
    }
}
