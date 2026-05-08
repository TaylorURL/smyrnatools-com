/**
 * Driving-time lookup against OSRM's free public demo server. Replaces
 * the straight-line haversine estimate that previously drove plant
 * ranking — straight-line was confusing 75-mile hauls in the same
 * 3-digit ZIP region with 35-mile ones (Liberty → Baytown vs Liberty →
 * San Leon, both 775xx). OSRM returns real road-network minutes so the
 * recommender can rank plants on actual drive time.
 *
 * Key constraints:
 *  - The OSRM demo server is public, no API key, no signup. It is rate-
 *    limited (~1 req/sec) so we space requests out the same way the
 *    geocoder does.
 *  - Routes get cached in `localStorage` with a 30-day TTL — drive
 *    times between two stable points (plant address ↔ job address)
 *    don't change. Failures are remembered briefly so a flaky lookup
 *    doesn't retry on every booking.
 *  - When OSRM is unreachable / rate-limited / errors out, callers can
 *    fall back to the haversine estimate they already had. We surface
 *    that case by returning `null`.
 */

const STORAGE_KEY = 'routing:cache:v1'
const SUCCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000
const FAILURE_TTL_MS = 30 * 60 * 1000
const REQUEST_SPACING_MS = 1100
const REQUEST_TIMEOUT_MS = 8000
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving'
/** Coordinate precision used to build cache keys. 4 decimals ≈ 11 m at
 *  the equator — well below the resolution of plant or job addresses,
 *  so trivial GPS jitter doesn't cause cache misses. */
const COORD_PRECISION = 4

const roundCoord = (n) => Math.round(n * 10 ** COORD_PRECISION) / 10 ** COORD_PRECISION

const buildCacheKey = (from, to) => {
    const a = `${roundCoord(from.lat)},${roundCoord(from.lng)}`
    const b = `${roundCoord(to.lat)},${roundCoord(to.lng)}`
    return `${a}=>${b}`
}

const isExpired = (entry) => {
    if (!entry?.ts) return true
    const ttl = Number.isFinite(entry.minutes) ? SUCCESS_TTL_MS : FAILURE_TTL_MS
    return Date.now() - entry.ts > ttl
}

class RoutingServiceImpl {
    constructor() {
        this._cache = this._loadCache()
        this._saveTimer = null
        this._lastRequestAt = 0
    }

    _loadCache() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            return raw ? JSON.parse(raw) : {}
        } catch {
            return {}
        }
    }

    /** Debounced cache write — bursts of route resolves shouldn't thrash
     *  localStorage. */
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

    /** Sleep just long enough that the next OSRM request lands at least
     *  REQUEST_SPACING_MS after the last one fired. */
    async _waitForRateLimit() {
        const sinceLast = Date.now() - this._lastRequestAt
        if (sinceLast < REQUEST_SPACING_MS) {
            await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS - sinceLast))
        }
        this._lastRequestAt = Date.now()
    }

    /** Resolve `{from, to}` coords to estimated driving minutes. Returns
     *  the cached value when fresh; otherwise hits OSRM, caches the
     *  result, and returns it. Failures (network / non-2xx / parse
     *  error) cache `null` briefly so callers can fall back to a
     *  haversine estimate without re-trying on every render.
     *
     *  @param {{ lat: number, lng: number }} from
     *  @param {{ lat: number, lng: number }} to
     *  @returns {Promise<number | null>} driving minutes, or null on miss
     */
    async getDrivingMinutes(from, to) {
        if (!from || !to) return null
        const key = buildCacheKey(from, to)
        const cached = this._cache[key]
        if (cached && !isExpired(cached)) return cached.minutes ?? null

        await this._waitForRateLimit()

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null
        try {
            /* OSRM expects `lng,lat` (not `lat,lng`) and pairs separated
             * by a semicolon. `overview=false` skips the route geometry
             * payload — we only need the duration. */
            const url = `${OSRM_BASE_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false&steps=false`
            const response = await fetch(url, {
                headers: { Accept: 'application/json' },
                signal: controller?.signal
            })
            if (!response.ok) {
                this._cache[key] = { minutes: null, ts: Date.now() }
                this._saveCache()
                return null
            }
            const data = await response.json()
            const seconds = data?.routes?.[0]?.duration
            const minutes = Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null
            this._cache[key] = { minutes, ts: Date.now() }
            this._saveCache()
            return minutes
        } catch {
            this._cache[key] = { minutes: null, ts: Date.now() }
            this._saveCache()
            return null
        } finally {
            if (timer) clearTimeout(timer)
        }
    }
}

export const RoutingService = new RoutingServiceImpl()
