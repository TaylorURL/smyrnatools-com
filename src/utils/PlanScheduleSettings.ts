// Plan Schedule — configurable runtime settings hydrated from `plan_settings`.

/** Driver shift cap per DOT regulations — operators can't be on the clock
 *  longer than this from first load-out to back-at-yard. Hydrated from
 *  `plan_settings.dot_shift_cap_hours` at startup; the `let` keeps the
 *  ESM live binding so consumers see the latest value without code
 *  changes at the call site. */
export let HOURS_LIMIT_MINUTES = 14 * 60
/** Slump / QC test minutes the truck waits at the plant before leaving for
 *  the job. The user-configured value used by the limit calculator. */
export const HOURS_LIMIT_SLUMP_MINUTES = 15
/** On-site pour duration assumed by the limit calculator when an order's own
 *  pour-time estimate isn't available. */
export const HOURS_LIMIT_POUR_MINUTES = 60

/** Maximum plausible one-way travel duration (minutes) between a plant and
 *  a job site. Ready-mix concrete sets in ~90 min from water contact, so
 *  no realistic delivery ever exceeds this; anything bigger is dispatch
 *  data shaped as a clock time instead of an HH:MM duration (e.g.
 *  `toJobTime: "18:20"` parsing as 1100 min). Treating that as a real
 *  18-hour drive produced an absurd 44.6h badge on the Schedule tab.
 *  Hydrated from `plan_settings.max_travel_minutes`. */
export let MAX_TRAVEL_MINUTES = 180

/**
 * Hydrate the two configurable schedule constants from a `plan_settings`
 * row. Called from the central plan-settings hydrator. Missing /
 * non-finite values leave the current value untouched. `dot_shift_cap_hours`
 * arrives in hours; we multiply to minutes here so the call site stays
 * unchanged.
 *
 * @param {{ dot_shift_cap_hours?: number|string|null, max_travel_minutes?: number|string|null } | null | undefined} snapshot
 */
export function hydratePlanScheduleSettings(snapshot) {
    if (!snapshot) return
    const capRaw = snapshot.dot_shift_cap_hours
    const capHours = typeof capRaw === 'number' ? capRaw : parseFloat(String(capRaw ?? ''))
    if (Number.isFinite(capHours)) HOURS_LIMIT_MINUTES = capHours * 60
    const travelRaw = snapshot.max_travel_minutes
    const travel = typeof travelRaw === 'number' ? travelRaw : parseFloat(String(travelRaw ?? ''))
    if (Number.isFinite(travel)) MAX_TRAVEL_MINUTES = travel
}

/** Discards parsed travel values that exceed the realistic ceiling. Returns
 *  null on any non-finite or out-of-range input so callers can fall back to
 *  the other leg or skip the calculation entirely. */
export const sanitizeTravelMinutes = (min) => {
    if (!Number.isFinite(min)) return null
    if (min < 0 || min > MAX_TRAVEL_MINUTES) return null
    return min
}
