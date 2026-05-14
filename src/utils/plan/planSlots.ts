import {
    PULL_UP_LEAD_NOTICE_MIN,
    PULL_UP_MIN_DELTA_MIN,
    SLOT_DAY_END_MIN,
    SLOT_DAY_START_MIN,
    SLOT_GRID_MIN,
    SUGGESTED_SLOT_TYPES,
    TRUCK_ON_SITE_MINUTES
} from '../../app/constants/planConstants'
import { getCalculatedTruckCount, getOrderPourDurationMinutes, isExcludedOrder } from './planOrder'
import { simulatePoolTimeline } from './planPool'
import { parseDurationMinutes, timeToMinutes } from './planTime'

/** Round a minute value UP to the next 30-minute mark so suggested start
 *  times read as 11:00 / 11:30 — never 11:13. */
const roundUpToSlotGrid = (mins) => {
    if (!Number.isFinite(mins)) return mins
    const remainder = mins % SLOT_GRID_MIN
    return remainder === 0 ? mins : mins + (SLOT_GRID_MIN - remainder)
}

/** Walk a plant's pool timeline and return the earliest start time (in minutes)
 *  within business hours where the plant has `minTrucks` GENUINELY spare —
 *  i.e. `minFuture(t) ≥ minTrucks`. Using minFuture (lowest pool from t
 *  onward) rather than raw pool ensures we only recommend slots for trucks
 *  that aren't already committed to a later order. */
const findEarliestIdleTime = (timeline, minTrucks) => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null
    const segments = timeline.map((entry) => ({
        pool: entry.pool,
        startTime: Number.isFinite(entry.time) ? entry.time : 0
    }))
    const minFuture = new Array(segments.length)
    let running = Infinity
    for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].pool < running) running = segments[i].pool
        minFuture[i] = running
    }
    for (let i = 0; i < segments.length; i++) {
        if (minFuture[i] < minTrucks) continue
        const seg = segments[i]
        const segEnd = i + 1 < segments.length ? segments[i + 1].startTime : SLOT_DAY_END_MIN
        const clippedStart = Math.max(seg.startTime, SLOT_DAY_START_MIN)
        const clippedEnd = Math.min(segEnd, SLOT_DAY_END_MIN)
        const grid = roundUpToSlotGrid(clippedStart)
        if (grid < clippedEnd) return grid
    }
    return null
}

/**
 * Estimate real-world timing for an order given how many trucks the plant
 * can actually put on it. For overbooked orders where `actualTrucks <
 * required`, the spacing between trips widens (each truck cycles every
 * `cycleMin`, so with N trucks the effective spacing is `cycleMin / N`) and
 * the pour drags out. Returns first-truck arrival, estimated completion,
 * and the derived delay in minutes.
 */
export const estimateOrderTiming = (order, poolEntry, overrides) => {
    if (!poolEntry || !Number.isFinite(poolEntry.dispatchMinutes)) return null
    const opts = overrides || {}
    const toJobMin = Number.isFinite(opts.toJobMin) ? opts.toJobMin : (parseDurationMinutes(order?.toJobTime) ?? 20)
    const toPlantMin = Number.isFinite(opts.toPlantMin)
        ? opts.toPlantMin
        : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
    const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
    const scheduledSpacing = parseDurationMinutes(order?.rate) ?? 5
    const loadSize = parseFloat(order?.loadSize) || 0
    const yardage = parseFloat(order?.yardage) || 0
    const trips = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : poolEntry.truckCount
    const required = poolEntry.truckCount || trips
    const startMin = poolEntry.dispatchMinutes
    const poolAtStart = Number.isFinite(poolEntry.poolAtDispatch) ? poolEntry.poolAtDispatch : 0
    const inboundDuring = Number.isFinite(poolEntry.inboundDuringPour) ? poolEntry.inboundDuringPour : 0
    const actualTrucks = Math.max(0, poolAtStart) + Math.max(0, inboundDuring)
    const usableTrucks = Math.max(1, Math.min(required, actualTrucks))
    const firstDispatchMin = poolAtStart >= 1 ? startMin : inboundDuring > 0 ? startMin : null
    const firstArrivalMin = firstDispatchMin != null ? firstDispatchMin + toJobMin : null
    const scheduledCompletionMin = startMin + (trips - 1) * scheduledSpacing + cycleMin
    const effectiveSpacing =
        actualTrucks >= required ? scheduledSpacing : Math.max(scheduledSpacing, cycleMin / usableTrucks)
    const estimatedCompletionMin = startMin + (trips - 1) * effectiveSpacing + cycleMin
    const scheduledRateYph = loadSize > 0 && scheduledSpacing > 0 ? (60 / scheduledSpacing) * loadSize : null
    const effectiveRateYph = loadSize > 0 && effectiveSpacing > 0 ? (60 / effectiveSpacing) * loadSize : null
    const firstTruckIsLate = poolAtStart < 1 && inboundDuring > 0
    return {
        actualTrucks,
        delayMin: Math.max(0, Math.round(estimatedCompletionMin - scheduledCompletionMin)),
        effectiveRateYph: Number.isFinite(effectiveRateYph) ? Math.round(effectiveRateYph * 10) / 10 : null,
        effectiveSpacingMin: Math.round(effectiveSpacing * 10) / 10,
        estimatedCompletionMin: Math.round(estimatedCompletionMin),
        firstArrivalMin: Number.isFinite(firstArrivalMin) ? Math.round(firstArrivalMin) : null,
        firstTruckIsLate,
        requiredTrucks: required,
        scheduledCompletionMin: Math.round(scheduledCompletionMin),
        scheduledRateYph: Number.isFinite(scheduledRateYph) ? Math.round(scheduledRateYph * 10) / 10 : null,
        scheduledSpacingMin: scheduledSpacing
    }
}

/**
 * Earliest time at-or-after `afterMin` when the plant has at least
 * `minTrucks` idle for `durationMin` contiguous minutes (within business
 * hours). Returns null if no viable window remains today.
 */
export const findNextViableStart = (timeline, minTrucks, afterMin, durationMin) => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null
    const segments = timeline.map((entry) => ({
        pool: entry.pool,
        startTime: Number.isFinite(entry.time) ? entry.time : 0
    }))
    let runStart = null
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const segEnd = i + 1 < segments.length ? segments[i + 1].startTime : SLOT_DAY_END_MIN
        if (seg.pool >= minTrucks) {
            const clippedStart = Math.max(seg.startTime, afterMin)
            const clippedEnd = Math.min(segEnd, SLOT_DAY_END_MIN)
            if (clippedEnd <= clippedStart) continue
            if (runStart == null) runStart = clippedStart
            const gridStart = roundUpToSlotGrid(runStart)
            if (clippedEnd - gridStart >= durationMin) return gridStart
        } else {
            runStart = null
        }
    }
    return null
}

/**
 * For each plant AND each slot size (big / medium / small), find the earliest
 * start time where that plant has enough surplus trucks to accept the job
 * without dropping below its required truck floor.
 */
export const computeSuggestedSlots = (orders, initialPoolByCode, getTravelOverrides, helpTransfers) => {
    const { timelineByPlant } = simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers)
    const results = []
    Object.entries(timelineByPlant || {}).forEach(([plantCode, timeline]) => {
        for (const slot of SUGGESTED_SLOT_TYPES) {
            const earliest = findEarliestIdleTime(timeline, slot.minTrucks)
            if (earliest != null) results.push({ ...slot, plantCode, time: earliest })
        }
    })
    return results
}

/** Sort orders by truck-count descending, then yardage descending. Used to
 *  best-fit candidates into surplus windows. */
function bestFitCandidates(plantOrders, plantCode, getTravelOverrides) {
    return plantOrders
        .map(({ order, startMin }) => {
            const overrides = typeof getTravelOverrides === 'function' ? getTravelOverrides(order) || {} : {}
            const truckCount = getCalculatedTruckCount(order, overrides)
            const pourDurationMin = getOrderPourDurationMinutes(order) || 60
            const yardage = parseFloat(order?.yardage) || 0
            return { order, overrides, plantCode, pourDurationMin, startMin, truckCount, yardage }
        })
        .filter((c) => c.truckCount > 0)
        .sort((a, b) => b.truckCount - a.truckCount || b.yardage - a.yardage)
}

/**
 * Find later orders that could be pulled into earlier surplus windows so the
 * schedule compacts instead of leaving idle trucks waiting for a downstream
 * spike. The trigger is dip-then-spike: a plant has surplus trucks now AND
 * needs them again later (the candidate order itself is the spike). Pulling
 * the order up keeps those trucks productive instead of sitting idle.
 *
 * Selection is best-fit by truck count — largest order that fits the surplus
 * window goes first so we maximize utilization.
 */
export const computePullUpRows = (orders, initialPoolByCode, getTravelOverrides, helpTransfers) => {
    const { timelineByPlant } = simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers)
    const ordersByPlant = new Map()
    for (const order of orders || []) {
        if (isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (startMin == null) continue
        const list = ordersByPlant.get(order.plantCode) || []
        list.push({ order, startMin })
        ordersByPlant.set(order.plantCode, list)
    }
    const rows = []
    ordersByPlant.forEach((plantOrders, plantCode) => {
        const timeline = timelineByPlant?.[plantCode]
        if (!Array.isArray(timeline) || timeline.length === 0) return
        const candidates = bestFitCandidates(plantOrders, plantCode, getTravelOverrides)
        // Reserve each 30-minute window we recommend so two candidates don't
        // both target the same surplus slot.
        const reservedSlotKeys = new Set()
        candidates.forEach((c) => {
            const viableStart = findNextViableStart(timeline, c.truckCount, SLOT_DAY_START_MIN, c.pourDurationMin)
            if (viableStart == null || viableStart >= c.startMin) return
            const pullUpDeltaMin = c.startMin - viableStart
            if (pullUpDeltaMin < PULL_UP_MIN_DELTA_MIN) return
            const slotKey = Math.floor(viableStart / 30)
            if (reservedSlotKeys.has(slotKey)) return
            reservedSlotKeys.add(slotKey)
            rows.push({
                notifyByMin: viableStart - PULL_UP_LEAD_NOTICE_MIN,
                order: c.order,
                originalStartMin: c.startMin,
                plantCode,
                pourDurationMin: c.pourDurationMin,
                pullUpDeltaMin,
                suggestedStartMin: viableStart,
                time: viableStart,
                truckCount: c.truckCount,
                yardage: c.yardage
            })
        })
    })
    return rows
}
