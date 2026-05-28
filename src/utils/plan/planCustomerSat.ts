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

/* Lateness tiers shared across the Satisfaction, Service, and
 * Customer Lookup surfaces. The cutoffs match operations' verbal
 * grading: 15 min late = "Not Good", 30 min = "Bad", > 60 min =
 * "Very Bad".
 *
 * Slow is a SEPARATE axis (pour-pace failure) and never lands in a
 * lateness tier — it has its own `isSlow` flag and its own column on
 * the pages. An order that's both late and slow gets tagged with the
 * relevant lateness tier AND remains flagged slow. */
export const NOT_GOOD_LATE_MIN = 15
export const BAD_LATE_MIN = 30
export const VERY_BAD_LATE_MIN = 60

export type ServiceTier = 'good' | 'notGood' | 'bad' | 'veryBad'

/** Order the tiers worsen, useful for any caller that wants to walk
 *  them in display order (Good → Not Good → Bad → Very Bad). */
export const SERVICE_TIER_ORDER: ServiceTier[] = ['good', 'notGood', 'bad', 'veryBad']

/** Human label + accent color per tier. Pinned here so every page
 *  renders the same words / hues for the same verdict. */
export const SERVICE_TIER_META: Record<ServiceTier, { color: string; label: string }> = {
    bad: { color: '#dc2626', label: 'Bad' },
    good: { color: '#16a34a', label: 'Good' },
    notGood: { color: '#f59e0b', label: 'Not Good' },
    veryBad: { color: '#7f1d1d', label: 'Very Bad' }
}

/** Maps a verdict to its severity tier. Late orders band by minutes
 *  (Not Good → Bad → Very Bad); a slow-but-on-time order lands in
 *  `notGood`. `good` is returned only when the order is neither late nor
 *  slow, so the tier always agrees with `isBad` (good ⟺ not bad) and the
 *  graded breakdown can never disagree with the binary good/bad count. */
export function classifyServiceTier({
    isLate,
    isSlow = false,
    latenessMin
}: {
    isLate: boolean
    isSlow?: boolean
    latenessMin: number
}): ServiceTier {
    if (isLate) {
        if (latenessMin > VERY_BAD_LATE_MIN) return 'veryBad'
        if (latenessMin >= BAD_LATE_MIN) return 'bad'
        return 'notGood'
    }
    if (isSlow) return 'notGood'
    return 'good'
}

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
    /** Slow = pace fell below the requested-rate threshold
     *  (`slow_pace_min_ratio`, default 1.0). Applies to every pour — small
     *  jobs are no longer exempt from the slow check. */
    isSlow: boolean
    /** Combined verdict — bad service when either dimension trips. */
    isBad: boolean
    /** Severity tier the order falls into. `good` when neither dimension
     *  tripped, `notGood` / `bad` / `veryBad` by lateness banding (slow-
     *  only orders land in `notGood`). Surfaced so the satisfaction /
     *  service / customer-lookup pages can break the binary `isBad`
     *  count into a meaningful spread. */
    tier: ServiceTier
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
    /** Sum of ticket quantities AFTER the first kicker-gap. Zero when the
     *  order had no kicker (most jobs). The same value the View Tickets
     *  popup shows in its "Kicker added" pill, so the badge / lookup row
     *  and the popup can never disagree about the kicker total. */
    kickerYards: number
    /** Ticket count after the kicker break — i.e. how many trucks the
     *  customer added mid-pour. Zero when there was no kicker. */
    kickerLoads: number
    /** Whether the order ended with a kicker. Equivalent to
     *  `kickerLoads > 0` but exposed explicitly so callers don't conflate
     *  "no kicker" with "kicker yardage couldn't be measured." */
    hasKicker: boolean
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
    hasKicker: false,
    isBad: false,
    isLate: false,
    isSlow: false,
    kickerLoads: 0,
    kickerYards: 0,
    latenessMin: 0,
    measured: false,
    numTrucks: 0,
    paceScore: null,
    paceYardage: 0,
    startMin: null,
    startTime: '',
    tier: 'good'
}

/**
 * Per-order verdict: late, slow, or fine. The canonical source for
 * "good vs. bad experience" classification — used both by
 * `computeCustomerSatisfaction` (which only needs the binary `isBad`)
 * and the Statistics → Service sub-page (which needs the breakdown).
 *
 * An order is "late" when the first loaded ticket landed > 15 min after
 * the scheduled start. An order is "slow" when the actual yd/hr fell below
 * the requested-rate threshold (`slow_pace_min_ratio`, default 1.0) — this
 * applies to every pour, small jobs included. Either flag (or both) marks
 * the order as bad service.
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
    const hasKicker = kickerStartIndex >= 0
    const originalTickets = hasKicker ? sortedTickets.slice(0, kickerStartIndex) : sortedTickets
    if (!originalTickets.length) return UNMEASURED_VERDICT
    const kickerTickets = hasKicker ? sortedTickets.slice(kickerStartIndex) : []
    const kickerYards = kickerTickets.reduce((sum, t) => sum + t.quantity, 0)

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

    /* Effective pour span — match what the View Tickets popup reports so
     * the badge and the popup can never disagree. The popup divides by
     * `max(actualSpan, plannedSpan)` so a fast burst (e.g. four trucks
     * back-to-back in 6 min when planned spacing was 5 min × 3 = 15 min)
     * doesn't read as an impossible 200 yd/hr; the trade-off is that
     * jobs that finish within the planned window land exactly at the
     * target rate (paceScore = 1.0), neither slow nor exceeding pace.
     * Jobs that actually overshoot the planned span score < 1.0 and now
     * trip the slow flag, matching the popup's red/amber indicator. */
    const plannedSpan = numTrucks > 1 ? (numTrucks - 1) * spacing : 0
    const effectiveSpan = Math.max(actualDuration, plannedSpan)

    const requestedYdPerHr = computeRequestedYardsPerHour(loadSize, spacing)
    // Pace counts yards delivered ACROSS the pour window, excluding the
    // opening truck — it lands at the window start, so N loads only span
    // N−1 gaps. Counting the full cohort against that span double-counts
    // load #1 and masks doubled spacing (a 25-min request served every
    // 50 min would otherwise score 100%). Mirrors OrderTicketsModal so the
    // badge and the View Tickets popup never disagree.
    const openingLoad = originalYardage > 0 ? first.quantity : paceYardage / originalTickets.length
    const spanYardage = originalTickets.length > 1 ? Math.max(0, paceYardage - openingLoad) : 0
    const actualYdPerHr = computeActualYardsPerHour(spanYardage, effectiveSpan)
    const paceScore = requestedYdPerHr && actualYdPerHr ? clamp01(actualYdPerHr / requestedYdPerHr) : null
    const paceScoreForCheck = paceScore == null ? 1 : paceScore

    const isLate = startLateness > BAD_SERVICE_LATE_THRESHOLD_MIN
    // Every pour is held to the requested pace — small jobs are no longer
    // exempt. A 2-truck order served at half the requested spacing is slow
    // service regardless of size.
    const isSlow = paceScoreForCheck < BAD_SERVICE_PACE_THRESHOLD
    const tier = classifyServiceTier({ isLate, isSlow, latenessMin: startLateness })

    return {
        firstDriverName: first.driverName,
        firstLoadMin: first.mins,
        firstLoadTime: first.loadedTime,
        firstTruckNum: first.truckNum,
        hasKicker: hasKicker && kickerTickets.length > 0,
        isBad: isLate || isSlow,
        isLate,
        isSlow,
        kickerLoads: kickerTickets.length,
        kickerYards,
        latenessMin: startLateness,
        measured: true,
        numTrucks,
        paceScore,
        paceYardage,
        startMin: Number.isFinite(startMin) ? (startMin as number) : null,
        startTime: order?.startTime || '',
        tier
    }
}

/** Per-day customer-satisfaction aggregate. Walks orders, scores each via
 *  `scoreOrderExperience`, and returns the good/bad split + score ratio.
 *  Unmeasured orders are excluded from the sample count — the score is
 *  always relative to orders we could actually judge.
 *
 *  Also returns `tierCounts` — the breakdown of the bad/good population
 *  into `good` / `notGood` / `bad` / `veryBad` so callers (Customer
 *  Satisfaction / Service / Customer Lookup pages) can render a graded
 *  breakdown instead of just the binary good/bad split. */
export const computeCustomerSatisfaction = (orders, detailByOrderId) => {
    if (!Array.isArray(orders) || !orders.length) return null
    let samples = 0
    let badService = 0
    const tierCounts: Record<ServiceTier, number> = { bad: 0, good: 0, notGood: 0, veryBad: 0 }

    orders.forEach((order) => {
        const detail = order?.orderId ? detailByOrderId?.[order.orderId] : null
        const verdict = scoreOrderExperience(order, detail)
        if (!verdict.measured) return
        samples += 1
        if (verdict.isBad) badService += 1
        tierCounts[verdict.tier] += 1
    })

    if (samples === 0) return null
    const goodService = samples - badService
    return {
        badService,
        goodService,
        samples,
        score: goodService / samples,
        tierCounts
    }
}
