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
/* Booking-side definition of "big pour" — distinct from the scheduling /
 * statistics threshold in PlanUtility because the booking recommender
 * applies a stricter rule: anything ≥ this many yards belongs in the
 * 00:00–06:00 graveyard window so it doesn't tie up the day's pool while
 * smaller orders run through business hours. */
const BIG_POUR_BOOKING_THRESHOLD_YD = 150
const BIG_POUR_PREFERRED_START_MIN = 0
const BIG_POUR_PREFERRED_END_MIN = 6 * 60
/* Small / medium pours run cleanest after the graveyard pours wrap up
 * but well before the day's last back-at-yard cutoff. 06:00 picks up
 * right where the graveyard window ends; 14:00 leaves enough runway for
 * a 5-yd, 1-truck pour to finish before the 14h shift cap kicks in even
 * on a 04:30 first-load-out anchor. */
const SMALL_POUR_PREFERRED_START_MIN = 6 * 60
const SMALL_POUR_PREFERRED_END_MIN = 14 * 60
/* Earliest minute the scan considers when neither yesterday's tickets nor
 * today's existing orders give us an anchor. 04:30 is roughly the absolute
 * earliest Smyrna plants ever dispatch — and gives operators 10 hours of
 * rest off a prior shift ending at 18:30. */
const DEFAULT_EARLIEST_DISPATCH_MIN = 4 * 60 + 30
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
 *  plant day. Prefers the rest-derived floor (yesterday's actual ticket
 *  times → projected back-at-yard + 10h rest) when available. Falls back
 *  to the existing first-load-out so we don't push pours earlier than
 *  what's already booked, then to a hardcoded earliest-dispatch when the
 *  plant has no anchor at all. Always rounded up to the half-hour so
 *  every scan slot lands on :00 / :30. */
/** Earliest non-excluded start minute among the given orders. Used to
 *  detect "the day's first existing pour" so the scan doesn't suggest
 *  slots hours before any existing activity (which expands the shift
 *  envelope for no operational benefit). */
const computeFirstLoadOutMinute = (orders) => {
    let earliest = null
    for (const order of orders || []) {
        if (!order || isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (!Number.isFinite(startMin)) continue
        if (earliest == null || startMin < earliest) earliest = startMin
    }
    return earliest
}

const computeScanFloor = (orders, restFloorMin, request) => {
    const firstLoadOut = computeFirstLoadOutMinute(orders)
    /* Big pours are explicitly meant for the 00:00–06:00 graveyard
     * window, so suggesting a graveyard slot for them is correct even
     * when the existing first-load-out is later. For everything else
     * (small / medium pours) we anchor to whichever's LATER of:
     *   • the operator-rest floor (yesterday's tickets + 10h), and
     *   • today's existing first-load-out
     * because a 4 a.m. start when the day's first pour isn't until 7
     * a.m. is a 3-hour shift extension for no real benefit. */
    const wantsGraveyard = request && isBigBookingPour(request.yardage)
    const restFloor = Number.isFinite(restFloorMin) ? restFloorMin : null
    let baseFloor
    if (wantsGraveyard) {
        baseFloor = restFloor != null ? restFloor : (firstLoadOut ?? DEFAULT_EARLIEST_DISPATCH_MIN)
    } else if (restFloor != null && Number.isFinite(firstLoadOut)) {
        baseFloor = Math.max(restFloor, firstLoadOut)
    } else if (restFloor != null) {
        baseFloor = restFloor
    } else if (Number.isFinite(firstLoadOut)) {
        baseFloor = firstLoadOut
    } else {
        baseFloor = DEFAULT_EARLIEST_DISPATCH_MIN
    }
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

/** True when `yardage` qualifies as a "big pour" for booking purposes —
 *  uses the booking-specific threshold (150 yd) rather than the global
 *  scheduling threshold so dispatch's "should this be in graveyard"
 *  rule can diverge from the analytics labeling. */
const isBigBookingPour = (yardage) => Number(yardage) >= BIG_POUR_BOOKING_THRESHOLD_YD

/** True when `startMin` falls in the size-appropriate sweet-spot window:
 *  big pours (≥150 yd) belong in 00:00–06:00 so they don't choke business
 *  hours; smaller pours land cleanly in 06:00–14:00. */
const isPreferredStartWindow = (yardage, startMin) => {
    if (isBigBookingPour(yardage)) {
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
    const scanFloor = computeScanFloor(orders, restFloorMin, request)

    const allWindows = []
    for (let start = scanFloor; start + lockWindowMin <= ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        if (Math.abs(start - requestStart) < ALTERNATE_MIN_GAP_MIN) continue
        const end = start + lockWindowMin
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
     *   3. earliest start, as a final tiebreaker. */
    const sortKey = (a, b) => {
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
        if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
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

/**
 * Cross-day fallback for the "always show 3 viable options" rule. Walks
 * each upcoming day's plant production (typically the next 2–4
 * non-Sunday days) and asks the same `findAlternateStartTimes` scanner
 * for fitting slots on the supplied plant. Returns the per-day clusters
 * — `[{ dateStr, slots }]` — sorted by date ascending, capped at
 * `maxDays` entries so the UI doesn't drown in suggestions.
 *
 * Adjacent-day rest floors are not threaded through (we'd need to fetch
 * each prior day's tickets separately), so the only floor in play here
 * is the schedule-derived one. That's intentional — a multi-day-ahead
 * suggestion is informational; the dispatcher will re-run the full
 * recommender on the chosen day before booking.
 */
export const findCrossDaySuggestions = ({ adjacentProduction, maxDays = 2, mixerCountsByPlant, plant, request }) => {
    if (!plant || !request || !adjacentProduction) return []
    const out = []
    const dates = Object.keys(adjacentProduction).sort()
    for (const dateStr of dates) {
        const prod = adjacentProduction[dateStr]
        if (!prod || typeof prod !== 'object') continue
        const slots = findAlternateStartTimes({
            count: 3,
            mixerCountsByPlant,
            planDate: dateStr,
            plant,
            plantProduction: prod,
            request
        })
        const fitting = slots.filter((s) => s.fits).slice(0, 3)
        if (fitting.length === 0) continue
        out.push({ dateStr, slots: fitting })
        if (out.length >= maxDays) break
    }
    return out
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
        const moveScanFloor = computeScanFloor(otherOrders, restFloorMin, request)
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
            /* Reject move targets that would push a launch slot past
             * the per-plant cap. The new pour's launch is treated as
             * "occupying" its requested start minute — moving the
             * candidate INTO that minute counts toward the cap. */
            const sameSlotAtTarget = countOrdersAtSameStart(otherOrders, start) + (start === requestStart ? 1 : 0)
            if (sameSlotAtTarget >= MAX_CONCURRENT_LAUNCHES_PER_PLANT) continue
            const otherBusy = computeConcurrentTrucks(otherOrders, start, end)
            const requestOverlapsHere = start < requestEnd && end > requestStart
            const requestBusy = requestOverlapsHere ? request.trucksNeeded : 0
            const totalBusy = otherBusy + requestBusy
            if (adjustedPool - totalBusy < candidate.trucks) continue
            /* Direction relative to the new pour: 'after' means the move
             * lands cleanly past the new pour's tail (push the small order
             * back); 'before' means it lands ahead of the new pour's lead
             * (pull the small order up); 'overlap' would mean it still
             * collides — filtered out by the truck-fit check above when
             * the math doesn't work, so this entry exists mostly for
             * sorting clarity. */
            const direction = start >= requestEnd ? 'after' : end <= requestStart ? 'before' : 'overlap'
            out.push({
                direction,
                free: adjustedPool - totalBusy,
                isolationMin: computeIsolationMin(start, end, otherOrders),
                preferred: isPreferredStartWindow(candidateYardage, start),
                proximityMin: Math.abs(start - candidate.window.startMin),
                startMin: start
            })
        }
        /* Strongly prefer pushing the moved order BACK (after the new
         * pour ends) over pulling it UP (before the new pour starts).
         * Dispatchers mentally "push small jobs back" once a big anchor
         * pour locks the morning; suggesting "move ZEN from 09:00 to
         * 05:30" assumes operators can clock in earlier than they were
         * already scheduled to, which usually conflicts with the rest
         * window and feels wrong. Only fall back to "before" moves when
         * no "after" slot fits at all. */
        const afterMoves = out.filter((o) => o.direction === 'after')
        const ranked = afterMoves.length > 0 ? afterMoves : out
        return ranked
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
    const scanFloor = computeScanFloor(orders, restFloorMin, request)

    /** Build a candidate evaluation for an arbitrary start minute. Same
     *  shape as the grid-scan candidates so the typed-time check below
     *  can return a candidate that wasn't on the 30-minute scan grid.
     *  `fits` only flips true when the plant has both the truck pool
     *  AND a free launch slot — at most three orders may share a start
     *  minute regardless of how much truck headroom exists. */
    const evaluateAt = (start) => {
        if (!Number.isFinite(start)) return null
        const end = start + lockWindowMin
        if (start < scanFloor) return null
        if (end > ALTERNATE_SCAN_END_MIN) return null
        if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), scanFloor)) return null
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

    const candidates = []
    for (let start = scanFloor; start + lockWindowMin <= ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
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
 *  request window. "Help" in dispatch parlance means a plant sends one or
 *  more trucks to another plant for a pour. We list every plant with at
 *  least one free truck during the window AND within
 *  `MAX_HELP_TRAVEL_MIN_FROM_PLANT` driving minutes of the short plant —
 *  anything further isn't a realistic lender. Sorted by drive time from
 *  the job address (proxy for proximity to the pour site). Plants whose
 *  plant-to-plant distance hasn't streamed in yet are kept so the list
 *  doesn't briefly collapse to empty while OSRM resolves; once a known
 *  distance exceeds the cap they're dropped. Returns empty when no plant
 *  qualifies, so the UI can render a "no help available" notice. */
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
        if (Number.isFinite(travelMinFromShortPlant) && travelMinFromShortPlant > MAX_HELP_TRAVEL_MIN_FROM_PLANT) {
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
            travelMinFromShortPlant: Number.isFinite(travelMinFromShortPlant) ? travelMinFromShortPlant : null
        })
    }
    /* Primary sort: drive time from the SHORT plant — the plant the
     * truck has to be ferried to. That's the realistic dispatch cost.
     * Plants without a known plant-to-plant time fall back to the
     * plant-to-job distance, then to free-truck count. */
    result.sort((a, b) => {
        const aFromPlant = a.travelMinFromShortPlant ?? Number.POSITIVE_INFINITY
        const bFromPlant = b.travelMinFromShortPlant ?? Number.POSITIVE_INFINITY
        if (aFromPlant !== bFromPlant) return aFromPlant - bFromPlant
        const aFromJob = a.travelMinFromJob ?? Number.POSITIVE_INFINITY
        const bFromJob = b.travelMinFromJob ?? Number.POSITIVE_INFINITY
        if (aFromJob !== bFromJob) return aFromJob - bFromJob
        return b.free - a.free
    })
    return result.slice(0, 4)
}

/** Scans candidate start times on the SHORT plant looking for a slot
 *  where the short plant's own free trucks plus help available from
 *  lender plants within `MAX_HELP_TRAVEL_MIN_FROM_PLANT` minutes
 *  together cover the full truck requirement. Surfaces these when help
 *  at the originally-typed time can't close the gap, so the recommender
 *  can point at a time that DOES work instead of just saying "no help
 *  available". Same sort cascade as `findAlternateStartTimes`: preferred
 *  size-window first, proximity to the typed time, then earliest. */
export const findHelpCoverableSlots = ({
    count = 3,
    mixerCountsByPlant,
    planDate,
    plant,
    plantProduction,
    plants,
    request,
    restFloorMin,
    travelMinFromShortPlantByPlantCode
}) => {
    if (!plant || !request || !Array.isArray(plants)) return []
    const shortPlantCode = plant?.plantCode || plant?.plant_code
    if (!shortPlantCode) return []
    const orders = plantProduction?.[shortPlantCode]?.orders || []
    const adjustedPool = adjustPoolForDate(mixerCountsByPlant?.[shortPlantCode] || 0, planDate)
    if (adjustedPool <= 0) return []
    const { startMin: requestStart, trucksNeeded } = request
    if (trucksNeeded <= 0) return []

    /* Pre-filter the lender pool once — every candidate slot draws from
     * the same plants. A lender qualifies when its plant-to-plant drive
     * time from the short plant is known and ≤ the 1-hour cap. */
    const eligibleLenders = []
    for (const lender of plants) {
        const lenderCode = lender?.plantCode || lender?.plant_code
        if (!lenderCode || lenderCode === shortPlantCode) continue
        const distFromShort = travelMinFromShortPlantByPlantCode?.[lenderCode]
        if (!Number.isFinite(distFromShort) || distFromShort > MAX_HELP_TRAVEL_MIN_FROM_PLANT) continue
        eligibleLenders.push(lenderCode)
    }
    if (eligibleLenders.length === 0) return []

    const lockWindowMin = computeLockWindowMin(request)
    const scanFloor = computeScanFloor(orders, restFloorMin, request)

    const candidates = []
    for (let start = scanFloor; start + lockWindowMin <= ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        if (Math.abs(start - requestStart) < ALTERNATE_MIN_GAP_MIN) continue
        const end = start + lockWindowMin
        if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), scanFloor)) continue
        if (countOrdersAtSameStart(orders, start) >= MAX_CONCURRENT_LAUNCHES_PER_PLANT) continue

        const ownBusy = computeConcurrentTrucks(orders, start, end)
        const ownFree = Math.max(0, adjustedPool - ownBusy)

        let helpFree = 0
        let helpPlantCount = 0
        for (const lenderCode of eligibleLenders) {
            const lenderOrders = plantProduction?.[lenderCode]?.orders || []
            const lenderPool = adjustPoolForDate(mixerCountsByPlant?.[lenderCode] || 0, planDate)
            if (lenderPool <= 0) continue
            const lenderBusy = computeConcurrentTrucks(lenderOrders, start, end)
            const lenderFree = Math.max(0, lenderPool - lenderBusy)
            if (lenderFree > 0) helpPlantCount++
            helpFree += lenderFree
        }

        const totalFree = ownFree + helpFree
        if (totalFree < trucksNeeded) continue

        candidates.push({
            helpFree,
            helpPlantCount,
            isolationMin: computeIsolationMin(start, end, orders),
            ownFree,
            preferred: isPreferredStartWindow(request.yardage, start),
            shortBy: Math.max(0, trucksNeeded - ownFree),
            startMin: start,
            totalFree
        })
    }

    if (candidates.length === 0) return []

    candidates.sort((a, b) => {
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
        const aDist = Math.abs(a.startMin - requestStart)
        const bDist = Math.abs(b.startMin - requestStart)
        if (aDist !== bDist) return aDist - bDist
        return a.startMin - b.startMin
    })

    /* Spread the surfaced slots so we don't dump three candidates that
     * all sit inside the same hour — same diverse-pick walk as
     * `findAlternateStartTimes` uses. */
    const DIVERSE_SPREAD_MIN = 120
    const picked = []
    for (const candidate of candidates) {
        if (picked.length >= count) break
        const tooClose = picked.some((p) => Math.abs(p.startMin - candidate.startMin) < DIVERSE_SPREAD_MIN)
        if (!tooClose) picked.push(candidate)
    }
    if (picked.length < count) {
        for (const candidate of candidates) {
            if (picked.length >= count) break
            if (!picked.includes(candidate)) picked.push(candidate)
        }
    }
    return picked.sort((a, b) => a.startMin - b.startMin)
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
    /* "Wrong window for this size" hint — fires when the dispatcher
     * typed a start time outside the size-appropriate sweet-spot. The
     * conflict panel uses this to lead with "shift to graveyard" before
     * the help / reschedule advice when applicable, especially for big
     * pours (≥ 150 yd) that should always be in the 00:00–06:00 window. */
    const requestInPreferredWindow = isPreferredStartWindow(request.yardage, request.startMin)
    const sizeWindowAdvice = !requestInPreferredWindow
        ? {
              isBigPour: isBigBookingPour(request.yardage),
              preferredWindowLabel: isBigBookingPour(request.yardage) ? '00:00–06:00' : '06:00–14:00',
              suggestedSlot: alternateTimes.find((s) => isPreferredStartWindow(request.yardage, s.startMin)) || null
          }
        : null
    /* Pivot to the SHIFT TARGET's perspective when a size-window shift
     * is recommended. Help availability, shortBy, and the schedule
     * preview should all reflect the time the dispatcher is actually
     * being told to book — not the typed time they're being told to
     * abandon. Without this pivot the panel says "shift to 04:00, you
     * still need 2 trucks" while showing 9 free trucks at 07:00, and the
     * preview row stays at 07:00. */
    const effectiveStartMin = sizeWindowAdvice?.suggestedSlot?.startMin ?? request.startMin
    const effectiveRequest =
        effectiveStartMin === request.startMin ? request : { ...request, startMin: effectiveStartMin }
    const effectiveShortBy = sizeWindowAdvice?.suggestedSlot
        ? (sizeWindowAdvice.suggestedSlot.shortBy ?? 0)
        : top.trucksNeeded - top.free
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
    /* When in-the-hour help can't cover the shortage at the requested
     * time, scan for slots where it CAN — gives the dispatcher a
     * "shift to this time and pull help" path instead of a dead end. */
    const helpFleetTotal = helpAvailability.reduce((sum, h) => sum + (h?.free || 0), 0)
    const helpCoversAtRequestedTime = helpFleetTotal >= effectiveShortBy
    const helpCoverableSlots = helpCoversAtRequestedTime
        ? []
        : findHelpCoverableSlots({
              mixerCountsByPlant,
              plant,
              planDate,
              plantProduction,
              plants,
              request: effectiveRequest,
              restFloorMin,
              travelMinFromShortPlantByPlantCode
          })
    return {
        alternateTimes,
        effectiveStartMin,
        helpAvailability,
        helpCoverableSlots,
        /* `launchSlotFull` propagates from `scorePlantForBooking` so the
         * panel can lead with "too many simultaneous launches" instead
         * of the misleading "1 truck short" framing when the real
         * problem is the per-plant launch cap. */
        launchSlotFull: !!top.launchSlotFull,
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
        sameSlotCount: top.sameSlotCount ?? 0,
        shortBy: effectiveShortBy,
        sizeWindowAdvice
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
