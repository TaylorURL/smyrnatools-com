import { WORKBOOK_CREATOR } from './ExportConstants'
import type { ExcelCell } from './ExportExcelStyles'

/**
 * Workbook lifecycle helpers — logo loading, ExcelJS workbook creation, blob
 * download, and the default landscape/fit-to-page setup applied to every
 * worksheet. ExcelJS is loaded lazily so the ~700KB library stays out of the
 * main bundle until an export is actually triggered. The workbook, worksheet,
 * row, and column shapes the export builders drive live here too.
 */

/** The page margins a worksheet prints with, in inches. */
interface PageMargins {
    bottom: number
    footer: number
    header: number
    left: number
    right: number
    top: number
}

/** The print setup a worksheet carries — page fitting, margins, and paper. */
interface PageSetup {
    fitToHeight: number
    fitToPage: boolean
    fitToWidth: number
    margins: PageMargins
    orientation: 'landscape' | 'portrait'
    paperSize: number
}

/** The slice of an ExcelJS column the export builders set. */
export interface ExcelColumn {
    width?: number
}

/** The slice of an ExcelJS row the export builders set. */
export interface ExcelRow {
    getCell(col: number): ExcelCell
    height?: number
}

/** Where an image sits on a worksheet: its top-left and bottom-right anchors
 *  in column/row coordinates, and how it behaves as cells resize. */
interface ImageRange {
    br: { col: number; row: number }
    editAs?: 'absolute' | 'oneCell' | 'twoCell'
    tl: { col: number; row: number }
}

/** The slice of an ExcelJS worksheet the export builders drive. */
export interface ExcelWorksheet {
    addImage(imageId: number, range: ImageRange): void
    getCell(row: number, col: number): ExcelCell
    getColumn(col: number): ExcelColumn
    getRow(row: number): ExcelRow
    mergeCells(top: number, left: number, bottom: number, right: number): void
    pageSetup?: PageSetup
}

/** The slice of an ExcelJS workbook the export builders drive. */
export interface ExcelWorkbook {
    addImage(image: { base64: string; extension: 'gif' | 'jpeg' | 'png' }): number
    xlsx: { writeBuffer(): Promise<BufferSource> }
}

export async function loadLogo(path = '/srm-logo.png'): Promise<string | null> {
    try {
        const logoResponse = await fetch(path)
        if (!logoResponse.ok) return null
        const blob = await logoResponse.blob()
        return await new Promise<string | null>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
                // readAsDataURL always lands a string in `result`; the guard is
                // what lets the ArrayBuffer half of the FileReader union go.
                const dataUrl = reader.result
                resolve(typeof dataUrl === 'string' ? dataUrl.split(',')[1] : null)
            }
            reader.readAsDataURL(blob)
        })
    } catch {
        return null
    }
}

export async function createWorkbook() {
    const excelModule = await import('exceljs')
    const ExcelLib = excelModule.default || excelModule
    const workbook = new ExcelLib.Workbook()
    workbook.creator = WORKBOOK_CREATOR
    workbook.created = new Date()
    workbook.modified = new Date()
    return { ExcelLib, wb: workbook }
}

export async function downloadWorkbook(workbook: ExcelWorkbook, filename: string): Promise<void> {
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    setTimeout(() => {
        URL.revokeObjectURL(url)
        anchor.remove()
    }, 0)
}

export function setDefaultPageSetup(worksheet: ExcelWorksheet): void {
    worksheet.pageSetup = {
        fitToHeight: 0,
        fitToPage: true,
        fitToWidth: 1,
        margins: { bottom: 0.5, footer: 0.3, header: 0.3, left: 0.4, right: 0.4, top: 0.5 },
        orientation: 'landscape',
        paperSize: 9
    }
}

export function getDefaultColumnWidths() {
    return [
        { width: 3 },
        { width: 10 },
        { width: 20 },
        { width: 7 },
        { width: 8 },
        { width: 7 },
        { width: 8 },
        { width: 7 },
        { width: 8 },
        { width: 7 },
        { width: 10 },
        { width: 7 },
        { width: 10 },
        { width: 15 },
        { width: 15 },
        { width: 15 }
    ]
}
