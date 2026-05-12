import { ReportService } from '../../../../../services/ReportService'
import {
    addDataRow,
    addReportHeader,
    addSectionTitle,
    addTableHeaders,
    COLORS
} from '../../../../../utils/ExportUtility'
import { ReportUtility } from '../../../../../utils/ReportUtility'
import { createSheet, exportWorkbook, finalizeSheet, generateFilename, initExport } from '../ExportModule'

/* ── Layout constants ─────────────────────────────────────────────────────
 *  Column 1 is a left gutter (matches GM / Lost Load exports) so the report
 *  has breathing room from the page edge. The data table itself spans
 *  columns 2..LAST_DATA_COL. */
const FIRST_COL = 2
const LAST_DATA_COL = 15
const STAT_TILE_COLS_PER_TILE = 3
const STAT_TILES_PER_ROW = 4
const STAT_TILE_VALUE_FORMAT = { argb: 'FF1F2937' }

/* ── Threshold rules — kept here so the export and the on-screen badges
 *    use the same numbers without drifting. */
const PUNCH_TO_LOAD_LIMIT_MIN = 15
const WASHOUT_TO_PUNCH_LIMIT_MIN = 20
const LOW_LOADS_THRESHOLD = 3
const LONG_HOURS_THRESHOLD = 14

const formatLongDate = (iso) => {
    if (!iso) return ''
    const d = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' })
}

// Wraps past midnight so overnight shifts produce positive elapsed
// minutes instead of negatives — `laterStr` is the later wall-clock time,
// `earlierStr` is the earlier one; the helper handles the day-rollover.
const minutesBetween = (laterStr, earlierStr) => {
    const earlier = ReportUtility.parseTimeToMinutes(earlierStr)
    const later = ReportUtility.parseTimeToMinutes(laterStr)
    return ReportUtility.diffMinutesWrapping(earlier, later)
}

/** Per-row warning analyzer — returns { tags, isAlert } so the table can
 *  flag problem operators visually and the new Status column can list every
 *  rule that fired (e.g. "LATE START · LOW LOADS"). */
const analyzeRow = (row) => {
    const dStart = minutesBetween(row.first_load, row.start_time)
    const dEnd = minutesBetween(row.punch_out, row.eod_in_yard)
    const startMin = ReportUtility.parseTimeToMinutes(row.start_time)
    const punchOutMin = ReportUtility.parseTimeToMinutes(row.punch_out)
    const totalMinutes = ReportUtility.diffMinutesWrapping(startMin, punchOutMin)
    const hours = totalMinutes !== null ? totalMinutes / 60 : null
    const loadsValue = Number(row.loads)
    const loads = Number.isFinite(loadsValue) ? loadsValue : null
    const tags = []
    if (Number.isFinite(dStart) && dStart > PUNCH_TO_LOAD_LIMIT_MIN) tags.push('LATE START')
    if (Number.isFinite(dEnd) && dEnd > WASHOUT_TO_PUNCH_LIMIT_MIN) tags.push('LATE OFF')
    if (loads !== null && loads > 0 && loads < LOW_LOADS_THRESHOLD) tags.push('LOW LOADS')
    if (hours !== null && hours > LONG_HOURS_THRESHOLD) tags.push('LONG HOURS')
    return { dEnd, dStart, hours, isAlert: tags.length > 0, loads, tags }
}

const formatMinutesCell = (mins, threshold) => {
    if (mins === null || mins === undefined || Number.isNaN(mins)) {
        return { align: 'right', value: '—' }
    }
    const overLimit = typeof threshold === 'number' && mins > threshold
    return {
        align: 'right',
        bold: overLimit,
        color: overLimit ? COLORS.warning : null,
        value: `${mins} min`
    }
}

const formatHoursCell = (hours) => {
    if (hours === null || hours === undefined || Number.isNaN(hours)) {
        return { align: 'right', value: '—' }
    }
    return {
        align: 'right',
        bold: hours > LONG_HOURS_THRESHOLD,
        color: hours > LONG_HOURS_THRESHOLD ? COLORS.danger : null,
        value: Number(hours).toFixed(2)
    }
}

const formatLoadsCell = (loads) => {
    const value = Number(loads)
    if (!Number.isFinite(value)) return { align: 'right', value: '—' }
    const tooLow = value > 0 && value < LOW_LOADS_THRESHOLD
    return {
        align: 'right',
        bold: tooLow,
        color: tooLow ? COLORS.danger : null,
        value
    }
}

const formatLphCell = (loads, hours) => {
    const lph = Number(loads) > 0 && hours && hours > 0 ? Number(loads) / hours : null
    if (lph === null) return { align: 'right', value: '—' }
    return { align: 'right', bold: true, value: lph.toFixed(2) }
}

const formatStatusCell = (tags) => {
    if (!tags || !tags.length) {
        return { align: 'center', color: COLORS.success, value: 'OK' }
    }
    return { align: 'center', bold: true, color: COLORS.danger, value: tags.join(' · ') }
}

/* ── Stat tile metadata — same labels and order as the on-screen tile grid
 *    so the export reads as the spreadsheet equivalent of the UI card.
 *    `accent` controls the value-cell text color so reviewers spot the most
 *    actionable numbers (avg L/H, throughput) at a glance. */
const STAT_TILES = [
    {
        format: (v) => (Number.isFinite(v) ? v.toString() : '—'),
        key: 'totalLoads',
        label: 'Total Loads',
        valueColor: COLORS.brand
    },
    {
        format: (v) => (Number.isFinite(v) ? v.toFixed(2) : '—'),
        key: 'totalHours',
        label: 'Total Hours',
        valueColor: COLORS.brand
    },
    {
        format: (v) => (Number.isFinite(v) ? v.toFixed(2) : '—'),
        key: 'avgLoads',
        label: 'Avg Loads',
        valueColor: COLORS.slate900
    },
    {
        format: (v) => (Number.isFinite(v) ? v.toFixed(2) : '—'),
        key: 'avgHours',
        label: 'Avg Hours',
        valueColor: COLORS.slate900
    },
    {
        format: (v) => (Number.isFinite(v) ? v.toFixed(2) : '—'),
        key: 'avgLoadsPerHour',
        label: 'Avg Loads/Hour',
        valueColor: COLORS.success
    },
    {
        format: (v) => (Number.isFinite(v) ? `${v.toFixed(1)} min` : '—'),
        key: 'avgElapsedStart',
        label: 'Punch In → 1st Load',
        valueColor: COLORS.slate900
    },
    {
        format: (v) => (Number.isFinite(v) ? `${v.toFixed(1)} min` : '—'),
        key: 'avgElapsedEnd',
        label: 'Washout → Punch Out',
        valueColor: COLORS.slate900
    }
]

const isExcludedRow = (row) => {
    if (!row) return true
    const keys = Object.keys(row).filter((k) => k !== 'name' && k !== 'truck_number')
    return keys.every((k) => row[k] === '' || row[k] === undefined || row[k] === null || row[k] === 0)
}

const resolvePlantLabel = (plants, plantCode) => {
    const list = Array.isArray(plants) ? plants : []
    const match = list.find((p) => (p?.plantCode || p?.plant_code) === plantCode)
    if (!match) return plantCode || ''
    const name = match.plantName || match.plant_name
    return name ? `${plantCode} · ${name}` : String(plantCode || '')
}

/** Render a stat tile as a 2-cell tall × 3-cell wide block: label on top
 *  (uppercase tracked-out, slate-500), value below (large, brand-colored).
 *  Mirrors the `StatTile` component used in the on-screen card. */
function renderStatTile(ws, row, col, tile, value) {
    const labelCell = ws.getCell(row, col)
    ws.mergeCells(row, col, row, col + STAT_TILE_COLS_PER_TILE - 1)
    labelCell.value = tile.label.toUpperCase()
    labelCell.font = { bold: true, color: { argb: COLORS.slate500 }, name: 'Calibri', size: 9 }
    labelCell.alignment = { horizontal: 'left', indent: 1, vertical: 'bottom' }
    labelCell.fill = { fgColor: { argb: COLORS.cream }, pattern: 'solid', type: 'pattern' }
    labelCell.border = {
        bottom: { color: { argb: COLORS.slate200 }, style: 'thin' },
        left: { color: { argb: COLORS.slate200 }, style: 'thin' },
        right: { color: { argb: COLORS.slate200 }, style: 'thin' },
        top: { color: { argb: COLORS.slate200 }, style: 'thin' }
    }

    const valueRow = row + 1
    const valueCell = ws.getCell(valueRow, col)
    ws.mergeCells(valueRow, col, valueRow, col + STAT_TILE_COLS_PER_TILE - 1)
    valueCell.value = value
    valueCell.font = {
        bold: true,
        color: { argb: tile.valueColor || STAT_TILE_VALUE_FORMAT.argb },
        name: 'Calibri',
        size: 18
    }
    valueCell.alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
    valueCell.fill = { fgColor: { argb: COLORS.white }, pattern: 'solid', type: 'pattern' }
    valueCell.border = {
        bottom: { color: { argb: COLORS.slate200 }, style: 'thin' },
        left: { color: { argb: COLORS.slate200 }, style: 'thin' },
        right: { color: { argb: COLORS.slate200 }, style: 'thin' }
    }

    ws.getRow(row).height = 16
    ws.getRow(valueRow).height = 28
}

/** Render a compact horizontal "KPI strip" that sits right below the report
 *  header — same vibe as the GM export's plant/region overview banner. */
function renderKpiStrip(ws, startRow, items) {
    const colsPerItem = Math.floor((LAST_DATA_COL - FIRST_COL + 1) / items.length)
    items.forEach((item, idx) => {
        const col = FIRST_COL + idx * colsPerItem
        const lastCol = idx === items.length - 1 ? LAST_DATA_COL : col + colsPerItem - 1
        ws.mergeCells(startRow, col, startRow, lastCol)
        const labelCell = ws.getCell(startRow, col)
        labelCell.value = {
            richText: [
                {
                    font: { bold: true, color: { argb: COLORS.slate500 }, name: 'Calibri', size: 9 },
                    text: `${item.label.toUpperCase()}   `
                },
                {
                    font: { bold: true, color: { argb: item.color || COLORS.brand }, name: 'Calibri', size: 14 },
                    text: String(item.value)
                }
            ]
        }
        labelCell.alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
        labelCell.fill = { fgColor: { argb: COLORS.cream }, pattern: 'solid', type: 'pattern' }
        labelCell.border = {
            bottom: { color: { argb: COLORS.brand }, style: 'medium' },
            top: { color: { argb: COLORS.slate200 }, style: 'thin' }
        }
    })
    ws.getRow(startRow).height = 32
}

/**
 * Generates and downloads a single-sheet Excel workbook of a weekly plant
 * efficiency report. Visual language matches the General Manager and Lost
 * Load exports (Calibri, brand colors, alt-row striping, total-row band)
 * with a few report-specific upgrades: stat-tile grid mirroring the on-
 * screen card, KPI strip under the header, per-row Status column, frozen
 * header, autofilter, and landscape print setup.
 */
export async function exportEfficiencyReport({
    form,
    operatorOptions = [],
    plants = [],
    weekIso,
    plantCode,
    filename
} = {}) {
    if (typeof window === 'undefined') return
    const sheetTitle = 'Weekly Plant Efficiency Report'
    const { wb, logoBase64 } = await initExport({ subject: sheetTitle })
    const ws = createSheet(wb, 'Efficiency', {
        columns: [
            { width: 3 }, // 1: gutter
            { width: 5 }, // 2: #
            { width: 26 }, // 3: operator
            { width: 9 }, // 4: truck
            { width: 10 }, // 5: start
            { width: 10 }, // 6: 1st load
            { width: 11 }, // 7: eod
            { width: 10 }, // 8: punch out
            { width: 9 }, // 9: loads
            { width: 9 }, // 10: hours
            { width: 8 }, // 11: L/H
            { width: 16 }, // 12: punch → 1st (min)
            { width: 17 }, // 13: washout → punch (min)
            { width: 22 }, // 14: status
            { width: 32 } // 15: comments
        ]
    })

    const subtitleParts = []
    const plantLabel = resolvePlantLabel(plants, plantCode)
    if (plantLabel) subtitleParts.push(plantLabel)
    if (weekIso) subtitleParts.push(`Week of ${formatLongDate(weekIso)}`)
    let r = addReportHeader(ws, wb, {
        logoBase64,
        subtitle: subtitleParts.join('   ·   ') || undefined,
        title: sheetTitle
    })
    r++

    const rawRows = Array.isArray(form?.rows) ? form.rows : []
    const includedRows = rawRows.filter((row) => !isExcludedRow(row))
    const insights = ReportService.getPlantProductionInsights(rawRows)
    const flaggedCount = includedRows.filter((row) => analyzeRow(row).isAlert).length

    // ── KPI strip directly under the header ──────────────────────────────
    renderKpiStrip(ws, r, [
        { color: COLORS.brand, label: 'Operators', value: includedRows.length },
        {
            color: COLORS.brand,
            label: 'Total Loads',
            value: Number.isFinite(insights?.totalLoads) ? insights.totalLoads : '—'
        },
        {
            color: COLORS.brand,
            label: 'Total Hours',
            value: Number.isFinite(insights?.totalHours) ? insights.totalHours.toFixed(2) : '—'
        },
        {
            color: COLORS.success,
            label: 'Avg Loads / Hour',
            value: Number.isFinite(insights?.avgLoadsPerHour) ? insights.avgLoadsPerHour.toFixed(2) : '—'
        },
        {
            color: flaggedCount ? COLORS.danger : COLORS.success,
            label: 'Operators Flagged',
            value: flaggedCount
        }
    ])
    r += 2

    // ── Operator detail section ───────────────────────────────────────────
    addSectionTitle(
        ws,
        r,
        `Operator Production Detail  |  ${includedRows.length} operator${includedRows.length === 1 ? '' : 's'}${
            flaggedCount ? `  ·  ${flaggedCount} flagged` : ''
        }`
    )
    r += 2

    const headers = [
        '#',
        'Operator',
        'Truck #',
        'Start',
        '1st Load',
        'EOD In Yard',
        'Punch Out',
        'Loads',
        'Hours',
        'L/H',
        'Punch In → 1st Load',
        'Washout → Punch Out',
        'Status',
        'Comments'
    ]
    addTableHeaders(ws, r, headers, FIRST_COL)
    const headerRow = r
    r++

    const _tableStartRow = r
    if (includedRows.length === 0) {
        ws.mergeCells(r, FIRST_COL, r, LAST_DATA_COL)
        const emptyCell = ws.getCell(r, FIRST_COL)
        emptyCell.value = 'No operator timing rows have been entered for this report.'
        emptyCell.font = { color: { argb: COLORS.slate500 }, italic: true, name: 'Calibri', size: 11 }
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
        r++
    } else {
        includedRows.forEach((row, idx) => {
            const isAlt = idx % 2 === 0
            const operatorName = ReportService.getOperatorName(row, operatorOptions) || 'No Name'
            const analysis = analyzeRow(row)
            const { dEnd, dStart, hours, isAlert, loads, tags } = analysis
            const rowFill = isAlert
                ? { fgColor: { argb: COLORS.dangerLight }, pattern: 'solid', type: 'pattern' }
                : null
            addDataRow(
                ws,
                r,
                [
                    { align: 'center', value: idx + 1 },
                    { align: 'left', bold: true, value: operatorName },
                    { align: 'center', value: row.truck_number ? `#${row.truck_number}` : '—' },
                    { align: 'center', value: row.start_time || '—' },
                    { align: 'center', value: row.first_load || '—' },
                    { align: 'center', value: row.eod_in_yard || '—' },
                    { align: 'center', value: row.punch_out || '—' },
                    formatLoadsCell(loads),
                    formatHoursCell(hours),
                    formatLphCell(loads, hours),
                    formatMinutesCell(dStart, PUNCH_TO_LOAD_LIMIT_MIN),
                    formatMinutesCell(dEnd, WASHOUT_TO_PUNCH_LIMIT_MIN),
                    formatStatusCell(tags),
                    { align: 'left', value: row.comments?.trim() || '—' }
                ],
                FIRST_COL,
                isAlt
            )
            // Override the alt-row stripe with a danger tint when the row
            // has any active warning so it pops out at a glance — and let
            // the comments cell wrap so long explanations don't squeeze the
            // status column into illegibility.
            for (let c = FIRST_COL; c <= LAST_DATA_COL; c++) {
                const cell = ws.getCell(r, c)
                if (rowFill) cell.fill = rowFill
                if (c === LAST_DATA_COL) {
                    cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true }
                }
            }
            r++
        })
    }
    const tableEndRow = r - 1

    // ── Excel ergonomics: autofilter on the data table + freeze the
    //    header row so reviewers can scroll long operator lists without
    //    losing the column labels. ──────────────────────────────────────
    if (includedRows.length > 0) {
        ws.autoFilter = {
            from: { column: FIRST_COL, row: headerRow },
            to: { column: LAST_DATA_COL, row: tableEndRow }
        }
    }
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow }]

    // ── Stat-tile grid (replaces the old metric-row list) ─────────────────
    r += 2
    addSectionTitle(ws, r, 'Totals  |  Weekly Production Stats')
    r += 2

    const tilesStart = r
    STAT_TILES.forEach((tile, idx) => {
        const colOffset = idx % STAT_TILES_PER_ROW
        const rowOffset = Math.floor(idx / STAT_TILES_PER_ROW) * 2
        const tileCol = FIRST_COL + colOffset * STAT_TILE_COLS_PER_TILE
        renderStatTile(ws, tilesStart + rowOffset, tileCol, tile, tile.format(insights?.[tile.key]))
    })
    const tileRowsUsed = Math.ceil(STAT_TILES.length / STAT_TILES_PER_ROW) * 2
    r = tilesStart + tileRowsUsed

    // ── Inline warnings (only when the insights service surfaces any) ────
    if (Array.isArray(insights?.avgWarnings) && insights.avgWarnings.length) {
        r += 2
        addSectionTitle(ws, r, 'Warnings')
        r += 2
        insights.avgWarnings.forEach((message, idx) => {
            ws.mergeCells(r, FIRST_COL, r, LAST_DATA_COL)
            const cell = ws.getCell(r, FIRST_COL)
            cell.value = `• ${message}`
            cell.font = { bold: true, color: { argb: COLORS.warning }, name: 'Calibri', size: 11 }
            cell.alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
            cell.fill = {
                fgColor: { argb: idx % 2 === 0 ? COLORS.cream : COLORS.white },
                pattern: 'solid',
                type: 'pattern'
            }
            cell.border = { left: { color: { argb: COLORS.warning }, style: 'medium' } }
            r++
        })
    }

    // ── Footer ────────────────────────────────────────────────────────────
    r += 2
    ws.mergeCells(r, FIRST_COL, r, LAST_DATA_COL)
    const footerCell = ws.getCell(r, FIRST_COL)
    const todayStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    footerCell.value = `Generated by Smyrna Tools on ${todayStr}`
    footerCell.font = { color: { argb: COLORS.slate500 }, italic: true, name: 'Calibri', size: 9 }
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' }

    // ── Print setup: landscape + fit-to-width so the report prints clean
    //    on a single page horizontally even with the wider column set. ───
    ws.pageSetup = {
        ...(ws.pageSetup || {}),
        fitToHeight: 0,
        fitToPage: true,
        fitToWidth: 1,
        horizontalCentered: true,
        margins: { bottom: 0.4, footer: 0.2, header: 0.2, left: 0.3, right: 0.3, top: 0.4 },
        orientation: 'landscape',
        paperSize: 9 // Letter
    }
    ws.headerFooter = {
        ...(ws.headerFooter || {}),
        oddFooter: '&L&"Calibri,Italic"&9 Smyrna Tools&C&9 Page &P of &N&R&"Calibri,Italic"&9 ' + sheetTitle
    }

    finalizeSheet(ws, { maxCol: LAST_DATA_COL + 1, maxRow: r + 5 })

    const baseName = plantCode ? `Plant ${plantCode} Efficiency` : 'Weekly Plant Efficiency'
    const finalFilename = filename || generateFilename(baseName, weekIso)
    await exportWorkbook(wb, finalFilename)
}
