import { ensure } from '../../../../../../utils/ExportUtility'

/** Walks all plants and sums the five core form metrics. Returns 0 for any
 *  missing or non-numeric input. */
export function computeWeekTotals(form, sortedPlants) {
    let totalOps = 0,
        totalRunnable = 0,
        totalDown = 0,
        totalYardage = 0,
        totalHours = 0
    sortedPlants.forEach((p) => {
        totalOps += ensure(form[`active_operators_${p.plant_code}`], true)
        totalRunnable += ensure(form[`runnable_trucks_${p.plant_code}`], true)
        totalDown += ensure(form[`down_trucks_${p.plant_code}`], true)
        totalYardage += ensure(form[`total_yardage_${p.plant_code}`], true)
        totalHours += ensure(form[`total_hours_${p.plant_code}`], true)
    })
    return { totalDown, totalHours, totalOps, totalRunnable, totalYardage }
}

/** Allocation = operators / runnable trucks (capped at the obvious 0/0). */
export function computeAllocationPct(totalOps, totalRunnable) {
    return totalRunnable > 0 ? Math.round((totalOps / totalRunnable) * 100) : 0
}

/** Fleet utilization = runnable / (runnable + down). */
export function computeFleetUtilization(totalRunnable, totalDown) {
    return totalRunnable + totalDown > 0 ? Math.round((totalRunnable / (totalRunnable + totalDown)) * 100) : 0
}

/** Sums a prior week's totals from `prevGMData`, returning zeros when there
 *  is no prior week. */
export function computePrevTotals(prevGMData, sortedPlants) {
    if (!prevGMData) {
        return { totalDown: 0, totalHours: 0, totalOps: 0, totalRunnable: 0, totalYardage: 0 }
    }
    return computeWeekTotals(prevGMData, sortedPlants)
}

const WORK_DAYS = 6
const YARDS_PER_LOAD = 10

/** Daily averages + per-operator/day rates derived from week totals. */
export function deriveDailyMetrics({
    totalDown: _totalDown,
    totalHours,
    totalOps,
    totalRunnable: _totalRunnable,
    totalYardage
}) {
    const totalLoads = Math.round(totalYardage / YARDS_PER_LOAD)
    return {
        dailyHours: (totalHours / WORK_DAYS).toFixed(1),
        dailyLoads: Math.round(totalLoads / WORK_DAYS),
        dailyYardage: Math.round(totalYardage / WORK_DAYS),
        hoursPerOpPerDay: totalOps > 0 ? (totalHours / totalOps / WORK_DAYS).toFixed(1) : '0.0',
        loadsPerOpPerDay: totalOps > 0 ? (totalLoads / totalOps / WORK_DAYS).toFixed(1) : '0.0',
        totalLoads,
        workDays: WORK_DAYS
    }
}

/** Aggregates plant totals across an array of monthly reports — used by the
 *  Monthly Overview sidebar. Reports may be wrapped in `{ data }` or be the
 *  data object directly. */
export function computeMonthlyTotals(reports, sortedPlants) {
    let ops = 0,
        runnable = 0,
        down = 0,
        yardage = 0,
        hours = 0
    const weekCount = reports.length
    reports.forEach((rpt) => {
        if (!rpt) return
        const data = rpt.data || rpt
        sortedPlants.forEach((p) => {
            ops += ensure(data[`active_operators_${p.plant_code}`], true)
            runnable += ensure(data[`runnable_trucks_${p.plant_code}`], true)
            down += ensure(data[`down_trucks_${p.plant_code}`], true)
            yardage += ensure(data[`total_yardage_${p.plant_code}`], true)
            hours += ensure(data[`total_hours_${p.plant_code}`], true)
        })
    })
    const avgOps = weekCount > 0 ? Math.round(ops / weekCount) : 0
    const avgRunnable = weekCount > 0 ? Math.round(runnable / weekCount) : 0
    const avgDown = weekCount > 0 ? Math.round(down / weekCount) : 0
    return { avgDown, avgOps, avgRunnable, hours, loads: Math.round(yardage / YARDS_PER_LOAD), weekCount, yardage }
}

/** Used by the MTD/YTD summary rows under the per-plant table. Each report
 *  here is already a `data` object (not `{ data }`). */
export function computePlantSummaryTotals(reports, sortedPlants) {
    let ops = 0,
        runnable = 0,
        down = 0,
        yardage = 0,
        hours = 0
    reports.forEach((data) => {
        sortedPlants.forEach((p) => {
            ops += ensure(data[`active_operators_${p.plant_code}`], true)
            runnable += ensure(data[`runnable_trucks_${p.plant_code}`], true)
            down += ensure(data[`down_trucks_${p.plant_code}`], true)
            yardage += ensure(data[`total_yardage_${p.plant_code}`], true)
            hours += ensure(data[`total_hours_${p.plant_code}`], true)
        })
    })
    return { down, hours, ops, runnable, yardage }
}
