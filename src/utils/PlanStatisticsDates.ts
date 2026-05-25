/**
 * PlanStatisticsDates — pure date helpers for the Plan Statistics
 * analytics graph. ISO parsing, calendar-boundary calculations (week /
 * month / quarter / year), and working-day enumeration. No fetching, no
 * React, no business logic — just calendar math.
 */
import { parseIsoLocal } from './PlanStatisticsFormatUtility'

import { ONE_DAY_MS } from './PlanStatisticsConstants'

export const isoDate = (date) => {
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export const offsetIso = (iso, days) => {
    const base = parseIsoLocal(iso)
    if (!base) return iso
    base.setDate(base.getDate() + days)
    return isoDate(base)
}

export const daysBetween = (startIso, endIso) => {
    const a = parseIsoLocal(startIso)
    const b = parseIsoLocal(endIso)
    if (!a || !b) return 0
    return Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS) + 1
}

/** Sundays are non-operating days for the plant — exclude them from every
 *  metric, chart, and totals row so a 7-day "Week" reads as 6 working days. */
export const isSundayIso = (iso) => {
    const d = parseIsoLocal(iso)
    return d ? d.getDay() === 0 : false
}

/** Returns the Monday of the calendar week containing `date`. Sunday rolls
 *  back to the prior Monday so the work-week is always Mon–Sat. */
export const mondayOf = (date) => {
    const d = new Date(date)
    const day = d.getDay() // 0 Sun … 6 Sat
    const offset = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + offset)
    d.setHours(0, 0, 0, 0)
    return d
}

export const startOfMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1)
    d.setHours(0, 0, 0, 0)
    return d
}

export const endOfMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    d.setHours(0, 0, 0, 0)
    return d
}

export const startOfQuarter = (date) => {
    const q = Math.floor(date.getMonth() / 3)
    const d = new Date(date.getFullYear(), q * 3, 1)
    d.setHours(0, 0, 0, 0)
    return d
}

export const endOfQuarter = (date) => {
    const q = Math.floor(date.getMonth() / 3)
    const d = new Date(date.getFullYear(), q * 3 + 3, 0)
    d.setHours(0, 0, 0, 0)
    return d
}

export const startOfYear = (date) => {
    const d = new Date(date.getFullYear(), 0, 1)
    d.setHours(0, 0, 0, 0)
    return d
}

export const endOfYear = (date) => {
    const d = new Date(date.getFullYear(), 11, 31)
    d.setHours(0, 0, 0, 0)
    return d
}

/** Working-day count (Sundays excluded) inside the inclusive range. Used as
 *  the denominator for "X of Y days" KPI hints on the Statistics page. */
export const countWorkingDays = (startIso, endIso) => {
    const start = parseIsoLocal(startIso)
    const end = parseIsoLocal(endIso)
    if (!start || !end) return 0
    let count = 0
    const cursor = new Date(start)
    while (cursor <= end) {
        if (cursor.getDay() !== 0) count += 1
        cursor.setDate(cursor.getDate() + 1)
    }
    return count
}

/** Enumerate every working-day ISO date (Sundays skipped) inside the
 *  inclusive range. Used by the Statistics hook to figure out which dates
 *  need to be backfilled from `dispatch_data` because no `plans` row was
 *  ever saved for them. */
export const listWorkingDaysInRange = (startIso, endIso) => {
    const start = parseIsoLocal(startIso)
    const end = parseIsoLocal(endIso)
    if (!start || !end) return []
    const out = []
    const cursor = new Date(start)
    while (cursor <= end) {
        if (cursor.getDay() !== 0) {
            const y = cursor.getFullYear()
            const m = String(cursor.getMonth() + 1).padStart(2, '0')
            const d = String(cursor.getDate()).padStart(2, '0')
            out.push(`${y}-${m}-${d}`)
        }
        cursor.setDate(cursor.getDate() + 1)
    }
    return out
}
