/**
 * Pure date/frequency math helpers for maintenance form scheduling.
 * Used by MaintenanceService to compute due dates for recurring forms
 * without any database or I/O dependencies.
 */

export const FREQUENCY_PERIOD_DAYS = {
    biweekly: () => 14,
    daily: (v) => v,
    monthly: (v) => 31 * v,
    quarterly: () => 92,
    weekly: (v) => 7 * v,
    yearly: (v) => 365 * v
}
export const DEFAULT_PERIOD_DAYS = 7
export const MS_PER_DAY = 86400000

/** Formats a Date as YYYY-MM-DD string. */
export function toDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Zeroes out the time portion of a Date for day-level comparisons. */
export function startOfDay(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

/** Parses a form's start date from its start_date or created_at fields. */
export function parseFormStartDate(form) {
    return startOfDay(
        form.start_date
            ? new Date(form.start_date + 'T00:00:00')
            : form.created_at
              ? new Date(form.created_at)
              : new Date()
    )
}

/** Returns the last day of a given month (year, zero-based month). */
export function endOfMonth(year, month) {
    const d = new Date(year, month + 1, 0)
    d.setHours(0, 0, 0, 0)
    return d
}

/** Converts a frequency to the number of months per period. */
export function frequencyToMonths(frequency, frequencyValue) {
    if (frequency === 'quarterly') return 3
    if (frequency === 'yearly') return 12 * frequencyValue
    return frequencyValue // monthly
}

/** Determines which calendar period index the reference date falls in. */
export function calendarPeriodIndex(frequency, frequencyValue, formStartDate, today) {
    const months = frequencyToMonths(frequency, frequencyValue)
    const startYear = formStartDate.getFullYear()
    const startMonth = formStartDate.getMonth()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth()
    const totalMonthsElapsed = (todayYear - startYear) * 12 + (todayMonth - startMonth)
    return Math.floor(totalMonthsElapsed / months)
}

/** Returns the due date (last day of the period's final month) for a given period index. */
export function calendarPeriodDueDate(frequency, frequencyValue, formStartDate, periodIndex) {
    const months = frequencyToMonths(frequency, frequencyValue)
    const startYear = formStartDate.getFullYear()
    const startMonth = formStartDate.getMonth()
    const targetMonth = startMonth + (periodIndex + 1) * months - 1
    const targetYear = startYear + Math.floor(targetMonth / 12)
    return endOfMonth(targetYear, targetMonth % 12)
}

/**
 * Extracts the storage path portion from a full image URL or path.
 * Throws if the resolved path contains directory traversal sequences.
 */
export function extractStoragePath(imagePath, storageBucket) {
    const raw = imagePath.includes(`${storageBucket}/`) ? imagePath.split(`${storageBucket}/`)[1] : imagePath
    if (!raw || raw.includes('..') || raw.startsWith('/')) throw new Error('Invalid storage path')
    return raw
}

/**
 * Calculates the relevant due dates for a form relative to a reference date.
 * Returns the previous, current, and next period due dates based on the form's
 * frequency configuration (daily, weekly, biweekly, monthly, quarterly, yearly).
 */
export function calculateDueDates(form, referenceDate) {
    const today = startOfDay(referenceDate)
    const formStartDate = parseFormStartDate(form)
    if (formStartDate > today) return [new Date(formStartDate)]
    const { frequency, frequency_value: frequencyValue = 1 } = form
    const useCalendarMonths = ['monthly', 'quarterly', 'yearly'].includes(frequency)
    if (useCalendarMonths) {
        const currentIndex = calendarPeriodIndex(frequency, frequencyValue, formStartDate, today)
        const results = []
        if (currentIndex > 0)
            results.push(calendarPeriodDueDate(frequency, frequencyValue, formStartDate, currentIndex - 1))
        results.push(calendarPeriodDueDate(frequency, frequencyValue, formStartDate, currentIndex))
        results.push(calendarPeriodDueDate(frequency, frequencyValue, formStartDate, currentIndex + 1))
        return results
    }
    const periodFn = FREQUENCY_PERIOD_DAYS[frequency]
    const periodDays = periodFn ? periodFn(frequencyValue) : DEFAULT_PERIOD_DAYS
    const daysSinceStart = Math.floor((today - formStartDate) / MS_PER_DAY)
    const currentPeriodIndex = Math.floor(daysSinceStart / periodDays)
    const addPeriod = (index) => {
        const d = new Date(formStartDate)
        d.setDate(d.getDate() + index * periodDays)
        return d
    }
    const results = []
    if (currentPeriodIndex > 0) results.push(addPeriod(currentPeriodIndex - 1))
    results.push(addPeriod(currentPeriodIndex))
    results.push(addPeriod(currentPeriodIndex + 1))
    return results
}

/** Returns only the current period's due date for a form (no previous/next). */
export function calculateCurrentDueDate(form, referenceDate) {
    const today = startOfDay(referenceDate)
    const formStartDate = parseFormStartDate(form)
    if (formStartDate > today) return new Date(formStartDate)
    const { frequency, frequency_value: frequencyValue = 1 } = form
    if (['monthly', 'quarterly', 'yearly'].includes(frequency)) {
        const currentIndex = calendarPeriodIndex(frequency, frequencyValue, formStartDate, today)
        return calendarPeriodDueDate(frequency, frequencyValue, formStartDate, currentIndex)
    }
    const periodFn = FREQUENCY_PERIOD_DAYS[frequency]
    const periodDays = periodFn ? periodFn(frequencyValue) : DEFAULT_PERIOD_DAYS
    const daysSinceStart = Math.floor((today - formStartDate) / MS_PER_DAY)
    const currentPeriodIndex = Math.floor(daysSinceStart / periodDays)
    const d = new Date(formStartDate)
    d.setDate(d.getDate() + currentPeriodIndex * periodDays)
    return d
}
