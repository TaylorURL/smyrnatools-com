import { EquipmentService } from '../../../../../../services/EquipmentService'
import { MixerService } from '../../../../../../services/MixerService'
import { PickupTruckService } from '../../../../../../services/PickupTruckService'
import { TractorService } from '../../../../../../services/TractorService'
import { TrailerService } from '../../../../../../services/TrailerService'
import {
    fetchAggregateProductionReport,
    fetchAllAggregateReports,
    fetchEfficiencyReports,
    fetchRMIReport,
    getPreviousWeekIso
} from '../../../../../../utils/ExportUtility'

/** Pulls every fleet inventory in parallel, swallowing errors as empty arrays. */
export async function fetchAllAssets() {
    const [mixers, tractors, trailers, equipment, pickups] = await Promise.all([
        MixerService.getAllMixers().catch(() => []),
        TractorService.getAllTractors().catch(() => []),
        TrailerService.fetchTrailers().catch(() => []),
        EquipmentService.getAllEquipments().catch(() => []),
        PickupTruckService.getAll().catch(() => [])
    ])
    return { equipment, mixers, pickups, tractors, trailers }
}

/** Filters an asset list to only those assigned to one of `plantCodes`
 *  (matched case-insensitive). */
export function filterAssetsByPlants(items, plantCodes) {
    return items.filter((item) => {
        const plantCode = String(item.assignedPlant || item.assigned_plant || '')
            .trim()
            .toUpperCase()
        return plantCodes.has(plantCode)
    })
}

/** Builds the chronological list of weeks (current week + each prior week
 *  with a saved report) and returns matched `{ form, weekIso }` entries. */
export function collectWeeksToExport(currentForm, weekIso, allMonthlyData) {
    const weeksToExport = [{ form: currentForm, weekIso }]
    const weekIsos = [weekIso]
    let checkWeek = getPreviousWeekIso(weekIso)
    while (checkWeek) {
        const monthData = allMonthlyData.find((m) => m.reports.some((r) => r.weekIso === checkWeek))
        const reportEntry = monthData?.reports.find((r) => r.weekIso === checkWeek)
        if (!reportEntry?.data) break
        weeksToExport.push({ form: reportEntry.data, weekIso: checkWeek })
        weekIsos.push(checkWeek)
        checkWeek = getPreviousWeekIso(checkWeek)
    }
    return { weekIsos, weeksToExport }
}

/** Wraps `Promise.all` over per-week fetches into a `{ weekIso → result }` map. */
async function buildWeekMap(weekIsos, fetcher) {
    const results = await Promise.all(weekIsos.map(async (w) => ({ result: await fetcher(w), weekIso: w })))
    const map = {}
    results.forEach((r) => {
        map[r.weekIso] = r.result
    })
    return map
}

/** Fetches efficiency, RMI, aggregate, and YTD aggregate data for every
 *  week in `weekIsos`. Returns four `{ weekIso → data }` maps. */
export async function fetchPerWeekData(plants, weekIsos) {
    const [effReportsMap, rmiDataMap, aggReportsMap, allAggReportsMap] = await Promise.all([
        buildWeekMap(weekIsos, (w) => fetchEfficiencyReports(plants, w)),
        buildWeekMap(weekIsos, (w) => fetchRMIReport(w)),
        buildWeekMap(weekIsos, (w) => fetchAggregateProductionReport(w)),
        buildWeekMap(weekIsos, (w) => fetchAllAggregateReports(w))
    ])
    return { aggReportsMap, allAggReportsMap, effReportsMap, rmiDataMap }
}
