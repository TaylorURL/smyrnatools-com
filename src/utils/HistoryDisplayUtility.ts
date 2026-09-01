/**
 * Shared display formatting for asset history values.
 * Centralizes date localization, rating labels, null-operator normalization,
 * and date comparison logic used across Mixer, Tractor, and Operator history models.
 */
import { formatCentralCalendarDate, formatCentralDate, getCentralDay } from './PlanUtility'

const CLEANLINESS_LABELS: Record<number, string> = {
    1: 'Poor (1)',
    2: 'Fair (2)',
    3: 'Good (3)',
    4: 'Very Good (4)',
    5: 'Excellent (5)'
}

const HistoryDisplayUtility = {
    /** Compares two dates by their date-only (YYYY-MM-DD) components. */
    areSameDates(date1: string | null | undefined, date2: string | null | undefined) {
        if (!date1 && !date2) return true
        if (!date1 || !date2) return false
        try {
            return getCentralDay(date1) === getCentralDay(date2)
        } catch {
            return false
        }
    },

    /** Returns 'None' for sentinel values used when an assignment field is empty. */
    formatAssignmentValue(value: string) {
        if (['0', 'null', 'undefined'].includes(value)) return 'None'
        return null
    },

    /** Maps a numeric cleanliness rating to its labeled form (e.g. "Good (3)"). */
    formatCleanlinessRating(value: string) {
        const rating = parseInt(value, 10)
        if (isNaN(rating)) return null
        return CLEANLINESS_LABELS[rating] || `${rating}`
    },

    /**
     * Formats a date-type history value for display using locale formatting.
     * Handles both `YYYY-MM-DD` strings and full date strings.
     */
    formatDateValue(value: string) {
        if (!value) return null
        try {
            const calendarDate = formatCentralCalendarDate(value, {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric'
            })
            if (calendarDate) return calendarDate
            const date = new Date(value)
            if (!isNaN(date.getTime())) {
                return formatCentralDate(date, { day: 'numeric', month: 'numeric', year: 'numeric' })
            }
        } catch {}
        return null
    }
}

export default HistoryDisplayUtility
export { HistoryDisplayUtility }
