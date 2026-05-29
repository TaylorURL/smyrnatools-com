import {
    buildAssignmentHelpTransfers,
    buildInitialPoolByCode,
    flattenPlanOrders,
    type GetTravelMinutes
} from './PlanRuntimeUtility'
import {
    computePlantPoolTimeline,
    computePullUpRows,
    computeSuggestedSlots,
    isExcludedOrder,
    PLAN_META_KEY,
    timeToMinutes
} from './PlanUtility'

interface OrderLike {
    startTime?: string
    yardage?: string | number
    loadSize?: string | number
    orderId?: string
    orderNum?: string
    plantCode?: string
    [key: string]: unknown
}

interface PlantProduction {
    [key: string]: {
        orders?: OrderLike[]
        totalYardage?: string | number
        [key: string]: unknown
    }
}

interface PlantStat {
    code?: string
    base?: number
    send?: number
    recv?: number
    [key: string]: unknown
}

interface Assignment {
    fromPlant?: string
    toPlant?: string
    returnPlant?: string
    driverCount?: string | number
    time?: string
    leaveTime?: string
    timeMode?: string
    customTimes?: Array<{ time?: string; leaveTime?: string }>
    staggerMinutes?: string | number
    [key: string]: unknown
}

interface PlanMeta {
    [key: string]: unknown
}

interface EmptyJob {
    id: string
    title: string
    contractor: string
    description: string
    plant: string
    time: string
}

interface JobCoverageResult {
    totalJobs: number
    covered: number
    needHelp: number
    deficit: number
    surplus: number
    net: number
}

interface PoolSimInputs {
    flatOrders: Array<OrderLike & { plantCode: string }>
    initialPoolByCode: Record<string, number>
    helpTransfers: Array<{ delta: number; plantCode: string; time: number }>
}

interface DashboardParams {
    plantProduction: PlantProduction | null | undefined
    stats: PlantStat[] | null | undefined
    assignments: Assignment[] | null | undefined
    planDate: string | null | undefined
    getTravelTime?: GetTravelMinutes
}

/** Sum a plant production block's REAL yardage. Re-derives from each
 *  block's `orders[]` so cancelled (17:00) and test (18:00) sentinels are
 *  excluded from the total — even when the precomputed `totalYardage`
 *  field on the block was built before that filter existed. Falls back to
 *  `totalYardage` only when the orders array isn't present. */
const plantBlockYardage = (block: PlantProduction[string] | null | undefined): number => {
    if (!block) return 0
    if (Array.isArray(block.orders)) {
        return block.orders.reduce((sum, order) => {
            if (isExcludedOrder(order)) return sum
            return sum + (parseFloat(String(order?.yardage)) || 0)
        }, 0)
    }
    return parseFloat(String(block.totalYardage)) || 0
}

/**
 * Pure helpers for the Plan Dashboard view — meta blob accessors, time
 * arithmetic, and pool-simulation wrappers that the dashboard, dispatch
 * checklist, and over/under cards consume.
 */

export { PLAN_META_KEY }

export const readPlanMeta = (plantProduction: PlantProduction | null | undefined): PlanMeta =>
    (plantProduction as Record<string, PlanMeta>)?.[PLAN_META_KEY] || {}

export const writePlanMeta = (
    setPlantProduction: ((updater: (prev: PlantProduction) => PlantProduction) => void) | null | undefined,
    updater: ((current: PlanMeta) => PlanMeta) | PlanMeta
): void => {
    setPlantProduction?.((prev) => {
        const next = { ...(prev || {}) } as Record<string, unknown>
        const current = (next[PLAN_META_KEY] as PlanMeta) || {}
        const nextMeta = typeof updater === 'function' ? updater(current) : updater
        next[PLAN_META_KEY] = nextMeta
        return next as PlantProduction
    })
}

/** Stable enough for in-memory plan metadata. */
const generateLocalId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const createEmptyJob = (): EmptyJob => ({
    contractor: '',
    description: '',
    id: generateLocalId(),
    plant: '',
    time: '',
    title: ''
})

/** Subtract `minutes` from an `HH:MM` string. Returns the resulting
 *  `HH:MM` clamped to 00:00, or null if either input can't be parsed. */
export const subtractMinutesFromTime = (time: string | null | undefined, minutes: number): string | null => {
    const mins = timeToMinutes(time)
    if (mins === null || !Number.isFinite(minutes)) return null
    const target = Math.max(0, mins - minutes)
    const h = Math.floor(target / 60)
    const m = target % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Friendly delta string (`1h 5m`, `45m`) for pull-up recommendations. */
export const formatPullUpDelta = (mins: number | null | undefined): string => {
    if (!Number.isFinite(mins as number)) return ''
    const h = Math.floor((mins as number) / 60)
    const m = (mins as number) % 60
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
    return `${m}m`
}

/** Common pool-simulation inputs derived once and shared by the
 *  Dashboard's coverage / pull-up / suggested-slot blocks. Returns null
 *  when no orders exist so callers can short-circuit. */
const buildPoolSimulationInputs = ({
    plantProduction,
    stats,
    assignments,
    planDate,
    getTravelTime
}: DashboardParams): PoolSimInputs | null => {
    const flatOrders = flattenPlanOrders(plantProduction)
    if (flatOrders.length === 0) return null
    return {
        flatOrders,
        helpTransfers: buildAssignmentHelpTransfers(assignments, getTravelTime),
        initialPoolByCode: buildInitialPoolByCode(stats, plantProduction, planDate)
    }
}

/**
 * Replays the schedule's pool simulation across every order so the
 * dashboard's "needs help vs covered" totals match the per-row Trucks
 * column on the Schedule tab.
 */
export const computeDashboardJobCoverage = ({
    plantProduction,
    stats,
    assignments,
    planDate,
    getTravelTime
}: DashboardParams): JobCoverageResult | null => {
    const inputs = buildPoolSimulationInputs({ assignments, getTravelTime, planDate, plantProduction, stats })
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
        if (eff! < 0) {
            needHelp += 1
            deficit += -eff!
        } else {
            surplus += eff!
        }
    })
    if (totalJobs === 0) return null
    return { covered: totalJobs - needHelp, deficit, needHelp, net: surplus - deficit, surplus, totalJobs }
}

/**
 * Pull-up recommendations — later orders that could be moved into earlier
 * surplus windows so the dispatch day compacts instead of trucks idling.
 */
export const computeDashboardPullUpRows = ({
    plantProduction,
    stats,
    assignments,
    planDate,
    getTravelTime
}: DashboardParams) => {
    const inputs = buildPoolSimulationInputs({ assignments, getTravelTime, planDate, plantProduction, stats })
    if (!inputs) return []
    const rows = computePullUpRows(inputs.flatOrders, inputs.initialPoolByCode, null, inputs.helpTransfers)
    return rows.sort((a, b) => b.originalStartMin - a.originalStartMin)
}

/**
 * Open-window recommendations — idle-truck windows where a plant could
 * absorb a new pour without disrupting today's plan.
 */
export const computeDashboardSuggestedSlots = ({
    plantProduction,
    stats,
    assignments,
    planDate,
    getTravelTime
}: DashboardParams) => {
    const inputs = buildPoolSimulationInputs({ assignments, getTravelTime, planDate, plantProduction, stats })
    if (!inputs) return []
    return computeSuggestedSlots(inputs.flatOrders, inputs.initialPoolByCode, null, inputs.helpTransfers)
}

/** Total yardage planned across every plant on the day, ignoring the
 *  reserved `_meta` key and stripping cancelled/test order rows. */
export const sumPlanYardage = (plantProduction: PlantProduction | null | undefined): number =>
    Object.entries(plantProduction || {})
        .filter(([code]) => code !== PLAN_META_KEY)
        .reduce((sum, [, prod]) => sum + plantBlockYardage(prod), 0)

/** Number of plants that have any planned yardage today. */
export const countPlantsWithYardage = (plantProduction: PlantProduction | null | undefined): number =>
    Object.keys(plantProduction || {}).filter(
        (code) => code !== PLAN_META_KEY && plantBlockYardage((plantProduction as PlantProduction)?.[code]) > 0
    ).length
