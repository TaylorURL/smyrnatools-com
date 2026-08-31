import { COLORS, SITE_URL } from './ExportConstants'
import {
    alignMiddle,
    applyHeaderStyle,
    BRAND_UNDERLINE_BORDER,
    buildFont,
    type CellValue,
    DATA_FONT,
    type ExcelCell,
    HEADER_FILL,
    HEADER_BORDER,
    type HorizontalAlignment,
    resolveChangeBgColor,
    type RichTextRun,
    solidFill,
    TOTAL_BORDER
} from './ExportExcelStyles'
import { type ChangeInfo, getChangeText, getChangeValue } from './ExportValueHelpers'
import type { ExcelWorkbook, ExcelWorksheet } from './ExportWorkbook'

/**
 * Worksheet layout builders: section titles, table headers flat and merged,
 * data rows, total and change cells, the report-header band, and the
 * multi-group overview section.
 *
 * A builder that advances down the sheet takes the worksheet and the row it
 * starts on and returns the next free row, so callers chain them
 * top-to-bottom without tracking the row count themselves. The ones that
 * style a single cell take the cell instead.
 */

/** A heading in a merged header band: its label, how many columns it spans,
 *  and where the label sits inside the span. */
export interface MergedTableHeader {
    align?: HorizontalAlignment
    label: string
    merge?: boolean
    mergeCount?: number
}

/** A data cell given as a value plus its presentation, rather than as a bare
 *  value that takes the row's default styling. */
export interface DataCellDescriptor {
    align?: HorizontalAlignment
    bold?: boolean
    color?: string
    format?: string
    richText?: RichTextRun[]
    value?: CellValue
}

/** One cell of a data row — a bare value, or a descriptor that styles it. */
export type DataRowValue = DataCellDescriptor | string | number

/** One metric line inside an overview group: the label, the current value, the
 *  previous-period value it is measured against, and its presentation. */
export interface OverviewMetric {
    color?: string
    format?: string
    invertChange?: boolean
    label: string
    prev?: number
    suffix?: string
    useValue?: boolean
    value: number
}

/** A titled run of metric lines inside an overview section. */
export interface OverviewGroup {
    metrics: OverviewMetric[]
    title: string
}

/** The formatter an overview section turns a period pair into a delta with.
 *  Both `getChangeText` and `getChangeValue` fit it. */
export type ChangeFormatter = (
    current: number,
    previous: number | null | undefined,
    invertColors: boolean
) => ChangeInfo

/** The writer that lands a formatted delta in a cell. `addChangePct` fits it. */
export type ChangeCellWriter = (cell: ExcelCell, changeInfo: ChangeInfo | null | undefined, isAlt: boolean) => void

/** The report-header band's content and the row it starts on. */
export interface ReportHeaderOptions {
    logoBase64?: string | null
    row?: number
    subtitle?: string | null
    title: string
}

/** An overview section's placement, title, metric groups, and the change
 *  helpers it renders with. */
export interface OverviewSectionOptions {
    addChangePct?: ChangeCellWriter
    getChangeText?: ChangeFormatter
    getChangeValue?: ChangeFormatter
    groups: OverviewGroup[]
    startCol: number
    startRow: number
    title: string
}

export function addSectionTitle(worksheet: ExcelWorksheet, row: number, text: string): void {
    worksheet.mergeCells(row, 2, row, 12)
    const cell = worksheet.getCell(row, 2)
    cell.value = text
    cell.font = buildFont(14, COLORS.brand, { bold: true })
    cell.alignment = alignMiddle('left')
    for (let col = 2; col <= 16; col++) {
        worksheet.getCell(row, col).border = BRAND_UNDERLINE_BORDER
    }
    worksheet.getRow(row).height = 28
}

export function addTableHeaders(worksheet: ExcelWorksheet, row: number, headers: string[], startCol = 2): void {
    headers.forEach((header, idx) => applyHeaderStyle(worksheet.getCell(row, startCol + idx), header))
    worksheet.getRow(row).height = 22
}

export function addMergedTableHeaders(
    worksheet: ExcelWorksheet,
    row: number,
    headers: MergedTableHeader[],
    startCol = 2
): void {
    let col = startCol
    headers.forEach((header) => {
        const mergeCount = header.mergeCount || (header.merge ? 2 : 1)
        const alignment = header.align || 'center'
        if (mergeCount > 1) worksheet.mergeCells(row, col, row, col + mergeCount - 1)
        applyHeaderStyle(worksheet.getCell(row, col), header.label, alignment)
        for (let offset = 1; offset < mergeCount; offset++) {
            const mergedCell = worksheet.getCell(row, col + offset)
            mergedCell.fill = HEADER_FILL
            mergedCell.border = HEADER_BORDER
        }
        col += mergeCount
    })
    worksheet.getRow(row).height = 22
}

export function addChangePct(cell: ExcelCell, changeInfo: ChangeInfo | null | undefined, isAlt = false): void {
    if (!changeInfo?.text) {
        cell.value = ''
        if (isAlt) cell.fill = solidFill(COLORS.snow)
    } else {
        cell.value = changeInfo.text.trim()
        cell.font = buildFont(8, changeInfo.color!, { bold: true })
        const bgColor = resolveChangeBgColor(changeInfo.color, isAlt)
        if (bgColor) cell.fill = solidFill(bgColor)
    }
    cell.alignment = alignMiddle('right')
}

export function addDataRow(
    worksheet: ExcelWorksheet,
    row: number,
    values: DataRowValue[],
    startCol = 2,
    isAlt = false
): void {
    values.forEach((value, idx) => {
        const cell = worksheet.getCell(row, startCol + idx)
        if (typeof value === 'object' && value !== null) {
            cell.value = value.richText ? { richText: value.richText } : value.value
            if (value.format) cell.numFmt = value.format
            cell.alignment = alignMiddle(value.align || 'left')
            cell.font = value.color
                ? buildFont(11, value.color, { bold: value.bold })
                : value.richText
                  ? undefined
                  : DATA_FONT
        } else {
            cell.value = value
            cell.font = DATA_FONT
            cell.alignment = alignMiddle(typeof value === 'number' ? 'right' : 'left')
        }
        if (isAlt) cell.fill = solidFill(COLORS.snow)
    })
    worksheet.getRow(row).height = 20
}

export function applySubtleBackground(worksheet: ExcelWorksheet, maxRow = 200, maxCol = 30): void {
    for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
        const row = worksheet.getRow(rowNum)
        for (let colNum = 1; colNum <= maxCol; colNum++) {
            const cell = row.getCell(colNum)
            if (!cell.fill?.fgColor || cell.fill.fgColor.argb === COLORS.white) {
                cell.fill = solidFill(COLORS.subtleGray)
            }
        }
    }
}

export function applyTotalCell(cell: ExcelCell, value: CellValue, format?: string): void {
    cell.value = value
    if (format) cell.numFmt = format
    cell.font = buildFont(11, COLORS.brand, { bold: true })
    cell.fill = HEADER_FILL
    cell.border = TOTAL_BORDER
    cell.alignment = alignMiddle('left')
}

export function applyTotalChangeCell(cell: ExcelCell, changeInfo: ChangeInfo | null | undefined): void {
    cell.value = changeInfo?.text?.trim() || ''
    if (changeInfo?.text) {
        cell.font = buildFont(9, changeInfo.color!, { bold: true })
    }
    cell.fill = HEADER_FILL
    cell.border = TOTAL_BORDER
    cell.alignment = alignMiddle('right')
}

export function addReportHeader(
    worksheet: ExcelWorksheet,
    workbook: ExcelWorkbook,
    { logoBase64, title, subtitle, row = 2 }: ReportHeaderOptions
): number {
    let currentRow = row
    if (logoBase64) {
        worksheet.mergeCells(currentRow, 2, currentRow + 2, 3)
        const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' })
        worksheet.addImage(imageId, {
            br: { col: 3, row: currentRow + 2 },
            editAs: 'oneCell',
            tl: { col: 1, row: currentRow - 1 }
        })
    }
    worksheet.mergeCells(currentRow, 5, currentRow, 12)
    const titleCell = worksheet.getCell(currentRow, 5)
    titleCell.value = title
    titleCell.font = buildFont(26, COLORS.brand, { bold: true })
    titleCell.alignment = alignMiddle('left')
    worksheet.getRow(currentRow).height = 36
    currentRow++
    if (subtitle) {
        worksheet.mergeCells(currentRow, 5, currentRow, 9)
        const subtitleCell = worksheet.getCell(currentRow, 5)
        subtitleCell.value = subtitle
        subtitleCell.font = buildFont(13, COLORS.slate700)
        subtitleCell.alignment = alignMiddle('left')
        currentRow++
    }
    worksheet.mergeCells(currentRow, 5, currentRow, 12)
    const dateCell = worksheet.getCell(currentRow, 5)
    const generatedDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    dateCell.value = { hyperlink: SITE_URL, text: `Generated on ${generatedDate} on smyrnatools.com` }
    dateCell.font = buildFont(10, COLORS.slate500, { italic: true, underline: true })
    currentRow += 2
    return currentRow
}

/** Renders a single metric row (label, change cell, value) inside an
 *  overview-section group. */
function renderOverviewMetric(
    worksheet: ExcelWorksheet,
    row: number,
    col: number,
    metric: OverviewMetric,
    isAlt: boolean,
    resolvedGetChangeText: ChangeFormatter,
    resolvedGetChangeValue: ChangeFormatter,
    resolvedAddChangePct: ChangeCellWriter
): void {
    const bgColor = isAlt ? COLORS.snow : null

    const labelCell = worksheet.getCell(row, col)
    labelCell.value = metric.label
    labelCell.font = buildFont(10, COLORS.slate500)
    labelCell.alignment = alignMiddle('left')
    if (bgColor) labelCell.fill = solidFill(bgColor)

    const changeInfo: ChangeInfo =
        metric.prev !== undefined
            ? metric.useValue
                ? resolvedGetChangeValue(metric.value, metric.prev, metric.invertChange || false)
                : resolvedGetChangeText(metric.value, metric.prev, metric.invertChange || false)
            : { color: null, text: '' }
    const changeCell = worksheet.getCell(row, col + 1)
    resolvedAddChangePct(changeCell, changeInfo, isAlt)
    if (bgColor && !changeInfo?.text) changeCell.fill = solidFill(bgColor)

    const valueCell = worksheet.getCell(row, col + 2)
    valueCell.value = metric.suffix ? metric.value + metric.suffix : metric.value
    if (!metric.suffix && metric.format) valueCell.numFmt = metric.format
    valueCell.font = buildFont(12, metric.color || COLORS.brand, { bold: true })
    valueCell.alignment = alignMiddle('left')
    if (bgColor) valueCell.fill = solidFill(bgColor)

    worksheet.getRow(row).height = 20
}

export function addOverviewSection(
    worksheet: ExcelWorksheet,
    {
        startRow,
        startCol,
        title,
        groups,
        getChangeText: getChangeTextFn,
        getChangeValue: getChangeValueFn,
        addChangePct: addChangePctFn
    }: OverviewSectionOptions
): number {
    const col = startCol
    let row = startRow
    worksheet.getColumn(col).width = 14
    worksheet.getColumn(col + 1).width = 8
    worksheet.getColumn(col + 2).width = 10

    worksheet.mergeCells(row, col, row, col + 2)
    const titleCell = worksheet.getCell(row, col)
    titleCell.value = title
    titleCell.font = buildFont(16, COLORS.white, { bold: true })
    titleCell.fill = solidFill(COLORS.brand)
    titleCell.alignment = alignMiddle('center')
    worksheet.getCell(row, col + 1).fill = solidFill(COLORS.brand)
    worksheet.getCell(row, col + 2).fill = solidFill(COLORS.brand)
    worksheet.getRow(row).height = 28
    row += 2

    const resolvedGetChangeText = getChangeTextFn || getChangeText
    const resolvedGetChangeValue = getChangeValueFn || getChangeValue
    const resolvedAddChangePct = addChangePctFn || addChangePct

    groups.forEach((group) => {
        worksheet.mergeCells(row, col, row, col + 2)
        const groupCell = worksheet.getCell(row, col)
        groupCell.value = group.title
        groupCell.font = buildFont(11, COLORS.slate700, { bold: true })
        groupCell.fill = HEADER_FILL
        groupCell.alignment = alignMiddle('left')
        worksheet.getCell(row, col + 1).fill = HEADER_FILL
        worksheet.getCell(row, col + 2).fill = HEADER_FILL
        worksheet.getRow(row).height = 20
        row++

        group.metrics.forEach((metric, idx) => {
            renderOverviewMetric(
                worksheet,
                row,
                col,
                metric,
                idx % 2 === 1,
                resolvedGetChangeText,
                resolvedGetChangeValue,
                resolvedAddChangePct
            )
            row++
        })
        row++
    })
    return row
}
