import { useMemo } from 'react'

import AssetStatsUtility from '../../utils/AssetStatsUtility'

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24
const RETIRED_STATUSES = ['Retired', 'Terminated']
const SHOP_SUB_LABELS = {
    down_in_yard: 'Down In Yard',
    in_shop: 'In Shop',
    ready_for_pickup: 'Ready For Pickup',
    third_party: 'Third Party Work',
    waiting_for_shop: 'Waiting For Shop'
}

/** Days between an ISO timestamp and "now"; null when the date is missing
 *  or unparsable. Used for status-tenure, service-age, and verification-age
 *  derivations across every statistics section. */
const daysSince = (iso) => {
    if (!iso) return null
    const time = new Date(iso).getTime()
    if (!Number.isFinite(time)) return null
    return Math.max(0, Math.floor((Date.now() - time) / MILLIS_PER_DAY))
}

/** Build the bucket key for a status-tenure histogram. Tighter buckets at
 *  the front (where most of the fleet lives) and a long tail bucket so
 *  ancient assets don't blow up the chart. */
const tenureBucket = (days) => {
    if (days == null) return null
    if (days <= 7) return '0–7d'
    if (days <= 30) return '8–30d'
    if (days <= 90) return '31–90d'
    if (days <= 180) return '91–180d'
    if (days <= 365) return '181–365d'
    return '> 1 year'
}

const TENURE_BUCKET_ORDER = ['0–7d', '8–30d', '31–90d', '91–180d', '181–365d', '> 1 year']

/** Year-bucket histogram for the Aging page. Bins by 2-year span so a fleet
 *  with sparse single years still shows usable bars. */
const ageBucket = (year, currentYear) => {
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

const AGE_BUCKET_ORDER = ['0–2 yr', '3–5 yr', '6–10 yr', '11–15 yr', '16–20 yr', '> 20 yr']

/** Display label for the asset's current status — flattens In-Shop sub
 *  statuses into the same surface the list view shows. */
const displayStatus = (item) => {
    const status = String(item.status || 'Unknown')
    if (status !== 'In Shop') return status
    return SHOP_SUB_LABELS[item.shopStatus] || 'In Shop'
}

/** Pull a comparable year value from an item; tolerates string years. */
const itemYear = (item) => {
    const numeric = Number(item.year)
    return Number.isFinite(numeric) ? numeric : null
}

/** Identifier shown in tables — honors the config's declared primary field
 *  first (e.g. truckNumber for mixers, `assigned` for pickup trucks), then
 *  falls back through known asset number fields. Strictly avoids leaking
 *  raw UUIDs (`item.id`) or unrelated text fields (`item.name`, which
 *  doesn't exist on assets) into the identifier column — when nothing
 *  meaningful is available we surface the VIN tail so the user can still
 *  locate the record. Exported so page-level identifier lookups stay in
 *  lockstep with the hook-built watchlists. */
export const itemDisplayId = (item, config) => {
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

/** Operator name lookup keyed by employeeId; returns "Unassigned" for empty
 *  assignments so the chart never shows a blank slice. */
const operatorNameLookup = (operators) => {
    const map = new Map()
    operators?.forEach((op) => {
        if (op?.employeeId) map.set(op.employeeId, op.name || op.employeeId)
    })
    return map
}

const plantNameLookup = (plants) => {
    const map = new Map()
    plants?.forEach((p) => {
        const code = p?.plantCode || p?.code
        if (code) map.set(String(code).trim().toUpperCase(), p?.name || code)
    })
    return map
}

/**
 * Derives every metric the asset Statistics page renders from the items,
 * operators, and plants already loaded by `useAssetData`. Pure memoization —
 * no fetches, no side effects — so the hook stays cheap and the underlying
 * realtime stream from the list keeps every section live without extra
 * subscriptions.
 *
 * The hook is config-driven so the same code powers mixers, tractors,
 * trailers, equipment, and pickup trucks; per-asset feature flags
 * (cleanliness, service tracking, operator assignment) gate the optional
 * sections cleanly.
 */
export default function useAssetStatistics({
    config,
    dateRange,
    items,
    operators,
    plants,
    regionPlantCodes,
    selectedPlant
}) {
    const plantNames = useMemo(() => plantNameLookup(plants), [plants])
    const operatorNames = useMemo(() => operatorNameLookup(operators), [operators])

    /** Items in scope = items within the current region, narrowed by the
     *  Statistics plant filter (independent of the list-view filter so the
     *  user can hold both views in different states). When a date range is
     *  active, also filter by `updatedAt` (falling back to createdAt) so
     *  the page only sees activity that landed inside the window. */
    const scopedItems = useMemo(() => {
        if (!Array.isArray(items)) return []
        const upper = (v) =>
            String(v || '')
                .trim()
                .toUpperCase()
        const plant = upper(selectedPlant)
        const startTime = dateRange?.start ? new Date(`${dateRange.start}T00:00:00`).getTime() : null
        const endTime = dateRange?.end ? new Date(`${dateRange.end}T23:59:59.999`).getTime() : null
        return items.filter((item) => {
            const itemPlant = upper(item.assignedPlant)
            if (regionPlantCodes && regionPlantCodes.size > 0 && itemPlant && !regionPlantCodes.has(itemPlant)) {
                return false
            }
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
    }, [dateRange?.end, dateRange?.start, items, regionPlantCodes, selectedPlant])

    /** Operational set (excludes Retired/Terminated) — most KPIs read this so
     *  retired assets don't dilute fleet health. The retired bucket is still
     *  surfaced explicitly for "fleet aging" purposes. */
    const operationalItems = useMemo(
        () => scopedItems.filter((item) => !RETIRED_STATUSES.includes(item.status)),
        [scopedItems]
    )

    const retiredItems = useMemo(
        () => scopedItems.filter((item) => RETIRED_STATUSES.includes(item.status)),
        [scopedItems]
    )

    /** Headline KPI surface — every number the KPI strip + Overview launchpad
     *  consume comes from here. Each is O(n) on scopedItems; aggregated in
     *  one pass so the memo runs once per scope change. */
    const summary = useMemo(() => {
        const counts = AssetStatsUtility.getStatusCounts(scopedItems)
        const total = counts.Total || 0
        let verified = 0
        let unverified = 0
        let overdueService = 0
        let overdueChip = 0
        let openIssues = 0
        let assetsWithOpenIssues = 0
        let dirtyCount = 0
        let cleanlinessSum = 0
        let cleanlinessSamples = 0
        let unassignedActive = 0
        let yearSum = 0
        let yearSamples = 0
        let hoursSum = 0
        let hoursSamples = 0
        let missingVin = 0
        let missingMake = 0
        let missingModel = 0
        let missingYear = 0
        let assetsMissingAnyField = 0
        let tenureSum = 0
        let tenureSamples = 0

        const hasService = !!config?.verification?.isServiceOverdueFn || config?.key === 'mixer'
        const hasChip = !!config?.verification?.hasLastChipDate
        const hasCleanliness = scopedItems.some((item) => item.cleanlinessRating != null)

        operationalItems.forEach((item) => {
            const verifiedNow = typeof item.isVerified === 'function' ? item.isVerified() : false
            if (verifiedNow) verified += 1
            else unverified += 1

            if (hasService && AssetStatsUtility.isServiceOverdue(item.lastServiceDate)) overdueService += 1
            if (hasChip && AssetStatsUtility.isServiceOverdue(item.lastChipDate, 90)) overdueChip += 1

            const open = Number(item.openIssuesCount || 0)
            if (open > 0) {
                openIssues += open
                assetsWithOpenIssues += 1
            }

            if (item.cleanlinessRating != null) {
                cleanlinessSamples += 1
                cleanlinessSum += Number(item.cleanlinessRating) || 0
                if (Number(item.cleanlinessRating) > 0 && Number(item.cleanlinessRating) < 3) dirtyCount += 1
            }

            if (config?.hasOperatorAssignment && item.status === 'Active' && !item.assignedOperator) {
                unassignedActive += 1
            }

            const year = itemYear(item)
            if (year) {
                yearSum += year
                yearSamples += 1
            }

            if (Number.isFinite(Number(item.hours))) {
                hoursSum += Number(item.hours)
                hoursSamples += 1
            }

            const missingFields = []
            const vin = item.vinNumber || item.vin
            if (!vin) missingFields.push('VIN')
            if (!item.make) missingFields.push('Make')
            if (!item.model) missingFields.push('Model')
            if (!item.year) missingFields.push('Year')
            if (missingFields.length > 0) assetsMissingAnyField += 1
            if (missingFields.includes('VIN')) missingVin += 1
            if (missingFields.includes('Make')) missingMake += 1
            if (missingFields.includes('Model')) missingModel += 1
            if (missingFields.includes('Year')) missingYear += 1

            const tenure = daysSince(item.statusChangedAt || item.createdAt)
            if (tenure != null) {
                tenureSum += tenure
                tenureSamples += 1
            }
        })

        const verifiedRate = total > 0 ? verified / total : null
        const overdueServiceRate = hasService && total > 0 ? overdueService / total : null
        const cleanlinessAvg = cleanlinessSamples > 0 ? cleanlinessSum / cleanlinessSamples : null
        const dirtyRate = hasCleanliness && total > 0 ? dirtyCount / total : null
        const avgFleetYear = yearSamples > 0 ? Math.round(yearSum / yearSamples) : null
        const avgHours = hoursSamples > 0 ? hoursSum / hoursSamples : null
        const avgStatusTenure = tenureSamples > 0 ? Math.round(tenureSum / tenureSamples) : null

        return {
            activeCount: counts.Active || 0,
            assetsMissingAnyField,
            assetsWithOpenIssues,
            avgFleetYear,
            avgHours,
            avgStatusTenure,
            cleanlinessAvg,
            cleanlinessSamples,
            dirtyCount,
            dirtyRate,
            hasChip,
            hasCleanliness,
            hasService,
            missingMake,
            missingModel,
            missingVin,
            missingYear,
            openIssues,
            overdueChip,
            overdueService,
            overdueServiceRate,
            retiredCount: retiredItems.length,
            shopCount: counts['In Shop'] || 0,
            spareCount: counts.Spare || 0,
            total,
            unassignedActive,
            unverified,
            verified,
            verifiedRate
        }
    }, [config, operationalItems, retiredItems, scopedItems])

    /** Status distribution for the Fleet Status page — includes In-Shop
     *  sub-statuses (Down In Yard, Waiting For Shop, etc.) when present so
     *  the breakdown matches how the operations team thinks about the fleet. */
    const statusDistribution = useMemo(() => {
        const totals = new Map()
        operationalItems.forEach((item) => {
            const label = displayStatus(item)
            totals.set(label, (totals.get(label) || 0) + 1)
        })
        const rows = [...totals.entries()].map(([label, count]) => ({ count, label }))
        rows.sort((a, b) => b.count - a.count)
        return rows
    }, [operationalItems])

    /** Per-plant scorecard — every plant the user sees in the list view also
     *  gets its own row here, with active/spare/shop split + operator
     *  coverage. Sorted by total fleet count desc. */
    const perPlant = useMemo(() => {
        const map = new Map()
        operationalItems.forEach((item) => {
            const code =
                String(item.assignedPlant || '')
                    .trim()
                    .toUpperCase() || 'UNASSIGNED'
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
            const verifiedNow = typeof item.isVerified === 'function' ? item.isVerified() : false
            if (verifiedNow) row.verified += 1
            else row.unverified += 1
            if (config?.hasOperatorAssignment && item.status === 'Active' && !item.assignedOperator) {
                row.unassignedActive += 1
            }
            if (summary.hasService && AssetStatsUtility.isServiceOverdue(item.lastServiceDate)) row.overdueService += 1
            row.openIssues += Number(item.openIssuesCount || 0)
        })
        const rows = [...map.values()]
        rows.sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
        return rows
    }, [config, operationalItems, plantNames, summary.hasService])

    /** Tenure histogram for the Fleet Status page — how long the fleet has
     *  been sitting in its current status. Long tails surface "stuck" assets
     *  (mixers in shop for > 90d, spares parked > 180d, etc.). */
    const tenureBuckets = useMemo(() => {
        const map = new Map(TENURE_BUCKET_ORDER.map((label) => [label, 0]))
        operationalItems.forEach((item) => {
            const bucket = tenureBucket(daysSince(item.statusChangedAt || item.createdAt))
            if (bucket) map.set(bucket, (map.get(bucket) || 0) + 1)
        })
        return TENURE_BUCKET_ORDER.map((label) => ({ count: map.get(label) || 0, label }))
    }, [operationalItems])

    /** Longest-tenure watchlist — top 12 assets sitting in their current
     *  status the longest. Acts as a "go look at these" callout for the
     *  fleet manager. */
    const longestInStatus = useMemo(() => {
        const enriched = operationalItems
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
        enriched.sort((a, b) => b.days - a.days)
        return enriched.slice(0, 12)
    }, [config, operationalItems, operatorNames])

    /** Year/age distribution for the Aging page — uses 2-year bins and
     *  bunches assets without a year into a separate "Unknown" bucket so
     *  the histogram isn't misleading. */
    const ageDistribution = useMemo(() => {
        const currentYear = new Date().getFullYear()
        const map = new Map(AGE_BUCKET_ORDER.map((label) => [label, 0]))
        let unknownYear = 0
        operationalItems.forEach((item) => {
            const bucket = ageBucket(item.year, currentYear)
            if (bucket) map.set(bucket, (map.get(bucket) || 0) + 1)
            else unknownYear += 1
        })
        const rows = AGE_BUCKET_ORDER.map((label) => ({ count: map.get(label) || 0, label }))
        if (unknownYear > 0) rows.push({ count: unknownYear, label: 'Unknown' })
        return rows
    }, [operationalItems])

    /** Oldest-asset watchlist — top 12 by year ascending. Skips assets with
     *  no year so the table doesn't lead with rows that are only "old"
     *  because their data is missing. */
    const oldestAssets = useMemo(() => {
        const enriched = operationalItems
            .filter((item) => itemYear(item))
            .map((item) => ({
                age: new Date().getFullYear() - itemYear(item),
                hours: Number.isFinite(Number(item.hours)) ? Number(item.hours) : null,
                id: item.id,
                identifier: itemDisplayId(item, config),
                make: item.make || '—',
                model: item.model || '—',
                plant: item.assignedPlant || '—',
                status: item.status,
                year: itemYear(item)
            }))
        enriched.sort((a, b) => a.year - b.year || (b.hours || 0) - (a.hours || 0))
        return enriched.slice(0, 12)
    }, [config, operationalItems])

    /** Top assets by open-issue count for the Issues page. Skips zero so the
     *  table only shows real problems. Tie-break by status (Active first
     *  since those are the ones holding up production). */
    const topIssueAssets = useMemo(() => {
        const enriched = operationalItems
            .filter((item) => Number(item.openIssuesCount || 0) > 0)
            .map((item) => ({
                id: item.id,
                identifier: itemDisplayId(item, config),
                openIssues: Number(item.openIssuesCount || 0),
                operatorName: operatorNames.get(item.assignedOperator) || null,
                plant: item.assignedPlant || '—',
                status: displayStatus(item)
            }))
        enriched.sort(
            (a, b) => b.openIssues - a.openIssues || Number(a.status !== 'Active') - Number(b.status !== 'Active')
        )
        return enriched.slice(0, 15)
    }, [config, operationalItems, operatorNames])

    /** Cleanliness distribution for assets that carry a rating. 0/null is
     *  filtered out (most non-trailer fleets show 0 when the rater hasn't
     *  yet visited the asset). */
    const cleanlinessDistribution = useMemo(() => {
        const map = new Map([1, 2, 3, 4, 5].map((rating) => [rating, 0]))
        operationalItems.forEach((item) => {
            const rating = Number(item.cleanlinessRating)
            if (rating >= 1 && rating <= 5) map.set(rating, (map.get(rating) || 0) + 1)
        })
        return [1, 2, 3, 4, 5].map((rating) => ({ count: map.get(rating) || 0, rating }))
    }, [operationalItems])

    /** Dirty-fleet watchlist — assets with a rating below 3, sorted lowest
     *  first. Bound to 15 rows for table density. */
    const dirtyAssets = useMemo(() => {
        const enriched = operationalItems
            .filter((item) => Number(item.cleanlinessRating) > 0 && Number(item.cleanlinessRating) < 3)
            .map((item) => ({
                id: item.id,
                identifier: itemDisplayId(item, config),
                operatorName: operatorNames.get(item.assignedOperator) || null,
                plant: item.assignedPlant || '—',
                rating: Number(item.cleanlinessRating),
                status: displayStatus(item)
            }))
        enriched.sort((a, b) => a.rating - b.rating)
        return enriched.slice(0, 15)
    }, [config, operationalItems, operatorNames])

    /** Per-plant cleanliness rollup — average + count of dirty assets so
     *  fleet managers can spot the plants where cleanliness has slipped. */
    const cleanlinessByPlant = useMemo(() => {
        const map = new Map()
        operationalItems.forEach((item) => {
            const rating = Number(item.cleanlinessRating)
            if (!(rating >= 1 && rating <= 5)) return
            const code =
                String(item.assignedPlant || '')
                    .trim()
                    .toUpperCase() || 'UNASSIGNED'
            if (!map.has(code)) {
                map.set(code, {
                    code,
                    dirty: 0,
                    name: plantNames.get(code) || code,
                    samples: 0,
                    sum: 0
                })
            }
            const row = map.get(code)
            row.samples += 1
            row.sum += rating
            if (rating < 3) row.dirty += 1
        })
        const rows = [...map.values()].map((row) => ({
            ...row,
            avg: row.samples > 0 ? row.sum / row.samples : null
        }))
        rows.sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99) || b.dirty - a.dirty)
        return rows
    }, [operationalItems, plantNames])

    /** Service-overdue watchlist — assets with the oldest last-service date
     *  past the threshold, sorted by days-overdue desc. Mixers and equipment
     *  use 180d; trailers use 90d via the config flag. */
    const overdueServiceList = useMemo(() => {
        if (!summary.hasService) return []
        const threshold = config?.serviceOverdueDays || 180
        const enriched = operationalItems
            .filter((item) => AssetStatsUtility.isServiceOverdue(item.lastServiceDate, threshold))
            .map((item) => ({
                daysSinceService: daysSince(item.lastServiceDate),
                hours: Number.isFinite(Number(item.hours)) ? Number(item.hours) : null,
                id: item.id,
                identifier: itemDisplayId(item, config),
                lastServiceDate: item.lastServiceDate,
                operatorName: operatorNames.get(item.assignedOperator) || null,
                plant: item.assignedPlant || '—',
                status: displayStatus(item)
            }))
        enriched.sort((a, b) => (b.daysSinceService || 0) - (a.daysSinceService || 0))
        return enriched.slice(0, 20)
    }, [config, operationalItems, operatorNames, summary.hasService])

    /** Operator coverage — active assets in scope vs operators on the
     *  payroll for the same plant. Used by the Operators page and the
     *  Overview launchpad tile. */
    const operatorCoverage = useMemo(() => {
        if (!config?.hasOperatorAssignment) return null
        const upper = (v) =>
            String(v || '')
                .trim()
                .toUpperCase()
        const plant = upper(selectedPlant)
        const position = config?.operatorConfig?.position
        const filterOperators = (op) => {
            if (!op || op.status !== 'Active') return false
            if (position && op.position !== position) return false
            const opPlant = upper(op.plantCode)
            if (regionPlantCodes && regionPlantCodes.size > 0 && opPlant && !regionPlantCodes.has(opPlant)) return false
            if (plant && plant !== 'ALL' && opPlant !== plant) return false
            return true
        }
        const activeOperators = (operators || []).filter(filterOperators)
        const activeAssets = operationalItems.filter((item) => item.status === 'Active')
        const assigned = activeAssets.filter((item) => item.assignedOperator).length
        const unassignedAssets = activeAssets.length - assigned
        const assignedIds = new Set(activeAssets.map((item) => item.assignedOperator).filter(Boolean))
        const benchedOperators = activeOperators.filter((op) => !assignedIds.has(op.employeeId))
        const benchedList = benchedOperators
            .map((op) => ({
                id: op.employeeId,
                name: op.name || op.employeeId,
                plant: op.plantCode || '—'
            }))
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
            unassignedAssets
        }
    }, [config, operationalItems, operators, regionPlantCodes, selectedPlant])

    /** Hours utilization — surfaces fleet-wide hours metrics (mixers,
     *  tractors, equipment). Skipped for asset types that don't track hours
     *  (trailers, pickup trucks) so the section drops out cleanly. */
    const hoursStats = useMemo(() => {
        const hasHours = !!config?.verification?.hasHours
        if (!hasHours) return { hasHours: false }

        const items = operationalItems
            .map((item) => ({
                age: itemYear(item) ? new Date().getFullYear() - itemYear(item) : null,
                hours: Number(item.hours),
                id: item.id,
                identifier: itemDisplayId(item, config),
                operatorName: operatorNames.get(item.assignedOperator) || null,
                plant: item.assignedPlant || '—',
                status: displayStatus(item),
                year: itemYear(item)
            }))
            .filter((row) => Number.isFinite(row.hours) && row.hours >= 0)

        if (items.length === 0) {
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

        const sortedByHours = [...items].sort((a, b) => a.hours - b.hours)
        const total = sortedByHours.reduce((sum, row) => sum + row.hours, 0)
        const avgHours = total / sortedByHours.length
        const medianIdx = Math.floor(sortedByHours.length / 2)
        const medianHours =
            sortedByHours.length % 2 === 0
                ? (sortedByHours[medianIdx - 1].hours + sortedByHours[medianIdx].hours) / 2
                : sortedByHours[medianIdx].hours

        /** Distribution buckets — Diesel-engine fleet typically lives in
         *  the 5k–25k range; tail past 25k flags high-hour replacement
         *  candidates. The < 100h bucket catches new arrivals or assets
         *  with stale telemetry. */
        const buckets = [
            { label: '< 100h', max: 100 },
            { label: '100–2.5k', max: 2500 },
            { label: '2.5k–5k', max: 5000 },
            { label: '5k–10k', max: 10000 },
            { label: '10k–15k', max: 15000 },
            { label: '15k–25k', max: 25000 },
            { label: '> 25k', max: Infinity }
        ]
        const distribution = buckets.map(({ label }) => ({ count: 0, label }))
        items.forEach((row) => {
            const idx = buckets.findIndex((bucket) => row.hours <= bucket.max)
            const target = idx === -1 ? distribution.length - 1 : idx
            distribution[target].count += 1
        })

        /** Per-plant rollup — total hours, avg hours, sample count. Sorted
         *  by avg desc so the highest-utilized plants surface first. */
        const plantMap = new Map()
        items.forEach((row) => {
            const code =
                String(row.plant || '')
                    .trim()
                    .toUpperCase() || 'UNASSIGNED'
            if (!plantMap.has(code)) {
                plantMap.set(code, {
                    code,
                    max: 0,
                    name: plantNames.get(code) || code,
                    samples: 0,
                    sum: 0
                })
            }
            const bucket = plantMap.get(code)
            bucket.samples += 1
            bucket.sum += row.hours
            if (row.hours > bucket.max) bucket.max = row.hours
        })
        const hoursByPlant = [...plantMap.values()]
            .map((row) => ({ ...row, avg: row.samples > 0 ? row.sum / row.samples : 0 }))
            .sort((a, b) => b.avg - a.avg || b.sum - a.sum)

        /** Top assets by raw hours — replacement-candidate watchlist. */
        const topByHours = [...items].sort((a, b) => b.hours - a.hours).slice(0, 15)

        /** Hours-per-year (utilization rate) leaderboard. Only meaningful
         *  when we know the year, age > 0, and hours > 0. Highlights
         *  assets that work the hardest. */
        const hoursPerYearTopList = items
            .filter((row) => row.age != null && row.age > 0 && row.hours > 0)
            .map((row) => ({ ...row, hoursPerYear: row.hours / row.age }))
            .sort((a, b) => b.hoursPerYear - a.hoursPerYear)
            .slice(0, 15)

        const validHoursPerYear = items
            .filter((row) => row.age != null && row.age > 0 && row.hours > 0)
            .map((row) => row.hours / row.age)
        const avgHoursPerYear =
            validHoursPerYear.length > 0
                ? validHoursPerYear.reduce((sum, v) => sum + v, 0) / validHoursPerYear.length
                : null

        return {
            avgHours,
            avgHoursPerYear,
            hasHours,
            hoursByPlant,
            hoursDistribution: distribution,
            hoursPerYearTopList,
            hoursRecorded: items.length,
            hoursTotal: total,
            hoursUnrecorded: operationalItems.length - items.length,
            medianHours,
            topByHours
        }
    }, [config, operationalItems, operatorNames, plantNames])

    /** Shop performance — every asset currently sitting in the shop, broken
     *  out by sub-status when the asset type carries one (mixers today,
     *  more later). Mirrors the operations team's mental model: how many
     *  trucks are stuck, how long, and where. */
    const shopPerformance = useMemo(() => {
        const shopItems = operationalItems.filter((item) => item.status === 'In Shop')
        const supportsSubStatuses = !!config?.hasShopSubStatuses

        const subStatusCounts = new Map()
        const subStatusTenureSum = new Map()
        const subStatusTenureSamples = new Map()
        let totalTenureSum = 0
        let totalTenureSamples = 0

        shopItems.forEach((item) => {
            const tenure = daysSince(item.statusChangedAt || item.createdAt)
            if (tenure != null) {
                totalTenureSum += tenure
                totalTenureSamples += 1
            }
            if (!supportsSubStatuses) return
            const key = item.shopStatus || 'in_shop'
            const label = SHOP_SUB_LABELS[key] || 'In Shop'
            subStatusCounts.set(label, (subStatusCounts.get(label) || 0) + 1)
            if (tenure != null) {
                subStatusTenureSum.set(label, (subStatusTenureSum.get(label) || 0) + tenure)
                subStatusTenureSamples.set(label, (subStatusTenureSamples.get(label) || 0) + 1)
            }
        })

        /** Distribution rows for the sub-status chart — ordered by the
         *  operational team's mental priority (active work first, then
         *  outgoing queue, then incoming queue, then exceptions). */
        const subStatusOrder = ['In Shop', 'Third Party Work', 'Ready For Pickup', 'Waiting For Shop', 'Down In Yard']
        const subStatusDistribution = supportsSubStatuses
            ? subStatusOrder
                  .filter((label) => subStatusCounts.has(label))
                  .map((label) => {
                      const count = subStatusCounts.get(label) || 0
                      const sampleCount = subStatusTenureSamples.get(label) || 0
                      const avgDays = sampleCount > 0 ? subStatusTenureSum.get(label) / sampleCount : null
                      return { avgDays, count, label }
                  })
            : []

        /** Per-plant shop load — which plants are carrying the heaviest
         *  shop queue right now. Sorted by shop count desc. */
        const shopByPlantMap = new Map()
        shopItems.forEach((item) => {
            const code =
                String(item.assignedPlant || '')
                    .trim()
                    .toUpperCase() || 'UNASSIGNED'
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
            const row = shopByPlantMap.get(code)
            row.total += 1
            if (!supportsSubStatuses) {
                row.inShop += 1
                return
            }
            switch (item.shopStatus) {
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
        })
        const shopByPlant = [...shopByPlantMap.values()].sort(
            (a, b) => b.total - a.total || a.code.localeCompare(b.code)
        )

        /** Tenure histogram for the shop-only fleet — different bucket
         *  granularity than the fleet-wide one because shop tails are
         *  rarely past 180 days. */
        const shopTenureBucket = (days) => {
            if (days == null) return null
            if (days <= 3) return '0–3d'
            if (days <= 7) return '4–7d'
            if (days <= 14) return '8–14d'
            if (days <= 30) return '15–30d'
            if (days <= 60) return '31–60d'
            return '> 60d'
        }
        const SHOP_TENURE_ORDER = ['0–3d', '4–7d', '8–14d', '15–30d', '31–60d', '> 60d']
        const tenureMap = new Map(SHOP_TENURE_ORDER.map((label) => [label, 0]))
        shopItems.forEach((item) => {
            const bucket = shopTenureBucket(daysSince(item.statusChangedAt || item.createdAt))
            if (bucket) tenureMap.set(bucket, (tenureMap.get(bucket) || 0) + 1)
        })
        const tenureDistribution = SHOP_TENURE_ORDER.map((label) => ({
            count: tenureMap.get(label) || 0,
            label
        }))

        /** Stuck-in-shop watchlist — every asset currently in the shop,
         *  ordered by days-in-shop desc. Caps at 25 to keep the table
         *  manageable; ships back the sub-status so the row can render
         *  the right pill. */
        const stuckInShop = shopItems
            .map((item) => ({
                days: daysSince(item.statusChangedAt || item.createdAt),
                id: item.id,
                identifier: itemDisplayId(item, config),
                operatorName: operatorNames.get(item.assignedOperator) || null,
                plant: item.assignedPlant || '—',
                shopStatus: item.shopStatus || 'in_shop',
                status: displayStatus(item)
            }))
            .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
            .slice(0, 25)

        /** Ready-for-pickup queue — assets that are ready to leave the shop
         *  but haven't yet. Only meaningful when sub-statuses exist. */
        const readyForPickupQueue = supportsSubStatuses
            ? shopItems
                  .filter((item) => item.shopStatus === 'ready_for_pickup')
                  .map((item) => ({
                      days: daysSince(item.statusChangedAt || item.createdAt),
                      id: item.id,
                      identifier: itemDisplayId(item, config),
                      operatorName: operatorNames.get(item.assignedOperator) || null,
                      plant: item.assignedPlant || '—',
                      shopStatus: item.shopStatus,
                      status: displayStatus(item)
                  }))
                  .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
            : []

        const totalInShop = shopItems.length
        const inShopCount = supportsSubStatuses
            ? shopItems.filter((item) => item.shopStatus === 'in_shop' || !item.shopStatus).length
            : shopItems.length
        const downInYardCount = supportsSubStatuses
            ? shopItems.filter((item) => item.shopStatus === 'down_in_yard').length
            : 0
        const thirdPartyCount = supportsSubStatuses
            ? shopItems.filter((item) => item.shopStatus === 'third_party').length
            : 0
        const readyForPickupCount = supportsSubStatuses
            ? shopItems.filter((item) => item.shopStatus === 'ready_for_pickup').length
            : 0
        const waitingForShopCount = supportsSubStatuses
            ? shopItems.filter((item) => item.shopStatus === 'waiting_for_shop').length
            : 0
        const avgShopDays = totalTenureSamples > 0 ? totalTenureSum / totalTenureSamples : null
        const shopRate = summary.total > 0 ? totalInShop / summary.total : 0
        const stuckThreshold = 30
        const stuckCount = shopItems.filter((item) => {
            const days = daysSince(item.statusChangedAt || item.createdAt)
            return days != null && days >= stuckThreshold
        }).length

        return {
            avgShopDays,
            downInYardCount,
            inShopCount,
            readyForPickupCount,
            readyForPickupQueue,
            shopByPlant,
            shopItems,
            shopRate,
            stuckCount,
            stuckInShop,
            stuckThreshold,
            subStatusDistribution,
            supportsSubStatuses,
            tenureDistribution,
            thirdPartyCount,
            totalInShop,
            waitingForShopCount
        }
    }, [config, operationalItems, operatorNames, plantNames, summary.total])

    /** Available-plant codes for the Statistics plant filter — only plants
     *  with at least one operational asset in scope show up so the menu
     *  doesn't drown in empty entries. */
    const availablePlantCodes = useMemo(() => {
        const set = new Set()
        operationalItems.forEach((item) => {
            const code = String(item.assignedPlant || '')
                .trim()
                .toUpperCase()
            if (code) set.add(code)
        })
        return [...set].sort()
    }, [operationalItems])

    return {
        ageDistribution,
        availablePlantCodes,
        cleanlinessByPlant,
        cleanlinessDistribution,
        dirtyAssets,
        hoursStats,
        longestInStatus,
        oldestAssets,
        operatorCoverage,
        operatorNames,
        overdueServiceList,
        perPlant,
        plantNames,
        retiredItems,
        scopedItems,
        shopPerformance,
        statusDistribution,
        summary,
        tenureBuckets,
        topIssueAssets
    }
}
