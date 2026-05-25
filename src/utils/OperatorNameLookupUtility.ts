/**
 * Shared operator-name canonicalization helpers.
 *
 * Multiple features need to bridge dispatch-system driver names against the
 * operator roster the rest of the app maintains — Statistics → Operators tab,
 * the Tickets modal driver column, the Plant Efficiency Report ticket
 * aggregator, etc. They all hit the same Jonel-vs-Tools spelling drift
 * (comma-flipped names, suffix tokens, punctuation differences), so the
 * matching logic lives here and every consumer imports from this module.
 */

/** Trailing generation-suffix tokens to strip when normalizing a name
 *  ("Bobby Johnson JR" → "Bobby Johnson") so a roster entry without the
 *  suffix still matches a ticket that has one. Also used by
 *  `formatPersonName` to keep these tokens uppercase in display. */
export const NAME_SUFFIXES: ReadonlySet<string> = new Set([
    'JR',
    'SR',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X'
])

/** Build every lookup key a person name should match under. Both sides of
 *  the ticket-to-operator match register/lookup through this list so
 *  Jonel-vs-Tools spelling drift resolves without manual intervention:
 *
 *    "SMITH, JOHN"        → ["JOHN SMITH"]                       (comma flipped)
 *    "JOHN A SMITH"       → ["JOHN A SMITH", "JOHN SMITH"]       (middle name optional)
 *    "JOHN SMITH JR."     → ["JOHN SMITH"]                       (suffix + punctuation stripped)
 *    "MARY-ANNE O'BRIEN"  → ["MARY ANNE O BRIEN", ..., "MARYANNE OBRIEN", ...]
 *
 *  Returns `[]` for genuinely empty / single-word strings (e.g. blanks,
 *  "DEFAULT"); those fall straight into the unmatched bucket.
 */
export function nameLookupVariants(name: string | null | undefined): string[] {
    const raw = String(name ?? '').trim()
    if (!raw) return []
    const upper = raw.toUpperCase()
    /* Detect "LAST, FIRST" vs "JOHN SMITH, JR" by what's BEFORE the comma:
     * one token → last-first → flip; multi token → comma is a separator. */
    let flipped = upper
    if (upper.includes(',')) {
        const [head, ...rest] = upper.split(',')
        const headTokens = head.trim().split(/\s+/).filter(Boolean)
        if (headTokens.length === 1) {
            flipped = `${rest.join(',').trim()} ${head.trim()}`
        } else {
            flipped = upper.replace(/,/g, ' ')
        }
    }
    /* Generate keys for two punctuation policies so compound names match
     * whether the punctuation is collapsed ("OBrien") or spaced
     * ("O Brien"). Without both, "Maria O'Brien" never matches
     * "MARIA OBRIEN" on a ticket. */
    const PUNCT_RE = /[.,'\-]/g
    const spacedBody = flipped.replace(PUNCT_RE, ' ').replace(/\s+/g, ' ').trim()
    const collapsedBody = flipped.replace(PUNCT_RE, '').replace(/\s+/g, ' ').trim()
    const tokenize = (body: string): string[] => {
        const tokens = body.split(' ').filter(Boolean)
        while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
        return tokens
    }
    const keys = new Set<string>()
    ;[spacedBody, collapsedBody].forEach((body) => {
        if (!body) return
        const tokens = tokenize(body)
        if (tokens.length < 2) return
        keys.add(tokens.join(' '))
        if (tokens.length >= 3) {
            keys.add(`${tokens[0]} ${tokens[tokens.length - 1]}`)
        }
    })
    return [...keys]
}

/**
 * Token-sorted canonical key used to match smyrnatools operator names against
 * Dayforce employee names and dispatch driver names. Strips punctuation,
 * parenthesized nicknames, and trailing badge numbers, then sorts the
 * remaining tokens alphabetically so "Gomez, Jose" and "Jose Gomez" both
 * reduce to `"gomez jose"`. Consumed by every Dayforce ↔ dispatch join
 * (useDayforceOperatorMetrics, useEfficiencyDayforcePunches,
 * useOperatorYardageByDay, useWeekTables, DayforceEfficiencyPage) so the
 * surfaces agree on who's who.
 *
 *   "Gomez, Jose (Jose) 007943" → "gomez jose"
 *   "Jose A. Gomez Jr."          → "a gomez jose jr"
 *   "" / null / undefined        → null
 *
 * Distinct from `nameLookupVariants`: that helper fans out variants for
 * fuzzy lookup against the dispatch-ticket-driver name index;
 * `canonicalNameKey` produces a single deterministic key for Map lookup.
 */
export function canonicalNameKey(name: string | null | undefined): string | null {
    if (!name) return null
    const stripped = String(name)
        .toLowerCase()
        .replace(/\s+\d+\s*$/, '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const tokens = stripped.split(' ').filter(Boolean)
    if (tokens.length === 0) return null
    return tokens.sort().join(' ')
}

/**
 * Normalize a person's name to a consistent Title Case display. The dispatch
 * data and the operator records themselves are a mix of ALL-CAPS, mixed-case,
 * and occasional all-lowercase rows. Every consumer (Tickets modal,
 * Operators stats tab, etc.) routes through this helper so the same person
 * reads the same way no matter where they appear.
 *
 *   "BOBBY JOHNSON JR."      → "Bobby Johnson Jr."
 *   "mary-anne o'brien"      → "Mary-Anne O'Brien"
 *   "JOHN III"               → "John III"
 */
export function formatPersonName(name: string | null | undefined): string {
    const raw = String(name ?? '').trim()
    if (!raw) return ''
    // Split on whitespace, hyphens, and apostrophes but KEEP the delimiters
    // so "Mary-Anne O'Brien" rebuilds with its original punctuation.
    return raw
        .toLowerCase()
        .split(/(\s+|-|')/)
        .map((part) => {
            if (!part || /^[\s\-']+$/.test(part)) return part
            const upper = part.toUpperCase()
            if (NAME_SUFFIXES.has(upper)) return upper
            return part.charAt(0).toUpperCase() + part.slice(1)
        })
        .join('')
}
