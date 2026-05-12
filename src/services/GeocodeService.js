import { APIUtility } from '../utils/APIUtility'

/**
 * Multi-provider US address geocoder used by the "Find a Spot" booking
 * assistant in PlanView. The project doesn't provision a paid maps API
 * key, so we chain three free providers to maximise hit rate on the
 * messy addresses dispatchers paste from texts and emails:
 *
 *   1. US Census Geocoder — parcel-level accuracy for ANY US address,
 *      the gold standard for residential/rural coverage. The Census
 *      endpoint doesn't send CORS headers, so we proxy it through the
 *      `geocode-service/census` edge function. Free, no key.
 *   2. Photon (komoot) — Elasticsearch-backed OSM with strong fuzzy
 *      matching and typeahead-quality suggestions. Free, no key, CORS
 *      enabled — hit directly from the browser.
 *   3. Nominatim — the original OSM geocoder, kept as a last resort
 *      because it uniquely handles plus codes ("PF4Q+QW Huntsville").
 *      Hit directly from the browser.
 *
 * Each provider is tried in turn with progressively-trimmed variants of
 * the input (full → strip apt/unit/suite → strip ZIP) so a query that
 * fails on the exact string can still resolve once the noise is gone.
 * First hit wins.
 *
 * Results are cached in `localStorage` (90 days for hits, 1 hour for
 * misses) so plant addresses geocode once and the booking flow stays
 * snappy after warm-up. Per-host request spacing keeps every provider
 * inside its usage policy without making the user feel any of it.
 */

const STORAGE_KEY = 'geocode:cache:v2'
const SUCCESS_TTL_MS = 90 * 24 * 60 * 60 * 1000
const FAILURE_TTL_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000

// Per-host minimum interval between requests. Photon and Nominatim both
// publish a 1 req/sec limit. Census is proxied through an edge function,
// so spacing for it is handled server-side (and the proxy can short-
// circuit duplicate requests if it ever becomes worth caching there).
const HOST_SPACING_MS = {
    'nominatim.openstreetmap.org': 1100,
    'photon.komoot.io': 1100
}

// Approximate centre of Texas — used as a proximity bias hint for Photon
// so an ambiguous "Memphis" prefers Memphis TX (if it existed) over
// Memphis TN. Real disambiguation still requires a state in the query.
const TX_BIAS_LAT = 31.0
const TX_BIAS_LON = -100.0

const normalizeAddress = (address) => {
    if (!address) return ''
    return String(address).trim().replace(/\s+/g, ' ').toLowerCase()
}

const isExpired = (entry) => {
    if (!entry?.ts) return true
    const ttl = entry.coord ? SUCCESS_TTL_MS : FAILURE_TTL_MS
    return Date.now() - entry.ts > ttl
}

// Pulls "Apt 4", "Unit B", "Suite 200", "#3", "Floor 2" out of an
// address. Some geocoders choke on the secondary unit; the parcel
// itself is what we need a coord for.
// Bounded alternation + bounded \b-anchored suffix — no nested quantifiers
// so there's no catastrophic-backtracking exposure here.
// eslint-disable-next-line security/detect-unsafe-regex
const SECONDARY_UNIT_RE = /,?\s*(apt|apartment|unit|ste|suite|fl|floor|rm|room|#)\s*[A-Za-z0-9-]+\b/gi

// Five digits with an optional ZIP+4 — no unbounded quantifiers.
// eslint-disable-next-line security/detect-unsafe-regex
const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/

/** Generate progressively-trimmed variants of an address. We try each
 *  in order against each provider — many addresses fail with the unit
 *  suffix and resolve cleanly without it, or fail with a ZIP that
 *  doesn't cover the parcel and resolve once the ZIP is gone. */
function buildAddressVariants(address) {
    const raw = String(address || '')
        .trim()
        .replace(/\s+/g, ' ')
    if (!raw) return []
    const variants = [raw]
    const noUnit = raw.replace(SECONDARY_UNIT_RE, '').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim()
    if (noUnit && noUnit !== raw) variants.push(noUnit)
    const noZip = noUnit.replace(ZIP_RE, '').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim()
    if (noZip && noZip !== noUnit) variants.push(noZip)
    // De-dupe while preserving order so cheaper variants run first.
    return Array.from(new Set(variants))
}

const lastRequestAtByHost = new Map()

async function waitForHost(host) {
    const spacing = HOST_SPACING_MS[host] || 0
    if (!spacing) return
    const last = lastRequestAtByHost.get(host) || 0
    const sinceLast = Date.now() - last
    if (sinceLast < spacing) {
        await new Promise((resolve) => setTimeout(resolve, spacing - sinceLast))
    }
    lastRequestAtByHost.set(host, Date.now())
}

async function fetchWithTimeout(url, options = {}) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null
    try {
        return await fetch(url, { ...options, signal: controller?.signal })
    } finally {
        if (timer) clearTimeout(timer)
    }
}

/** Normalised hit shape returned by every provider. */
function buildHit(displayName, lat, lng, source) {
    const numLat = Number(lat)
    const numLng = Number(lng)
    if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return null
    const name = String(displayName || '').trim()
    if (!name) return null
    return { coord: { lat: numLat, lng: numLng }, displayName: name, source }
}

// ============================================================
// Provider: US Census Geocoder (via edge function proxy)
// Census doesn't send CORS headers, so direct browser fetches are
// blocked. `geocode-service/census` is a thin server-side proxy that
// adds CORS to the upstream response and normalises the payload into
// the same `{ matches: [{ displayName, lat, lng }] }` shape every
// provider returns. Per-host spacing isn't applied here because the
// proxy and the upstream sit on different hosts; if Census ever rate-
// limits us, the edge function will surface the failure as a non-2xx
// and we fall through to Photon / Nominatim cleanly.
// ============================================================
async function censusFetch(query, limit) {
    try {
        const { json, res } = await APIUtility.post('/geocode-service/census', { limit, query })
        if (!res?.ok) {
            console.warn(`[GeocodeService] Census proxy returned ${res?.status} for "${query}":`, json?.error)
            return []
        }
        const matches = Array.isArray(json?.matches) ? json.matches : []
        return matches
            .slice(0, limit)
            .map((m) => buildHit(m?.displayName, m?.lat, m?.lng, 'census'))
            .filter(Boolean)
    } catch (error) {
        console.warn(`[GeocodeService] Census proxy fetch failed for "${query}":`, error)
        return []
    }
}

// ============================================================
// Provider: Photon (komoot)
// ============================================================
async function photonFetch(query, limit) {
    const host = 'photon.komoot.io'
    await waitForHost(host)
    const url =
        `https://${host}/api?q=${encodeURIComponent(query)}` +
        `&limit=${limit}&lang=en` +
        `&lat=${TX_BIAS_LAT}&lon=${TX_BIAS_LON}&location_bias_scale=0.3`
    try {
        const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
        if (!response.ok) {
            console.warn(`[GeocodeService] Photon returned ${response.status} for "${query}"`)
            return []
        }
        const data = await response.json()
        const features = Array.isArray(data?.features) ? data.features : []
        return features
            .filter((f) => (f?.properties?.countrycode || '').toUpperCase() === 'US')
            .slice(0, limit)
            .map((feature) => {
                const [lng, lat] = feature?.geometry?.coordinates || []
                const props = feature?.properties || {}
                const parts = [props.name, props.street, props.housenumber, props.city, props.state, props.postcode]
                    .filter(Boolean)
                    .join(', ')
                return buildHit(parts || props.name || query, lat, lng, 'photon')
            })
            .filter(Boolean)
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.warn(`[GeocodeService] Photon fetch failed for "${query}":`, error)
        }
        return []
    }
}

// ============================================================
// Provider: Nominatim (OpenStreetMap)
// ============================================================
async function nominatimFetch(query, limit) {
    const host = 'nominatim.openstreetmap.org'
    await waitForHost(host)
    /* `countrycodes=us` keeps Nominatim from returning a same-named
     * street in another country — without it "9814 Crystal Blvd,
     * Baytown TX" can resolve to a Crystal Blvd in Mexico. */
    const url =
        `https://${host}/search?format=json&limit=${limit}` +
        `&addressdetails=1&countrycodes=us&q=${encodeURIComponent(query)}`
    try {
        const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
        if (!response.ok) {
            console.warn(`[GeocodeService] Nominatim returned ${response.status} for "${query}"`)
            return []
        }
        const data = await response.json()
        const arr = Array.isArray(data) ? data : []
        return arr
            .slice(0, limit)
            .map((hit) => buildHit(hit?.display_name, hit?.lat, hit?.lon, 'nominatim'))
            .filter(Boolean)
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.warn(`[GeocodeService] Nominatim fetch failed for "${query}":`, error)
        }
        return []
    }
}

/** Provider chains tuned for two access patterns:
 *   - `GEOCODE_PROVIDERS` for resolving a final, committed address to
 *     coords (parcel accuracy first → fuzzier providers as fallbacks).
 *   - `SEARCH_PROVIDERS` for autocomplete typeahead (Photon ranks
 *     partial matches better, so it leads). */
const GEOCODE_PROVIDERS = [censusFetch, photonFetch, nominatimFetch]
const SEARCH_PROVIDERS = [photonFetch, censusFetch]

class GeocodeServiceImpl {
    constructor() {
        this._cache = this._loadCache()
        this._saveTimer = null
        /** In-flight geocode promises keyed by normalised address. Lets
         *  two concurrent `geocode(same)` callers share one chain of
         *  provider calls instead of duplicating every variant attempt. */
        this._inFlight = new Map()
    }

    _loadCache() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            return raw ? JSON.parse(raw) : {}
        } catch {
            return {}
        }
    }

    /** Debounced cache write — keeps a burst of geocode resolves from
     *  thrashing localStorage. */
    _saveCache() {
        if (this._saveTimer) return
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this._cache))
            } catch {
                // Quota exceeded or storage disabled — fail silently.
            }
        }, 250)
    }

    /** Resolve `address` to `{ lat, lng }` or `null`. Walks the geocode
     *  provider chain, trying each variant (full → drop unit → drop ZIP)
     *  against each provider. First hit wins. Cached for 90 days on
     *  success, 1 hour on miss. */
    async geocode(address) {
        const key = normalizeAddress(address)
        if (!key) return null

        const cached = this._cache[key]
        if (cached && !isExpired(cached)) return cached.coord || null

        if (this._inFlight.has(key)) return this._inFlight.get(key)

        const promise = this._geocodeUncached(address).then((coord) => {
            this._cache[key] = { coord, ts: Date.now() }
            this._saveCache()
            this._inFlight.delete(key)
            return coord
        })
        this._inFlight.set(key, promise)
        return promise
    }

    async _geocodeUncached(address) {
        const variants = buildAddressVariants(address)
        for (const provider of GEOCODE_PROVIDERS) {
            for (const variant of variants) {
                const hits = await provider(variant, 1)
                const hit = hits[0]
                if (hit) return hit.coord
            }
        }
        return null
    }

    /** Multi-result lookup for the autocomplete dropdown. Walks the
     *  search-provider chain (Photon first — its typeahead matches feel
     *  much closer to Google Places than Nominatim's), and stops as soon
     *  as a provider returns at least one hit. Returns up to `limit`
     *  results in display order.
     *
     *  Bypasses the geocode cache (autocomplete queries are exploratory
     *  and short-lived — caching every prefix would balloon storage).
     *  Each accepted pick still pre-warms the canonical address into the
     *  geocode cache so the subsequent ranking call is a localStorage
     *  hit. */
    async search(query, { limit = 5 } = {}) {
        const trimmed = String(query || '').trim()
        if (trimmed.length < 3) return []
        for (const provider of SEARCH_PROVIDERS) {
            const hits = await provider(trimmed, limit)
            if (hits.length > 0) {
                return hits.map(({ coord, displayName }) => ({ coord, displayName }))
            }
        }
        return []
    }

    /** Pre-warm the geocode cache with a known-good coord — used by the
     *  autocomplete picker so the dispatcher's selected suggestion doesn't
     *  re-geocode on the next submit. */
    primeCache(address, coord) {
        const key = normalizeAddress(address)
        if (!key || !coord || !Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) return
        this._cache[key] = { coord: { lat: coord.lat, lng: coord.lng }, ts: Date.now() }
        this._saveCache()
    }
}

export const GeocodeService = new GeocodeServiceImpl()
