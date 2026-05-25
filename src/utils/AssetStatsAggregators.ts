/**
 * Pure per-section aggregators consumed by `useAssetStatistics`. Each function
 * here is a one-pass rollup over an already-scoped asset list — no React, no
 * fetches, no side effects — so the hook can keep its `useMemo` wrappers as
 * one-liners and the maths stays unit-testable in isolation.
 *
 * Inputs follow the hook's existing pipeline: callers pass `operationalItems`
 * (retired removed), the asset `config` (feature flags + identifier rules),
 * plus the plant/operator name lookups already memoized at the top of the
 * hook. When a downstream rollup also needs the headline `summary`, it is
 * threaded in as a parameter rather than recomputed — preserving the single-
 * pass cost of the original memo graph.
 */

import AssetStatsUtility, {
    AGE_BUCKET_ORDER,
    ageBucket,
    daysSince,
    displayStatus,
    itemDisplayId,
    itemYear,
    RETIRED_STATUSES,
    SHOP_SUB_LABELS,
    TENURE_BUCKET_ORDER,
    tenureBucket
} from './AssetStatsUtility'

const UNASSIGNED_PLANT_CODE = 'UNASSIGNED'

const upperCode = (value: unknown): string =>
    String(value || '')
        .trim()
        .toUpperCase()

const plantCodeOrUnassigned = (value: unknown): string => upperCode(value) || UNASSIGNED_PLANT_CODE

const verifiedNow = (item: { isVerified?: () => boolean }): boolean =>
    typeof item.isVerified === 'function' ? item.isVerified() : false

const finiteHours = (value: unknown): number | null => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

/** Filter the raw `items` list down to what the Statistics page should see —
 *  honors the active region, the page-local plant filter (independent from
 *  the list view), and the date range. Returns the original array when the
 *  input isn't iterable so downstream memos stay safe. */
export const computeScopedItems = (
    items: any[] | null | undefined,
    {
        dateRange,
        regionPlantCodes,
        selectedPlant
    }: {
        dateRange?: { end?: string | null; start?: string | null } | null
        regionPlantCodes?: Set<string> | null
        selectedPlant?: string | null
    }
): any[] => {
    if (!Array.isArray(items)) return []
    const plant = upperCode(selectedPlant)
    const startTime = dateRange?.start ? new Date(`${dateRange.start}T00:00:00`).getTime() : null
    const endTime = dateRange?.end ? new Date(`${dateRange.end}T23:59:59.999`).getTime() : null
    return items.filter((item) => {
        const itemPlant = upperCode(item.assignedPlant)
        if (regionPlantCodes && regionPlantCodes.size > 0 && itemPlant && !regionPlantCodes.has(itemPlant)) return false
        if (plant && plant !== 'ALL' && itemPlant !== plant) return false
        if (startTime != null && endTime != null) {
            const activity = item.updatedAt || item.updatedLast || item.createdAt || null
            if (!activity) return false
            const activityTime = new Date(activity).getTime()
            if (!Number.isFinite(activityTime)) return false
            if (activityTime < startTime || activityTime > endTime) return false
        }
        return true
    })
}

/** Headline KPI surface for the Overview launchpad. Single O(n) pass over
 *  operational items rolling up verification, service, issues, cleanliness,
 *  data-completeness, fleet year, hours, and tenure metrics. */
export const computeSummary = (
    scopedItems: any[],
    operationalItems: any[],
    retiredItems: any[],
    config: any
): Record<string, any> => {
    const counts = AssetStatsUtility.getStatusCounts(scopedItems)
    const total = counts.Total || 0
    const hasService = !!config?.verification?.isServiceOverdueFn || config?.key === 'mixer'
    const hasChip = !!config?.verification?.hasLastChipDate
    const hasCleanliness = scopedItems.some((item) => item.cleanlinessRating != null)

    const accumulator = {
        assetsMissingAnyField: 0,
        assetsWithOpenIssues: 0,
        cleanlinessSamples: 0,
        cleanlinessSum: 0,
        dirtyCount: 0,
        hoursSamples: 0,
        hoursSum: 0,
        missingMake: 0,
        missingModel: 0,
        missingVin: 0,
        missingYear: 0,
        openIssues: 0,
        overdueChip: 0,
        overdueService: 0,
        tenureSamples: 0,
        tenureSum: 0,
        unassignedActive: 0,
        unverified: 0,
        verified: 0,
        yearSamples: 0,
        yearSum: 0
    }

    operationalItems.forEach((item) => {
        if (verifiedNow(item)) accumulator.verified += 1
        else accumulator.unverified += 1

        if (hasService && AssetStatsUtility.isServiceOverdue(item.lastServiceDate)) accumulator.overdueService += 1
        if (hasChip && AssetStatsUtility.isServiceOverdue(item.lastChipDate, 90)) accumulator.overdueChip += 1

        const open = Number(item.openIssuesCount || 0)
        if (open > 0) {
            accumulator.openIssues += open
            accumulator.assetsWithOpenIssues += 1
        }

        if (item.cleanlinessRating != null) {
            const rating = Number(item.cleanlinessRating) || 0
            accumulator.cleanlinessSamples += 1
            accumulator.cleanlinessSum += rating
            if (rating > 0 && rating < 3) accumulator.dirtyCount += 1
        }

        if (config?.hasOperatorAssignment && item.status === 'Active' && !item.assignedOperator) {
            accumulator.unassignedActive += 1
        }

        const year = itemYear(item)
        if (year) {
            accumulator.yearSum += year
            accumulator.yearSamples += 1
        }

        const hours = finiteHours(item.hours)
        if (hours != null) {
            accumulator.hoursSum += hours
            accumulator.hoursSamples += 1
        }

        const vin = item.vinNumber || item.vin
        const missingVin = !vin
        const missingMake = !item.make
        const missingModel = !item.model
        const missingYear = !item.year
        if (missingVin || missingMake || missingModel || missingYear) accumulator.assetsMissingAnyField += 1
        if (missingVin) accumulator.missingVin += 1
        if (missingMake) accumulator.missingMake += 1
        if (missingModel) accumulator.missingModel += 1
        if (missingYear) accumulator.missingYear += 1

        const tenure = daysSince(item.statusChangedAt || item.createdAt)
        if (tenure != null) {
            accumulator.tenureSum += tenure
            accumulator.tenureSamples += 1
        }
    })

    return {
        activeCount: counts.Active || 0,
        assetsMissingAnyField: accumulator.assetsMissingAnyField,
        assetsWithOpenIssues: accumulator.assetsWithOpenIssues,
        avgFleetYear: accumulator.yearSamples > 0 ? Math.round(accumulator.yearSum / accumulator.yearSamples) : null,
        avgHours: accumulator.hoursSamples > 0 ? accumulator.hoursSum / accumulator.hoursSamples : null,
        avgStatusTenure:
            accumulator.tenureSamples > 0 ? Math.round(accumulator.tenureSum / accumulator.tenureSamples) : null,
        cleanlinessAvg:
            accumulator.cleanlinessSamples > 0 ? accumulator.cleanlinessSum / accumulator.cleanlinessSamples : null,
        cleanlinessSamples: accumulator.cleanlinessSamples,
        dirtyCount: accumulator.dirtyCount,
        dirtyRate: hasCleanliness && total > 0 ? accumulator.dirtyCount / total : null,
        hasChip,
        hasCleanliness,
        hasService,
        missingMake: accumulator.missingMake,
        missingModel: accumulator.missingModel,
        missingVin: accumulator.missingVin,
        missingYear: accumulator.missingYear,
        openIssues: accumulator.openIssues,
        overdueChip: accumulator.overdueChip,
        overdueService: accumulator.overdueService,
        overdueServiceRate: hasService && total > 0 ? accumulator.overdueService / total : null,
        retiredCount: retiredItems.length,
        shopCount: counts['In Shop'] || 0,
        spareCount: counts.Spare || 0,
        total,
        unassignedActive: accumulator.unassignedActive,
        unverified: accumulator.unverified,
        verified: accumulator.verified,
        verifiedRate: total > 0 ? accumulator.verified / total : null
    }
}

/** Status distribution for the Fleet Status page — flattens In-Shop sub
 *  statuses to match the list view. */
export const computeStatusDistribution = (operationalItems: any[]): { count: number; label: string }[] => {
    const totals = new Map<string, number>()
    operationalItems.forEach((item) => {
        const label = displayStatus(item)
        totals.set(label, (totals.get(label) || 0) + 1)
    })
    return [...totals.entries()].map(([label, count]) => ({ count, label })).sort((a, b) => b.count - a.count)
}

/** Per-plant scorecard — active/spare/shop split + operator coverage. */
export const computePerPlant = (
    operationalItems: any[],
    plantNames: Map<string, string>,
    config: any,
    hasService: boolean
): any[] => {
    const map = new Map<string, any>()
    operationalItems.forEach((item) => {
        const code = plantCodeOrUnassigned(item.assignedPlant)
        if (!map.has(code)) {
            map.set(code, {
                active: 0,
                code,
                name: plantNames.get(code) || code,
                openIssues: 0,
                overdueService: 0,
                shop: 0,
                spare: 0,
                total: 0,
                unassignedActive: 0,
                unverified: 0,
                verified: 0
            })
        }
        const row = map.get(code)
        row.total += 1
        if (item.status === 'Active') row.active += 1
        else if (item.status === 'Spare') row.spare += 1
        else if (item.status === 'In Shop') row.shop += 1
        if (verifiedNow(item)) row.verified += 1
        else row.unverified += 1
        if (config?.hasOperatorAssignment && item.status === 'Active' && !item.assignedOperator) {
            row.unassignedActive += 1
        }
        if (hasService && AssetStatsUtility.isServiceOverdue(item.lastServiceDate)) row.overdueService += 1
        row.openIssues += Number(item.openIssuesCount || 0)
    })
    return [...map.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
}

/** Tenure histogram for the Fleet Status page. */
export const computeTenureBuckets = (operationalItems: any[]): { count: number; label: string }[] => {
    const map = new Map<string, number>(TENURE_BUCKET_ORDER.map((label) => [label, 0]))
    operationalItems.forEach((item) => {
        const bucket = tenureBucket(daysSince(item.statusChangedAt || item.createdAt))
        if (bucket) map.set(bucket, (map.get(bucket) || 0) + 1)
    })
    return TENURE_BUCKET_ORDER.map((label) => ({ count: map.get(label) || 0, label }))
}

/** Longest-tenure watchlist (top 12, ≥ 7 days). */
export const computeLongestInStatus = (
    operationalItems: any[],
    operatorNames: Map<string, string>,
    config: any
): any[] =>
    operationalItems
        .map((item) => ({
            days: daysSince(item.statusChangedAt || item.createdAt),
            displayStatus: displayStatus(item),
            id: item.id,
            identifier: itemDisplayId(item, config),
            operatorName: operatorNames.get(item.assignedOperator) || null,
            plant: item.assignedPlant || '—',
            status: item.status
        }))
        .filter((row) => row.days != null && row.days >= 7)
        .sort((a, b) => (b.days || 0) - (a.days || 0))
        .slice(0, 12)

/** Year/age histogram with a separate "Unknown" bucket for missing years. */
export const computeAgeDistribution = (operationalItems: any[]): { count: number; label: string }[] => {
    const currentYear = new Date().getFullYear()
    const map = new Map<string, number>(AGE_BUCKET_ORDER.map((label) => [label, 0]))
    let unknownYear = 0
    operationalItems.forEach((item) => {
        const bucket = ageBucket(item.year, currentYear)
        if (bucket) map.set(bucket, (map.get(bucket) || 0) + 1)
        else unknownYear += 1
    })
    const rows = AGE_BUCKET_ORDER.map((label) => ({ count: map.get(label) || 0, label }))
    if (unknownYear > 0) rows.push({ count: unknownYear, label: 'Unknown' })
    return rows
}

/** Oldest-asset watchlist (top 12, ignoring rows without a year). */
export const computeOldestAssets = (operationalItems: any[], config: any): any[] => {
    const currentYear = new Date().getFullYear()
    return operationalItems
        .filter((item) => itemYear(item))
        .map((item) => ({
            age: currentYear - (itemYear(item) || 0),
            hours: finiteHours(item.hours),
            id: item.id,
            identifier: itemDisplayId(item, config),
            make: item.make || '—',
            model: item.model || '—',
            plant: item.assignedPlant || '—',
            status: item.status,
            year: itemYear(item) as number
        }))
        .sort((a, b) => a.year - b.year || (b.hours || 0) - (a.hours || 0))
        .slice(0, 12)
}

/** Top assets by open issue count (max 15). */
export const computeTopIssueAssets = (
    operationalItems: any[],
    operatorNames: Map<string, string>,
    config: any
): any[] =>
    operationalItems
        .filter((item) => Number(item.openIssuesCount || 0) > 0)
        .map((item) => ({
            id: item.id,
            identifier: itemDisplayId(item, config),
            openIssues: Number(item.openIssuesCount || 0),
            operatorName: operatorNames.get(item.assignedOperator) || null,
            plant: item.assignedPlant || '—',
            status: displayStatus(item)
        }))
        .sort((a, b) => b.openIssues - a.openIssues || Number(a.status !== 'Active') - Number(b.status !== 'Active'))
        .slice(0, 15)

/** Cleanliness distribution 1–5. */
export const computeCleanlinessDistribution = (operationalItems: any[]): { count: number; rating: number }[] => {
    const map = new Map<number, number>([1, 2, 3, 4, 5].map((rating) => [rating, 0]))
    operationalItems.forEach((item) => {
        const rating = Number(item.cleanlinessRating)
        if (rating >= 1 && rating <= 5) map.set(rating, (map.get(rating) || 0) + 1)
    })
    return [1, 2, 3, 4, 5].map((rating) => ({ count: map.get(rating) || 0, rating }))
}

/** Dirty-fleet watchlist (rating < 3, top 15 worst first). */
export const computeDirtyAssets = (operationalItems: any[], operatorNames: Map<string, string>, config: any): any[] =>
    operationalItems
        .filter((item) => Number(item.cleanlinessRating) > 0 && Number(item.cleanlinessRating) < 3)
        .map((item) => ({
            id: item.id,
            identifier: itemDisplayId(item, config),
            operatorName: operatorNames.get(item.assignedOperator) || null,
            plant: item.assignedPlant || '—',
            rating: Number(item.cleanlinessRating),
            status: displayStatus(item)
        }))
        .sort((a, b) => a.rating - b.rating)
        .slice(0, 15)

/** Per-plant cleanliness rollup (avg + dirty count, worst plants first). */
export const computeCleanlinessByPlant = (operationalItems: any[], plantNames: Map<string, string>): any[] => {
    const map = new Map<string, { code: string; dirty: number; name: string; samples: number; sum: number }>()
    operationalItems.forEach((item) => {
        const rating = Number(item.cleanlinessRating)
        if (!(rating >= 1 && rating <= 5)) return
        const code = plantCodeOrUnassigned(item.assignedPlant)
        if (!map.has(code)) {
            map.set(code, { code, dirty: 0, name: plantNames.get(code) || code, samples: 0, sum: 0 })
        }
        const row = map.get(code)!
        row.samples += 1
        row.sum += rating
        if (rating < 3) row.dirty += 1
    })
    return [...map.values()]
        .map((row) => ({ ...row, avg: row.samples > 0 ? row.sum / row.samples : null }))
        .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99) || b.dirty - a.dirty)
}

/** Service-overdue watchlist (top 20 most overdue). Returns [] when the
 *  asset type doesn't track service. */
export const computeOverdueServiceList = (
    operationalItems: any[],
    operatorNames: Map<string, string>,
    config: any,
    hasService: boolean
): any[] => {
    if (!hasService) return []
    const threshold = config?.serviceOverdueDays || 180
    return operationalItems
        .filter((item) => AssetStatsUtility.isServiceOverdue(item.lastServiceDate, threshold))
        .map((item) => ({
            daysSinceService: daysSince(item.lastServiceDate),
            hours: finiteHours(item.hours),
            id: item.id,
            identifier: itemDisplayId(item, config),
            lastServiceDate: item.lastServiceDate,
            operatorName: operatorNames.get(item.assignedOperator) || null,
            plant: item.assignedPlant || '—',
            status: displayStatus(item)
        }))
        .sort((a, b) => (b.daysSinceService || 0) - (a.daysSinceService || 0))
        .slice(0, 20)
}

/** Operator coverage — active assets vs operators on the payroll in scope.
 *  Returns null when the asset type doesn't carry operator assignment. */
export const computeOperatorCoverage = (
    operationalItems: any[],
    operators: any[] | null | undefined,
    config: any,
    { regionPlantCodes, selectedPlant }: { regionPlantCodes?: Set<string> | null; selectedPlant?: string | null }
): any => {
    if (!config?.hasOperatorAssignment) return null
    const plant = upperCode(selectedPlant)
    const position = config?.operatorConfig?.position
    const isInScope = (op: any) => {
        if (!op || op.status !== 'Active') return false
        if (position && op.position !== position) return false
        const opPlant = upperCode(op.plantCode)
        if (regionPlantCodes && regionPlantCodes.size > 0 && opPlant && !regionPlantCodes.has(opPlant)) return false
        if (plant && plant !== 'ALL' && opPlant !== plant) return false
        return true
    }
    const activeOperators = (operators || []).filter(isInScope)
    const activeAssets = operationalItems.filter((item) => item.status === 'Active')
    const assigned = activeAssets.filter((item) => item.assignedOperator).length
    const assignedIds = new Set(activeAssets.map((item) => item.assignedOperator).filter(Boolean))
    const benchedOperators = activeOperators.filter((op) => !assignedIds.has(op.employeeId))
    const benchedList = benchedOperators
        .map((op) => ({ id: op.employeeId, name: op.name || op.employeeId, plant: op.plantCode || '—' }))
        .sort((a, b) => a.plant.localeCompare(b.plant) || a.name.localeCompare(b.name))
    const unassignedAssetList = activeAssets
        .filter((item) => !item.assignedOperator)
        .map((item) => ({
            id: item.id,
            identifier: itemDisplayId(item, config),
            plant: item.assignedPlant || '—',
            status: displayStatus(item)
        }))
        .sort((a, b) => a.plant.localeCompare(b.plant) || a.identifier.localeCompare(b.identifier))
    return {
        activeAssets: activeAssets.length,
        activeOperators: activeOperators.length,
        assignedAssets: assigned,
        benchedList: benchedList.slice(0, 20),
        benchedOperators: benchedOperators.length,
        unassignedAssetList: unassignedAssetList.slice(0, 20),
        unassignedAssets: activeAssets.length - assigned
    }
}

const HOURS_BUCKETS: { label: string; max: number }[] = [
    { label: '< 100h', max: 100 },
    { label: '100–2.5k', max: 2500 },
    { label: '2.5k–5k', max: 5000 },
    { label: '5k–10k', max: 10000 },
    { label: '10k–15k', max: 15000 },
    { label: '15k–25k', max: 25000 },
    { label: '> 25k', max: Infinity }
]

/** Hours utilization rollup — distribution, per-plant averages, top
 *  consumers, hours-per-year leaderboard. Returns `{ hasHours: false }`
 *  when the asset type doesn't track hours so the section drops cleanly. */
export const computeHoursStats = (
    operationalItems: any[],
    operatorNames: Map<string, string>,
    plantNames: Map<string, string>,
    config: any
): any => {
    const hasHours = !!config?.verification?.hasHours
    if (!hasHours) return { hasHours: false }

    const currentYear = new Date().getFullYear()
    const rows = operationalItems
        .map((item) => {
            const year = itemYear(item)
            return {
                age: year ? currentYear - year : null,
                hours: Number(item.hours),
                id: item.id,
                identifier: itemDisplayId(item, config),
                operatorName: operatorNames.get(item.assignedOperator) || null,
                plant: item.assignedPlant || '—',
                status: displayStatus(item),
                year
            }
        })
        .filter((row) => Number.isFinite(row.hours) && row.hours >= 0)

    if (rows.length === 0) {
        return {
            avgHours: null,
            avgHoursPerYear: null,
            hasHours,
            hoursByPlant: [],
            hoursDistribution: [],
            hoursPerYearTopList: [],
            hoursRecorded: 0,
            hoursTotal: 0,
            hoursUnrecorded: operationalItems.length,
            medianHours: null,
            topByHours: []
        }
    }

    const sortedByHours = [...rows].sort((a, b) => a.hours - b.hours)
    const total = sortedByHours.reduce((sum, row) => sum + row.hours, 0)
    const avgHours = total / sortedByHours.length
    const medianIdx = Math.floor(sortedByHours.length / 2)
    const medianHours =
        sortedByHours.length % 2 === 0
            ? (sortedByHours[medianIdx - 1].hours + sortedByHours[medianIdx].hours) / 2
            : sortedByHours[medianIdx].hours

    const distribution = HOURS_BUCKETS.map(({ label }) => ({ count: 0, label }))
    rows.forEach((row) => {
        const idx = HOURS_BUCKETS.findIndex((bucket) => row.hours <= bucket.max)
        const target = idx === -1 ? distribution.length - 1 : idx
        distribution[target].count += 1
    })

    const plantMap = new Map<string, { code: string; max: number; name: string; samples: number; sum: number }>()
    rows.forEach((row) => {
        const code = plantCodeOrUnassigned(row.plant)
        if (!plantMap.has(code)) {
            plantMap.set(code, { code, max: 0, name: plantNames.get(code) || code, samples: 0, sum: 0 })
        }
        const bucket = plantMap.get(code)!
        bucket.samples += 1
        bucket.sum += row.hours
        if (row.hours > bucket.max) bucket.max = row.hours
    })
    const hoursByPlant = [...plantMap.values()]
        .map((row) => ({ ...row, avg: row.samples > 0 ? row.sum / row.samples : 0 }))
        .sort((a, b) => b.avg - a.avg || b.sum - a.sum)

    const topByHours = [...rows].sort((a, b) => b.hours - a.hours).slice(0, 15)

    const withAge = rows.filter((row) => row.age != null && row.age > 0 && row.hours > 0)
    const hoursPerYearTopList = withAge
        .map((row) => ({ ...row, hoursPerYear: row.hours / (row.age as number) }))
        .sort((a, b) => b.hoursPerYear - a.hoursPerYear)
        .slice(0, 15)

    const avgHoursPerYear =
        withAge.length > 0
            ? withAge.reduce((sum, row) => sum + row.hours / (row.age as number), 0) / withAge.length
            : null

    return {
        avgHours,
        avgHoursPerYear,
        hasHours,
        hoursByPlant,
        hoursDistribution: distribution,
        hoursPerYearTopList,
        hoursRecorded: rows.length,
        hoursTotal: total,
        hoursUnrecorded: operationalItems.length - rows.length,
        medianHours,
        topByHours
    }
}

const SHOP_SUB_STATUS_ORDER = ['In Shop', 'Third Party Work', 'Ready For Pickup', 'Waiting For Shop', 'Down In Yard']
const SHOP_TENURE_ORDER = ['0–3d', '4–7d', '8–14d', '15–30d', '31–60d', '> 60d']
const SHOP_STUCK_THRESHOLD_DAYS = 30

const shopTenureBucket = (days: number | null): string | null => {
    if (days == null) return null
    if (days <= 3) return '0–3d'
    if (days <= 7) return '4–7d'
    if (days <= 14) return '8–14d'
    if (days <= 30) return '15–30d'
    if (days <= 60) return '31–60d'
    return '> 60d'
}

interface ShopByPlantRow {
    code: string
    downInYard: number
    inShop: number
    name: string
    readyForPickup: number
    thirdParty: number
    total: number
    waitingForShop: number
}

const incrementShopSubStatus = (row: ShopByPlantRow, shopStatus: string | null | undefined): void => {
    switch (shopStatus) {
        case 'down_in_yard':
            row.downInYard += 1
            break
        case 'ready_for_pickup':
            row.readyForPickup += 1
            break
        case 'third_party':
            row.thirdParty += 1
            break
        case 'waiting_for_shop':
            row.waitingForShop += 1
            break
        default:
            row.inShop += 1
    }
}

const mapShopAssetRow = (item: any, operatorNames: Map<string, string>, config: any) => ({
    days: daysSince(item.statusChangedAt || item.createdAt),
    id: item.id,
    identifier: itemDisplayId(item, config),
    operatorName: operatorNames.get(item.assignedOperator) || null,
    plant: item.assignedPlant || '—',
    shopStatus: item.shopStatus || 'in_shop',
    status: displayStatus(item)
})

/** Shop performance rollup — sub-status distribution, per-plant load,
 *  tenure histogram, stuck/ready watchlists. Requires `summaryTotal` so
 *  the shop rate is consistent with the headline KPI strip. */
export const computeShopPerformance = (
    operationalItems: any[],
    operatorNames: Map<string, string>,
    plantNames: Map<string, string>,
    config: any,
    summaryTotal: number
): any => {
    const shopItems = operationalItems.filter((item) => item.status === 'In Shop')
    const supportsSubStatuses = !!config?.hasShopSubStatuses

    const subStatusCounts = new Map<string, number>()
    const subStatusTenureSum = new Map<string, number>()
    const subStatusTenureSamples = new Map<string, number>()
    let totalTenureSum = 0
    let totalTenureSamples = 0

    shopItems.forEach((item) => {
        const tenure = daysSince(item.statusChangedAt || item.createdAt)
        if (tenure != null) {
            totalTenureSum += tenure
            totalTenureSamples += 1
        }
        if (!supportsSubStatuses) return
        const label = SHOP_SUB_LABELS[item.shopStatus || 'in_shop'] || 'In Shop'
        subStatusCounts.set(label, (subStatusCounts.get(label) || 0) + 1)
        if (tenure != null) {
            subStatusTenureSum.set(label, (subStatusTenureSum.get(label) || 0) + tenure)
            subStatusTenureSamples.set(label, (subStatusTenureSamples.get(label) || 0) + 1)
        }
    })

    const subStatusDistribution = supportsSubStatuses
        ? SHOP_SUB_STATUS_ORDER.filter((label) => subStatusCounts.has(label)).map((label) => {
              const count = subStatusCounts.get(label) || 0
              const sampleCount = subStatusTenureSamples.get(label) || 0
              const avgDays = sampleCount > 0 ? (subStatusTenureSum.get(label) || 0) / sampleCount : null
              return { avgDays, count, label }
          })
        : []

    const shopByPlantMap = new Map<string, ShopByPlantRow>()
    shopItems.forEach((item) => {
        const code = plantCodeOrUnassigned(item.assignedPlant)
        if (!shopByPlantMap.has(code)) {
            shopByPlantMap.set(code, {
                code,
                downInYard: 0,
                inShop: 0,
                name: plantNames.get(code) || code,
                readyForPickup: 0,
                thirdParty: 0,
                total: 0,
                waitingForShop: 0
            })
        }
        const row = shopByPlantMap.get(code)!
        row.total += 1
        if (!supportsSubStatuses) {
            row.inShop += 1
            return
        }
        incrementShopSubStatus(row, item.shopStatus)
    })
    const shopByPlant = [...shopByPlantMap.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))

    const tenureMap = new Map<string, number>(SHOP_TENURE_ORDER.map((label) => [label, 0]))
    shopItems.forEach((item) => {
        const bucket = shopTenureBucket(daysSince(item.statusChangedAt || item.createdAt))
        if (bucket) tenureMap.set(bucket, (tenureMap.get(bucket) || 0) + 1)
    })
    const tenureDistribution = SHOP_TENURE_ORDER.map((label) => ({ count: tenureMap.get(label) || 0, label }))

    const stuckInShop = shopItems
        .map((item) => mapShopAssetRow(item, operatorNames, config))
        .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
        .slice(0, 25)

    const readyForPickupQueue = supportsSubStatuses
        ? shopItems
              .filter((item) => item.shopStatus === 'ready_for_pickup')
              .map((item) => mapShopAssetRow(item, operatorNames, config))
              .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
        : []

    const countByShopStatus = (status: string): number =>
        supportsSubStatuses ? shopItems.filter((item) => item.shopStatus === status).length : 0

    const inShopCount = supportsSubStatuses
        ? shopItems.filter((item) => item.shopStatus === 'in_shop' || !item.shopStatus).length
        : shopItems.length

    const stuckCount = shopItems.filter((item) => {
        const days = daysSince(item.statusChangedAt || item.createdAt)
        return days != null && days >= SHOP_STUCK_THRESHOLD_DAYS
    }).length

    const totalInShop = shopItems.length

    return {
        avgShopDays: totalTenureSamples > 0 ? totalTenureSum / totalTenureSamples : null,
        downInYardCount: countByShopStatus('down_in_yard'),
        inShopCount,
        readyForPickupCount: countByShopStatus('ready_for_pickup'),
        readyForPickupQueue,
        shopByPlant,
        shopItems,
        shopRate: summaryTotal > 0 ? totalInShop / summaryTotal : 0,
        stuckCount,
        stuckInShop,
        stuckThreshold: SHOP_STUCK_THRESHOLD_DAYS,
        subStatusDistribution,
        supportsSubStatuses,
        tenureDistribution,
        thirdPartyCount: countByShopStatus('third_party'),
        totalInShop,
        waitingForShopCount: countByShopStatus('waiting_for_shop')
    }
}

/** Plant codes the Statistics filter menu should offer — limited to plants
 *  that actually have at least one operational asset in scope. */
export const computeAvailablePlantCodes = (operationalItems: any[]): string[] => {
    const set = new Set<string>()
    operationalItems.forEach((item) => {
        const code = upperCode(item.assignedPlant)
        if (code) set.add(code)
    })
    return [...set].sort()
}

/** Operational set — most KPIs read this so retired assets don't dilute
 *  fleet health. */
export const filterOperational = (scopedItems: any[]): any[] =>
    scopedItems.filter((item) => !RETIRED_STATUSES.includes(item.status))

/** Retired set — surfaced explicitly for "fleet aging" purposes. */
export const filterRetired = (scopedItems: any[]): any[] =>
    scopedItems.filter((item) => RETIRED_STATUSES.includes(item.status))
