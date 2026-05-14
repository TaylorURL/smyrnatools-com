import {
    addChangePct,
    addDataRow,
    addMergedTableHeaders,
    addSectionTitle,
    applyTotalCell,
    applyTotalChangeCell,
    COLORS,
    ensure,
    getChangeText,
    getChangeValue
} from '../../../../../../utils/ExportUtility'
import { computePlantSummaryTotals, computeWeekTotals } from './gmTotals'

const PLANT_HEADERS = [
    { label: 'Plant', merge: false },
    { align: 'left', label: 'Name', merge: false },
    { label: 'Operators', merge: true },
    { label: 'Runnable', merge: true },
    { label: 'Down', merge: true },
    { label: 'Yardage', merge: true },
    { label: 'Hours', merge: true },
    { align: 'left', label: 'Notes', mergeCount: 3 }
]

/** Writes a `{ value, font, fill, alignment, numFmt? }` cell with alt-row
 *  snow tint. */
function fillNumberCell(ws, row, col, value, numFmt, isAlt) {
    const cell = ws.getCell(row, col)
    cell.value = value
    if (numFmt) cell.numFmt = numFmt
    cell.font = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (isAlt) cell.fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
}

/** Builds the variance-pill objects for a single plant row. Returns
 *  `{ opsChange, runnableChange, downChange, yardageChange, hoursChange }`. */
function buildPlantRowChanges(current, prev, hasPrev) {
    const noChange = { color: null, text: '' }
    return {
        downChange: hasPrev ? getChangeValue(current.down, prev.down, true) : noChange,
        hoursChange: hasPrev ? getChangeText(current.hours, prev.hours, false) : noChange,
        opsChange: hasPrev ? getChangeValue(current.ops, prev.ops, false) : noChange,
        runnableChange: hasPrev ? getChangeValue(current.runnable, prev.runnable, false) : noChange,
        yardageChange: hasPrev ? getChangeText(current.yardage, prev.yardage, false) : noChange
    }
}

/** Renders one plant row — variance pill + value cell for each of the five
 *  metrics, plus a merged notes cell on the right. */
function renderPlantRow(ws, row, plant, form, prevGMData, sortedIndex) {
    const current = {
        down: ensure(form[`down_trucks_${plant.plant_code}`], true),
        hours: ensure(form[`total_hours_${plant.plant_code}`], true),
        ops: ensure(form[`active_operators_${plant.plant_code}`], true),
        runnable: ensure(form[`runnable_trucks_${plant.plant_code}`], true),
        yardage: ensure(form[`total_yardage_${plant.plant_code}`], true)
    }
    const prev = prevGMData
        ? {
              down: ensure(prevGMData[`down_trucks_${plant.plant_code}`], true),
              hours: ensure(prevGMData[`total_hours_${plant.plant_code}`], true),
              ops: ensure(prevGMData[`active_operators_${plant.plant_code}`], true),
              runnable: ensure(prevGMData[`runnable_trucks_${plant.plant_code}`], true),
              yardage: ensure(prevGMData[`total_yardage_${plant.plant_code}`], true)
          }
        : null
    const isAlt = sortedIndex % 2 === 1
    const changes = buildPlantRowChanges(current, prev || {}, !!prevGMData)

    addDataRow(
        ws,
        row,
        [{ align: 'center', value: ensure(plant.plant_code, false) }, ensure(plant.plant_name, false)],
        2,
        isAlt
    )
    addChangePct(ws.getCell(row, 4), changes.opsChange, isAlt)
    fillNumberCell(ws, row, 5, current.ops, undefined, isAlt)
    addChangePct(ws.getCell(row, 6), changes.runnableChange, isAlt)
    fillNumberCell(ws, row, 7, current.runnable, undefined, isAlt)
    addChangePct(ws.getCell(row, 8), changes.downChange, isAlt)
    fillNumberCell(ws, row, 9, current.down, undefined, isAlt)
    addChangePct(ws.getCell(row, 10), changes.yardageChange, isAlt)
    fillNumberCell(ws, row, 11, current.yardage, '#,##0', isAlt)
    addChangePct(ws.getCell(row, 12), changes.hoursChange, isAlt)
    fillNumberCell(ws, row, 13, current.hours, '#,##0.0', isAlt)

    ws.mergeCells(row, 14, row, 16)
    const notesCell = ws.getCell(row, 14)
    notesCell.value = ensure(form[`notes_${plant.plant_code}`], false)
    notesCell.font = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    notesCell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (isAlt) {
        notesCell.fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
        ws.getCell(row, 15).fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
        ws.getCell(row, 16).fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
    }
    ws.getRow(row).height = 20
}

/** Brand-tinted TOTAL row spanning all 5 metrics with merged notes column. */
function renderTotalRow(ws, row, totals, prevTotals, hasPrev) {
    const noChange = { color: null, text: '' }
    const opsChange = hasPrev ? getChangeValue(totals.totalOps, prevTotals.totalOps, false) : noChange
    const runnableChange = hasPrev ? getChangeValue(totals.totalRunnable, prevTotals.totalRunnable, false) : noChange
    const downChange = hasPrev ? getChangeValue(totals.totalDown, prevTotals.totalDown, true) : noChange
    const yardageChange = hasPrev ? getChangeText(totals.totalYardage, prevTotals.totalYardage, false) : noChange
    const hoursChange = hasPrev ? getChangeText(totals.totalHours, prevTotals.totalHours, false) : noChange

    ws.getCell(row, 2).value = ''
    ws.getCell(row, 2).fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    ws.getCell(row, 2).border = { top: { color: { argb: COLORS.brand }, style: 'medium' } }
    ws.getCell(row, 3).value = 'TOTAL'
    ws.getCell(row, 3).font = { bold: true, color: { argb: COLORS.brand }, name: 'Calibri', size: 11 }
    ws.getCell(row, 3).fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    ws.getCell(row, 3).border = { top: { color: { argb: COLORS.brand }, style: 'medium' } }
    ws.getCell(row, 3).alignment = { horizontal: 'right', vertical: 'middle' }

    applyTotalChangeCell(ws.getCell(row, 4), opsChange)
    applyTotalCell(ws.getCell(row, 5), totals.totalOps)
    applyTotalChangeCell(ws.getCell(row, 6), runnableChange)
    applyTotalCell(ws.getCell(row, 7), totals.totalRunnable)
    applyTotalChangeCell(ws.getCell(row, 8), downChange)
    applyTotalCell(ws.getCell(row, 9), totals.totalDown)
    applyTotalChangeCell(ws.getCell(row, 10), yardageChange)
    applyTotalCell(ws.getCell(row, 11), totals.totalYardage, '#,##0')
    applyTotalChangeCell(ws.getCell(row, 12), hoursChange)
    applyTotalCell(ws.getCell(row, 13), totals.totalHours, '#,##0.0')

    ws.mergeCells(row, 14, row, 16)
    for (let col = 14; col <= 16; col++) {
        ws.getCell(row, col).value = ''
        ws.getCell(row, col).fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
        ws.getCell(row, col).border = { top: { color: { argb: COLORS.brand }, style: 'medium' } }
    }
    ws.getRow(row).height = 24
}

/** "MTD (June)" / "YTD (2026)" summary row in slate-100 — no variance pills,
 *  just bare totals across the same five columns. */
function renderSummaryTotalRow(ws, row, label, totals, bgColor) {
    const fill = { fgColor: { argb: bgColor }, pattern: 'solid', type: 'pattern' }
    const small = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 10 }
    const cells = [
        { col: 2, value: '' },
        { align: 'right', bold: true, col: 3, value: label },
        { col: 4, value: '' },
        { col: 5, value: totals.ops },
        { col: 6, value: '' },
        { col: 7, value: totals.runnable },
        { col: 8, value: '' },
        { col: 9, value: totals.down },
        { col: 10, value: '' },
        { col: 11, numFmt: '#,##0', value: totals.yardage },
        { col: 12, value: '' },
        { col: 13, numFmt: '#,##0.0', value: totals.hours }
    ]
    cells.forEach(({ align, bold, col, numFmt, value }) => {
        const cell = ws.getCell(row, col)
        cell.value = value
        if (numFmt) cell.numFmt = numFmt
        cell.font = bold ? { ...small, bold: true } : small
        cell.fill = fill
        cell.alignment = { horizontal: align || 'left', vertical: 'middle' }
    })
    ws.mergeCells(row, 14, row, 16)
    ws.getCell(row, 14).value = ''
    for (let col = 14; col <= 16; col++) ws.getCell(row, col).fill = fill
    ws.getRow(row).height = 20
}

/** Filters `allMonthlyData` down to weeks ≤ current `weekIso`, returns each
 *  month as `{ ...m, reports: data[], weekIsos: Set }`. */
function filterReportsUpToWeek(allMonthlyData, weekIso) {
    return allMonthlyData
        .map((m) => {
            const filteredReports = m.reports.filter((r) => r.weekIso <= weekIso).map((r) => r.data)
            const filteredWeekIsos = new Set(m.reports.filter((r) => r.weekIso <= weekIso).map((r) => r.weekIso))
            return { ...m, reports: filteredReports, weekIsos: filteredWeekIsos }
        })
        .filter((m) => m.reports.length > 0)
}

/** Plant Summary section — per-plant rows + TOTAL + MTD/YTD summary rows.
 *  Returns the next row index. */
export function renderPlantSummary(ws, startRow, { allMonthlyData, form, prevGMData, sortedPlants, weekIso }) {
    let row = startRow
    addSectionTitle(ws, row, 'Plant Summary')
    row += 2
    addMergedTableHeaders(ws, row, PLANT_HEADERS)
    row++

    sortedPlants.forEach((plant, idx) => {
        renderPlantRow(ws, row, plant, form, prevGMData, idx)
        row++
    })

    const totals = computeWeekTotals(form, sortedPlants)
    const prevTotals = prevGMData ? computeWeekTotals(prevGMData, sortedPlants) : null
    renderTotalRow(ws, row, totals, prevTotals || {}, !!prevGMData)
    row++

    const currentWeekDate = weekIso ? new Date(weekIso + 'T00:00:00Z') : new Date()
    const currentMonthKey = `${currentWeekDate.getUTCFullYear()}-${String(currentWeekDate.getUTCMonth() + 1).padStart(2, '0')}`
    const currentYear = currentWeekDate.getUTCFullYear()
    const filteredMonthlyData = filterReportsUpToWeek(allMonthlyData, weekIso)
    const currentMonthData = filteredMonthlyData.find((m) => m.monthKey === currentMonthKey)
    const currentYearData = filteredMonthlyData.filter((m) => m.monthKey.startsWith(String(currentYear)))

    if (currentMonthData && currentMonthData.reports.length > 0) {
        const monthTotals = computePlantSummaryTotals(currentMonthData.reports, sortedPlants)
        renderSummaryTotalRow(ws, row, `MTD (${currentMonthData.monthName})`, monthTotals, COLORS.snow)
        row++
    }
    if (currentYearData.length > 0) {
        const allYearReports = currentYearData.flatMap((m) => m.reports)
        const yearTotals = computePlantSummaryTotals(allYearReports, sortedPlants)
        renderSummaryTotalRow(ws, row, `YTD (${currentYear})`, yearTotals, COLORS.snow)
        row++
    }
    return row + 2
}
