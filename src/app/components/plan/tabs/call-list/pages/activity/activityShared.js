/** Shared constants + pure helpers powering the Activity Feed page. */

export const ICON_BY_OUTCOME = {
    booked: 'fa-circle-check',
    no_answer: 'fa-phone-slash',
    not_interested: 'fa-circle-xmark',
    note: 'fa-note-sticky',
    will_book_again: 'fa-rotate-right'
}

export const TIME_RANGE_OPTIONS = [
    { days: 1, key: 'today', label: 'Today' },
    { days: 7, key: 'week', label: 'This week' },
    { days: 30, key: 'month', label: '30 days' },
    { days: null, key: 'all', label: 'All' }
]

export const GROUP_LABELS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This week' },
    { key: 'earlier', label: 'Earlier' }
]

export const startOfDayMs = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

export const formatTimeOfDay = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export const formatRelativeShort = (iso) => {
    const ts = Date.parse(iso)
    if (!Number.isFinite(ts)) return ''
    const deltaSec = Math.round((Date.now() - ts) / 1000)
    if (deltaSec < 45) return 'just now'
    if (deltaSec < 60 * 60) return `${Math.round(deltaSec / 60)}m ago`
    if (deltaSec < 60 * 60 * 24) return `${Math.round(deltaSec / 3600)}h ago`
    return formatTimeOfDay(iso)
}

export const initialsOf = (name) => {
    if (!name) return '—'
    const parts = String(name).trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}

/** Bucket entries into Today / Yesterday / This week / Earlier based
 *  on local-time day boundaries. Order preserved within each bucket
 *  (the caller already sorts newest-first). */
export function groupEntriesByDay(entries) {
    const todayStart = startOfDayMs(new Date())
    const yesterdayStart = todayStart - 86400000
    const weekStart = todayStart - 6 * 86400000
    const groups = { earlier: [], today: [], week: [], yesterday: [] }
    entries.forEach((entry) => {
        const ts = Date.parse(entry.created_at)
        if (!Number.isFinite(ts)) {
            groups.earlier.push(entry)
            return
        }
        if (ts >= todayStart) groups.today.push(entry)
        else if (ts >= yesterdayStart) groups.yesterday.push(entry)
        else if (ts >= weekStart) groups.week.push(entry)
        else groups.earlier.push(entry)
    })
    return groups
}

/** Metric rollup for the KPI strip + outcome breakdown bar. Pure: no
 *  React state, no side effects. Run from a memo against the filtered
 *  entry list. */
export function computeActivityMetrics(entries) {
    const todayStart = startOfDayMs(new Date())
    const weekStart = todayStart - 6 * 86400000
    const outcomeCounts = {}
    const callerCounts = new Map()
    const uniqueCustomers = new Set()
    let callsToday = 0
    let callsWeek = 0
    entries.forEach((entry) => {
        const ts = Date.parse(entry.created_at)
        if (Number.isFinite(ts)) {
            if (ts >= todayStart) callsToday += 1
            if (ts >= weekStart) callsWeek += 1
        }
        const outcome = entry.outcome || 'note'
        outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1
        if (entry.customer_num) uniqueCustomers.add(String(entry.customer_num))
        const caller = entry.created_by_name?.trim()
        if (caller) callerCounts.set(caller, (callerCounts.get(caller) || 0) + 1)
    })
    const topCaller = [...callerCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null
    const bookedRate = entries.length > 0 ? (outcomeCounts.booked || 0) / entries.length : 0
    return {
        bookedRate,
        callsToday,
        callsWeek,
        outcomeCounts,
        topCaller: topCaller ? { count: topCaller[1], name: topCaller[0] } : null,
        total: entries.length,
        uniqueCustomers: uniqueCustomers.size
    }
}
