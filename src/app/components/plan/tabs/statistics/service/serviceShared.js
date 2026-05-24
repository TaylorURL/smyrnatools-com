export const GOOD_COLOR = '#16a34a'
export const LATE_COLOR = '#f59e0b'
export const SLOW_COLOR = '#ea580c'
export const BOTH_COLOR = '#b91c1c'

export const fmtMinutes = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    if (n < 60) return `${Math.round(n)} min`
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const goodPctColor = (pct) => {
    if (pct == null) return 'var(--text-tertiary)'
    if (pct >= 0.9) return GOOD_COLOR
    if (pct >= 0.75) return '#65a30d'
    if (pct >= 0.6) return LATE_COLOR
    return BOTH_COLOR
}
