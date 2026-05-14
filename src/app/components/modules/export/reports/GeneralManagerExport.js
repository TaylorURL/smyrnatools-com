import { AIService } from '../../../../../services/AIService'
import { ensure, fetchAllMonthlyGMReports, sortPlants, toMondayIso } from '../../../../../utils/ExportUtility'
import { exportWorkbook, generateFilename, initExport } from '../ExportModule'
import { createWeekSheet } from './generalManager/createWeekSheet'
import {
    collectWeeksToExport,
    fetchAllAssets,
    fetchPerWeekData,
    filterAssetsByPlants
} from './generalManager/gmDataFetch'
import { computeAllocationPct, computeFleetUtilization, computeWeekTotals } from './generalManager/gmTotals'

/** Kicks off the AI executive-summary request immediately. Returns a
 *  promise that swallows errors with a console warning so it never
 *  rejects the parent flow. */
function startAiSummary(form, plants, weekIso) {
    const sortedPlants = sortPlants(plants)
    const totals = computeWeekTotals(form, sortedPlants)
    const allocationPct = computeAllocationPct(totals.totalOps, totals.totalRunnable)
    const fleetUtilization = computeFleetUtilization(totals.totalRunnable, totals.totalDown)
    const plantIssues = []
    sortedPlants.forEach((p) => {
        const down = ensure(form[`down_trucks_${p.plant_code}`], true)
        if (down >= 2) plantIssues.push(`${p.plant_code}: ${down} down`)
    })
    return AIService.generateGMReportExportSummary({
        allocationPct,
        fleetUtilization,
        plantCount: sortedPlants.length,
        plantIssues,
        totalDown: totals.totalDown,
        totalOperators: totals.totalOps,
        totalRunnable: totals.totalRunnable,
        totalYardage: totals.totalYardage,
        weekIso
    }).catch((err) => {
        console.warn('AI summary generation failed:', err)
        return null
    })
}

/** Builds the case-insensitive set of allowed plant codes and filters
 *  every asset list down to those plants. */
function filterAssetsForRegion(assets, plants) {
    const plantCodes = new Set(
        plants.map((p) =>
            String(p.plant_code || '')
                .trim()
                .toUpperCase()
        )
    )
    return {
        equipment: filterAssetsByPlants(assets.equipment, plantCodes),
        mixers: filterAssetsByPlants(assets.mixers, plantCodes),
        pickups: filterAssetsByPlants(assets.pickups, plantCodes),
        tractors: filterAssetsByPlants(assets.tractors, plantCodes),
        trailers: filterAssetsByPlants(assets.trailers, plantCodes)
    }
}

/**
 * Generates a multi-sheet General Manager Report Excel workbook.
 * Fetches asset data, efficiency reports, RMI snapshots, and aggregate
 * production data for each week found in the monthly history, then builds
 * styled sheets with an AI-generated executive summary on the current week.
 */
export async function exportGeneralManagerReport({ form, plants, weekIso: rawWeekIso, filename }) {
    if (typeof window === 'undefined') return
    const weekIso = toMondayIso(rawWeekIso) || rawWeekIso
    const finalFilename = filename || generateFilename('General Manager Report', weekIso)

    const aiSummaryPromise = startAiSummary(form, plants, weekIso)
    const [initData, allMonthlyData, assets] = await Promise.all([
        initExport({ subject: 'Weekly General Manager Report' }),
        fetchAllMonthlyGMReports(),
        fetchAllAssets()
    ])
    const { wb, ExcelLib, logoBase64 } = initData
    const assetData = filterAssetsForRegion(assets, plants)

    const { weekIsos, weeksToExport } = collectWeeksToExport(form, weekIso, allMonthlyData)
    const { aggReportsMap, allAggReportsMap, effReportsMap, rmiDataMap } = await fetchPerWeekData(plants, weekIsos)

    for (let i = 0; i < weeksToExport.length; i++) {
        const weekData = weeksToExport[i]
        const prevWeekData = weeksToExport[i + 1] || null
        const isCurrentWeek = i === 0
        await createWeekSheet({
            ExcelLib,
            aggregateReport: aggReportsMap[weekData.weekIso] || null,
            aiSummaryPromise: isCurrentWeek ? aiSummaryPromise : null,
            allAggReports: allAggReportsMap[weekData.weekIso] || { monthly: [], yearly: [] },
            allMonthlyData,
            assetData: isCurrentWeek ? assetData : null,
            effReports: effReportsMap[weekData.weekIso] || [],
            form: weekData.form,
            logoBase64,
            plants,
            prevAggregateReport: prevWeekData ? aggReportsMap[prevWeekData.weekIso] || null : null,
            prevEffReports: prevWeekData ? effReportsMap[prevWeekData.weekIso] || [] : [],
            prevGMData: prevWeekData?.form,
            prevWeekIso: prevWeekData?.weekIso,
            rmiData: rmiDataMap[weekData.weekIso] || null,
            wb,
            weekIso: weekData.weekIso
        })
    }
    await exportWorkbook(wb, finalFilename)
}
