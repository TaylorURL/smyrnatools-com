import {
    MAX_CONCURRENT_LAUNCHES_PER_PLANT,
    TRAVEL_MIN_HORIZON,
    WEIGHT_CAPACITY,
    WEIGHT_LOAD_BALANCE,
    WEIGHT_PROXIMITY
} from '../../app/constants/bookOrderConstants'
import { adjustPoolForDate } from '../PlanUtility'
import { scoreProximity } from './bookOrderAddressing'
import { computeConcurrentTrucks, countOrdersAtSameStart } from './bookOrderMath'

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)

/** Convert one-way travel minutes → 0..1 proximity score. 0 min ≈ 1.0,
 *  a 60+ min haul collapses to 0. Linear decay. */
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
     * "shift / reschedule / pull help" options. */
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
 *  on trucks. Ties on proximity fall back to the composite score. */
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
         * travel data yet stay in the list — silently hiding them on a
         * transient lookup failure would be worse than showing a slightly-
         * stale row. */
        .filter((row) => !Number.isFinite(row.travelMin) || row.travelMin <= TRAVEL_MIN_HORIZON)
    /* When at least one plant has a real geocoded drive time, drop the
     * plants that don't — a missing `travelMin` usually means the
     * plant's address (or the job's) didn't resolve, and we'd rather
     * recommend nothing for that plant than rank it on a coarse
     * ZIP-prefix heuristic that can pick a 75-mile-away plant over a
     * 35-mile one when both land in the same 3-digit ZIP region. */
    const anyHasTravel = scored.some((row) => Number.isFinite(row.travelMin))
    const trimmed = anyHasTravel ? scored.filter((row) => Number.isFinite(row.travelMin)) : scored
    /* Closest plant wins #1. Sort priority:
     *   1. Plants WITH a real travel-time number rank above those without.
     *   2. Among plants with travel data, smallest minutes first.
     *   3. Among plants without travel data, heuristic proximity then composite. */
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
