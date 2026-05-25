import { COLORS, COLUMN_WIDTH, LABEL_FONT_SIZE, HELPER_FONT_SIZE } from './MaintenancePdfFormConstants'

/**
 * Low-level jspdf drawing primitives shared across the maintenance-form
 * PDF builder — fill/stroke/text setters, lines, outlined boxes,
 * checkboxes, uppercase labels, helper text, and section headings.
 * Pulled out of the main file so the orchestration logic isn't buried
 * under setter boilerplate.
 */

export function setFill(doc, rgb) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
}

export function setStroke(doc, rgb) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}

export function setText(doc, rgb) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
}

export function drawRule(doc, x1, y, x2, rgb = COLORS.rule) {
    setStroke(doc, rgb)
    doc.setLineWidth(0.5)
    doc.line(x1, y, x2, y)
}

export function drawOutlinedBox(doc, x, y, w, h, { fill = null, stroke = COLORS.border, radius = 3 } = {}) {
    setStroke(doc, stroke)
    doc.setLineWidth(0.6)
    if (fill) {
        setFill(doc, fill)
        doc.roundedRect(x, y, w, h, radius, radius, 'FD')
    } else {
        doc.roundedRect(x, y, w, h, radius, radius, 'S')
    }
}

export function drawCheckbox(doc, x, y, size = 11) {
    setStroke(doc, COLORS.borderStrong)
    doc.setLineWidth(0.7)
    doc.roundedRect(x, y, size, size, 1.5, 1.5, 'S')
}

export function drawUppercaseLabel(doc, label, x, y, { required = false, color = COLORS.label } = {}) {
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

export function drawHelperText(doc, text, x, y, maxWidth) {
    if (!text) return
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(HELPER_FONT_SIZE)
    setText(doc, COLORS.helper)
    doc.text(text, x, y, { maxWidth })
    setText(doc, COLORS.bodyText)
}

/** Renders a flush-left section heading: tracked accent eyebrow above an
 *  uppercase title with a thin rule running the rest of the column. Used
 *  to break the page into "Submission info" and "Inspection items"
 *  groups so the worker reads the form in chapters. */
export function drawSectionHeading(doc, label, x, y, accentRgb) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    setText(doc, accentRgb)
    const text = label.toUpperCase()
    doc.text(text, x, y, { charSpace: 1.2 })
    const labelWidth = doc.getTextWidth(text)
    drawRule(doc, x + labelWidth + 10, y - 3, x + COLUMN_WIDTH, COLORS.border)
    setText(doc, COLORS.bodyText)
    return y + 10
}
