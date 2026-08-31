import { parseIsoLocal } from './PlanStatisticsFormatUtility'

import { ONE_DAY_MS } from './PlanStatisticsConstants'

export const isoDate = (date: Date | string | number) => {
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export const offsetIso = (iso: string, days: number) => {
    const base = parseIsoLocal(iso)
    if (!base) return iso
    base.setDate(base.getDate() + days)
    return isoDate(base)
}

/** Inclusive day count — both endpoints count, so Monday through Saturday
 *  of one week is 6. Returns 0 when either date fails to parse. */
export const daysBetween = (startIso: string | null | undefined, endIso: string | null | undefined) => {
    const a = parseIsoLocal(startIso)
    const b = parseIsoLocal(endIso)
    if (!a || !b) return 0
    return Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS) + 1
}

/** Returns the Monday of the calendar week containing `date`. Sunday rolls
 *  back to the prior Monday so the work-week is always Mon–Sat. */
export const mondayOf = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay() // 0 Sun … 6 Sat
    const offset = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + offset)
    d.setHours(0, 0, 0, 0)
    return d
}

export const startOfMonth = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1)
    d.setHours(0, 0, 0, 0)
    return d
}

export const endOfMonth = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    d.setHours(0, 0, 0, 0)
    return d
}

export const startOfQuarter = (date: Date) => {
    const q = Math.floor(date.getMonth() / 3)
    const d = new Date(date.getFullYear(), q * 3, 1)
    d.setHours(0, 0, 0, 0)
    return d
}

export const endOfQuarter = (date: Date) => {
    const q = Math.floor(date.getMonth() / 3)
    const d = new Date(date.getFullYear(), q * 3 + 3, 0)
    d.setHours(0, 0, 0, 0)
    return d
}

export const startOfYear = (date: Date) => {
    const d = new Date(date.getFullYear(), 0, 1)
    d.setHours(0, 0, 0, 0)
    return d
}

export const endOfYear = (date: Date) => {
    const d = new Date(date.getFullYear(), 11, 31)
    d.setHours(0, 0, 0, 0)
    return d
}
