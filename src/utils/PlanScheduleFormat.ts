// Plan Schedule — string/number formatters and address sanitization helpers.

/** Trim/normalize any value to a string. Empty / null / undefined → ''. */
export const clean = (value) => (value == null ? '' : String(value).trim())

/** Sum a numeric field across an array of objects, ignoring non-numeric values. */
export const sumField = (orders, key) =>
    orders.reduce((acc, o) => {
        const n = parseFloat(o?.[key])
        return acc + (Number.isFinite(n) ? n : 0)
    }, 0)

/** Normalize loose dispatch time strings into `HH:MM`. Accepts already-formatted
 *  values, 3- or 4-digit numeric strings, and otherwise returns the raw input. */
export const formatHhmm = (value) => {
    const v = clean(value)
    if (!v) return ''
    if (/^\d{1,2}:\d{2}$/.test(v)) return v.padStart(5, '0')
    if (/^\d{3,4}$/.test(v)) {
        const padded = v.padStart(4, '0')
        return `${padded.slice(0, 2)}:${padded.slice(2)}`
    }
    return v
}

/**
 * Pull the city segment out of a plant's full street address so we can fall
 * back to it when an order's city is missing. Accepts common formats:
 *   "123 Main St, Houston, TX 77001"  → "Houston"
 *   "123 Main St, Houston TX 77001"   → "Houston"
 *   "123 Main St"                      → ""
 */
export const extractCityFromFullAddress = (fullAddress) => {
    const value = clean(fullAddress)
    if (!value) return ''
    const parts = value
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean)
    if (parts.length >= 3) return parts[1]
    if (parts.length === 2) {
        // "street, city STATE ZIP" — strip trailing state + zip to isolate city.
        // eslint-disable-next-line security/detect-unsafe-regex -- anchored to $, fixed-length character classes; no exponential backtracking path
        return parts[1].replace(/\s+[A-Za-z]{2}(\s+\d{5}(-\d{4})?)?$/i, '').trim()
    }
    return ''
}

/**
 * Detect garbage / placeholder addresses that the dispatcher needs to fix
 * before the load can be sent (e.g. "GET NEW ADD....!", "GOING WHERE?",
 * "TBD", "N/A"). Empty strings are treated as "missing", not "bad".
 */
export const BAD_ADDRESS_TOKENS = [
    'get address',
    'get add',
    'get new',
    'going where',
    'going to',
    'where?',
    'tbd',
    'tba',
    'n/a',
    'n a',
    'fix',
    'fixme',
    'unknown',
    'no address',
    'need address',
    'need add',
    'pending',
    'placeholder',
    'verify',
    'update',
    'address?',
    '???',
    'find address',
    'no addr'
]
export const isLikelyBadAddress = (raw) => {
    const value = clean(raw)
    if (!value) return false
    const lower = value.toLowerCase()
    if (/[?!]/.test(value)) return true
    if (/\.{3,}/.test(value)) return true
    if (BAD_ADDRESS_TOKENS.some((tok) => lower.includes(tok))) return true
    // Real addresses almost always have a digit — anything ≥ 5 chars without one
    // is suspicious (e.g. "GO WHERE", "FIND IT").
    if (value.length < 5) return true
    if (!/\d/.test(value) && value.length < 12) return true
    return false
}

/** Clamp a number into the [0, 1] range. */
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
