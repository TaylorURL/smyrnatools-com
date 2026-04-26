// Plan utility functions and constants

export const PRE_TRIP_MINUTES = 15
export const BUFFER_MINUTES = 5
/** Minutes a truck spends loading concrete at the plant. */
export const LOAD_MINUTES = 10
/** Minutes for the slump / QC test before the truck leaves the plant. */
export const SLUMP_MINUTES = 5
/** Minutes the truck should arrive at the job AHEAD of the order's start
 *  time so the operator isn't pulling up at the same moment concrete is
 *  expected on the ground. */
export const EARLY_ARRIVAL_MINUTES = 5
export const AUTOSAVE_DELAY_MS = 1000
export const DEFAULT_STAGGER_MINUTES = 5
export const OVERTIME_THRESHOLD_HOURS = 12
export const GAP_THRESHOLD_MINUTES = 30
export const TARGET_YPH = 3 // minimum yards/hr/op target
export const MAX_YPH = 5 // above this, operators can't keep up

/** Sentinel start times the dispatch HTML uses to flag special order states.
 *  17:00 means the order was cancelled — we keep showing it for transparency
 *  but exclude it from yardage / truck / KPI totals.
 *  18:00 flags a dispatcher test order — not a real pour, always excluded. */
export const CANCELLED_ORDER_START = '17:00'
export const SAME_DAY_ORDER_START = '15:00'
export const TEST_ORDER_START = '18:00'

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

/**
 * Big-pour rule — fires on any order that's ≥ 120 yd total AND scheduled
 * with back-to-back spacing (< 10 min between trucks). "Back-to-back" means
 * we're loading trucks as fast as we can, typically 5–10 min apart. Jobs
 * this size run long, and at that cadence the pool stays locked until the
 * whole pour is done — so if we under-staff the floor, the rest of the
 * day's schedule slips while trucks finish cycling this one.
 *
 * When the rule fires, require at least `BIG_POUR_MIN_TRUCKS` in rotation
 * (or the travel-rotation requirement, whichever is larger).
 *
 * The goal on every order is to sustain its pour rate *loaded* — keep a
 * truck arriving every `rate` minutes. We compute the truck count needed
 * from the round-trip cycle (travel-to-job + travel-back + on-site time),
 * then floor big pours at `BIG_POUR_MIN_TRUCKS` so service never slips.
 */
export const BIG_POUR_YARDAGE_THRESHOLD = 120
export const BIG_POUR_SPACING_THRESHOLD_MIN = 10
export const BIG_POUR_MIN_TRUCKS = 12
/** Minutes each truck spends on-site pouring at the job (load + unload +
 *  maneuvering + buffer per operator). Added into the cycle time alongside
 *  travel-to-job and travel-back so `cycleMin` reflects the real round-trip
 *  length, not just windshield time. */
export const TRUCK_ON_SITE_MINUTES = 30

/**
 * Weekend availability rules:
 *   - Sunday  → plants are closed. Pool = 0.
 *   - Saturday → half crew on. Base mixer count is halved (rounded down so
 *     the plan stays conservative).
 *   - All other days → full base.
 */
export const getPoolDayMultiplier = (planDate) => {
    if (!planDate) return 1
    const parts = String(planDate)
        .split('-')
        .map((v) => parseInt(v, 10))
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return 1
    const [year, month, day] = parts
    const dow = new Date(year, month - 1, day).getDay()
    if (dow === 0) return 0
    if (dow === 6) return 0.5
    return 1
}

/** True when the plan date falls on a Sunday (plants closed). */
export const isClosedDay = (planDate) => getPoolDayMultiplier(planDate) === 0

/** Apply the day-of-week multiplier to a base mixer count. Rounds down so
 *  we never overestimate on Saturdays. */
export const adjustPoolForDate = (base, planDate) => {
    const multiplier = getPoolDayMultiplier(planDate)
    if (multiplier >= 1) return Number.isFinite(base) ? base : 0
    if (multiplier <= 0) return 0
    return Math.floor((Number.isFinite(base) ? base : 0) * multiplier)
}

/**
 * Canonical plant-badge colors. Shared across every view that draws a plant
 * marker (Schedule badge, Demand charts, Planner node hints, …) so the same
 * plant always reads as the same hue. Values picked to work in both light
 * and dark themes with a white foreground; `eab308` gets dark text.
 */
export const PLANT_BADGE_COLORS = {
    401: '#f97316', // orange
    402: '#15803d', // dark green
    403: '#7c3aed', // purple
    405: '#b98a50', // tan
    406: '#06b6d4', // cyan
    407: '#0d9488', // teal
    408: '#4f46e5', // indigo — Conroe
    410: '#6b7280', // gray
    453: '#a855f7', // lighter purple
    455: '#d4a373', // lighter tan
    461: '#2563eb', // blue
    468: '#eab308' // yellow
}

/** Canonical per-plant color lookup. Falls back to the caller's `fallback`
 *  when the plant isn't in the shared map. */
export const plantBadgeColor = (code, fallback) => PLANT_BADGE_COLORS[String(code)] || fallback

/** Key under which plan-level metadata rides on the plantProduction object.
 *  Other plant-code keys store real production data; this one stashes
 *  operator shortfalls, special-job flags, etc. */
export const PLAN_META_KEY = '_meta'

/** Count of operators the dispatcher has marked as missing at this plant
 *  (sick, vacation, etc.). Subtracted from the base pool in every truck
 *  calculation so the schedule reflects actual availability. */
export const getMissingOperators = (plantProduction, plantCode) => {
    const raw = plantProduction?.[PLAN_META_KEY]?.missingByPlant?.[plantCode]
    const value = parseInt(raw, 10)
    return Number.isFinite(value) && value > 0 ? value : 0
}

/** Persist the missing-operator count for a plant. Clamps to 0 so the
 *  caller never needs to guard against negatives. */
export const setMissingOperators = (setPlantProduction, plantCode, count) => {
    if (typeof setPlantProduction !== 'function' || !plantCode) return
    const safe = Math.max(0, parseInt(count, 10) || 0)
    setPlantProduction((prev) => {
        const next = { ...(prev || {}) }
        const meta = { ...(next[PLAN_META_KEY] || {}) }
        const missing = { ...(meta.missingByPlant || {}) }
        if (safe <= 0) {
            delete missing[plantCode]
        } else {
            missing[plantCode] = safe
        }
        meta.missingByPlant = missing
        next[PLAN_META_KEY] = meta
        return next
    })
}

/** Compute the effective base pool for a plant on a given plan date:
 *  weekend-adjusted base, minus any operators the dispatcher has marked
 *  missing. Clamps at 0 so an over-aggressive shortfall never drives the
 *  pool negative before the simulation even runs. */
export const getEffectiveBase = (rawBase, plantCode, plantProduction, planDate) => {
    const adjusted = adjustPoolForDate(rawBase, planDate)
    const missing = getMissingOperators(plantProduction, plantCode)
    return Math.max(0, adjusted - missing)
}

/**
 * Per-driver arrive + leave times for a planner assignment. Respects both
 * scheduling modes:
 *   - `timeMode: 'stagger'` — each driver lands `staggerMinutes` after the
 *     previous one, starting from `time`. Leave time applies to all.
 *   - `timeMode: 'custom'` — arrive and leave come from `customTimes[i]`.
 *
 * Every downstream consumer (pool simulation, help rows, flow-view time
 * scrubber) should build events from this function so the whole app treats
 * staggered crew arrivals/returns identically.
 *
 * @returns {Array<{ driverIndex, arriveMin, leaveMin }>}
 */
export const buildAssignmentDriverTimes = (assignment) => {
    const count = parseInt(assignment?.driverCount, 10) || 0
    if (count <= 0) return []
    const stagger = parseInt(assignment?.staggerMinutes, 10) || 0
    const isCustom = assignment?.timeMode === 'custom' && Array.isArray(assignment?.customTimes)
    const baseArrive = timeToMinutes(assignment?.time)
    const baseLeave = timeToMinutes(assignment?.leaveTime)
    const result = []
    for (let i = 0; i < count; i++) {
        let arriveMin = null
        let leaveMin = null
        if (isCustom) {
            const ct = assignment.customTimes[i] || {}
            arriveMin = timeToMinutes(ct.time)
            leaveMin = timeToMinutes(ct.leaveTime)
        } else {
            if (Number.isFinite(baseArrive)) arriveMin = baseArrive + i * stagger
            leaveMin = baseLeave
        }
        result.push({
            arriveMin: Number.isFinite(arriveMin) ? arriveMin : null,
            driverIndex: i,
            leaveMin: Number.isFinite(leaveMin) ? leaveMin : null
        })
    }
    return result
}

/** Parse an `HH:MM` (or `H:MM`) duration from the dispatch report into minutes. */
const parseDurationMinutes = (value) => {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hours = parseInt(m[1], 10)
    const mins = parseInt(m[2], 10)
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
    const total = hours * 60 + mins
    return total > 0 ? total : null
}

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
    // Spacing needed for 120 yd/hr = loadSize / 2 minutes.
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
 * The `overrides` object can supply `toJobMin` / `toPlantMin` derived from
 * live Google Distance Matrix lookups so the table reflects real driving
 * time instead of the dispatch report's (sometimes optimistic) estimate.
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
    // Cap at actual trips so short pours don't get inflated by long cycles.
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
 *  trucks than it has loads. Accepts live travel overrides so the number
 *  matches reality, not the dispatch estimate. */
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

/** How many trucks the order is short of its effective minimum.
 *  Returns 0 when the order is adequately staffed or when we can't compute. */
export const getTruckShortfall = (order, overrides) => {
    const needed = getEffectiveMinTrucks(order, overrides || {})
    if (!needed) return 0
    const scheduled = parseFloat(order?.truckCount) || 0
    return Math.max(0, needed - scheduled)
}

/**
 * Simulate per-plant truck pools through the day.
 *
 * Model — the pool is locked until the pour is done:
 *   - At each order's start time, pool[plant] -= requiredTrucks.
 *   - Long pours (trips > trucks) force each truck to make multiple runs;
 *     short pours (trips ≤ trucks) use each truck once. Either way a truck
 *     is tied up until the *last* trip it runs returns to the plant.
 *   - We conservatively refund the whole squad at `lastReturnMinutes`
 *     (= startTime + (trips − 1) × spacing + cycleMin). That keeps the
 *     pool honest even for multi-trip rotations.
 *   - First-truck-back time is surfaced separately for the return row and
 *     visual arrows: `startTime + min(trucks, trips) × 0 cycleMin` — i.e.
 *     the first truck comes home one full cycle after dispatch.
 *   - Cancelled orders are skipped entirely.
 *
 * @returns {Object} Map `orderKey → { poolAtDispatch, poolAfterDispatch,
 *                                     firstReturnMinutes, lastReturnMinutes,
 *                                     dispatchMinutes, plantCode, truckCount,
 *                                     tripsTotal, tripsPerTruck }`
 */
/**
 * Internal simulation — builds the event list, runs it, and returns both the
 * per-order summary (`byOrder`) and the per-plant pool timeline
 * (`timelineByPlant`). Public `computePlantPoolTimeline` and
 * `computeSendHomeRows` wrap this so each caller can pick the slice it needs
 * without duplicating the event-building logic.
 */
const simulatePoolTimeline = (orders, initialPoolByCode = {}, getTravelOverrides = null, helpTransfers = []) => {
    const events = []
    const byOrder = {}
    // Help transfers from the planner — inter-plant truck movements that
    // adjust the pool at the transfer time (not all-at-once at day start).
    // A positive `delta` means trucks arrive at `plantCode`; negative means
    // they leave. Handled as return/dispatch events so the existing ordering
    // rule (returns before dispatches at the same minute) keeps the pool
    // honest when a handoff lands on the same timestamp as an order.
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
    for (const order of orders || []) {
        if (isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (startMin == null) continue
        const overrides = typeof getTravelOverrides === 'function' ? getTravelOverrides(order) || {} : {}
        const truckCount = getCalculatedTruckCount(order, overrides)
        if (!truckCount) continue
        const toJobMin = Number.isFinite(overrides?.toJobMin)
            ? overrides.toJobMin
            : (parseDurationMinutes(order?.toJobTime) ?? 20)
        const toPlantMin = Number.isFinite(overrides?.toPlantMin)
            ? overrides.toPlantMin
            : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
        const spacingMin = parseDurationMinutes(order?.rate) ?? 5
        const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
        // Total trips in the pour = how many times a truck has to roll.
        const loadSize = parseFloat(order?.loadSize) || 0
        const yardage = parseFloat(order?.yardage) || 0
        const tripsTotal = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : truckCount
        const tripsPerTruck = Math.max(1, Math.ceil(tripsTotal / truckCount))
        // Per-truck last-trip return time. Trucks cycle round-robin: trip k
        // goes to truck (k % truckCount), so truck i's last trip is the
        // largest k ≤ tripsTotal-1 where k % truckCount === i. Each truck
        // comes home individually — dispatchers see one return row per
        // truck, not one bulk "all 14 back" row at the end of the pour.
        const returnTimesByTruck = []
        for (let i = 0; i < truckCount; i++) {
            const j = tripsTotal - 1 - i
            if (j < 0) continue
            const lastTripIdx = Math.floor(j / truckCount) * truckCount + i
            returnTimesByTruck.push(startMin + lastTripIdx * spacingMin + cycleMin)
        }
        const lastReturnMinutes = returnTimesByTruck.length ? Math.max(...returnTimesByTruck) : startMin + cycleMin
        const firstReturnMinutes = returnTimesByTruck.length ? Math.min(...returnTimesByTruck) : startMin + cycleMin
        const orderKey =
            order.orderId ||
            `${order.plantCode ?? 'unknown'}-${startMin}-${order.orderNum ?? Math.random().toString(36).slice(2, 8)}`
        events.push({
            count: truckCount,
            orderKey,
            plantCode: order.plantCode,
            time: startMin,
            type: 'dispatch'
        })
        // One return event per truck so the pool ticks up gradually through
        // the pour instead of snapping up by `truckCount` at the end.
        returnTimesByTruck.forEach((returnMin) => {
            events.push({
                count: 1,
                orderKey,
                plantCode: order.plantCode,
                time: returnMin,
                type: 'return'
            })
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
    // Credit each order only with TRUE inbound help — inter-plant transfers
    // arriving at this plant during its pour window. Help-transfer events
    // carry `orderKey === null`; order-cycle returns carry a real orderKey
    // and are excluded because those trucks are committed to keeping their
    // own order cycling, not free to absorb extra trips on this one. Counting
    // them previously made the per-order coverage hover disagree with the
    // plant timeline (which correctly showed a deficit) and the planner's
    // YPH flag — every order looked "covered" while the plant was overbooked.
    Object.entries(byOrder).forEach(([orderKey, entry]) => {
        let inboundDuringPour = 0
        for (const event of events) {
            if (event.plantCode !== entry.plantCode) continue
            if (event.type !== 'return') continue
            if (event.orderKey !== null) continue
            if (event.time <= entry.dispatchMinutes || event.time > entry.lastReturnMinutes) continue
            inboundDuringPour += event.count
        }
        entry.inboundDuringPour = inboundDuringPour
    })
    // Return events go before dispatches at the same timestamp so trucks
    // refund themselves *before* we subtract for the next order.
    events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time
        if (a.type === b.type) return 0
        return a.type === 'return' ? -1 : 1
    })
    const pool = { ...initialPoolByCode }
    const timelineByPlant = {}
    // Seed initial entries so the timeline starts at the base pool value, even
    // for plants that never see an event.
    Object.entries(initialPoolByCode).forEach(([code, value]) => {
        timelineByPlant[code] = [{ isInitial: true, pool: value, time: null }]
    })
    for (const event of events) {
        const plantPool = pool[event.plantCode] ?? 0
        let nextPool
        if (event.type === 'return') {
            nextPool = plantPool + event.count
            // Record each return event so the schedule can render one row
            // per truck (or grouped batch) and show the live pool count at
            // the moment that truck comes home. `poolAfterReturn` tracks
            // the latest value so legacy callers keep working.
            if (event.orderKey && byOrder[event.orderKey]) {
                const entry = byOrder[event.orderKey]
                entry.poolAfterReturn = nextPool
                if (Array.isArray(entry.returnEvents)) {
                    entry.returnEvents.push({
                        count: event.count,
                        poolAfter: nextPool,
                        time: event.time
                    })
                }
            }
        } else {
            if (byOrder[event.orderKey]) {
                byOrder[event.orderKey].poolAtDispatch = plantPool
                byOrder[event.orderKey].poolAfterDispatch = plantPool - event.count
                // Effective pool counts help that arrives during the pour
                // window — even if we start short, late-arriving trucks still
                // cover later trips, so the job's deficit shrinks by that
                // inbound help.
                // Effective pool credits inbound trucks landing during the
                // pour window (other orders' returns + help arrivals). Those
                // trucks are physically at the plant while the pour is still
                // running, so they naturally cover later trips.
                byOrder[event.orderKey].poolAfterDispatchEffective =
                    plantPool - event.count + (byOrder[event.orderKey].inboundDuringPour || 0)
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

/**
 * Public wrapper — returns only `byOrder`. See `simulatePoolTimeline` for the
 * full model. Existing callers keep the previous return shape.
 */
export const computePlantPoolTimeline = (orders, initialPoolByCode, getTravelOverrides, helpTransfers) =>
    simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers).byOrder

/**
 * Build a chronological list of operator clock-in events per plant. Operators
 * aren't sitting in the pool at midnight — they clock in just-in-time for the
 * orders that need them. Each event represents one operator clocking in.
 *
 * Algorithm (per plant):
 *   1. Walk orders in start-time order.
 *   2. For each order, simulate the pool from prior dispatches/returns to find
 *      how many trucks are physically at the plant just before it dispatches.
 *   3. If the order needs more trucks than are at-plant, schedule additional
 *      clock-ins (capped at the plant's effective base) ending at start-time
 *      and staggered backward by the order's spacing — so the last operator
 *      clocks in right at dispatch and earlier ones arrive in time to load.
 *
 * Returns rows shaped `{ plantCode, time, count, forOrder, forOrderId }` —
 * one row per operator. Convert to positive-delta help-transfer events for
 * the simulator so the pool builds up as the day unfolds instead of starting
 * at full strength.
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
            // Simulate pool state right before this dispatch — sum prior
            // returns (add) and prior dispatches (subtract) at times <=
            // startMin. Same-minute dispatches haven't been "consumed" yet
            // because we process orders in iteration order.
            let pool = clockedIn
            for (const ev of events) {
                if (ev.time > startMin) continue
                pool += ev.type === 'return' ? ev.count : -ev.count
            }
            const shortfall = Math.max(0, truckCount - pool)
            const toClockIn = Math.min(shortfall, base - clockedIn)
            // Real prep time before a truck leaves the plant: 15 min pre-trip
            // + 10 min loading + 5 min slump test. Plus the truck has to drive
            // toJobMin to the site and arrive ~5 min before the order's start
            // time. So each operator's clock-in must land that far AHEAD of
            // when their truck is supposed to be on the job.
            const arrivalPrepMin = PRE_TRIP_MINUTES + LOAD_MINUTES + SLUMP_MINUTES + EARLY_ARRIVAL_MINUTES
            const clockInOffset = toJobMin + arrivalPrepMin
            for (let i = 0; i < toClockIn; i++) {
                // The original `slot` staggers operators back from startMin by
                // the pour spacing — keep that relative cadence so trucks
                // still load in sequence — then shift everything earlier by
                // the prep + travel cushion.
                const slot = startMin - (toClockIn - 1 - i) * spacing
                const t = Math.max(0, slot - clockInOffset)
                rows.push({
                    count: 1,
                    forOrder: order,
                    forOrderId: order.orderId || order.orderNum || null,
                    plantCode: code,
                    time: t
                })
            }
            clockedIn += toClockIn
            // Record this dispatch + its truck-by-truck return events so the
            // next iteration sees the correct pool state.
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
 * Per-plant pool timelines — each plant gets an ordered list of
 * `{ time, pool, type }` entries representing the pool state after each
 * dispatch / return / help event. Use with `poolAtTime(timeline, t)` to
 * answer "what was the pool at plant X at time Y?".
 */
export const computePlantPoolTimelines = (orders, initialPoolByCode, getTravelOverrides, helpTransfers) =>
    simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers).timelineByPlant

/**
 * Pool value at plant at a specific minute. Takes the last known pool state
 * at or before the queried time. Returns the initial pool when the time
 * predates any event, or `null` if the timeline is empty.
 */
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
 * Pre-defined order-size slots the dispatcher might be asked to take on.
 * Each entry captures the MINIMUM truck floor plus a conservative duration
 * estimate used to find a window where the plant has enough idle capacity.
 *
 *   - Large pour: 6–12+ trucks (needs 6 floor; big pours run ~3h)
 *   - Medium pour: 3–5 trucks (needs 3 floor; ~60 min round)
 *   - Small pour: 1–2 trucks (needs 1 floor; ~30 min round)
 */
export const SUGGESTED_SLOT_TYPES = [
    { durationMin: 180, key: 'large', label: 'Large pour · 6–12+ trucks', minTrucks: 6, truckRange: '6–12+' },
    { durationMin: 60, key: 'medium', label: 'Medium pour · 3–5 trucks', minTrucks: 3, truckRange: '3–5' },
    { durationMin: 30, key: 'small', label: 'Small pour · 1–2 trucks', minTrucks: 1, truckRange: '1–2' }
]

const SLOT_DAY_START_MIN = 6 * 60
const SLOT_DAY_END_MIN = 18 * 60
const SLOT_GRID_MIN = 30

/** Round a minute value UP to the next 30-minute mark so suggested start
 *  times read as 11:00 / 11:30 — never 11:13. Already-aligned values stay
 *  put. Dispatchers schedule on the half-hour, so any algorithmic time we
 *  surface needs to land on that grid. */
const roundUpToSlotGrid = (mins) => {
    if (!Number.isFinite(mins)) return mins
    const remainder = mins % SLOT_GRID_MIN
    return remainder === 0 ? mins : mins + (SLOT_GRID_MIN - remainder)
}

/** Walk a plant's pool timeline and return the earliest start time (in minutes)
 *  within business hours where the plant has `minTrucks` GENUINELY spare —
 *  i.e. `minFuture(t) ≥ minTrucks`. Using minFuture (lowest pool from t
 *  onward) rather than raw pool ensures we only recommend slots for trucks
 *  that aren't already committed to a later order. Returns null if no moment
 *  qualifies within business hours. */
const findEarliestIdleTime = (timeline, minTrucks) => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null
    const segments = timeline.map((entry) => ({
        pool: entry.pool,
        startTime: Number.isFinite(entry.time) ? entry.time : 0
    }))
    // Reverse pass: minFuture[i] = min pool value from segment i to the end.
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
 *
 * @param {object} order
 * @param {object} poolEntry - entry from `computePlantPoolTimeline` (has
 *                             `dispatchMinutes`, `poolAtDispatch`,
 *                             `inboundDuringPour`, `truckCount`).
 * @param {object} [overrides]
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
    // First truck — if we have at least one at the plant, it dispatches on
    // time. Otherwise use the first inbound during pour (very rare case).
    const firstDispatchMin = poolAtStart >= 1 ? startMin : inboundDuring > 0 ? startMin : null
    const firstArrivalMin = firstDispatchMin != null ? firstDispatchMin + toJobMin : null
    // Scheduled completion = pour running at planned spacing with required trucks.
    const scheduledCompletionMin = startMin + (trips - 1) * scheduledSpacing + cycleMin
    // Real completion = cycle / truck count → effective spacing broadens when
    // short-handed, so the last trip lands later.
    const effectiveSpacing =
        actualTrucks >= required ? scheduledSpacing : Math.max(scheduledSpacing, cycleMin / usableTrucks)
    const estimatedCompletionMin = startMin + (trips - 1) * effectiveSpacing + cycleMin
    // Pour rate (yd/hr loaded) — scheduled vs actual given the truck count.
    // If load size is unknown we can't derive a yd/hr figure; leave null so
    // callers don't render nonsense.
    const scheduledRateYph = loadSize > 0 && scheduledSpacing > 0 ? (60 / scheduledSpacing) * loadSize : null
    const effectiveRateYph = loadSize > 0 && effectiveSpacing > 0 ? (60 / effectiveSpacing) * loadSize : null
    // First truck can't actually dispatch until the plant has at least one
    // truck available — if the pool is 0 at the scheduled start, the FIRST
    // truck is physically late. With any available trucks, the first truck
    // goes out on time; fewer-than-required only slows the pour rate.
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
 * hours). Used to recommend when to move an overbooked order so the plant
 * can actually staff it. Returns null if no viable window remains today.
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
            // Snap to the next 30-minute mark so the suggested start reads
            // 11:00 / 11:30, never 11:13. The window must still hold the full
            // pour after snapping; if it doesn't, fall through to the next
            // segment in the run.
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
 * without dropping below its required truck floor. Used by the schedule view
 * to surface "here's where a new order would fit at this plant" recommendations.
 *
 * @returns {Array<{key, label, durationMin, minTrucks, yardage, loadSize, plantCode, time}>}
 *          Up to three entries per plant — one per slot type that has a viable
 *          window. Plants without capacity for a given size simply omit that
 *          size from their row set.
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

/**
 * Determine when operators can be safely sent home during the day.
 *
 * For each plant, compute the "min future pool" at every event boundary. Once
 * that minimum grows past the running send-home total, the excess operators
 * are surplus from that point on — they can clock out. We only emit rows at
 * pool-increase events (returns / help arrivals) since those are the moments
 * trucks are physically back at the plant and free to leave.
 *
 * @returns {Array<{plantCode, time, count, poolAfter}>}
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

/**
 * Minimum pull-up delta worth recommending. Moving a customer by less than
 * this is more disruption than it's worth — trivial nudges aren't surfaced.
 */
export const PULL_UP_MIN_DELTA_MIN = 60

/**
 * Realistic notice required to actually call a customer and confirm a moved
 * start time. Used to chalk a "notify by HH:MM" timestamp on the row so the
 * dispatcher knows when outreach must happen.
 */
export const PULL_UP_LEAD_NOTICE_MIN = 120

/**
 * Find later orders that could be pulled into earlier surplus windows so the
 * schedule compacts instead of leaving idle trucks waiting for a downstream
 * spike. The trigger is dip-then-spike: a plant has surplus trucks now AND
 * needs them again later (the candidate order itself is the spike). Pulling
 * the order up keeps those trucks productive instead of sitting idle.
 *
 * Selection is best-fit by truck count — largest order that fits the surplus
 * window goes first so we maximize utilization. The dispatcher's outreach
 * sequencing (call latest customers first) is surfaced in the row's
 * advisory text in the view layer; we don't bias the algorithm toward the
 * latest job.
 *
 * @returns {Array<{plantCode, order, originalStartMin, suggestedStartMin,
 *                  pullUpDeltaMin, notifyByMin, truckCount, yardage,
 *                  pourDurationMin, time}>}
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
        // Best-fit ordering: largest truck count first, ties broken by larger
        // yardage. Maximises window utilisation when the same surplus could
        // host multiple candidates.
        const candidates = plantOrders
            .map(({ order, startMin }) => {
                const overrides = typeof getTravelOverrides === 'function' ? getTravelOverrides(order) || {} : {}
                const truckCount = getCalculatedTruckCount(order, overrides)
                const pourDurationMin = getOrderPourDurationMinutes(order) || 60
                const yardage = parseFloat(order?.yardage) || 0
                return { order, overrides, plantCode, pourDurationMin, startMin, truckCount, yardage }
            })
            .filter((c) => c.truckCount > 0)
            .sort((a, b) => b.truckCount - a.truckCount || b.yardage - a.yardage)
        // Reserve every 30-minute window we recommend so two candidates don't
        // both target the same surplus slot — once a window is claimed, the
        // next candidate has to find a different one.
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
    // When travel data is missing AND the order isn't a big pour, we can't
    // derive a rotation — fall back to the dispatch report's number so the
    // column isn't empty. This is the only place we read `truckCount` for
    // display purposes.
    const scheduled = parseFloat(order?.truckCount)
    return Number.isFinite(scheduled) && scheduled > 0 ? scheduled : null
}
export const DROPDOWN_ARROW_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`

export const TIMELINE_START_HOUR = 0
export const TIMELINE_END_HOUR = 24
export const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR
export const LABEL_WIDTH = 150
export const DAY_WIDTH = 900 // px per day column

export const LANE_COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1'
]

export const getTomorrowDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
}

/** Local-timezone YYYY-MM-DD for today — used by the realtime dashboard to
 *  anchor the live clock to the dispatcher's current day. */
export const getTodayDate = () => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

export const getOffsetDate = (dateStr, offset) => {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    return d.toISOString().split('T')[0]
}

export const formatTime = (hours, minutes) => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
export const parseTime = (timeString) => timeString?.split(':').map(Number) ?? [0, 0]

export const addMinutesToTime = (time, mins) => {
    if (!time) return null
    const [hours, minutes] = parseTime(time)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    date.setMinutes(date.getMinutes() + mins)
    return formatTime(date.getHours(), date.getMinutes())
}

export const formatTimeInput = (value) => {
    const digits = value.replace(/[^0-9]/g, '')
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

let assignmentIdCounter = Date.now()
export const nextAssignmentId = () => ++assignmentIdCounter

export const createEmptyAssignment = () => ({
    customTimes: [],
    driverCount: 1,
    fromPlant: '',
    id: nextAssignmentId(),
    leaveTime: '',
    staggerMinutes: DEFAULT_STAGGER_MINUTES,
    time: '',
    timeMode: 'stagger',
    toPlant: ''
})

export const ensureUniqueIds = (assignments) => {
    const seen = new Set()
    return assignments.map((a) => {
        if (!a.id || seen.has(a.id)) {
            return { ...a, id: nextAssignmentId() }
        }
        seen.add(a.id)
        return a
    })
}

export const timeToMinutes = (timeStr) => {
    if (!timeStr) return null
    const [h, m] = parseTime(timeStr)
    return h * 60 + m
}

export const minutesToTime = (totalMin) => {
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return formatTime(h, m)
}

export const timeToPercent = (timeStr) => {
    if (!timeStr) return null
    const [h, m] = parseTime(timeStr)
    const totalMin = (h - TIMELINE_START_HOUR) * 60 + m
    return Math.max(0, Math.min(100, (totalMin / (TIMELINE_HOURS * 60)) * 100))
}

export const percentToTime = (pct) => {
    const totalMin = (pct / 100) * TIMELINE_HOURS * 60 + TIMELINE_START_HOUR * 60
    return minutesToTime(Math.round(totalMin))
}
