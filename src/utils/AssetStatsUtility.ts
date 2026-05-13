/**
 * Shared asset statistics logic used across Mixer, Tractor, Equipment, and Trailer utilities.
 * Consolidates service-overdue checks, plant/status distribution counts,
 * service-needed tallies, fleet sorting, and operator-assignment helpers.
 */

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24

const RETIRED_STATUSES = ['Retired', 'Terminated']

const STATUS_PRIORITY: Record<string, number> = {
    Active: 0,
    Stationary: 1,
    Spare: 2,
    'In Shop': 3,
    Retired: 4,
    Sold: 5
}

const VALID_STATUSES = ['Active', 'Spare', 'In Shop', 'Retired']

interface AssetRow {
    [key: string]: unknown
}

interface OperatorRow {
    name?: string
    plantCode?: string
    position?: string
    smyrnaId?: string
    status?: string
    [key: string]: unknown
}

interface TrailerRow {
    status?: string
    trailerType?: string
}

interface UnassignedOperatorOptions {
    assignedOperatorField?: string
    assignedPlantField?: string
    operatorIdField?: string
    position?: string
    regionPlantCodes?: Set<string> | null
    selectedPlant?: string | null
}

interface ScopeOptions {
    position?: string
    regionPlantCodes?: Set<string> | null
    selectedPlant?: string | null
}

/**
 * Compares two items by status priority, then by numeric portion of a number field.
 * Status order: Active -> Stationary -> Spare -> In Shop -> Retired -> Sold.
 */
function compareByStatusThenNumber(
    a: AssetRow,
    b: AssetRow,
    statusField = 'status',
    numberField = 'truckNumber'
): number {
    const statusA = STATUS_PRIORITY[a?.[statusField] as string] ?? 99
    const statusB = STATUS_PRIORITY[b?.[statusField] as string] ?? 99
    if (statusA !== statusB) return statusA - statusB

    const extractedNumberA = parseInt(String(a?.[numberField] ?? '').replace(/\D/g, '') || '0')
    const extractedNumberB = parseInt(String(b?.[numberField] ?? '').replace(/\D/g, '') || '0')
    if (!isNaN(extractedNumberA) && !isNaN(extractedNumberB)) return extractedNumberA - extractedNumberB

    return String(a?.[numberField] ?? '').localeCompare(String(b?.[numberField] ?? ''))
}

/**
 * Counts active operators not assigned to any active item, with optional
 * search text, position, plant, and region filtering.
 */
function countUnassignedActiveOperators(
    items: AssetRow[],
    operators: OperatorRow[],
    searchText: string | null | undefined,
    {
        position,
        selectedPlant,
        regionPlantCodes,
        operatorIdField = 'employeeId',
        assignedOperatorField = 'assignedOperator',
        assignedPlantField = 'assignedPlant'
    }: UnassignedOperatorOptions
): number {
    const normalizedSearch = String(searchText || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')

    const filteredOperators = (operators || []).filter((op) => {
        if (op?.status !== 'Active') return false
        if (position && op?.position !== position) return false
        if (selectedPlant && op?.plantCode !== selectedPlant) return false
        if (regionPlantCodes && !regionPlantCodes.has(op?.plantCode as string)) return false
        if (!normalizedSearch) return true

        const nameCollapsed = String(op?.name || '')
            .toLowerCase()
            .replace(/\s+/g, '')
        const smyrnaId = String(op?.smyrnaId || '').toLowerCase()
        return nameCollapsed.includes(normalizedSearch) || smyrnaId.includes(normalizedSearch)
    })

    const activeItems = (items || []).filter(
        (it) =>
            it?.status === 'Active' &&
            (!selectedPlant || selectedPlant === 'All' || it?.[assignedPlantField] === selectedPlant) &&
            (!regionPlantCodes || regionPlantCodes.has(it?.[assignedPlantField] as string))
    )

    return filteredOperators.filter(
        (op) => !activeItems.some((it) => it?.[assignedOperatorField] === op?.[operatorIdField])
    ).length
}

/**
 * Counts total active operators in scope (by position, plant, and region).
 * Used alongside countUnassignedActiveOperators to derive assigned count.
 */
function countActiveOperatorsInScope(
    operators: OperatorRow[],
    { position, selectedPlant, regionPlantCodes }: ScopeOptions
): number {
    return (operators || []).filter((op) => {
        if (op?.status !== 'Active') return false
        if (position && op?.position !== position) return false
        if (selectedPlant && selectedPlant !== 'All' && op?.plantCode !== selectedPlant) return false
        if (regionPlantCodes && regionPlantCodes.size > 0 && !regionPlantCodes.has(op?.plantCode as string))
            return false
        return true
    }).length
}

/**
 * Returns true if a date exceeds the given day threshold from today.
 * Mixer/Tractor/Equipment default to 180 days; Trailer uses 90; Chip checks use 90.
 */
function isServiceOverdue(serviceDate: string | null | undefined, thresholdDays = 180): boolean {
    if (!serviceDate) return false
    try {
        const daysSinceService = Math.ceil((new Date().getTime() - new Date(serviceDate).getTime()) / MILLIS_PER_DAY)
        return daysSinceService > thresholdDays
    } catch {
        return false
    }
}

/**
 * Returns the number of items whose service date exceeds the threshold.
 * Defaults to 180 days (override to 90 for trailers).
 */
function getNeedServiceCount(items: AssetRow[], serviceDateField = 'lastServiceDate', thresholdDays = 180): number {
    if (!Array.isArray(items)) return 0
    return items.filter((item) => isServiceOverdue(item[serviceDateField] as string | null, thresholdDays)).length
}

/**
 * Counts items grouped by plant assignment.
 * Items without a plant are bucketed under 'Unassigned'.
 */
function getPlantCounts(items: AssetRow[], plantField = 'assignedPlant'): Record<string, number> {
    if (!Array.isArray(items)) return {}
    return items.reduce<Record<string, number>>((counts, item) => {
        const plant = (item[plantField] as string) || 'Unassigned'
        counts[plant] = (counts[plant] || 0) + 1
        return counts
    }, {})
}

/**
 * Counts items grouped by status (Active, In Shop, Retired, Spare).
 * `Total` excludes Retired / Terminated so fleet headlines reflect
 * the operational asset count, not historical artifacts. The Retired
 * bucket is still surfaced separately for views that want it.
 */
function getStatusCounts(items: AssetRow[], statusField = 'status'): Record<string, number> {
    if (!Array.isArray(items)) return {}
    const operationalItems = items.filter((item) => !RETIRED_STATUSES.includes(item?.[statusField] as string))
    const counts: Record<string, number> = {
        Active: 0,
        'In Shop': 0,
        Retired: 0,
        Spare: 0,
        Total: operationalItems.length
    }
    items.forEach((item) => {
        const status = (item[statusField] as string) || 'Unknown'
        if (VALID_STATUSES.includes(status)) counts[status]++
    })
    return counts
}

/** Trailer-specific: counts by trailer type (Cement / End Dump).
 *  `Total` excludes retired/terminated trailers so fleet KPIs read
 *  the same way the mixer/tractor counts do. */
function getTrailerStatusCounts(trailers: TrailerRow[]): Record<string, number> {
    if (!Array.isArray(trailers)) return {}
    const operational = trailers.filter((t) => !RETIRED_STATUSES.includes(t?.status as string))
    const counts: Record<string, number> = { Total: operational.length }
    ;(['Cement', 'End Dump'] as const).forEach((type) => {
        counts[type] = operational.filter((t) => t.trailerType === type).length
    })
    return counts
}

/** Trailer-specific: weekly verification with history-aware staleness */
function isTrailerVerified(
    updatedLast: string | null | undefined,
    updatedAt: string,
    updatedBy: string | null | undefined,
    latestHistoryDate: string | null = null
): boolean {
    if (!updatedLast || !updatedBy) return false

    const lastVerification = new Date(updatedLast)
    const lastUpdate = new Date(updatedAt)
    const lastHistory = latestHistoryDate ? new Date(latestHistoryDate) : null
    const now = new Date()
    const lastSunday = new Date(now)
    lastSunday.setDate(now.getDate() - now.getDay())
    lastSunday.setHours(0, 0, 0, 0)

    if (lastHistory && lastHistory > lastVerification) return false
    return lastUpdate <= lastVerification && lastVerification >= lastSunday
}

/**
 * Sorts items with retired/terminated entries pushed to the end,
 * applying an optional sort function to each partition independently.
 */
function sortWithRetiredLast<T extends AssetRow>(
    items: T[],
    sortFn?: ((a: T, b: T) => number) | null,
    statusField = 'status'
): T[] {
    if (!items?.length) return items

    const activeItems = items.filter((item) => !RETIRED_STATUSES.includes(item?.[statusField] as string))
    const retiredItems = items.filter((item) => RETIRED_STATUSES.includes(item?.[statusField] as string))

    return [
        ...(sortFn ? activeItems.sort(sortFn) : activeItems),
        ...(sortFn ? retiredItems.sort(sortFn) : retiredItems)
    ]
}

const AssetStatsUtility = {
    compareByStatusThenNumber,
    countActiveOperatorsInScope,
    countUnassignedActiveOperators,
    getNeedServiceCount,
    getPlantCounts,
    getStatusCounts,
    getTrailerStatusCounts,
    isServiceOverdue,
    isTrailerVerified,
    sortWithRetiredLast
}

export default AssetStatsUtility
