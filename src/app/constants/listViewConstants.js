/** Maps internal status keys to their user-facing display labels. */
export const STATUS_MAP = {
    completed: 'Completed',
    in_progress: 'In Progress',
    ordered_materials: 'Ordered Materials',
    overdue: 'Overdue',
    pending: 'Pending',
    waiting: 'Waiting'
}

export const STATUS_OPTIONS = ['Pending', 'In Progress', 'Ordered Materials', 'Waiting', 'Overdue', 'Completed']

/**
 * Coerces legacy `blocked` status to `waiting` since the two are now treated identically.
 * Apply this anywhere we read a raw `item.status` before mapping it to a label, icon, color,
 * group, or filter comparison. Newly created items never use `blocked` — this exists solely
 * for records that pre-date the merge.
 */
export const normalizeListStatus = (status) => (status === 'blocked' ? 'waiting' : status)

/** Maps internal role keys to their user-facing display labels. */
export const ROLE_MAP = {
    district_manager: 'District Manager',
    maintenance: 'Maintenance',
    plant_manager: 'Plant Manager',
    unassigned: 'Unassigned'
}

export const ROLE_OPTIONS = ['Maintenance', 'Plant Manager', 'District Manager', 'Unassigned']

/** Available grouping modes for the task list with icons for the toggle bar. */
export const VIEW_MODES = [
    { icon: 'fa-flag', id: 'priority', label: 'Priority' },
    { icon: 'fa-layer-group', id: 'status', label: 'Status' },
    { icon: 'fa-calendar-alt', id: 'date', label: 'Date' },
    { icon: 'fa-user', id: 'role', label: 'Role' },
    { icon: 'fa-history', id: 'activity', label: 'Activity' }
]

export const STATUS_COLORS = {
    completed: { bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.3)', text: '#16a34a' },
    in_progress: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
    ordered_materials: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
    overdue: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    pending: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
    waiting: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' }
}

export const BULK_ACTION_COLORS = {
    cancel: { bg: 'var(--bg-secondary)', hover: 'var(--border-light)', text: 'var(--text-secondary)' },
    complete: { bg: 'rgba(22,163,74,0.1)', hover: 'rgba(22,163,74,0.2)', text: '#16a34a' },
    delete: { bg: 'rgba(239,68,68,0.1)', hover: 'rgba(239,68,68,0.2)', text: '#ef4444' },
    neutral: { bg: 'rgba(59,130,246,0.1)', hover: 'rgba(59,130,246,0.2)', text: '#3b82f6' }
}

export const BULK_STATUS_OPTIONS = [
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Ordered Materials', value: 'ordered_materials' },
    { label: 'Waiting', value: 'waiting' }
]

export const mapStatusValue = (value) => {
    const lower = value?.toLowerCase()
    return Object.entries(STATUS_MAP).find(([_k, v]) => v.toLowerCase() === lower)?.[0] || ''
}

export const mapRoleValue = (value) => Object.entries(ROLE_MAP).find(([_k, v]) => v === value)?.[0] || ''

export const normalizeToUpperCase = (str) =>
    String(str || '')
        .trim()
        .toUpperCase()

/** Returns the tint-only style for a status badge. The text colour is
 *  intentionally omitted — consumers render the badge label in the
 *  theme foreground (`text-text-primary`) so light / dark / grayed all
 *  read with the same contrast, while the tinted bg + border still
 *  carry the at-a-glance status colour. */
export const getItemStatusStyle = (statusType) => {
    const color = STATUS_COLORS[normalizeListStatus(statusType)] || STATUS_COLORS.pending
    return {
        background: color.bg,
        border: `1px solid ${color.border}`
    }
}

/** Icon-only colour for the status — used inside a badge whose label
 *  renders in theme text so the icon glyph still carries the colored
 *  status signal. */
export const getItemStatusIconColor = (statusType) =>
    (STATUS_COLORS[normalizeListStatus(statusType)] || STATUS_COLORS.pending).text

/** Bulk-action button style — same neutralization as status badges.
 *  The action colour reads through the tinted background; the button
 *  label uses theme text. */
export const getBulkButtonStyle = (type) => {
    const color = BULK_ACTION_COLORS[type] || BULK_ACTION_COLORS.cancel
    return {
        background: color.bg
    }
}
