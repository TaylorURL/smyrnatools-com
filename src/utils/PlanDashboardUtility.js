import { buildHelpTransfers, buildInitialPoolByCode, flattenPlanOrders } from './PlanRuntimeUtility'
import {
    computePlantPoolTimeline,
    computePullUpRows,
    computeSuggestedSlots,
    isExcludedOrder,
    PLAN_META_KEY,
    timeToMinutes
} from './PlanUtility'

/** Sum a plant production block's REAL yardage. Re-derives from each
 *  block's `orders[]` so cancelled (17:00) and test (18:00) sentinels are
 *  excluded from the total — even when the precomputed `totalYardage`
 *  field on the block was built before that filter existed. Falls back to
 *  `totalYardage` only when the orders array isn't present. */
const plantBlockYardage = (block) => {
    if (!block) return 0
    if (Array.isArray(block.orders)) {
        return block.orders.reduce((sum, order) => {
            if (isExcludedOrder(order)) return sum
            return sum + (parseFloat(order?.yardage) || 0)
        }, 0)
    }
    return parseFloat(block.totalYardage) || 0
}

/**
 * Pure helpers for the Plan Dashboard view — meta blob accessors, time
 * arithmetic, and pool-simulation wrappers that the dashboard, dispatch
 * checklist, and over/under cards consume.
 *
 * Daily plan metadata (special + QC attention jobs, formatted-notes cache)
 * is persisted by piggy-backing on the plan's `plant_production` JSONB
 * blob via a reserved `_meta` key. That lets us ship persistence without
 * a DB schema change — every reader/writer goes through these helpers.
 */

export { PLAN_META_KEY }

export const readPlanMeta = (plantProduction) => plantProduction?.[PLAN_META_KEY] || {}

export const writePlanMeta = (setPlantProduction, updater) => {
    setPlantProduction?.((prev) => {
        const next = { ...(prev || {}) }
        const current = next[PLAN_META_KEY] || {}
        const nextMeta = typeof updater === 'function' ? updater(current) : updater
        next[PLAN_META_KEY] = nextMeta
        return next
    })
}

/** Stable enough for in-memory plan metadata. */
const generateLocalId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const createEmptyJob = () => ({
    contractor: '',
    description: '',
    id: generateLocalId(),
    plant: '',
    time: '',
    title: ''
})

/** Subtract `minutes` from an `HH:MM` string. Returns the resulting
 *  `HH:MM` clamped to 00:00, or null if either input can't be parsed. */
export const subtractMinutesFromTime = (time, minutes) => {
    const mins = timeToMinutes(time)
    if (mins === null || !Number.isFinite(minutes)) return null
    const target = Math.max(0, mins - minutes)
    const h = Math.floor(target / 60)
    const m = target % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Friendly delta string (`1h 5m`, `45m`) for pull-up recommendations. */
export const formatPullUpDelta = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
    return `${m}m`
}

/** Common pool-simulation inputs derived once and shared by the
 *  Dashboard's coverage / pull-up / suggested-slot blocks. Returns null
 *  when no orders exist so callers can short-circuit. */
const buildPoolSimulationInputs = ({ plantProduction, stats, assignments, planDate }) => {
    const flatOrders = flattenPlanOrders(plantProduction)
    if (flatOrders.length === 0) return null
    return {
        flatOrders,
        helpTransfers: buildHelpTransfers(assignments),
        initialPoolByCode: buildInitialPoolByCode(stats, plantProduction, planDate)
    }
}

/**
 * Replays the schedule's pool simulation across every order so the
 * dashboard's "needs help vs covered" totals match the per-row Trucks
 * column on the Schedule tab. An order whose effective post-dispatch
 * pool drops below zero is flagged "needs help"; the gap is the truck
 * deficit we surface as the net over/under.
 */
export const computeDashboardJobCoverage = ({ plantProduction, stats, assignments, planDate }) => {
    const inputs = buildPoolSimulationInputs({ assignments, planDate, plantProduction, stats })
    if (!inputs) return null
    const byOrder = computePlantPoolTimeline(inputs.flatOrders, inputs.initialPoolByCode, null, inputs.helpTransfers)
    let totalJobs = 0
    let needHelp = 0
    let deficit = 0
    let surplus = 0
    Object.values(byOrder || {}).forEach((entry) => {
        const eff = entry?.poolAfterDispatchEffective
        if (!Number.isFinite(eff)) return
        totalJobs += 1
        if (eff < 0) {
            needHelp += 1
            deficit += -eff
        } else {
            surplus += eff
        }
    })
    if (totalJobs === 0) return null
    return { covered: totalJobs - needHelp, deficit, needHelp, net: surplus - deficit, surplus, totalJobs }
}

/**
 * Pull-up recommendations — later orders that could be moved into earlier
 * surplus windows so the dispatch day compacts instead of trucks idling.
 * Latest-scheduled customer first so the dashboard list mirrors the
 * recommended outreach sequence (call the last customer first).
 */
export const computeDashboardPullUpRows = ({ plantProduction, stats, assignments, planDate }) => {
    const inputs = buildPoolSimulationInputs({ assignments, planDate, plantProduction, stats })
    if (!inputs) return []
    const rows = computePullUpRows(inputs.flatOrders, inputs.initialPoolByCode, null, inputs.helpTransfers)
    return rows.sort((a, b) => b.originalStartMin - a.originalStartMin)
}

/**
 * Open-window recommendations — idle-truck windows where a plant could
 * absorb a new pour without disrupting today's plan. Mirrors the
 * Schedule tab's suggested-slot rows.
 */
export const computeDashboardSuggestedSlots = ({ plantProduction, stats, assignments, planDate }) => {
    const inputs = buildPoolSimulationInputs({ assignments, planDate, plantProduction, stats })
    if (!inputs) return []
    return computeSuggestedSlots(inputs.flatOrders, inputs.initialPoolByCode, null, inputs.helpTransfers)
}

/** Total yardage planned across every plant on the day, ignoring the
 *  reserved `_meta` key and stripping cancelled/test order rows that the
 *  legacy precomputed `totalYardage` baked in. */
export const sumPlanYardage = (plantProduction) =>
    Object.entries(plantProduction || {})
        .filter(([code]) => code !== PLAN_META_KEY)
        .reduce((sum, [, prod]) => sum + plantBlockYardage(prod), 0)

/** Number of plants that have any planned yardage today. */
export const countPlantsWithYardage = (plantProduction) =>
    Object.keys(plantProduction || {}).filter(
        (code) => code !== PLAN_META_KEY && plantBlockYardage(plantProduction[code]) > 0
    ).length
