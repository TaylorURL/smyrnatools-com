import {
    buildAssignmentDriverTimes,
    getEffectiveBase,
    isExcludedOrder,
    PLAN_META_KEY,
    timeToMinutes,
    TRUCK_ON_SITE_MINUTES
} from './PlanUtility'

/**
 * Shared, view-agnostic helpers for the Plan tabs (Dashboard / Demand /
 * Realtime). Centralizes the same chunks of logic that previously sat as
 * private const helpers in each tab — flat-order extraction, pool-sim
 * inputs, district resolution, and small format helpers.
 */

interface OrderLike {
    startTime?: string
    rate?: string
    loadSize?: string | number
    yardage?: string | number
    plantCode?: string
    orderId?: string
    orderNum?: string
    [key: string]: unknown
}

interface PlantProduction {
    [key: string]: {
        orders?: OrderLike[]
        [key: string]: unknown
    }
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

interface HelpTransfer {
    delta: number
    plantCode: string
    time: number
}

interface PlantStat {
    code?: string
    base?: number
    send?: number
    recv?: number
    [key: string]: unknown
}

interface Plant {
    plantCode?: string
    plant_code?: string
    districts?: Array<string | { name?: string }>
    [key: string]: unknown
}

interface PlantFilterParams {
    plantFilter: string | null | undefined
    plants?: Plant[] | null
    userPlantCode?: string | null
}

interface PlantFilterDisplayParams {
    plantFilter: string | null | undefined
    plantNameByCode?: Record<string, string> | null
    totalPlantOptions?: number
}

export const cleanString = (value: unknown): string => (value == null ? '' : String(value).trim())

/** Format a minute-of-day count as `HH:MM` clock time. Wraps across day
 *  boundaries so negative or 24h+ values still render sensibly. */
export const formatMinutesClock = (mins: number | null | undefined): string => {
    if (!Number.isFinite(mins as number)) return '\u2014'
    const wrapped = (((mins as number) % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Compact relative offset (`+15m`, `-2h30m`, `now`). Empty string for
 *  non-numeric input — callers can render "\u2014" as their fallback. */
export const formatRelativeMinutes = (diffMin: number | null | undefined): string => {
    if (!Number.isFinite(diffMin as number)) return ''
    if (Math.abs(diffMin as number) < 1) return 'now'
    const abs = Math.abs(diffMin as number)
    if (abs < 60) return (diffMin as number) > 0 ? `+${Math.round(abs)}m` : `-${Math.round(abs)}m`
    const hours = Math.floor(abs / 60)
    const mins = Math.round(abs % 60)
    const suffix = mins > 0 ? `${hours}h${mins}m` : `${hours}h`
    return (diffMin as number) > 0 ? `+${suffix}` : `-${suffix}`
}

/** Minutes a single order ties up trucks for. Trip math: spacing rate x
 *  (trips - 1) + on-site time. Falls back to 60 minutes when inputs are
 *  missing so the schedule still surfaces something at a glance. */
export const estimatePourMinutes = (order: OrderLike | null | undefined): number => {
    const rate = timeToMinutes(order?.rate)
    const loadSize = parseFloat(String(order?.loadSize)) || 0
    const yardage = parseFloat(String(order?.yardage)) || 0
    if (!rate || loadSize <= 0 || yardage <= 0) return 60
    const trips = Math.max(1, Math.ceil(yardage / loadSize))
    return (trips - 1) * rate + TRUCK_ON_SITE_MINUTES
}

/** Strip the `_meta` key and return every order on the plan with its
 *  source plant code attached. Excluded (cancelled / test) orders are
 *  filtered out so callers don't have to repeat the check. */
export const flattenPlanOrders = (
    plantProduction: PlantProduction | null | undefined
): Array<OrderLike & { plantCode: string }> => {
    const out: Array<OrderLike & { plantCode: string }> = []
    Object.entries(plantProduction || {}).forEach(([code, prod]) => {
        if (code === PLAN_META_KEY) return
        const list = Array.isArray(prod?.orders) ? prod.orders : []
        list.forEach((order) => {
            if (isExcludedOrder(order)) return
            out.push({ ...order, plantCode: code })
        })
    })
    return out
}

/** Build the `helpTransfers` payload used by every pool-simulation entry
 *  point (`computePlantPoolTimeline`, `computePullUpRows`, etc). Each
 *  driver in an inter-plant assignment contributes a -1 at the source
 *  plant and a +1 at the destination at arrival time, plus a return leg
 *  if the leave time is known. */
export const buildHelpTransfers = (assignments: Assignment[] | null | undefined): HelpTransfer[] => {
    const out: HelpTransfer[] = []
    ;(assignments || []).forEach((assignment) => {
        if (!assignment?.fromPlant || !assignment?.toPlant) return
        if (assignment.fromPlant === assignment.toPlant) return
        const home = assignment.returnPlant || assignment.fromPlant
        buildAssignmentDriverTimes(assignment).forEach((dt) => {
            if (!Number.isFinite(dt.arriveMin)) return
            out.push({ delta: -1, plantCode: assignment.fromPlant!, time: dt.arriveMin! })
            out.push({ delta: 1, plantCode: assignment.toPlant!, time: dt.arriveMin! })
            if (Number.isFinite(dt.leaveMin) && dt.leaveMin! > dt.arriveMin!) {
                out.push({ delta: -1, plantCode: assignment.toPlant!, time: dt.leaveMin! })
                out.push({ delta: 1, plantCode: home!, time: dt.leaveMin! })
            }
        })
    })
    return out
}

/** Map of `{ plantCode -> starting effective truck pool }`. Mirrors the
 *  Schedule tab so every dashboard / demand / realtime view starts the
 *  pool simulation with the same numbers the dispatcher sees. */
export const buildInitialPoolByCode = (
    stats: PlantStat[] | null | undefined,
    plantProduction: PlantProduction | null | undefined,
    planDate: string | null | undefined
): Record<string, number> => {
    const out: Record<string, number> = {}
    ;(stats || []).forEach((stat) => {
        if (!stat?.code) return
        const base = Number.isFinite(stat.base) ? stat.base! : 0
        out[stat.code] = getEffectiveBase(base, stat.code, plantProduction, planDate)
    })
    return out
}

/** Resolve a `plantFilter` selection (single-plant code, `MY_PLANTS`, or
 *  `DISTRICT:<name>`) into a concrete Set of plant codes, or null when
 *  the filter is inactive. */
export const resolvePlantFilterCodes = ({
    plantFilter,
    plants,
    userPlantCode
}: PlantFilterParams): Set<string> | null => {
    if (!plantFilter || plantFilter === 'all' || plantFilter === 'All') return null
    if (plantFilter === 'MY_PLANTS') return userPlantCode ? new Set([userPlantCode]) : new Set()
    if (plantFilter.startsWith('DISTRICT:')) {
        const districtName = plantFilter.slice(9)
        const codes = new Set<string>()
        ;(plants || []).forEach((plant) => {
            const code = plant.plantCode || plant.plant_code
            if (!code) return
            const districts = plant.districts || []
            if (districts.some((d) => (typeof d === 'string' ? d : d?.name) === districtName)) codes.add(code)
        })
        return codes
    }
    return new Set([plantFilter])
}

/** Human-readable label for the active plant-filter selection. */
export const formatPlantFilterDisplay = ({
    plantFilter,
    plantNameByCode,
    totalPlantOptions
}: PlantFilterDisplayParams): string => {
    const isActive = plantFilter && plantFilter !== 'all' && plantFilter !== 'All' && plantFilter !== ''
    if (!isActive) return `All plants (${totalPlantOptions ?? 0})`
    if (plantFilter === 'MY_PLANTS') return 'My Plants'
    if (plantFilter!.startsWith('DISTRICT:')) return plantFilter!.slice(9)
    const name = plantNameByCode?.[plantFilter!]
    return name ? `Plant ${plantFilter} \u00b7 ${name}` : `Plant ${plantFilter}`
}
