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

/** True when the plan date falls on a Saturday — the day the half-fleet
 *  rule (and the Saturday-override field on the side menu) apply. */
export const isSaturday = (planDate) => getPoolDayMultiplier(planDate) === 0.5

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

/** Saturday operator-count override. The half-fleet rule is a sensible
 *  default, but real Saturdays often have more or fewer operators than
 *  exactly half. When this override is set on a Saturday, the value is
 *  used as the WORKING base (no halving, no missing-operator subtraction
 *  — the dispatcher already accounted for sick / vacation by typing the
 *  real number). Returns null when no override is stored for this plant
 *  so the caller can fall back to `adjustPoolForDate`. */
export const getSaturdayOverride = (plantProduction, plantCode) => {
    const raw = plantProduction?.[PLAN_META_KEY]?.saturdayOverrideByPlant?.[plantCode]
    if (raw == null || raw === '') return null
    const value = parseInt(raw, 10)
    return Number.isFinite(value) && value >= 0 ? value : null
}

/** Persist the Saturday operator-count override for a plant. Passing
 *  null / undefined / empty string clears the override so the default
 *  half-fleet rule applies again. */
export const setSaturdayOverride = (setPlantProduction, plantCode, count) => {
    if (typeof setPlantProduction !== 'function' || !plantCode) return
    const cleared = count == null || count === ''
    const parsed = cleared ? null : Math.max(0, parseInt(count, 10) || 0)
    setPlantProduction((prev) => {
        const next = { ...(prev || {}) }
        const meta = { ...(next[PLAN_META_KEY] || {}) }
        const overrides = { ...(meta.saturdayOverrideByPlant || {}) }
        if (parsed == null) {
            delete overrides[plantCode]
        } else {
            overrides[plantCode] = parsed
        }
        meta.saturdayOverrideByPlant = overrides
        next[PLAN_META_KEY] = meta
        return next
    })
}

/** Day-adjusted base operator count — the working fleet size before
 *  missing-operator subtraction. Honours the Saturday override when set
 *  on Saturdays; otherwise applies the standard day-of-week multiplier.
 *  Used as the canonical starting point for both pool math and the
 *  side-panel / pin headcount displays so every surface reads the same
 *  number for a given plant + date. */
export const getDayAdjustedBase = (rawBase, plantCode, plantProduction, planDate) => {
    if (isSaturday(planDate)) {
        const override = getSaturdayOverride(plantProduction, plantCode)
        if (override != null) return Math.max(0, override)
    }
    return adjustPoolForDate(rawBase, planDate)
}

/** Compute the effective base pool for a plant on a given plan date.
 *  Saturday with an override returns the override unchanged — that
 *  number IS the working count, so we deliberately skip the missing-
 *  operator subtraction. Every other case applies the day multiplier
 *  and subtracts any operators the dispatcher has marked missing.
 *  Clamps at 0 so an over-aggressive shortfall never drives the pool
 *  negative before the simulation even runs. */
export const getEffectiveBase = (rawBase, plantCode, plantProduction, planDate) => {
    if (isSaturday(planDate) && getSaturdayOverride(plantProduction, plantCode) != null) {
        return getDayAdjustedBase(rawBase, plantCode, plantProduction, planDate)
    }
    const adjusted = getDayAdjustedBase(rawBase, plantCode, plantProduction, planDate)
    const missing = getMissingOperators(plantProduction, plantCode)
    return Math.max(0, adjusted - missing)
}
