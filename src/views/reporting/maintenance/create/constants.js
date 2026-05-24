export const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
export const FIELD_LABEL_CLASS = 'block text-[10px] font-semibold uppercase tracking-wider mb-1.5'
export const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

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
