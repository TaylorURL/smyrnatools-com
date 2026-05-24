/* eslint-disable react/forbid-dom-props */

export const RENEWAL_WARN_DAYS = 90
export const CALIBRATION_WARN_DAYS = 30

export const SCALE_TYPES = ['batch', 'aggregate', 'truck', 'water', 'admixture', 'cement', 'other']

/**
 * Status descriptors share the same `status-badge-*` utility classes the rest
 * of the app uses (defined in app/index.css with `html.dark` overrides), so
 * pills flip cleanly between light and dark mode without per-status hex math.
 */
export const STATUS_BADGE = {
    due_soon: { cls: 'status-badge-warning', label: 'Due Soon' },
    expired: { cls: 'status-badge-danger', label: 'Expired' },
    expiring: { cls: 'status-badge-warning', label: 'Expiring' },
    ok: { cls: 'status-badge-success', label: 'OK' },
    overdue: { cls: 'status-badge-danger', label: 'Overdue' },
    unknown: { cls: 'status-badge-neutral', label: 'Not Set' },
    valid: { cls: 'status-badge-success', label: 'Valid' }
}

export const SCALE_ICON_TONE_CLASS = {
    due_soon: 'status-badge-warning',
    ok: 'status-badge-success',
    overdue: 'status-badge-danger',
    unknown: 'status-badge-neutral'
}

export const STATUS_PILL_CLS =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0'

// Shared form-control styling — flat 1px-bordered pill matching the Plan
// tab's settings panels so the page reads as one design system.
export const INPUT_CLS = 'w-full rounded px-3 py-2.5 text-sm outline-none transition-colors'
export const INPUT_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
export const SELECT_CLS = `${INPUT_CLS} appearance-none cursor-pointer`
