/**
 * Normalize the inconsistent street + city strings the dispatch HTML hands
 * us into a single readable, title-cased form. The raw values can be
 * SHOUTING-ALL-CAPS, padded with stray punctuation (`RD .`, `STREET ,`,
 * leading `.`), or doubled-up commas — left alone the UI ends up showing
 * things like `.lady Leslie Lane & Waterloo Rd, Pearland` or
 * `6200 OIL FIELD RD ., MISSOURI CITY`.
 *
 * Output rules:
 *   - Title Case for ordinary words
 *   - Common abbreviations preserved as uppercase (US, NW, BLVD, IH, FM, etc.)
 *   - Connector words (of, and, the, at, on, in) lowercase mid-string
 *   - Numeric / route tokens preserved (`6200`, `1A`, `IH-10`, `US-59`)
 *   - Leading and trailing standalone punctuation stripped
 *   - Internal whitespace collapsed
 */

const KEEP_UPPER = new Set([
    'US',
    'USA',
    'NW',
    'NE',
    'SW',
    'SE',
    'N',
    'S',
    'E',
    'W',
    'PO',
    'BLVD',
    'IH',
    'TX',
    'FM',
    'CR',
    'RR',
    'HWY'
])
const LOWER_CONNECTORS = new Set(['of', 'and', 'the', 'at', 'on', 'in'])

const cleanString = (value) => (value == null ? '' : String(value).trim())

/** Format a single street or city segment. */
export const formatAddressSegment = (raw) => {
    let v = cleanString(raw)
    if (!v) return ''
    v = v
        // " ." → "." and " ," → ","
        .replace(/\s+([.,;:])/g, '$1')
        // Repeated punctuation ", , " → ", "
        .replace(/([.,;:])\s*\1+/g, '$1')
        // Tabs / runs of whitespace → single space
        .replace(/[ \t]+/g, ' ')
        // Strip leading and trailing standalone punctuation runs (catches
        // ".lady Leslie Lane" and "Lady Leslie Lane,").
        .replace(/^[\s.,;:&/-]+/, '')
        .replace(/[\s.,;:]+$/, '')
        .trim()
    if (!v) return ''
    return v
        .split(/(\s+|,)/)
        .map((token, idx) => {
            if (token === ',' || /^\s+$/.test(token)) return token
            const stripped = token.replace(/[^A-Za-z0-9]/g, '')
            if (!stripped) return token
            const upper = stripped.toUpperCase()
            // Hyphenated/numeric route abbreviations: IH-10, US-59, FM-1488.
            if (/^[A-Z]{1,3}-?\d+$/i.test(token)) return token.toUpperCase()
            if (KEEP_UPPER.has(upper)) return token.toUpperCase()
            if (idx > 0 && LOWER_CONNECTORS.has(upper.toLowerCase())) return upper.toLowerCase()
            // Pure numerics or numeric+short-letter (1A, 1488B) stay as-is.
            // eslint-disable-next-line security/detect-unsafe-regex
            if (/^\d+(?:[A-Za-z]+)?$/.test(token)) return token
            // Title-case word, preserving internal apostrophes / hyphens / slashes.
            return token.toLowerCase().replace(/(^|[\s'\-/])([a-z])/g, (_match, sep, ch) => sep + ch.toUpperCase())
        })
        .join('')
        .replace(/\s+,/g, ',')
        .replace(/,(?=\S)/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim()
}

/** Combine the cleaned street + city into a single readable string. */
export const formatOrderAddress = (order, separator = ', ') => {
    const street = formatAddressSegment(order?.address)
    const city = formatAddressSegment(order?.city)
    return [street, city].filter(Boolean).join(separator)
}

/**
 * Format an arbitrary one-string address (e.g. a plant address that's
 * already a full "street, city, state zip" line). Splits on commas, runs
 * each segment through the segment formatter, and rejoins. Safe to call
 * on any free-form address string.
 */
export const formatFullAddress = (raw) => {
    const v = cleanString(raw)
    if (!v) return ''
    return v
        .split(',')
        .map((part) => formatAddressSegment(part))
        .filter(Boolean)
        .join(', ')
}
