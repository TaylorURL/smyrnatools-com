import {
    adjustPoolForDate,
    BIG_POUR_YARDAGE_THRESHOLD,
    isExcludedOrder,
    parseDurationMinutes,
    timeToMinutes
} from './PlanUtility'

/* Defaults used when an explicit field isn't provided on the request or an
 * order. Tuned to match common Smyrna pours so the recommender stays close
 * to reality without forcing the dispatcher to pick load-size / spacing on
 * the form. */
export const DEFAULT_LOAD_SIZE_YARDS = 10
export const DEFAULT_TRUCK_SPACING_MIN = 5
export const DEFAULT_POUR_TAIL_MIN = 30
export const DEFAULT_TRAVEL_OUT_MIN = 25

/* Recommendation score weights — must sum to 1.0. Capacity dominates because
 * sending a truck that doesn't exist is worse than sending one a few extra
 * miles; proximity is second; concurrent-load is a tiebreaker that prefers
 * a quieter plant when capacity & distance are roughly equal. */
const WEIGHT_CAPACITY = 0.5
const WEIGHT_PROXIMITY = 0.3
const WEIGHT_LOAD_BALANCE = 0.2

const ZIP_REGEX = /\b(\d{5})(?:-\d{4})?\b/
const STATE_REGEX = /\b([A-Z]{2})\b(?=[\s,]*\d{5})?/

/** Pull a 5-digit ZIP out of any address-ish string. */
export const extractZip = (address) => {
    if (!address) return null
    const match = String(address).match(ZIP_REGEX)
    return match ? match[1] : null
}

/** Pull a 2-letter state code, preferring one positioned just before a ZIP. */
export const extractStateCode = (address) => {
    if (!address) return null
    const upper = String(address).toUpperCase()
    const near = upper.match(STATE_REGEX)
    if (near) return near[1]
    const generic = upper.match(/\b([A-Z]{2})\b/)
    return generic ? generic[1] : null
}

/** Lowercased word tokens with the common suffixes / punctuation stripped so
 *  "401 Smyrna Blvd, Houston, TX" overlaps cleanly with "Houston Tx 77002". */
export const tokenizeAddress = (address) => {
    if (!address) return []
    return String(address)
        .toLowerCase()
        .replace(/[.,#]/g, ' ')
        .split(/\s+/)
        .filter((token) => token && !STREET_NOISE.has(token))
}

const STREET_NOISE = new Set([
    'ave',
    'avenue',
    'blvd',
    'boulevard',
    'dr',
    'drive',
    'rd',
    'road',
    'st',
    'street',
    'ln',
    'lane',
    'ct',
    'court',
    'pkwy',
    'parkway',
    'hwy',
    'highway',
    'us',
    'fm',
    'suite',
    'ste',
    'apt',
    'n',
    's',
    'e',
    'w'
])

/** 0..1 proximity score between a job address and a plant address. ZIP
 *  match is the strongest signal (same delivery area); a shared 3-digit
 *  ZIP prefix is a softer regional match; otherwise fall back to shared
 *  city / state tokens. Returns 0 when neither side has usable text. */
export const scoreProximity = (jobAddress, plantAddress) => {
    if (!jobAddress || !plantAddress) return 0
    const jobZip = extractZip(jobAddress)
    const plantZip = extractZip(plantAddress)
    if (jobZip && plantZip) {
        if (jobZip === plantZip) return 1
        if (jobZip.slice(0, 3) === plantZip.slice(0, 3)) return 0.7
    }
    const jobTokens = new Set(tokenizeAddress(jobAddress))
    const plantTokens = new Set(tokenizeAddress(plantAddress))
    if (!jobTokens.size || !plantTokens.size) return 0
    let shared = 0
    for (const token of jobTokens) if (plantTokens.has(token)) shared += 1
    const tokenScore = shared / Math.min(jobTokens.size, plantTokens.size)
    const stateBoost =
        extractStateCode(jobAddress) && extractStateCode(jobAddress) === extractStateCode(plantAddress) ? 0.15 : 0
    return Math.min(1, tokenScore * 0.6 + stateBoost)
}

/** Trucks needed to sustain the requested pour. Falls back to defaults when
 *  the dispatcher hasn't filled in load size / spacing. */
export const estimateRequiredTrucks = ({ yardage, loadSize, spacingMin, travelMin }) => {
    const yards = Number(yardage) || 0
    if (yards <= 0) return 0
    const load = Number(loadSize) > 0 ? Number(loadSize) : DEFAULT_LOAD_SIZE_YARDS
    const spacing = Number(spacingMin) > 0 ? Number(spacingMin) : DEFAULT_TRUCK_SPACING_MIN
    const travel = Number(travelMin) > 0 ? Number(travelMin) : DEFAULT_TRAVEL_OUT_MIN
    const trips = Math.max(1, Math.ceil(yards / load))
    const cycleMin = travel * 2 + DEFAULT_POUR_TAIL_MIN
    const rotation = Math.max(1, Math.ceil(cycleMin / spacing))
    return Math.min(trips, rotation)
}

/** End-to-end pour duration from first load to last truck back at plant. */
export const estimatePourDurationMinutes = ({ yardage, loadSize, spacingMin, travelMin }) => {
    const yards = Number(yardage) || 0
    if (yards <= 0) return 0
    const load = Number(loadSize) > 0 ? Number(loadSize) : DEFAULT_LOAD_SIZE_YARDS
    const spacing = Number(spacingMin) > 0 ? Number(spacingMin) : DEFAULT_TRUCK_SPACING_MIN
    const travel = Number(travelMin) > 0 ? Number(travelMin) : DEFAULT_TRAVEL_OUT_MIN
    const trips = Math.max(1, Math.ceil(yards / load))
    return (trips - 1) * spacing + travel + DEFAULT_POUR_TAIL_MIN
}

const orderTimeWindow = (order) => {
    const startMin = timeToMinutes(order?.startTime)
    if (!Number.isFinite(startMin)) return null
    const yards = parseFloat(order?.yardage) || 0
    const load = parseFloat(order?.loadSize) || DEFAULT_LOAD_SIZE_YARDS
    const spacing = parseDurationMinutes(order?.rate) ?? DEFAULT_TRUCK_SPACING_MIN
    const trips = yards > 0 && load > 0 ? Math.max(1, Math.ceil(yards / load)) : 1
    const duration = (trips - 1) * spacing + DEFAULT_TRAVEL_OUT_MIN + DEFAULT_POUR_TAIL_MIN
    return { endMin: startMin + duration, startMin, trips }
}

const overlapsWindow = (window, requestStart, requestEnd) => {
    if (!window) return false
    return window.startMin < requestEnd && window.endMin > requestStart
}

/** Sum of trucks already engaged at this plant during the requested window.
 *  Used to discount the plant's pool size when scoring availability. */
export const computeConcurrentTrucks = (plantOrders, requestStart, requestEnd) => {
    if (!Array.isArray(plantOrders) || requestEnd <= requestStart) return 0
    let busy = 0
    for (const order of plantOrders) {
        if (isExcludedOrder(order)) continue
        const window = orderTimeWindow(order)
        if (!overlapsWindow(window, requestStart, requestEnd)) continue
        const explicit = parseFloat(order?.truckCount)
        const trucks = Number.isFinite(explicit) && explicit > 0 ? explicit : window.trips
        busy += trucks
    }
    return Math.round(busy)
}

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)

/* Conversion of one-way travel minutes → 0..1 proximity score. 0 min ≈ 1.0,
 * a 60+ min haul collapses to 0. Linear decay reads naturally for the
 * dispatcher: a 30-min plant scores ~0.5, half as "close" as a 0-min one.
 * Same horizon doubles as the hard cutoff in `rankPlantsForBooking` —
 * plants further than this are dropped from the recommendations entirely. */
export const TRAVEL_MIN_HORIZON = 60

const travelMinutesToProximity = (travelMin) => {
    if (!Number.isFinite(travelMin) || travelMin < 0) return null
    return clamp01(1 - travelMin / TRAVEL_MIN_HORIZON)
}

/** Score one plant for the given booking request. Returns the full
 *  breakdown so the UI can explain WHY a plant ranked where it did.
 *
 *  When `travelMinByPlantCode[plantCode]` is provided, real driving minutes
 *  drive the proximity score. ZIP/token matching only kicks in as a
 *  fallback while the live travel-time fetch is still in flight. */
export const scorePlantForBooking = ({
    plant,
    plantProduction,
    mixerCountsByPlant,
    planDate,
    request,
    travelMinByPlantCode
}) => {
    const plantCode = plant?.plantCode || plant?.plant_code
    const plantAddress = plant?.plantAddress || plant?.plant_address || ''
    const plantName = plant?.plantName || plant?.plant_name || plantCode
    const orders = plantProduction?.[plantCode]?.orders || []
    const requestStart = request.startMin
    const requestEnd = request.startMin + request.durationMin
    const trucksNeeded = request.trucksNeeded
    const rawPool = mixerCountsByPlant?.[plantCode] || 0
    const adjustedPool = adjustPoolForDate(rawPool, planDate)
    const busy = computeConcurrentTrucks(orders, requestStart, requestEnd)
    const free = Math.max(0, adjustedPool - busy)
    const capacityScore = trucksNeeded > 0 ? clamp01(free / trucksNeeded) : adjustedPool > 0 ? 1 : 0
    const travelMin = travelMinByPlantCode?.[plantCode]
    const liveProximity = travelMinutesToProximity(travelMin)
    const proximityScore = liveProximity != null ? liveProximity : scoreProximity(request.address, plantAddress)
    const proximitySource = liveProximity != null ? 'travel' : 'heuristic'
    const loadBalanceScore = adjustedPool > 0 ? clamp01(1 - busy / adjustedPool) : 0
    const composite =
        WEIGHT_CAPACITY * capacityScore + WEIGHT_PROXIMITY * proximityScore + WEIGHT_LOAD_BALANCE * loadBalanceScore
    return {
        adjustedPool,
        busy,
        capacityScore,
        composite,
        free,
        loadBalanceScore,
        plantAddress,
        plantCode,
        plantName,
        proximityScore,
        proximitySource,
        rawPool,
        travelMin: Number.isFinite(travelMin) ? travelMin : null,
        trucksNeeded
    }
}

/** Rank every plant for the request, best-first. Plants with no usable code
 *  or zero adjusted pool (e.g. closed Sundays) are filtered out.
 *
 *  Closest-plant-wins rule: the highest proximity score always takes the #1
 *  slot — sending concrete from a far plant to a job a closer plant could
 *  cover is a worse outcome than that closer plant being temporarily short
 *  on trucks (the conflict panel surfaces the time-shift / order-move fix).
 *  Ties on proximity fall back to the composite score so capacity / load
 *  still break ties between equally-close plants. */
export const rankPlantsForBooking = ({
    plants,
    plantProduction,
    mixerCountsByPlant,
    planDate,
    request,
    travelMinByPlantCode
}) => {
    if (!Array.isArray(plants) || !request) return []
    const scored = plants
        .map((plant) =>
            scorePlantForBooking({
                mixerCountsByPlant,
                planDate,
                plant,
                plantProduction,
                request,
                travelMinByPlantCode
            })
        )
        .filter((row) => row.plantCode && row.adjustedPool > 0)
        /* Hard cutoff: plants known to be more than TRAVEL_MIN_HORIZON away
         * are dropped entirely so dispatch never sees them. Plants with no
         * travel data yet (geocode in flight, or address that didn't
         * resolve) stay in the list — silently hiding them on a transient
         * lookup failure would be worse than showing a slightly-stale row. */
        .filter((row) => !Number.isFinite(row.travelMin) || row.travelMin <= TRAVEL_MIN_HORIZON)
    /* Closest plant wins #1. When live travel minutes are available we sort
     * directly on minutes (smallest first) so two plants with proximity 1.0
     * from a same-ZIP heuristic can still be ordered correctly once the real
     * drive time arrives. Heuristic-scored plants fall back to proximity ties
     * broken by composite. */
    scored.sort((a, b) => {
        const aTravel = Number.isFinite(a.travelMin) ? a.travelMin : null
        const bTravel = Number.isFinite(b.travelMin) ? b.travelMin : null
        if (aTravel != null && bTravel != null && aTravel !== bTravel) return aTravel - bTravel
        if (b.proximityScore !== a.proximityScore) return b.proximityScore - a.proximityScore
        return b.composite - a.composite
    })
    return scored
}

/* Window scanned when proposing alternate start times. We never suggest
 * a booking past 13:00 — Smyrna's policy is to start every pour by 1 PM
 * so trucks are back well before end-of-shift. Big pours (≥ the existing
 * BIG_POUR_YARDAGE_THRESHOLD) ideally start in the 00:00–06:00 graveyard
 * window so concrete is in place before the morning rush; smaller pours
 * fit best in the 07:00–12:00 daylight window. The scan covers the full
 * 00:00–13:00 span and the sort below reorders so the right size-window
 * lands at the top.
 *
 * 15-min granularity matches the dispatcher's mental model (orders are
 * scheduled on 15-min boundaries). The min-gap is set to one step so we
 * only skip the dispatcher's exact requested time — a 15-minute shift
 * can absolutely be the right answer when the plant is just barely
 * overcommitted at the requested minute. */
/* Suggested slot granularity. Dispatchers schedule pours on the half-hour
 * (07:00 / 07:30 / 08:00 …); :15 and :45 starts are confusing to read on
 * the schedule strip and never used in practice, so we constrain every
 * slot the alternate-time and move scanners emit to the same boundary. */
const ALTERNATE_SCAN_STEP_MIN = 30
const ALTERNATE_SCAN_START_MIN = 0
const ALTERNATE_SCAN_END_MIN = 13 * 60
const ALTERNATE_MIN_GAP_MIN = ALTERNATE_SCAN_STEP_MIN
const BIG_POUR_PREFERRED_START_MIN = 0
const BIG_POUR_PREFERRED_END_MIN = 6 * 60
const SMALL_POUR_PREFERRED_START_MIN = 7 * 60
const SMALL_POUR_PREFERRED_END_MIN = 12 * 60
/* Earliest minute the scan considers when neither yesterday's tickets nor
 * today's existing orders give us an anchor. 04:30 is roughly the absolute
 * earliest Smyrna plants ever dispatch — and gives operators 10 hours of
 * rest off a prior shift ending at 18:30. */
const DEFAULT_EARLIEST_DISPATCH_MIN = 4 * 60 + 30
/* DOT 14-hour driver shift cap — clock-in to back-at-yard. Mirrored from
 * PlanScheduleUtility so this util stays self-contained. Suggestions whose
 * projected back-at-yard would push the plant's earliest operator past
 * this many minutes are filtered out. */
const SHIFT_LIMIT_MIN = 14 * 60
/* Mandated minimum off-the-clock window between an operator's last back-
 * at-yard and their next clock-in. Drives the per-plant floor derived
 * from yesterday's actual ticket times. */
const REST_HOURS_MIN = 10 * 60
/* Single-load discharge time at the job. Each ticket = one truck load; the
 * full pour TAIL only matters at the order level. */
const PER_LOAD_POUR_MIN = 10

/** Parse "HH:MM" or "HH:MM:SS" into minutes-of-day. Returns null on
 *  malformed input — matches the way dispatch's `loaded_time` cells come
 *  through. */
const parseHhmmToMin = (value) => {
    const parts = String(value || '').split(':')
    if (parts.length < 2) return null
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return h * 60 + m
}

/** Estimated round-trip cycle for a single dispatch ticket — travel out +
 *  one-load discharge + travel back — using the order's actual `toJobTime`
 *  / `toPlantTime` HH:MM cells when present, defaults otherwise. Added to
 *  a ticket's `loadedTime` to project back-at-yard for that truck. */
const projectTicketCycleMin = (order) => {
    const travelOut = parseDurationMinutes(order?.toJobTime) ?? DEFAULT_TRAVEL_OUT_MIN
    const travelBackRaw = parseDurationMinutes(order?.toPlantTime)
    const travelBack = Number.isFinite(travelBackRaw) ? travelBackRaw : travelOut
    return travelOut + PER_LOAD_POUR_MIN + travelBack
}

/**
 * Today's earliest legal first-load-out per plant, derived from
 * yesterday's actual dispatch tickets. For each truck that loaded at a
 * plant yesterday, we project its last back-at-yard from the ticket's
 * `loadedTime` plus the order's travel cycle, add the 10-hour DOT rest
 * window, and keep the minimum across that plant's trucks (the earliest
 * the plant could dispatch a single truck today). Returns
 * `{ [plantCode]: minutesOfDay }`. Plants with no yesterday activity are
 * omitted — callers can fall back to the schedule-derived floor for
 * those.
 *
 * @param {Object} yesterdayDetail - `fetchDetailByOrderId` output for the prior day.
 * @param {Object} yesterdayProduction - `fetchSchedule` output for the prior day,
 *   used to resolve each ticket back to its order's travel times.
 */
export const computeRestFloorByPlant = (yesterdayDetail, yesterdayProduction) => {
    if (!yesterdayDetail || typeof yesterdayDetail !== 'object') return {}

    const orderById = new Map()
    Object.entries(yesterdayProduction || {}).forEach(([code, block]) => {
        const orders = Array.isArray(block?.orders) ? block.orders : []
        orders.forEach((order) => {
            if (order?.orderId) orderById.set(order.orderId, { ...order, plantCode: code })
        })
    })

    /** truckNum → { plantCode, latestBackAtYardMin } — keep the latest
     *  projected end across yesterday's tickets per truck. */
    const perTruck = new Map()
    Object.values(yesterdayDetail).forEach((detail) => {
        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
        tickets.forEach((ticket) => {
            const truckNum = String(ticket?.truckNum || '').trim()
            if (!truckNum) return
            const loadedMin = parseHhmmToMin(ticket?.loadedTime)
            if (!Number.isFinite(loadedMin)) return
            const order = orderById.get(detail.orderId)
            const backAtYard = loadedMin + projectTicketCycleMin(order)
            const plantCode = String(ticket.plantId || order?.plantCode || '').trim()
            if (!plantCode) return
            const existing = perTruck.get(truckNum)
            if (!existing || existing.latestBackAtYardMin < backAtYard) {
                perTruck.set(truckNum, { latestBackAtYardMin: backAtYard, plantCode })
            }
        })
    })

    const byPlant = {}
    perTruck.forEach(({ latestBackAtYardMin, plantCode }) => {
        // back-at-yard + 10h rest, mapped onto today's clock. If the rest
        // window ends before midnight today (e.g. truck back at 10:00 +
        // 10h = 20:00 same day), the operator is free all of today and
        // the floor collapses to 0.
        const earliestClockInTodayMin = Math.max(0, latestBackAtYardMin + REST_HOURS_MIN - 24 * 60)
        if (byPlant[plantCode] == null || byPlant[plantCode] > earliestClockInTodayMin) {
            byPlant[plantCode] = earliestClockInTodayMin
        }
    })
    return byPlant
}

/** Round any minute-of-day up to the next ALTERNATE_SCAN_STEP_MIN
 *  boundary so the scan loop only ever lands on :00 / :30 starts even
 *  when the upstream floor (rest window or existing first-load-out) is
 *  off-grid. */
const roundUpToScanGranularity = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return 0
    return Math.ceil(mins / ALTERNATE_SCAN_STEP_MIN) * ALTERNATE_SCAN_STEP_MIN
}

/** Earliest minute the alternate-time scan should consider for the given
 *  plant day. Prefers the rest-derived floor (yesterday's actual ticket
 *  times → projected back-at-yard + 10h rest) when available. Falls back
 *  to the existing first-load-out so we don't push pours earlier than
 *  what's already booked, then to a hardcoded earliest-dispatch when the
 *  plant has no anchor at all. Always rounded up to the half-hour so
 *  every scan slot lands on :00 / :30. */
const computeScanFloor = (orders, restFloorMin) => {
    if (Number.isFinite(restFloorMin)) {
        return roundUpToScanGranularity(Math.max(ALTERNATE_SCAN_START_MIN, restFloorMin))
    }
    let earliest = null
    for (const order of orders || []) {
        if (!order || isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (!Number.isFinite(startMin)) continue
        if (earliest == null || startMin < earliest) earliest = startMin
    }
    const anchor = earliest ?? DEFAULT_EARLIEST_DISPATCH_MIN
    return roundUpToScanGranularity(Math.max(ALTERNATE_SCAN_START_MIN, anchor))
}

/** Approximate back-at-yard minute for a candidate window — the supplied
 *  `baseDurationMin` covers load + slump + travel-out + pour, so we tack
 *  on one default travel leg for the trip home. Conservative on requests
 *  whose `durationMin` already includes a return-cycle term, which biases
 *  us toward filtering aggressively rather than under-counting hours. */
const projectedBackAtYardMin = (startMin, baseDurationMin) => startMin + baseDurationMin + DEFAULT_TRAVEL_OUT_MIN

/** True when a candidate slot doesn't push any operator past the 14-hour
 *  shift cap. The clock-in anchor is whichever's earlier: the existing
 *  first-load-out or the candidate's own start — moving a pour earlier
 *  effectively becomes the day's new clock-in. */
const respectsShiftLimit = (startMin, projectedEndMin, scanFloorMin) => {
    const anchor = Math.min(scanFloorMin, startMin)
    return projectedEndMin - anchor <= SHIFT_LIMIT_MIN
}

/** True when `startMin` falls in the size-appropriate sweet-spot window
 *  (graveyard for big pours, mid-morning for everything else). */
const isPreferredStartWindow = (yardage, startMin) => {
    if (yardage >= BIG_POUR_YARDAGE_THRESHOLD) {
        return startMin >= BIG_POUR_PREFERRED_START_MIN && startMin < BIG_POUR_PREFERRED_END_MIN
    }
    return startMin >= SMALL_POUR_PREFERRED_START_MIN && startMin < SMALL_POUR_PREFERRED_END_MIN
}

/** Minutes between a candidate window and the nearest existing pour. Used to
 *  penalize alternates that strand trucks in multi-hour idle gaps — booking
 *  a 04:00 pour when nothing else runs until 08:00 leaves the pool sitting
 *  for hours, which is exactly what dispatchers want to avoid. Returns 0
 *  when the candidate overlaps or directly adjoins an existing order, and
 *  Infinity when the day has no real orders to anchor against. */
const computeIsolationMin = (candidateStart, candidateEnd, orders) => {
    let minDistance = Infinity
    for (const order of orders || []) {
        if (isExcludedOrder(order)) continue
        const window = orderTimeWindow(order)
        if (!window) continue
        if (window.startMin < candidateEnd && window.endMin > candidateStart) return 0
        if (candidateEnd <= window.startMin) {
            const gap = window.startMin - candidateEnd
            if (gap < minDistance) minDistance = gap
        }
        if (candidateStart >= window.endMin) {
            const gap = candidateStart - window.endMin
            if (gap < minDistance) minDistance = gap
        }
    }
    return minDistance
}

/* The request's full `durationMin` is misleading for the alternate-time
 * scan. A 200-yd pour with 30-min spacing has a 10-hour pour duration
 * (because the LAST truck doesn't return until the very end), but the
 * plant's pool is only fully *locked* for `trucksNeeded × spacing + cycle`
 * minutes — after that, dispatched trucks are returning one-by-one and
 * the pool can absorb other work. Use the lock-window for collision
 * detection so we don't wrongly conclude the day is full. */
const computeLockWindowMin = (request) => {
    const trucksNeeded = Math.max(1, request?.trucksNeeded || 0)
    const spacing =
        Number.isFinite(request?.spacingMin) && request.spacingMin > 0 ? request.spacingMin : DEFAULT_TRUCK_SPACING_MIN
    const cycle = DEFAULT_TRAVEL_OUT_MIN * 2 + DEFAULT_POUR_TAIL_MIN
    return Math.min(request.durationMin, trucksNeeded * spacing + cycle)
}

/** Best start times where the SAME plant could host the request. Each row
 *  carries `{ startMin, free, fits, shortBy }` so the UI can clearly mark
 *  windows that fully fit (no help / no rescheduling) versus windows that
 *  are merely "closest" (still short by N trucks). When at least one
 *  fitting slot exists we surface only fitting slots; otherwise we fall
 *  back to the highest-free windows so the dispatcher always sees the
 *  concrete best option Baytown can offer today. */
export const findAlternateStartTimes = ({
    count = 3,
    mixerCountsByPlant,
    planDate,
    plant,
    plantProduction,
    request,
    restFloorMin
}) => {
    if (!plant || !request) return []
    const plantCode = plant?.plantCode || plant?.plant_code
    const orders = plantProduction?.[plantCode]?.orders || []
    const rawPool = mixerCountsByPlant?.[plantCode] || 0
    const adjustedPool = adjustPoolForDate(rawPool, planDate)
    if (adjustedPool <= 0) return []
    const { startMin: requestStart, trucksNeeded } = request
    if (trucksNeeded <= 0) return []
    const lockWindowMin = computeLockWindowMin(request)
    const scanFloor = computeScanFloor(orders, restFloorMin)

    const allWindows = []
    for (let start = scanFloor; start + lockWindowMin <= ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        if (Math.abs(start - requestStart) < ALTERNATE_MIN_GAP_MIN) continue
        const end = start + lockWindowMin
        if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), scanFloor)) continue
        const busy = computeConcurrentTrucks(orders, start, end)
        const free = Math.max(0, adjustedPool - busy)
        allWindows.push({
            fits: free >= trucksNeeded,
            free,
            isolationMin: computeIsolationMin(start, end, orders),
            preferred: isPreferredStartWindow(request.yardage, start),
            shortBy: Math.max(0, trucksNeeded - free),
            startMin: start
        })
    }

    /* Sort key precedence:
     *   1. preferred size-window (graveyard for big, mid-morning for small)
     *   2. tightest cluster against existing pours — avoids stranding
     *      trucks in multi-hour idle gaps when a closer slot exists.
     *   3. earliest start, as a final tiebreaker. */
    const sortKey = (a, b) => {
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
        if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
        return a.startMin - b.startMin
    }
    const fitting = allWindows
        .filter((w) => w.fits)
        .sort(sortKey)
        .slice(0, count)
    if (fitting.length > 0) return fitting

    // Fallback: closest-possible windows. Smallest shortfall first, then
    // the standard preference / cluster / earliest cascade.
    return [...allWindows]
        .filter((w) => w.free > 0)
        .sort((a, b) => a.shortBy - b.shortBy || sortKey(a, b))
        .slice(0, count)
}

/** Existing orders at `plant` whose pour window overlaps the request and
 *  whose removal would free enough trucks for the new booking. Sorted
 *  smallest-first so the dispatcher sees the smallest disruption first.
 *  Each candidate carries a list of `alternateTimes` — start times on the
 *  SAME plant where that order could be re-scheduled (the plant always
 *  keeps its own bookings, we just shift them off the new request's
 *  window). Cross-plant absorption was removed because the closest-plant
 *  rule means the suggesting plant is the right home for jobs in this
 *  area; suggesting Conroe absorb a Pasadena order undermined that. */
export const findMoveCandidates = ({
    mixerCountsByPlant,
    planDate,
    plant,
    plantProduction,
    request,
    restFloorMin,
    maxCandidates = 3
}) => {
    if (!plant || !request) return []
    const plantCode = plant?.plantCode || plant?.plant_code
    const orders = plantProduction?.[plantCode]?.orders || []
    const rawPool = mixerCountsByPlant?.[plantCode] || 0
    const adjustedPool = adjustPoolForDate(rawPool, planDate)
    if (adjustedPool <= 0) return []
    const requestStart = request.startMin
    const requestEnd = request.startMin + request.durationMin
    const busy = computeConcurrentTrucks(orders, requestStart, requestEnd)
    const free = Math.max(0, adjustedPool - busy)
    const shortBy = Math.max(0, request.trucksNeeded - free)
    if (shortBy <= 0) return []

    const overlapping = orders
        .map((order) => {
            if (isExcludedOrder(order)) return null
            const window = orderTimeWindow(order)
            if (!overlapsWindow(window, requestStart, requestEnd)) return null
            const explicit = parseFloat(order?.truckCount)
            const trucks = Number.isFinite(explicit) && explicit > 0 ? explicit : window.trips
            return { order, trucks, window }
        })
        .filter(Boolean)
        .sort((a, b) => a.trucks - b.trucks || a.window.startMin - b.window.startMin)

    /* For each move candidate, scan the day for windows where the SAME
     * plant could re-host the moved order. Exclude the candidate from the
     * busy calc (we're moving it) and treat the new request as already
     * booked (the whole point of the move).
     *
     * Slot ranking mirrors `findAlternateStartTimes`: prefer size-window-
     * appropriate starts, then tightest cluster against the rest of the
     * day, then proximity to the order's original time (small shifts beat
     * big ones), earliest as a final tiebreaker. Floor + shift-cap stop
     * us from suggesting "move it to 00:00" when nothing else is running
     * pre-dawn. */
    const findReschedulesForOrder = (candidate, candidateDuration) => {
        const otherOrders = orders.filter((o) => o !== candidate.order)
        const moveScanFloor = computeScanFloor(otherOrders, restFloorMin)
        const candidateYardage = parseFloat(candidate.order?.yardage) || 0
        const out = []
        for (
            let start = moveScanFloor;
            start + candidateDuration <= ALTERNATE_SCAN_END_MIN;
            start += ALTERNATE_SCAN_STEP_MIN
        ) {
            if (Math.abs(start - candidate.window.startMin) < ALTERNATE_MIN_GAP_MIN) continue
            const end = start + candidateDuration
            if (!respectsShiftLimit(start, projectedBackAtYardMin(start, candidateDuration), moveScanFloor)) continue
            const otherBusy = computeConcurrentTrucks(otherOrders, start, end)
            const requestOverlapsHere = start < requestEnd && end > requestStart
            const requestBusy = requestOverlapsHere ? request.trucksNeeded : 0
            const totalBusy = otherBusy + requestBusy
            if (adjustedPool - totalBusy < candidate.trucks) continue
            out.push({
                free: adjustedPool - totalBusy,
                isolationMin: computeIsolationMin(start, end, otherOrders),
                preferred: isPreferredStartWindow(candidateYardage, start),
                proximityMin: Math.abs(start - candidate.window.startMin),
                startMin: start
            })
        }
        return out
            .sort((a, b) => {
                if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
                if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
                if (a.proximityMin !== b.proximityMin) return a.proximityMin - b.proximityMin
                return a.startMin - b.startMin
            })
            .slice(0, 2)
            .map(({ free, startMin }) => ({ free, startMin }))
    }

    const candidates = []
    for (const cand of overlapping) {
        const candidateDuration = Math.max(ALTERNATE_SCAN_STEP_MIN, cand.window.endMin - cand.window.startMin)
        candidates.push({
            alternateTimes: findReschedulesForOrder(cand, candidateDuration),
            order: cand.order,
            trucks: cand.trucks,
            window: cand.window
        })
        if (candidates.length >= maxCandidates) break
    }
    return candidates
}

/** Single best start time on a plant for the given request. Considers the
 *  full 00:00–13:00 scan window and prioritises:
 *    1. windows where the request fully fits (no help / no rescheduling)
 *    2. size-appropriate preferred window (graveyard for big pours, mid-
 *       morning for small)
 *    3. cluster adjacency — minimises idle gaps next to existing pours
 *    4. earliest start as a final tiebreaker
 *
 *  Used to detect when the dispatcher's typed time is suboptimal even
 *  without a truck shortage — a 17:00 booking on a plant whose last
 *  existing pour ends at 12:30 would happily fit, but it strands trucks
 *  for hours and violates the 1 PM cap. The view compares this slot's
 *  startMin to `request.startMin` and surfaces the shift with a reason
 *  when they differ. */
export const findRecommendedStartTime = ({
    mixerCountsByPlant,
    planDate,
    plant,
    plantProduction,
    request,
    restFloorMin
}) => {
    if (!plant || !request) return null
    const plantCode = plant?.plantCode || plant?.plant_code
    const orders = plantProduction?.[plantCode]?.orders || []
    const adjustedPool = adjustPoolForDate(mixerCountsByPlant?.[plantCode] || 0, planDate)
    if (adjustedPool <= 0) return null
    const trucksNeeded = request.trucksNeeded
    if (trucksNeeded <= 0) return null
    const lockWindowMin = computeLockWindowMin(request)
    const scanFloor = computeScanFloor(orders, restFloorMin)

    const candidates = []
    for (let start = scanFloor; start + lockWindowMin <= ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        const end = start + lockWindowMin
        if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), scanFloor)) continue
        const busy = computeConcurrentTrucks(orders, start, end)
        const free = Math.max(0, adjustedPool - busy)
        candidates.push({
            fits: free >= trucksNeeded,
            free,
            isolationMin: computeIsolationMin(start, end, orders),
            preferred: isPreferredStartWindow(request.yardage, start),
            shortBy: Math.max(0, trucksNeeded - free),
            startMin: start
        })
    }
    if (candidates.length === 0) return null
    candidates.sort((a, b) => {
        if (a.fits !== b.fits) return a.fits ? -1 : 1
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
        if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
        return a.startMin - b.startMin
    })
    return candidates[0]
}

/** Other plants that could lend trucks to `excludePlantCode` during the
 *  request window. "Help" in dispatch parlance means a plant sends one or
 *  more trucks to another plant for a pour. We list every plant with at
 *  least one free truck during the window, sorted by drive time from the
 *  job address (proxy for proximity to the suggesting plant — plants close
 *  to the job tend to be close to the suggesting plant since the job is
 *  what made it the suggestion). Returns empty when no plant has spare
 *  capacity, so the UI can render a "no help available" notice. */
export const findHelpAvailability = ({
    excludePlantCode,
    mixerCountsByPlant,
    planDate,
    plants,
    plantProduction,
    request,
    travelMinByPlantCode
}) => {
    if (!Array.isArray(plants) || !request) return []
    const requestStart = request.startMin
    const requestEnd = request.startMin + request.durationMin
    const result = []
    for (const plant of plants) {
        const plantCode = plant?.plantCode || plant?.plant_code
        if (!plantCode || plantCode === excludePlantCode) continue
        const plantOrders = plantProduction?.[plantCode]?.orders || []
        const adjustedPool = adjustPoolForDate(mixerCountsByPlant?.[plantCode] || 0, planDate)
        if (adjustedPool <= 0) continue
        const busy = computeConcurrentTrucks(plantOrders, requestStart, requestEnd)
        const free = Math.max(0, adjustedPool - busy)
        if (free <= 0) continue
        const travelMin = travelMinByPlantCode?.[plantCode]
        result.push({
            free,
            plantCode,
            plantName: plant?.plantName || plant?.plant_name || plantCode,
            travelMinFromJob: Number.isFinite(travelMin) ? travelMin : null
        })
    }
    result.sort((a, b) => {
        const aTravel = a.travelMinFromJob ?? Number.POSITIVE_INFINITY
        const bTravel = b.travelMinFromJob ?? Number.POSITIVE_INFINITY
        if (aTravel !== bTravel) return aTravel - bTravel
        return b.free - a.free
    })
    return result.slice(0, 4)
}

/** Bundles the "closest plant is short" diagnosis: how many trucks short,
 *  alternate times on the same plant, overlapping orders that could be
 *  re-scheduled, and nearby plants that have spare trucks they could lend
 *  for the request window. Returns null when the top plant can cover the
 *  request as-is. */
export const computeBookingConflict = ({
    mixerCountsByPlant,
    planDate,
    plants,
    plantProduction,
    ranked,
    request,
    restFloorByPlant,
    travelMinByPlantCode
}) => {
    const top = ranked?.[0]
    if (!top || !request) return null
    if (top.free >= top.trucksNeeded) return null
    const plant = (plants || []).find((p) => (p?.plantCode || p?.plant_code) === top.plantCode)
    if (!plant) return null
    const restFloorMin = restFloorByPlant?.[top.plantCode]
    return {
        alternateTimes: findAlternateStartTimes({
            mixerCountsByPlant,
            planDate,
            plant,
            plantProduction,
            request,
            restFloorMin
        }),
        helpAvailability: findHelpAvailability({
            excludePlantCode: top.plantCode,
            mixerCountsByPlant,
            planDate,
            plantProduction,
            plants,
            request,
            travelMinByPlantCode
        }),
        moveCandidates: findMoveCandidates({
            mixerCountsByPlant,
            planDate,
            plant,
            plantProduction,
            request,
            restFloorMin
        }),
        plantCode: top.plantCode,
        plantName: top.plantName,
        shortBy: top.trucksNeeded - top.free
    }
}

/** Build the request shape consumed by the scorer from raw form values.
 *  Returns null when required fields are missing or invalid so the view
 *  can show a friendly "fill the form first" placeholder.
 *
 *  `spacingMin` is required to be > 0 only when the pour spans more than one
 *  load (yardage > DEFAULT_LOAD_SIZE_YARDS) — single-truck pours don't have a
 *  spacing decision to make. When omitted/falsy it falls back to
 *  DEFAULT_TRUCK_SPACING_MIN inside the duration / truck-count helpers. */
export const buildBookingRequest = ({ address, spacingMin, startTime, yardage }) => {
    const yards = parseFloat(yardage)
    const startMin = timeToMinutes(startTime)
    if (!yards || yards <= 0) return null
    if (!Number.isFinite(startMin)) return null
    if (!address || !String(address).trim()) return null
    const spacing = parseFloat(spacingMin)
    const requiresSpacing = yards > DEFAULT_LOAD_SIZE_YARDS
    if (requiresSpacing && (!Number.isFinite(spacing) || spacing <= 0)) return null
    const trucksNeeded = estimateRequiredTrucks({ spacingMin: spacing, yardage: yards })
    const durationMin = estimatePourDurationMinutes({ spacingMin: spacing, yardage: yards })
    return {
        address: String(address).trim(),
        durationMin,
        spacingMin: Number.isFinite(spacing) && spacing > 0 ? spacing : DEFAULT_TRUCK_SPACING_MIN,
        startMin,
        trucksNeeded,
        yardage: yards
    }
}

/** Color tone for a 0..1 score — same red/amber/green palette used elsewhere
 *  in the schedule tab so the dispatcher reads it without thinking. */
export const scoreTone = (score) => {
    if (score >= 0.75) return '#16a34a'
    if (score >= 0.5) return '#d97706'
    return '#dc2626'
}

/** Short label for a score chip — keeps the badge readable at a glance. */
export const scoreLabel = (score) => {
    if (score >= 0.85) return 'Excellent'
    if (score >= 0.7) return 'Strong'
    if (score >= 0.5) return 'Workable'
    if (score >= 0.3) return 'Tight'
    return 'Poor'
}
