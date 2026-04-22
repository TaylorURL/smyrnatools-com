import {
    addDataRow,
    addReportHeader,
    addSectionTitle,
    addTableHeaders,
    COLORS
} from '../../../../../utils/ExportUtility'
import { createSheet, exportWorkbook, finalizeSheet, initExport } from '../ExportModule'

const COLUMN_COUNT = 13

const REASON_CATEGORY_COLORS = {
    'Operator Error': COLORS.accent,
    Other: COLORS.slate500,
    'Plant Issue': COLORS.warning,
    'Plant Manager Error': COLORS.danger,
    'Truck Issues': COLORS.warning
}

const formatShortDate = (value) => {
    if (!value) return ''
    const d = new Date(value)
    if (isNaN(d)) return ''
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

const splitReason = (reason) => {
    if (!reason) return { category: '', explanation: '' }
    const idx = reason.indexOf(':')
    if (idx === -1) return { category: reason.trim(), explanation: '' }
    return { category: reason.slice(0, idx).trim(), explanation: reason.slice(idx + 1).trim() }
}

const groupByPlant = (reports, plants) => {
    const plantNameMap = {}
    plants.forEach((p) => {
        const code = p.plantCode || p.plant_code || ''
        plantNameMap[code] = p.plantName || p.plant_name || code
    })
    const groups = {}
    reports.forEach((r) => {
        const code = r.data?.plant || 'Unassigned'
        if (!groups[code]) groups[code] = { name: plantNameMap[code] || code, reports: [] }
        groups[code].reports.push(r)
    })
    return Object.entries(groups)
        .sort(([a], [b]) => {
            if (a === 'Unassigned') return 1
            if (b === 'Unassigned') return -1
            const numA = parseInt(String(a).replace(/\D/g, '') || '999', 10)
            const numB = parseInt(String(b).replace(/\D/g, '') || '999', 10)
            return numA - numB
        })
        .map(([code, group]) => ({ code, name: group.name, reports: group.reports }))
}

/**
 * Generates and downloads an Excel workbook of lost load reports grouped by plant.
 * Matches the visual language of the general manager export.
 */
export async function exportLostLoadReports({ reports = [], plants = [], getUserName, filename }) {
    if (typeof window === 'undefined') return
    if (!reports.length) return

    const sheetTitle = 'Lost Load Reports'
    const { wb, logoBase64 } = await initExport({ subject: sheetTitle })
    const ws = createSheet(wb, 'Lost Loads', {
        columns: [
            { width: 3 },
            { width: 6 },
            { width: 14 },
            { width: 10 },
            { width: 18 },
            { width: 10 },
            { width: 22 },
            { width: 14 },
            { width: 22 },
            { width: 22 },
            { width: 11 },
            { width: 15 },
            { width: 18 }
        ]
    })
    const todayStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    let r = addReportHeader(ws, wb, { logoBase64, subtitle: todayStr, title: sheetTitle })
    r++

    const totalYardage = reports.reduce((sum, item) => sum + (Number(item.data?.yardage) || 0), 0)
    addSectionTitle(
        ws,
        r,
        `Summary  |  ${reports.length} Report${reports.length === 1 ? '' : 's'}  |  ${totalYardage.toFixed(1)} yds Lost`
    )
    r += 2

    const groups = groupByPlant(reports, plants)
    for (const group of groups) {
        ws.mergeCells(r, 2, r, COLUMN_COUNT)
        const plantCell = ws.getCell(r, 2)
        plantCell.value = `${group.name}${group.code !== group.name ? ` (${group.code})` : ''}  ·  ${group.reports.length} report${group.reports.length === 1 ? '' : 's'}`
        plantCell.font = { bold: true, color: { argb: COLORS.white }, name: 'Calibri', size: 12 }
        plantCell.fill = { fgColor: { argb: COLORS.brand }, pattern: 'solid', type: 'pattern' }
        plantCell.alignment = { horizontal: 'left', vertical: 'middle' }
        for (let c = 3; c <= COLUMN_COUNT; c++) {
            ws.getCell(r, c).fill = { fgColor: { argb: COLORS.brand }, pattern: 'solid', type: 'pattern' }
        }
        ws.getRow(r).height = 26
        r++

        addTableHeaders(
            ws,
            r,
            [
                '#',
                'Date',
                'Truck',
                'Operator',
                'Yds',
                'Customer',
                'Ticket',
                'Dump Location',
                'Reason',
                'Operator Reprimanded',
                'PM Reprimanded',
                'Reported By'
            ],
            2
        )
        r++

        const sortedReports = [...group.reports].sort((a, b) => {
            const aDate = a.data?.lost_load_date || a.submitted_at || 0
            const bDate = b.data?.lost_load_date || b.submitted_at || 0
            return new Date(bDate) - new Date(aDate)
        })

        sortedReports.forEach((report, idx) => {
            const isAlt = idx % 2 === 0
            const d = report.data || {}
            const { category: reasonCategory } = splitReason(d.reason)
            const reporter = (getUserName?.(report.userId) || 'Unknown').trim()
            addDataRow(
                ws,
                r,
                [
                    { align: 'center', value: idx + 1 },
                    { align: 'center', value: formatShortDate(d.lost_load_date || report.submitted_at) },
                    { align: 'center', bold: true, value: d.truck_number ? `#${d.truck_number}` : '' },
                    { align: 'left', value: d.operator_name || '—' },
                    { align: 'center', value: d.yardage != null ? Number(d.yardage).toFixed(1) : '' },
                    { align: 'left', value: d.customer_name || '—' },
                    { align: 'center', value: d.ticket_number ? `#${d.ticket_number}` : '—' },
                    { align: 'center', value: d.dump_location || '—' },
                    {
                        align: 'left',
                        bold: true,
                        color: REASON_CATEGORY_COLORS[reasonCategory] || COLORS.slate500,
                        value: reasonCategory || '—'
                    },
                    {
                        align: 'center',
                        bold: !!d.operator_reprimanded,
                        color: d.operator_reprimanded ? COLORS.danger : COLORS.slate500,
                        value: d.operator_reprimanded ? 'Yes' : 'No'
                    },
                    {
                        align: 'center',
                        bold: !!d.plant_manager_reprimanded,
                        color: d.plant_manager_reprimanded ? COLORS.danger : COLORS.slate500,
                        value: d.plant_manager_reprimanded ? 'Yes' : 'No'
                    },
                    { align: 'left', value: reporter }
                ],
                2,
                isAlt
            )
            r++
        })
        r++
    }

    r++
    ws.mergeCells(r, 2, r, COLUMN_COUNT)
    const footerCell = ws.getCell(r, 2)
    footerCell.value = `Generated by Smyrna Tools on ${todayStr}`
    footerCell.font = { color: { argb: COLORS.slate500 }, italic: true, name: 'Calibri', size: 9 }
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' }

    finalizeSheet(ws, { maxCol: COLUMN_COUNT + 2, maxRow: r + 5 })
    const finalFilename = filename || `Lost Load Reports ${new Date().toISOString().slice(0, 10)}.xlsx`
    await exportWorkbook(wb, finalFilename)
}
