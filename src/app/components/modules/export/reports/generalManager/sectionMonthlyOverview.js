import { addSidebarGroup, addSidebarTitle } from './gmSidebar'

/** "Monthly Overview" sidebar column — one group per month, ordered newest
 *  first. Each group shows weeks reported plus rolled-up yardage / loads / hours. */
export function renderMonthlyOverview(ws, startRow, monthlyCol, monthlyTotals) {
    ws.getColumn(monthlyCol).width = 14
    ws.getColumn(monthlyCol + 1).width = 8
    ws.getColumn(monthlyCol + 2).width = 10
    ws.getColumn(monthlyCol + 3).width = 1

    addSidebarTitle(ws, startRow, monthlyCol, 'Monthly Overview')
    let row = startRow + 2

    monthlyTotals.forEach((monthData, idx) => {
        const prevMonthData = monthlyTotals[idx + 1]
        const prevTotals = prevMonthData ? prevMonthData.totals : null
        const weeksReported = monthData.weekIsos ? monthData.weekIsos.size : monthData.totals.weekCount
        const totalWeeks = monthData.totalWeeks || 4
        const weeksLabel = weeksReported === 0 ? `0 of ${totalWeeks} weeks` : `${weeksReported}/${totalWeeks} weeks`
        row = addSidebarGroup(ws, row, monthlyCol, monthData.monthName, [
            { label: 'Weeks', value: weeksLabel },
            { format: '#,##0', label: 'Yardage', prev: prevTotals?.yardage, value: monthData.totals.yardage },
            { format: '#,##0', label: 'Loads', prev: prevTotals?.loads, value: monthData.totals.loads },
            { format: '#,##0.0', label: 'Hours', prev: prevTotals?.hours, value: monthData.totals.hours }
        ])
    })

    return row
}
