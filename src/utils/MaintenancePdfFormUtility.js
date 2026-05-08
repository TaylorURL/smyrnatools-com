import { jsPDF } from 'jspdf'

/**
 * Builds a printable PDF from a maintenance form definition. The output is a
 * blank fillable sheet — the worker writes their plant, the date they
 * completed the work, every defined field, and signs at the bottom. The
 * design mirrors the in-app Plan-tab look: an accent-coloured header band,
 * uppercase labels with tracking, flat outlined inputs, and a slim footer.
 *
 * Layout principles:
 *   - US Letter portrait (612 × 792 pt)
 *   - 0.5" side margins, accent-coloured top band
 *   - 11pt body, 9pt labels (uppercase tracking-wide), 18pt title
 *   - Each field is a card: label / helper / fillable input
 *   - Multi-page support — fields that won't fit trigger a page break with
 *     the same header band repeated up top
 */

/* ── Page geometry ──────────────────────────────────────────────────────── */
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 36
const MARGIN_BOTTOM = 56
const COLUMN_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const HEADER_BAND_HEIGHT = 64
const HEADER_META_HEIGHT = 60

/* ── Type scale ─────────────────────────────────────────────────────────── */
const LABEL_FONT_SIZE = 8.5
const TEXT_FONT_SIZE = 11
const TITLE_FONT_SIZE = 18
const HELPER_FONT_SIZE = 8.5

/* ── Field heights ──────────────────────────────────────────────────────── */
const TEXT_HEIGHT = 28
const TEXTAREA_HEIGHT = 84
const NUMBER_HEIGHT = 28
const DATE_HEIGHT = 28
const SELECT_HEIGHT = 30
const CHECKLIST_ITEM_HEIGHT = 22
const CHECKLIST_PADDING_BOTTOM = 8
const SIGNATURE_HEIGHT = 56
const FIELD_GAP = 16
const LABEL_BLOCK_HEIGHT = 18
const HELPER_BLOCK_HEIGHT = 12

/* ── Palette helpers ────────────────────────────────────────────────────── */

const FALLBACK_ACCENT = '#1e3a5f'

/** Convert a `#rrggbb` (or `#rgb`) string to a `[r,g,b]` triple jspdf wants. */
function hexToRgb(hex) {
    const cleaned = (hex || '').replace('#', '').trim()
    if (cleaned.length === 3) {
        return [
            parseInt(cleaned[0] + cleaned[0], 16),
            parseInt(cleaned[1] + cleaned[1], 16),
            parseInt(cleaned[2] + cleaned[2], 16)
        ]
    }
    if (cleaned.length === 6) {
        return [parseInt(cleaned.slice(0, 2), 16), parseInt(cleaned.slice(2, 4), 16), parseInt(cleaned.slice(4, 6), 16)]
    }
    return hexToRgb(FALLBACK_ACCENT)
}

const COLORS = {
    accentText: [255, 255, 255],
    bodyText: [30, 41, 59], // slate-800
    border: [203, 213, 225], // slate-300
    borderStrong: [148, 163, 184], // slate-400
    helper: [148, 163, 184], // slate-400
    label: [71, 85, 105], // slate-600
    panelBg: [248, 250, 252], // slate-50
    placeholder: [148, 163, 184],
    rule: [226, 232, 240] // slate-200
}

/* ── Low-level drawing ─────────────────────────────────────────────────── */

function setFill(doc, rgb) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
}

function setStroke(doc, rgb) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}

function setText(doc, rgb) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
}

function drawRule(doc, x1, y, x2, rgb = COLORS.rule) {
    setStroke(doc, rgb)
    doc.setLineWidth(0.5)
    doc.line(x1, y, x2, y)
}

function drawOutlinedBox(doc, x, y, w, h, { fill = null, stroke = COLORS.border, radius = 3 } = {}) {
    setStroke(doc, stroke)
    doc.setLineWidth(0.6)
    if (fill) {
        setFill(doc, fill)
        doc.roundedRect(x, y, w, h, radius, radius, 'FD')
    } else {
        doc.roundedRect(x, y, w, h, radius, radius, 'S')
    }
}

function drawCheckbox(doc, x, y, size = 11) {
    setStroke(doc, COLORS.borderStrong)
    doc.setLineWidth(0.7)
    doc.roundedRect(x, y, size, size, 1.5, 1.5, 'S')
}

function drawUppercaseLabel(doc, label, x, y, { required = false, color = COLORS.label } = {}) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    setText(doc, color)
    const text = (label || '').toUpperCase()
    doc.text(text, x, y, { charSpace: 0.6 })
    if (required) {
        const w = doc.getTextWidth(text) + 4
        setText(doc, [220, 38, 38])
        doc.text('*', x + w, y)
    }
    setText(doc, COLORS.bodyText)
}

function drawHelperText(doc, text, x, y, maxWidth) {
    if (!text) return
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(HELPER_FONT_SIZE)
    setText(doc, COLORS.helper)
    doc.text(text, x, y, { maxWidth })
    setText(doc, COLORS.bodyText)
}

/* ── Header / footer ───────────────────────────────────────────────────── */

/** Renders the accent-band header + meta strip. Returns the y cursor where
 *  body content should start. */
function drawHeader(doc, meta, accentRgb) {
    // Accent band
    setFill(doc, accentRgb)
    doc.rect(0, 0, PAGE_WIDTH, HEADER_BAND_HEIGHT, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(TITLE_FONT_SIZE)
    setText(doc, COLORS.accentText)
    doc.text(meta.title || 'Maintenance Form', MARGIN_X, 38)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(doc, [255, 255, 255])
    const subtitle = [
        meta.frequency && `${meta.frequency.toUpperCase()} INSPECTION`,
        'PRINT · COMPLETE · SCAN · UPLOAD'
    ]
        .filter(Boolean)
        .join('   ·   ')
    doc.text(subtitle, MARGIN_X, 54, { charSpace: 0.6 })

    if (meta.formId) {
        doc.setFontSize(8)
        setText(doc, [226, 232, 240])
        doc.text(`Form ID  ${meta.formId}`, PAGE_WIDTH - MARGIN_X, 54, { align: 'right', charSpace: 0.6 })
    }

    // Meta strip — three info blocks: form name, frequency, generated at.
    const stripTop = HEADER_BAND_HEIGHT
    setFill(doc, COLORS.panelBg)
    doc.rect(0, stripTop, PAGE_WIDTH, HEADER_META_HEIGHT, 'F')
    drawRule(doc, 0, stripTop + HEADER_META_HEIGHT, PAGE_WIDTH, COLORS.border)

    const cellY = stripTop + 14
    const cellPad = 16
    const cellWidth = (PAGE_WIDTH - MARGIN_X * 2) / 3

    const cells = [
        { label: 'Form Title', value: meta.title || '—' },
        { label: 'Frequency', value: meta.frequency || 'Ad hoc' },
        {
            label: 'Generated',
            value: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        }
    ]

    cells.forEach((cell, i) => {
        const x = MARGIN_X + cellWidth * i
        drawUppercaseLabel(doc, cell.label, x, cellY, { color: COLORS.label })
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        setText(doc, COLORS.bodyText)
        doc.text(cell.value, x, cellY + 18, { maxWidth: cellWidth - cellPad })
    })

    return stripTop + HEADER_META_HEIGHT + 22
}

function drawFooter(doc, pageNumber, totalPages, accentRgb, meta) {
    const y = PAGE_HEIGHT - 24
    drawRule(doc, MARGIN_X, y - 14, PAGE_WIDTH - MARGIN_X, COLORS.border)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setText(doc, accentRgb)
    doc.text((meta.title || 'MAINTENANCE FORM').toUpperCase(), MARGIN_X, y, { charSpace: 0.6 })

    doc.setFont('helvetica', 'normal')
    setText(doc, COLORS.helper)
    doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_WIDTH - MARGIN_X, y, { align: 'right' })
}

/* ── Field rendering ───────────────────────────────────────────────────── */

const PLANT_FIELD_KEY = '__plant'
const COMPLETION_DATE_FIELD_KEY = '__completed_at'
const SUBMITTER_FIELD_KEY = '__submitter'

/** The synthetic header fields rendered at the top of every form so the
 *  worker self-reports plant + date + name without us having to store any
 *  of it ahead of time. Mirrors a website "info row" up top. */
function buildHeaderFields() {
    return [
        {
            field_type: 'text',
            helper: 'Three-letter plant code (e.g. ATL, TEN, MOB).',
            id: PLANT_FIELD_KEY,
            label: 'Plant',
            required: true,
            width: 'half'
        },
        {
            field_type: 'date',
            id: COMPLETION_DATE_FIELD_KEY,
            label: 'Completion Date',
            required: true,
            width: 'half'
        },
        {
            field_type: 'text',
            helper: 'Print legibly — this becomes the submission record.',
            id: SUBMITTER_FIELD_KEY,
            label: 'Completed By',
            required: true,
            width: 'full'
        }
    ]
}

function getFieldType(field) {
    return (field.field_type || field.type || 'text').toLowerCase()
}

function estimateFieldHeight(field) {
    const labelBlock = LABEL_BLOCK_HEIGHT + (field.helper ? HELPER_BLOCK_HEIGHT : 0)
    const type = getFieldType(field)
    if (type === 'textarea') return labelBlock + TEXTAREA_HEIGHT
    if (type === 'number') return labelBlock + NUMBER_HEIGHT
    if (type === 'date') return labelBlock + DATE_HEIGHT
    if (type === 'select') return labelBlock + SELECT_HEIGHT
    if (type === 'signature') return labelBlock + SIGNATURE_HEIGHT
    if (type === 'checklist') {
        const items = field.options?.items?.length || 0
        return labelBlock + items * CHECKLIST_ITEM_HEIGHT + CHECKLIST_PADDING_BOTTOM
    }
    return labelBlock + TEXT_HEIGHT
}

function renderFieldHead(doc, field, x, y) {
    drawUppercaseLabel(doc, field.label || field.name || 'Field', x, y + 9, { required: !!field.required })
    let cursor = y + LABEL_BLOCK_HEIGHT
    if (field.helper) {
        drawHelperText(doc, field.helper, x, cursor, COLUMN_WIDTH)
        cursor += HELPER_BLOCK_HEIGHT
    }
    return cursor
}

function renderTextInput(doc, x, y, width, height) {
    drawOutlinedBox(doc, x, y, width, height, { fill: [255, 255, 255] })
}

function renderDateInput(doc, x, y) {
    const w = 180
    drawOutlinedBox(doc, x, y, w, DATE_HEIGHT, { fill: [255, 255, 255] })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setText(doc, COLORS.placeholder)
    doc.text('MM / DD / YYYY', x + 8, y + 18, { charSpace: 0.6 })
    setText(doc, COLORS.bodyText)
}

function renderTextareaInput(doc, x, y) {
    drawOutlinedBox(doc, x, y, COLUMN_WIDTH, TEXTAREA_HEIGHT, { fill: [255, 255, 255] })
    setStroke(doc, COLORS.rule)
    doc.setLineWidth(0.4)
    const lineSpacing = 18
    for (let line = 1; line < Math.floor(TEXTAREA_HEIGHT / lineSpacing); line++) {
        doc.line(x + 8, y + line * lineSpacing, x + COLUMN_WIDTH - 8, y + line * lineSpacing)
    }
}

function renderSelectInput(doc, field, x, y) {
    const options = field.options?.choices || field.options?.values || field.options || []
    const optionList = Array.isArray(options) ? options : []
    drawOutlinedBox(doc, x, y, COLUMN_WIDTH, SELECT_HEIGHT, { fill: [255, 255, 255] })
    if (optionList.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        setText(doc, COLORS.placeholder)
        doc.text('Write the selected option in this field.', x + 8, y + 19)
        setText(doc, COLORS.bodyText)
        return
    }

    // Render a row of pill chips representing the choices.
    const pillHeight = 18
    const pillY = y + (SELECT_HEIGHT - pillHeight) / 2
    let pillX = x + 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    optionList.forEach((option) => {
        const label = String(option)
        const textWidth = doc.getTextWidth(label)
        const pillWidth = textWidth + 18
        if (pillX + pillWidth > x + COLUMN_WIDTH - 8) return
        drawOutlinedBox(doc, pillX, pillY, pillWidth, pillHeight, {
            fill: COLORS.panelBg,
            radius: 9,
            stroke: COLORS.border
        })
        drawCheckbox(doc, pillX + 6, pillY + 4, 10)
        setText(doc, COLORS.label)
        doc.text(label, pillX + 20, pillY + 12)
        setText(doc, COLORS.bodyText)
        pillX += pillWidth + 6
    })
}

function renderChecklistInput(doc, field, x, y) {
    const items = field.options?.items || []
    let cursor = y
    items.forEach((item, idx) => {
        const rowY = cursor
        if (idx > 0) {
            drawRule(doc, x, rowY, x + COLUMN_WIDTH, COLORS.rule)
        }
        drawCheckbox(doc, x + 4, rowY + 6, 11)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(TEXT_FONT_SIZE)
        setText(doc, COLORS.bodyText)
        doc.text(String(item), x + 24, rowY + 14, { maxWidth: COLUMN_WIDTH - 30 })
        cursor += CHECKLIST_ITEM_HEIGHT
    })
    return cursor + CHECKLIST_PADDING_BOTTOM
}

function renderSignatureInput(doc, x, y) {
    drawOutlinedBox(doc, x, y, COLUMN_WIDTH, SIGNATURE_HEIGHT, { fill: [255, 255, 255] })
    drawUppercaseLabel(doc, 'Signature', x + 8, y + 12, { color: COLORS.placeholder })
    drawUppercaseLabel(doc, 'Date', x + COLUMN_WIDTH - 80, y + 12, { color: COLORS.placeholder })
    drawRule(doc, x + COLUMN_WIDTH - 80, y + SIGNATURE_HEIGHT - 8, x + COLUMN_WIDTH - 8, COLORS.borderStrong)
}

/**
 * Render a single form field starting at (x, y). Returns the new y cursor
 * (advanced past the field plus FIELD_GAP).
 */
function renderField(doc, field, x, y) {
    const type = getFieldType(field)
    const inputTop = renderFieldHead(doc, field, x, y)

    if (type === 'textarea') {
        renderTextareaInput(doc, x, inputTop)
        return inputTop + TEXTAREA_HEIGHT + FIELD_GAP
    }
    if (type === 'number') {
        renderTextInput(doc, x, inputTop, 160, NUMBER_HEIGHT)
        return inputTop + NUMBER_HEIGHT + FIELD_GAP
    }
    if (type === 'date') {
        renderDateInput(doc, x, inputTop)
        return inputTop + DATE_HEIGHT + FIELD_GAP
    }
    if (type === 'select') {
        renderSelectInput(doc, field, x, inputTop)
        return inputTop + SELECT_HEIGHT + FIELD_GAP
    }
    if (type === 'signature') {
        renderSignatureInput(doc, x, inputTop)
        return inputTop + SIGNATURE_HEIGHT + FIELD_GAP
    }
    if (type === 'checklist') {
        const after = renderChecklistInput(doc, field, x, inputTop)
        return after + FIELD_GAP
    }
    renderTextInput(doc, x, inputTop, COLUMN_WIDTH, TEXT_HEIGHT)
    return inputTop + TEXT_HEIGHT + FIELD_GAP
}

/* ── Public API ────────────────────────────────────────────────────────── */

/**
 * Build the printable form PDF in-memory.
 *
 * @param {object} form - Maintenance form record with `maintenance_form_fields`
 * @param {object} [options]
 * @param {string} [options.frequency] Human-readable frequency label
 * @param {string} [options.accentColor] Hex (e.g. `#1e3a5f`) used for the
 *   accent band + footer ribbon. Falls back to the app's default navy.
 * @returns {jsPDF} the prepared document (caller decides save/open/blob)
 */
export function buildMaintenanceFormPdf(form, options = {}) {
    if (!form) throw new Error('Cannot build PDF — form is missing.')
    const fields = (form.maintenance_form_fields || form.fields || [])
        .slice()
        .sort((a, b) => (a.order ?? a.position ?? 0) - (b.order ?? b.position ?? 0))

    const doc = new jsPDF({ format: 'letter', orientation: 'portrait', unit: 'pt' })
    const accentRgb = hexToRgb(options.accentColor || FALLBACK_ACCENT)
    const meta = {
        formId: form.id ? String(form.id).slice(0, 8) : '',
        frequency: options.frequency || form.frequency || '',
        title: form.title || form.name || 'Maintenance Form'
    }

    let cursorY = drawHeader(doc, meta, accentRgb)
    const usableBottom = PAGE_HEIGHT - MARGIN_BOTTOM

    // Instructional sub-line
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9.5)
    setText(doc, COLORS.helper)
    doc.text(
        'Print this form, hand-write every field, then scan and upload the finished sheet for review.',
        MARGIN_X,
        cursorY,
        { maxWidth: COLUMN_WIDTH }
    )
    setText(doc, COLORS.bodyText)
    cursorY += 18

    // Always-rendered header fields — plant / date / submitter — followed by
    // the form-defined fields.
    const allFields = [...buildHeaderFields(), ...fields]

    if (fields.length === 0) {
        // Still render header fields so the worker has somewhere to write
        // even when the template is empty.
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        setText(doc, COLORS.helper)
    }

    allFields.forEach((field) => {
        const needed = estimateFieldHeight(field)
        if (cursorY + needed > usableBottom) {
            doc.addPage()
            cursorY = drawHeader(doc, meta, accentRgb)
        }
        cursorY = renderField(doc, field, MARGIN_X, cursorY)
    })

    if (fields.length === 0) {
        // Friendly note under the synthetic fields when no template fields exist.
        if (cursorY + 60 > usableBottom) {
            doc.addPage()
            cursorY = drawHeader(doc, meta, accentRgb)
        }
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        setText(doc, COLORS.helper)
        doc.text(
            'No template fields are configured — submit the header info above and any free-form notes you need.',
            MARGIN_X,
            cursorY + 16,
            { maxWidth: COLUMN_WIDTH }
        )
        setText(doc, COLORS.bodyText)
    }

    // Footer pass once we know total pages.
    const total = doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        drawFooter(doc, i, total, accentRgb, meta)
    }
    return doc
}

/**
 * Convenience — trigger a browser download of the blank form PDF. Filename
 * uses the form title and the date the PDF was generated (the worker fills
 * in the actual completion date by hand).
 */
export function downloadMaintenanceFormPdf(form, options = {}) {
    const doc = buildMaintenanceFormPdf(form, options)
    const safeTitle = (form?.title || 'maintenance-form')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    const today = new Date().toISOString().slice(0, 10)
    doc.save(`${safeTitle}_${today}.pdf`)
}
