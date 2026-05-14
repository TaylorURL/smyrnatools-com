import {
    ALTERNATE_MIN_GAP_MIN,
    ALTERNATE_SCAN_END_MIN,
    ALTERNATE_SCAN_STEP_MIN,
    DIVERSE_SPREAD_MIN,
    MAX_CONCURRENT_LAUNCHES_PER_PLANT,
    TIGHTER_GAP_THRESHOLD_MIN
} from '../../app/constants/bookOrderConstants'
import { adjustPoolForDate, isExcludedOrder, timeToMinutes } from '../PlanUtility'
import { computeConcurrentTrucks, countOrdersAtSameStart } from './bookOrderMath'
import {
    computeIsolationMin,
    computeScanFloor,
    distanceFromShiftAnchor,
    isPreferredStartWindow,
    projectedBackAtYardMin,
    respectsShiftLimit,
    truckDemandWindowMin
} from './bookOrderSlotHelpers'

/** Sort cascade shared by the alternate-time scan: preferred window first,
 *  then tightest cluster, then closest to the shift anchor, then earliest. */
function sortAlternateWindows(a, b) {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
    if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
    const aDist = distanceFromShiftAnchor(a.startMin)
    const bDist = distanceFromShiftAnchor(b.startMin)
    if (aDist !== bDist) return aDist - bDist
    return a.startMin - b.startMin
}

/** Best start times where the SAME plant could host the request. Each row
 *  carries `{ startMin, free, fits, shortBy }` so the UI can clearly mark
 *  windows that fully fit (no help / no rescheduling) versus windows that
 *  are merely "closest" (still short by N trucks). When at least one
 *  fitting slot exists we surface only fitting slots; otherwise we fall
 *  back to the highest-free windows. */
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

    const allWindows = []
    for (let start = scanFloor; start < ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        if (Math.abs(start - requestStart) < ALTERNATE_MIN_GAP_MIN) continue
        const end = start + demandWindowMin
        if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), scanFloor)) continue
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

    const fitting = allWindows.filter((w) => w.fits).sort(sortAlternateWindows)

    if (fitting.length > 0) {
        /* Spread the surfaced slots across the day instead of returning
         * three windows that sit within an hour of each other. Greedy
         * walk through the preference-sorted list and reject any slot
         * that's within DIVERSE_SPREAD_MIN of an already-picked slot —
         * dispatchers get a morning / mid-day / late-day trio when the
         * schedule allows it. */
        const picked = []
        for (const w of fitting) {
            if (picked.length >= count) break
            const tooClose = picked.some((p) => Math.abs(p.startMin - w.startMin) < DIVERSE_SPREAD_MIN)
            if (!tooClose) picked.push(w)
        }
        // Backfill from the same preference-sorted list when the spread
        // filter left us short (e.g. the day only has one fitting pocket).
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
        .sort((a, b) => a.shortBy - b.shortBy || sortAlternateWindows(a, b))
        .slice(0, count)
}

/** Locate the day's existing earliest first-load-out (if any) so the
 *  tighter-pack hint can compare against it. */
function findExistingFirstLoadOut(orders) {
    let earliest = null
    for (const order of orders || []) {
        if (!order || isExcludedOrder(order)) continue
        const startMin = timeToMinutes(order?.startTime)
        if (!Number.isFinite(startMin)) continue
        if (earliest == null || startMin < earliest) earliest = startMin
    }
    return earliest
}

/** Single best start time on a plant for the given request. Considers the
 *  full 00:00–13:00 scan window and prioritises:
 *    1. windows where the request fully fits (no help / no rescheduling)
 *    2. size-appropriate preferred window (graveyard for big pours,
 *       mid-morning for small)
 *    3. cluster adjacency — minimises idle gaps next to existing pours
 *    4. earliest start as a final tiebreaker
 *
 *  Used to detect when the dispatcher's typed time is suboptimal even
 *  without a truck shortage. */
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

    /** Build a candidate evaluation for an arbitrary start minute. */
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
            free,
            isolationMin: computeIsolationMin(start, end, orders),
            launchSlotFull,
            preferred: isPreferredStartWindow(request.yardage, start),
            shortBy: Math.max(0, trucksNeeded - free),
            startMin: start
        }
    }

    const candidates = []
    for (let start = scanFloor; start < ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        const c = evaluateAt(start)
        if (c) candidates.push(c)
    }
    if (candidates.length === 0) return null

    /* Honor the dispatcher's typed time when it's a complete fit AND
     * the day's existing activity is already adjacent to it. Override only
     * when another preferred fitting slot shaves at least an hour off the
     * chosen slot's idle gap. */
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
            // Prefer the typed time among isolation ties so the
            // dispatcher's choice wins when nothing else is tighter.
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
     * existing first-load-out, the new pour expands the shift envelope.
     * If the existing first-load-out time would also fit cleanly + sit
     * inside the size-appropriate window, surface it as a non-binding
     * suggestion. */
    const existingFirstLoadOut = findExistingFirstLoadOut(orders)
    let tighterAlternative = null
    if (Number.isFinite(existingFirstLoadOut) && chosen.startMin < existingFirstLoadOut) {
        const altCandidate = evaluateAt(existingFirstLoadOut)
        if (altCandidate && altCandidate.fits && altCandidate.preferred) {
            tighterAlternative = altCandidate
        }
    }

    return tighterAlternative ? { ...chosen, tighterAlternative } : chosen
}
