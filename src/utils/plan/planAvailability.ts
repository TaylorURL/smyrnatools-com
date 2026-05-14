import { PLAN_META_KEY } from '../../app/constants/planConstants'
import { getDayOfWeekForDate } from './planTime'

/**
 * Weekend availability rules:
 *   - Sunday  → plants are closed. Pool = 0.
 *   - Saturday → half crew on. Base mixer count is halved (rounded down so
 *     the plan stays conservative).
 *   - All other days → full base.
 */
export const getPoolDayMultiplier = (planDate) => {
    if (!planDate) return 1
    const dow = getDayOfWeekForDate(planDate)
    if (dow == null) return 1
    if (dow === 0) return 0
    if (dow === 6) return 0.5
    return 1
}

/** True when the plan date falls on a Sunday (plants closed). */
export const isClosedDay = (planDate) => getPoolDayMultiplier(planDate) === 0

/** Apply the day-of-week multiplier to a base mixer count. Rounds down so
 *  we never overestimate on Saturdays. */
export const adjustPoolForDate = (base, planDate) => {
    const multiplier = getPoolDayMultiplier(planDate)
    if (multiplier >= 1) return Number.isFinite(base) ? base : 0
    if (multiplier <= 0) return 0
    return Math.floor((Number.isFinite(base) ? base : 0) * multiplier)
}

/** Count of operators the dispatcher has marked as missing at this plant
 *  (sick, vacation, etc.). Subtracted from the base pool in every truck
 *  calculation so the schedule reflects actual availability. */
export const getMissingOperators = (plantProduction, plantCode) => {
    const raw = plantProduction?.[PLAN_META_KEY]?.missingByPlant?.[plantCode]
    const value = parseInt(raw, 10)
    return Number.isFinite(value) && value > 0 ? value : 0
}

/** Persist the missing-operator count for a plant. Clamps to 0 so the
 *  caller never needs to guard against negatives. */
export const setMissingOperators = (setPlantProduction, plantCode, count) => {
    if (typeof setPlantProduction !== 'function' || !plantCode) return
    const safe = Math.max(0, parseInt(count, 10) || 0)
    setPlantProduction((prev) => {
        const next = { ...(prev || {}) }
        const meta = { ...(next[PLAN_META_KEY] || {}) }
        const missing = { ...(meta.missingByPlant || {}) }
        if (safe <= 0) {
            delete missing[plantCode]
        } else {
            missing[plantCode] = safe
        }
        meta.missingByPlant = missing
        next[PLAN_META_KEY] = meta
        return next
    })
}

/** Compute the effective base pool for a plant on a given plan date:
 *  weekend-adjusted base, minus any operators the dispatcher has marked
 *  missing. Clamps at 0 so an over-aggressive shortfall never drives the
 *  pool negative before the simulation even runs. */
export const getEffectiveBase = (rawBase, plantCode, plantProduction, planDate) => {
    const adjusted = adjustPoolForDate(rawBase, planDate)
    const missing = getMissingOperators(plantProduction, plantCode)
    return Math.max(0, adjusted - missing)
}
