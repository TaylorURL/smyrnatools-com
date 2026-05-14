import {
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_TRAVEL_OUT_MIN,
    DEFAULT_TRUCK_SPACING_MIN,
    SHIFT_LIMIT_MIN
} from '../../app/constants/bookOrderConstants'
import { timeToMinutes } from '../PlanUtility'
import { findBestEffortSlot } from './bookOrderBestEffort'
import { findHelpAvailability } from './bookOrderHelpAvailability'
import { estimatePourDurationMinutes, estimateRequiredTrucks, getPourMethodTimings } from './bookOrderMath'
import { findAlternateStartTimes } from './bookOrderStartTimes'

/** Bundles the "closest plant is short" diagnosis: how many trucks short,
 *  alternate times on the same plant, overlapping orders that could be
 *  re-scheduled, and nearby plants that have spare trucks they could lend
 *  for the request window. Returns null when the top plant can cover the
 *  request as-is. */
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
 *  `spacingMin` is required to be > 0 only when the pour spans more than
 *  one load (yardage > DEFAULT_LOAD_SIZE_YARDS) — single-truck pours
 *  don't have a spacing decision to make. */
export const buildBookingRequest = ({ address, pourMethod, spacingMin, startTime, yardage }) => {
    const yards = parseFloat(yardage)
    const startMin = timeToMinutes(startTime)
    if (!yards || yards <= 0) return null
    if (!Number.isFinite(startMin)) return null
    if (!address || !String(address).trim()) return null
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
     * surfaces the warning and the recommender skips ranking. */
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
