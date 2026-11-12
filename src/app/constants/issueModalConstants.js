/**
 * Severity read as a Badge tone, so a severity pill carries the same theme
 * tokens as every other pill in the app rather than a palette of its own.
 */
export const SEVERITY_TO_TONE = {
    High: 'danger',
    Low: 'success',
    Medium: 'warning'
}

/**
 * The bar down the left edge of an issue row, in the same status tokens as
 * its severity pill's dot, so the two always agree.
 */
export const SEVERITY_TO_BAR = {
    High: 'bg-status-danger',
    Low: 'bg-status-active',
    Medium: 'bg-status-warning'
}
