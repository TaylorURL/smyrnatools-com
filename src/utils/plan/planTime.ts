import { PLAN_TIME_ZONE, TIMELINE_HOURS, TIMELINE_START_HOUR } from '../../app/constants/planConstants'

/* ── CST anchored calendar / time-of-day helpers ─────────────────────────
 *  Smyrna's operations run on Central time regardless of where the
 *  dispatcher (or developer) is sitting. Every "today / now / day-of-week"
 *  decision in PlanView passes through here so a developer in another
 *  timezone sees the same numbers a Houston dispatcher would. */

const CST_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: PLAN_TIME_ZONE,
    year: 'numeric'
})

const CST_TIME_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: PLAN_TIME_ZONE
})

/** Pull `{ year, month, day }` strings (zero-padded) for the supplied
 *  Date — or "now" — interpreted in CST. */
const getCstDateParts = (date = new Date()) => {
    const parts = CST_DATE_PARTS_FORMATTER.formatToParts(date)
    const lookup = (type) => parts.find((p) => p.type === type)?.value || ''
    return { day: lookup('day'), month: lookup('month'), year: lookup('year') }
}

/** Pure calendar arithmetic on a `YYYY-MM-DD` string. Parses the input
 *  components and walks days via UTC operations so the result doesn't
 *  drift across DST boundaries or the dispatcher's local timezone. */
const advanceIsoDate = (dateStr, offset) => {
    const parts = String(dateStr || '').split('-')
    if (parts.length !== 3) return dateStr
    const [y, m, d] = parts.map((n) => parseInt(n, 10))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateStr
    const base = new Date(Date.UTC(y, m - 1, d))
    base.setUTCDate(base.getUTCDate() + offset)
    const yy = base.getUTCFullYear()
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(base.getUTCDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
}

/** Day-of-week (0–6, Sunday=0) for a `YYYY-MM-DD` string, parsed as a
 *  pure calendar date so the result is consistent regardless of where
 *  the call site is running. */
export const getDayOfWeekForDate = (dateStr) => {
    const parts = String(dateStr || '').split('-')
    if (parts.length !== 3) return null
    const [y, m, d] = parts.map((n) => parseInt(n, 10))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Today's CST calendar date in `YYYY-MM-DD` — anchors the realtime
 *  dashboard, the same-day booking shortcut, and every "is the user
 *  looking at today" check across PlanView. */
export const getTodayDate = () => {
    const { year, month, day } = getCstDateParts()
    return `${year}-${month}-${day}`
}

/** Tomorrow's CST calendar date in `YYYY-MM-DD`. */
export const getTomorrowDate = () => advanceIsoDate(getTodayDate(), 1)

/** Add `offset` calendar days to a `YYYY-MM-DD` string. Pure date math —
 *  no local-tz drift. */
export const getOffsetDate = (dateStr, offset) => advanceIsoDate(dateStr, offset)

/**
 * Returns `dateStr` unchanged if it isn't a Sunday; otherwise advances
 * by `direction` (+1 forward, −1 backward) until it lands on a non-
 * Sunday. Lets the date selector skip Sundays entirely — plants are
 * closed so a plan for that date has no meaning.
 */
export const skipSundayDate = (dateStr, direction = 1) => {
    if (!dateStr) return dateStr
    const step = direction < 0 ? -1 : 1
    let cursor = dateStr
    while (getDayOfWeekForDate(cursor) === 0) cursor = advanceIsoDate(cursor, step)
    return cursor
}

/** Current minute-of-day (0–1439) on Smyrna's CST wall clock. */
export const getNowCstMinutes = () => {
    const parts = CST_TIME_PARTS_FORMATTER.formatToParts(new Date())
    const lookup = (type) => parts.find((p) => p.type === type)?.value
    const h = parseInt(lookup('hour') || '0', 10) % 24
    const m = parseInt(lookup('minute') || '0', 10)
    return h * 60 + m
}

/** Same direction as `getOffsetDate`, but lands on the next non-Sunday.
 *  Used by the prev/next-day buttons so a single arrow press never
 *  strands the user on a closed-plant day. */
export const offsetDateSkipSunday = (dateStr, offset) => skipSundayDate(getOffsetDate(dateStr, offset), offset)

/* ── Time-of-day helpers ─────────────────────────────────────────────── */

export const formatTime = (hours, minutes) => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

export const parseTime = (timeString) => timeString?.split(':').map(Number) ?? [0, 0]

export const addMinutesToTime = (time, mins) => {
    if (!time) return null
    const [hours, minutes] = parseTime(time)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    date.setMinutes(date.getMinutes() + mins)
    return formatTime(date.getHours(), date.getMinutes())
}

export const formatTimeInput = (value) => {
    const digits = value.replace(/[^0-9]/g, '')
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

export const timeToMinutes = (timeStr) => {
    if (!timeStr) return null
    const [h, m] = parseTime(timeStr)
    return h * 60 + m
}

export const minutesToTime = (totalMin) => {
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return formatTime(h, m)
}

/** Format a minute-of-day count as `HH:MM`, wrapping around midnight so
 *  negative or > 1440 inputs still produce a sane time-of-day. */
export const formatMinutesClock = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return formatTime(h, m)
}

export const timeToPercent = (timeStr) => {
    if (!timeStr) return null
    const [h, m] = parseTime(timeStr)
    const totalMin = (h - TIMELINE_START_HOUR) * 60 + m
    return Math.max(0, Math.min(100, (totalMin / (TIMELINE_HOURS * 60)) * 100))
}

export const percentToTime = (pct) => {
    const totalMin = (pct / 100) * TIMELINE_HOURS * 60 + TIMELINE_START_HOUR * 60
    return minutesToTime(Math.round(totalMin))
}

/** Parse an `HH:MM` (or `H:MM`) duration from the dispatch report into minutes. */
export const parseDurationMinutes = (value) => {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hours = parseInt(m[1], 10)
    const mins = parseInt(m[2], 10)
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
    const total = hours * 60 + mins
    return total > 0 ? total : null
}
