/**
 * Free address-to-coordinate geocoder backed by Nominatim (OpenStreetMap).
 *
 * The project doesn't provision a Google Maps API key, so live driving-time
 * lookups via `TrafficService` are permanently disabled. The Book An Order
 * recommender still needs a real distance signal to identify the closest
 * plant — ZIP-prefix and token-overlap heuristics put every same-metro plant
 * into a single tie that the composite tiebreaker can resolve incorrectly,
 * surfacing far-but-quieter plants ahead of close-but-busy ones.
 *
 * This service caches results in `localStorage` so each address only hits
 * the network once. Plant addresses are stable, so after one warm-up the
 * recommender runs entirely from cache. Failed lookups are remembered too
 * (with a short TTL) so a typo doesn't retry on every keystroke.
 *
 * Nominatim usage policy: max 1 req/sec, no bulk geocoding. We serialise
 * requests through a promise chain with a 1.1s spacer to stay compliant.
 */

const STORAGE_KEY = 'geocode:cache:v1'
const SUCCESS_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
const FAILURE_TTL_MS = 60 * 60 * 1000 // 1 hour
const REQUEST_SPACING_MS = 1100
const REQUEST_TIMEOUT_MS = 8000

const normalizeAddress = (address) => {
    if (!address) return ''
    return String(address).trim().replace(/\s+/g, ' ').toLowerCase()
}

const isExpired = (entry) => {
    if (!entry?.ts) return true
    const ttl = entry.coord ? SUCCESS_TTL_MS : FAILURE_TTL_MS
    return Date.now() - entry.ts > ttl
}

class GeocodeServiceImpl {
    constructor() {
        this._cache = this._loadCache()
        this._queue = Promise.resolve()
        this._saveTimer = null
        /** Wall-clock timestamp of the most recent Nominatim request fired
         *  by either `geocode` or `search`. Both code paths read it to
         *  honor the 1 req/sec policy without serialising every keystroke
         *  through a single promise chain. */
        this._lastRequestAt = 0
    }

    /** Sleep just long enough that the next request lands at least
     *  `REQUEST_SPACING_MS` after the last one fired. Returns immediately
     *  when the spacer window is already clear. */
    async _waitForRateLimit() {
        const sinceLast = Date.now() - this._lastRequestAt
        if (sinceLast < REQUEST_SPACING_MS) {
            await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS - sinceLast))
        }
        this._lastRequestAt = Date.now()
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

    /** Resolve `address` to `{ lat, lng }` or `null` when no hit / network
     *  failure. Cached forever on success, briefly on failure. */
    async geocode(address) {
        const key = normalizeAddress(address)
        if (!key) return null

        const cached = this._cache[key]
        if (cached && !isExpired(cached)) return cached.coord || null

        const result = this._queue.then(async () => {
            const fresh = this._cache[key]
            if (fresh && !isExpired(fresh)) return fresh.coord || null
            await this._waitForRateLimit()
            const coord = await this._fetchCoord(address)
            this._cache[key] = { coord, ts: Date.now() }
            this._saveCache()
            return coord
        })
        this._queue = result.catch(() => {})
        return result
    }

    async _fetchCoord(address) {
        const hits = await this._fetchHits(address, 1)
        const hit = hits?.[0]
        if (!hit) return null
        const lat = parseFloat(hit.lat)
        const lng = parseFloat(hit.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return { lat, lng }
    }

    async _fetchHits(query, limit) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null
        try {
            /* `countrycodes=us` keeps Nominatim from returning a same-named
             * street in another country — without it "9814 Crystal Blvd,
             * Baytown TX" can resolve to a Crystal Blvd in Mexico and put
             * the job 1000+ miles from every plant. */
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&addressdetails=1&countrycodes=us&q=${encodeURIComponent(query)}`
            const response = await fetch(url, {
                headers: { Accept: 'application/json' },
                signal: controller?.signal
            })
            if (!response.ok) return []
            const data = await response.json()
            return Array.isArray(data) ? data : []
        } catch {
            return []
        } finally {
            if (timer) clearTimeout(timer)
        }
    }

    /** Multi-result lookup for the autocomplete dropdown. Bypasses the
     *  geocode cache (autocomplete queries are exploratory and short-lived
     *  — caching every prefix would balloon storage), but each accepted
     *  pick still pre-warms the canonical address into the geocode cache
     *  so the subsequent ranking call is a localStorage hit.
     *
     *  Searches do NOT chain onto the queued geocode promise — only the
     *  latest keystroke's results matter, and queueing every prefix behind
     *  the last would compound the spacer wait into a multi-second backlog
     *  (the dispatcher would see suggestions appear ~30s after they
     *  stopped typing). The shared `_waitForRateLimit` keeps both code
     *  paths inside Nominatim's 1 req/sec budget. */
    async search(query, { limit = 5 } = {}) {
        const trimmed = String(query || '').trim()
        if (trimmed.length < 4) return []
        await this._waitForRateLimit()
        const hits = await this._fetchHits(trimmed, limit)
        return hits
            .map((hit) => {
                const lat = parseFloat(hit?.lat)
                const lng = parseFloat(hit?.lon)
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
                return { coord: { lat, lng }, displayName: String(hit.display_name || '').trim() }
            })
            .filter(Boolean)
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
