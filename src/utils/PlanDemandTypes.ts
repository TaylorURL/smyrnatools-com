/**
 * TypeScript interfaces for the Plan Demand aggregation pipeline. Pulled
 * into their own file so `PlanDemandUtility.ts` only carries the runtime
 * logic + helpers, not the type-shape vocabulary.
 */

export interface OrderLike {
    startTime?: string
    rate?: string
    loadSize?: string | number
    yardage?: string | number
    customer?: string
    productCode?: string
    orderNum?: string
    plantCode?: string
    [key: string]: unknown
}

export interface PlantProduction {
    [key: string]: {
        orders?: OrderLike[]
        [key: string]: unknown
    }
}

export interface PlantStat {
    code?: string
    base?: number
    send?: number
    recv?: number
    [key: string]: unknown
}

export interface PlantAccumulator {
    code: string
    name: string
    base: number
    adjustedBase: number
    helpSend: number
    helpRecv: number
    orders: number
    totalTrucks: number
    totalYardage: number
}

export interface HourBucket {
    hour: number
    label: string
    total: number
    yardage: number
}

export interface StackedHourlyEntry {
    hour: number
    label: string
    [plantCode: string]: number | string
}

export interface BiggestOrder {
    customer: string
    orderNum: string
    plantCode: string
    startTime: string
    yardage: number
}

export interface HourlyKpiResult {
    hours: HourBucket[]
    stackedHourly: StackedHourlyEntry[]
    customerYardage: Map<string, number>
    productYardage: Map<string, number>
    biggestOrder: BiggestOrder | null
    bigPourCount: number
    totalLoadSizeSum: number
    totalLoadSizeCount: number
}

export interface TimeOfDayTotals {
    overnight: number
    morning: number
    afternoon: number
    evening: number
}

export interface CapacityByPlantEntry {
    code: string
    label: string
    base: number
    rawBase: number
    peak: number
    slack: number
}

export interface CustomerEntry {
    customer: string
    yardage: number
}

export interface ProductEntry {
    product: string
    yardage: number
}

export interface PeakHour {
    hour: number | null
    label: string
    total: number
}

export interface DemandTotals {
    orders: number
    trucks: number
    yardage: number
}

export interface DemandData {
    avgLoadSize: number
    bigPourCount: number
    biggestOrder: BiggestOrder | null
    capacityByPlant: CapacityByPlantEntry[]
    capacityUtilization: number
    cumulativeHourly: Array<{ hour: number; label: string; yardage: number }>
    hours: HourBucket[]
    peakByPlant: Record<string, number>
    peakHour: PeakHour
    perPlant: PlantAccumulator[]
    productMix: ProductEntry[]
    stackedHourly: StackedHourlyEntry[]
    timeOfDay: TimeOfDayTotals
    topCustomers: CustomerEntry[]
    totalBase: number
    totals: DemandTotals
}

export interface SupplyVerdict {
    label: string
    color: string
    tone: string
    coverage?: number
}

export interface BuildDemandParams {
    plantProduction: PlantProduction | null | undefined
    stats: PlantStat[] | null | undefined
    plantNameByCode: Record<string, string> | null | undefined
    planDate: string | null | undefined
    allowedCodes: Set<string> | null | undefined
}

export interface BuildPlantAccumulatorsParams {
    stats: PlantStat[] | null | undefined
    plantProduction: PlantProduction | null | undefined
    plantNameByCode: Record<string, string> | null | undefined
    planDate: string | null | undefined
    passesPlantFilter: (code: string) => boolean
}

export interface AccumulateOrdersParams {
    plants: Map<string, PlantAccumulator>
    plantProduction: PlantProduction | null | undefined
    plantNameByCode: Record<string, string> | null | undefined
    passesPlantFilter: (code: string) => boolean
}

export interface CollectHourlyParams {
    plantProduction: PlantProduction | null | undefined
    passesPlantFilter: (code: string) => boolean
}
