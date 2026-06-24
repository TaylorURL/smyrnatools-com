/**
 * PlanStatisticsFormatUtility — display formatters for the Plan Statistics
 * dashboard. Numbers, percentages, time strings, and date ranges.
 *
 * Pure functions. No DOM, no React. Mirror the Schedule tab's headline
 * styling so cross-tab numbers always read the same.
 */

/** ISO `YYYY-MM-DD` -> local-zone `Date` (no UTC drift). Returns null when
 *  the input is empty or malformed. */
export const parseIsoLocal = (iso: string | null | undefined): Date | null => {
    if (!iso) return null
    const [year, month, day] = iso.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
}

export const fmtInt = (n: number | null | undefined): string =>
    Number.isFinite(n as number) ? Math.round(n as number).toLocaleString() : '\u2014'
export const fmtFloat = (n: number | null | undefined, dp: number = 1): string =>
    Number.isFinite(n as number) ? (n as number).toFixed(dp) : '\u2014'
/** Yardage formatter \u2014 snaps to the nearest half-yard because production
 *  yardage is ALWAYS a whole or half (the dispatcher can't enter `4.7`
 *  yd). Any non-half decimal showing up here is floating-point drift from
 *  summation or a parser estimate artifact, not real data; snapping
 *  hides that noise instead of leaking it into the UI. `4.5 \u2192 "4.5"`,
 *  `1567.7 \u2192 "1,567.5"`, `100 \u2192 "100"`. Use this for every yardage
 *  display; counts (loads, orders, drivers) still use `fmtInt`. */
export const fmtYards = (n: number | null | undefined): string => {
    if (!Number.isFinite(n as number)) return '\u2014'
    const half = Math.round((n as number) * 2) / 2
    const whole = Math.trunc(half)
    return half === whole ? whole.toLocaleString() : `${whole.toLocaleString()}.5`
}
export const fmtPct = (n: number | null | undefined): string =>
    Number.isFinite(n as number) ? `${(n as number) > 0 ? '+' : ''}${(n as number).toFixed(1)}%` : '\u2014'

/** Score percentage \u2014 0\u20131 fraction rendered as "X%" with no sign prefix.
 *  Use for any rate or score (good-service %, cancel rate, kicker rate,
 *  booking rate). For period-over-period deltas keep using `fmtPct`. */
export const fmtScorePct = (n: number | null | undefined): string =>
    Number.isFinite(n as number) ? `${Math.round((n as number) * 100)}%` : '\u2014'

export const fmtDate = (iso: string | null | undefined): string => {
    const d = parseIsoLocal(iso)
    if (!d) return iso || ''
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export const fmtRange = (start: string | null | undefined, end: string | null | undefined): string => {
    if (!start || !end) return ''
    if (start === end) return fmtDate(start)
    return `${fmtDate(start)} \u2013 ${fmtDate(end)}`
}

export const fmtMinutesAsHHMM = (mins: number | null | undefined): string => {
    if (!Number.isFinite(mins as number)) return '\u2014'
    const wrapped = (((mins as number) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    const period = h >= 12 ? 'PM' : 'AM'
    const display = h % 12 === 0 ? 12 : h % 12
    return `${display}:${String(m).padStart(2, '0')} ${period}`
}

/** delta% between current/previous values. Null when either side is missing or
 *  the previous value is zero (would divide by zero). */
export const deltaPct = (current: number | null | undefined, previous: number | null | undefined): number | null => {
    if (!Number.isFinite(current as number) || !Number.isFinite(previous as number) || previous === 0) return null
    return (((current as number) - (previous as number)) / (previous as number)) * 100
}
