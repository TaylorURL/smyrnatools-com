import { addChangePct, COLORS, getChangeText, getChangeValue } from '../../../../../../utils/ExportUtility'

/** Brand-colored title block spanning `span` columns. */
export function addSidebarTitle(ws, row, col, title, span = 3) {
    ws.mergeCells(row, col, row, col + span - 1)
    const titleCell = ws.getCell(row, col)
    titleCell.value = title
    titleCell.font = { bold: true, color: { argb: COLORS.white }, name: 'Calibri', size: 16 }
    titleCell.fill = { fgColor: { argb: COLORS.brand }, pattern: 'solid', type: 'pattern' }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    for (let offset = 1; offset < span; offset++) {
        ws.getCell(row, col + offset).fill = { fgColor: { argb: COLORS.brand }, pattern: 'solid', type: 'pattern' }
    }
    ws.getRow(row).height = 28
}

/** Three-column header strip used at the top of each metric group. */
function fillGroupHeaderRow(ws, row, col, span, title) {
    ws.mergeCells(row, col, row, col + span - 1)
    const groupCell = ws.getCell(row, col)
    groupCell.value = title
    groupCell.font = { bold: true, color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    groupCell.fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    groupCell.alignment = { horizontal: 'left', vertical: 'middle' }
    for (let offset = 1; offset < span; offset++) {
        ws.getCell(row, col + offset).fill = {
            fgColor: { argb: COLORS.slate100 },
            pattern: 'solid',
            type: 'pattern'
        }
    }
    ws.getRow(row).height = 20
}

/** Single metric row — label + variance pill + value, with alternating snow
 *  fill for readability. */
function fillMetricRow(ws, row, col, metric, isAlt) {
    const bgColor = isAlt ? COLORS.snow : null
    const labelCell = ws.getCell(row, col)
    labelCell.value = metric.label
    labelCell.font = { color: { argb: COLORS.slate500 }, name: 'Calibri', size: 10 }
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (bgColor) labelCell.fill = { fgColor: { argb: bgColor }, pattern: 'solid', type: 'pattern' }

    const changeInfo =
        metric.prev !== undefined
            ? metric.useValue
                ? getChangeValue(metric.value, metric.prev, metric.invertChange || false)
                : getChangeText(metric.value, metric.prev, metric.invertChange || false)
            : { color: null, text: '' }
    const changeCell = ws.getCell(row, col + 1)
    addChangePct(changeCell, changeInfo, isAlt)
    if (bgColor && (!changeInfo || !changeInfo.text)) {
        changeCell.fill = { fgColor: { argb: bgColor }, pattern: 'solid', type: 'pattern' }
    }

    const valueCell = ws.getCell(row, col + 2)
    if (metric.suffix) {
        valueCell.value = metric.value + metric.suffix
    } else {
        valueCell.value = metric.value
        if (metric.format) valueCell.numFmt = metric.format
    }
    valueCell.font = { bold: true, color: { argb: metric.color || COLORS.brand }, name: 'Calibri', size: 12 }
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    if (bgColor) valueCell.fill = { fgColor: { argb: bgColor }, pattern: 'solid', type: 'pattern' }
    ws.getRow(row).height = 20
}

/** Sidebar metric group — header row + N metric rows + trailing spacer.
 *  Returns the row index after the group. */
export function addSidebarGroup(ws, startRow, col, title, metrics) {
    let row = startRow
    fillGroupHeaderRow(ws, row, col, 3, title)
    row++
    metrics.forEach((metric, idx) => {
        fillMetricRow(ws, row, col, metric, idx % 2 === 1)
        row++
    })
    return row + 1
}
