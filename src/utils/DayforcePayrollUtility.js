import { canonicalNameKey } from './OperatorNameLookupUtility'

/** Overtime rules: any hours past 8 in a single day OR past 40 in a
 *  single week count as overtime, paid at the OT multiplier. Daily
 *  hours that have already been counted toward daily OT do NOT also
 *  count toward the weekly cap — only the first 8 (regular) hours of
 *  each day stack into the weekly total. Mirrors the standard "daily
 *  AND weekly" OT pattern used by states like California. */
export const OT_DAILY_THRESHOLD_HOURS = 8
export const OT_WEEKLY_THRESHOLD_HOURS = 40
export const OT_MULTIPLIER = 1.5

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normalizes a date-ish input to a `YYYY-MM-DD` string in local time.
 *
 * An already-ISO `YYYY-MM-DD` string is returned as-is. Without this
 * passthrough, `new Date("2026-05-25")` parses as UTC midnight and the
 * subsequent local-time extraction shifts the date back one day in
 * every west-of-UTC timezone (Chicago included) — which is what made
 * the Hours / Schedules / Efficiency tabs filter Sun–Fri when the
 * period selector said Mon–Sat.
 */
export const toDateString = (date) => {
    if (!date) return null
    if (typeof date === 'string' && ISO_DATE_PATTERN.test(date)) return date
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** ISO week key (YYYY-Www) for grouping shifts into pay weeks. Using a
 *  string key keeps the aggregation grouping trivially serializable and
 *  sortable. */
export const weekKey = (dateString) => {
    if (!dateString) return null
    const d = new Date(`${dateString}T00:00:00`)
    if (Number.isNaN(d.getTime())) return null
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = target.getUTCDay() || 7
    target.setUTCDate(target.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
    return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** Splits a week's hours into regular + overtime buckets using the
 *  daily-AND-weekly rule:
 *    1. For each day, any hours past 8 are daily OT.
 *    2. The first 8 hours of each day stack into the weekly base; any
 *       portion of that base past 40 is weekly OT.
 *    3. Hours already counted as daily OT do NOT also accrue toward the
 *       weekly cap (no double-dipping).
 *
 *  Takes the bucket's `totalHours` (week sum) plus `dailyHours` (Map of
 *  `dateString → hoursOnThatDay`). When `dailyHours` is missing or empty,
 *  falls back to weekly-only OT — keeps the function safe for callers
 *  that haven't been updated yet. */
export const computeWeeklyCost = (totalHours, hourlyRate, dailyHours) => {
    if (!hourlyRate || !totalHours) return { cost: 0, otCost: 0, otHours: 0, regCost: 0, regHours: 0 }

    let dailyOtHours = 0
    let weeklyBase = 0
    if (dailyHours && dailyHours.size > 0) {
        for (const hours of dailyHours.values()) {
            if (!Number.isFinite(hours) || hours <= 0) continue
            const dayOt = Math.max(0, hours - OT_DAILY_THRESHOLD_HOURS)
            dailyOtHours += dayOt
            weeklyBase += hours - dayOt
        }
    } else {
        weeklyBase = totalHours
    }
    const weeklyOtHours = Math.max(0, weeklyBase - OT_WEEKLY_THRESHOLD_HOURS)
    const otHours = dailyOtHours + weeklyOtHours
    const regHours = Math.max(0, totalHours - otHours)
    const regCost = regHours * hourlyRate
    const otCost = otHours * hourlyRate * OT_MULTIPLIER
    return { cost: regCost + otCost, otCost, otHours, regCost, regHours }
}

/** Builds a name → operator lookup. Skips operators without a usable name
 *  so that "Unknown" or empty rows don't collide with real matches. */
export const buildOperatorIndex = (operators) => {
    const byName = new Map()
    const byBadge = new Map()
    for (const op of operators) {
        if (!op) continue
        const key = canonicalNameKey(op.name)
        if (key && !byName.has(key)) byName.set(key, op)
        const badge = String(op.smyrnaId ?? '').trim()
        if (badge && !byBadge.has(badge)) byBadge.set(badge, op)
    }
    return { byBadge, byName }
}

/** Matches a Dayforce employee to a smyrnatools operator. Name first,
 *  badge as fallback. Returns null when neither path resolves so the
 *  caller can decide whether to show or hide the row. */
export const matchOperator = (employee, operatorIndex) => {
    if (!employee) return null
    const nameKey =
        canonicalNameKey(employee.display_name) ||
        canonicalNameKey([employee.first_name, employee.last_name].filter(Boolean).join(' '))
    if (nameKey) {
        const hit = operatorIndex.byName.get(nameKey)
        if (hit) return hit
    }
    const badge = String(employee.employee_badge ?? '').trim()
    if (badge && operatorIndex.byBadge.has(badge)) return operatorIndex.byBadge.get(badge)
    return null
}
