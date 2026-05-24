import { buildAssignmentDriverTimes, PRE_TRIP_MINUTES } from '../../../../utils/PlanUtility'

/** Classify each leg of an assignment's day at the given minute. The
 *  outbound and return legs are tracked separately so the renderer can
 *  show the outbound polyline as "in transit" green while the return
 *  polyline reads as "idle" orange (and vice-versa during the back leg).
 *
 *  Returns `{ outbound, returning }`, each one of:
 *   - 'transit'  — at least one driver is on that leg right now
 *   - 'at-dest'  — drivers have completed that leg's arrival and are
 *                   between legs (only the outbound leg uses this)
 *   - 'inactive' — nobody is on this leg at the moment
 */
export function classifyAssignmentActivity(
    assignment,
    atMinute,
    travelMinutes,
    { directLoadHoldMin = null, returnStaggerMin = null, returnTravelMinutes = null } = {}
) {
    if (!Number.isFinite(atMinute)) return { outbound: 'inactive', returning: 'inactive' }
    const drivers = buildAssignmentDriverTimes(assignment)
    if (drivers.length === 0) return { outbound: 'inactive', returning: 'inactive' }
    const travel = Number.isFinite(travelMinutes) ? travelMinutes : 30
    const returnTravel = Number.isFinite(returnTravelMinutes) ? returnTravelMinutes : travel
    let outboundInTransit = false
    let outboundAtDest = false
    let returningInTransit = false
    for (const driver of drivers) {
        if (!Number.isFinite(driver.arriveMin)) continue
        const transitStart = Math.max(0, driver.arriveMin - travel - PRE_TRIP_MINUTES)
        const transitEnd = driver.arriveMin
        /* Direct-load assignments turn back to the return plant
         * after a fixed hold at the job, NOT at `driver.leaveMin`
         * (that field is the leave time at a destination plant in
         * the non-direct help flow). For direct-load we anchor the
         * return-leg window on `arriveMin + DIRECT_LOAD_HOLD_MINUTES`
         * and use the job→return travel time rather than the
         * symmetric plant→plant one. */
        const usingDirectLoad = Number.isFinite(directLoadHoldMin)
        const baseLeave = usingDirectLoad
            ? driver.arriveMin + directLoadHoldMin
            : Number.isFinite(driver.leaveMin)
              ? driver.leaveMin
              : null
        /* Match the same visual stagger applied to the per-driver
         * chevrons in `driverLegFraction`. Without this, the
         * polyline's `transit` window only covers the single
         * shared `leaveMin` window — when the LAST driver in the
         * staggered crew is still on the road, the polyline would
         * already have switched back to `inactive`, dimming the
         * route even though trucks are visibly on it. */
        const staggerOffset =
            !usingDirectLoad && Number.isFinite(returnStaggerMin) ? (driver.driverIndex || 0) * returnStaggerMin : 0
        const leaveMin = baseLeave != null ? baseLeave + staggerOffset : null
        const returnArrival = leaveMin != null ? leaveMin + returnTravel : null
        if (atMinute >= transitStart && atMinute < transitEnd) {
            outboundInTransit = true
            continue
        }
        if (leaveMin != null && atMinute >= leaveMin && returnArrival != null && atMinute < returnArrival) {
            returningInTransit = true
            continue
        }
        if (leaveMin != null && atMinute >= transitEnd && atMinute < leaveMin) {
            outboundAtDest = true
        } else if (leaveMin == null && atMinute >= transitEnd) {
            outboundAtDest = true
        }
    }
    return {
        outbound: outboundInTransit ? 'transit' : outboundAtDest ? 'at-dest' : 'inactive',
        returning: returningInTransit ? 'transit' : 'inactive'
    }
}
