/**
 * PlanStatisticsFormatUtility — display formatters for the Plan Statistics
 * dashboard. Numbers, percentages, time strings, date ranges, and the
 * theme-aware colors that drive Δ% pills and satisfaction badges.
 *
 * Pure functions. No DOM, no React. Mirror the Schedule tab's headline
 * styling so cross-tab numbers always read the same.
 */
const MINUTES_PER_DAY = 24 * 60

/** ISO `YYYY-MM-DD` → local-zone `Date` (no UTC drift). Returns null when
 *  the input is empty or malformed. */
export const parseIsoLocal = (iso) => {
    if (!iso) return null
    const [year, month, day] = iso.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
}

export const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : '—')
export const fmtFloat = (n, dp = 1) => (Number.isFinite(n) ? n.toFixed(dp) : '—')
export const fmtPct = (n) => (Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—')

export const fmtDate = (iso) => {
    const d = parseIsoLocal(iso)
    if (!d) return iso || ''
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export const fmtRange = (start, end) => {
    if (!start || !end) return ''
    if (start === end) return fmtDate(start)
    return `${fmtDate(start)} – ${fmtDate(end)}`
}

export const fmtMinutesAsHHMM = (mins) => {
    if (!Number.isFinite(mins)) return '—'
    const wrapped = ((mins % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    const period = h >= 12 ? 'PM' : 'AM'
    const display = h % 12 === 0 ? 12 : h % 12
    return `${display}:${String(m).padStart(2, '0')} ${period}`
}

/** Δ% between current/previous values. Null when either side is missing or
 *  the previous value is zero (would divide by zero). */
export const deltaPct = (current, previous) => {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
    return ((current - previous) / previous) * 100
}

/** Color for a Δ% pill — green up, red down, neutral when within 0.1pp of zero. */
export const deltaColor = (pct) => {
    if (pct == null) return undefined
    if (Math.abs(pct) < 0.1) return 'var(--text-secondary)'
    return pct > 0 ? '#16a34a' : '#dc2626'
}

/** Tier-color a 0–100 score — green ≥ 90 (Schedule-tab "happy"), amber ≥ 75
 *  ("watching"), red below ("bad service"). Mirrors the Schedule tab's
 *  SatisfactionBadge so headlines on both surfaces feel identical. */
export const satisfactionColor = (score100) => {
    if (score100 == null) return 'var(--text-tertiary)'
    if (score100 >= 90) return '#15803d'
    if (score100 >= 75) return '#b45309'
    return '#b91c1c'
}
