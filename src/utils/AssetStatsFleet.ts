/**
 * Fleet-shape aggregators: status distribution, the per-plant scorecard, the
 * tenure and age histograms, and the longest-in-status / oldest-asset
 * watchlists. Each takes the operational item list already narrowed by
 * `AssetStatsScope`, whose plant-code and verification helpers it reuses so
 * every section groups plants the same way.
 */

import AssetStatsUtility, {
    AGE_BUCKET_ORDER,
    ageBucket,
    daysSince,
    displayStatus,
    itemDisplayId,
    itemYear,
    TENURE_BUCKET_ORDER,
    tenureBucket
} from './AssetStatsUtility'
import { finiteHours, plantCodeOrUnassigned, verifiedNow } from './AssetStatsScope'

/** Status distribution, largest slice first. In-Shop assets are split by shop
 *  sub-status so the chart reads the same way the list view labels them. */
export const computeStatusDistribution = (operationalItems: any[]): { count: number; label: string }[] => {
    const totals = new Map<string, number>()
    operationalItems.forEach((item) => {
        const label = displayStatus(item)
        totals.set(label, (totals.get(label) || 0) + 1)
    })
    return [...totals.entries()].map(([label, count]) => ({ count, label })).sort((a, b) => b.count - a.count)
}

/** Per-plant scorecard: status split, verification, open issues, and — where
 *  the asset type supports them — unassigned active assets and overdue service.
 *  `hasService` and the config flags gate those columns so plants are not shown
 *  a zero for something the asset type never tracks. Rows are ordered by size,
 *  ties broken by plant code, and feed the plant tables on several pages. */
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

/** Histogram of how long assets have held their current status, measured from
 *  the last status change or, failing that, creation. Every bucket is emitted
 *  in `TENURE_BUCKET_ORDER` even when empty so the bars keep a stable order. */
export const computeTenureBuckets = (operationalItems: any[]): { count: number; label: string }[] => {
    const map = new Map<string, number>(TENURE_BUCKET_ORDER.map((label) => [label, 0]))
    operationalItems.forEach((item) => {
        const bucket = tenureBucket(daysSince(item.statusChangedAt || item.createdAt))
        if (bucket) map.set(bucket, (map.get(bucket) || 0) + 1)
    })
    return TENURE_BUCKET_ORDER.map((label) => ({ count: map.get(label) || 0, label }))
}

/** Watchlist of the 12 assets sitting longest in their current status. Assets
 *  under a week are dropped — normal churn, not something to act on. */
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

/** Age histogram keyed off model year. Assets with no usable year land in a
 *  trailing "Unknown" bucket, which is only emitted when some exist. */
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

/** The 12 oldest assets by model year, hours breaking ties so the harder-worked
 *  unit of a given year ranks first. Rows without a year are dropped rather
 *  than sorted as year zero. */
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
