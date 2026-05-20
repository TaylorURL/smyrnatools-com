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

/** Minimum minutes between load times that qualifies as a kicker break,
 *  regardless of spacing. Real-world kicker calls land at least 30 min
 *  after the original cohort finishes — short gaps are just normal pour
 *  staggering or a single truck running long. */
const KICKER_MIN_GAP_MIN = 30
/** Multiplier on order spacing that also qualifies as a kicker break. A
 *  3× spacing gap means the customer paused the pour for the equivalent
 *  of three full loads — that's a deliberate top-up, not normal slop. */
const KICKER_SPACING_MULTIPLIER = 3

/** Splits chronologically-sorted load times into the original cohort and a
 *  kicker cohort. A kicker is detected when the gap between two consecutive
 *  loads exceeds `max(3 × spacing, 30 min)`. Everything at or after the
 *  first qualifying gap is the kicker; everything before is the original.
 *
 *  The order's `yardage` field is updated by dispatch when a kicker is added
 *  — the original cohort can't be read off the order itself, only inferred
 *  from the load-time sequence. Callers pass minute-of-day numbers (already
 *  parsed) so the helper stays free of date parsing. */
export const splitTicketsAtKicker = (sortedLoadMins, spacingMinutes) => {
    if (!Array.isArray(sortedLoadMins) || sortedLoadMins.length < 2) {
        return { kickerStartIndex: -1, original: sortedLoadMins || [] }
    }
    const spacing = spacingMinutes > 0 ? spacingMinutes : 5
    const gapThreshold = Math.max(KICKER_MIN_GAP_MIN, KICKER_SPACING_MULTIPLIER * spacing)
    for (let i = 1; i < sortedLoadMins.length; i++) {
        if (sortedLoadMins[i] - sortedLoadMins[i - 1] > gapThreshold) {
            return { kickerStartIndex: i, original: sortedLoadMins.slice(0, i) }
        }
    }
    return { kickerStartIndex: -1, original: sortedLoadMins }
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

/** Verdict shape returned by `scoreOrderExperience`. Consumers either care
 *  about `measured` (was there enough data to judge) and `isBad` (binary
 *  service classifier), or they reach for the breakdown fields to
 *  separate late from slow and surface the per-order detail. */
export interface OrderExperienceVerdict {
    /* True when the order had usable tickets + a scheduled start time,
     * i.e. there's enough signal to classify. False rows must be skipped
     * by callers so unmeasurable orders don't tilt the score. */
    measured: boolean
    /** Late = first loaded ticket landed > 15 min after scheduled start. */
    isLate: boolean
    /** Slow = pace fell below 70% of requested AND the pour isn't a small
     *  job (≤3 trucks or ≤30 yd). Small pours get a free pass — their
     *  cadence is set by the customer's finishing crew, not dispatch. */
    isSlow: boolean
    /** Combined verdict — bad service when either dimension trips. */
    isBad: boolean
    /** Minutes the first ticket loaded after scheduled start; 0 when on
     *  time or scheduled time was missing. */
    latenessMin: number
    /** Achieved-yards-per-hour ÷ requested-yards-per-hour, clamped to
     *  [0, 1]. `null` when the pace isn't measurable (one truck only,
     *  zero yardage, missing schedule rate). */
    paceScore: number | null
    /** Minute-of-day for the first original-cohort ticket, useful when
     *  the caller wants the load time directly. `null` when unmeasured. */
    firstLoadMin: number | null
    /** Raw `loadedTime` HH:MM string of the first original-cohort ticket. */
    firstLoadTime: string
    /** Driver name from the first original-cohort ticket. Informational
     *  only — drivers don't control late/slow outcomes, so callers must
     *  not use this for performance attribution. */
    firstDriverName: string
    /** Truck number from the first original-cohort ticket. */
    firstTruckNum: string
    /** Estimated trucks the original cohort would have needed (used by
     *  the small-pour guard). */
    numTrucks: number
    /** Original-cohort yardage used in the pace calc (post-kicker filter). */
    paceYardage: number
    /** Scheduled pour-start minute-of-day. `null` when missing. */
    startMin: number | null
    /** Raw `startTime` HH:MM string from the order. */
    startTime: string
}

const UNMEASURED_VERDICT: OrderExperienceVerdict = {
    firstDriverName: '',
    firstLoadMin: null,
    firstLoadTime: '',
    firstTruckNum: '',
    isBad: false,
    isLate: false,
    isSlow: false,
    latenessMin: 0,
    measured: false,
    numTrucks: 0,
    paceScore: null,
    paceYardage: 0,
    startMin: null,
    startTime: ''
}

/**
 * Per-order verdict: late, slow, or fine. The canonical source for
 * "good vs. bad experience" classification — used both by
 * `computeCustomerSatisfaction` (which only needs the binary `isBad`)
 * and the Statistics → Service sub-page (which needs the breakdown).
 *
 * An order is "late" when the first loaded ticket landed > 15 min after
 * the scheduled start. An order is "slow" when — for non-small pours —
 * the actual yd/hr fell below 70% of the requested rate. Either flag
 * (or both) marks the order as bad service.
 *
 * Pace is evaluated against the ORIGINAL cohort only — load times after
 * a kicker gap (customer adding yardage mid-pour) are excluded from the
 * yd/hr math. A pour that ran perfectly until the customer called in
 * more yardage two hours later shouldn't be flagged as slow service.
 */
export function scoreOrderExperience(order, detail): OrderExperienceVerdict {
    const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
    const sortedTickets = tickets
        .map((t) => ({
            driverName: String(t?.driverName ?? ''),
            loadedTime: String(t?.loadedTime ?? ''),
            mins: timeToMinutes(t?.loadedTime),
            quantity: parseFloat(t?.quantity) || 0,
            truckNum: String(t?.truckNum ?? '')
        }))
        .filter((entry) => Number.isFinite(entry.mins))
        .sort((a, b) => a.mins - b.mins)
    if (!sortedTickets.length) return UNMEASURED_VERDICT

    const loadSize = parseFloat(order?.loadSize) || 0
    const startMin = timeToMinutes(order?.startTime)
    const spacing = parseDurationMinutes(order?.rate) ?? 5

    const { kickerStartIndex } = splitTicketsAtKicker(
        sortedTickets.map((t) => t.mins),
        spacing
    )
    const originalTickets = kickerStartIndex >= 0 ? sortedTickets.slice(0, kickerStartIndex) : sortedTickets
    if (!originalTickets.length) return UNMEASURED_VERDICT

    const originalYardage = originalTickets.reduce((sum, t) => sum + t.quantity, 0)
    const scheduledYardage = parseFloat(order?.yardage) || 0
    // When per-ticket quantities are missing (cross-plant tickets early
    // in the day), fall back to the scheduled total scaled by the
    // original cohort's share of all tickets — close enough for pace.
    const paceYardage =
        originalYardage > 0
            ? originalYardage
            : scheduledYardage > 0
              ? (scheduledYardage * originalTickets.length) / sortedTickets.length
              : 0

    const numTrucks =
        loadSize > 0 && paceYardage > 0 ? Math.max(1, Math.ceil(paceYardage / loadSize)) : originalTickets.length

    const first = originalTickets[0]
    const lastLoad = originalTickets[originalTickets.length - 1].mins
    const actualDuration = Math.max(0, lastLoad - first.mins)
    const startLateness = Number.isFinite(startMin) ? Math.max(0, first.mins - (startMin as number)) : 0

    const requestedYdPerHr = computeRequestedYardsPerHour(loadSize, spacing)
    const actualYdPerHr = computeActualYardsPerHour(paceYardage, actualDuration)
    const paceScore = requestedYdPerHr && actualYdPerHr ? clamp01(actualYdPerHr / requestedYdPerHr) : null
    const paceScoreForCheck = paceScore == null ? 1 : paceScore

    const isLate = startLateness > BAD_SERVICE_LATE_THRESHOLD_MIN
    const isSlow = !isSmallPourJob(numTrucks, paceYardage) && paceScoreForCheck < BAD_SERVICE_PACE_THRESHOLD

    return {
        firstDriverName: first.driverName,
        firstLoadMin: first.mins,
        firstLoadTime: first.loadedTime,
        firstTruckNum: first.truckNum,
        isBad: isLate || isSlow,
        isLate,
        isSlow,
        latenessMin: startLateness,
        measured: true,
        numTrucks,
        paceScore,
        paceYardage,
        startMin: Number.isFinite(startMin) ? (startMin as number) : null,
        startTime: order?.startTime || ''
    }
}

/** Per-day customer-satisfaction aggregate. Walks orders, scores each via
 *  `scoreOrderExperience`, and returns the good/bad split + score ratio.
 *  Unmeasured orders are excluded from the sample count — the score is
 *  always relative to orders we could actually judge. */
export const computeCustomerSatisfaction = (orders, detailByOrderId) => {
    if (!Array.isArray(orders) || !orders.length) return null
    let samples = 0
    let badService = 0

    orders.forEach((order) => {
        const detail = order?.orderId ? detailByOrderId?.[order.orderId] : null
        const verdict = scoreOrderExperience(order, detail)
        if (!verdict.measured) return
        samples += 1
        if (verdict.isBad) badService += 1
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
