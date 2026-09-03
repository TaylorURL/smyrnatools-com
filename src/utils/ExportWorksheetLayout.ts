import { COLORS, SITE_URL } from './ExportConstants'
import {
    alignMiddle,
    applyHeaderStyle,
    BRAND_UNDERLINE_BORDER,
    buildFont,
    type CellValue,
    DATA_FONT,
    type HorizontalAlignment,
    type RichTextRun,
    solidFill
} from './ExportExcelStyles'
import type { ExcelWorkbook, ExcelWorksheet } from './ExportWorkbook'
import { formatCentralDate } from './PlanUtility'

/**
 * Worksheet layout builders: section titles, table headers, data rows, and
 * the report-header band.
 *
 * A builder that advances down the sheet takes the worksheet and the row it
 * starts on and returns the next free row, so callers chain them
 * top-to-bottom without tracking the row count themselves.
 */

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

/** The report-header band's content and the row it starts on. */
export interface ReportHeaderOptions {
    logoBase64?: string | null
    row?: number
    subtitle?: string | null
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
    const generatedDate = formatCentralDate(new Date())
    dateCell.value = { hyperlink: SITE_URL, text: `Generated on ${generatedDate} on smyrnatools.com` }
    dateCell.font = buildFont(10, COLORS.slate500, { italic: true, underline: true })
    currentRow += 2
    return currentRow
}
