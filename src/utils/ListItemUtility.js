import { normalizeListStatus } from '../app/constants/listViewConstants'
import DateUtility from './DateUtility'
import FormatUtility from './FormatUtility'

/** Priority/urgency display metadata. Colors are CSS values (not Tailwind
 *  classes) so the badges read correctly in both light and dark mode — the
 *  rgba bg/border layer over the active theme background instead of relying
 *  on a hard-coded pale tint that disappears on dark surfaces. */
const PRIORITY_CONFIG = {
    high: {
        bg: 'rgba(234,88,12,0.12)',
        border: 'rgba(234,88,12,0.35)',
        color: '#f97316',
        icon: 'fa-arrow-up',
        label: 'High'
    },
    low: {
        bg: 'rgba(59,130,246,0.12)',
        border: 'rgba(59,130,246,0.35)',
        color: '#60a5fa',
        icon: 'fa-arrow-down',
        label: 'Low'
    },
    medium: {
        bg: 'rgba(202,138,4,0.12)',
        border: 'rgba(202,138,4,0.35)',
        color: '#eab308',
        icon: 'fa-minus',
        label: 'Medium'
    },
    none: {
        bg: 'rgba(148,163,184,0.12)',
        border: 'rgba(148,163,184,0.30)',
        color: '#94a3b8',
        icon: 'fa-minus',
        label: 'No Priority'
    },
    urgent: {
        bg: 'rgba(220,38,38,0.12)',
        border: 'rgba(220,38,38,0.35)',
        color: '#ef4444',
        icon: 'fa-fire',
        label: 'Urgent'
    }
}
const PRIORITY_OPTIONS = [
    { label: 'No Priority', value: 'none' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' }
]
const DEFAULT_PRIORITY = PRIORITY_CONFIG.none

/** Consolidated status configuration — single source of truth for label, icon, and Tailwind color per status. */
const STATUS_CONFIG = {
    completed: { color: 'text-green-500', cssClass: 'completed', icon: 'fa-check-circle', label: 'Completed' },
    in_progress: { color: 'text-blue-400', cssClass: 'in-progress', icon: 'fa-spinner', label: 'In Progress' },
    ordered_materials: {
        color: 'text-sky-400',
        cssClass: 'ordered',
        icon: 'fa-truck-loading',
        label: 'Ordered Materials'
    },
    overdue: { color: 'text-red-500', cssClass: 'overdue', icon: 'fa-exclamation-circle', label: 'Overdue' },
    pending: { color: 'text-blue-500', cssClass: 'pending', icon: 'fa-clock', label: 'Pending' },
    waiting: { color: 'text-yellow-500', cssClass: 'waiting', icon: 'fa-hourglass-half', label: 'Waiting' }
}
const DEFAULT_STATUS = STATUS_CONFIG.pending

const RESPONSIBLE_ROLE_LABELS = {
    district_manager: 'District Manager',
    maintenance: 'Maintenance',
    plant_manager: 'Plant Manager'
}

const RESPONSIBLE_ROLE_ICONS = {
    district_manager: 'fa-user-shield',
    maintenance: 'fa-wrench',
    plant_manager: 'fa-user-tie'
}

const ACTIVITY_FIELD_LABELS = {
    comments: 'comments',
    deadline: 'deadline',
    description: 'description',
    plant_code: 'plant',
    priority: 'priority',
    responsible_role: 'assigned role',
    status: 'status'
}

/** Formats a date string for display (e.g., "Jan 5, 2026, 02:30 PM"). Delegates to DateUtility. */
export function formatDate(dateString) {
    if (!dateString) return 'N/A'
    const result = DateUtility.formatDateTime(dateString)
    return result || 'Invalid Date'
}

/** Formats a date string into an HTML datetime-local input value. Delegates to DateUtility. */
export function formatDateForInput(dateString) {
    return DateUtility.formatDateTimeLocal(dateString)
}

/** Returns true if the item has a deadline that has passed and is not completed. */
export function isOverdue(item) {
    return item.deadline && !item.completed && new Date(item.deadline) < new Date()
}

/** Returns status display metadata (Tailwind color class, icon, label) based on item state and deadline. */
export function calculateStatusInfo(item) {
    if (!item) return { color: 'text-gray-500', icon: 'question-circle', label: 'Unknown' }
    if (item.completed || item.status === 'completed')
        return { color: 'text-green-500', icon: 'check-circle', label: 'Completed' }
    const status = normalizeListStatus(item.status)
    if (status === 'in_progress') return { color: 'text-blue-400', icon: 'spinner', label: 'In Progress' }
    if (status === 'ordered_materials')
        return { color: 'text-sky-400', icon: 'truck-loading', label: 'Ordered Materials' }
    if (status === 'waiting') return { color: 'text-yellow-500', icon: 'hourglass-half', label: 'Waiting' }
    const deadline = new Date(item.deadline)
    const now = new Date()
    if (isNaN(deadline.getTime())) return { color: 'text-gray-500', icon: 'calendar-times', label: 'No Deadline' }
    if (deadline < now || item.status === 'overdue')
        return { color: 'text-red-500', icon: 'exclamation-circle', label: 'Overdue' }
    const hours = (deadline - now) / (1000 * 60 * 60)
    if (hours < 24) return { color: 'text-yellow-500', icon: 'clock', label: 'Due Soon' }
    return { color: 'text-blue-500', icon: 'calendar-check', label: 'Pending' }
}

/** Maps a status key to its human-readable label via STATUS_CONFIG. */
export function getStatusLabel(status) {
    return (STATUS_CONFIG[normalizeListStatus(status)] ?? DEFAULT_STATUS).label
}

/** Maps a status key to its FontAwesome icon class via STATUS_CONFIG. */
export function getStatusIcon(status) {
    return (STATUS_CONFIG[normalizeListStatus(status)] ?? DEFAULT_STATUS).icon
}

/** Maps a status key to its CSS color class name via STATUS_CONFIG. */
export function getStatusColor(status) {
    return (STATUS_CONFIG[normalizeListStatus(status)] ?? DEFAULT_STATUS).cssClass
}

/** Maps a responsible role key to its display label. */
export function getResponsibleRoleLabel(role) {
    return RESPONSIBLE_ROLE_LABELS[role] || 'Unassigned'
}

/** Returns priority display metadata (label, icon, Tailwind classes) for a given priority value. */
export function getPriorityConfig(priority) {
    return PRIORITY_CONFIG[priority] ?? DEFAULT_PRIORITY
}

/** Returns the ordered list of priority options for dropdowns. */
export function getPriorityOptions() {
    return PRIORITY_OPTIONS
}

/** Maps a responsible role key to its FontAwesome icon class. */
export function getResponsibleRoleIcon(role) {
    return RESPONSIBLE_ROLE_ICONS[role] || 'fa-users'
}

/** Resolves a plant code to its display name from a provided plants list. */
export function getPlantName(plantCode, plants = []) {
    const plant = plants.find((p) => p.plant_code === plantCode)
    return plant ? plant.plant_name : plantCode || 'No Plant'
}

/** Truncates text by character count or word count with ellipsis. Delegates to FormatUtility. */
export function truncateText(text, maxLength, byWords = false) {
    return FormatUtility.truncateText(text, maxLength, byWords)
}

/**
 * Filters and sorts list items by plant, search term, completion status, and status type.
 * Supported `statusFilter` values: `completed`, `overdue` (derived from deadline), `pending`
 * (no explicit status or explicit `pending`, not overdue), or any explicit `item.status` value
 * (`in_progress`, `blocked`, `waiting`, `ordered_materials`). Overdue items are prioritized in
 * non-completed views.
 */
export function getFilteredItems(listItems, { plantCode, searchTerm, showCompleted, statusFilter }) {
    let items = [...listItems]
    if (plantCode && plantCode !== 'All') items = items.filter((item) => item.plant_code === plantCode)
    if (searchTerm?.trim()) {
        const term = searchTerm.toLowerCase().trim()
        items = items.filter(
            (item) =>
                (item.description || '').toLowerCase().includes(term) ||
                (item.comments || '').toLowerCase().includes(term)
        )
    }
    if (!showCompleted) items = items.filter((item) => !item.completed)
    if (statusFilter === 'completed') {
        items = items.filter((item) => item.completed)
    } else if (statusFilter === 'overdue') {
        items = items.filter((item) => isOverdue(item) && !item.completed)
    } else if (statusFilter === 'pending') {
        items = items.filter(
            (item) => (!item.status || item.status === 'pending') && !isOverdue(item) && !item.completed
        )
    } else if (statusFilter) {
        items = items.filter((item) => normalizeListStatus(item.status) === statusFilter && !item.completed)
    }
    if (showCompleted) {
        items.sort((a, b) => {
            const aCompletedAt = new Date(a.completed_at).getTime() || 0
            const bCompletedAt = new Date(b.completed_at).getTime() || 0
            return bCompletedAt - aCompletedAt
        })
    } else {
        items.sort((a, b) => {
            const aOverdue = isOverdue(a) && !a.completed
            const bOverdue = isOverdue(b) && !b.completed
            if (aOverdue && !bOverdue) return -1
            if (!aOverdue && bOverdue) return 1
            const aDeadline = new Date(a.deadline).getTime() || 0
            const bDeadline = new Date(b.deadline).getTime() || 0
            return aDeadline - bDeadline
        })
    }
    return items
}

/** Resolves a user ID to a display name from a profiles map (creator profiles or a custom map). */
export function getProfileName(userId, profilesMap) {
    if (!userId) return 'Unknown'
    const profile = profilesMap?.[userId]
    if (profile) {
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        return name || userId.slice(0, 8)
    }
    return userId.slice(0, 8)
}

/**
 * Maps an activity action + field to a human-readable verb and icon.
 * @param {string} action - The action type (created, updated, completed, uncompleted, deleted).
 * @param {string} [fieldName] - The field that changed (for "updated" actions).
 * @returns {{ verb: string, icon: string, color: string }}
 */
export function getActivityDisplay(action, fieldName) {
    switch (action) {
        case 'created':
            return { color: 'accentColor', icon: 'fa-plus', verb: 'created' }
        case 'completed':
            return { color: '#16a34a', icon: 'fa-check', verb: 'completed' }
        case 'uncompleted':
            return { color: '#f59e0b', icon: 'fa-undo', verb: 'reopened' }
        case 'deleted':
            return { color: '#ef4444', icon: 'fa-trash', verb: 'deleted' }
        case 'updated':
            return {
                color: '#3b82f6',
                icon: 'fa-pen',
                verb: `changed ${ACTIVITY_FIELD_LABELS[fieldName] || fieldName || 'a field'} on`
            }
        default:
            return { color: '#94a3b8', icon: 'fa-circle', verb: action }
    }
}

/**
 * Formats an activity-feed `old_value` / `new_value` for display. Most
 * tracked fields are plain strings, but `deadline` is stored as an ISO
 * timestamp and rendered raw without this formatter.
 */
export function formatActivityValue(fieldName, value) {
    if (value == null || value === '') return 'none'
    if (fieldName === 'deadline') {
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return String(value)
        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
        return d.toLocaleDateString('en-US', {
            day: 'numeric',
            hour: hasTime ? 'numeric' : undefined,
            minute: hasTime ? '2-digit' : undefined,
            month: 'short',
            year: 'numeric'
        })
    }
    return String(value)
}

/**
 * Formats a timestamp into a human-readable relative string (e.g. "2 hours ago", "Yesterday").
 * Falls back to absolute date for anything older than 7 days.
 */
export function formatRelativeTime(timestamp) {
    if (!timestamp) return ''
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now - then
    const diffMinutes = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffDays = Math.floor(diffMs / 86_400_000)
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return then.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

/** Builds a `{id: object}` lookup from an array of objects that may have an `id` field. */
export function indexById(items) {
    const out = {}
    for (const item of items || []) {
        if (item?.id) out[item.id] = item
    }
    return out
}

/**
 * Distributes ranked items across the week's days, respecting deadlines and per-day caps.
 * Deadline items are placed on or before their deadline day; remaining items round-robin.
 */
export function distributeItemsAcrossWeek(rankedItems, weekDates, existingPlannedItems, maxPerDay) {
    const today = new Date().toISOString().split('T')[0]
    const oneWeekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0]
    const futureDays = weekDates.filter((d) => d.dateStr >= today && d.dateStr <= oneWeekAhead)
    if (futureDays.length === 0) return []
    const daySlots = new Map()
    for (const day of futureDays) {
        const existingCount = existingPlannedItems.filter((pi) => pi.planned_date === day.dateStr).length
        daySlots.set(day.dateStr, maxPerDay - existingCount)
    }
    const totalAvailableSlots = [...daySlots.values()].reduce((sum, slots) => sum + Math.max(0, slots), 0)
    const itemsToPlace = rankedItems.slice(0, totalAvailableSlots)
    const assignments = []
    const dateStrings = futureDays.map((d) => d.dateStr)
    const weekStart = dateStrings[0]
    const weekEnd = dateStrings[dateStrings.length - 1]
    const deadlineItems = []
    const flexibleItems = []
    for (const entry of itemsToPlace) {
        const deadlineDate = entry.item.deadline ? entry.item.deadline.split('T')[0] : null
        if (deadlineDate && deadlineDate >= weekStart && deadlineDate <= weekEnd) {
            deadlineItems.push({ ...entry, deadlineDate })
        } else {
            flexibleItems.push(entry)
        }
    }
    const claimSlot = (dateStr, itemId) => {
        assignments.push({ itemId, plannedDate: dateStr })
        daySlots.set(dateStr, daySlots.get(dateStr) - 1)
    }
    for (const entry of deadlineItems) {
        const targetIndex = dateStrings.findIndex((d) => d >= entry.deadlineDate)
        const targetDate = targetIndex >= 0 ? dateStrings[targetIndex] : null
        if (targetDate && daySlots.get(targetDate) > 0) {
            claimSlot(targetDate, entry.item.id)
            continue
        }
        const fallbackStart = (targetIndex >= 0 ? targetIndex : dateStrings.length) - 1
        let placed = false
        for (let i = fallbackStart; i >= 0; i--) {
            if (daySlots.get(dateStrings[i]) > 0) {
                claimSlot(dateStrings[i], entry.item.id)
                placed = true
                break
            }
        }
        if (placed) continue
        for (const dateStr of dateStrings) {
            if (daySlots.get(dateStr) > 0) {
                claimSlot(dateStr, entry.item.id)
                break
            }
        }
    }
    let dayIndex = 0
    for (const entry of flexibleItems) {
        let placed = false
        for (let attempt = 0; attempt < dateStrings.length; attempt++) {
            const dateStr = dateStrings[(dayIndex + attempt) % dateStrings.length]
            if (daySlots.get(dateStr) > 0) {
                claimSlot(dateStr, entry.item.id)
                dayIndex = (dayIndex + attempt + 1) % dateStrings.length
                placed = true
                break
            }
        }
        if (!placed) break
    }
    return assignments
}

/**
 * Diffs AI suggestions against an item, returning the subset of updates worth applying.
 * Returns `null` when nothing needs updating.
 */
export function computeAIUpdateDiff(item, aiData) {
    if (!aiData) return null
    const updates = {}
    if (aiData.status && aiData.status !== item.status && !item.completed) {
        updates.status = aiData.status
    }
    if (aiData.deadline) {
        const aiDeadline = new Date(`${aiData.deadline}T17:00:00.000Z`)
        const currentDeadline = item.deadline ? new Date(item.deadline) : null
        if (!currentDeadline || aiDeadline < currentDeadline) {
            updates.deadline = aiDeadline.toISOString()
        }
    }
    return Object.keys(updates).length > 0 ? updates : null
}

/** Computes per-plant distribution of total, completed, pending, and overdue items. */
export function getPlantDistribution(listItems) {
    const distribution = {}
    const uniquePlants = [...new Set(listItems.map((item) => item.plant_code || 'Unassigned'))]
    uniquePlants.forEach((plant) => {
        distribution[plant] = { Completed: 0, Overdue: 0, Pending: 0, Total: 0 }
    })
    listItems.forEach((item) => {
        const plant = item.plant_code || 'Unassigned'
        distribution[plant].Total++
        if (item.completed) {
            distribution[plant].Completed++
        } else {
            distribution[plant].Pending++
            if (isOverdue(item)) distribution[plant].Overdue++
        }
    })
    return distribution
}

/**
 * Computes a deterministic priority score (1-10) from an item's structured fields.
 * Used as the immediate/fallback scoring — no API call needed.
 */
export function computeDeterministicScore(item) {
    let score = 5
    const status = normalizeListStatus(item.status)
    if (status === 'overdue' || isOverdue(item)) score = 9
    else if (status === 'in_progress') score = 7
    else if (status === 'ordered_materials') score = 6
    else if (status === 'waiting') score = 4
    else if (status === 'pending') score = 5
    if (item.deadline) {
        const daysUntilDeadline = (new Date(item.deadline) - new Date()) / (1000 * 60 * 60 * 24)
        if (daysUntilDeadline < 0) score = Math.max(score, 9)
        else if (daysUntilDeadline <= 2) score = Math.min(10, score + 2)
        else if (daysUntilDeadline <= 5) score = Math.min(10, score + 1)
    }
    if (item.responsible_role === 'maintenance') score = Math.min(10, score + 1)
    return score
}
