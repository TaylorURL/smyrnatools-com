/**
 * Statistics primitives shared by every asset type — mixers, tractors,
 * equipment, trailers, and pickup trucks. Covers the date and bucket helpers the
 * histograms are built from, the display resolvers that turn a raw row into
 * something a chart or table can label, the plant/status/service tallies, and
 * fleet ordering.
 *
 * Nothing here knows which asset type it is looking at: type-specific rules
 * arrive as arguments (field names, thresholds, asset config), which is what
 * lets one implementation back all of them.
 */

export const MILLIS_PER_DAY = 1000 * 60 * 60 * 24

export const RETIRED_STATUSES = ['Retired', 'Terminated']

const STATUS_PRIORITY: Record<string, number> = {
    Active: 0,
    Stationary: 1,
    Spare: 2,
    'In Shop': 3,
    Retired: 4,
    Sold: 5
}

const VALID_STATUSES = ['Active', 'Spare', 'In Shop', 'Retired']

/** Display labels for the shop sub-states, keyed by the value stored on the
 *  asset's `shopStatus` column. */
export const SHOP_SUB_LABELS: Record<string, string> = {
    down_in_yard: 'Down In Yard',
    in_shop: 'In Shop',
    ready_for_pickup: 'Ready For Pickup',
    third_party: 'Third Party Work',
    waiting_for_shop: 'Waiting For Shop'
}

/** Ordered bucket labels for the fleet-wide status-tenure histogram. */
export const TENURE_BUCKET_ORDER = ['0–7d', '8–30d', '31–90d', '91–180d', '181–365d', '> 1 year']

/** Ordered bucket labels for the asset-age histogram. Bins widen with age,
 *  matching how much a year of wear matters at each end of the fleet. */
export const AGE_BUCKET_ORDER = ['0–2 yr', '3–5 yr', '6–10 yr', '11–15 yr', '16–20 yr', '> 20 yr']

interface DisplayStatusItem {
    shopStatus?: string | null
    status?: string | null
}

interface YearItem {
    year?: number | string | null
}

interface AssetIdentifierConfig {
    primaryField?: string
}

interface AssetIdentifierItem {
    [key: string]: unknown
    truckNumber?: string | number | null
    tractorNumber?: string | number | null
    trailerNumber?: string | number | null
    equipmentNumber?: string | number | null
    pickupTruckNumber?: string | number | null
    vehicleNumber?: string | number | null
    identifyingNumber?: string | number | null
    vinNumber?: string | null
    vin?: string | null
}

interface NamedOperator {
    employeeId?: string | null
    name?: string | null
}

interface NamedPlant {
    plantCode?: string | null
    code?: string | null
    name?: string | null
}

/** Days between an ISO timestamp and "now"; null when the date is missing
 *  or unparsable. Used for status-tenure, service-age, and verification-age
 *  derivations across every statistics section. */
export const daysSince = (iso: string | null | undefined): number | null => {
    if (!iso) return null
    const time = new Date(iso).getTime()
    if (!Number.isFinite(time)) return null
    return Math.max(0, Math.floor((Date.now() - time) / MILLIS_PER_DAY))
}

/** Build the bucket key for a status-tenure histogram. Tighter buckets at
 *  the front (where most of the fleet lives) and a long tail bucket so
 *  ancient assets don't blow up the chart. */
export const tenureBucket = (days: number | null | undefined): string | null => {
    if (days == null) return null
    if (days <= 7) return '0–7d'
    if (days <= 30) return '8–30d'
    if (days <= 90) return '31–90d'
    if (days <= 180) return '91–180d'
    if (days <= 365) return '181–365d'
    return '> 1 year'
}

/** Age bucket for a model year, per `AGE_BUCKET_ORDER`. Null for a missing or
 *  unparsable year and for any year before 1980, which callers fold into an
 *  "Unknown" bucket rather than charting. */
export const ageBucket = (year: number | string | null | undefined, currentYear: number): string | null => {
    const numeric = Number(year)
    if (!Number.isFinite(numeric) || numeric < 1980) return null
    const age = currentYear - numeric
    if (age <= 2) return '0–2 yr'
    if (age <= 5) return '3–5 yr'
    if (age <= 10) return '6–10 yr'
    if (age <= 15) return '11–15 yr'
    if (age <= 20) return '16–20 yr'
    return '> 20 yr'
}

/** Display label for the asset's current status — flattens In-Shop sub
 *  statuses into the same surface the list view shows. */
export const displayStatus = (item: DisplayStatusItem): string => {
    const status = String(item.status || 'Unknown')
    if (status !== 'In Shop') return status
    return SHOP_SUB_LABELS[item.shopStatus || ''] || 'In Shop'
}

/** Pull a comparable year value from an item; tolerates string years. */
export const itemYear = (item: YearItem): number | null => {
    const numeric = Number(item.year)
    return Number.isFinite(numeric) ? numeric : null
}

/** Identifier shown in statistics tables. The asset config's declared primary
 *  field wins (truckNumber for mixers, `assigned` for pickup trucks,
 *  identifyingNumber for equipment); otherwise the known asset-number fields are
 *  tried in turn, then the last six of the VIN, then an em dash.
 *
 *  Only fields a person would recognize on the yard are eligible — never the
 *  row's UUID — so an unidentifiable asset reads as blank rather than as a
 *  number nobody can act on. */
export const itemDisplayId = (
    item: AssetIdentifierItem | null | undefined,
    config: AssetIdentifierConfig | null | undefined
): string => {
    if (config?.primaryField && item?.[config.primaryField]) return String(item[config.primaryField])
    const numericField =
        item?.truckNumber ||
        item?.tractorNumber ||
        item?.trailerNumber ||
        item?.equipmentNumber ||
        item?.pickupTruckNumber ||
        item?.vehicleNumber ||
        item?.identifyingNumber
    if (numericField) return String(numericField)
    const vin = item?.vinNumber || item?.vin
    if (vin && String(vin).length >= 6) return `VIN ${String(vin).slice(-6)}`
    return '—'
}

/** Operator display names keyed by employeeId — the id an asset's
 *  `assignedOperator` holds. Operators without an employeeId are skipped, and a
 *  nameless operator falls back to its id so a lookup never resolves to an
 *  empty label. */
export const operatorNameLookup = (operators: NamedOperator[] | null | undefined): Map<string, string> => {
    const map = new Map<string, string>()
    operators?.forEach((op) => {
        if (op?.employeeId) map.set(op.employeeId, op.name || op.employeeId)
    })
    return map
}

/** Plant display names keyed by uppercased, trimmed plant code — the same
 *  normalization the per-plant rollups group by. */
export const plantNameLookup = (plants: NamedPlant[] | null | undefined): Map<string, string> => {
    const map = new Map<string, string>()
    plants?.forEach((p) => {
        const code = p?.plantCode || p?.code
        if (code) map.set(String(code).trim().toUpperCase(), p?.name || code)
    })
    return map
}

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
 * True when `serviceDate` is more than `thresholdDays` in the past. A missing
 * date is never overdue — an asset that has never been serviced is a data gap,
 * not a maintenance breach.
 *
 * The interval belongs to the caller: mixers, tractors, and equipment run on the
 * 180-day default, while trailer service and mixer chip checks pass 90. A call
 * site that forgets the argument silently gets the slower rule, so the shorter
 * intervals must be spelled out at every one of them.
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
 * Counts items whose service date is past the threshold, reading the date from
 * whichever field is named so chip dates can be counted the same way.
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
 * Counts items per status, reporting only Active, In Shop, Retired, and Spare;
 * any other status is counted in none of them.
 *
 * `Total` deliberately disagrees with the sum of those buckets: it excludes
 * retired and terminated assets so fleet headlines and every rate derived from
 * them describe the operational fleet, while the Retired bucket stays available
 * for views that want it.
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

/** Trailer-specific counts by trailer type. Retired and terminated trailers are
 *  dropped before counting, so `Total` and both type buckets describe the
 *  operational fleet the way `getStatusCounts` does. */
function getTrailerStatusCounts(trailers: TrailerRow[]): Record<string, number> {
    if (!Array.isArray(trailers)) return {}
    const operational = trailers.filter((t) => !RETIRED_STATUSES.includes(t?.status as string))
    const counts: Record<string, number> = { Total: operational.length }
    ;(['Cement', 'End Dump'] as const).forEach((type) => {
        counts[type] = operational.filter((t) => t.trailerType === type).length
    })
    return counts
}

/**
 * Trailer verification, which expires weekly: a trailer counts as verified only
 * while the verification is the newest thing that happened to it and was made
 * during the current week, which starts Sunday at local midnight.
 *
 * Any edit or history entry after the verification invalidates it, so a trailer
 * changed after being checked has to be checked again.
 */
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
