/** Shared constants + tiny helpers for the Plan -> Call List tab. Lives in
 *  utils so the row, detail panel, and view file can all import from one
 *  source without circular references. */

export const CALL_OUTCOME_BUTTONS = [
    { color: '#64748b', icon: 'fa-phone-slash', key: 'no_answer', label: 'No Answer' },
    { color: '#2563eb', icon: 'fa-rotate-right', key: 'will_book_again', label: 'Will Book Again' },
    { color: '#16a34a', icon: 'fa-circle-check', key: 'booked', label: 'Booked' },
    { color: '#dc2626', icon: 'fa-circle-xmark', key: 'not_interested', label: 'Not Interested' }
]

export const CALL_OUTCOME_LABELS = {
    booked: 'Booked',
    no_answer: 'No Answer',
    not_interested: 'Not Interested',
    note: 'Note',
    will_book_again: 'Will Book Again'
}

export const CALL_OUTCOME_COLORS = {
    booked: '#16a34a',
    no_answer: '#64748b',
    not_interested: '#dc2626',
    note: '#7c3aed',
    will_book_again: '#2563eb'
}

export const CALL_LIST_SORT_OPTIONS = [
    { key: 'oldest', label: 'Longest dormant' },
    { key: 'newest', label: 'Most recent pour' },
    { key: 'volume', label: 'Most pours / yr' },
    { key: 'name', label: 'Customer name' }
]

/** Pretty-print a phone number. Accepts US 10- or 11-digit strings; falls
 *  back to the original input for anything else (intl, vanity, etc.). */
export const formatCallListPhone = (phone) => {
    if (!phone) return ''
    const digits = String(phone).replace(/\D/g, '')
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    }
    return phone
}

/** Color tone for the days-dormant badge — same red/amber/green tiers used
 *  by the schedule tab's other health indicators. */
export const dormancyTone = (days) => {
    if (days >= 180) return '#dc2626'
    if (days >= 90) return '#d97706'
    return '#16a34a'
}

/** Cooldown after a logged call. Customers contacted within this window are
 *  pushed to the bottom of the list regardless of dormancy — once a month
 *  has passed since the last contact they re-enter the main tier and rise
 *  back to the top by their longest-dormant ranking. */
export const RECENT_CALL_COOLDOWN_DAYS = 30

/** Whole days between `from` (ISO timestamp/string) and now. Returns null
 *  for missing/unparseable input. Used to label rows like "called 3d ago". */
export const daysSinceTimestamp = (from) => {
    if (!from) return null
    const ms = Date.parse(from)
    if (Number.isNaN(ms)) return null
    const diff = Math.max(0, Date.now() - ms)
    return Math.floor(diff / 86_400_000)
}

/** Short relative-day label for the row's "called X" badge. */
export const formatRelativeDays = (from) => {
    const days = daysSinceTimestamp(from)
    if (days == null) return ''
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.round(days / 7)}w ago`
    return `${Math.round(days / 30)}mo ago`
}

/** True when the customer has been logged inside the cooldown window. */
export const wasRecentlyCalled = (lastCallAt) => {
    const days = daysSinceTimestamp(lastCallAt)
    return days != null && days < RECENT_CALL_COOLDOWN_DAYS
}

/** Case-insensitive substring search across the row's display fields. */
export const matchesCallListQuery = (row, query) => {
    if (!query) return true
    const haystack = [row.customer_name, row.customer_num, row.contact_name, row.phone]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(' | ')
    return haystack.includes(query)
}

const compareWithinTier = (a, b, sortKey) => {
    if (sortKey === 'newest') return String(b.last_pour_date || '').localeCompare(String(a.last_pour_date || ''))
    if (sortKey === 'volume') return (b.pour_days_last_year || 0) - (a.pour_days_last_year || 0)
    if (sortKey === 'name') return String(a.customer_name || '').localeCompare(String(b.customer_name || ''))
    return String(a.last_pour_date || '').localeCompare(String(b.last_pour_date || ''))
}

/** Two-tier sort: customers contacted inside the cooldown window drop to a
 *  bottom tier (most recently called LAST so the dispatcher sees the next
 *  callable customer at the top). Within each tier the chosen sortKey
 *  applies — default 'oldest' surfaces the longest-dormant first. */
export const sortCallListRoster = (rows, sortKey) => {
    const fresh = []
    const recent = []
    for (const row of rows) {
        if (wasRecentlyCalled(row.last_call_at)) recent.push(row)
        else fresh.push(row)
    }
    fresh.sort((a, b) => compareWithinTier(a, b, sortKey))
    recent.sort((a, b) => {
        const aMs = Date.parse(a.last_call_at) || 0
        const bMs = Date.parse(b.last_call_at) || 0
        return aMs - bMs
    })
    return [...fresh, ...recent]
}
