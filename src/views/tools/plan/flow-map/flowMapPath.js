import { PRE_TRIP_MINUTES } from '../../../../utils/PlanUtility'

/** Sample a polyline at the given path fraction (0 → 1). Returns the
 *  interpolated point plus the bearing of the segment it lands on as a
 *  CSS rotation so a downstream `▶` glyph points along the route. Falls
 *  back to null for empty / degenerate paths. */
export function pointAlongPath(coords, fraction) {
    if (!Array.isArray(coords) || coords.length < 2) return null
    const lens = []
    let total = 0
    for (let i = 1; i < coords.length; i++) {
        const dlat = coords[i][0] - coords[i - 1][0]
        const dlng = coords[i][1] - coords[i - 1][1]
        const len = Math.hypot(dlng, dlat)
        lens.push(len)
        total += len
    }
    if (total <= 0) return null
    const clamped = Math.max(0, Math.min(1, fraction))
    const target = total * clamped
    let acc = 0
    for (let i = 0; i < lens.length; i++) {
        if (acc + lens[i] >= target) {
            const t = lens[i] === 0 ? 0 : (target - acc) / lens[i]
            const lat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t
            const lng = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t
            const dlat = coords[i + 1][0] - coords[i][0]
            const dlng = coords[i + 1][1] - coords[i][1]
            // Bearing (deg, 0 = north, clockwise) → CSS rotation
            // (deg, 0 = pointing right) is bearing − 90.
            const bearing = (Math.atan2(dlng, dlat) * 180) / Math.PI
            return { angleDeg: bearing - 90, lat, lng }
        }
        acc += lens[i]
    }
    return null
}

/** Per-driver progress fraction (0 → 1) along the named leg's transit
 *  window. Returns null when this specific driver isn't currently on the
 *  road for this leg — staggered crews share a polyline, but each driver
 *  occupies their own fraction of it at any given minute.
 *
 *  `directLoadHoldMin` overrides the return-leg start timing. In the
 *  non-direct flow the driver "leaves" the destination plant at
 *  `driver.leaveMin`; in the direct-load flow they pour out at the job
 *  site `DIRECT_LOAD_HOLD_MINUTES` after arrival and turn directly to
 *  their return plant from there — `leaveMin` doesn't apply because the
 *  destination plant was never their endpoint. */
export function driverLegFraction({ directLoadHoldMin, driver, leg, returnStaggerMin, travel, viewTime }) {
    if (!driver || !Number.isFinite(viewTime)) return null
    if (!Number.isFinite(driver.arriveMin)) return null
    let startMin
    let endMin
    if (leg === 'outbound') {
        startMin = Math.max(0, driver.arriveMin - travel - PRE_TRIP_MINUTES)
        endMin = driver.arriveMin
    } else if (Number.isFinite(directLoadHoldMin)) {
        startMin = driver.arriveMin + directLoadHoldMin
        endMin = startMin + travel
    } else {
        const leave = Number.isFinite(driver.leaveMin) && driver.leaveMin > driver.arriveMin ? driver.leaveMin : null
        if (leave == null) return null
        /* Visual stagger for the return-leg chevrons. In stagger mode
         * the assignment carries a SINGLE `leaveTime` field that
         * applies to every driver, so without an offset every chevron
         * ends up at the identical fraction of the return polyline and
         * the crew renders as ONE visible truck. We back-stagger by the
         * driver's index × the assignment's `staggerMinutes` so the
         * convoy reads as the same number of trucks heading home as
         * went out. Direct-load case is handled above (arriveMin is
         * already staggered, so the hold window stagger is natural). */
        const offset = Number.isFinite(returnStaggerMin) ? (driver.driverIndex || 0) * returnStaggerMin : 0
        startMin = leave + offset
        endMin = startMin + travel
    }
    if (endMin <= startMin) return null
    if (viewTime < startMin || viewTime >= endMin) return null
    return Math.max(0, Math.min(1, (viewTime - startMin) / (endMin - startMin)))
}

/** Anchor for a single driver on one leg — returns the position + bearing
 *  to render their arrow, or null when they aren't on that leg right now.
 *  Used to render one ▶ marker per truck so a staggered crew of N reads
 *  as N arrows walking the route at different fractions, not one
 *  average-of-the-pack arrow. */
export function resolveDriverLegAnchor({ coords, directLoadHoldMin, driver, leg, returnStaggerMin, travel, viewTime }) {
    if (!coords || coords.length < 2) return null
    const fraction = driverLegFraction({ directLoadHoldMin, driver, leg, returnStaggerMin, travel, viewTime })
    if (fraction == null) return null
    return pointAlongPath(coords, fraction)
}
