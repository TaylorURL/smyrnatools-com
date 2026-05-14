import { COLORS } from '../../../../../../utils/ExportUtility'

const AI_HEADER_ROW = 2
const AI_BODY_TOP = 3
const AI_BODY_BOTTOM = 5
const AI_COL_START = 18
const AI_COL_END = 27

/** Fills the entire range with a solid color — used for the AI body block. */
function fillRange(ws, topRow, bottomRow, leftCol, rightCol, argb) {
    for (let row = topRow; row <= bottomRow; row++) {
        for (let col = leftCol; col <= rightCol; col++) {
            ws.getCell(row, col).fill = { fgColor: { argb }, pattern: 'solid', type: 'pattern' }
        }
    }
}

/** Paints the border around the AI summary block — left/right/top on the
 *  header row; left/right on the body sides; bottom across the last body row. */
function paintBorders(ws) {
    const brand = { color: { argb: COLORS.brand }, style: 'medium' }
    ws.getCell(AI_HEADER_ROW, AI_COL_START).border = { left: brand, right: brand, top: brand }
    ws.getCell(AI_HEADER_ROW, AI_COL_END).border = { right: brand, top: brand }
    for (let row = AI_BODY_TOP; row <= AI_BODY_BOTTOM; row++) {
        const isLast = row === AI_BODY_BOTTOM
        ws.getCell(row, AI_COL_START).border = isLast ? { bottom: brand, left: brand } : { left: brand }
        ws.getCell(row, AI_COL_END).border = isLast ? { bottom: brand, right: brand } : { right: brand }
    }
    for (let col = AI_COL_START + 1; col < AI_COL_END; col++) {
        ws.getCell(AI_BODY_BOTTOM, col).border = { bottom: brand }
    }
}

/** Renders the AI Summary band in the top-right of the current-week sheet.
 *  Resolves `aiSummaryPromise` and bails silently if the AI service
 *  returned no summary. */
export async function renderAiSummary(ws, aiSummaryPromise) {
    if (!aiSummaryPromise) return
    const aiSummary = await aiSummaryPromise
    if (!aiSummary) return

    ws.mergeCells(AI_HEADER_ROW, AI_COL_START, AI_HEADER_ROW, AI_COL_END)
    const headerCell = ws.getCell(AI_HEADER_ROW, AI_COL_START)
    headerCell.value = 'AI Summary'
    headerCell.font = { bold: true, color: { argb: COLORS.white }, name: 'Calibri', size: 11 }
    headerCell.alignment = { horizontal: 'center', vertical: 'middle' }
    fillRange(ws, AI_HEADER_ROW, AI_HEADER_ROW, AI_COL_START, AI_COL_END, COLORS.brand)
    ws.getRow(AI_HEADER_ROW).height = 22

    ws.mergeCells(AI_BODY_TOP, AI_COL_START, AI_BODY_BOTTOM, AI_COL_END)
    const bodyCell = ws.getCell(AI_BODY_TOP, AI_COL_START)
    bodyCell.value = aiSummary
    bodyCell.font = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    bodyCell.alignment = { horizontal: 'left', indent: 1, vertical: 'middle', wrapText: true }
    fillRange(ws, AI_BODY_TOP, AI_BODY_BOTTOM, AI_COL_START, AI_COL_END, 'FFF8FAFC')

    paintBorders(ws)
    ws.getRow(AI_BODY_TOP).height = 20
    ws.getRow(AI_BODY_TOP + 1).height = 20
    ws.getRow(AI_BODY_BOTTOM).height = 20
}
