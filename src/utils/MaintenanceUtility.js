/**
 * Maintenance form helpers: date formatting, frequency labels, and field-type
 * icon/label resolution. The richer parse / validate / response-build helpers
 * have been removed — their dynamic-form consumer surface was retired.
 */
export function formatMaintenanceDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
}
export function formatMaintenanceDateShort(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
    })
}
export function formatFrequency(frequency, value = 1) {
    const labels = {
        biweekly: 'Bi-weekly',
        daily: value === 1 ? 'Daily' : `Every ${value} days`,
        monthly: value === 1 ? 'Monthly' : `Every ${value} months`,
        quarterly: 'Quarterly',
        weekly: value === 1 ? 'Weekly' : `Every ${value} weeks`,
        yearly: value === 1 ? 'Yearly' : `Every ${value} years`
    }
    return labels[frequency] || frequency
}
export function getFieldTypeIcon(type) {
    switch (type) {
        case 'short_answer':
            return 'fa-font'
        case 'long_answer':
            return 'fa-align-left'
        case 'checklist':
            return 'fa-check-square'
        case 'notes':
            return 'fa-sticky-note'
        default:
            return 'fa-question'
    }
}
export function getFieldTypeName(type) {
    switch (type) {
        case 'short_answer':
            return 'Short Answer'
        case 'long_answer':
            return 'Long Answer'
        case 'checklist':
            return 'Checklist'
        case 'notes':
            return 'Notes'
        default:
            return type
    }
}
