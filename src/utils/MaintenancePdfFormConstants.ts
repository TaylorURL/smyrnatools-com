/**
 * Page geometry, type scale, field heights, and palette constants shared
 * by `MaintenancePdfFormUtility` and its drawing primitives. Pulled into
 * a separate file so the main builder reads as orchestration on top of
 * declarative layout values.
 */

/* ── Page geometry ──────────────────────────────────────────────────────── */
export const PAGE_WIDTH = 612
export const PAGE_HEIGHT = 792
export const MARGIN_X = 36
export const MARGIN_BOTTOM = 56
export const COLUMN_WIDTH = PAGE_WIDTH - MARGIN_X * 2
export const HEADER_BAND_HEIGHT = 64
export const HEADER_META_HEIGHT = 60

/* ── Type scale ─────────────────────────────────────────────────────────── */
export const LABEL_FONT_SIZE = 8.5
export const TEXT_FONT_SIZE = 11
export const TITLE_FONT_SIZE = 18
export const HELPER_FONT_SIZE = 8.5

/* ── Field heights ──────────────────────────────────────────────────────── */
export const TEXT_HEIGHT = 28
export const TEXTAREA_HEIGHT = 84
export const NUMBER_HEIGHT = 28
export const DATE_HEIGHT = 28
export const SELECT_HEIGHT = 30
export const CHECKLIST_ITEM_HEIGHT = 22
export const CHECKLIST_PADDING_BOTTOM = 8
export const SIGNATURE_HEIGHT = 56
export const FIELD_GAP = 16
export const LABEL_BLOCK_HEIGHT = 18
export const HELPER_BLOCK_HEIGHT = 12

export const FALLBACK_ACCENT = '#1e3a5f'

export const COLORS = {
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

/** Title-cases the first letter of each word in a value, leaving the rest
 *  alone so existing capitalization (e.g. acronyms in form titles) survives.
 *  Used for the on-page Frequency display so "monthly" reads as "Monthly"
 *  without us mass-rewriting the underlying DB enum values. */
export function titleCase(value) {
    return String(value || '')
        .trim()
        .replace(/\b([a-z])/g, (_, ch) => ch.toUpperCase())
}

/** Strip filesystem-illegal / awkward characters from a value but preserve
 *  spaces and casing so the downloaded PDF reads as a human filename rather
 *  than a kebab-cased slug. */
export function sanitizeFilenamePart(value) {
    return String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Convert a `#rrggbb` (or `#rgb`) string to a `[r,g,b]` triple jspdf wants. */
export function hexToRgb(hex) {
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
