import {
    addChangePct,
    addMergedTableHeaders,
    addSectionTitle,
    COLORS,
    getChangeText
} from '../../../../../../utils/ExportUtility'

const AGG_HEADERS = [
    { align: 'left', label: 'Material', mergeCount: 2 },
    { label: 'This Week', merge: true },
    { label: 'YTD', merge: false }
]

const AGG_FIELDS = [
    ['sand', 'Sand'],
    ['fill_dirt', 'Fill Dirt'],
    ['black_dirt', 'Black Dirt'],
    ['select_fill', 'Select Fill'],
    ['crushed_concrete', 'Freeport Crushed Concrete'],
    ['houston_crushed_concrete', 'Houston Crushed Concrete'],
    ['three_by_five_crushed', '3 x 5 Crushed'],
    ['stabilized_sand', 'Stabilized Sand'],
    ['stabilized_crushed_concrete', 'Stabilized Crushed Concrete'],
    ['beach_quality_sand', 'Beach Quality Sand'],
    ['limestone_one_inch', 'Limestone - 1"'],
    ['white_screened_sand', 'White Screened Sand'],
    ['unscreened_white_sand', 'Unscreened White Sand'],
    ['pea_gravel_three_eighths', '3/8" Pea Gravel'],
    ['crushed_asphalt', 'Crushed Asphalt'],
    ['screened_sand', 'Screened Sand'],
    ['washout', 'Washout'],
    ['rip_rap', 'Rip Rap']
]

const NO_CHANGE = { color: null, text: '' }

function toNumber(value) {
    return value === undefined || value === null || value === '' ? 0 : Number(value)
}

/** Sums up aggregate report values for each field across all `reports`. */
function aggregateYtd(reports) {
    const totals = {}
    AGG_FIELDS.forEach(([key]) => {
        totals[key] = 0
    })
    reports.forEach((data) => {
        if (!data) return
        AGG_FIELDS.forEach(([key]) => {
            totals[key] += toNumber(data[key])
        })
    })
    return totals
}

/** Single material row — label, variance pill, this-week value, YTD value. */
function renderMaterialRow(ws, row, label, raw, prevRaw, ytdVal, isAlt, hasPrev) {
    const changeInfo = hasPrev ? getChangeText(raw, prevRaw, false) : NO_CHANGE

    ws.mergeCells(row, 2, row, 3)
    const labelCell = ws.getCell(row, 2)
    labelCell.value = label
    labelCell.font = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (isAlt) {
        labelCell.fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
        ws.getCell(row, 3).fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
    }
    addChangePct(ws.getCell(row, 4), changeInfo, isAlt)

    const valCell = ws.getCell(row, 5)
    valCell.value = raw
    valCell.numFmt = '#,##0.0'
    valCell.font = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    valCell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (isAlt) valCell.fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }

    const ytdCell = ws.getCell(row, 6)
    ytdCell.value = ytdVal
    ytdCell.numFmt = '#,##0.0'
    ytdCell.font = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    ytdCell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (isAlt) ytdCell.fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
    ws.getRow(row).height = 20
}

/** Brand-tinted TOTAL row across material + change + week-total + ytd-total. */
function renderTotalRow(ws, row, aggTotal, prevAggTotal, ytdTotal, hasPrev) {
    const changeInfo = hasPrev ? getChangeText(aggTotal, prevAggTotal, false) : NO_CHANGE
    const tintFill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    const topBorder = { top: { color: { argb: COLORS.brand }, style: 'medium' } }

    ws.mergeCells(row, 2, row, 3)
    const labelCell = ws.getCell(row, 2)
    labelCell.value = 'TOTAL'
    labelCell.font = { bold: true, color: { argb: COLORS.brand }, name: 'Calibri', size: 11 }
    labelCell.fill = tintFill
    labelCell.border = topBorder
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getCell(row, 3).fill = tintFill
    ws.getCell(row, 3).border = topBorder

    const changeCell = ws.getCell(row, 4)
    if (changeInfo && changeInfo.text) {
        changeCell.value = changeInfo.text.trim()
        changeCell.font = { bold: true, color: { argb: changeInfo.color }, name: 'Calibri', size: 9 }
    } else {
        changeCell.value = ''
    }
    changeCell.fill = tintFill
    changeCell.border = topBorder
    changeCell.alignment = { horizontal: 'right', vertical: 'middle' }

    const totalValCell = ws.getCell(row, 5)
    totalValCell.value = aggTotal
    totalValCell.numFmt = '#,##0.0'
    totalValCell.font = { bold: true, color: { argb: COLORS.brand }, name: 'Calibri', size: 11 }
    totalValCell.fill = tintFill
    totalValCell.border = topBorder
    totalValCell.alignment = { horizontal: 'left', vertical: 'middle' }

    const ytdTotalCell = ws.getCell(row, 6)
    ytdTotalCell.value = ytdTotal
    ytdTotalCell.numFmt = '#,##0.0'
    ytdTotalCell.font = { bold: true, color: { argb: COLORS.brand }, name: 'Calibri', size: 11 }
    ytdTotalCell.fill = tintFill
    ytdTotalCell.border = topBorder
    ytdTotalCell.alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(row).height = 24
}

/** "Aggregate Production" section — material variance table + bottom total.
 *  Skipped entirely when no aggregate report is available for the week. */
export function renderAggregateProduction(ws, startRow, { aggregateReport, allAggReports, prevAggregateReport }) {
    if (!aggregateReport) return startRow
    let row = startRow
    addSectionTitle(ws, row, 'Aggregate Production')
    row += 2
    addMergedTableHeaders(ws, row, AGG_HEADERS)
    row++

    const ytdTotals = aggregateYtd(allAggReports.yearly)
    const dataSource = aggregateReport?.data || {}
    const prevDataSource = prevAggregateReport?.data || {}
    let aggTotal = 0
    let prevAggTotal = 0
    let ytdTotal = 0
    AGG_FIELDS.forEach(([key, label], idx) => {
        const raw = toNumber(dataSource[key])
        const prevRaw = toNumber(prevDataSource[key])
        const ytdVal = ytdTotals[key] || 0
        aggTotal += raw
        prevAggTotal += prevRaw
        ytdTotal += ytdVal
        renderMaterialRow(ws, row, label, raw, prevRaw, ytdVal, idx % 2 === 1, !!prevAggregateReport)
        row++
    })
    if (aggTotal > 0) {
        renderTotalRow(ws, row, aggTotal, prevAggTotal, ytdTotal, !!prevAggregateReport)
        row++
    }
    return row + 2
}
