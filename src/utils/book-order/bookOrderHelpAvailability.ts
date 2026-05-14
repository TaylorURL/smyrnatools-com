import { MAX_HELP_TRAVEL_MIN_FROM_PLANT } from '../../app/constants/bookOrderConstants'
import { adjustPoolForDate } from '../PlanUtility'
import { computeConcurrentTrucks } from './bookOrderMath'

/** Other plants that could lend trucks to `excludePlantCode` during the
 *  request window. A plant qualifies only when its plant-to-plant drive
 *  time from the short plant is KNOWN and ≤ `MAX_HELP_TRAVEL_MIN_FROM_PLANT`
 *  — we intentionally exclude plants whose distance hasn't streamed in
 *  yet so an unmeasured but far-off plant can't outrank a closer (but
 *  still-resolving) one. */
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
     * is harmless. */
    return result.slice(0, 20)
}
