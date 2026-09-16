import { COLORS, FONT_CALIBRI } from './ExportConstants'

/**
 * Reusable ExcelJS style builders — fonts, fills, alignments, borders, and
 * the header helper. All visual style decisions for exported workbooks flow
 * through this module so palette or typeface changes happen in one place.
 */

/** The weight, slant, and underline flags a caller may ask for on top of the
 *  size and color every font carries. */
interface FontOptions {
    bold?: boolean
    italic?: boolean
    underline?: boolean
}

/** An ExcelJS font descriptor. The three style flags are set only when asked
 *  for, since ExcelJS treats an absent key and an explicit false alike. */
interface FontStyle extends FontOptions {
    color: { argb: string }
    name: string
    size: number
}

/** The horizontal placements the export builders ask for on a cell. */
export type HorizontalAlignment = 'center' | 'left' | 'right'

/** A single-color cell fill, in the pattern form ExcelJS expects. */
interface SolidFill {
    fgColor: { argb: string }
    pattern: 'solid'
    type: 'pattern'
}

/** Vertically centered alignment carrying the caller's horizontal placement. */
interface CellAlignment {
    horizontal: HorizontalAlignment
    vertical: 'middle'
}

/** One edge of a cell's border box. */
interface BorderSide {
    color: { argb: string }
    style: 'medium' | 'thin'
}

/** The edges a cell draws a border on. An absent edge is left unruled. */
interface CellBorders {
    bottom?: BorderSide
    left?: BorderSide
    right?: BorderSide
    top?: BorderSide
}

/** A styled run inside a rich-text cell value. */
export interface RichTextRun {
    font?: FontStyle
    text: string
}

/** Everything the export builders write into a cell — a plain value, a list of
 *  rich-text runs, or a link with the text that stands in for it. */
export type CellValue =
    string | number | boolean | Date | null | { richText: RichTextRun[] } | { hyperlink: string; text: string }

/** The slice of an ExcelJS cell the export builders read and write. */
export interface ExcelCell {
    alignment?: CellAlignment
    border?: CellBorders
    fill?: SolidFill
    font?: FontStyle
    numFmt?: string
    value?: CellValue
}

/**
 * Build a Calibri font descriptor. Every font in the workbook flows through here
 * so a typeface change only requires editing one line.
 */
export function buildFont(size: number, colorArgb: string, { bold, italic, underline }: FontOptions = {}): FontStyle {
    const font: FontStyle = { color: { argb: colorArgb }, name: FONT_CALIBRI, size }
    if (bold) font.bold = true
    if (italic) font.italic = true
    if (underline) font.underline = true
    return font
}

export function solidFill(argb: string): SolidFill {
    return { fgColor: { argb }, pattern: 'solid', type: 'pattern' }
}

export function alignMiddle(horizontal: HorizontalAlignment): CellAlignment {
    return { horizontal, vertical: 'middle' }
}

const HEADER_FONT = buildFont(10, COLORS.slate700, { bold: true })
const HEADER_FILL = solidFill(COLORS.slate100)
const HEADER_BORDER: CellBorders = { bottom: { color: { argb: COLORS.slate300 }, style: 'thin' } }
export const BRAND_UNDERLINE_BORDER: CellBorders = { bottom: { color: { argb: COLORS.brand }, style: 'medium' } }
export const DATA_FONT = buildFont(11, COLORS.slate700)

export function applyHeaderStyle(cell: ExcelCell, label: string, alignment: HorizontalAlignment = 'center'): void {
    cell.value = label
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = alignMiddle(alignment)
    cell.border = HEADER_BORDER
}
