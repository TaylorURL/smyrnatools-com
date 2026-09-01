import { PLAN_TIME_ZONE } from '../../app/constants/planConstants'

// Smyrna's operations run on Central time regardless of where the dispatcher
// (or developer) is sitting, so "today" is always resolved in CST.

const CST_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: PLAN_TIME_ZONE,
    year: 'numeric'
})

/** Pull `{ year, month, day }` strings (zero-padded) for "now" in CST. */
const getCstDateParts = (date = new Date()) => {
    const parts = CST_DATE_PARTS_FORMATTER.formatToParts(date)
    const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || ''
    return { day: lookup('day'), month: lookup('month'), year: lookup('year') }
}

/** Today's CST calendar date in `YYYY-MM-DD` — anchors the statistics
 *  time-range pickers and every "is the user looking at today" check. */
export const getTodayDate = () => {
    const { year, month, day } = getCstDateParts()
    return `${year}-${month}-${day}`
}

/** The CST calendar date an instant fell on, in `YYYY-MM-DD`. The key every
 *  day bucket is built on: taken from a UTC date instead, an afternoon in the
 *  yard lands under tomorrow. */
export const getCentralDay = (value: Date | string | number = new Date()) => {
    const at = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(at.getTime())) return ''
    const { year, month, day } = getCstDateParts(at)
    return `${year}-${month}-${day}`
}

/** A stored `YYYY-MM-DD`, which is a square on a calendar rather than a moment.
 *  Read and written out of UTC so it prints the square it came from; moved into
 *  a zone it renders as the day before. */
export const formatCentralCalendarDate = (
    value: string,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return ''
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

/** An instant, written as the yard read it. */
export const formatCentralDate = (
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
) => {
    const at = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(at.getTime())) return ''
    return at.toLocaleDateString('en-US', { ...options, timeZone: PLAN_TIME_ZONE })
}

/** An instant with the hour it happened at, as the yard read it. */
export const formatCentralDateTime = (
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        year: 'numeric'
    }
) => {
    const at = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(at.getTime())) return ''
    return at.toLocaleString('en-US', { ...options, timeZone: PLAN_TIME_ZONE })
}

/** The hour alone, as the yard read it. */
export const formatCentralTime = (
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
) => {
    const at = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(at.getTime())) return ''
    return at.toLocaleTimeString('en-US', { ...options, timeZone: PLAN_TIME_ZONE })
}
