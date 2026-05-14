import {
    EARLY_ARRIVAL_MINUTES,
    KICKER_RESERVE_BASE_TRUCKS,
    KICKER_RESERVE_BIG_POUR_TRUCKS,
    KICKER_RESERVE_BLOCK_SIZE,
    KICKER_RESERVE_MAX_DURATION_MIN,
    KICKER_RESERVE_MIN_DURATION_MIN,
    LOAD_MINUTES,
    PRE_TRIP_MINUTES,
    SLUMP_MINUTES,
    TRUCK_ON_SITE_MINUTES
} from '../../app/constants/planConstants'
import { getCalculatedTruckCount, isBigPourOrder, isExcludedOrder } from './planOrder'
import { parseDurationMinutes, timeToMinutes } from './planTime'

/** Per-truck return times — trucks cycle round-robin so truck i's last
 *  trip is the largest k ≤ tripsTotal-1 where k % truckCount === i. */
function computeReturnTimesByTruck(startMin, truckCount, tripsTotal, spacingMin, cycleMin) {
    const times = []
    for (let i = 0; i < truckCount; i++) {
        const j = tripsTotal - 1 - i
        if (j < 0) continue
        const lastTripIdx = Math.floor(j / truckCount) * truckCount + i
        times.push(startMin + lastTripIdx * spacingMin + cycleMin)
    }
    return times
}

/** Push the dispatch + per-truck return events for one order. */
function pushOrderEvents(events, byOrder, order, getTravelOverrides) {
    if (isExcludedOrder(order)) return
    const startMin = timeToMinutes(order?.startTime)
    if (startMin == null) return
    const overrides = typeof getTravelOverrides === 'function' ? getTravelOverrides(order) || {} : {}
    const truckCount = getCalculatedTruckCount(order, overrides)
    if (!truckCount) return
    const toJobMin = Number.isFinite(overrides?.toJobMin)
        ? overrides.toJobMin
        : (parseDurationMinutes(order?.toJobTime) ?? 20)
    const toPlantMin = Number.isFinite(overrides?.toPlantMin)
        ? overrides.toPlantMin
        : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
    const spacingMin = parseDurationMinutes(order?.rate) ?? 5
    const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
    const loadSize = parseFloat(order?.loadSize) || 0
    const yardage = parseFloat(order?.yardage) || 0
    const tripsTotal = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : truckCount
    const tripsPerTruck = Math.max(1, Math.ceil(tripsTotal / truckCount))
    const returnTimesByTruck = computeReturnTimesByTruck(startMin, truckCount, tripsTotal, spacingMin, cycleMin)
    const lastReturnMinutes = returnTimesByTruck.length ? Math.max(...returnTimesByTruck) : startMin + cycleMin
    const firstReturnMinutes = returnTimesByTruck.length ? Math.min(...returnTimesByTruck) : startMin + cycleMin
    const orderKey =
        order.orderId ||
        `${order.plantCode ?? 'unknown'}-${startMin}-${order.orderNum ?? Math.random().toString(36).slice(2, 8)}`
    events.push({ count: truckCount, orderKey, plantCode: order.plantCode, time: startMin, type: 'dispatch' })
    returnTimesByTruck.forEach((returnMin) => {
        events.push({ count: 1, orderKey, plantCode: order.plantCode, time: returnMin, type: 'return' })
    })
    byOrder[orderKey] = {
        dispatchMinutes: startMin,
        firstReturnMinutes,
        lastReturnMinutes,
        plantCode: order.plantCode,
        returnEvents: [],
        returnTimesByTruck,
        tripsPerTruck,
        tripsTotal,
        truckCount
    }
}

/** Adds dispatch + return events for kicker reserves — held-back trucks
 *  per block of jobs that absorb late yardage additions. */
function addKickerReserves(orders, events, byOrder) {
    const ordersByPlantSorted = {}
    for (const order of orders || []) {
        if (isExcludedOrder(order)) continue
        if (!order?.plantCode) continue
        const startMin = timeToMinutes(order?.startTime)
        if (startMin == null) continue
        if (!ordersByPlantSorted[order.plantCode]) ordersByPlantSorted[order.plantCode] = []
        ordersByPlantSorted[order.plantCode].push({ order, startMin })
    }
    const kickerReservesByPlant = {}
    Object.entries(ordersByPlantSorted).forEach(([plantCode, list]) => {
        list.sort((a, b) => a.startMin - b.startMin)
        const reserves = []
        for (let i = 0; i + KICKER_RESERVE_BLOCK_SIZE - 1 < list.length; i += KICKER_RESERVE_BLOCK_SIZE) {
            const block = list.slice(i, i + KICKER_RESERVE_BLOCK_SIZE)
            const hasBigPour = block.some(({ order }) => isBigPourOrder(order))
            const reserveCount = hasBigPour ? KICKER_RESERVE_BIG_POUR_TRUCKS : KICKER_RESERVE_BASE_TRUCKS
            const firstStart = block[0].startMin
            const lastStart = block[block.length - 1].startMin
            const span = Math.max(0, lastStart - firstStart)
            // Reserve duration tracks how spread out the block is — tightly
            // packed jobs release sooner, dispersed blocks hold longer —
            // clamped to 2–3 hours so we always anticipate the next chunk
            // of kickers without deadlocking the pool.
            const reserveDur = Math.max(
                KICKER_RESERVE_MIN_DURATION_MIN,
                Math.min(KICKER_RESERVE_MAX_DURATION_MIN, span + 60)
            )
            // Activate the reserve at the LAST job of the block, not the
            // first — that way the pool drains gradually as the day fills
            // up instead of dropping a stack of trucks at the morning rush.
            const holdStart = lastStart
            const holdEnd = holdStart + reserveDur
            events.push({
                count: reserveCount,
                kicker: true,
                orderKey: null,
                plantCode,
                time: holdStart,
                type: 'dispatch'
            })
            events.push({
                count: reserveCount,
                kicker: true,
                orderKey: null,
                plantCode,
                time: holdEnd,
                type: 'return'
            })
            reserves.push({ count: reserveCount, hasBigPour, holdEnd, holdStart })
        }
        if (reserves.length > 0) kickerReservesByPlant[plantCode] = reserves
    })
    // Point-sample held-back trucks at each order's dispatch minute.
    Object.entries(byOrder).forEach(([, entry]) => {
        const reserves = kickerReservesByPlant[entry.plantCode] || []
        let held = 0
        let bigPour = false
        for (const r of reserves) {
            if (r.holdStart <= entry.dispatchMinutes && r.holdEnd > entry.dispatchMinutes) {
                held += r.count
                if (r.hasBigPour) bigPour = true
            }
        }
        entry.kickerHeldAtDispatch = held
        entry.kickerBigPourActive = bigPour
    })
}

/** Credit each order with TRUE inbound help — inter-plant transfers landing
 *  at this plant during the pour window. Order-cycle returns and kicker
 *  reserves do NOT count: those trucks are already committed elsewhere. */
function annotateInboundDuringPour(events, byOrder) {
    Object.entries(byOrder).forEach(([_orderKey, entry]) => {
        let inboundDuringPour = 0
        for (const event of events) {
            if (event.plantCode !== entry.plantCode) continue
            if (event.type !== 'return') continue
            if (event.orderKey !== null) continue
            if (event.kicker) continue
            if (event.time <= entry.dispatchMinutes || event.time > entry.lastReturnMinutes) continue
            inboundDuringPour += event.count
        }
        entry.inboundDuringPour = inboundDuringPour
    })
}

/** Help transfers from the planner — inter-plant truck movements that
 *  adjust the pool at the transfer time (not all-at-once at day start).
 *  Handled as return/dispatch events so the existing ordering rule
 *  (returns before dispatches at the same minute) keeps the pool honest. */
function pushHelpTransferEvents(events, helpTransfers) {
    for (const transfer of helpTransfers || []) {
        if (!transfer?.plantCode) continue
        if (!Number.isFinite(transfer.time) || !Number.isFinite(transfer.delta) || transfer.delta === 0) continue
        events.push({
            count: Math.abs(transfer.delta),
            orderKey: null,
            plantCode: transfer.plantCode,
            time: transfer.time,
            type: transfer.delta > 0 ? 'return' : 'dispatch'
        })
    }
}

/**
 * Internal simulation — builds the event list, runs it, and returns both the
 * per-order summary (`byOrder`) and the per-plant pool timeline
 * (`timelineByPlant`). Public wrappers below pick the slice they need.
 *
 * Model — the pool is locked until the pour is done:
 *   - At each order's start time, pool[plant] -= requiredTrucks.
 *   - Long pours (trips > trucks) force each truck to make multiple runs;
 *     short pours (trips ≤ trucks) use each truck once. Either way a truck
 *     is tied up until the *last* trip it runs returns to the plant.
 *   - We refund per-truck return events so the pool ticks up gradually
 *     through the pour instead of snapping up at the end.
 *   - Cancelled orders are skipped entirely.
 */
export const simulatePoolTimeline = (orders, initialPoolByCode = {}, getTravelOverrides = null, helpTransfers = []) => {
    const events = []
    const byOrder = {}

    pushHelpTransferEvents(events, helpTransfers)
    for (const order of orders || []) {
        pushOrderEvents(events, byOrder, order, getTravelOverrides)
    }
    addKickerReserves(orders || [], events, byOrder)
    annotateInboundDuringPour(events, byOrder)

    // Return events go before dispatches at the same timestamp so trucks
    // refund themselves *before* we subtract for the next order.
    events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time
        if (a.type === b.type) return 0
        return a.type === 'return' ? -1 : 1
    })

    const pool = { ...initialPoolByCode }
    const timelineByPlant = {}
    Object.entries(initialPoolByCode).forEach(([code, value]) => {
        timelineByPlant[code] = [{ isInitial: true, pool: value, time: null }]
    })

    for (const event of events) {
        const plantPool = pool[event.plantCode] ?? 0
        let nextPool
        if (event.type === 'return') {
            nextPool = plantPool + event.count
            if (event.orderKey && byOrder[event.orderKey]) {
                const entry = byOrder[event.orderKey]
                entry.poolAfterReturn = nextPool
                if (Array.isArray(entry.returnEvents)) {
                    entry.returnEvents.push({ count: event.count, poolAfter: nextPool, time: event.time })
                }
            }
        } else {
            if (event.orderKey && byOrder[event.orderKey]) {
                const entry = byOrder[event.orderKey]
                entry.poolAtDispatch = plantPool
                entry.poolAfterDispatch = plantPool - event.count
                entry.poolAfterDispatchEffective = plantPool - event.count + (entry.inboundDuringPour || 0)
            }
            nextPool = plantPool - event.count
        }
        pool[event.plantCode] = nextPool
        if (!timelineByPlant[event.plantCode]) {
            timelineByPlant[event.plantCode] = [{ isInitial: true, pool: 0, time: null }]
        }
        timelineByPlant[event.plantCode].push({
            delta: event.count * (event.type === 'return' ? 1 : -1),
            pool: nextPool,
            time: event.time,
            type: event.type
        })
    }
    return { byOrder, timelineByPlant }
}

/** Public wrapper — returns only `byOrder`. */
export const computePlantPoolTimeline = (orders, initialPoolByCode, getTravelOverrides, helpTransfers) =>
    simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers).byOrder

/** Per-plant pool timelines — each plant gets an ordered list of
 *  `{ time, pool, type }` entries representing the pool state after each
 *  dispatch / return / help event. Use with `poolAtTime(timeline, t)` to
 *  answer "what was the pool at plant X at time Y?". */
export const computePlantPoolTimelines = (orders, initialPoolByCode, getTravelOverrides, helpTransfers) =>
    simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers).timelineByPlant

/** Pool value at plant at a specific minute. Takes the last known pool state
 *  at or before the queried time. Returns the initial pool when the time
 *  predates any event, or `null` if the timeline is empty. */
export const poolAtTime = (timeline, timeMin) => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null
    if (!Number.isFinite(timeMin)) return timeline[timeline.length - 1].pool
    let current = timeline[0].pool
    for (let i = 1; i < timeline.length; i++) {
        const entryTime = timeline[i].time
        if (!Number.isFinite(entryTime)) continue
        if (entryTime > timeMin) break
        current = timeline[i].pool
    }
    return current
}

/**
 * Build a chronological list of operator clock-in events per plant. Operators
 * aren't sitting in the pool at midnight — they clock in just-in-time for the
 * orders that need them. Each event represents one operator clocking in.
 */
export const computeClockInRows = (orders, baseByPlant, getTravelOverrides) => {
    const rows = []
    const byPlant = {}
    ;(orders || []).forEach((o) => {
        if (isExcludedOrder(o)) return
        if (timeToMinutes(o?.startTime) == null) return
        if (!o?.plantCode) return
        if (!byPlant[o.plantCode]) byPlant[o.plantCode] = []
        byPlant[o.plantCode].push(o)
    })
    Object.entries(byPlant).forEach(([code, plantOrders]) => {
        const base = baseByPlant?.[code] ?? 0
        if (base <= 0) return
        plantOrders.sort((a, b) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0))
        const events = []
        let clockedIn = 0
        for (const order of plantOrders) {
            const startMin = timeToMinutes(order.startTime)
            const overrides = typeof getTravelOverrides === 'function' ? getTravelOverrides(order) || {} : {}
            const truckCount = getCalculatedTruckCount(order, overrides)
            if (!truckCount) continue
            const spacing = parseDurationMinutes(order?.rate) ?? 5
            const toJobMin = Number.isFinite(overrides?.toJobMin)
                ? overrides.toJobMin
                : (parseDurationMinutes(order?.toJobTime) ?? 20)
            const toPlantMin = Number.isFinite(overrides?.toPlantMin)
                ? overrides.toPlantMin
                : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
            const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
            const loadSize = parseFloat(order?.loadSize) || 0
            const yardage = parseFloat(order?.yardage) || 0
            const tripsTotal = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : truckCount
            // Simulate pool state right before this dispatch.
            let pool = clockedIn
            for (const ev of events) {
                if (ev.time > startMin) continue
                pool += ev.type === 'return' ? ev.count : -ev.count
            }
            const shortfall = Math.max(0, truckCount - pool)
            const toClockIn = Math.min(shortfall, base - clockedIn)
            const arrivalPrepMin = PRE_TRIP_MINUTES + LOAD_MINUTES + SLUMP_MINUTES + EARLY_ARRIVAL_MINUTES
            const clockInOffset = toJobMin + arrivalPrepMin
            const poolBase = Math.max(0, pool)
            for (let i = 0; i < toClockIn; i++) {
                const dispatchIdx = poolBase + i
                const slot = startMin + dispatchIdx * spacing
                const raw = Math.max(0, slot - clockInOffset)
                const t = Math.round(raw / 5) * 5
                rows.push({
                    count: 1,
                    forOrder: order,
                    forOrderId: order.orderId || order.orderNum || null,
                    plantCode: code,
                    time: t
                })
            }
            clockedIn += toClockIn
            events.push({ count: truckCount, time: startMin, type: 'dispatch' })
            for (let i = 0; i < truckCount; i++) {
                const j = tripsTotal - 1 - i
                if (j < 0) continue
                const lastTripIdx = Math.floor(j / truckCount) * truckCount + i
                const returnTime = startMin + lastTripIdx * spacing + cycleMin
                events.push({ count: 1, time: returnTime, type: 'return' })
            }
        }
    })
    return rows
}

/**
 * Determine when operators can be safely sent home during the day.
 *
 * For each plant, compute the "min future pool" at every event boundary. Once
 * that minimum grows past the running send-home total, the excess operators
 * are surplus from that point on — they can clock out. We only emit rows at
 * pool-increase events (returns / help arrivals) since those are the moments
 * trucks are physically back at the plant and free to leave.
 */
export const computeSendHomeRows = (orders, initialPoolByCode, getTravelOverrides, helpTransfers) => {
    const { timelineByPlant } = simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers)
    const rows = []
    Object.entries(timelineByPlant || {}).forEach(([plantCode, timeline]) => {
        if (!Array.isArray(timeline) || timeline.length < 2) return
        // Reverse pass: minFuture[i] = min pool value from index i to the end.
        const minFuture = new Array(timeline.length)
        let running = Infinity
        for (let i = timeline.length - 1; i >= 0; i--) {
            if (timeline[i].pool < running) running = timeline[i].pool
            minFuture[i] = running
        }
        let sentHome = 0
        let prevPool = timeline[0].pool
        for (let i = 1; i < timeline.length; i++) {
            const entry = timeline[i]
            const poolIncreased = entry.pool > prevPool
            prevPool = entry.pool
            if (!poolIncreased) continue
            const budget = minFuture[i]
            if (budget > sentHome) {
                rows.push({
                    count: budget - sentHome,
                    plantCode,
                    pool: entry.pool,
                    poolAfter: entry.pool - budget,
                    surplus: budget,
                    time: entry.time
                })
                sentHome = budget
            }
        }
    })
    return rows
}
