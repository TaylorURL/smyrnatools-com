import { ReportService } from '../../../../../../services/ReportService'
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
    truncateToTenth
} from '../../../../../../utils/ExportUtility'

const EFF_HEADERS = [
    { label: 'Plant', merge: false },
    { align: 'left', label: 'Name', merge: false },
    { label: 'Date', merge: false },
    { label: 'Loads', merge: true },
    { label: 'Hours', merge: true },
    { label: 'L/H/O', merge: true },
    { label: 'Start', merge: true },
    { label: 'End', merge: true }
]

const NO_CHANGE = { color: null, text: '' }

/** Snow tint on the alternate-row cells (cols 6..14 for the metric strip). */
function applyAltFill(ws, row, fromCol, toCol) {
    for (let col = fromCol; col <= toCol; col++) {
        ws.getCell(row, col).fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
    }
}

/** Renders a single value cell with alt-row tint and slate-700 text. */
function renderValueCell(ws, row, col, value, numFmt, isAlt, fontOverride) {
    const cell = ws.getCell(row, col)
    cell.value = value
    if (numFmt) cell.numFmt = numFmt
    cell.font = fontOverride || { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (isAlt) cell.fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
}

/** Extracts the five metrics from an efficiency report's rows. */
function extractInsights(report, plantOps) {
    const insights = ReportService.getPlantProductionInsights(report.rows || [])
    return {
        endMin: truncateToTenth(insights.avgElapsedEnd),
        hours: truncateToTenth(insights.totalHours),
        loads: insights.totalLoads || 0,
        lph: truncateToTenth(truncateToTenth(insights.avgLoadsPerHour) * plantOps),
        startMin: truncateToTenth(insights.avgElapsedStart)
    }
}

function isShutDown({ endMin, hours, loads, startMin }) {
    return (
        loads === 0 &&
        (hours === null || hours === 0 || isNaN(hours)) &&
        (startMin === null || isNaN(startMin)) &&
        (endMin === null || isNaN(endMin))
    )
}

/** Renders the "Plant Shut Down" merged cell spanning the metric columns. */
function renderShutDownRow(ws, row, isAlt) {
    ws.mergeCells(row, 5, row, 14)
    const cell = ws.getCell(row, 5)
    cell.value = 'Plant Shut Down'
    cell.font = { color: { argb: COLORS.slate500 }, italic: true, name: 'Calibri', size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    if (isAlt) applyAltFill(ws, row, 5, 14)
    ws.getRow(row).height = 20
}

/** Filters out "new" change text — used in the eff table where a brand-new
 *  plant for the week shouldn't show a misleading variance. */
function filterNewChange(change) {
    return change.text && change.text.includes('new') ? NO_CHANGE : change
}

/** Builds the variance pills for one efficiency row. */
function buildEffChanges(current, prev, hasPrev) {
    if (!hasPrev) return Array(5).fill(NO_CHANGE)
    return [
        filterNewChange(getChangeText(current.loads, prev.loads, false)),
        filterNewChange(getChangeText(current.hours, prev.hours, false)),
        filterNewChange(getChangeText(current.lph, prev.lph, false)),
        filterNewChange(getChangeText(current.startMin, prev.startMin, true)),
        filterNewChange(getChangeText(current.endMin, prev.endMin, true))
    ]
}

function getLphFont(lph) {
    return {
        bold: lph >= 2 || lph < 1.5,
        color: { argb: lph >= 2 ? COLORS.success : lph < 1.5 ? COLORS.danger : COLORS.slate700 },
        name: 'Calibri',
        size: 11
    }
}

/** Renders one efficiency report row — plant + date + 5 (variance, value) pairs. */
function renderEffRow(ws, row, effReport, prevEffReport, form, prevGMData, sortedPlants, idx) {
    const plantOps = ensure(form[`active_operators_${effReport.plant_code}`], true)
    const current = extractInsights(effReport, plantOps)
    const plantInfo = sortedPlants.find((p) => String(p.plant_code) === String(effReport.plant_code))
    const plantName = plantInfo?.plant_name || plantInfo?.name || effReport.plant_code
    const reportDate = effReport.report_date || ''
    const formattedDate = reportDate
        ? new Date(reportDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
        : ''
    const isAlt = idx % 2 === 1

    addDataRow(
        ws,
        row,
        [
            { align: 'center', value: ensure(effReport.plant_code, false) },
            plantName,
            { align: 'center', value: formattedDate }
        ],
        2,
        isAlt
    )
    if (isShutDown(current)) {
        renderShutDownRow(ws, row, isAlt)
        return
    }

    const prevPlantOps = prevGMData ? ensure(prevGMData[`active_operators_${effReport.plant_code}`], true) : plantOps
    const prev = prevEffReport ? extractInsights(prevEffReport, prevPlantOps) : null
    const [loadsCh, hoursCh, lphCh, startCh, endCh] = buildEffChanges(current, prev || {}, !!prevEffReport)

    addChangePct(ws.getCell(row, 5), loadsCh, isAlt)
    renderValueCell(ws, row, 6, current.loads, undefined, isAlt)
    addChangePct(ws.getCell(row, 7), hoursCh, isAlt)
    renderValueCell(ws, row, 8, current.hours, '#,##0.0', isAlt)
    addChangePct(ws.getCell(row, 9), lphCh, isAlt)
    renderValueCell(ws, row, 10, current.lph, '#,##0.0', isAlt, getLphFont(current.lph))
    addChangePct(ws.getCell(row, 11), startCh, isAlt)
    renderValueCell(ws, row, 12, current.startMin, '#,##0.0', isAlt)
    addChangePct(ws.getCell(row, 13), endCh, isAlt)
    renderValueCell(ws, row, 14, current.endMin, '#,##0.0', isAlt)
    ws.getRow(row).height = 20
}

/** Aggregates totals + averages across all eff reports for the AVERAGES row. */
function aggregateEffTotals(effReports, sourceForm) {
    let totalLoads = 0,
        totalHours = 0,
        totalLph = 0,
        totalStart = 0,
        totalEnd = 0,
        count = 0
    effReports.forEach((er) => {
        const insights = ReportService.getPlantProductionInsights(er.rows || [])
        const plantOps = ensure(sourceForm[`active_operators_${er.plant_code}`], true)
        totalLoads += insights.totalLoads || 0
        totalHours += truncateToTenth(insights.totalHours) || 0
        totalLph += truncateToTenth(insights.avgLoadsPerHour) * plantOps || 0
        totalStart += truncateToTenth(insights.avgElapsedStart) || 0
        totalEnd += truncateToTenth(insights.avgElapsedEnd) || 0
        count++
    })
    return {
        avgEnd: count > 0 ? truncateToTenth(totalEnd / count) : 0,
        avgLph: count > 0 ? truncateToTenth(totalLph / count) : 0,
        avgStart: count > 0 ? truncateToTenth(totalStart / count) : 0,
        count,
        totalHours,
        totalLoads
    }
}

/** Brand-tinted AVERAGES row with totals + averages + variance pills. */
function renderAveragesRow(ws, row, current, previous) {
    const hasPrev = previous.count > 0
    const noChange = NO_CHANGE
    const changes = hasPrev
        ? {
              effEnd: getChangeText(current.avgEnd, previous.avgEnd, true),
              effHours: getChangeText(current.totalHours, previous.totalHours, false),
              effLoads: getChangeText(current.totalLoads, previous.totalLoads, false),
              effLph: getChangeText(current.avgLph, previous.avgLph, false),
              effStart: getChangeText(current.avgStart, previous.avgStart, true)
          }
        : { effEnd: noChange, effHours: noChange, effLoads: noChange, effLph: noChange, effStart: noChange }

    ws.getCell(row, 2).value = ''
    ws.getCell(row, 2).fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    ws.getCell(row, 2).border = { top: { color: { argb: COLORS.brand }, style: 'medium' } }
    ws.mergeCells(row, 3, row, 4)
    ws.getCell(row, 3).value = 'AVERAGES'
    ws.getCell(row, 3).font = { bold: true, color: { argb: COLORS.brand }, name: 'Calibri', size: 11 }
    ws.getCell(row, 3).fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    ws.getCell(row, 3).border = { top: { color: { argb: COLORS.brand }, style: 'medium' } }
    ws.getCell(row, 3).alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getCell(row, 4).fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    ws.getCell(row, 4).border = { top: { color: { argb: COLORS.brand }, style: 'medium' } }

    applyTotalChangeCell(ws.getCell(row, 5), changes.effLoads)
    applyTotalCell(ws.getCell(row, 6), current.totalLoads)
    applyTotalChangeCell(ws.getCell(row, 7), changes.effHours)
    applyTotalCell(ws.getCell(row, 8), current.totalHours, '#,##0.0')
    applyTotalChangeCell(ws.getCell(row, 9), changes.effLph)
    applyTotalCell(ws.getCell(row, 10), current.avgLph, '#,##0.0')
    applyTotalChangeCell(ws.getCell(row, 11), changes.effStart)
    applyTotalCell(ws.getCell(row, 12), current.avgStart + ' mins')
    applyTotalChangeCell(ws.getCell(row, 13), changes.effEnd)
    applyTotalCell(ws.getCell(row, 14), current.avgEnd + ' mins')
    ws.getRow(row).height = 24
}

/** "Efficiency Overview" section — per-plant productivity insights with
 *  variance vs. the previous week. */
export function renderEfficiencyOverview(ws, startRow, { effReports, form, prevEffReports, prevGMData, sortedPlants }) {
    if (effReports.length === 0) return startRow
    let row = startRow
    addSectionTitle(ws, row, 'Efficiency Overview')
    row += 2
    addMergedTableHeaders(ws, row, EFF_HEADERS)
    row++

    effReports.forEach((er, idx) => {
        const prevEr = prevEffReports.find((p) => String(p.plant_code) === String(er.plant_code))
        renderEffRow(ws, row, er, prevEr, form, prevGMData, sortedPlants, idx)
        row++
    })

    const current = aggregateEffTotals(effReports, form)
    const previous = aggregateEffTotals(prevEffReports, prevGMData || form)
    renderAveragesRow(ws, row, current, previous)
    return row + 3
}
