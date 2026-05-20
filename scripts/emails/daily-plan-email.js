/**
 * Daily Plan email — built per-plant from the dispatcher's saved plan and
 * sent to that plant's manager (plus the district manager who owns the
 * plant on CC). Mirrors `plan_email_mockup.html` line-for-line so the
 * preview the dispatcher sees in the Review modal IS the message that
 * lands in the manager's inbox.
 *
 * Template returns `{ subject, html, text }`. The HTML uses inline styles
 * exclusively (Gmail / Outlook strip `<style>` blocks); the slightly
 * verbose markup is the table-driven layout that survives every major
 * client without falling over on dark mode or narrow viewports.
 *
 * `testMode = true` injects the yellow "redirected" banner at the top of
 * the message with the actual intended TO + CC the routing logic
 * produced, so we can verify each plant's manager / DM lookup before
 * flipping the redirect off in production.
 */

const ACCENT = '#c12033'
const NAVY = '#1e3a5f'

function htmlEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** Trim, single-space-collapse, sentence-capitalize, and ensure a trailing
 *  period — keeps dispatcher notes readable in an email body without
 *  rewriting the actual sentences. Multi-line notes are kept intact:
 *  each non-empty line is normalized independently. */
function normalizeNotes(raw) {
    if (!raw) return ''
    const lines = String(raw)
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .map((line) => {
            const capped = line.charAt(0).toUpperCase() + line.slice(1)
            return /[.!?]$/.test(capped) ? capped : `${capped}.`
        })
    return lines.join('\n')
}

function formatLongDate(planDateIso) {
    if (!planDateIso) return ''
    const date = new Date(`${planDateIso}T12:00:00`)
    if (Number.isNaN(date.getTime())) return planDateIso
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' })
}

function formatShortDate(planDateIso) {
    if (!planDateIso) return ''
    const date = new Date(`${planDateIso}T12:00:00`)
    if (Number.isNaN(date.getTime())) return planDateIso
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' })
}

function formatRecipient(r) {
    if (!r) return ''
    if (r.name) return `${r.name} &lt;${htmlEscape(r.email)}&gt;`
    return htmlEscape(r.email)
}

function renderTestBanner({ intendedTo, intendedCc, testRedirectEmail, plantLabel }) {
    const toLine = (intendedTo || []).map(formatRecipient).join(', ') || '<em>(no plant manager resolved)</em>'
    const ccLine = (intendedCc || []).map(formatRecipient).join(', ') || '<em>(no district manager resolved)</em>'
    return `
<tr>
    <td style="background:#fef3c7;border-bottom:1px solid #fcd34d;padding:14px 28px;font-size:12.5px;color:#78350f;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;color:#92400e;">
            &#9888; Test mode &middot; message redirected
        </div>
        This message would have been delivered in production to the recipients below for <strong>${htmlEscape(plantLabel)}</strong>. While we are testing the daily-plan pipeline, every email is redirected to <span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;">${htmlEscape(testRedirectEmail)}</span> so the routing can be validated before production.
        <div style="margin-top:10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:#451a03;">
            <div><strong style="color:#78350f;font-size:11.5px;letter-spacing:0.04em;">INTENDED TO:</strong> ${toLine}</div>
            <div style="margin-top:3px;"><strong style="color:#78350f;font-size:11.5px;letter-spacing:0.04em;">INTENDED CC:</strong> ${ccLine}</div>
        </div>
    </td>
</tr>`
}

function renderSummaryGrid({ kpi }) {
    const orderCount = Number.isFinite(kpi?.orderCount) ? kpi.orderCount : 0
    const yardage = Number.isFinite(kpi?.yardage) ? kpi.yardage : 0
    const customers = Number.isFinite(kpi?.customerCount) ? kpi.customerCount : 0
    const loads = Number.isFinite(kpi?.loadCount) ? kpi.loadCount : 0
    const windowText = kpi?.firstStart && kpi?.lastStart ? `${kpi.firstStart} &ndash; ${kpi.lastStart}` : '&mdash;'
    const cell = (label, value, hint) => `
        <td valign="top" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;width:33.3%;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:4px;">${label}</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${value}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${hint}</div>
        </td>`
    return `
<table role="presentation" cellspacing="8" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 24px;">
    <tr>
        ${cell('Orders', orderCount.toLocaleString(), `${customers} customer${customers === 1 ? '' : 's'} &middot; ${Math.round(yardage).toLocaleString()} yd&sup3;`)}
        ${cell('Loads', loads.toLocaleString(), 'truck loads scheduled')}
        ${cell('Window', windowText, 'first &rarr; last start')}
    </tr>
</table>`
}

function renderOrdersTable({ orders }) {
    if (!Array.isArray(orders) || orders.length === 0) {
        return `<div style="font-size:12.5px;color:#64748b;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">No orders scheduled for this plant today.</div>`
    }
    const rows = orders
        .map((order) => {
            const start = htmlEscape(order.startTime || '—')
            const orderNum = order.orderNum ? `#${htmlEscape(order.orderNum)}` : '—'
            const customer = htmlEscape(order.customer || 'Unknown customer')
            const subline = [order.address, order.productCode].filter(Boolean).map(htmlEscape).join(' &middot; ')
            const yards = Number.isFinite(order.yardage) ? Math.round(order.yardage).toLocaleString() : '—'
            const trucks = Number.isFinite(order.truckCount) ? order.truckCount : '—'
            const spacing = Number.isFinite(order.spacingMin) ? `${order.spacingMin} min` : '—'
            const status = order.needsHelp
                ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:rgba(220,38,38,0.12);color:#b91c1c;">Needs help</span>`
                : `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:rgba(22,163,74,0.12);color:#15803d;">Covered</span>`
            return `
<tr>
    <td style="padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;text-align:right;width:60px;">${start}</td>
    <td style="padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-family:ui-monospace,Menlo,Consolas,monospace;color:#475569;font-weight:600;width:78px;">${orderNum}</td>
    <td style="padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top;">
        <div style="font-weight:600;color:#0f172a;">${customer}</div>
        ${subline ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${subline}</div>` : ''}
    </td>
    <td style="padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;text-align:right;width:56px;">${yards}</td>
    <td style="padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;text-align:right;width:60px;">${trucks}</td>
    <td style="padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;text-align:right;width:72px;">${spacing}</td>
    <td style="padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top;width:100px;">${status}</td>
</tr>`
        })
        .join('')
    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;font-size:12.5px;">
    <thead>
        <tr>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:right;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Start</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:left;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Order #</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:left;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Customer</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:right;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Yards</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:right;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Trucks</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:right;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Spacing</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:left;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Status</th>
        </tr>
    </thead>
    <tbody>${rows}</tbody>
</table>`
}

function renderPlantBadge(code, name) {
    if (!code) return ''
    const safeCode = htmlEscape(code)
    const safeName = name ? `&nbsp;<span style="color:#64748b;font-weight:500;">${htmlEscape(name)}</span>` : ''
    return `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;color:#0f172a;">${safeCode}</span>${safeName}`
}

function renderHelpRow({ direction, row, isLast }) {
    const counterLabel = renderPlantBadge(row.counterPlantCode, row.counterPlantName)
    const returnsHome = !row.returnPlantCode || row.returnPlantCode === row.counterPlantCode
    const returnLabel = returnsHome
        ? ''
        : renderPlantBadge(row.returnPlantCode, row.returnPlantName)
    const arrive = row.arriveTime ? htmlEscape(row.arriveTime) : '—'
    const leave = row.leaveTime ? htmlEscape(row.leaveTime) : ''
    const headline = direction === 'in'
        ? `<strong style="color:#0f172a;">${htmlEscape(row.driverLabel)}</strong> from ${counterLabel}`
        : `<strong style="color:#0f172a;">${htmlEscape(row.driverLabel)}</strong> to ${counterLabel}`
    const timingParts = []
    if (direction === 'in') {
        timingParts.push(`Arrives <strong style="color:#0f172a;">${arrive}</strong>`)
        if (leave) timingParts.push(`leaves <strong style="color:#0f172a;">${leave}</strong>`)
    } else {
        timingParts.push(`Arrives at ${counterLabel} <strong style="color:#0f172a;">${arrive}</strong>`)
        if (leave) timingParts.push(`leaves <strong style="color:#0f172a;">${leave}</strong>`)
    }
    const timingLine = `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#475569;font-size:11.5px;">${timingParts.join(' &middot; ')}</span>`
    const forOrder = row.forOrder
    const forLine = forOrder
        ? `<div style="font-size:11.5px;color:#1e293b;margin-top:4px;">
                <span style="display:inline-block;padding:1px 7px;border-radius:999px;background:rgba(14,165,233,0.12);color:#0369a1;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-right:6px;">Direct load</span>
                ${forOrder.orderNum ? `<strong>#${htmlEscape(forOrder.orderNum)}</strong> ` : ''}${htmlEscape(forOrder.customer)}${forOrder.productCode ? ` &middot; <span style="color:#64748b;">${htmlEscape(forOrder.productCode)}</span>` : ''}${forOrder.startTime ? ` &middot; <span style="color:#64748b;">pour ${htmlEscape(String(forOrder.startTime).slice(0, 5))}</span>` : ''}
           </div>`
        : ''
    const returnLine = returnLabel
        ? `<div style="font-size:11.5px;color:#475569;margin-top:4px;">Returns to ${returnLabel} after.</div>`
        : ''
    return `
<div style="padding:9px 0;${isLast ? '' : 'border-bottom:1px solid #e2e8f0;'}">
    <div style="font-size:12.5px;color:#1e293b;">${headline}</div>
    <div style="margin-top:3px;">${timingLine}</div>
    ${forLine}
    ${returnLine}
</div>`
}

function renderHelpCell({ direction, rows }) {
    const directionColor = direction === 'in' ? '#15803d' : '#c2410c'
    const arrow = direction === 'in' ? '&#8600;' : '&#8599;'
    const label = direction === 'in' ? 'Help coming IN' : 'Help going OUT'
    if (!rows || rows.length === 0) {
        return `
<td valign="top" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;width:50%;vertical-align:top;">
    <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;color:${directionColor};">${arrow} ${label}</div>
    <div style="font-size:12.5px;color:#94a3b8;">No cross-plant ${direction === 'in' ? 'arrivals' : 'departures'} scheduled.</div>
</td>`
    }
    const body = rows.map((r, idx) => renderHelpRow({ direction, isLast: idx === rows.length - 1, row: r })).join('')
    return `
<td valign="top" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;width:50%;vertical-align:top;">
    <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;color:${directionColor};">${arrow} ${label}</div>
    ${body}
</td>`
}

function renderHelpSection({ helpIn, helpOut }) {
    return `
<table role="presentation" cellspacing="12" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:12px;margin:0 -12px;">
    <tr>
        ${renderHelpCell({ direction: 'in', rows: helpIn })}
        ${renderHelpCell({ direction: 'out', rows: helpOut })}
    </tr>
</table>`
}

function renderRoster({ roster }) {
    if (!Array.isArray(roster) || roster.length === 0) {
        return `<div style="font-size:12.5px;color:#64748b;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">No operator clock-ins assigned for this plant today.</div>`
    }
    /* Slot-based roster — mirrors the Plan Dashboard's per-plant
     * clock-in board. The dispatch system doesn't assign operator names
     * to slots ahead of time (that happens in the morning), so we list
     * by slot number plus the back-computed clock-in time, an outbound
     * destination tag where applicable, and a leave-off row when the
     * plant's effective base exceeds the day's needed clock-ins. */
    const rows = roster
        .map((op) => {
            const isLeaveOff = op.isLeaveOff === true
            const rowStyle = isLeaveOff
                ? 'padding:9px 10px;border-bottom:1px solid #f1f5f9;color:#94a3b8;background:#fafafa;'
                : 'padding:9px 10px;border-bottom:1px solid #f1f5f9;'
            const slotLabel = op.index ? `Slot ${op.index}` : op.name || '—'
            const clockInCell = isLeaveOff
                ? `<span style="color:#94a3b8;">—</span>`
                : op.clockIn
                  ? htmlEscape(op.clockIn)
                  : '—'
            const destinationTag = op.destinationPlant
                ? `<span style="font-size:10.5px;font-weight:700;color:#0369a1;background:rgba(14,165,233,0.12);padding:2px 8px;border-radius:999px;">&rarr; ${htmlEscape(op.destinationPlant)}</span>`
                : ''
            const flagTone = isLeaveOff
                ? 'color:#64748b;background:#e2e8f0;'
                : op.isOutbound
                  ? 'color:#0369a1;background:rgba(14,165,233,0.12);'
                  : 'color:#b45309;background:rgba(217,119,6,0.12);'
            const flagTag = op.flag
                ? `<span style="font-size:10px;font-weight:700;text-transform:uppercase;${flagTone}padding:2px 7px;border-radius:999px;">${htmlEscape(op.flag)}</span>`
                : ''
            const notesCell = [destinationTag, flagTag].filter(Boolean).join(' ')
            return `
<tr>
    <td style="${rowStyle}">${htmlEscape(slotLabel)}</td>
    <td style="${rowStyle}font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;text-align:right;width:90px;">${clockInCell}</td>
    <td style="${rowStyle}width:180px;">${notesCell || '—'}</td>
</tr>`
        })
        .join('')
    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;font-size:12.5px;">
    <thead>
        <tr>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:left;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Slot</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:right;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Clock in</th>
            <th style="background:#f1f5f9;color:#475569;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;text-align:left;padding:9px 10px;border-bottom:1px solid #e2e8f0;">Notes</th>
        </tr>
    </thead>
    <tbody>${rows}</tbody>
</table>`
}

function renderNotes({ notes }) {
    const normalized = normalizeNotes(notes)
    if (!normalized) return ''
    const escaped = htmlEscape(normalized).replace(/\n/g, '<br/>')
    return `
<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${NAVY};margin:28px 0 12px;padding-bottom:6px;border-bottom:2px solid ${NAVY};">Dispatcher notes</h2>
<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:14px 18px;font-size:13px;line-height:1.55;color:#78350f;border-radius:0 8px 8px 0;">
    ${escaped}
</div>`
}

function renderTextFallback({ plantLabel, dateLabel, kpi, orders, notes }) {
    const lines = [
        `Daily Plan — ${plantLabel}`,
        dateLabel,
        '',
        `Orders: ${kpi?.orderCount || 0} · Loads: ${kpi?.loadCount || 0} · Window: ${kpi?.firstStart || '—'}-${kpi?.lastStart || '—'}`,
        ''
    ]
    if (Array.isArray(orders) && orders.length > 0) {
        lines.push('Orders:')
        orders.forEach((o) => {
            const tag = o.needsHelp ? '[NEEDS HELP] ' : ''
            const spacingPart = Number.isFinite(o.spacingMin) ? ` ${o.spacingMin}min spacing` : ''
            lines.push(
                `  ${o.startTime || '—'}  ${o.orderNum ? '#' + o.orderNum : '—'}  ${o.customer || ''}  ${o.yardage || 0}yd ${o.truckCount || 0} trucks${spacingPart}  ${tag}`.trimEnd()
            )
        })
        lines.push('')
    }
    const normalizedNotes = normalizeNotes(notes)
    if (normalizedNotes) {
        lines.push('Notes:')
        lines.push(normalizedNotes)
    }
    return lines.join('\n')
}

/** Public builder: data → `{ subject, html, text }`. Pure function — every
 *  caller (the Review modal preview, the edge function send, the cron job)
 *  produces the exact same bytes for the same input. */
export function buildDailyPlanEmail({
    plant = { code: '', name: '' },
    planDate = '',
    kpi = {},
    orders = [],
    helpIn = [],
    helpOut = [],
    roster = [],
    notes = '',
    intendedTo = [],
    intendedCc = [],
    testMode = false,
    testRedirectEmail = '',
    frontendUrl = 'https://smyrnatools.com'
}) {
    const dateLong = formatLongDate(planDate)
    const dateShort = formatShortDate(planDate)
    const plantLabel = `Plant ${plant.code}${plant.name ? ` ${plant.name}` : ''}`
    const greetingName = (intendedTo[0]?.name || '').split(' ')[0]
    const greetingLine = greetingName ? `Hello ${htmlEscape(greetingName)},` : 'Hello,'

    const subjectCore = `${plantLabel} — Daily Plan for ${dateShort}`
    const subject = testMode ? `[TEST] ${subjectCore}` : subjectCore

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${htmlEscape(subjectCore)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:720px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 8px 24px rgba(0,0,0,0.04);">
    <tr>
        <td style="background:${ACCENT};color:#ffffff;padding:18px 28px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
                <tr>
                    <td valign="middle">
                        <div style="font-size:18px;font-weight:700;letter-spacing:0.02em;">Smyrna Ready Mix</div>
                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;opacity:0.85;margin-top:2px;">Daily Dispatch Plan</div>
                    </td>
                    <td valign="middle" align="right" style="font-size:13px;font-weight:500;opacity:0.95;">
                        ${htmlEscape(dateLong)}<br/>
                        <span style="font-size:11px;opacity:0.8;">${htmlEscape(plantLabel)}</span>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
    ${testMode ? renderTestBanner({ intendedCc, intendedTo, plantLabel, testRedirectEmail }) : ''}
    <tr>
        <td style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:12px 28px;font-size:12px;color:#78350f;line-height:1.55;">
            <strong style="color:#92400e;text-transform:uppercase;letter-spacing:0.05em;font-size:11px;">Heads up:</strong>
            Plans may be updated through 5:00 PM. You are responsible for reading any updates that come in &mdash; including after you have clocked out for the day.
        </td>
    </tr>
    <tr>
        <td style="padding:28px;">
            <p style="font-size:15px;margin:0 0 6px;">${greetingLine}</p>
            <p style="font-size:13px;color:#64748b;margin:0 0 24px;line-height:1.5;">
                Below is the dispatch plan for <strong>${htmlEscape(plantLabel)}</strong> on ${htmlEscape(dateLong)}. The plan auto-generated from today's schedule.
            </p>
            ${renderSummaryGrid({ kpi })}
            <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${NAVY};margin:28px 0 12px;padding-bottom:6px;border-bottom:2px solid ${NAVY};">Orders for today</h2>
            ${renderOrdersTable({ orders })}
            <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${NAVY};margin:28px 0 12px;padding-bottom:6px;border-bottom:2px solid ${NAVY};">Cross-plant help</h2>
            ${renderHelpSection({ helpIn, helpOut })}
            <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${NAVY};margin:28px 0 12px;padding-bottom:6px;border-bottom:2px solid ${NAVY};">Operator clock-in roster</h2>
            ${renderRoster({ roster })}
            ${renderNotes({ notes })}
        </td>
    </tr>
    <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;font-size:11.5px;color:#64748b;line-height:1.55;text-align:center;">
            Auto-generated by Smyrna Plan Tools &middot; ${htmlEscape(dateLong)}<br/>
            <a href="${htmlEscape(frontendUrl)}" style="color:${NAVY};text-decoration:none;">View the live plan</a>
            ${testMode ? `<div style="margin-top:6px;font-size:10.5px;color:#94a3b8;">Test message — production messages omit the redirect banner above and route to the intended TO + CC.</div>` : ''}
        </td>
    </tr>
</table>
</body>
</html>`

    const text = renderTextFallback({ dateLabel: dateLong, kpi, notes, orders, plantLabel })

    return { html, subject, text }
}

export default buildDailyPlanEmail
