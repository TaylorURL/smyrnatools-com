import {
    ALTERNATE_SCAN_END_MIN,
    ALTERNATE_SCAN_STEP_MIN,
    MAX_CONCURRENT_LAUNCHES_PER_PLANT,
    MAX_HELP_TRAVEL_MIN_FROM_PLANT,
    PREFERRED_WINDOW_END_MIN,
    PREFERRED_WINDOW_START_MIN
} from '../../app/constants/bookOrderConstants'
import { adjustPoolForDate, isExcludedOrder, timeToMinutes } from '../PlanUtility'
import { computeConcurrentTrucks, countOrdersAtSameStart } from './bookOrderMath'
import {
    computeIsolationMin,
    computeScanFloor,
    distanceFromShiftAnchor,
    projectedBackAtYardMin,
    respectsShiftLimit,
    truckDemandWindowMin
} from './bookOrderSlotHelpers'

/** Lenders that COULD help, regardless of which day. The per-day scan
 *  still filters down to whoever is actually free at each candidate slot. */
function collectEligibleLenders(plants, shortPlantCode, travelMinFromShortPlantByPlantCode) {
    const eligible = []
    for (const lender of plants || []) {
        const lenderCode = lender?.plantCode || lender?.plant_code
        if (!lenderCode || lenderCode === shortPlantCode) continue
        const distFromShort = travelMinFromShortPlantByPlantCode?.[lenderCode]
        if (!Number.isFinite(distFromShort) || distFromShort > MAX_HELP_TRAVEL_MIN_FROM_PLANT) continue
        eligible.push(lenderCode)
    }
    return eligible
}

/** Earliest existing first-load-out on the plant for the day. Used as the
 *  shift-cap anchor so each operator's 14-hour clock is measured from
 *  when they actually start, not midnight. */
function findExistingFirstLoadOut(orders) {
    let earliest = null
    for (const order of orders || []) {
        if (!order || isExcludedOrder(order)) continue
        const orderStart = timeToMinutes(order?.startTime)
        if (!Number.isFinite(orderStart)) continue
        if (earliest == null || orderStart < earliest) earliest = orderStart
    }
    return earliest
}

/** Sum of lender-free trucks during the candidate window across the
 *  pre-filtered eligible lenders. */
function computeHelpFree(eligibleLenders, dayProduction, mixerCountsByPlant, dayDateStr, start, end) {
    let helpFree = 0
    for (const lenderCode of eligibleLenders) {
        const lenderOrders = dayProduction?.[lenderCode]?.orders || []
        const lenderPool = adjustPoolForDate(mixerCountsByPlant?.[lenderCode] || 0, dayDateStr)
        if (lenderPool <= 0) continue
        const lenderBusy = computeConcurrentTrucks(lenderOrders, start, end)
        helpFree += Math.max(0, lenderPool - lenderBusy)
    }
    return helpFree
}

/** Sort cascade for same-day best-effort candidates. Same priority for
 *  every day the recommender scans. */
function buildCandidateSorter(anyFullyPreferred, requestStartMin) {
    return (a, b) => {
        if (a.covered !== b.covered) return a.covered ? -1 : 1
        if (a.fitsCleanly !== b.fitsCleanly) return a.fitsCleanly ? -1 : 1
        if (a.shortBy !== b.shortBy) return a.shortBy - b.shortBy
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
        if (a.isolationMin !== b.isolationMin) return a.isolationMin - b.isolationMin
        if (!anyFullyPreferred) {
            // Long pour — earliest start = earliest end.
            if (a.startMin !== b.startMin) return a.startMin - b.startMin
        } else {
            // Short pour — honor the typed time among otherwise-equal candidates.
            if (a.startMin === requestStartMin && b.startMin !== requestStartMin) return -1
            if (b.startMin === requestStartMin && a.startMin !== requestStartMin) return 1
        }
        const aAnchor = distanceFromShiftAnchor(a.startMin)
        const bAnchor = distanceFromShiftAnchor(b.startMin)
        if (aAnchor !== bAnchor) return aAnchor - bAnchor
        return a.startMin - b.startMin
    }
}

/** Build a single candidate's evaluation. Returns null when the slot
 *  fails a hard constraint (shift cap or launch cap). */
function evaluateCandidate({ start, end, orders, request, trucksNeeded, adjustedPool, helpFree, shiftAnchor }) {
    if (!respectsShiftLimit(start, projectedBackAtYardMin(start, request.durationMin), shiftAnchor)) return null
    if (countOrdersAtSameStart(orders, start) >= MAX_CONCURRENT_LAUNCHES_PER_PLANT) return null

    const ownBusy = computeConcurrentTrucks(orders, start, end)
    const ownFree = Math.max(0, adjustedPool - ownBusy)
    const totalAvailable = ownFree + helpFree

    /* "Preferred" only when the ENTIRE pour fits inside the 05:00–12:00
     * window — start in window AND end in window. For a long pour every
     * start makes the pour exit the window, so no slot is preferred and
     * the preferred-window sort key collapses, freeing the earlier-start
     * tiebreaker. */
    const pourFullyInPreferredWindow = start >= PREFERRED_WINDOW_START_MIN && end <= PREFERRED_WINDOW_END_MIN

    return {
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
    }
}

/** Scan one day for its best slot. Returns null when no slot passes the
 *  hard constraints (shift cap, launch cap, non-zero pool). */
function pickBestSlotForDay(dayDateStr, dayProduction, request, eligibleLenders, mixerCountsByPlant, shortPlantCode) {
    const orders = dayProduction?.[shortPlantCode]?.orders || []
    const adjustedPool = adjustPoolForDate(mixerCountsByPlant?.[shortPlantCode] || 0, dayDateStr)
    if (adjustedPool <= 0) return null
    /* Best-effort intentionally ignores the operator-rest floor and
     * scans the full 00:00–13:00 range. The typed-time recommendation
     * path already accepts pre-rest-floor times. */
    const scanFloor = computeScanFloor(orders, undefined, request)
    const existingFirstLoadOut = findExistingFirstLoadOut(orders)
    const demandWindowMin = truckDemandWindowMin(request)
    const trucksNeeded = request.trucksNeeded

    const candidates = []
    for (let start = scanFloor; start < ALTERNATE_SCAN_END_MIN; start += ALTERNATE_SCAN_STEP_MIN) {
        const end = start + demandWindowMin
        const shiftAnchor = Number.isFinite(existingFirstLoadOut) ? existingFirstLoadOut : start
        const helpFree = computeHelpFree(eligibleLenders, dayProduction, mixerCountsByPlant, dayDateStr, start, end)
        const candidate = evaluateCandidate({
            adjustedPool,
            end,
            helpFree,
            orders,
            request,
            shiftAnchor,
            start,
            trucksNeeded
        })
        if (candidate) candidates.push(candidate)
    }

    if (candidates.length === 0) return null
    const anyFullyPreferred = candidates.some((c) => c.preferred)
    candidates.sort(buildCandidateSorter(anyFullyPreferred, request.startMin))
    return candidates[0]
}

/** Earliest-day-wins fallback that returns ONLY slots where the pour is
 *  fully coverable AT THAT SPECIFIC SLOT — either the plant's own pool
 *  covers it, or own pool + nearby help available AT THAT TIME covers
 *  it. Walks the requested day first, then upcoming days in chronological
 *  order, and returns the FIRST day with a coverable slot. */
export const findBestEffortSlot = ({
    adjacentProduction,
    maxDays = 10,
    mixerCountsByPlant,
    plants,
    plant,
    planDate,
    plantProduction,
    request,
    restFloorMin: _restFloorMin,
    travelMinFromShortPlantByPlantCode
}) => {
    if (!plant || !request) return null
    const shortPlantCode = plant?.plantCode || plant?.plant_code
    if (!shortPlantCode) return null
    const { trucksNeeded } = request
    if (!trucksNeeded || trucksNeeded <= 0) return null

    const eligibleLenders = collectEligibleLenders(plants, shortPlantCode, travelMinFromShortPlantByPlantCode)

    /* Same-day always wins when it has ANY slot that passes the hard
     * constraints. Even a partial-coverage same-day slot is more useful
     * than pushing the dispatcher to a date five days out. */
    const sameDay = pickBestSlotForDay(
        planDate,
        plantProduction,
        request,
        eligibleLenders,
        mixerCountsByPlant,
        shortPlantCode
    )
    if (sameDay) {
        return {
            covered: sameDay.covered,
            dateStr: planDate,
            fitsCleanly: sameDay.fitsCleanly,
            isSameDay: true,
            slot: sameDay
        }
    }

    /* Same-day is genuinely unworkable. Walk upcoming days and surface
     * the soonest one that can host a slot at all. */
    const dates = Object.keys(adjacentProduction || {}).sort()
    let scanned = 0
    for (const dateStr of dates) {
        if (scanned >= maxDays) break
        scanned += 1
        const prod = adjacentProduction[dateStr]
        if (!prod || typeof prod !== 'object') continue
        const futureDay = pickBestSlotForDay(
            dateStr,
            prod,
            request,
            eligibleLenders,
            mixerCountsByPlant,
            shortPlantCode
        )
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
