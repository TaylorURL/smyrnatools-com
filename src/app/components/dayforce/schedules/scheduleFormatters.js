import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'

export const fmtHours = (n) => `${fmtFloat(n, 1)}h`

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit'
})

export const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' })

/** Dayforce serialises timestamps without a zone — interpret as the local
 *  clock (tenant is in US Central, which is also where dispatchers read
 *  the page). Returns a Date or null. */
export const parseLocal = (iso) => {
    if (!iso) return null
    const d = new Date(typeof iso === 'string' ? iso.replace(' ', 'T') : iso)
    return Number.isNaN(d.getTime()) ? null : d
}

export const fmtTime = (iso) => {
    const d = parseLocal(iso)
    return d ? TIME_FORMATTER.format(d) : '—'
}

/** Compact "6:30a" formatter for a cell — strips minutes when on the hour
 *  so the cell stays narrow when the schedule is round-numbered. */
export const fmtTimeCompact = (iso) => {
    const d = parseLocal(iso)
    if (!d) return '—'
    const h = d.getHours()
    const m = d.getMinutes()
    const period = h >= 12 ? 'p' : 'a'
    const display = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${display}${period}` : `${display}:${String(m).padStart(2, '0')}${period}`
}

/** Date helpers — `yyyy-mm-dd` strings. Calendar arithmetic stays local
 *  to avoid the timezone drift that bit us elsewhere. */
export const parseYmd = (ymd) => {
    if (!ymd) return null
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return null
    const date = new Date(y, m - 1, d)
    return Number.isNaN(date.getTime()) ? null : date
}

export const formatYmd = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** Returns the Monday of the same ISO week as `ymd`. Sunday rolls to the
 *  previous Monday so a Sunday-flagged shift (rare; PTO sometimes lands
 *  here) doesn't anchor its own degenerate week. */
export const mondayOf = (ymd) => {
    const d = parseYmd(ymd)
    if (!d) return null
    const dow = d.getDay() // 0 = Sun
    const offset = dow === 0 ? -6 : 1 - dow
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
    return formatYmd(monday)
}

export const addDays = (ymd, days) => {
    const d = parseYmd(ymd)
    if (!d) return null
    return formatYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Pretty week label — "May 26 – Jun 1" for the table header. */
export const fmtWeekLabel = (mondayYmd) => {
    const start = parseYmd(mondayYmd)
    const end = parseYmd(addDays(mondayYmd, 5))
    if (!start || !end) return mondayYmd || ''
    return `${SHORT_DAY_FORMATTER.format(start)} – ${SHORT_DAY_FORMATTER.format(end)}`
}
