import { adjustPoolForDate, isExcludedOrder, parseDurationMinutes, timeToMinutes } from './PlanUtility'

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

/**
 * Pre-defined pour-method profiles. Each option carries the per-truck
 * `tailMin` (the minutes the last truck spends on-site discharging +
 * cleaning up) and a typical `spacingMin` between truck arrivals. The
 * combination drives both how many trucks the recommender thinks are
 * needed AND how long the pour ties up the plant's pool.
 *
 * Pumps move concrete fastest — the truck just dumps into the pump
 * hopper and leaves — so spacing and tail are tight. Tailgating runs
 * the chute directly, slower per truck. "Various locations" assumes the
 * truck repositions multiple times for spread-out pours, which adds
 * meaningful overhead per truck.
 */
export const POUR_METHOD_OPTIONS = [
    { label: 'Large pump · fast pace', spacingMin: 4, tailMin: 20, value: 'large_pump_fast' },
    { label: 'Large pump · slow pace', spacingMin: 7, tailMin: 35, value: 'large_pump_slow' },
    { label: 'Small / ground pump · fast pace', spacingMin: 6, tailMin: 25, value: 'small_pump_fast' },
    { label: 'Small / ground pump · slow pace', spacingMin: 10, tailMin: 40, value: 'small_pump_slow' },
    { label: 'Tailgating · fast pace', spacingMin: 5, tailMin: 25, value: 'tailgate_fast' },
    { label: 'Tailgating · slow pace', spacingMin: 10, tailMin: 40, value: 'tailgate_slow' },
    { label: 'Tailgating · multiple locations', spacingMin: 12, tailMin: 50, value: 'tailgate_multi' },
    { label: 'Other · fast pace', spacingMin: 5, tailMin: 30, value: 'other_fast' },
    { label: 'Other · slow pace', spacingMin: 10, tailMin: 40, value: 'other_slow' }
]

/** Look up a pour-method profile by its `value` key. Returns null when the
 *  dispatcher hasn't picked one (the duration math then falls back to the
 *  spacing field + DEFAULT_POUR_TAIL_MIN). */
export const getPourMethodTimings = (value) => POUR_METHOD_OPTIONS.find((option) => option.value === value) || null

/** Trucks needed to sustain the requested pour. Falls back to defaults when
 *  the dispatcher hasn't filled in load size / spacing / pour method. */
export const estimateRequiredTrucks = ({ yardage, loadSize, spacingMin, tailMin, travelMin }) => {
    const yards = Number(yardage) || 0
    if (yards <= 0) return 0
    const load = Number(loadSize) > 0 ? Number(loadSize) : DEFAULT_LOAD_SIZE_YARDS
    const spacing = Number(spacingMin) > 0 ? Number(spacingMin) : DEFAULT_TRUCK_SPACING_MIN
    const tail = Number(tailMin) > 0 ? Number(tailMin) : DEFAULT_POUR_TAIL_MIN
    const travel = Number(travelMin) > 0 ? Number(travelMin) : DEFAULT_TRAVEL_OUT_MIN
    const trips = Math.max(1, Math.ceil(yards / load))
    const cycleMin = travel * 2 + tail
    const rotation = Math.max(1, Math.ceil(cycleMin / spacing))
    return Math.min(trips, rotation)
}

/* Hard cap on simultaneous launches per plant. A single plant can't
 * physically load four trucks at the same minute — load + slump + chute
 * cleanup compete for the same loading bay, so dispatch reality is two
 * trucks side-by-side at most plants and three at the busiest. We
 * expose 3 as the ceiling and reject any slot suggestion that would
 * push a plant past it. */
export const MAX_CONCURRENT_LAUNCHES_PER_PLANT = 3

/* Maximum drive-time (minutes) a lender plant can sit from the plant
 * that's short on trucks and still be considered viable help. Anything
 * beyond a one-hour drive eats too much of the lender's shift to make
 * dispatching their trucks practical, so those plants are filtered out
 * of the help-availability list entirely. */
export const MAX_HELP_TRAVEL_MIN_FROM_PLANT = 60

/** Count of non-excluded orders at `plant` whose `startTime` matches
 *  `startMin` exactly. Used by every slot scanner to enforce the
 *  per-plant launch cap above. Cancelled / test orders are skipped so
 *  they don't block real bookings. */
export const countOrdersAtSameStart = (orders, startMin) => {
    if (!Array.isArray(orders) || !Number.isFinite(startMin)) return 0
    let count = 0
    for (const order of orders) {
        if (!order || isExcludedOrder(order)) continue
        const orderStart = timeToMinutes(order?.startTime)
        if (orderStart === startMin) count += 1
    }
    return count
}

/** End-to-end pour duration from first load to last truck back at plant. */
export const estimatePourDurationMinutes = ({ yardage, loadSize, spacingMin, tailMin, travelMin }) => {
    const yards = Number(yardage) || 0
    if (yards <= 0) return 0
    const load = Number(loadSize) > 0 ? Number(loadSize) : DEFAULT_LOAD_SIZE_YARDS
    const spacing = Number(spacingMin) > 0 ? Number(spacingMin) : DEFAULT_TRUCK_SPACING_MIN
    const tail = Number(tailMin) > 0 ? Number(tailMin) : DEFAULT_POUR_TAIL_MIN
    const travel = Number(travelMin) > 0 ? Number(travelMin) : DEFAULT_TRAVEL_OUT_MIN
    const trips = Math.max(1, Math.ceil(yards / load))
    return (trips - 1) * spacing + travel + tail
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
    /* Per-plant launch cap — three orders on the same start minute is
     * the most a plant can physically load. When the requested time is
     * already at or over the cap, treat the slot as full regardless of
     * truck-pool headroom; the conflict panel will then surface the
     * "shift / reschedule / pull help" options instead of falsely
     * confirming the booking. */
    const sameSlotCount = countOrdersAtSameStart(orders, requestStart)
    const launchSlotFull = sameSlotCount >= MAX_CONCURRENT_LAUNCHES_PER_PLANT
    const effectiveFree = launchSlotFull ? 0 : free
    const capacityScore =
        trucksNeeded > 0 ? clamp01(effectiveFree / trucksNeeded) : adjustedPool > 0 && !launchSlotFull ? 1 : 0
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
        /* `free` reports zero when the launch slot is full so downstream
         * fit checks (`top.free >= top.trucksNeeded`) treat same-slot
         * overflow as a real shortage. `rawFree` keeps the unmasked
         * truck-pool number for diagnostic / display use. */
        free: effectiveFree,
        launchSlotFull,
        loadBalanceScore,
        plantAddress,
        plantCode,
        plantName,
        proximityScore,
        proximitySource,
        rawFree: free,
        rawPool,
        sameSlotCount,
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
    /* When at least one plant has a real geocoded drive time, drop the
     * plants that don't — a missing `travelMin` usually means the
     * plant's address (or the job's) didn't resolve, and we'd rather
     * recommend nothing for that plant than rank it on a coarse
     * ZIP-prefix heuristic that can pick a 75-mile-away plant over a
     * 35-mile one when both land in the same 3-digit ZIP region. The
     * "everyone is null" case (job geocode failed entirely) keeps the
     * heuristic ranking so the dispatcher still sees options — paired
     * with the no-travel-data hint surfaced in the headline. */
    const anyHasTravel = scored.some((row) => Number.isFinite(row.travelMin))
    const trimmed = anyHasTravel ? scored.filter((row) => Number.isFinite(row.travelMin)) : scored
    /* Closest plant wins #1. Sort priority:
     *   1. Plants WITH a real travel-time number rank above those without,
     *      so an unknown plant can never beat a known one purely on the
     *      proximity-heuristic / capacity tiebreaker.
     *   2. Among plants with travel data, smallest minutes first.
     *   3. Among plants without travel data (only relevant when
     *      `anyHasTravel` is false), heuristic proximity then composite. */
    trimmed.sort((a, b) => {
        const aTravel = Number.isFinite(a.travelMin) ? a.travelMin : null
        const bTravel = Number.isFinite(b.travelMin) ? b.travelMin : null
        if ((aTravel != null) !== (bTravel != null)) return aTravel != null ? -1 : 1
        if (aTravel != null && bTravel != null && aTravel !== bTravel) return aTravel - bTravel
        if (b.proximityScore !== a.proximityScore) return b.proximityScore - a.proximityScore
        return b.composite - a.composite
    })
    return trimmed
}

/* Window scanned when proposing alternate start times. The scan covers
 * the full 00:00–13:00 span — slots inside the canonical preferred
 * window (`PREFERRED_WINDOW_*`) rank ahead of slots outside it, but
 * outside slots are still considered when the preferred window is
 * fully booked. The 14-hour shift cap and 10-hour operator-rest reset
 * (via `restFloorMin` + `respectsShiftLimit`) prevent the scan from
 * recommending pre-dawn or late-afternoon starts that operators
 * physically can't make.
 *
 * 30-min granularity matches the dispatcher's mental model (orders are
 * scheduled on the half-hour); :15 and :45 starts are confusing to
 * read on the schedule strip and never used in practice, so we
 * constrain every slot the alternate-time and move scanners emit to
 * the same boundary. The min-gap is set to one step so we only skip
 * the dispatcher's exact requested time — a 30-minute shift can
 * absolutely be the right answer when the plant is just barely
 * overcommitted at the requested minute. */
const ALTERNATE_SCAN_STEP_MIN = 30
const ALTERNATE_SCAN_START_MIN = 0
const ALTERNATE_SCAN_END_MIN = 13 * 60
const ALTERNATE_MIN_GAP_MIN = ALTERNATE_SCAN_STEP_MIN
/* Canonical preferred booking window — fits any pour size. The
 * recommender fills this window first; once it's full, it spills
 * BEFORE (earlier in the day, bounded by the 10-hour rest reset from
 * the prior day's last ticket) and AFTER (later in the day, bounded by
 * the 14-hour shift cap from the earliest operator start). Size-based
 * window steering is GONE — every pour, regardless of yardage,
 * targets the same window. */
const PREFERRED_WINDOW_START_MIN = 5 * 60
const PREFERRED_WINDOW_END_MIN = 12 * 60
/* Anchor used as a within-window tiebreaker. Slots closer to the
 * middle of the preferred window beat slots near the edges — packs
 * the day naturally without pulling pours to the absolute earliest
 * or latest minute of the window. */
const SHIFT_ANCHOR_MIN = Math.floor((PREFERRED_WINDOW_START_MIN + PREFERRED_WINDOW_END_MIN) / 2)
const distanceFromShiftAnchor = (startMin) => Math.abs(startMin - SHIFT_ANCHOR_MIN)
/* DOT 14-hour driver shift cap — clock-in to back-at-yard. Mirrored from
 * PlanScheduleUtility so this util stays self-contained. Suggestions whose
 * projected back-at-yard would push the plant's earliest operator past
 * this many minutes are filtered out. */
export const SHIFT_LIMIT_MIN = 14 * 60
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
 *  plant day. The ONLY hard floor is the 10-hour operator-rest reset
 *  (yesterday's last ticket + 10h). When no rest data is loaded, we
 *  allow the scan from 00:00 — the 14-hour shift cap downstream still
 *  enforces a sane upper bound, and refusing to scan pre-04:30 here was
 *  the reason 03:00 slots were never being considered as recommendations.
 *  If the dispatcher's operator can't make a 03:00 start, they don't
 *  book it; that's their judgment, not the recommender's. */
const computeScanFloor = (_orders, restFloorMin, _request) => {
    const restFloor = Number.isFinite(restFloorMin) ? restFloorMin : null
    const baseFloor = restFloor != null ? restFloor : ALTERNATE_SCAN_START_MIN
    return roundUpToScanGranularity(Math.max(ALTERNATE_SCAN_START_MIN, baseFloor))
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

/** True when `startMin` falls in the canonical preferred booking window
 *  — same window for every pour, regardless of yardage. The recommender
 *  fills this window first; slots outside it still scan and rank, just
 *  behind every preferred-window candidate. The `yardage` parameter is
 *  retained for callsite-stability only; size no longer influences the
 *  decision. */
const isPreferredStartWindow = (_yardage, startMin) =>
    startMin >= PREFERRED_WINDOW_START_MIN && startMin < PREFERRED_WINDOW_END_MIN

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

/* Trucks assigned to a pour are committed for the FULL pour duration —
 * from first load-out to last back-at-yard. The earlier "lock-window"
 * shortcut (only `trucksNeeded × spacing + cycle` minutes) was wrong
 * for any multi-rotation pour: those 14 trucks don't return to the
 * pool between rotations, they keep cycling on the pour. Treating the
 * commitment as just the launch cluster caused the recommender to miss
 * overlaps with existing same-plant pours that start later in the day
 * — picking 04:30 over 01:30 even though 04:30 piles onto every
 * existing 07:30–10:00 order at the same plant. */
const truckDemandWindowMin = (request) => request.durationMin

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
    const demandWindowMin = truckDemandWindowMin(request)
    const scanFloor = computeScanFloor(orders, restFloorMin, request)

    /* Loop bound is start-only ("no booking starts after 13:00"). The
     * 14-hour shift cap independently rejects starts whose projected
     * back-at-yard would push operators over their legal window. */
    const allWindows = []
    for (let start = scanFloor; start < ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        if (Math.abs(start - requestStart) < ALTERNATE_MIN_GAP_MIN) continue
        const end = start + demandWindowMin
        if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), scanFloor)) continue
        /* Per-plant launch cap — even with truck pool to spare, a plant
         * can't physically load a 4th truck at the same minute. */
        if (countOrdersAtSameStart(orders, start) >= MAX_CONCURRENT_LAUNCHES_PER_PLANT) continue
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
     *   3. closest to the 06:00 shift anchor — pushes big pours toward
     *      the END of the graveyard window (05:30, not 00:00) and small
     *      pours toward the START of business hours (06:00, not 13:00).
     *   4. earliest start as an absolute last tiebreaker. */
    const sortKey = (a, b) => {
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
        if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
        const aDist = distanceFromShiftAnchor(a.startMin)
        const bDist = distanceFromShiftAnchor(b.startMin)
        if (aDist !== bDist) return aDist - bDist
        return a.startMin - b.startMin
    }
    const fitting = allWindows.filter((w) => w.fits).sort(sortKey)

    if (fitting.length > 0) {
        /* Spread the surfaced slots across the day instead of returning
         * three windows that sit within an hour of each other. Greedy
         * walk through the preference-sorted list and reject any slot
         * that's within DIVERSE_SPREAD_MIN of an already-picked slot —
         * that way the dispatcher gets a morning / mid-day / late-day
         * trio when the schedule allows it, and only falls back to a
         * tighter cluster when nothing else fits. */
        const DIVERSE_SPREAD_MIN = 120
        const picked = []
        for (const w of fitting) {
            if (picked.length >= count) break
            const tooClose = picked.some((p) => Math.abs(p.startMin - w.startMin) < DIVERSE_SPREAD_MIN)
            if (!tooClose) picked.push(w)
        }
        // If the spread filter left us short (e.g. the day only has one
        // pocket of fitting time), backfill from the same preference-
        // sorted list so we still hit `count` when possible.
        if (picked.length < count) {
            for (const w of fitting) {
                if (picked.length >= count) break
                if (!picked.includes(w)) picked.push(w)
            }
        }
        return picked.sort((a, b) => a.startMin - b.startMin)
    }

    // Fallback: closest-possible windows. Smallest shortfall first, then
    // the standard preference / cluster / earliest cascade.
    return [...allWindows]
        .filter((w) => w.free > 0)
        .sort((a, b) => a.shortBy - b.shortBy || sortKey(a, b))
        .slice(0, count)
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
    const demandWindowMin = truckDemandWindowMin(request)
    const scanFloor = computeScanFloor(orders, restFloorMin, request)

    /** Build a candidate evaluation for an arbitrary start minute. Same
     *  shape as the grid-scan candidates so the typed-time check below
     *  can return a candidate that wasn't on the 30-minute scan grid.
     *  `fits` only flips true when the plant has both the truck pool
     *  AND a free launch slot — at most three orders may share a start
     *  minute regardless of how much truck headroom exists. */
    const evaluateAt = (start) => {
        if (!Number.isFinite(start)) return null
        if (start < scanFloor) return null
        if (start >= ALTERNATE_SCAN_END_MIN) return null
        if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), scanFloor)) return null
        const end = start + demandWindowMin
        const sameSlotCount = countOrdersAtSameStart(orders, start)
        const launchSlotFull = sameSlotCount >= MAX_CONCURRENT_LAUNCHES_PER_PLANT
        const busy = computeConcurrentTrucks(orders, start, end)
        const free = Math.max(0, adjustedPool - busy)
        return {
            fits: !launchSlotFull && free >= trucksNeeded,
            launchSlotFull,
            free,
            isolationMin: computeIsolationMin(start, end, orders),
            preferred: isPreferredStartWindow(request.yardage, start),
            shortBy: Math.max(0, trucksNeeded - free),
            startMin: start
        }
    }

    /* Loop bound is start-only ("no booking starts after 13:00"). The
     * 14-hour shift cap inside `evaluateAt` independently rejects
     * starts whose projected back-at-yard would push operators over
     * their legal window. */
    const candidates = []
    for (let start = scanFloor; start < ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        const c = evaluateAt(start)
        if (c) candidates.push(c)
    }
    if (candidates.length === 0) return null

    /* Honor the dispatcher's typed time when it's a complete fit AND
     * the day's existing activity is already adjacent to it. The sort
     * cascade below would otherwise pick the earliest of several tied
     * slots — but pure earliest is wrong in two opposite ways:
     *   • For non-big pours, picking 06:00 over a typed 07:00 expands
     *     the shift envelope for nothing (existing fix).
     *   • For big pours, a 01:00 start that ends 4h before the day's
     *     first existing pour leaves a giant idle gap — picking 05:00
     *     instead would have trucks back at 07:00 just as the day
     *     starts (this fix).
     * Threshold for "materially tighter" is 60 min: another preferred
     * fitting slot must shave at least an hour off the chosen slot's
     * idle gap before we override the dispatcher's choice. */
    const TIGHTER_GAP_THRESHOLD_MIN = 60
    const typedFit = evaluateAt(request.startMin) ?? candidates.find((c) => c.startMin === request.startMin)
    let chosen = null
    if (typedFit && typedFit.fits && typedFit.preferred) {
        const typedIsolation = Number.isFinite(typedFit.isolationMin) ? typedFit.isolationMin : Infinity
        const tighterCandidate = candidates.find(
            (c) =>
                c.fits &&
                c.preferred &&
                c.startMin !== typedFit.startMin &&
                Number.isFinite(c.isolationMin) &&
                c.isolationMin < typedIsolation - TIGHTER_GAP_THRESHOLD_MIN
        )
        if (!tighterCandidate) chosen = typedFit
    }

    if (!chosen) {
        candidates.sort((a, b) => {
            if (a.fits !== b.fits) return a.fits ? -1 : 1
            if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
            if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
            /* Prefer the typed time among isolation ties so the
             * dispatcher's choice wins when nothing else is tighter. */
            if (a.startMin === request.startMin) return -1
            if (b.startMin === request.startMin) return 1
            const aDist = distanceFromShiftAnchor(a.startMin)
            const bDist = distanceFromShiftAnchor(b.startMin)
            if (aDist !== bDist) return aDist - bDist
            return a.startMin - b.startMin
        })
        chosen = candidates[0]
    }

    /* Tighter-pack hint — when the chosen slot starts BEFORE the day's
     * existing first-load-out, the new pour expands the shift envelope
     * (operators clock in earlier than they otherwise would). If the
     * existing first-load-out time would also fit cleanly + sit inside
     * the size-appropriate window, surface it as a non-binding
     * suggestion so the dispatcher can choose to pack tighter without
     * the system overriding their typed time. */
    let existingFirstLoadOut = null
    for (const order of orders || []) {
        if (!order || isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (!Number.isFinite(startMin)) continue
        if (existingFirstLoadOut == null || startMin < existingFirstLoadOut) existingFirstLoadOut = startMin
    }
    let tighterAlternative = null
    if (Number.isFinite(existingFirstLoadOut) && chosen.startMin < existingFirstLoadOut) {
        const altCandidate = evaluateAt(existingFirstLoadOut)
        if (altCandidate && altCandidate.fits && altCandidate.preferred) {
            tighterAlternative = altCandidate
        }
    }

    return tighterAlternative ? { ...chosen, tighterAlternative } : chosen
}

/** Other plants that could lend trucks to `excludePlantCode` during the
 *  request window. A plant qualifies only when its plant-to-plant drive
 *  time from the short plant is KNOWN and ≤ `MAX_HELP_TRAVEL_MIN_FROM_PLANT`
 *  — we intentionally exclude plants whose distance hasn't streamed in
 *  yet so an unmeasured but far-off plant can't outrank a closer (but
 *  still-resolving) one. The list appears as measurements arrive and
 *  stabilises closest-first. Sorted by drive time from the short plant;
 *  ties break on plant-to-job distance, then on free-truck count. */
export const findHelpAvailability = ({
    excludePlantCode,
    mixerCountsByPlant,
    planDate,
    plants,
    plantProduction,
    request,
    travelMinByPlantCode,
    travelMinFromShortPlantByPlantCode
}) => {
    if (!Array.isArray(plants) || !request) return []
    const requestStart = request.startMin
    const requestEnd = request.startMin + request.durationMin
    const result = []
    for (const plant of plants) {
        const plantCode = plant?.plantCode || plant?.plant_code
        if (!plantCode || plantCode === excludePlantCode) continue
        const travelMinFromShortPlant = travelMinFromShortPlantByPlantCode?.[plantCode]
        /* Strict gate: only plants with a MEASURED drive time within
         * the cap qualify. Unmeasured plants are deferred until OSRM
         * resolves rather than padded into the rank with unknown
         * distance — otherwise a far-away plant whose distance has
         * resolved displaces closer plants still in flight. */
        if (!Number.isFinite(travelMinFromShortPlant) || travelMinFromShortPlant > MAX_HELP_TRAVEL_MIN_FROM_PLANT) {
            continue
        }
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
            travelMinFromJob: Number.isFinite(travelMin) ? travelMin : null,
            travelMinFromShortPlant
        })
    }
    /* Primary sort: drive time from the SHORT plant — the plant the
     * truck has to be ferried to. Plant-to-job distance and free-truck
     * count break ties. */
    result.sort((a, b) => {
        if (a.travelMinFromShortPlant !== b.travelMinFromShortPlant) {
            return a.travelMinFromShortPlant - b.travelMinFromShortPlant
        }
        const aFromJob = a.travelMinFromJob ?? Number.POSITIVE_INFINITY
        const bFromJob = b.travelMinFromJob ?? Number.POSITIVE_INFINITY
        if (aFromJob !== bFromJob) return aFromJob - bFromJob
        return b.free - a.free
    })
    /* Return up to 20 candidates so the display layer can walk far enough
     * down the list to fully cover large shortages. The UI already trims
     * to "required lenders to close the gap + 1 backup", so over-returning
     * is harmless — but a hard cut at 4 silently dropped closer plants
     * behind the cap whenever the shortage spanned more lenders than
     * that. */
    return result.slice(0, 20)
}

/** Bundles the "closest plant is short" diagnosis: how many trucks short,
 *  alternate times on the same plant, overlapping orders that could be
 *  re-scheduled, and nearby plants that have spare trucks they could lend
 *  for the request window. Returns null when the top plant can cover the
 *  request as-is. */
/** Earliest-day-wins fallback that returns ONLY slots where the
 *  pour is fully coverable AT THAT SPECIFIC SLOT — either the plant's
 *  own pool covers it, or own pool + nearby help available AT THAT
 *  TIME covers it. Help availability is computed per-slot (not a
 *  typed-time approximation), so a slot at 03:00 correctly sees the
 *  help that's free at 03:00 — not whoever happened to be idle at
 *  the dispatcher's typed time.
 *
 *  Walks the requested day first, then upcoming days in chronological
 *  order, and returns the FIRST day with a coverable slot. Within
 *  that day: clean-fit > fits-with-help, then size-window preference,
 *  then proximity to the 06:00 shift anchor.
 *
 *  Returns `{ dateStr, isSameDay, fitsCleanly, slot: { startMin, free,
 *  helpFree } }` or null when no day in range has a coverable slot. */
export const findBestEffortSlot = ({
    adjacentProduction,
    maxDays = 10,
    mixerCountsByPlant,
    plants,
    plant,
    planDate,
    plantProduction,
    request,
    restFloorMin,
    travelMinFromShortPlantByPlantCode
}) => {
    if (!plant || !request) return null
    const shortPlantCode = plant?.plantCode || plant?.plant_code
    if (!shortPlantCode) return null
    const { trucksNeeded } = request
    if (!trucksNeeded || trucksNeeded <= 0) return null

    /* Lenders that COULD help, regardless of which day. The per-day
     * scan still filters down to whoever is actually free at each
     * candidate slot. */
    const eligibleLenders = []
    for (const lender of plants || []) {
        const lenderCode = lender?.plantCode || lender?.plant_code
        if (!lenderCode || lenderCode === shortPlantCode) continue
        const distFromShort = travelMinFromShortPlantByPlantCode?.[lenderCode]
        if (!Number.isFinite(distFromShort) || distFromShort > MAX_HELP_TRAVEL_MIN_FROM_PLANT) continue
        eligibleLenders.push(lenderCode)
    }

    const demandWindowMin = truckDemandWindowMin(request)

    const pickBestSlotForDay = (dayDateStr, dayProduction, _dayRestFloorMin) => {
        const orders = dayProduction?.[shortPlantCode]?.orders || []
        const adjustedPool = adjustPoolForDate(mixerCountsByPlant?.[shortPlantCode] || 0, dayDateStr)
        if (adjustedPool <= 0) return null
        /* Best-effort intentionally ignores the operator-rest floor and
         * scans the full 00:00–13:00 range. The typed-time recommendation
         * path already accepts pre-rest-floor times (typing 04:30
         * directly with help available produces a clean recommendation),
         * so the alternate scan should be equally permissive — otherwise
         * the recommender misses the exact slots the dispatcher could
         * book by hand. The 14-hour shift cap downstream still rejects
         * starts that would push operators past their legal window. */
        const scanFloor = computeScanFloor(orders, undefined, request)
        /* Shift-cap anchor: the earliest REAL clock-in on the day. When
         * the day already has existing pours, that's the existing
         * first-load-out (since those operators are already on the
         * clock). Without existing pours, the anchor falls back to the
         * candidate slot's own start — each operator's 14-hour clock
         * starts when their pour does. Using scanFloor=00:00 as the
         * anchor was the bug: it forced every late-day slot to be
         * measured from midnight, rejecting 07:00 starts (whose pour
         * ends at 18:14) because 18:14 − 00:00 > 14h. */
        let existingFirstLoadOut = null
        for (const order of orders) {
            if (!order || isExcludedOrder(order)) continue
            const orderStart = timeToMinutes(order?.startTime)
            if (!Number.isFinite(orderStart)) continue
            if (existingFirstLoadOut == null || orderStart < existingFirstLoadOut) {
                existingFirstLoadOut = orderStart
            }
        }
        const candidates = []
        /* Loop bound is start-only ("no booking starts after 13:00").
         * The 14-hour shift cap rejects starts whose projected
         * back-at-yard would push operators over their legal window. */
        for (let start = scanFloor; start < ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
            const end = start + demandWindowMin
            const shiftAnchor = Number.isFinite(existingFirstLoadOut) ? existingFirstLoadOut : start
            if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), shiftAnchor)) continue
            if (countOrdersAtSameStart(orders, start) >= MAX_CONCURRENT_LAUNCHES_PER_PLANT) continue

            const ownBusy = computeConcurrentTrucks(orders, start, end)
            const ownFree = Math.max(0, adjustedPool - ownBusy)

            /* Sum of lender free trucks during this candidate's window.
             * Matches the math `findHelpAvailability` uses for the
             * help chips, so the headline ("X trucks of nearby help")
             * and bestEffort's coverage decision agree. The earlier
             * "implicit borrow" subtraction (existingBorrow = ownBusy
             * − pool) was over-conservative: it assumed the short
             * plant's entire overflow was already being lent by THIS
             * exact set of eligible lenders, which routinely zeroed
             * out helpFree even when the dispatcher could clearly see
             * free trucks at nearby plants. Cross-plant lending isn't
             * tracked in dispatch data, so any subtraction here is a
             * guess — and erring toward "show the dispatcher what's
             * visibly free" is more useful than hiding it. */
            let helpFree = 0
            for (const lenderCode of eligibleLenders) {
                const lenderOrders = dayProduction?.[lenderCode]?.orders || []
                const lenderPool = adjustPoolForDate(mixerCountsByPlant?.[lenderCode] || 0, dayDateStr)
                if (lenderPool <= 0) continue
                const lenderBusy = computeConcurrentTrucks(lenderOrders, start, end)
                helpFree += Math.max(0, lenderPool - lenderBusy)
            }
            const totalAvailable = ownFree + helpFree

            /* "Preferred" only when the ENTIRE pour fits inside the
             * 05:00–12:00 window — start in window AND end in window.
             * For a long pour (e.g., 11h) every start makes the pour
             * exit the window, so no slot is preferred and the
             * preferred-window sort key collapses, freeing the
             * earlier-start tiebreaker below to fire. The old
             * `isPreferredStartWindow(yardage, startMin)` check looked
             * only at the start, which incorrectly tagged a 07:00 start
             * of an 11-hour pour as "preferred" even though it ran to
             * 17:49 — way past business hours. */
            const pourFullyInPreferredWindow = start >= PREFERRED_WINDOW_START_MIN && end <= PREFERRED_WINDOW_END_MIN

            /* Partial-coverage slots stay in the candidate list — pushing
             * the dispatcher five days out because today can't FULLY
             * cover is worse than telling them today's best option +
             * how many trucks they'll still need to scrounge. The
             * sort below prefers covered candidates first; partials
             * surface only when no slot on the day covers. */
            candidates.push({
                covered: totalAvailable >= trucksNeeded,
                fitsCleanly: ownFree >= trucksNeeded,
                free: ownFree,
                helpFree,
                isolationMin: computeIsolationMin(start, end, orders),
                networkShortBy: Math.max(0, trucksNeeded - totalAvailable),
                preferred: pourFullyInPreferredWindow,
                shortBy: Math.max(0, trucksNeeded - ownFree),
                startMin: start,
                totalAvailable
            })
        }

        if (candidates.length === 0) return null
        /* When no candidate fits entirely inside the preferred window
         * (long pours), the preferred-window sort key collapses and
         * we fall back to "earliest start" — minimises how far into
         * business hours the pour extends, which is what dispatchers
         * mean when they say "just start it early and get it done."
         * When some slots ARE fully preferred (short pours), the
         * typed-time bias takes over so a dispatcher's deliberate
         * 06:00 choice isn't jumped to 05:00 on a tiebreaker. */
        const anyFullyPreferred = candidates.some((c) => c.preferred)
        candidates.sort((a, b) => {
            /* Covered slots always beat partial — but a partial same-day
             * slot still beats falling through to future days, which is
             * why partials stay in the list at all. */
            if (a.covered !== b.covered) return a.covered ? -1 : 1
            if (a.fitsCleanly !== b.fitsCleanly) return a.fitsCleanly ? -1 : 1
            /* Less help needed = less peak strain on the network — the
             * scenario-1 fix that kept 01:30 winning over 04:30. */
            if (a.shortBy !== b.shortBy) return a.shortBy - b.shortBy
            if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
            /* Pack tight against existing pours — a 00:00 start that
             * ends 101 min before the next existing pour loses to a
             * 01:30 start that ends 11 min before it. Isolation = 0
             * when the candidate overlaps an existing pour. */
            if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
            if (!anyFullyPreferred) {
                /* Long pour — no slot fits in the preferred window.
                 * Earliest start = earliest end = less of the pour
                 * spent inside business hours, which is the metric
                 * dispatchers care about when a pour can't avoid
                 * overlap with the morning cluster. */
                if (a.startMin !== b.startMin) return a.startMin - b.startMin
            } else {
                /* Short pour — the preferred window has slots in it.
                 * Honor the dispatcher's typed time among otherwise-
                 * equivalent candidates rather than jumping it to a
                 * neighboring minute on a tiebreaker. */
                if (a.startMin === request.startMin && b.startMin !== request.startMin) return -1
                if (b.startMin === request.startMin && a.startMin !== request.startMin) return 1
            }
            const aAnchor = distanceFromShiftAnchor(a.startMin)
            const bAnchor = distanceFromShiftAnchor(b.startMin)
            if (aAnchor !== bAnchor) return aAnchor - bAnchor
            return a.startMin - b.startMin
        })
        return candidates[0]
    }

    /* Same-day always wins when it has ANY slot that passes the hard
     * constraints (shift cap, launch cap, non-zero pool). Even a
     * partial-coverage same-day slot is more useful than pushing the
     * dispatcher to a date five days out — they can manually scrounge
     * a few extra trucks for a same-day pour, but they can't postpone
     * the customer without a real conversation. */
    const sameDay = pickBestSlotForDay(planDate, plantProduction, restFloorMin)
    if (sameDay) {
        return {
            covered: sameDay.covered,
            dateStr: planDate,
            fitsCleanly: sameDay.fitsCleanly,
            isSameDay: true,
            slot: sameDay
        }
    }

    /* Same-day is genuinely unworkable (Sunday → pool 0, or every slot
     * fails the shift / launch caps). Walk upcoming days and surface
     * the soonest one that can host a slot at all. */
    const dates = Object.keys(adjacentProduction || {}).sort()
    let scanned = 0
    for (const dateStr of dates) {
        if (scanned >= maxDays) break
        scanned += 1
        const prod = adjacentProduction[dateStr]
        if (!prod || typeof prod !== 'object') continue
        const futureDay = pickBestSlotForDay(dateStr, prod, undefined)
        if (futureDay) {
            return {
                covered: futureDay.covered,
                dateStr,
                fitsCleanly: futureDay.fitsCleanly,
                isSameDay: false,
                slot: futureDay
            }
        }
    }

    return null
}

export const computeBookingConflict = ({
    adjacentProduction,
    mixerCountsByPlant,
    planDate,
    plants,
    plantProduction,
    ranked,
    request,
    restFloorByPlant,
    travelMinByPlantCode,
    travelMinFromShortPlantByPlantCode
}) => {
    const top = ranked?.[0]
    if (!top || !request) return null
    if (top.free >= top.trucksNeeded) return null
    const plant = (plants || []).find((p) => (p?.plantCode || p?.plant_code) === top.plantCode)
    if (!plant) return null
    const restFloorMin = restFloorByPlant?.[top.plantCode]
    const alternateTimes = findAlternateStartTimes({
        mixerCountsByPlant,
        planDate,
        plant,
        plantProduction,
        request,
        restFloorMin
    })
    /* No size-based window steering — `findAlternateStartTimes` already
     * ranks preferred-window slots ahead of outside-window slots, so
     * the cascade's `shift` case naturally surfaces the right answer
     * when the typed time is outside the window and an in-window slot
     * fits. No separate "shift to graveyard" path is needed. */
    const effectiveStartMin = request.startMin
    const effectiveRequest = request
    const effectiveShortBy = top.trucksNeeded - top.free
    const helpAvailability = findHelpAvailability({
        excludePlantCode: top.plantCode,
        mixerCountsByPlant,
        planDate,
        plantProduction,
        plants,
        request: effectiveRequest,
        travelMinByPlantCode,
        travelMinFromShortPlantByPlantCode
    })
    const helpFleetTotal = helpAvailability.reduce((sum, h) => sum + (h?.free || 0), 0)
    /* ALWAYS compute the best-effort answer. The cascade in the panel
     * prefers simpler paths (typed-time help covers / same-day clean
     * fit) over best-effort when those exist — but we never gate
     * best-effort behind their absence, because per-slot help
     * availability is what catches the "04:30 has 11 trucks of help
     * but 07:00 has 1" case the simpler paths miss. */
    const bestEffortSlot = findBestEffortSlot({
        adjacentProduction,
        mixerCountsByPlant,
        planDate,
        plant,
        plantProduction,
        plants,
        request: effectiveRequest,
        restFloorMin,
        travelMinFromShortPlantByPlantCode
    })
    return {
        alternateTimes,
        bestEffortSlot,
        effectiveStartMin,
        helpAvailability,
        helpFleetTotal,
        /* `launchSlotFull` propagates from `scorePlantForBooking` so the
         * panel can lead with "too many simultaneous launches" instead
         * of the misleading "1 truck short" framing when the real
         * problem is the per-plant launch cap. */
        launchSlotFull: !!top.launchSlotFull,
        plantCode: top.plantCode,
        plantName: top.plantName,
        sameSlotCount: top.sameSlotCount ?? 0,
        shortBy: effectiveShortBy
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
export const buildBookingRequest = ({ address, pourMethod, spacingMin, startTime, yardage }) => {
    const yards = parseFloat(yardage)
    const startMin = timeToMinutes(startTime)
    if (!yards || yards <= 0) return null
    if (!Number.isFinite(startMin)) return null
    if (!address || !String(address).trim()) return null
    /* Pour-method profile (optional) — when present, its `tailMin`
     * extends the per-truck on-site time and its `spacingMin` provides
     * a sensible default when the dispatcher hasn't typed a spacing.
     * The dispatcher's typed spacing always wins so they can override
     * the profile's default for unusual pour conditions. */
    const methodTimings = getPourMethodTimings(pourMethod)
    const typedSpacing = parseFloat(spacingMin)
    const spacing = Number.isFinite(typedSpacing) && typedSpacing > 0 ? typedSpacing : methodTimings?.spacingMin
    const tailMin = methodTimings?.tailMin
    const requiresSpacing = yards > DEFAULT_LOAD_SIZE_YARDS
    if (requiresSpacing && !(Number.isFinite(spacing) && spacing > 0)) return null
    const trucksNeeded = estimateRequiredTrucks({ spacingMin: spacing, tailMin, yardage: yards })
    const durationMin = estimatePourDurationMinutes({ spacingMin: spacing, tailMin, yardage: yards })
    /* Operators can't run more than 14 hours from first load-out to back-
     * at-yard. If the pour as configured would exceed that even with a
     * dawn start, it can't fit ANY shift today — flag it so the form
     * surfaces the warning and the recommender skips ranking. The
     * dispatcher fixes it by tightening spacing or shrinking yardage. */
    const projectedShiftMin = durationMin + DEFAULT_TRAVEL_OUT_MIN
    const exceedsShiftLimit = projectedShiftMin > SHIFT_LIMIT_MIN
    return {
        address: String(address).trim(),
        durationMin,
        exceedsShiftLimit,
        pourMethod: pourMethod || null,
        projectedShiftMin,
        spacingMin: Number.isFinite(spacing) && spacing > 0 ? spacing : DEFAULT_TRUCK_SPACING_MIN,
        startMin,
        tailMin: Number.isFinite(tailMin) ? tailMin : null,
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
