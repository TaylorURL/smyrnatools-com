import { jsPDF } from 'jspdf'

/**
 * Builds a printable PDF from a maintenance form definition. The output is a
 * blank fillable sheet — labeled fields with empty boxes / lines / checkboxes
 * — so a maintenance worker can print, fill by hand, scan, and upload.
 *
 * Layout principles:
 *   - US Letter portrait (612 × 792 pt)
 *   - 0.5" margins
 *   - 11pt body, 9pt labels (uppercase tracking-wide), 16pt title
 *   - Each field gets a labeled box sized to its expected response length
 *   - Multi-page support: any field that won't fit triggers a new page
 */

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 36
const MARGIN_TOP = 36
const MARGIN_BOTTOM = 48
const COLUMN_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const LABEL_FONT_SIZE = 9
const TEXT_FONT_SIZE = 11
const TITLE_FONT_SIZE = 18
const META_FONT_SIZE = 10
const BOX_LINE_HEIGHT = 16
const FIELD_GAP = 14

const TEXT_HEIGHT = 26
const TEXTAREA_HEIGHT = 78
const NUMBER_HEIGHT = 26
const DATE_HEIGHT = 26
const SELECT_HEIGHT = 26
const CHECKLIST_ITEM_HEIGHT = 22
const CHECKLIST_PADDING_BOTTOM = 6
const SIGNATURE_HEIGHT = 60

/** Estimate how tall a rendered field will be so we know when to page-break. */
function estimateFieldHeight(field) {
    const label = 14
    const type = (field.field_type || field.type || 'text').toLowerCase()
    if (type === 'textarea') return label + TEXTAREA_HEIGHT
    if (type === 'number') return label + NUMBER_HEIGHT
    if (type === 'date') return label + DATE_HEIGHT
    if (type === 'select') return label + SELECT_HEIGHT
    if (type === 'signature') return label + SIGNATURE_HEIGHT
    if (type === 'checklist') {
        const items = field.options?.items?.length || 0
        return label + items * CHECKLIST_ITEM_HEIGHT + CHECKLIST_PADDING_BOTTOM
    }
    return label + TEXT_HEIGHT
}

/** Single horizontal rule for write-on lines. */
function drawLine(doc, x1, y, x2) {
    doc.setDrawColor(120)
    doc.setLineWidth(0.5)
    doc.line(x1, y, x2, y)
}

/** Outlined box for any field that needs an enclosed write-in area. */
function drawBox(doc, x, y, w, h) {
    doc.setDrawColor(170)
    doc.setLineWidth(0.6)
    doc.rect(x, y, w, h)
}

/** Empty checkbox glyph. */
function drawCheckbox(doc, x, y, size = 10) {
    doc.setDrawColor(80)
    doc.setLineWidth(0.7)
    doc.rect(x, y, size, size)
}

function drawLabel(doc, label, x, y, required) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    doc.setTextColor(60)
    const text = (label || '').toUpperCase()
    doc.text(text, x, y)
    if (required) {
        const w = doc.getTextWidth(text)
        doc.setTextColor(196, 30, 30)
        doc.text(' *', x + w, y)
    }
    doc.setTextColor(20)
}

function drawHeader(doc, { title, plantCode, dueDate, formId, frequency }) {
    let y = MARGIN_TOP + 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(TITLE_FONT_SIZE)
    doc.setTextColor(20)
    doc.text(title || 'Maintenance Form', MARGIN_X, y)
    y += 4
    drawLine(doc, MARGIN_X, y + 8, PAGE_WIDTH - MARGIN_X)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(META_FONT_SIZE)
    doc.setTextColor(80)
    const metaParts = []
    if (plantCode) metaParts.push(`Plant ${plantCode}`)
    if (dueDate) metaParts.push(`Due ${dueDate}`)
    if (frequency) metaParts.push(`Frequency · ${frequency}`)
    if (metaParts.length) doc.text(metaParts.join('   ·   '), MARGIN_X, y)

    // Submitted-by + date lines on the right
    const rightX = PAGE_WIDTH - MARGIN_X
    const labelY = y - 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    doc.setTextColor(60)
    doc.text('SUBMITTED BY', rightX - 180, labelY)
    drawLine(doc, rightX - 180, labelY + 4, rightX)
    doc.setTextColor(80)
    doc.setFontSize(META_FONT_SIZE)
    doc.setFont('helvetica', 'normal')
    if (formId) {
        doc.setFontSize(8)
        doc.setTextColor(140)
        doc.text(`Form ID: ${formId}`, rightX, y, { align: 'right' })
    }
    return y + 18
}

function drawFooter(doc, pageNumber, totalPages, { formId, dueDate }) {
    const y = PAGE_HEIGHT - 24
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140)
    const left = [formId && `Form ${formId}`, dueDate && `Due ${dueDate}`].filter(Boolean).join('  ·  ')
    if (left) doc.text(left, MARGIN_X, y)
    doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_WIDTH - MARGIN_X, y, { align: 'right' })
    drawLine(doc, MARGIN_X, y - 8, PAGE_WIDTH - MARGIN_X)
}

/** Render a single form field starting at (x, y). Returns the new y cursor. */
function renderField(doc, field, x, y) {
    const type = (field.field_type || field.type || 'text').toLowerCase()
    const labelY = y + 10
    drawLabel(doc, field.label || field.name || 'Field', x, labelY, !!field.required)
    let cursor = labelY + 6
    const w = COLUMN_WIDTH

    if (type === 'textarea') {
        const h = TEXTAREA_HEIGHT
        drawBox(doc, x, cursor, w, h)
        // Faint guide lines inside the box.
        for (let line = 1; line < Math.floor(h / BOX_LINE_HEIGHT); line++) {
            drawLine(doc, x + 4, cursor + line * BOX_LINE_HEIGHT, x + w - 4)
        }
        cursor += h
    } else if (type === 'number') {
        drawBox(doc, x, cursor, 120, NUMBER_HEIGHT)
        cursor += NUMBER_HEIGHT
    } else if (type === 'date') {
        drawBox(doc, x, cursor, 140, DATE_HEIGHT)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(140)
        doc.text('MM / DD / YYYY', x + 6, cursor + 17)
        doc.setTextColor(20)
        cursor += DATE_HEIGHT
    } else if (type === 'select') {
        const options = field.options?.choices || field.options?.values || field.options || []
        const optionList = Array.isArray(options) ? options : []
        const text = optionList.length ? `Select one: ${optionList.join('  ·  ')}` : 'Select one'
        drawBox(doc, x, cursor, w, SELECT_HEIGHT)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.setTextColor(120)
        doc.text(text, x + 6, cursor + 17, { maxWidth: w - 12 })
        doc.setTextColor(20)
        cursor += SELECT_HEIGHT
    } else if (type === 'signature') {
        drawBox(doc, x, cursor, w, SIGNATURE_HEIGHT)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(140)
        doc.text('Signature', x + 6, cursor + SIGNATURE_HEIGHT - 6)
        doc.setTextColor(20)
        cursor += SIGNATURE_HEIGHT
    } else if (type === 'checklist') {
        const items = field.options?.items || []
        items.forEach((item) => {
            drawCheckbox(doc, x, cursor + 4, 10)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(TEXT_FONT_SIZE)
            doc.setTextColor(20)
            doc.text(String(item), x + 18, cursor + 12)
            cursor += CHECKLIST_ITEM_HEIGHT
        })
        cursor += CHECKLIST_PADDING_BOTTOM
    } else {
        drawBox(doc, x, cursor, w, TEXT_HEIGHT)
        cursor += TEXT_HEIGHT
    }

    return cursor + FIELD_GAP
}

/**
 * Build the printable form PDF in-memory.
 *
 * @param {object} form - Maintenance form record with `maintenance_form_fields`
 * @param {object} [options]
 * @param {string} [options.plantCode]
 * @param {string} [options.dueDate]   YYYY-MM-DD
 * @param {string} [options.frequency] Human-readable frequency label
 * @returns {jsPDF} the prepared document (caller decides save/open/blob)
 */
export function buildMaintenanceFormPdf(form, options = {}) {
    if (!form) throw new Error('Cannot build PDF — form is missing.')
    const fields = (form.maintenance_form_fields || form.fields || [])
        .slice()
        .sort((a, b) => (a.order ?? a.position ?? 0) - (b.order ?? b.position ?? 0))
    const doc = new jsPDF({ format: 'letter', orientation: 'portrait', unit: 'pt' })
    const meta = {
        dueDate: options.dueDate || '',
        formId: form.id ? String(form.id).slice(0, 8) : '',
        frequency: options.frequency || form.frequency || '',
        plantCode: options.plantCode || '',
        title: form.title || form.name || 'Maintenance Form'
    }

    let cursorY = drawHeader(doc, meta)
    const usableBottom = PAGE_HEIGHT - MARGIN_BOTTOM

    // Instructional sub-line
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(
        'Print this form, complete every required field by hand, then scan and upload the finished sheet for review.',
        MARGIN_X,
        cursorY,
        { maxWidth: COLUMN_WIDTH }
    )
    doc.setTextColor(20)
    cursorY += 18

    if (fields.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(11)
        doc.setTextColor(140)
        doc.text('This form has no fields configured.', MARGIN_X, cursorY + 20)
    }

    fields.forEach((field) => {
        const needed = estimateFieldHeight(field)
        if (cursorY + needed > usableBottom) {
            doc.addPage()
            cursorY = drawHeader(doc, meta)
        }
        cursorY = renderField(doc, field, MARGIN_X, cursorY)
    })

    // Footer pass once we know total pages.
    const total = doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        drawFooter(doc, i, total, { dueDate: meta.dueDate, formId: meta.formId })
    }
    return doc
}

/** Convenience — trigger a browser download of the blank form PDF. */
export function downloadMaintenanceFormPdf(form, options = {}) {
    const doc = buildMaintenanceFormPdf(form, options)
    const safeTitle = (form?.title || 'maintenance-form')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    const datePart = options?.dueDate ? `_${options.dueDate}` : ''
    const plantPart = options?.plantCode ? `_${options.plantCode}` : ''
    doc.save(`${safeTitle}${plantPart}${datePart}.pdf`)
}
