/**
 * Address geocoding via OpenStreetMap Nominatim. Free, no API key, but the
 * usage policy caps requests at 1/second so we serialise all calls through
 * a single in-flight promise chain.
 *
 * Robustness layers (the "only some jobs show up" problem these solve):
 *
 *   1. Multi-strategy fallback — one address rarely geocodes cleanly on
 *      the first try. We try the most specific query first (address +
 *      city + state) and progressively fall back to looser variants
 *      (address + city, address only, city + state) until something
 *      resolves. The first hit wins and is cached under the canonical
 *      query string for next time.
 *
 *   2. Negative-cache TTL — failed lookups used to be cached forever, so
 *      a transient OSM hiccup permanently hid a job. Misses now expire
 *      after `NEGATIVE_TTL_MS` (24h) so the next reload retries them.
 *
 *   3. State context — orders carry city but rarely a state, leaving
 *      ambiguous city names (Memphis TN vs Memphis IN) to coin-flip the
 *      result. Callers pass `state` once and every fallback variant uses
 *      it as a tiebreaker.
 */

const CACHE_KEY = 'smyrnatools_geocode_cache_v6'
const LEGACY_CACHE_KEYS = [
    'smyrnatools_geocode_cache_v1',
    'smyrnatools_geocode_cache_v2',
    'smyrnatools_geocode_cache_v3',
    'smyrnatools_geocode_cache_v4',
    'smyrnatools_geocode_cache_v5'
]
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const MIN_INTERVAL_MS = 1100
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000

let cacheRef = null
let queueTail = Promise.resolve()
let lastFetchAt = 0

function loadCache() {
    if (cacheRef) return cacheRef
    try {
        const raw = window?.localStorage?.getItem(CACHE_KEY)
        cacheRef = raw ? JSON.parse(raw) : {}
        // One-time migration from v1 — drop legacy negative entries so
        // their permanent misses don't carry over into the new TTL model.
        LEGACY_CACHE_KEYS.forEach((legacy) => {
            try {
                const old = window?.localStorage?.getItem(legacy)
                if (!old) return
                const parsed = JSON.parse(old)
                Object.entries(parsed || {}).forEach(([k, v]) => {
                    if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && !cacheRef[k]) {
                        cacheRef[k] = { coords: { lat: v.lat, lng: v.lng }, ts: Date.now() }
                    }
                })
                window.localStorage.removeItem(legacy)
            } catch {
                // ignore broken legacy data
            }
        })
    } catch {
        cacheRef = {}
    }
    return cacheRef
}

function persistCache() {
    try {
        window?.localStorage?.setItem(CACHE_KEY, JSON.stringify(cacheRef || {}))
    } catch {
        // localStorage may be full or unavailable — silently skip persistence
    }
}

/** Combines fragments into a single Nominatim query string. */
function buildQuery(...parts) {
    return parts
        .map((p) => String(p || '').trim())
        .filter(Boolean)
        .join(', ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Two-letter US state codes — used to detect when an address already
 *  carries explicit state context so we don't clobber it with a hint. */
const US_STATE_CODES = new Set([
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
    'DC'
])

const US_STATE_NAMES = new Set([
    'alabama',
    'alaska',
    'arizona',
    'arkansas',
    'california',
    'colorado',
    'connecticut',
    'delaware',
    'florida',
    'georgia',
    'hawaii',
    'idaho',
    'illinois',
    'indiana',
    'iowa',
    'kansas',
    'kentucky',
    'louisiana',
    'maine',
    'maryland',
    'massachusetts',
    'michigan',
    'minnesota',
    'mississippi',
    'missouri',
    'montana',
    'nebraska',
    'nevada',
    'new hampshire',
    'new jersey',
    'new mexico',
    'new york',
    'north carolina',
    'north dakota',
    'ohio',
    'oklahoma',
    'oregon',
    'pennsylvania',
    'rhode island',
    'south carolina',
    'south dakota',
    'tennessee',
    'texas',
    'utah',
    'vermont',
    'virginia',
    'washington',
    'west virginia',
    'wisconsin',
    'wyoming'
])

/** Does the supplied free-form address already contain US state context?
 *  Looks for either a `, XX` 2-letter code or a comma-delimited full state
 *  name. If yes, the state-hint variants are skipped so we don't risk
 *  conflicting suffixes (e.g. "…Huntsville, TX 77340, Tennessee"). */
function addressHasState(...parts) {
    const text = parts.filter(Boolean).join(', ').toLowerCase()
    if (!text) return false
    if (US_STATE_NAMES.has(text)) return true
    for (const name of US_STATE_NAMES) {
        if (text.includes(`, ${name}`) || text.startsWith(`${name},`) || text.endsWith(` ${name}`)) return true
    }
    // Two-letter code: must be preceded by ", " or " " and followed by a
    // word boundary so we don't false-positive on "Main St" → "St" etc.
    const codeMatch = text.match(/[,\s]([a-z]{2})(?:[\s,]|\s+\d{5}|$)/i)
    if (codeMatch && US_STATE_CODES.has(codeMatch[1].toUpperCase())) return true
    return false
}

/** Returns true when a cached entry is a fresh negative miss (skip the
 *  retry) and false when it has expired (treat as not-cached). */
function isFreshMiss(entry) {
    if (!entry || entry.coords) return false
    return Date.now() - (entry.ts || 0) < NEGATIVE_TTL_MS
}

async function geocodeRaw(query) {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`
    let res
    try {
        res = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'en-US'
            }
        })
    } catch {
        return null
    }
    if (!res.ok) return null
    let data
    try {
        data = await res.json()
    } catch {
        return null
    }
    const hit = Array.isArray(data) ? data[0] : null
    if (!hit) return null
    const lat = parseFloat(hit.lat)
    const lng = parseFloat(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
}

/** Parse a US address string into `{ street, city, state, zip }` when the
 *  shape matches "street, city, ST [zip][, country]". Returns null when
 *  the address doesn't follow that convention (the caller falls back to
 *  comma-trim variants). Strips trailing country tokens so the regex
 *  doesn't have to handle them. */
function parseUsAddress(raw) {
    const text = String(raw || '')
        .trim()
        .replace(/,\s*$/, '')
    if (!text) return null
    // eslint-disable-next-line security/detect-unsafe-regex
    const stripped = text.replace(/,\s*(United States(?:\s+of\s+America)?|USA|U\.S\.A?\.?)\s*$/i, '').trim()
    // "street, city, ST 12345" or "street, city, ST"
    // eslint-disable-next-line security/detect-unsafe-regex
    const m = stripped.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\s*$/i)
    if (m && US_STATE_CODES.has(m[3].toUpperCase())) {
        return {
            city: m[2].trim(),
            state: m[3].toUpperCase(),
            street: m[1].trim(),
            zip: (m[4] || '').trim()
        }
    }
    return null
}

/** Produce progressive-trim fallbacks for a single-string address by
 *  shedding trailing comma-parts. Used as a generic fallback when the
 *  structured parser doesn't match. */
function trimmedAddressVariants(address) {
    const cleaned = String(address || '')
        .trim()
        .replace(/,\s*$/, '')
    if (!cleaned) return []
    const parts = cleaned
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    const out = []
    for (let i = parts.length; i >= 1; i--) {
        out.push(parts.slice(0, i).join(', '))
    }
    return out
}

/** Build the fallback query variants for a single (address, city, state)
 *  tuple. Strategy:
 *
 *    • Self-sufficient addresses (already carry a state code or name) —
 *      try verbatim, then a structured ladder that always preserves the
 *      parsed state so we never drift across state lines just because
 *      Nominatim doesn't know a specific rural street. The very last
 *      shot is `City, ST` which is guaranteed to resolve for any real
 *      US city — better to plot the plant at city centre than not at
 *      all. (This is the fix for plant 455 in Huntsville, TX whose
 *      street isn't well-indexed in OSM.)
 *
 *    • Bare addresses — try the cleanest variants first (no hint) and
 *      only append the state hint as a fallback when the literal
 *      address didn't resolve. */
function buildFallbackQueries(address, city, state) {
    const selfSufficient = addressHasState(address, city)
    const variants = []
    if (selfSufficient) {
        const parsed = parseUsAddress(address)
        // 1. Verbatim — best-case full match.
        variants.push(buildQuery(address, city))
        // 2. Trim variants — drops "United States", then zip+state, then city.
        variants.push(...trimmedAddressVariants(address))
        if (parsed) {
            // 3. Structured re-assembly with state preserved at every step.
            variants.push(`${parsed.street}, ${parsed.city}, ${parsed.state}`)
            variants.push(`${parsed.street}, ${parsed.state}`)
            // 4. City + state — the city-centre fallback. Almost never
            //    misses for a real US city, and keeps the plant on the
            //    correct map even when its street isn't in OSM.
            variants.push(`${parsed.city}, ${parsed.state}`)
        }
        variants.push(buildQuery(address))
    } else {
        variants.push(
            buildQuery(address, city),
            buildQuery(address),
            buildQuery(address, city, state),
            buildQuery(address, state),
            buildQuery(city, state),
            buildQuery(city)
        )
    }
    const seen = new Set()
    const out = []
    for (const v of variants) {
        if (!v || seen.has(v)) continue
        seen.add(v)
        out.push(v)
    }
    return out
}

/**
 * Geocode an address. Returns `{ lat, lng } | null`. Each fallback
 * variant is cached independently against its own query string so we
 * never blanket-stamp the looser variants with a (potentially-wrong)
 * result from a more specific one. Optionally accepts a `validate`
 * predicate so the caller can reject geographically implausible
 * matches and fall through to the next variant — used by the Plan map
 * to drop "Memphis → Memphis, NY" misfires that fall outside a plant's
 * realistic delivery radius.
 *
 * @param {string} address — street address (may be empty)
 * @param {string} [city]  — city
 * @param {string} [state] — state / region context, e.g. "Tennessee"
 * @param {object} [opts]
 * @param {(coords: {lat:number,lng:number}) => boolean} [opts.validate]
 *   Returns true if the geocoded position is acceptable. When falsey,
 *   the variant is skipped and the next fallback is tried. The
 *   validator is NOT cached — different callers can apply different
 *   policies against the same cached coords.
 */
export function geocodeAddress(address, city, state, { validate } = {}) {
    const variants = buildFallbackQueries(address, city, state)
    if (variants.length === 0) return Promise.resolve(null)
    const cache = loadCache()
    const acceptable = (c) => !validate || validate(c)

    // Synchronous walk: return the first cached, acceptable hit.
    for (const variant of variants) {
        const entry = cache[variant]
        if (entry?.coords && acceptable(entry.coords)) return Promise.resolve(entry.coords)
    }

    // If every variant is either (a) cached-but-rejected by the
    // validator or (b) a fresh-miss, there's nothing left to try.
    const needsFetch = variants.some((v) => {
        const e = cache[v]
        if (e?.coords) return false // cached → already considered above
        if (isFreshMiss(e)) return false
        return true
    })
    if (!needsFetch) return Promise.resolve(null)

    const task = queueTail.then(async () => {
        for (const variant of variants) {
            const entry = cache[variant]
            // Cached + acceptable → return (re-check after wait).
            if (entry?.coords && acceptable(entry.coords)) return entry.coords
            // Cached + unacceptable → skip without refetching (the data
            // hasn't changed; trying again would just rate-burn).
            if (entry?.coords) continue
            // Fresh miss → skip; TTL will re-open it later.
            if (isFreshMiss(entry)) continue
            // Need to fetch.
            const wait = MIN_INTERVAL_MS - (Date.now() - lastFetchAt)
            if (wait > 0) await new Promise((r) => setTimeout(r, wait))
            lastFetchAt = Date.now()
            let result = null
            try {
                result = await geocodeRaw(variant)
            } catch {
                result = null
            }
            if (result) {
                cache[variant] = { coords: result, ts: Date.now() }
                persistCache()
                if (acceptable(result)) return result
                // Caller's validator rejected — fall through to the
                // next variant. The cache entry remains so subsequent
                // identical calls short-circuit without re-fetching.
                continue
            }
            cache[variant] = { coords: null, ts: Date.now() }
            persistCache()
        }
        return null
    })

    queueTail = task.then(
        () => undefined,
        () => undefined
    )
    return task
}

/** Returns the cached coords for an address without firing a network
 *  request, honouring the same validator semantics as `geocodeAddress`.
 *  `null` covers not-yet-tried, fresh-miss, and cached-but-rejected. */
export function getCachedGeocode(address, city, state, { validate } = {}) {
    const variants = buildFallbackQueries(address, city, state)
    if (variants.length === 0) return null
    const cache = loadCache()
    const acceptable = (c) => !validate || validate(c)
    for (const variant of variants) {
        const entry = cache[variant]
        if (entry?.coords && acceptable(entry.coords)) return entry.coords
    }
    return null
}
