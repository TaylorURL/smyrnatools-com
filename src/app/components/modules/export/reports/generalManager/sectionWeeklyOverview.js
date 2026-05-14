import { COLORS } from '../../../../../../utils/ExportUtility'
import { addSidebarGroup, addSidebarTitle } from './gmSidebar'

/** Right-side "Weekly Overview" sidebar — six metric groups stacked vertically.
 *  Begins at `overviewCol`. Returns the next free row (unused by callers, kept
 *  for symmetry with the Monthly sidebar). */
export function renderWeeklyOverview(ws, startRow, overviewCol, { current, daily, plantCount, previous }) {
    ws.getColumn(overviewCol).width = 14
    ws.getColumn(overviewCol + 1).width = 8
    ws.getColumn(overviewCol + 2).width = 10
    ws.getColumn(overviewCol + 3).width = 1

    addSidebarTitle(ws, startRow, overviewCol, 'Weekly Overview')
    let row = startRow + 2

    row = addSidebarGroup(ws, row, overviewCol, 'Fleet', [
        { label: 'Plants', value: plantCount },
        { label: 'Runnable', prev: previous.totalRunnable, useValue: true, value: current.totalRunnable },
        {
            color: current.totalDown > 0 ? COLORS.danger : COLORS.brand,
            invertChange: true,
            label: 'Down',
            prev: previous.totalDown,
            useValue: true,
            value: current.totalDown
        },
        {
            color:
                current.fleetUtilization >= 90
                    ? COLORS.success
                    : current.fleetUtilization < 80
                      ? COLORS.danger
                      : COLORS.brand,
            label: 'Utilization',
            prev: previous.fleetUtilization,
            suffix: '%',
            value: current.fleetUtilization
        }
    ])

    row = addSidebarGroup(ws, row, overviewCol, 'Operators', [
        { label: 'Total', prev: previous.totalOps, useValue: true, value: current.totalOps },
        {
            color:
                current.allocationPct >= 100
                    ? COLORS.success
                    : current.allocationPct < 80
                      ? COLORS.danger
                      : COLORS.brand,
            label: 'Allocation',
            prev: previous.allocationPct,
            suffix: '%',
            value: current.allocationPct
        }
    ])

    row = addSidebarGroup(ws, row, overviewCol, 'Training', [
        { label: 'Trainers', value: current.trainersCount },
        {
            color: current.trainingCount > 0 ? COLORS.success : COLORS.brand,
            label: 'In Training',
            value: current.trainingCount
        },
        { label: 'Pending Start', value: current.pendingCount },
        {
            color: current.hiringNeeded > 0 ? COLORS.danger : COLORS.success,
            label: 'Need to Hire',
            value: current.hiringNeeded
        }
    ])

    row = addSidebarGroup(ws, row, overviewCol, 'Weekly Production', [
        { format: '#,##0', label: 'Yardage', prev: previous.totalYardage, value: current.totalYardage },
        { format: '#,##0', label: 'Loads', prev: previous.totalLoads, value: daily.totalLoads },
        { format: '#,##0.0', label: 'Hours', prev: previous.totalHours, value: current.totalHours }
    ])

    row = addSidebarGroup(ws, row, overviewCol, 'Daily Averages', [
        { format: '#,##0', label: 'Yardage', prev: previous.dailyYardage, value: daily.dailyYardage },
        { format: '#,##0', label: 'Loads', prev: previous.dailyLoads, value: daily.dailyLoads },
        { label: 'Hours', prev: parseFloat(previous.dailyHours), value: daily.dailyHours }
    ])

    row = addSidebarGroup(ws, row, overviewCol, 'Per Operator/Day', [
        { label: 'Loads', prev: parseFloat(previous.loadsPerOpPerDay), value: daily.loadsPerOpPerDay },
        { label: 'Hours', prev: parseFloat(previous.hoursPerOpPerDay), value: daily.hoursPerOpPerDay }
    ])

    return row
}
