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

interface OrderLike {
    startTime?: string
    rate?: string
    loadSize?: string | number
    yardage?: string | number
    toJobTime?: string
    toPlantTime?: string
    truckCount?: string | number
    orderId?: string
    orderNum?: string
    plantCode?: string
    customer?: string
    productCode?: string
    [key: string]: unknown
}

interface TravelOverrides {
    toJobMin?: number
    toPlantMin?: number
}

interface DriverTime {
    driverIndex: number
    arriveMin: number | null
    leaveMin: number | null
}

interface CustomTime {
    time?: string
    leaveTime?: string
}

interface Assignment {
    driverCount?: string | number
    staggerMinutes?: string | number
    timeMode?: string
    customTimes?: CustomTime[]
    time?: string
    leaveTime?: string
    fromPlant?: string
    toPlant?: string
    returnPlant?: string
    forOrderId?: string
    id?: number
    [key: string]: unknown
}

interface HelpTransfer {
    plantCode: string
    time: number
    delta: number
}

interface PoolTimelineEntry {
    time: number | null
    pool: number
    type?: string
    delta?: number
    isInitial?: boolean
}

interface ReturnEvent {
    time: number
    count: number
    poolAfter: number
}

interface ByOrderEntry {
    dispatchMinutes: number
    firstReturnMinutes: number
    lastReturnMinutes: number
    plantCode: string | undefined
    returnEvents: ReturnEvent[]
    returnTimesByTruck: number[]
    tripsPerTruck: number
    tripsTotal: number
    truckCount: number
    poolAtDispatch?: number
    poolAfterDispatch?: number
    poolAfterDispatchEffective?: number
    poolAfterReturn?: number
    inboundDuringPour?: number
    kickerHeldAtDispatch?: number
    kickerBigPourActive?: boolean
}

interface SimulationResult {
    byOrder: Record<string, ByOrderEntry>
    timelineByPlant: Record<string, PoolTimelineEntry[]>
}

interface SimulationEvent {
    time: number
    type: 'dispatch' | 'return'
    count: number
    plantCode: string
    orderKey: string | null
    kicker?: boolean
}

interface OrderTiming {
    actualTrucks: number
    delayMin: number
    effectiveRateYph: number | null
    effectiveSpacingMin: number
    estimatedCompletionMin: number
    firstArrivalMin: number | null
    firstTruckIsLate: boolean
    requiredTrucks: number
    scheduledCompletionMin: number
    scheduledRateYph: number | null
    scheduledSpacingMin: number
}

interface PoolEntry {
    dispatchMinutes: number
    poolAtDispatch?: number
    inboundDuringPour?: number
    truckCount: number
}

export interface SuggestedSlotType {
    key: string
    label: string
    durationMin: number
    minTrucks: number
    truckRange: string
}

interface SuggestedSlotResult extends SuggestedSlotType {
    plantCode: string
    time: number
}

interface SendHomeRow {
    plantCode: string
    time: number
    count: number
    pool: number
    poolAfter: number
    surplus: number
}

interface PullUpRow {
    plantCode: string
    order: OrderLike
    originalStartMin: number
    suggestedStartMin: number
    pullUpDeltaMin: number
    notifyByMin: number
    truckCount: number
    yardage: number
    pourDurationMin: number
    time: number
}

interface ClockInRow {
    plantCode: string
    time: number
    count: number
    forOrder: OrderLike
    forOrderId: string | null
}

interface CustomerSatisfactionResult {
    samples: number
    goodService: number
    badService: number
    score: number
}

interface DetailByOrderId {
    [orderId: string]: {
        tickets?: Array<{ loadedTime?: string; [key: string]: unknown }>
        [key: string]: unknown
    }
}

interface PlantProduction {
    [key: string]: {
        orders?: OrderLike[]
        totalYardage?: string | number
        [key: string]: unknown
    }
}

interface PlanMeta {
    missingByPlant?: Record<string, number>
    [key: string]: unknown
}

const matchesStartSentinel = (order: OrderLike | null | undefined, sentinel: string): boolean => {
    const t = String(order?.startTime || '').trim()
    if (!t) return false
    return t.padStart(5, '0') === sentinel
}

/** True if an order's start time matches the cancellation sentinel. */
export const isCancelledOrder = (order: OrderLike | null | undefined): boolean =>
    matchesStartSentinel(order, CANCELLED_ORDER_START)

/** True if an order's start time matches the dispatcher test-order sentinel. */
export const isTestOrder = (order: OrderLike | null | undefined): boolean =>
    matchesStartSentinel(order, TEST_ORDER_START)

/** True for any order that should be excluded from yardage / truck / pool
 *  math (test + cancelled). Callers that show the row for transparency
 *  should still check `isTestOrder` / `isCancelledOrder` individually. */
export const isExcludedOrder = (order: OrderLike | null | undefined): boolean =>
    isCancelledOrder(order) || isTestOrder(order)

/**
 * Big-pour rule — fires on any order that's >= 120 yd total AND scheduled
 * with back-to-back spacing (< 10 min between trucks). "Back-to-back" means
 * we're loading trucks as fast as we can, typically 5-10 min apart. Jobs
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
/** Max yards a single concrete truck can physically haul. Used as both a
 *  per-order load-size cap and the upper bound on every yards-per-load
 *  metric — anything above this is a data inconsistency, not a real number. */
export const FLEET_MAX_LOAD_SIZE = 10

/**
 * Weekend availability rules:
 *   - Sunday  -> plants are closed. Pool = 0.
 *   - Saturday -> half crew on. Base mixer count is halved (rounded down so
 *     the plan stays conservative).
 *   - All other days -> full base.
 */
export const getPoolDayMultiplier = (planDate: string | null | undefined): number => {
    if (!planDate) return 1
    const dow = getDayOfWeekForDate(planDate)
    if (dow == null) return 1
    if (dow === 0) return 0
    if (dow === 6) return 0.5
    return 1
}

/** True when the plan date falls on a Sunday (plants closed). */
export const isClosedDay = (planDate: string | null | undefined): boolean => getPoolDayMultiplier(planDate) === 0

/** Apply the day-of-week multiplier to a base mixer count. Rounds down so
 *  we never overestimate on Saturdays. */
export const adjustPoolForDate = (base: number, planDate: string | null | undefined): number => {
    const multiplier = getPoolDayMultiplier(planDate)
    if (multiplier >= 1) return Number.isFinite(base) ? base : 0
    if (multiplier <= 0) return 0
    return Math.floor((Number.isFinite(base) ? base : 0) * multiplier)
}

/**
 * Canonical plant-badge colors. Shared across every view that draws a plant
 * marker (Schedule badge, Demand charts, Planner node hints, ...) so the same
 * plant always reads as the same hue. Values picked to work in both light
 * and dark themes with a white foreground; `eab308` gets dark text.
 */
export const PLANT_BADGE_COLORS: Record<string, string> = {
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
export const plantBadgeColor = (code: string | number, fallback: string): string =>
    PLANT_BADGE_COLORS[String(code)] || fallback

/** Key under which plan-level metadata rides on the plantProduction object.
 *  Other plant-code keys store real production data; this one stashes
 *  operator shortfalls, special-job flags, etc. */
export const PLAN_META_KEY = '_meta'

/** Count of operators the dispatcher has marked as missing at this plant
 *  (sick, vacation, etc.). Subtracted from the base pool in every truck
 *  calculation so the schedule reflects actual availability. */
export const getMissingOperators = (
    plantProduction: PlantProduction | null | undefined,
    plantCode: string
): number => {
    const raw = (plantProduction as Record<string, PlanMeta>)?.[PLAN_META_KEY]?.missingByPlant?.[plantCode]
    const value = parseInt(String(raw), 10)
    return Number.isFinite(value) && value > 0 ? value : 0
}

/** Persist the missing-operator count for a plant. Clamps to 0 so the
 *  caller never needs to guard against negatives. */
export const setMissingOperators = (
    setPlantProduction: ((updater: (prev: PlantProduction) => PlantProduction) => void) | null | undefined,
    plantCode: string,
    count: number | string
): void => {
    if (typeof setPlantProduction !== 'function' || !plantCode) return
    const safe = Math.max(0, parseInt(String(count), 10) || 0)
    setPlantProduction((prev) => {
        const next = { ...(prev || {}) } as Record<string, unknown>
        const meta = { ...((next[PLAN_META_KEY] as PlanMeta) || {}) }
        const missing = { ...(meta.missingByPlant || {}) }
        if (safe <= 0) {
            delete missing[plantCode]
        } else {
            missing[plantCode] = safe
        }
        meta.missingByPlant = missing
        next[PLAN_META_KEY] = meta
        return next as PlantProduction
    })
}

/** Compute the effective base pool for a plant on a given plan date:
 *  weekend-adjusted base, minus any operators the dispatcher has marked
 *  missing. Clamps at 0 so an over-aggressive shortfall never drives the
 *  pool negative before the simulation even runs. */
export const getEffectiveBase = (
    rawBase: number,
    plantCode: string,
    plantProduction: PlantProduction | null | undefined,
    planDate: string | null | undefined
): number => {
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
 */
export const buildAssignmentDriverTimes = (assignment: Assignment | null | undefined): DriverTime[] => {
    const count = parseInt(String(assignment?.driverCount), 10) || 0
    if (count <= 0) return []
    const stagger = parseInt(String(assignment?.staggerMinutes), 10) || 0
    const isCustom = assignment?.timeMode === 'custom' && Array.isArray(assignment?.customTimes)
    const baseArrive = timeToMinutes(assignment?.time)
    const baseLeave = timeToMinutes(assignment?.leaveTime)
    const result: DriverTime[] = []
    for (let i = 0; i < count; i++) {
        let arriveMin: number | null = null
        let leaveMin: number | null = null
        if (isCustom) {
            const ct = assignment!.customTimes![i] || {}
            arriveMin = timeToMinutes(ct.time)
            leaveMin = timeToMinutes(ct.leaveTime)
        } else {
            if (Number.isFinite(baseArrive)) arriveMin = baseArrive! + i * stagger
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
export const parseDurationMinutes = (value: string | number | null | undefined): number | null => {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hours = parseInt(m[1], 10)
    const mins = parseInt(m[2], 10)
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
    const total = hours * 60 + mins
    return total > 0 ? total : null
}

/** Pour rate (yd/hr) for a single order — `(60 / rate) x loadSize`.
 *  Returns null when either input is missing. */
export const getOrderPourRate = (order: OrderLike | null | undefined): number | null => {
    const rateMin = parseDurationMinutes(order?.rate)
    const loadSize = parseFloat(String(order?.loadSize))
    if (!rateMin || !Number.isFinite(loadSize) || loadSize <= 0) return null
    return Math.round((60 / rateMin) * loadSize * 10) / 10
}

/** True for orders that trigger the 12-truck floor — total yardage >= 120 yd
 *  AND spacing between trucks < 10 min (back-to-back loading). */
export const isBigPourOrder = (order: OrderLike | null | undefined): boolean => {
    const yardage = parseFloat(String(order?.yardage)) || 0
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
export const trucksToHitBigPourGoal = (
    order: OrderLike | null | undefined,
    overrides?: TravelOverrides | null
): number | null => {
    const opts = overrides || {}
    const loadSize = parseFloat(String(order?.loadSize)) || 0
    if (loadSize <= 0) return null
    const toJobMin = Number.isFinite(opts.toJobMin) ? opts.toJobMin! : parseDurationMinutes(order?.toJobTime)
    const toPlantMin = Number.isFinite(opts.toPlantMin)
        ? opts.toPlantMin!
        : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
    if (toJobMin == null) return null
    const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + (toPlantMin ?? toJobMin)
    // Spacing needed for 120 yd/hr = loadSize / 2 minutes.
    const targetSpacingMin = loadSize / 2
    if (targetSpacingMin <= 0) return null
    return Math.max(1, Math.ceil(cycleMin / targetSpacingMin))
}

/** Estimated time to complete the pour at the scheduled rate, in minutes.
 *  Used as informational context alongside required truck count. */
export const getOrderPourDurationMinutes = (order: OrderLike | null | undefined): number | null => {
    const rateMin = parseDurationMinutes(order?.rate)
    const loadSize = parseFloat(String(order?.loadSize)) || 0
    const yardage = parseFloat(String(order?.yardage)) || 0
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
export const getRequiredTrucksForPourRate = (
    order: OrderLike | null | undefined,
    overrides?: TravelOverrides | null
): number | null => {
    const opts = overrides || {}
    const rateMin = parseDurationMinutes(order?.rate)
    const toJobMin = Number.isFinite(opts.toJobMin) ? opts.toJobMin! : parseDurationMinutes(order?.toJobTime)
    const toPlantMin = Number.isFinite(opts.toPlantMin)
        ? opts.toPlantMin!
        : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
    if (!rateMin || toJobMin == null) return null
    const cycleMin = toJobMin + (toPlantMin ?? toJobMin) + TRUCK_ON_SITE_MINUTES
    const rotation = Math.max(1, Math.ceil(cycleMin / rateMin))
    // Cap at actual trips so short pours don't get inflated by long cycles.
    const loadSize = parseFloat(String(order?.loadSize)) || 0
    const yardage = parseFloat(String(order?.yardage)) || 0
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
export const getEffectiveMinTrucks = (
    order: OrderLike | null | undefined,
    overrides?: TravelOverrides | null
): number | null => {
    const opts = overrides || {}
    const calculated = getRequiredTrucksForPourRate(order, opts)
    const isBig = isBigPourOrder(order)
    const bigPourFloor = isBig ? BIG_POUR_MIN_TRUCKS : 0
    const bigPourGoalTrucks = isBig ? (trucksToHitBigPourGoal(order, opts) ?? 0) : 0
    if (calculated == null && bigPourFloor === 0 && bigPourGoalTrucks === 0) return null
    let effective = Math.max(calculated ?? 0, bigPourFloor, bigPourGoalTrucks)
    const loadSize = parseFloat(String(order?.loadSize)) || 0
    const yardage = parseFloat(String(order?.yardage)) || 0
    if (loadSize > 0 && yardage > 0) {
        const trips = Math.ceil(yardage / loadSize)
        effective = Math.min(effective, trips)
    }
    return effective > 0 ? effective : null
}

/**
 * Simulate per-plant truck pools through the day.
 *
 * Model — the pool is locked until the pour is done:
 *   - At each order's start time, pool[plant] -= requiredTrucks.
 *   - Long pours (trips > trucks) force each truck to make multiple runs;
 *     short pours (trips <= trucks) use each truck once. Either way a truck
 *     is tied up until the *last* trip it runs returns to the plant.
 *   - We conservatively refund the whole squad at `lastReturnMinutes`
 *     (= startTime + (trips - 1) x spacing + cycleMin). That keeps the
 *     pool honest even for multi-trip rotations.
 *   - First-truck-back time is surfaced separately for the return row and
 *     visual arrows: `startTime + min(trucks, trips) x 0 cycleMin` — i.e.
 *     the first truck comes home one full cycle after dispatch.
 *   - Cancelled orders are skipped entirely.
 */
/** Kicker reserve config — every Nth job at a plant holds a truck back from
 *  the pool to absorb late yardage additions ("kickers"). When any job in
 *  the block is a big pour, the reserve doubles since kickers there can
 *  swallow several extra trucks at once. Reserves release after a 2-3 hour
 *  window scaled to how spread out the block's jobs are. */
export const KICKER_RESERVE_BLOCK_SIZE = 4
export const KICKER_RESERVE_BASE_TRUCKS = 1
export const KICKER_RESERVE_BIG_POUR_TRUCKS = 2
export const KICKER_RESERVE_MIN_DURATION_MIN = 120
export const KICKER_RESERVE_MAX_DURATION_MIN = 180

type GetTravelOverrides = (order: OrderLike) => TravelOverrides | null | undefined

const simulatePoolTimeline = (
    orders: OrderLike[] | null | undefined,
    initialPoolByCode: Record<string, number> = {},
    getTravelOverrides: GetTravelOverrides | null = null,
    helpTransfers: HelpTransfer[] = []
): SimulationResult => {
    const events: SimulationEvent[] = []
    const byOrder: Record<string, ByOrderEntry> = {}
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
            ? overrides.toJobMin!
            : (parseDurationMinutes(order?.toJobTime) ?? 20)
        const toPlantMin = Number.isFinite(overrides?.toPlantMin)
            ? overrides.toPlantMin!
            : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
        const spacingMin = parseDurationMinutes(order?.rate) ?? 5
        const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
        // Total trips in the pour = how many times a truck has to roll.
        const loadSize = parseFloat(String(order?.loadSize)) || 0
        const yardage = parseFloat(String(order?.yardage)) || 0
        const tripsTotal = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : truckCount
        const tripsPerTruck = Math.max(1, Math.ceil(tripsTotal / truckCount))
        // Per-truck last-trip return time. Trucks cycle round-robin: trip k
        // goes to truck (k % truckCount), so truck i's last trip is the
        // largest k <= tripsTotal-1 where k % truckCount === i. Each truck
        // comes home individually — dispatchers see one return row per
        // truck, not one bulk "all 14 back" row at the end of the pour.
        const returnTimesByTruck: number[] = []
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
            plantCode: order.plantCode!,
            time: startMin,
            type: 'dispatch'
        })
        // One return event per truck so the pool ticks up gradually through
        // the pour instead of snapping up by `truckCount` at the end.
        returnTimesByTruck.forEach((returnMin) => {
            events.push({
                count: 1,
                orderKey,
                plantCode: order.plantCode!,
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
    // -- Kicker reserves --
    // Group each plant's chronological orders into blocks of
    // `KICKER_RESERVE_BLOCK_SIZE`. For every full block, hold back 1 truck
    // (2 if any order in the block triggers the big-pour rule) for a
    // 2-3 hour window scaled to the block's time span. Modeled as
    // dispatch/return events so the pool drains and refills the same way
    // help transfers do — but tagged `kicker: true` so per-order inbound
    // credit ignores them (the trucks aren't physically returning).
    const ordersByPlantSorted: Record<string, Array<{ order: OrderLike; startMin: number }>> = {}
    for (const order of orders || []) {
        if (isExcludedOrder(order)) continue
        if (!order?.plantCode) continue
        const startMin = timeToMinutes(order?.startTime)
        if (startMin == null) continue
        if (!ordersByPlantSorted[order.plantCode]) ordersByPlantSorted[order.plantCode] = []
        ordersByPlantSorted[order.plantCode].push({ order, startMin })
    }
    const kickerReservesByPlant: Record<
        string,
        Array<{ count: number; hasBigPour: boolean; holdEnd: number; holdStart: number }>
    > = {}
    Object.entries(ordersByPlantSorted).forEach(([plantCode, list]) => {
        list.sort((a, b) => a.startMin - b.startMin)
        const reserves: Array<{ count: number; hasBigPour: boolean; holdEnd: number; holdStart: number }> = []
        for (let i = 0; i + KICKER_RESERVE_BLOCK_SIZE - 1 < list.length; i += KICKER_RESERVE_BLOCK_SIZE) {
            const block = list.slice(i, i + KICKER_RESERVE_BLOCK_SIZE)
            const hasBigPour = block.some(({ order }) => isBigPourOrder(order))
            const reserveCount = hasBigPour ? KICKER_RESERVE_BIG_POUR_TRUCKS : KICKER_RESERVE_BASE_TRUCKS
            const firstStart = block[0].startMin
            const lastStart = block[block.length - 1].startMin
            const span = Math.max(0, lastStart - firstStart)
            // Reserve duration tracks how spread out the block is — tightly
            // packed jobs release sooner, dispersed blocks hold longer —
            // clamped to 2-3 hours so we always anticipate the next chunk
            // of kickers without deadlocking the pool.
            const reserveDur = Math.max(
                KICKER_RESERVE_MIN_DURATION_MIN,
                Math.min(KICKER_RESERVE_MAX_DURATION_MIN, span + 60)
            )
            // Activate the reserve at the LAST job of the block, not the
            // first — that way the pool drains gradually as the day fills
            // up instead of dropping a stack of trucks at the morning rush
            // when 12 jobs all start at 06:00.
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
    // For each order, sum the kicker reserves active AT its dispatch minute
    // — that's the count the hover surfaces ("N truck(s) held back for
    // anticipated kickers"). Done by point sample rather than overlap so
    // the number lines up exactly with what `poolAtDispatch` reflects.
    Object.entries(byOrder).forEach(([, entry]) => {
        const reserves = kickerReservesByPlant[entry.plantCode!] || []
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

    // Credit each order only with TRUE inbound help — inter-plant transfers
    // arriving at this plant during its pour window.
    Object.entries(byOrder).forEach(([, entry]) => {
        let inboundDuringPour = 0
        for (const event of events) {
            if (event.plantCode !== entry.plantCode) continue
            if (event.type !== 'return') continue
            if (event.orderKey !== null) continue
            // Kicker reserve "returns" aren't real trucks landing — they're
            // just the bookkeeping release of a held-back truck — so they
            // can't credit another order's coverage.
            if (event.kicker) continue
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
    const pool: Record<string, number> = { ...initialPoolByCode }
    const timelineByPlant: Record<string, PoolTimelineEntry[]> = {}
    // Seed initial entries so the timeline starts at the base pool value, even
    // for plants that never see an event.
    Object.entries(initialPoolByCode).forEach(([code, value]) => {
        timelineByPlant[code] = [{ isInitial: true, pool: value, time: null }]
    })
    for (const event of events) {
        const plantPool = pool[event.plantCode] ?? 0
        let nextPool: number
        if (event.type === 'return') {
            nextPool = plantPool + event.count
            // Record each return event so the schedule can render one row
            // per truck (or grouped batch) and show the live pool count at
            // the moment that truck comes home.
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
            if (event.orderKey && byOrder[event.orderKey]) {
                byOrder[event.orderKey].poolAtDispatch = plantPool
                byOrder[event.orderKey].poolAfterDispatch = plantPool - event.count
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
export const computePlantPoolTimeline = (
    orders: OrderLike[] | null | undefined,
    initialPoolByCode: Record<string, number>,
    getTravelOverrides: GetTravelOverrides | null,
    helpTransfers: HelpTransfer[]
): Record<string, ByOrderEntry> =>
    simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers).byOrder

/**
 * Build a chronological list of operator clock-in events per plant. Operators
 * aren't sitting in the pool at midnight — they clock in just-in-time for the
 * orders that need them. Each event represents one operator clocking in.
 */
export const computeClockInRows = (
    orders: OrderLike[] | null | undefined,
    baseByPlant: Record<string, number> | null | undefined,
    getTravelOverrides: GetTravelOverrides | null
): ClockInRow[] => {
    const rows: ClockInRow[] = []
    const byPlant: Record<string, OrderLike[]> = {}
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
        const events: Array<{ count: number; time: number; type: 'dispatch' | 'return' }> = []
        let clockedIn = 0
        for (const order of plantOrders) {
            const startMin = timeToMinutes(order.startTime)!
            const overrides = typeof getTravelOverrides === 'function' ? getTravelOverrides(order) || {} : {}
            const truckCount = getCalculatedTruckCount(order, overrides)
            if (!truckCount) continue
            const spacing = parseDurationMinutes(order?.rate) ?? 5
            const toJobMin = Number.isFinite(overrides?.toJobMin)
                ? overrides.toJobMin!
                : (parseDurationMinutes(order?.toJobTime) ?? 20)
            const toPlantMin = Number.isFinite(overrides?.toPlantMin)
                ? overrides.toPlantMin!
                : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
            const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
            const loadSize = parseFloat(String(order?.loadSize)) || 0
            const yardage = parseFloat(String(order?.yardage)) || 0
            const tripsTotal = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : truckCount
            // Simulate pool state right before this dispatch
            let pool = clockedIn
            for (const ev of events) {
                if (ev.time > startMin) continue
                pool += ev.type === 'return' ? ev.count : -ev.count
            }
            const shortfall = Math.max(0, truckCount - pool)
            const toClockIn = Math.min(shortfall, base - clockedIn)
            // Real prep time before a truck leaves the plant
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
            // Record this dispatch + its truck-by-truck return events
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
 * dispatch / return / help event.
 */
export const computePlantPoolTimelines = (
    orders: OrderLike[] | null | undefined,
    initialPoolByCode: Record<string, number>,
    getTravelOverrides: GetTravelOverrides | null,
    helpTransfers: HelpTransfer[]
): Record<string, PoolTimelineEntry[]> =>
    simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers).timelineByPlant

/**
 * Pool value at plant at a specific minute. Takes the last known pool state
 * at or before the queried time. Returns the initial pool when the time
 * predates any event, or `null` if the timeline is empty.
 */
export const poolAtTime = (timeline: PoolTimelineEntry[], timeMin: number): number | null => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null
    if (!Number.isFinite(timeMin)) return timeline[timeline.length - 1].pool
    let current = timeline[0].pool
    for (let i = 1; i < timeline.length; i++) {
        const entryTime = timeline[i].time
        if (!Number.isFinite(entryTime as number)) continue
        if (entryTime! > timeMin) break
        current = timeline[i].pool
    }
    return current
}

/**
 * Pre-defined order-size slots the dispatcher might be asked to take on.
 */
export const SUGGESTED_SLOT_TYPES: SuggestedSlotType[] = [
    { durationMin: 180, key: 'large', label: 'Large pour \u00b7 6\u201312+ trucks', minTrucks: 6, truckRange: '6\u201312+' },
    { durationMin: 60, key: 'medium', label: 'Medium pour \u00b7 3\u20135 trucks', minTrucks: 3, truckRange: '3\u20135' },
    { durationMin: 30, key: 'small', label: 'Small pour \u00b7 1\u20132 trucks', minTrucks: 1, truckRange: '1\u20132' }
]

const SLOT_DAY_START_MIN = 6 * 60
const SLOT_DAY_END_MIN = 18 * 60
const SLOT_GRID_MIN = 30

/** Round a minute value UP to the next 30-minute mark. */
const roundUpToSlotGrid = (mins: number): number => {
    if (!Number.isFinite(mins)) return mins
    const remainder = mins % SLOT_GRID_MIN
    return remainder === 0 ? mins : mins + (SLOT_GRID_MIN - remainder)
}

/** Walk a plant's pool timeline and return the earliest start time (in minutes)
 *  within business hours where the plant has `minTrucks` GENUINELY spare. */
const findEarliestIdleTime = (timeline: PoolTimelineEntry[], minTrucks: number): number | null => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null
    const segments = timeline.map((entry) => ({
        pool: entry.pool,
        startTime: Number.isFinite(entry.time as number) ? (entry.time as number) : 0
    }))
    // Reverse pass: minFuture[i] = min pool value from segment i to the end.
    const minFuture = new Array<number>(segments.length)
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
 * can actually put on it.
 */
export const estimateOrderTiming = (
    order: OrderLike | null | undefined,
    poolEntry: PoolEntry | null | undefined,
    overrides?: TravelOverrides | null
): OrderTiming | null => {
    if (!poolEntry || !Number.isFinite(poolEntry.dispatchMinutes)) return null
    const opts = overrides || {}
    const toJobMin = Number.isFinite(opts.toJobMin) ? opts.toJobMin! : (parseDurationMinutes(order?.toJobTime) ?? 20)
    const toPlantMin = Number.isFinite(opts.toPlantMin)
        ? opts.toPlantMin!
        : (parseDurationMinutes(order?.toPlantTime) ?? toJobMin)
    const cycleMin = toJobMin + TRUCK_ON_SITE_MINUTES + toPlantMin
    const scheduledSpacing = parseDurationMinutes(order?.rate) ?? 5
    const loadSize = parseFloat(String(order?.loadSize)) || 0
    const yardage = parseFloat(String(order?.yardage)) || 0
    const trips = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : poolEntry.truckCount
    const required = poolEntry.truckCount || trips
    const startMin = poolEntry.dispatchMinutes
    const poolAtStart = Number.isFinite(poolEntry.poolAtDispatch) ? poolEntry.poolAtDispatch! : 0
    const inboundDuring = Number.isFinite(poolEntry.inboundDuringPour) ? poolEntry.inboundDuringPour! : 0
    const actualTrucks = Math.max(0, poolAtStart) + Math.max(0, inboundDuring)
    const usableTrucks = Math.max(1, Math.min(required, actualTrucks))
    // First truck — if we have at least one at the plant, it dispatches on
    // time. Otherwise use the first inbound during pour (very rare case).
    const firstDispatchMin = poolAtStart >= 1 ? startMin : inboundDuring > 0 ? startMin : null
    const firstArrivalMin = firstDispatchMin != null ? firstDispatchMin + toJobMin : null
    // Scheduled completion = pour running at planned spacing with required trucks.
    const scheduledCompletionMin = startMin + (trips - 1) * scheduledSpacing + cycleMin
    // Real completion = cycle / truck count -> effective spacing broadens when
    // short-handed, so the last trip lands later.
    const effectiveSpacing =
        actualTrucks >= required ? scheduledSpacing : Math.max(scheduledSpacing, cycleMin / usableTrucks)
    const estimatedCompletionMin = startMin + (trips - 1) * effectiveSpacing + cycleMin
    // Pour rate (yd/hr loaded) — scheduled vs actual given the truck count.
    const scheduledRateYph = loadSize > 0 && scheduledSpacing > 0 ? (60 / scheduledSpacing) * loadSize : null
    const effectiveRateYph = loadSize > 0 && effectiveSpacing > 0 ? (60 / effectiveSpacing) * loadSize : null
    const firstTruckIsLate = poolAtStart < 1 && inboundDuring > 0
    return {
        actualTrucks,
        delayMin: Math.max(0, Math.round(estimatedCompletionMin - scheduledCompletionMin)),
        effectiveRateYph: Number.isFinite(effectiveRateYph) ? Math.round(effectiveRateYph! * 10) / 10 : null,
        effectiveSpacingMin: Math.round(effectiveSpacing * 10) / 10,
        estimatedCompletionMin: Math.round(estimatedCompletionMin),
        firstArrivalMin: Number.isFinite(firstArrivalMin) ? Math.round(firstArrivalMin!) : null,
        firstTruckIsLate,
        requiredTrucks: required,
        scheduledCompletionMin: Math.round(scheduledCompletionMin),
        scheduledRateYph: Number.isFinite(scheduledRateYph) ? Math.round(scheduledRateYph! * 10) / 10 : null,
        scheduledSpacingMin: scheduledSpacing
    }
}

/**
 * Earliest time at-or-after `afterMin` when the plant has at least
 * `minTrucks` idle for `durationMin` contiguous minutes (within business
 * hours).
 */
export const findNextViableStart = (
    timeline: PoolTimelineEntry[],
    minTrucks: number,
    afterMin: number,
    durationMin: number
): number | null => {
    if (!Array.isArray(timeline) || timeline.length === 0) return null
    const segments = timeline.map((entry) => ({
        pool: entry.pool,
        startTime: Number.isFinite(entry.time as number) ? (entry.time as number) : 0
    }))
    let runStart: number | null = null
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const segEnd = i + 1 < segments.length ? segments[i + 1].startTime : SLOT_DAY_END_MIN
        if (seg.pool >= minTrucks) {
            const clippedStart = Math.max(seg.startTime, afterMin)
            const clippedEnd = Math.min(segEnd, SLOT_DAY_END_MIN)
            if (clippedEnd <= clippedStart) continue
            if (runStart == null) runStart = clippedStart
            // Snap to the next 30-minute mark
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
 * start time where that plant has enough surplus trucks.
 */
export const computeSuggestedSlots = (
    orders: OrderLike[] | null | undefined,
    initialPoolByCode: Record<string, number>,
    getTravelOverrides: GetTravelOverrides | null,
    helpTransfers: HelpTransfer[]
): SuggestedSlotResult[] => {
    const { timelineByPlant } = simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers)
    const results: SuggestedSlotResult[] = []
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
 */
export const computeSendHomeRows = (
    orders: OrderLike[] | null | undefined,
    initialPoolByCode: Record<string, number>,
    getTravelOverrides: GetTravelOverrides | null,
    helpTransfers: HelpTransfer[]
): SendHomeRow[] => {
    const { timelineByPlant } = simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers)
    const rows: SendHomeRow[] = []
    Object.entries(timelineByPlant || {}).forEach(([plantCode, timeline]) => {
        if (!Array.isArray(timeline) || timeline.length < 2) return
        // Reverse pass: minFuture[i] = min pool value from index i to the end.
        const minFuture = new Array<number>(timeline.length)
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
                    time: entry.time!
                })
                sentHome = budget
            }
        }
    })
    return rows
}

/**
 * Minimum pull-up delta worth recommending.
 */
export const PULL_UP_MIN_DELTA_MIN = 60

/**
 * Realistic notice required to actually call a customer and confirm a moved
 * start time.
 */
export const PULL_UP_LEAD_NOTICE_MIN = 120

/**
 * Find later orders that could be pulled into earlier surplus windows so the
 * schedule compacts instead of leaving idle trucks waiting for a downstream
 * spike.
 */
export const computePullUpRows = (
    orders: OrderLike[] | null | undefined,
    initialPoolByCode: Record<string, number>,
    getTravelOverrides: GetTravelOverrides | null,
    helpTransfers: HelpTransfer[]
): PullUpRow[] => {
    const { timelineByPlant } = simulatePoolTimeline(orders, initialPoolByCode, getTravelOverrides, helpTransfers)
    const ordersByPlant = new Map<string, Array<{ order: OrderLike; startMin: number }>>()
    for (const order of orders || []) {
        if (isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (startMin == null) continue
        const list = ordersByPlant.get(order.plantCode!) || []
        list.push({ order, startMin })
        ordersByPlant.set(order.plantCode!, list)
    }
    const rows: PullUpRow[] = []
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
                const yardage = parseFloat(String(order?.yardage)) || 0
                return { order, overrides, plantCode, pourDurationMin, startMin, truckCount, yardage }
            })
            .filter((c) => c.truckCount != null && c.truckCount > 0)
            .sort((a, b) => b.truckCount! - a.truckCount! || b.yardage - a.yardage)
        // Reserve every 30-minute window we recommend
        const reservedSlotKeys = new Set<number>()
        candidates.forEach((c) => {
            const viableStart = findNextViableStart(timeline, c.truckCount!, SLOT_DAY_START_MIN, c.pourDurationMin)
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
                truckCount: c.truckCount!,
                yardage: c.yardage
            })
        })
    })
    return rows
}

/**
 * Our canonical truck count for an order — what the dispatch *should* book.
 */
export const getCalculatedTruckCount = (
    order: OrderLike | null | undefined,
    overrides?: TravelOverrides | null
): number | null => {
    const computed = getEffectiveMinTrucks(order, overrides || {})
    if (computed != null) return computed
    // When travel data is missing AND the order isn't a big pour, we can't
    // derive a rotation — fall back to the dispatch report's number so the
    // column isn't empty.
    const scheduled = parseFloat(String(order?.truckCount))
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

/* Smyrna's operations run on Central Standard Time regardless of where
 * the dispatcher (or developer) is sitting, so every "today / now /
 * day-of-week" decision in PlanView anchors here. */
export const PLAN_TIME_ZONE = 'America/Chicago'

const CST_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: PLAN_TIME_ZONE,
    year: 'numeric'
})

const CST_TIME_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: PLAN_TIME_ZONE
})

/** Pull `{ year, month, day }` strings (zero-padded) for the supplied
 *  Date — or "now" — interpreted in CST. */
const getCstDateParts = (date: Date = new Date()): { year: string; month: string; day: string } => {
    const parts = CST_DATE_PARTS_FORMATTER.formatToParts(date)
    const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || ''
    return { day: lookup('day'), month: lookup('month'), year: lookup('year') }
}

/** Pure calendar arithmetic on a `YYYY-MM-DD` string. Parses the input
 *  components and walks days via UTC operations so the result doesn't
 *  drift across DST boundaries or the dispatcher's local timezone. */
const advanceIsoDate = (dateStr: string | null | undefined, offset: number): string => {
    const parts = String(dateStr || '').split('-')
    if (parts.length !== 3) return dateStr as string
    const [y, m, d] = parts.map((n) => parseInt(n, 10))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateStr as string
    const base = new Date(Date.UTC(y, m - 1, d))
    base.setUTCDate(base.getUTCDate() + offset)
    const yy = base.getUTCFullYear()
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(base.getUTCDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
}

/** Day-of-week (0-6, Sunday=0) for a `YYYY-MM-DD` string. */
export const getDayOfWeekForDate = (dateStr: string | null | undefined): number | null => {
    const parts = String(dateStr || '').split('-')
    if (parts.length !== 3) return null
    const [y, m, d] = parts.map((n) => parseInt(n, 10))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Tomorrow's CST calendar date in `YYYY-MM-DD`. */
export const getTomorrowDate = (): string => advanceIsoDate(getTodayDate(), 1)

/** Today's CST calendar date in `YYYY-MM-DD`. */
export const getTodayDate = (): string => {
    const { year, month, day } = getCstDateParts()
    return `${year}-${month}-${day}`
}

/** Add `offset` calendar days to a `YYYY-MM-DD` string. Pure date math
 *  — no local-tz drift. */
export const getOffsetDate = (dateStr: string | null | undefined, offset: number): string =>
    advanceIsoDate(dateStr, offset)

/**
 * Returns `dateStr` unchanged if it isn't a Sunday; otherwise advances
 * by `direction` (+1 forward, -1 backward) until it lands on a non-Sunday.
 */
export const skipSundayDate = (dateStr: string | null | undefined, direction: number = 1): string | null | undefined => {
    if (!dateStr) return dateStr
    const step = direction < 0 ? -1 : 1
    let cursor = dateStr
    while (getDayOfWeekForDate(cursor) === 0) cursor = advanceIsoDate(cursor, step)
    return cursor
}

/** Current minute-of-day (0-1439) on Smyrna's CST wall clock. */
export const getNowCstMinutes = (): number => {
    const parts = CST_TIME_PARTS_FORMATTER.formatToParts(new Date())
    const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
    const h = parseInt(lookup('hour') || '0', 10) % 24
    const m = parseInt(lookup('minute') || '0', 10)
    return h * 60 + m
}

/** Same direction as `getOffsetDate`, but lands on the next non-Sunday. */
export const offsetDateSkipSunday = (dateStr: string | null | undefined, offset: number): string | null | undefined =>
    skipSundayDate(getOffsetDate(dateStr, offset), offset)

export const formatTime = (hours: number, minutes: number): string =>
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
export const parseTime = (timeString: string | null | undefined): [number, number] =>
    (timeString?.split(':').map(Number) ?? [0, 0]) as [number, number]

export const addMinutesToTime = (time: string | null | undefined, mins: number): string | null => {
    if (!time) return null
    const [hours, minutes] = parseTime(time)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    date.setMinutes(date.getMinutes() + mins)
    return formatTime(date.getHours(), date.getMinutes())
}

export const formatTimeInput = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, '')
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

let assignmentIdCounter = Date.now()
export const nextAssignmentId = (): number => ++assignmentIdCounter

export const createEmptyAssignment = (): Assignment => ({
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

export const ensureUniqueIds = (assignments: Assignment[]): Assignment[] => {
    const seen = new Set<number>()
    return assignments.map((a) => {
        if (!a.id || seen.has(a.id)) {
            return { ...a, id: nextAssignmentId() }
        }
        seen.add(a.id)
        return a
    })
}

export const timeToMinutes = (timeStr: string | null | undefined): number | null => {
    if (!timeStr) return null
    const [h, m] = parseTime(timeStr)
    return h * 60 + m
}

export const minutesToTime = (totalMin: number): string => {
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return formatTime(h, m)
}

/** Format a minute-of-day count as `HH:MM`, wrapping around midnight so
 *  negative or > 1440 inputs still produce a sane time-of-day. */
export const formatMinutesClock = (mins: number): string => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return formatTime(h, m)
}

export const timeToPercent = (timeStr: string | null | undefined): number | null => {
    if (!timeStr) return null
    const [h, m] = parseTime(timeStr)
    const totalMin = (h - TIMELINE_START_HOUR) * 60 + m
    return Math.max(0, Math.min(100, (totalMin / (TIMELINE_HOURS * 60)) * 100))
}

export const percentToTime = (pct: number): string => {
    const totalMin = (pct / 100) * TIMELINE_HOURS * 60 + TIMELINE_START_HOUR * 60
    return minutesToTime(Math.round(totalMin))
}

/* -- Customer Satisfaction --
 *  Customer-perceived performance score for a schedule day. Per-order
 *  score is a weighted blend of two sub-scores derived from actual ticket
 *  load times:
 *    pace    — 0.6 weight. Did trucks load on the planned cadence?
 *    onTime  — 0.4 weight. Did the first truck load on or before the
 *              scheduled job start?
 */
export const CUSTOMER_SAT_PACE_WEIGHT = 0.6
export const CUSTOMER_SAT_ONTIME_WEIGHT = 0.4
export const CUSTOMER_SAT_LATE_WINDOW_MIN = 60
export const BAD_SERVICE_LATE_THRESHOLD_MIN = 15
export const BAD_SERVICE_PACE_THRESHOLD = 0.7
/** Jobs at or below either threshold skip the slow-pace check entirely. */
export const SMALL_JOB_TRUCK_THRESHOLD = 3
export const SMALL_JOB_YARDAGE_THRESHOLD = 30

/** Convert truck `loadSize` (yards) and `spacing` (minutes between trucks)
 *  into the requested pour rate the schedule plan implies. Returns null
 *  when either input is missing so callers can skip ratio-based checks. */
export const computeRequestedYardsPerHour = (loadSize: number, spacingMinutes: number): number | null => {
    if (!(loadSize > 0) || !(spacingMinutes > 0)) return null
    return (loadSize * 60) / spacingMinutes
}

/** Actual pour rate over the loaded-truck window. */
export const computeActualYardsPerHour = (totalYardage: number, actualDurationMinutes: number): number | null => {
    if (!(totalYardage > 0) || !(actualDurationMinutes > 0)) return null
    return (totalYardage / actualDurationMinutes) * 60
}

/** True when a pour is small enough that the slow-pace check should be suppressed. */
export const isSmallPourJob = (expectedTrucks: number | string, totalYardage: number | string): boolean => {
    const trucks = Number(expectedTrucks) || 0
    const yards = Number(totalYardage) || 0
    return (trucks > 0 && trucks <= SMALL_JOB_TRUCK_THRESHOLD) || (yards > 0 && yards <= SMALL_JOB_YARDAGE_THRESHOLD)
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const computeCustomerSatisfaction = (
    orders: OrderLike[] | null | undefined,
    detailByOrderId: DetailByOrderId | null | undefined
): CustomerSatisfactionResult | null => {
    if (!Array.isArray(orders) || !orders.length) return null
    let samples = 0
    let badService = 0

    orders.forEach((order) => {
        const detail = order?.orderId ? detailByOrderId?.[order.orderId] : null
        const tickets = Array.isArray(detail?.tickets) ? detail!.tickets : []
        const loadedTimes = tickets
            .map((t) => timeToMinutes(t?.loadedTime as string | undefined))
            .filter((mins): mins is number => Number.isFinite(mins as number))
            .sort((a, b) => a - b)
        if (!loadedTimes.length) return

        const totalYardage = parseFloat(String(order.yardage)) || 0
        const loadSize = parseFloat(String(order.loadSize)) || 0
        const numTrucks =
            loadSize > 0 && totalYardage > 0 ? Math.max(1, Math.ceil(totalYardage / loadSize)) : loadedTimes.length
        const startMin = timeToMinutes(order.startTime)
        const spacing = parseDurationMinutes(order.rate) ?? 5

        const firstLoad = loadedTimes[0]
        const lastLoad = loadedTimes[loadedTimes.length - 1]
        const actualDuration = Math.max(0, lastLoad - firstLoad)
        const startLateness = Number.isFinite(startMin) ? Math.max(0, firstLoad - startMin!) : 0

        // Pace verdict compares actual yd/hr to the requested yd/hr
        const requestedYdPerHr = computeRequestedYardsPerHour(loadSize, spacing)
        const actualYdPerHr = computeActualYardsPerHour(totalYardage, actualDuration)
        const paceScore = requestedYdPerHr && actualYdPerHr ? clamp01(actualYdPerHr / requestedYdPerHr) : 1

        // Per-order verdict
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
