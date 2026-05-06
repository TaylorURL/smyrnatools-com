// Plan Schedule utility — pure helpers + constants used by PlanScheduleView
// and its extracted sub-components. Anything reusable across other Plan
// surfaces (e.g. PlanStatisticsView) lives in PlanUtility instead.

import {
    BAD_SERVICE_LATE_THRESHOLD_MIN,
    BAD_SERVICE_PACE_THRESHOLD,
    BUFFER_MINUTES,
    buildAssignmentDriverTimes,
    computeActualYardsPerHour,
    computeCustomerSatisfaction,
    computeRequestedYardsPerHour,
    estimateOrderTiming,
    findNextViableStart,
    getCalculatedTruckCount,
    isBigPourOrder,
    isExcludedOrder,
    isSmallPourJob,
    LOAD_MINUTES,
    parseDurationMinutes,
    PLAN_META_KEY,
    PRE_TRIP_MINUTES,
    timeToMinutes
} from './PlanUtility'

/** Driver shift cap per DOT regulations — operators can't be on the clock
 *  longer than this from first load-out to back-at-yard. */
export const HOURS_LIMIT_MINUTES = 14 * 60
/** Slump / QC test minutes the truck waits at the plant before leaving for
 *  the job. The user-configured value used by the limit calculator. */
export const HOURS_LIMIT_SLUMP_MINUTES = 15
/** On-site pour duration assumed by the limit calculator when an order's own
 *  pour-time estimate isn't available. */
export const HOURS_LIMIT_POUR_MINUTES = 60

/** Trim/normalize any value to a string. Empty / null / undefined → ''. */
export const clean = (value) => (value == null ? '' : String(value).trim())

/** Sum a numeric field across an array of objects, ignoring non-numeric values. */
export const sumField = (orders, key) =>
    orders.reduce((acc, o) => {
        const n = parseFloat(o?.[key])
        return acc + (Number.isFinite(n) ? n : 0)
    }, 0)

/** Normalize loose dispatch time strings into `HH:MM`. Accepts already-formatted
 *  values, 3- or 4-digit numeric strings, and otherwise returns the raw input. */
export const formatHhmm = (value) => {
    const v = clean(value)
    if (!v) return ''
    if (/^\d{1,2}:\d{2}$/.test(v)) return v.padStart(5, '0')
    if (/^\d{3,4}$/.test(v)) {
        const padded = v.padStart(4, '0')
        return `${padded.slice(0, 2)}:${padded.slice(2)}`
    }
    return v
}

/**
 * Pull the city segment out of a plant's full street address so we can fall
 * back to it when an order's city is missing. Accepts common formats:
 *   "123 Main St, Houston, TX 77001"  → "Houston"
 *   "123 Main St, Houston TX 77001"   → "Houston"
 *   "123 Main St"                      → ""
 */
export const extractCityFromFullAddress = (fullAddress) => {
    const value = clean(fullAddress)
    if (!value) return ''
    const parts = value
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean)
    if (parts.length >= 3) return parts[1]
    if (parts.length === 2) {
        // "street, city STATE ZIP" — strip trailing state + zip to isolate city.
        return parts[1].replace(/\s+[A-Za-z]{2}(\s+\d{5}(-\d{4})?)?\s*$/i, '').trim()
    }
    return ''
}

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

/**
 * Detect garbage / placeholder addresses that the dispatcher needs to fix
 * before the load can be sent (e.g. "GET NEW ADD....!", "GOING WHERE?",
 * "TBD", "N/A"). Empty strings are treated as "missing", not "bad".
 */
const BAD_ADDRESS_TOKENS = [
    'get address',
    'get add',
    'get new',
    'going where',
    'going to',
    'where?',
    'tbd',
    'tba',
    'n/a',
    'n a',
    'fix',
    'fixme',
    'unknown',
    'no address',
    'need address',
    'need add',
    'pending',
    'placeholder',
    'verify',
    'update',
    'address?',
    '???',
    'find address',
    'no addr'
]
export const isLikelyBadAddress = (raw) => {
    const value = clean(raw)
    if (!value) return false
    const lower = value.toLowerCase()
    if (/[?!]/.test(value)) return true
    if (/\.{3,}/.test(value)) return true
    if (BAD_ADDRESS_TOKENS.some((tok) => lower.includes(tok))) return true
    // Real addresses almost always have a digit — anything ≥ 5 chars without one
    // is suspicious (e.g. "GO WHERE", "FIND IT").
    if (value.length < 5) return true
    if (!/\d/.test(value) && value.length < 12) return true
    return false
}

/** Parse a `HH:MM` duration string (from the dispatch report) into minutes.
 *  Returns null when the value is missing or unparseable. Mirrors the
 *  behaviour of `parseDurationMinutes` for HH:MM-only sources. */
export const parseHhmmToMinutes = (value) => {
    const v = clean(value)
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hours = parseInt(m[1], 10)
    const mins = parseInt(m[2], 10)
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
    return hours * 60 + mins
}

/** Clamp a number into the [0, 1] range. */
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

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
        if (Number.isFinite(nowMin) && Number.isFinite(startMin) && nowMin > startMin + 5) {
            return { expectedTrucks: expectedTrucks ?? null, status: 'pending', ticketsLoaded: 0 }
        }
        return null
    }

    const firstLoad = loadedTimes[0]
    const lastLoad = loadedTimes[loadedTimes.length - 1]
    const startLateness = Number.isFinite(startMin) ? Math.max(0, firstLoad - startMin) : 0
    const actualDuration = Math.max(0, lastLoad - firstLoad)

    // Pace verdict compares actual yd/hr against the requested yd/hr the
    // schedule plan implies (loadSize / spacing). Small pours (≤3 trucks or
    // ≤30 yd) skip the slow check — their cadence is set by the customer's
    // finishing crew, not dispatch, and treating it as "Poor Service" is a
    // false positive. The on-time start check still applies in every case.
    const requestedYdPerHr = computeRequestedYardsPerHour(loadSize, spacing)
    const actualYdPerHr = computeActualYardsPerHour(totalYardage, actualDuration)
    const paceScore = requestedYdPerHr && actualYdPerHr ? clamp01(actualYdPerHr / requestedYdPerHr) : 1
    const smallJob = isSmallPourJob(expectedTrucks, totalYardage)

    const allTrucksLoaded = expectedTrucks ? loadedTimes.length >= expectedTrucks : false
    // For past days, `nowMin` is null and we treat everything with tickets
    // as completed. For today we wait for either all expected trucks to
    // have loaded or for the planned window (+ one cycle) to elapse.
    const windowElapsed = Number.isFinite(nowMin) && expectedEnd !== null ? nowMin > expectedEnd : true
    const isCompleted = !Number.isFinite(nowMin) || allTrucksLoaded || windowElapsed

    if (!isCompleted) {
        return {
            expectedTrucks: expectedTrucks ?? null,
            isLate: startLateness > BAD_SERVICE_LATE_THRESHOLD_MIN,
            startLateness,
            status: 'ongoing',
            ticketsLoaded: loadedTimes.length
        }
    }

    const isLate = startLateness > BAD_SERVICE_LATE_THRESHOLD_MIN
    const isSlow = !smallJob && paceScore < BAD_SERVICE_PACE_THRESHOLD
    return {
        actualYdPerHr,
        expectedTrucks: expectedTrucks ?? null,
        isLate,
        isSlow,
        paceScore,
        requestedYdPerHr,
        startLateness,
        status: isLate || isSlow ? 'bad' : 'good',
        ticketsLoaded: loadedTimes.length
    }
}

/* Row stagger — mirrors `ListViewModeSection.getRowDelay`. Early rows
 * cascade slowly; later rows arrive almost simultaneously so the table
 * feels lively without dragging on long lists. */
const ROW_BASE_DELAY_MS = 80
const ROW_MIN_DELAY_MS = 6
const ROW_DECAY_FACTOR = 0.88
export const getScheduleRowDelay = (index) => {
    let total = 0
    for (let i = 0; i < index; i++) {
        total += Math.max(ROW_MIN_DELAY_MS, ROW_BASE_DELAY_MS * Math.pow(ROW_DECAY_FACTOR, i))
    }
    return Math.round(total)
}

/* Sort options surfaced in the Schedule's "Sort by" dropdown and the
 * comparator that maps a chosen key to an ordering function. */
export const SORT_OPTIONS = [
    { key: 'plantThenTime', label: 'Plant, then start time' },
    { key: 'startTime', label: 'Start time' },
    { key: 'plantCode', label: 'Plant' },
    { desc: true, key: 'yardage', label: 'Yardage', numeric: true },
    { desc: true, key: 'truckCount', label: 'Trucks', numeric: true },
    { key: 'customer', label: 'Customer' }
]

const compareByStartTime = (a, b) => {
    const am = timeToMinutes(a.startTime)
    const bm = timeToMinutes(b.startTime)
    if (am == null && bm == null) return 0
    if (am == null) return 1
    if (bm == null) return -1
    return am - bm
}

const compareByPlant = (a, b) => String(a.plantCode || '').localeCompare(String(b.plantCode || ''))

export const compareOrders = (a, b, sortKey) => {
    const opt = SORT_OPTIONS.find((o) => o.key === sortKey) || SORT_OPTIONS[0]
    if (opt.key === 'plantThenTime') {
        return compareByPlant(a, b) || compareByStartTime(a, b)
    }
    if (opt.numeric) {
        const av = parseFloat(a[sortKey]) || 0
        const bv = parseFloat(b[sortKey]) || 0
        return (opt.desc ? bv - av : av - bv) || compareByPlant(a, b) || compareByStartTime(a, b)
    }
    if (opt.key === 'startTime') {
        return compareByStartTime(a, b) || compareByPlant(a, b)
    }
    if (opt.key === 'plantCode') {
        return compareByPlant(a, b) || compareByStartTime(a, b)
    }
    const cmp = String(a[opt.key] || '').localeCompare(String(b[opt.key] || ''))
    return cmp || compareByPlant(a, b) || compareByStartTime(a, b)
}

/** Available view modes for the Schedule's table-vs-cards toggle. */
export const VIEW_MODES = ['table', 'cards']

/* Single neutral identity for "open window" slot rows. The pour-size
 * differentiation lives entirely inside the inline `PourSizeBadge` so the
 * row stays calm and consistent with the other synthetic rows. */
export const SLOT_ROW_ACCENT = '#0ea5e9'
export const SLOT_ROW_TINT = 'rgba(14, 165, 233, 0.04)'

/** Tailwind class string shared by every variant of the per-order
 *  `ServiceBadge` (good / bad / ongoing / pending). */
export const SERVICE_BADGE_BASE =
    'inline-flex items-center gap-1 rounded-full text-[10.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap'

/** Minimum savings (minutes) for a non-assigned plant to count as "closer"
 *  in the Schedule's address column. Below this we don't surface it — the
 *  variance in live traffic estimates is enough that small savings aren't
 *  reliable. */
export const CLOSER_PLANT_MIN_SAVINGS = 5

/**
 * Earliest "load-out" minute of the day across a list of dispatch orders.
 * Equivalent to "when the first concrete left a plant today" — used as the
 * anchor for the 14-hour driver-shift check. Excluded orders (cancelled /
 * test) don't anchor the day; they'd otherwise inflate the elapsed window.
 */
export const getFirstLoadOutMinutes = (orders) => {
    let earliest = null
    for (const order of orders || []) {
        if (!order || isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (!Number.isFinite(startMin)) continue
        if (earliest == null || startMin < earliest) earliest = startMin
    }
    return earliest
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
    const travelOut = parseDurationMinutes(order?.toJobTime)
    const travelBackRaw = parseDurationMinutes(order?.toPlantTime)
    const travelBack = Number.isFinite(travelBackRaw) ? travelBackRaw : travelOut
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

/** 30-minute bucket size for help rows. A staggered crew arriving over an
 *  hour reads as two rows ("5 between 08:00–08:30, 5 between 08:30–09:00")
 *  rather than one row per driver. */
const HELP_BUCKET_MIN = 30

/**
 * Build per-driver help rows from the planner's assignments. Each row covers
 * one assignment-direction-bucket and tracks:
 *   - `time` (bucketed arrival/leave minute)
 *   - `count` (drivers in this bucket)
 *   - `rangeStart` / `rangeEnd` (actual minutes inside the bucket)
 *   - `clockInRangeStart` / `clockInRangeEnd` (origin-plant clock-in window
 *     for outbound rows, derived from `getTravelTime` + pre-trip + buffer)
 *
 * `getTravelTime(fromPlant, toPlant)` returns minutes between plants, or any
 * non-finite value when unknown. `plantProduction` is used to resolve the
 * destination order so the row can name the customer it's loading for.
 */
export const buildHelpRows = (assignments, plantProduction, getTravelTime) => {
    const grouped = new Map()
    const bump = (key, seed, time, clockInTime = null) => {
        const existing = grouped.get(key)
        if (existing) {
            existing.count += 1
            existing.rangeEnd = Math.max(existing.rangeEnd, time)
            existing.rangeStart = Math.min(existing.rangeStart, time)
            if (Number.isFinite(clockInTime)) {
                existing.clockInRangeStart = Number.isFinite(existing.clockInRangeStart)
                    ? Math.min(existing.clockInRangeStart, clockInTime)
                    : clockInTime
                existing.clockInRangeEnd = Number.isFinite(existing.clockInRangeEnd)
                    ? Math.max(existing.clockInRangeEnd, clockInTime)
                    : clockInTime
            }
        } else {
            grouped.set(key, {
                ...seed,
                clockInRangeEnd: Number.isFinite(clockInTime) ? clockInTime : null,
                clockInRangeStart: Number.isFinite(clockInTime) ? clockInTime : null,
                count: 1,
                rangeEnd: time,
                rangeStart: time
            })
        }
    }
    ;(assignments || []).forEach((a, idx) => {
        if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
        const returnPlant = a.returnPlant || a.fromPlant
        // When the dispatcher tied this help to a specific destination order,
        // look it up so the row can read "loading for #610" + customer
        // instead of the generic "backing up 402".
        let forOrder = null
        if (a.forOrderId) {
            const destOrders = plantProduction?.[a.toPlant]?.orders || []
            forOrder = destOrders.find((o) => (o.orderId || o.orderNum) === a.forOrderId) || null
        }
        // Travel pre-trip + buffer cushion the operator needs at fromPlant
        // before leaving. Same formula `calcClockIn` uses for assignment help
        // in the copyable plan brief — keeps the two sources aligned.
        const travelMin = typeof getTravelTime === 'function' ? getTravelTime(a.fromPlant, a.toPlant) : null
        const clockInOffsetMin = Number.isFinite(travelMin) ? travelMin + PRE_TRIP_MINUTES + BUFFER_MINUTES : null
        const driverTimes = buildAssignmentDriverTimes(a)
        driverTimes.forEach((dt) => {
            if (Number.isFinite(dt.arriveMin)) {
                const bucket = Math.floor(dt.arriveMin / HELP_BUCKET_MIN) * HELP_BUCKET_MIN
                const clockInMin = Number.isFinite(clockInOffsetMin)
                    ? Math.max(0, dt.arriveMin - clockInOffsetMin)
                    : null
                bump(
                    `out-${idx}-${bucket}`,
                    {
                        assignmentIndex: idx,
                        direction: 'outbound',
                        forOrder,
                        forOrderId: a.forOrderId || '',
                        fromPlant: a.fromPlant,
                        returnPlant,
                        time: bucket,
                        toPlant: a.toPlant
                    },
                    dt.arriveMin,
                    clockInMin
                )
            }
            if (Number.isFinite(dt.leaveMin) && dt.leaveMin > dt.arriveMin) {
                const bucket = Math.floor(dt.leaveMin / HELP_BUCKET_MIN) * HELP_BUCKET_MIN
                bump(
                    `rt-${idx}-${bucket}`,
                    {
                        assignmentIndex: idx,
                        direction: 'return',
                        forOrder,
                        forOrderId: a.forOrderId || '',
                        fromPlant: a.fromPlant,
                        returnPlant,
                        time: bucket,
                        toPlant: a.toPlant
                    },
                    dt.leaveMin
                )
            }
        })
    })
    return Array.from(grouped.values())
}

/** Buffer past the last expected load (~one full cycle) so a pour still
 *  wrapping up doesn't get scored before its closing trucks load. */
const SETTLE_BUFFER_MIN = 30

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
 * Convert help rows into the `(plantCode, time, delta)` events that
 * `computePlantPoolTimeline` consumes — outbound subtracts from `fromPlant`
 * and adds to `toPlant`; return subtracts from `toPlant` and adds to
 * `returnPlant` (which defaults to `fromPlant` when not overridden).
 *
 * Clock-in rows ramp the pool up over the day. The simulator handles them as
 * positive-delta inbound events identical in shape to inter-plant help
 * arrivals — just sourced from the operator showing up rather than another
 * plant.
 */
export const buildHelpTransfers = (helpRows, clockInRows) => {
    const out = []
    helpRows.forEach((row) => {
        if (row.direction === 'outbound') {
            out.push({ delta: -row.count, plantCode: row.fromPlant, time: row.time })
            out.push({ delta: row.count, plantCode: row.toPlant, time: row.time })
        } else {
            const home = row.returnPlant || row.fromPlant
            out.push({ delta: -row.count, plantCode: row.toPlant, time: row.time })
            out.push({ delta: row.count, plantCode: home, time: row.time })
        }
    })
    clockInRows.forEach((row) => {
        out.push({ delta: row.count, plantCode: row.plantCode, time: row.time })
    })
    return out
}

/** Plant codes that never inherit a reassigned order — these are special
 *  yards (404 lab/QC, 409 satellite) where loading from them doesn't imply
 *  the job actually belongs to them. */
const REASSIGNMENT_EXCLUDED_PLANTS = new Set(['404', '409'])
/** Floating-point slack when comparing loaded vs scheduled yardage. */
const REASSIGNMENT_YARDAGE_TOLERANCE = 0.01

/** Recompute the per-plant header values (`firstJobTime`, `lastJobTime`,
 *  `totalYardage`) after the order list changes. Mirrors the math in
 *  `groupOrderRowsByPlant` so reassigned blocks stay consistent. */
const recomputePlantBlockTotals = (orders) => {
    const realOrders = orders.filter((o) => !isExcludedOrder(o))
    const totalYardage = realOrders.reduce((sum, o) => sum + (parseFloat(o.yardage) || 0), 0)
    const times = realOrders
        .map((o) => o.startTime)
        .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
        .map((t) => t.padStart(5, '0'))
        .sort()
    return {
        firstJobTime: times[0] || '',
        lastJobTime: times[times.length - 1] || '',
        totalYardage: totalYardage > 0 ? String(totalYardage) : ''
    }
}

/** When an order is fully loaded by a single plant other than its assigned
 *  one (and that plant isn't on the excluded list), return that plant code.
 *  Otherwise null. */
const computeReassignmentTarget = (order, currentPlant, detailByOrderId) => {
    const orderId = order?.orderId
    if (!orderId) return null
    const detail = detailByOrderId[orderId]
    if (!detail) return null
    const scheduled = parseFloat(order.yardage) || 0
    if (scheduled <= 0) return null
    if ((detail.loadedYardage || 0) + REASSIGNMENT_YARDAGE_TOLERANCE < scheduled) return null

    const loadingPlants = Object.keys(detail.byPlant || {}).filter(
        (plant) => (detail.byPlant[plant]?.ticketCount || 0) > 0
    )
    if (loadingPlants.length !== 1) return null
    const target = loadingPlants[0]
    if (!target || target === currentPlant) return null
    if (REASSIGNMENT_EXCLUDED_PLANTS.has(target)) return null
    return target
}

/**
 * Move fully-loaded orders to the plant that actually loaded them. Only
 * fires when every ticket came from a single non-excluded plant other than
 * the order's currently-assigned plant — the schedule then visually
 * attributes the order to the plant doing the work.
 *
 * Returns the same `plantProduction` reference when nothing qualifies, so
 * downstream memos keep their referential equality.
 *
 * @param {Object} plantProduction - Original `{ [plantCode]: { orders, … } }`.
 * @param {Object} detailByOrderId - Ticket detail by order id (provides `byPlant`
 *   and `loadedYardage`).
 * @returns {Object} Reassigned `plantProduction`, or the original when no-op.
 */
export const applyLoadingPlantReassignment = (plantProduction, detailByOrderId) => {
    if (!plantProduction || !detailByOrderId) return plantProduction

    const moves = []
    Object.entries(plantProduction).forEach(([code, data]) => {
        if (code === PLAN_META_KEY) return
        if (!Array.isArray(data?.orders)) return
        data.orders.forEach((order) => {
            const target = computeReassignmentTarget(order, code, detailByOrderId)
            if (target) moves.push({ fromPlant: code, order, toPlant: target })
        })
    })
    if (moves.length === 0) return plantProduction

    const changeByPlant = new Map()
    const ensureChange = (plant) => {
        if (!changeByPlant.has(plant)) changeByPlant.set(plant, { add: [], remove: new Set() })
        return changeByPlant.get(plant)
    }
    moves.forEach(({ fromPlant, order, toPlant }) => {
        ensureChange(fromPlant).remove.add(order.orderId)
        ensureChange(toPlant).add.push(order)
    })

    const next = { ...plantProduction }
    changeByPlant.forEach((change, plant) => {
        const existing = next[plant] || { firstJobTime: '', lastJobTime: '', orders: [], totalYardage: '' }
        const orders = (existing.orders || [])
            .filter((o) => !change.remove.has(o.orderId))
            .concat(change.add)
            .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
        next[plant] = { ...existing, orders, ...recomputePlantBlockTotals(orders) }
    })
    return next
}
