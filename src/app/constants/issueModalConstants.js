/**
 * Severity accents outside the pill: `fg` is the saturated colour a rule or
 * border takes, `icon` the glyph that goes in front of the label. A pill's own
 * background never comes from here — that is the Badge tone below.
 */
export const SEVERITY_PALETTE = {
    High: { fg: 'var(--status-danger)', icon: 'fa-triangle-exclamation' },
    Low: { fg: 'var(--status-active)', icon: 'fa-circle-info' },
    Medium: { fg: 'var(--notice-warning-icon)', icon: 'fa-circle-exclamation' }
}

/**
 * Severity read as a Badge tone, so a severity pill carries the same theme
 * tokens as every other pill in the app rather than a palette of its own.
 */
export const SEVERITY_TO_TONE = {
    High: 'danger',
    Low: 'success',
    Medium: 'warning'
}
