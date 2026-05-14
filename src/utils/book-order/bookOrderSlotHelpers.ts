import {
    ALTERNATE_SCAN_START_MIN,
    ALTERNATE_SCAN_STEP_MIN,
    DEFAULT_TRAVEL_OUT_MIN,
    PREFERRED_WINDOW_END_MIN,
    PREFERRED_WINDOW_START_MIN,
    SHIFT_ANCHOR_MIN,
    SHIFT_LIMIT_MIN
} from '../../app/constants/bookOrderConstants'
import { isExcludedOrder } from '../PlanUtility'
import { orderTimeWindow } from './bookOrderMath'

/** Distance from a candidate start to the canonical shift-anchor minute. */
export const distanceFromShiftAnchor = (startMin) => Math.abs(startMin - SHIFT_ANCHOR_MIN)

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
 *  enforces a sane upper bound. */
export const computeScanFloor = (_orders, restFloorMin, _request) => {
    const restFloor = Number.isFinite(restFloorMin) ? restFloorMin : null
    const baseFloor = restFloor != null ? restFloor : ALTERNATE_SCAN_START_MIN
    return roundUpToScanGranularity(Math.max(ALTERNATE_SCAN_START_MIN, baseFloor))
}

/** Approximate back-at-yard minute for a candidate window — the supplied
 *  `baseDurationMin` covers load + slump + travel-out + pour, so we tack
 *  on one default travel leg for the trip home. Conservative on requests
 *  whose `durationMin` already includes a return-cycle term, which biases
 *  us toward filtering aggressively rather than under-counting hours. */
export const projectedBackAtYardMin = (startMin, baseDurationMin) => startMin + baseDurationMin + DEFAULT_TRAVEL_OUT_MIN

/** True when a candidate slot doesn't push any operator past the 14-hour
 *  shift cap. The clock-in anchor is whichever's earlier: the existing
 *  first-load-out or the candidate's own start — moving a pour earlier
 *  effectively becomes the day's new clock-in. */
export const respectsShiftLimit = (startMin, projectedEndMin, scanFloorMin) => {
    const anchor = Math.min(scanFloorMin, startMin)
    return projectedEndMin - anchor <= SHIFT_LIMIT_MIN
}

/** True when `startMin` falls in the canonical preferred booking window
 *  — same window for every pour, regardless of yardage. */
export const isPreferredStartWindow = (_yardage, startMin) =>
    startMin >= PREFERRED_WINDOW_START_MIN && startMin < PREFERRED_WINDOW_END_MIN

/** Minutes between a candidate window and the nearest existing pour. Used to
 *  penalize alternates that strand trucks in multi-hour idle gaps. Returns
 *  0 when the candidate overlaps an existing order, and Infinity when the
 *  day has no real orders to anchor against. */
export const computeIsolationMin = (candidateStart, candidateEnd, orders) => {
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
 * from first load-out to last back-at-yard. */
export const truckDemandWindowMin = (request) => request.durationMin
