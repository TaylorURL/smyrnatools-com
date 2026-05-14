import { ReportService } from '../../../../../../services/ReportService'
import { addReportHeader, sortPlants } from '../../../../../../utils/ExportUtility'
import { createSheet, finalizeSheet } from '../../ExportModule'
import { buildRmiSummary } from './gmRmiSnapshot'
import {
    computeAllocationPct,
    computeFleetUtilization,
    computeMonthlyTotals,
    computePrevTotals,
    computeWeekTotals,
    deriveDailyMetrics
} from './gmTotals'
import { renderAggregateProduction } from './sectionAggregateProduction'
import { renderAiSummary } from './sectionAiSummary'
import { buildMixerCounts, renderAssetOverview } from './sectionAssetOverview'
import { renderEfficiencyOverview } from './sectionEfficiencyOverview'
import { renderMonthlyOverview } from './sectionMonthlyOverview'
import { renderPlantSummary } from './sectionPlantSummary'
import { renderRmiTrainingHiring } from './sectionRmiTrainingHiring'
import { renderWeeklyOverview } from './sectionWeeklyOverview'

const OVERVIEW_COL = 18

/** Bundle the current-week + prior-week numeric snapshots used by the
 *  Weekly Overview sidebar. Each side is augmented with `dailyYardage`,
 *  `dailyLoads`, etc. for the per-operator/day metrics. */
function buildOverviewSnapshots({ form, prevGMData, rmiSummary, sortedPlants }) {
    const totals = computeWeekTotals(form, sortedPlants)
    const prev = computePrevTotals(prevGMData, sortedPlants)
    const daily = deriveDailyMetrics(totals)
    const prevDaily = deriveDailyMetrics(prev)
    return {
        current: {
            allocationPct: computeAllocationPct(totals.totalOps, totals.totalRunnable),
            fleetUtilization: computeFleetUtilization(totals.totalRunnable, totals.totalDown),
            hiringNeeded: rmiSummary.totalHiringNeeded,
            pendingCount: rmiSummary.allPending.length,
            totalDown: totals.totalDown,
            totalHours: totals.totalHours,
            totalOps: totals.totalOps,
            totalRunnable: totals.totalRunnable,
            totalYardage: totals.totalYardage,
            trainersCount: rmiSummary.allTrainers.length,
            trainingCount: rmiSummary.allTraining.length
        },
        daily,
        previous: {
            allocationPct: computeAllocationPct(prev.totalOps, prev.totalRunnable),
            dailyHours: prevDaily.dailyHours,
            dailyLoads: prevDaily.dailyLoads,
            dailyYardage: prevDaily.dailyYardage,
            fleetUtilization: computeFleetUtilization(prev.totalRunnable, prev.totalDown),
            hoursPerOpPerDay: prevDaily.hoursPerOpPerDay,
            loadsPerOpPerDay: prevDaily.loadsPerOpPerDay,
            totalDown: prev.totalDown,
            totalHours: prev.totalHours,
            totalLoads: prevDaily.totalLoads,
            totalOps: prev.totalOps,
            totalRunnable: prev.totalRunnable,
            totalYardage: prev.totalYardage
        }
    }
}

/** Filters monthly history to weeks ≤ `weekIso` and rolls each month up
 *  into the totals shape expected by the Monthly Overview sidebar. */
function buildMonthlyTotals(allMonthlyData, weekIso, sortedPlants) {
    return allMonthlyData
        .map((m) => {
            const filtered = m.reports.filter((r) => r.weekIso <= weekIso)
            return { ...m, reports: filtered, weekIsos: new Set(filtered.map((r) => r.weekIso)) }
        })
        .filter((m) => m.reports.length > 0)
        .map((m) => ({ ...m, totals: computeMonthlyTotals(m.reports, sortedPlants) }))
}

/** Builds a single week's GM report sheet with all sidebars + tables. */
export async function createWeekSheet({
    aggregateReport = null,
    aiSummaryPromise = null,
    allAggReports = { monthly: [], yearly: [] },
    allMonthlyData,
    assetData,
    effReports = [],
    ExcelLib: _ExcelLib,
    form,
    logoBase64,
    plants,
    prevAggregateReport = null,
    prevEffReports = [],
    prevGMData,
    prevWeekIso: _prevWeekIso,
    rmiData = null,
    wb,
    weekIso
}) {
    const sortedPlants = sortPlants(plants)
    const sortedEffReports = sortPlants(effReports)
    const sortedPrevEffReports = sortPlants(prevEffReports)

    const sheetName = weekIso ? ReportService.getWeekRangeFromIso(weekIso).replace(' through ', ' - ') : 'Weekly Report'
    const ws = createSheet(wb, sheetName)
    const weekRange = weekIso ? ReportService.getWeekRangeFromIso(weekIso) : ''
    const overviewStartRow = addReportHeader(ws, wb, {
        logoBase64,
        subtitle: weekRange || 'Weekly Summary',
        title: 'General Manager Report'
    })

    const rmiSummary = buildRmiSummary(rmiData, form, sortedPlants)
    await renderAiSummary(ws, aiSummaryPromise)

    const snapshots = buildOverviewSnapshots({ form, prevGMData, rmiSummary, sortedPlants })
    renderWeeklyOverview(ws, overviewStartRow, OVERVIEW_COL, { ...snapshots, plantCount: sortedPlants.length })

    const monthlyTotals = buildMonthlyTotals(allMonthlyData, weekIso, sortedPlants)
    const monthlyCol = OVERVIEW_COL + 4
    renderMonthlyOverview(ws, overviewStartRow, monthlyCol, monthlyTotals)

    if (assetData) {
        const assetCol = monthlyCol + 4
        const mixerCounts = buildMixerCounts(assetData.mixers, snapshots.current.totalOps)
        renderAssetOverview(ws, overviewStartRow, assetCol, { ...assetData, mixers: mixerCounts })
    }

    let row = renderPlantSummary(ws, overviewStartRow, {
        allMonthlyData,
        form,
        prevGMData,
        sortedPlants,
        weekIso
    })
    row = renderEfficiencyOverview(ws, row, {
        effReports: sortedEffReports,
        form,
        prevEffReports: sortedPrevEffReports,
        prevGMData,
        sortedPlants
    })
    row = renderAggregateProduction(ws, row, { aggregateReport, allAggReports, prevAggregateReport })
    if (rmiData) {
        renderRmiTrainingHiring(ws, row, {
            allPending: rmiSummary.allPending,
            allTrainers: rmiSummary.allTrainers,
            allTraining: rmiSummary.allTraining,
            hiringGoals: rmiSummary.hiringGoals,
            plants,
            sortedPlants
        })
    }
    finalizeSheet(ws)
}
