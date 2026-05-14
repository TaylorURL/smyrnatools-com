import { useMemo } from 'react'

/** Computes time-relative groups (Overdue / Today / Tomorrow / This Week / Later / Completed). */
function buildDateGroups(items) {
    const groups = {
        completed: { color: 'success', icon: 'fa-check-circle', items: [], label: 'Completed', priority: 6 },
        later: { color: 'secondary', icon: 'fa-calendar-alt', items: [], label: 'Later', priority: 5 },
        overdue: { color: 'danger', icon: 'fa-exclamation-circle', items: [], label: 'Overdue', priority: 3 },
        thisWeek: { color: 'accent', icon: 'fa-calendar-week', items: [], label: 'This Week', priority: 4 },
        today: { color: 'warning', icon: 'fa-calendar-day', items: [], label: 'Today', priority: 1 },
        tomorrow: { color: 'info', icon: 'fa-calendar-plus', items: [], label: 'Tomorrow', priority: 2 }
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()))
    items.forEach((item) => {
        if (item.completed || item.status === 'completed') {
            groups.completed.items.push(item)
            return
        }
        const deadline = new Date(item.deadline)
        deadline.setHours(0, 0, 0, 0)
        if (deadline < today || item.status === 'overdue') groups.overdue.items.push(item)
        else if (deadline.getTime() === today.getTime()) groups.today.items.push(item)
        else if (deadline.getTime() === tomorrow.getTime()) groups.tomorrow.items.push(item)
        else if (deadline <= endOfWeek) groups.thisWeek.items.push(item)
        else groups.later.items.push(item)
    })
    Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
    return groups
}

/** Items past deadline that are not actively being worked are promoted to Overdue. */
function buildStatusGroups(items) {
    const groups = {
        blocked: { color: 'danger', icon: 'fa-ban', items: [], label: 'Blocked', priority: 3 },
        completed: { color: 'success', icon: 'fa-check-circle', items: [], label: 'Completed', priority: 7 },
        in_progress: { color: 'accent', icon: 'fa-spinner', items: [], label: 'In Progress', priority: 2 },
        ordered_materials: {
            color: 'info',
            icon: 'fa-truck-loading',
            items: [],
            label: 'Ordered Materials',
            priority: 5
        },
        overdue: { color: 'danger', icon: 'fa-exclamation-circle', items: [], label: 'Overdue', priority: 1 },
        pending: { color: 'secondary', icon: 'fa-clock', items: [], label: 'Pending', priority: 6 },
        waiting: { color: 'warning', icon: 'fa-hourglass-half', items: [], label: 'Waiting', priority: 4 }
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const activeStatuses = ['in_progress', 'blocked', 'waiting', 'ordered_materials']
    items.forEach((item) => {
        if (item.completed || item.status === 'completed') {
            groups.completed.items.push(item)
            return
        }
        const deadline = new Date(item.deadline)
        deadline.setHours(0, 0, 0, 0)
        const isOverdue = deadline < today && !activeStatuses.includes(item.status)
        if (isOverdue) groups.overdue.items.push(item)
        else if (groups[item.status]) groups[item.status].items.push(item)
        else groups.pending.items.push(item)
    })
    Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
    return groups
}

function buildRoleGroups(items) {
    const groups = {
        district_manager: {
            color: 'accent',
            icon: 'fa-user-shield',
            items: [],
            label: 'District Manager',
            priority: 1
        },
        maintenance: { color: 'warning', icon: 'fa-wrench', items: [], label: 'Maintenance', priority: 3 },
        plant_manager: { color: 'info', icon: 'fa-user-tie', items: [], label: 'Plant Manager', priority: 2 },
        unassigned: { color: 'secondary', icon: 'fa-users', items: [], label: 'Unassigned', priority: 4 }
    }
    items
        .filter((item) => !item.completed && item.status !== 'completed')
        .forEach((item) => {
            const role = item.responsible_role || 'unassigned'
            ;(groups[role] ?? groups.unassigned).items.push(item)
        })
    Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
    return groups
}

function buildPriorityGroups(items) {
    const groups = {
        high: { color: 'warning', icon: 'fa-arrow-up', items: [], label: 'High', priority: 2 },
        low: { color: 'info', icon: 'fa-arrow-down', items: [], label: 'Low', priority: 4 },
        medium: { color: 'accent', icon: 'fa-minus', items: [], label: 'Medium', priority: 3 },
        none: { color: 'secondary', icon: 'fa-minus', items: [], label: 'No Priority', priority: 5 },
        urgent: { color: 'danger', icon: 'fa-fire', items: [], label: 'Urgent', priority: 1 }
    }
    items
        .filter((item) => !item.completed && item.status !== 'completed')
        .forEach((item) => {
            const p = item.priority || 'none'
            ;(groups[p] ?? groups.none).items.push(item)
        })
    Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
    return groups
}

/**
 * Produces all four grouping shapes (priority, status, date, role) from a
 * single filtered item list. Each grouping is memoized independently so
 * switching `viewMode` is free after the first computation.
 */
export function useListGroups(items) {
    const groupedByDate = useMemo(() => buildDateGroups(items), [items])
    const groupedByStatus = useMemo(() => buildStatusGroups(items), [items])
    const groupedByRole = useMemo(() => buildRoleGroups(items), [items])
    const groupedByPriority = useMemo(() => buildPriorityGroups(items), [items])
    return { groupedByDate, groupedByPriority, groupedByRole, groupedByStatus }
}
