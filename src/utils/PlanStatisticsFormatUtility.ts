/**
 * PlanStatisticsFormatUtility — display formatters for the Plan Statistics
 * dashboard. Numbers, percentages, time strings, date ranges, and the
 * theme-aware colors that drive delta% pills and satisfaction badges.
 *
 * Pure functions. No DOM, no React. Mirror the Schedule tab's headline
 * styling so cross-tab numbers always read the same.
 */
const MINUTES_PER_DAY = 24 * 60

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
export const fmtPct = (n: number | null | undefined): string =>
    Number.isFinite(n as number) ? `${(n as number) > 0 ? '+' : ''}${(n as number).toFixed(1)}%` : '\u2014'

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

/** Color for a delta% pill — green up, red down, neutral when within 0.1pp of zero. */
export const deltaColor = (pct: number | null | undefined): string | undefined => {
    if (pct == null) return undefined
    if (Math.abs(pct) < 0.1) return 'var(--text-secondary)'
    return pct > 0 ? '#16a34a' : '#dc2626'
}

/** Tier-color a 0-100 score — green >= 90 (Schedule-tab "happy"), amber >= 75
 *  ("watching"), red below ("bad service"). */
export const satisfactionColor = (score100: number | null | undefined): string => {
    if (score100 == null) return 'var(--text-tertiary)'
    if (score100 >= 90) return '#15803d'
    if (score100 >= 75) return '#b45309'
    return '#b91c1c'
}
