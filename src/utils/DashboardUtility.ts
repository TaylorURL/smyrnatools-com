/**
 * Computation behind the plant dashboard: the slim asset mappers, the
 * status-distribution reconstruction, the plant AI summary cache, long-term shop
 * detection, and the plant-set filtering the whole page scopes by.
 *
 * The slim mappers exist because the dashboard holds every asset of every type
 * in memory and mirrors them into session storage. They keep only the fields the
 * dashboard reads and, in doing so, absorb the camelCase/snake_case split in the
 * incoming rows, so nothing downstream has to check both spellings.
 */

interface BaseAsset {
    assignedPlant?: string
    createdAt?: string
    created_at?: string
    id: string
    plantCode?: string
    status?: string
    truck_number?: string
    truckNumber?: string
    [key: string]: unknown
}

interface VehicleAsset extends BaseAsset {
    assignedOperator?: string
    lastServiceDate?: string
    truckNumber?: string
    updatedAt?: string
    updatedBy?: string
    updatedLast?: string
    vin?: string
}

interface MixerAsset extends VehicleAsset {
    cleanliness_rating?: number
    cleanlinessRating?: number
    down_in_yard?: boolean
    downInYard?: boolean
}

interface TractorAsset extends VehicleAsset {
    freight?: string
}

interface TrailerAsset extends BaseAsset {
    asset_number?: string
    lastServiceDate?: string
    trailerNumber?: string
    trailerType?: string
    trailer_number?: string
    trailer_type?: string
}

interface EquipmentAsset extends BaseAsset {
    asset_number?: string
    identifyingNumber?: string
    identifying_number?: string
    lastServiceDate?: string
}

interface OperatorRecord {
    employeeId?: string
    id: string
    plantCode?: string
    position?: string
    status?: string
}

interface HistoryRecord {
    asset_id?: string
    changed_at: string
    equipment_id?: string
    field_name?: string
    mixer_id?: string
    new_value?: string
    old_value?: string
    tractor_id?: string
    trailer_id?: string
    truck_id?: string
    [key: string]: unknown
}

interface StatusDistributionEntry {
    days: number
    percentage: string
    status: string
}

interface ShopAssetResult {
    daysInShop: number
    downInYard: boolean
    enteredShop: string
    id: string
    identifier: string
    plantCode: string | undefined
    type: string
}

interface PlantRecord {
    plantCode?: string
    plant_code?: string
}

interface RegionRecord {
    type?: string
}

interface AICacheEntry {
    summary: string
    timestamp: number
}

const AI_CACHE_KEY = 'srm_plant_ai_summaries'
const AI_CACHE_DURATION = 24 * 60 * 60 * 1000
const SERVICE_OVERDUE_DAYS = 180
const MS_PER_DAY = 86400000

const resolvePlantCode = (asset: BaseAsset): string | undefined => asset.assignedPlant || asset.plantCode
const resolveTruckNumber = (asset: BaseAsset): string => asset.truckNumber || asset.truck_number || ''

const BASE_ASSET_FIELDS = (asset: BaseAsset) => ({
    id: asset.id,
    plantCode: resolvePlantCode(asset),
    status: asset.status
})

const VEHICLE_FIELDS = (asset: VehicleAsset) => ({
    assignedOperator: asset.assignedOperator,
    assignedPlant: resolvePlantCode(asset),
    lastServiceDate: asset.lastServiceDate,
    truckNumber: resolveTruckNumber(asset),
    updatedAt: asset.updatedAt,
    updatedBy: asset.updatedBy,
    updatedLast: asset.updatedLast,
    vin: asset.vin || ''
})

const slimMixer = (asset: MixerAsset) => ({
    ...BASE_ASSET_FIELDS(asset),
    ...VEHICLE_FIELDS(asset),
    cleanlinessRating: asset.cleanlinessRating || asset.cleanliness_rating || 0,
    downInYard: asset.downInYard || asset.down_in_yard || false
})

const slimTractor = (asset: TractorAsset) => ({
    ...BASE_ASSET_FIELDS(asset),
    ...VEHICLE_FIELDS(asset),
    freight: asset.freight || ''
})

const slimTrailer = (asset: TrailerAsset) => ({
    ...BASE_ASSET_FIELDS(asset),
    assignedPlant: resolvePlantCode(asset),
    identifyingNumber: asset.trailerNumber || asset.trailer_number || asset.truck_number || asset.asset_number || '',
    lastServiceDate: asset.lastServiceDate,
    trailerType: asset.trailerType || asset.trailer_type || 'Cement'
})

const slimEquipment = (asset: EquipmentAsset) => ({
    ...BASE_ASSET_FIELDS(asset),
    assignedPlant: resolvePlantCode(asset),
    identifyingNumber:
        asset.identifyingNumber || asset.identifying_number || asset.asset_number || asset.truck_number || '',
    lastServiceDate: asset.lastServiceDate
})

const slimPickup = (asset: BaseAsset) => ({
    ...BASE_ASSET_FIELDS(asset)
})

const slimOperator = (operator: OperatorRecord) => ({
    employeeId: operator.employeeId,
    id: operator.id,
    plantCode: operator.plantCode,
    position: operator.position,
    status: operator.status
})

/** Turns a `YYYY-MM-DD` filter value into a UTC instant at either end of that
 *  day. Building it from the parts rather than parsing the string keeps the
 *  boundary on the day the user picked instead of shifting it by the viewer's
 *  offset. */
const normalizeDate = (dateStr: string | null | undefined, endOfDay = false): Date | null => {
    if (!dateStr) return null
    const parts = dateStr.split('-')
    if (parts.length !== 3) return null
    if (endOfDay) {
        return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999))
    }
    return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0))
}

// Each asset type's history table names its foreign key after itself, and the
// dashboard pools history from all of them, so a row is matched to its asset by
// trying every one of these columns.
const ASSET_ID_FIELDS = ['mixer_id', 'tractor_id', 'trailer_id', 'equipment_id', 'truck_id'] as const

const daysBetween = (start: Date, end: Date): number => Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)

const getAssetStatusHistory = (historyRecords: HistoryRecord[], assetId: string): HistoryRecord[] =>
    historyRecords
        .filter((h) => ASSET_ID_FIELDS.some((field) => h[field] === assetId) && h.field_name === 'status')
        .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())

/** The status an asset held at `cutoffDate`, given its status history sorted
 *  oldest first. The newest change at or before the cutoff decides it; if the
 *  cutoff predates all recorded changes, the earliest change's `old_value`
 *  describes the state before it. */
const resolveStatusAtDate = (sortedHistory: HistoryRecord[], cutoffDate: Date, fallbackStatus: string): string => {
    if (!sortedHistory.length) return fallbackStatus
    const recordsBefore = sortedHistory.filter((h) => new Date(h.changed_at) <= cutoffDate)
    if (recordsBefore.length) return recordsBefore[recordsBefore.length - 1].new_value || fallbackStatus
    return sortedHistory[0].old_value || fallbackStatus
}

const findEarliestDate = (dates: (Date | null)[]): Date | null =>
    dates.filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null

const accumulateStatusDays = (statusDaysMap: Record<string, number>, status: string, days: number): number => {
    statusDaysMap[status] = (statusDaysMap[status] || 0) + days
    return days
}

/**
 * How the fleet's time was spent across a window, as asset-days per status.
 *
 * This is not a snapshot count: each asset's status history is replayed to
 * accumulate the days it actually held each status inside the window, so a truck
 * that spent a fortnight in the shop weighs that much more than one that passed
 * through for a day. An asset with no changes in the window contributes its
 * whole span to whatever status it held entering it, floored at one day so it is
 * never invisible.
 *
 * Each asset's contribution starts at the latest of the window start, its
 * creation, and its first history entry, so no time is attributed before the
 * data can support a claim about it. Assets that did not yet exist by the window
 * end are skipped, as are assets with no status history at all whenever the
 * window ends in the past — their current status says nothing about where they
 * were then. A window ending before any recorded data yields nothing.
 *
 * Retired days are accumulated but the Retired row is dropped from the result;
 * the percentages that remain are then topped up on the smallest slice so they
 * still total 100.
 */
const calculateStatusDistribution = (
    assets: BaseAsset[],
    historyRecords: HistoryRecord[],
    filterStartDate: string | null = null,
    filterEndDate: string | null = null
): StatusDistributionEntry[] => {
    const statusDaysMap: Record<string, number> = {}
    let totalDays = 0
    const rangeStart = filterStartDate ? normalizeDate(filterStartDate, false) : null
    const rangeEnd = filterEndDate ? normalizeDate(filterEndDate, true) : new Date()
    if (rangeEnd) {
        const earliestHistoryDate = findEarliestDate(
            historyRecords.filter((h) => h.changed_at).map((h) => new Date(h.changed_at))
        )
        const earliestCreationDate = findEarliestDate(
            assets
                .map((a) => a.createdAt || a.created_at)
                .filter(Boolean)
                .map((d) => new Date(d!))
        )
        const earliestDataDate = findEarliestDate([earliestHistoryDate, earliestCreationDate])
        if (earliestDataDate && rangeEnd < earliestDataDate) return []
    }
    for (const asset of assets) {
        const assetHistory = getAssetStatusHistory(historyRecords, asset.id)
        const currentStatus = asset.status || 'Unknown'
        const createdAt = asset.createdAt || asset.created_at
        const assetCreationDate = createdAt ? new Date(createdAt) : null
        if (assetCreationDate && rangeEnd && assetCreationDate > rangeEnd) continue
        const earliestAssetHistory = assetHistory.length > 0 ? new Date(assetHistory[0].changed_at) : null
        if (earliestAssetHistory && rangeEnd && earliestAssetHistory > rangeEnd) continue
        if (!earliestAssetHistory && rangeEnd && rangeEnd < new Date()) continue
        let effectiveStart = rangeStart
            ? assetCreationDate && assetCreationDate > rangeStart
                ? assetCreationDate
                : rangeStart
            : assetCreationDate || new Date()
        if (earliestAssetHistory && effectiveStart < earliestAssetHistory) {
            effectiveStart = earliestAssetHistory
        }
        if (effectiveStart > rangeEnd!) continue
        const startingStatus =
            rangeStart && assetHistory.length
                ? resolveStatusAtDate(assetHistory, rangeStart, currentStatus)
                : currentStatus
        const endingStatus =
            rangeEnd && assetHistory.length ? resolveStatusAtDate(assetHistory, rangeEnd, currentStatus) : currentStatus
        const recordsInRange =
            rangeStart && rangeEnd
                ? assetHistory.filter((h) => {
                      const changedAt = new Date(h.changed_at)
                      return changedAt > rangeStart && changedAt <= rangeEnd
                  })
                : assetHistory
        if (recordsInRange.length === 0) {
            totalDays += accumulateStatusDays(
                statusDaysMap,
                startingStatus,
                Math.max(1, daysBetween(effectiveStart, rangeEnd!))
            )
        } else {
            let previousStatus = startingStatus
            let previousDate = effectiveStart
            for (const entry of recordsInRange) {
                const changeDate = new Date(entry.changed_at)
                const days = daysBetween(previousDate, changeDate)
                if (days > 0) totalDays += accumulateStatusDays(statusDaysMap, previousStatus, days)
                previousStatus = entry.new_value || endingStatus
                previousDate = changeDate
            }
            const finalDays = daysBetween(previousDate, rangeEnd!)
            if (finalDays > 0) totalDays += accumulateStatusDays(statusDaysMap, previousStatus, finalDays)
        }
    }
    if (totalDays === 0) totalDays = 1
    const entries = Object.entries(statusDaysMap)
        .filter(([status]) => status !== 'Retired')
        .map(([status, days]) => ({
            days,
            percentage: ((days / totalDays) * 100).toFixed(1),
            status
        }))
        .sort((a, b) => b.days - a.days)
    if (entries.length > 0) {
        const sum = entries.reduce((acc, item) => acc + parseFloat(item.percentage), 0)
        if (sum < 100) {
            const lastEntry = entries[entries.length - 1]
            lastEntry.percentage = (parseFloat(lastEntry.percentage) + (100 - sum)).toFixed(1)
        }
    }
    return entries
}

// Generated plant summaries are cached in localStorage for a day and keyed by
// plant, so revisiting a plant does not pay for another generation. Every entry
// point tolerates unreadable or malformed storage by behaving as a cache miss.
const getAISummaryFromCache = (plantCode: string): string | null => {
    try {
        const cached = localStorage.getItem(AI_CACHE_KEY)
        if (!cached) return null
        const cacheData: Record<string, AICacheEntry> = JSON.parse(cached)
        const plantCache = cacheData[plantCode]
        if (!plantCache) return null
        if (Date.now() - plantCache.timestamp > AI_CACHE_DURATION) {
            return null
        }
        return plantCache.summary
    } catch (error) {
        console.error('Failed to read AI summary from localStorage cache:', error)
        return null
    }
}

const setAISummaryToCache = (plantCode: string, summary: string): void => {
    try {
        const cached = localStorage.getItem(AI_CACHE_KEY)
        const cacheData: Record<string, AICacheEntry> = cached ? JSON.parse(cached) : {}
        cacheData[plantCode] = {
            summary,
            timestamp: Date.now()
        }
        localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cacheData))
    } catch (error) {
        console.error('Failed to write AI summary to localStorage cache:', error)
    }
}

/** Drops one plant's cached summary, or every plant's when no code is given. */
const clearAISummaryCache = (plantCode: string | null = null): void => {
    try {
        if (plantCode) {
            const cached = localStorage.getItem(AI_CACHE_KEY)
            if (cached) {
                const cacheData: Record<string, AICacheEntry> = JSON.parse(cached)
                delete cacheData[plantCode]
                localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cacheData))
            }
        } else {
            localStorage.removeItem(AI_CACHE_KEY)
        }
    } catch (error) {
        console.error('Failed to clear AI summary localStorage cache:', error)
    }
}

interface ShopAsset extends BaseAsset {
    downInYard?: boolean
    updatedAt?: string
}

interface ShopHistory {
    asset_id: string
    changed_at: string
    new_value?: string
}

/** In-shop assets that have been there longer than `daysThreshold`, for the
 *  dashboard's attention list. Entry into the shop is taken from the newest
 *  history row that moved the asset to In Shop; without one, the asset's last
 *  update stands in, which is the closest evidence available. Assets whose entry
 *  date cannot be established at all are excluded rather than assumed old. */
const getLongTermShopAssets = (
    assets: ShopAsset[],
    history: ShopHistory[],
    type: string,
    identifierField: string,
    considerFn: (plantCode: string | undefined) => boolean,
    daysThreshold = 6
): ShopAssetResult[] => {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)
    return assets
        .filter((a) => a.status === 'In Shop' && considerFn(a.plantCode))
        .map((asset) => {
            const latestShopEntry = history
                .filter((h) => h.asset_id === asset.id && h.new_value === 'In Shop')
                .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())[0]
            const shopEntryDate = latestShopEntry
                ? new Date(latestShopEntry.changed_at)
                : asset.updatedAt
                  ? new Date(asset.updatedAt)
                  : null
            if (!shopEntryDate || shopEntryDate > thresholdDate) return null
            return {
                daysInShop: Math.floor((Date.now() - shopEntryDate.getTime()) / MS_PER_DAY),
                downInYard: asset.downInYard || false,
                enteredShop: shopEntryDate.toISOString(),
                id: asset.id,
                identifier: (asset[identifierField] as string) || 'Unknown',
                plantCode: asset.plantCode,
                type
            }
        })
        .filter(Boolean) as ShopAssetResult[]
}

const extractPlantCode = (plant: PlantRecord): string | undefined => plant.plantCode || plant.plant_code

const addPlantCodesToSet = (plants: PlantRecord[], plantSet: Set<string>): void => {
    for (const plant of plants) {
        const code = extractPlantCode(plant)
        if (code) plantSet.add(String(code).trim())
    }
}

/** The plant codes the dashboard is currently looking at, in precedence order:
 *  an Office region sees every plant, otherwise an explicitly chosen plant wins,
 *  and failing both the user's region defines the set. */
const buildPlantSet = (
    region: RegionRecord | null | undefined,
    allPlants: PlantRecord[],
    regionPlants: PlantRecord[],
    dashboardPlant: string | null | undefined
): Set<string> => {
    const plantSet = new Set<string>()
    if (region?.type === 'Office') {
        addPlantCodesToSet(allPlants, plantSet)
    } else if (dashboardPlant) {
        plantSet.add(String(dashboardPlant).trim())
    } else {
        addPlantCodesToSet(regionPlants || [], plantSet)
    }
    return plantSet
}

/** Membership test for a plant set, where an empty set means "not scoped" and
 *  admits everything rather than excluding everything. */
const createConsiderFn = (plantSet: Set<string>): ((plantCode: string | undefined) => boolean) =>
    plantSet.size > 0 ? (plantCode) => plantSet.has(String(plantCode || '').trim()) : () => true

const formatDateForDisplay = (dateValue: string | Date | null | undefined): string => {
    if (!dateValue) return ''
    if (typeof dateValue === 'string' && dateValue.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateValue))
        return dateValue
    try {
        return new Date(dateValue).toISOString().slice(0, 10)
    } catch {
        return String(dateValue)
    }
}

const DashboardUtility = {
    AI_CACHE_DURATION,
    AI_CACHE_KEY,
    SERVICE_OVERDUE_DAYS,
    buildPlantSet,
    calculateStatusDistribution,
    clearAISummaryCache,
    createConsiderFn,
    formatDateForDisplay,
    getAISummaryFromCache,
    getLongTermShopAssets,
    normalizeDate,
    setAISummaryToCache,
    slimEquipment,
    slimMixer,
    slimOperator,
    slimPickup,
    slimTractor,
    slimTrailer
}
export default DashboardUtility
