import { fmtInt, fmtRange, fmtYards } from '../../../../../../../utils/PlanStatisticsFormatUtility'

const HTML_ESCAPES = { '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])

/** Print-friendly export. Opens a fresh window with a self-contained
 *  HTML document (no app CSS) so the output works regardless of which
 *  theme is active and survives the user clicking "Save as PDF" from
 *  the print dialog. Segment headers carry through to the printout
 *  when a plant is filtered, so the assigned-vs-visiting split is
 *  preserved on paper. */
export function openOperatorsPrintWindow({ loadsByOperator, operatorSegments, range, selectedPlant, totals }) {
    if (typeof window === 'undefined') return
    if (loadsByOperator.length === 0) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    const rangeLabel = fmtRange(range.start, range.end)
    const headerTitle = selectedPlant
        ? `Operators · Plant ${selectedPlant} · ${rangeLabel}`
        : `Operators · All plants · ${rangeLabel}`
    const metaLine = `${fmtInt(totals.drivers)} operator${totals.drivers === 1 ? '' : 's'} · ${fmtInt(totals.loads)} load${totals.loads === 1 ? '' : 's'} · ${fmtYards(totals.yardage)} yd³${totals.mismatched > 0 ? ` · ${fmtInt(totals.mismatched)} mismatch${totals.mismatched === 1 ? '' : 'es'}` : ''}`
    const renderRow = (row, idxInSegment) => {
        const avgYardage = row.loads > 0 ? row.yardage / row.loads : 0
        const plantLoads = row.unmatched
            ? '—'
            : (row.plantLoads || []).map((pl) => `${escapeHtml(pl.plant)}&times;${pl.loads}`).join('&nbsp;&nbsp;') ||
              '—'
        const trucks = (row.trucksDriven || []).join(', ') || '—'
        return `<tr>
            <td class="num">${idxInSegment + 1}</td>
            <td>${escapeHtml(row.name)}${row.driverNum ? `<br><span class="muted">#${escapeHtml(row.driverNum)}</span>` : ''}</td>
            <td>${escapeHtml(row.homePlant || '—')}</td>
            <td>${plantLoads}</td>
            <td>${escapeHtml(trucks)}</td>
            <td class="num">${fmtInt(row.loads)}</td>
            <td class="num">${row.loads > 0 ? avgYardage.toFixed(1) : '—'}</td>
            <td class="num">${fmtYards(row.yardage)}&nbsp;yd³</td>
        </tr>`
    }
    const bodyHtml = operatorSegments
        .map((segment) => {
            const headerHtml = segment.header
                ? `<tr class="section-header">
                    <td colspan="8">
                        <span class="section-title">${escapeHtml(segment.header.title)}</span>
                        <span class="section-count">${fmtInt(segment.header.count)}</span>
                        <span class="section-hint">${escapeHtml(segment.header.hint)}</span>
                    </td>
                   </tr>`
                : ''
            const rowsHtml = segment.rows.map(renderRow).join('')
            return headerHtml + rowsHtml
        })
        .join('')
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(headerTitle)}</title>
<style>
    @page { size: letter portrait; margin: 0.5in; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #111827; margin: 0; padding: 0; }
    h1 { font-size: 16px; margin: 0 0 4px; font-weight: 700; }
    .meta { font-size: 11px; color: #6b7280; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #4b5563; border-bottom: 2px solid #d1d5db; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, 'SF Mono', Monaco, monospace; }
    tr.section-header td { background: #f9fafb; padding-top: 12px; padding-bottom: 6px; border-bottom: 1px solid #d1d5db; }
    .section-title { font-weight: 700; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; }
    .section-count { display: inline-block; background: #ffffff; border: 1px solid #d1d5db; border-radius: 2px; padding: 1px 6px; font-size: 10px; margin-left: 6px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .section-hint { font-weight: 400; text-transform: none; letter-spacing: 0; color: #6b7280; margin-left: 8px; font-size: 10px; }
    .muted { color: #6b7280; font-size: 10px; font-family: ui-monospace, monospace; }
    @media print {
        body { font-size: 10px; }
        thead { display: table-header-group; }
    }
</style>
</head>
<body>
    <h1>${escapeHtml(headerTitle)}</h1>
    <div class="meta">${metaLine}</div>
    <table>
        <thead>
            <tr>
                <th class="num">#</th>
                <th>Operator</th>
                <th>Assigned plant</th>
                <th>Loads by plant</th>
                <th>Trucks</th>
                <th class="num">Loads</th>
                <th class="num">Yds / load</th>
                <th class="num">Yardage</th>
            </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
    </table>
</body>
</html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    // Defer print() so the document parses before the dialog opens.
    // Some browsers race here and the dialog renders against an empty
    // doc otherwise.
    setTimeout(() => {
        try {
            win.print()
        } catch {
            /* user can still print manually */
        }
    }, 250)
}
