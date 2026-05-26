/**
 * Shared constants + week math for the Saturday Operator Forecast feature.
 *
 * Managers see a banner on Dashboard once per week asking them to declare
 * how many operators they expect on the upcoming Saturday for each plant
 * they manage. The Planner's Saturday override editor pre-populates from
 * those forecasts. All math runs in Chicago time so the dispatch and the
 * managers agree on which Saturday "this week" refers to.
 */

const CHICAGO_TIMEZONE = 'America/Chicago'

/** Returns the YYYY-MM-DD date string of the upcoming Saturday in Chicago time.
 *  If today is Saturday, returns today's date — managers can still submit /
 *  re-submit on Saturday itself. */
export function getUpcomingSaturdayIso(now = new Date()) {
    const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: CHICAGO_TIMEZONE }))
    const dayOfWeek = chicagoNow.getDay() // 0 = Sun, 6 = Sat
    const daysUntilSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7
    const saturday = new Date(chicagoNow)
    saturday.setDate(chicagoNow.getDate() + daysUntilSaturday)
    return formatIsoDate(saturday)
}

/** Returns the ISO week label (e.g. "2026-W22") for a given date. */
export function getIsoWeekLabel(date = new Date()) {
    const target = new Date(date.valueOf())
    const dayNumber = (date.getDay() + 6) % 7
    target.setDate(target.getDate() - dayNumber + 3)
    const firstThursday = target.valueOf()
    target.setMonth(0, 1)
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
    }
    const week = 1 + Math.ceil((firstThursday - target) / 604800000)
    return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** YYYY-MM-DD format helper. */
export function formatIsoDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/** Cap on the number a manager can enter for a single plant. The DB enforces
 *  the same range; the frontend mirrors it so the user sees the problem
 *  before round-tripping. */
export const FORECAST_MIN_OPERATORS = 0
export const FORECAST_MAX_OPERATORS = 200

/** Query keys / event names used by the prompt + Planner integration so the
 *  string literals don't drift. */
export const SATURDAY_FORECAST_EVENTS = {
    submitted: 'saturday-forecast:submitted',
    refreshed: 'saturday-forecast:refreshed'
}

/** Human-readable formatter for the upcoming Saturday — used in the banner
 *  and modal headings. Example: "Saturday, May 30". */
export function formatSaturdayLabel(saturdayIso) {
    if (!saturdayIso) return ''
    const [year, month, day] = saturdayIso.split('-').map(Number)
    if (!year || !month || !day) return saturdayIso
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}
