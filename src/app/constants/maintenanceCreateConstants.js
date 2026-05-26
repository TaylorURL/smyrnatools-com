export const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
export const FIELD_LABEL_CLASS = 'block text-[10px] font-semibold uppercase tracking-wider mb-1.5'
export const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

/** Shared input chrome — focus ring + hover border + color-scheme so native
 *  date / time popups follow the active theme. Pair with `FIELD_STYLE` for the
 *  base surface and override `borderColor` inline for error states. */
export const FIELD_INPUT_CLASS =
    'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none transition-colors duration-150 [color-scheme:light] dark:[color-scheme:dark] hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-text-tertiary'

export const FIELD_TEXTAREA_CLASS = `${FIELD_INPUT_CLASS} resize-y min-h-[64px]`

/** Chevron-bearing select class so the dropdown affordance survives
 *  `appearance-none`. */
export const FIELD_SELECT_CLASS = `${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8 bg-no-repeat bg-[right_8px_center] bg-[length:14px] bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%2394a3b8'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='2'%3E%3Cpath%20d='M19%209l-7%207-7-7'/%3E%3C/svg%3E")]`

export const FIELD_TYPES = [
    { icon: 'fa-font', key: 'short_answer', label: 'Short Answer' },
    { icon: 'fa-align-left', key: 'long_answer', label: 'Long Answer' },
    { icon: 'fa-check-square', key: 'checklist', label: 'Checklist' },
    { icon: 'fa-sticky-note', key: 'notes', label: 'Notes' }
]

export const FREQUENCY_OPTIONS = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Bi-weekly', value: 'biweekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Yearly', value: 'yearly' }
]

export const FREQUENCY_HINT = {
    biweekly: 'Task will be due every two weeks starting from this date',
    daily: 'Task will be due every day starting from this date',
    monthly: 'Task will be due on this day of each month',
    quarterly: 'Task will be due quarterly starting from this date',
    weekly: 'Task will be due every week starting from this date',
    yearly: 'Task will be due yearly on this date'
}
