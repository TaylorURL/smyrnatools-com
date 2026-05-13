/**
 * Driving-route lookups via the public OSRM (Open Source Routing Machine)
 * demo server. Free, no API key, returns the real road geometry as a
 * GeoJSON LineString that Leaflet can render verbatim.
 *
 * We mirror the geocoder's contract here: a permanent localStorage cache
 * (positive + negative results) plus a serialised request queue with a
 * 1.1s minimum interval so the public demo server doesn't rate-limit us.
 * In practice, a single (plant, job) pair is only ever fetched once
 * per browser — every subsequent render reads from cache.
 */

interface LatLng {
    lat: number
    lng: number
}

interface RouteRawResult {
    coords: [number, number][]
    distance: number
    duration: number
}

interface DistanceTable {
    segs: number[]
    total: number
}

interface RouteResult extends RouteRawResult {
    distances: DistanceTable
}

type RouteCache = Record<string, RouteRawResult | null>

const CACHE_KEY = 'smyrnatools_route_cache_v1'
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'
const MIN_INTERVAL_MS = 1100

let cacheRef: RouteCache | null = null
let queueTail: Promise<unknown> = Promise.resolve()
let lastFetchAt = 0

function loadCache(): RouteCache {
    if (cacheRef) return cacheRef
    try {
        const raw = window?.localStorage?.getItem(CACHE_KEY)
        cacheRef = raw ? JSON.parse(raw) : {}
    } catch {
        cacheRef = {}
    }
    return cacheRef!
}

function persistCache(): void {
    try {
        window?.localStorage?.setItem(CACHE_KEY, JSON.stringify(cacheRef || {}))
    } catch {
        // out-of-space / unavailable — skip; we'll just refetch next time
    }
}

const round5 = (n: number): number => Math.round(n * 1e5) / 1e5
const keyFor = (a: LatLng, b: LatLng): string => `${round5(a.lat)},${round5(a.lng)}>${round5(b.lat)},${round5(b.lng)}`

/* ── Pure geometry helpers used by callers ─────────────────────────── */

/** Haversine distance in metres between two `[lat, lng]` tuples. */
export function metresBetween([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
    const R = 6371000
    const toRad = (d: number): number => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
}

/** Pre-computes the per-segment distance + cumulative distance array for
 *  a polyline so we can interpolate along it at constant ground speed. */
function buildDistanceTable(latlngs: [number, number][]): DistanceTable {
    const segs: number[] = []
    let total = 0
    for (let i = 0; i < latlngs.length - 1; i++) {
        const d = metresBetween(latlngs[i], latlngs[i + 1])
        segs.push(d)
        total += d
    }
    return { segs, total }
}

/* ── OSRM lookup ───────────────────────────────────────────────────── */

async function fetchRouteRaw(from: LatLng, to: LatLng): Promise<RouteRawResult | null> {
    const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`
    let res: Response
    try {
        res = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch {
        return null
    }
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    const coords = route?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    return {
        // GeoJSON is [lng, lat] — we flip to Leaflet's [lat, lng] for callers.
        coords: coords.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
        distance: Number(route.distance) || 0,
        duration: Number(route.duration) || 0
    }
}

/**
 * Returns the driving route for a plant->job pair as
 * `{ coords: [[lat,lng], ...], distance, duration, distances }`.
 * Cached results return synchronously; uncached ones queue behind the
 * rate limiter. Returns `null` if the route can't be fetched (offline,
 * OSRM down, bad coords, etc.) so the caller can fall back to a
 * straight-line render.
 */
export function getDrivingRoute(
    from: LatLng | null | undefined,
    to: LatLng | null | undefined
): Promise<RouteResult | null> {
    if (!from || !to) return Promise.resolve(null)
    if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng)) return Promise.resolve(null)
    if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng)) return Promise.resolve(null)

    const cache = loadCache()
    const key = keyFor(from, to)
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
        const cached = cache[key]
        if (!cached) return Promise.resolve(null)
        return Promise.resolve({ ...cached, distances: buildDistanceTable(cached.coords) })
    }

    const task = queueTail.then(async () => {
        if (Object.prototype.hasOwnProperty.call(cache, key)) {
            const cached = cache[key]
            return cached ? { ...cached, distances: buildDistanceTable(cached.coords) } : null
        }
        const wait = MIN_INTERVAL_MS - (Date.now() - lastFetchAt)
        if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait))
        lastFetchAt = Date.now()
        const result = await fetchRouteRaw(from, to)
        cache[key] = result
        persistCache()
        return result ? { ...result, distances: buildDistanceTable(result.coords) } : null
    })

    queueTail = task.then(
        () => undefined,
        () => undefined
    )
    return task
}

/** Read-only cached-route accessor — handy when an effect needs to know
 *  whether a route is already available without firing a network call. */
export function getCachedRoute(from: LatLng | null | undefined, to: LatLng | null | undefined): RouteResult | null {
    if (!from || !to) return null
    const cache = loadCache()
    const key = keyFor(from, to)
    if (!Object.prototype.hasOwnProperty.call(cache, key)) return null
    const cached = cache[key]
    return cached ? { ...cached, distances: buildDistanceTable(cached.coords) } : null
}
