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

/** Score one plant for the given booking request. Returns the full
 *  breakdown so the UI can explain WHY a plant ranked where it did. */
export const scorePlantForBooking = ({ plant, plantProduction, mixerCountsByPlant, planDate, request }) => {
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
    const proximityScore = scoreProximity(request.address, plantAddress)
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
        rawPool,
        trucksNeeded
    }
}

/** Rank every plant for the request, best-first. Plants with no usable code
 *  or zero adjusted pool (e.g. closed Sundays) are filtered out. */
export const rankPlantsForBooking = ({ plants, plantProduction, mixerCountsByPlant, planDate, request }) => {
    if (!Array.isArray(plants) || !request) return []
    const scored = plants
        .map((plant) => scorePlantForBooking({ mixerCountsByPlant, plant, planDate, plantProduction, request }))
        .filter((row) => row.plantCode && row.adjustedPool > 0)
    scored.sort((a, b) => b.composite - a.composite)
    return scored
}

/** Build the request shape consumed by the scorer from raw form values.
 *  Returns null when required fields are missing or invalid so the view
 *  can show a friendly "fill the form first" placeholder. */
export const buildBookingRequest = ({ address, startTime, yardage }) => {
    const yards = parseFloat(yardage)
    const startMin = timeToMinutes(startTime)
    if (!yards || yards <= 0) return null
    if (!Number.isFinite(startMin)) return null
    if (!address || !String(address).trim()) return null
    const trucksNeeded = estimateRequiredTrucks({ yardage: yards })
    const durationMin = estimatePourDurationMinutes({ yardage: yards })
    return { address: String(address).trim(), durationMin, startMin, trucksNeeded, yardage: yards }
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
