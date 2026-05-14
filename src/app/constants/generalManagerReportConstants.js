/* General Manager report constants — variance pill palette + per-plant
 * metric row spec + small numeric helpers. */

/** Tailwind classes for variance pills — positive (green), negative
 *  (red), neutral (gray). Used by both the per-plant table and the
 *  aggregate-production table. */
export const VARIANCE_CLASSES = {
    negative: 'text-red-600 bg-red-100',
    neutral: 'text-slate-500 bg-slate-100',
    positive: 'text-emerald-600 bg-emerald-100'
}

/** Builds a "+12.3%" / "-4.5%" / "0%" / "100%" string for the variance
 *  pill, or empty when either side isn't a finite number. */
export function formatVarianceFromValues(lastRaw, currentRaw) {
    const last = Number(lastRaw)
    const curr = Number(currentRaw)
    if (!isFinite(last) || !isFinite(curr)) return ''
    if (last === 0) return curr === 0 ? '0%' : '100%'
    const pct = ((curr - last) / last) * 100
    const rounded = Number(pct.toFixed(1))
    if (rounded === 0) return '0%'
    return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`
}

/** Picks the Tailwind class for a formatted variance string. */
export function getVarianceClass(varianceStr) {
    const n = parseFloat(varianceStr)
    if (!isFinite(n)) return VARIANCE_CLASSES.neutral
    if (n > 0) return VARIANCE_CLASSES.positive
    if (n < 0) return VARIANCE_CLASSES.negative
    return VARIANCE_CLASSES.neutral
}

/** Per-plant metric row spec — `{ label, key }` where `key` resolves to
 *  `${key}_${plantCode}` on the form object. Order is preserved as it
 *  appears in the source layout. */
export const GM_METRICS = [
    { key: 'active_operators', label: '# of Operators' },
    { key: 'runnable_trucks', label: '# of Runnable Trucks' },
    { key: 'down_trucks', label: 'Down Trucks' },
    { key: 'operators_starting', label: 'Operators Starting' },
    { key: 'operators_leaving', label: 'Operators Leaving' },
    { key: 'new_operators_training', label: 'New Operators Training' },
    { key: 'total_yardage', label: 'Total Yardage' },
    { key: 'total_hours', label: 'Total Hours' }
]
