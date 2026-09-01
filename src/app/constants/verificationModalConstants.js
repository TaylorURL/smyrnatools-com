import { formatCentralDateTime } from '../../utils/PlanUtility'
export const SECTION_TITLE_CLASS = 'text-[13.5px] font-semibold leading-tight text-text-primary'

export const SECTION_SUBTITLE_CLASS = 'text-[11.5px] leading-tight text-text-tertiary mt-0.5'

export const PILL_BASE =
    'inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 shrink-0'

export const FIELD_LABEL_CLASS = 'inline-flex items-center gap-1 text-[12px] font-medium mb-1.5'

export const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

// Indexed directly by the 1-5 rating value; index 0 is unused.
export const RATING_LABELS = [null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

/** Returns the background and foreground palette for a maintenance issue severity. */
export function getSeverityPalette(severity) {
    switch (severity) {
        case 'High':
            return { bg: 'var(--notice-danger-bg)', fg: 'var(--notice-danger-soft)' }
        case 'Medium':
            return { bg: 'var(--notice-warning-bg-strong)', fg: 'var(--notice-warning-strong)' }
        case 'Low':
            return { bg: 'var(--tint-info-bg)', fg: 'var(--tint-info-ink-deep)' }
        default:
            return { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' }
    }
}

/** Formats an ISO date string with the user's locale. Returns '' for falsy input. */
export function formatVerificationDate(dateString) {
    if (!dateString) return ''
    return formatCentralDateTime(dateString)
}
