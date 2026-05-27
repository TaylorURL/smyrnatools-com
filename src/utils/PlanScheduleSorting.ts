// Plan Schedule — list sorting, row stagger timing, and shared row styling tokens.

import { timeToMinutes } from './PlanUtility'

/* Row stagger — mirrors `ListViewModeSection.getRowDelay`. Early rows
 * cascade slowly; later rows arrive almost simultaneously so the table
 * feels lively without dragging on long lists. */
export const ROW_BASE_DELAY_MS = 80
export const ROW_MIN_DELAY_MS = 6
export const ROW_DECAY_FACTOR = 0.88
export const getScheduleRowDelay = (index) => {
    let total = 0
    for (let i = 0; i < index; i++) {
        total += Math.max(ROW_MIN_DELAY_MS, ROW_BASE_DELAY_MS * Math.pow(ROW_DECAY_FACTOR, i))
    }
    return Math.round(total)
}

/* Sort options surfaced in the Schedule's "Sort by" dropdown and the
 * comparator that maps a chosen key to an ordering function. */
export const SORT_OPTIONS = [
    { key: 'plantThenTime', label: 'Plant, then start time' },
    { key: 'startTime', label: 'Start time' },
    { key: 'plantCode', label: 'Plant' },
    { desc: true, key: 'yardage', label: 'Yardage', numeric: true },
    { desc: true, key: 'truckCount', label: 'Trucks', numeric: true },
    { key: 'customer', label: 'Customer' }
]

export const compareByStartTime = (a, b) => {
    const am = timeToMinutes(a.startTime)
    const bm = timeToMinutes(b.startTime)
    if (am == null && bm == null) return 0
    if (am == null) return 1
    if (bm == null) return -1
    return am - bm
}

export const compareByPlant = (a, b) => String(a.plantCode || '').localeCompare(String(b.plantCode || ''))

export const compareOrders = (a, b, sortKey) => {
    const opt = SORT_OPTIONS.find((o) => o.key === sortKey) || SORT_OPTIONS[0]
    if (opt.key === 'plantThenTime') {
        return compareByPlant(a, b) || compareByStartTime(a, b)
    }
    if (opt.numeric) {
        const av = parseFloat(a[sortKey]) || 0
        const bv = parseFloat(b[sortKey]) || 0
        return (opt.desc ? bv - av : av - bv) || compareByPlant(a, b) || compareByStartTime(a, b)
    }
    if (opt.key === 'startTime') {
        return compareByStartTime(a, b) || compareByPlant(a, b)
    }
    if (opt.key === 'plantCode') {
        return compareByPlant(a, b) || compareByStartTime(a, b)
    }
    const cmp = String(a[opt.key] || '').localeCompare(String(b[opt.key] || ''))
    return cmp || compareByPlant(a, b) || compareByStartTime(a, b)
}

/** Available view modes for the Schedule's table-vs-cards toggle. */
export const VIEW_MODES = ['table', 'cards']

/* Single neutral identity for "open window" slot rows. The pour-size
 * differentiation lives entirely inside the inline `PourSizeBadge` so the
 * row stays calm and consistent with the other synthetic rows. */
export const SLOT_ROW_ACCENT = '#0ea5e9'
export const SLOT_ROW_TINT = 'rgba(14, 165, 233, 0.04)'
