/** Trim a value to a string, mapping null/undefined to empty string. */
export const clean = (value) => (value == null ? '' : String(value).trim())

/** Format a yards-per-hour pace value, returning a dash when not finite. */
export const formatYph = (yph) => (Number.isFinite(yph) ? `${yph.toFixed(1)} yd/hr` : '—')

/** Format a duration in minutes as `Nm` or `Hh Mm`, or null when invalid. */
export const formatDuration = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return null
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
}
