/**
 * Service-quality aggregators: the open-issue watchlist, the cleanliness
 * rollups (distribution, dirty assets, per-plant averages), and the
 * service-overdue watchlist. Each takes the operational item list already
 * narrowed by `AssetStatsScope`, whose plant-code helpers it reuses.
 *
 * Cleanliness is rated 1–5, where 1 is worst; anything below 3 counts as dirty,
 * and 0 or a missing rating means "never rated" rather than "filthy".
 */

import AssetStatsUtility, { daysSince, displayStatus, itemDisplayId } from './AssetStatsUtility'
import { finiteHours, plantCodeOrUnassigned } from './AssetStatsScope'

/** The 15 assets carrying the most open issues. Equal counts put Active assets
 *  ahead of parked ones, since an issue on a truck in service matters more. */
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

/** Count of assets at each cleanliness rating. All five ratings are emitted
 *  even when empty so the chart keeps a fixed axis. */
export const computeCleanlinessDistribution = (operationalItems: any[]): { count: number; rating: number }[] => {
    const map = new Map<number, number>([1, 2, 3, 4, 5].map((rating) => [rating, 0]))
    operationalItems.forEach((item) => {
        const rating = Number(item.cleanlinessRating)
        if (rating >= 1 && rating <= 5) map.set(rating, (map.get(rating) || 0) + 1)
    })
    return [1, 2, 3, 4, 5].map((rating) => ({ count: map.get(rating) || 0, rating }))
}

/** The 15 dirtiest rated assets, worst first. */
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

/** Per-plant cleanliness average and dirty count, worst plants first. Only
 *  rated assets contribute, so a plant that rates nothing never appears. */
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

/** The 20 assets furthest past their service interval, longest overdue first.
 *  Empty when the asset type does not track service, so the caller can drop the
 *  section. The interval comes from the asset config and falls back to 180
 *  days. */
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
