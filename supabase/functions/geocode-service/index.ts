// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'

// ============================================================================
// Geocoder proxy for the "Find a Spot" booking assistant. The US Census
// Geocoder is the gold standard for free, parcel-level US address coverage
// but it doesn't send any `Access-Control-Allow-Origin` headers, so the
// browser can't hit it directly. This function proxies the request server-
// side and returns a normalised, CORS-friendly response.
//
// Photon and Nominatim already support CORS, so the frontend calls them
// directly — only Census needs this proxy. Auth is intentionally light
// (no session check) because the upstream is a public-data government
// service and the proxy itself is a thin pass-through with no DB access.
//
// Endpoint:
//   POST /geocode-service/census
//   body: { query: string, limit?: number }
//   response: { matches: [{ displayName: string, lat: number, lng: number }] }
// ============================================================================

const CENSUS_BASE = 'https://geocoding.geo.census.gov/geocoder'
const REQUEST_TIMEOUT_MS = 8000
const MAX_LIMIT = 10

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        return await fetch(url, { ...init, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}

/** Convert Census's response into the flat shape the frontend expects.
 *  Census returns coordinates as `{x: lng, y: lat}` — we swap into the
 *  conventional `{lat, lng}` ordering so callers don't have to know. */
function normaliseCensusMatches(payload: any, limit: number) {
    const matches = Array.isArray(payload?.result?.addressMatches) ? payload.result.addressMatches : []
    return matches
        .slice(0, limit)
        .map((match: any) => {
            const displayName = String(match?.matchedAddress || '').trim()
            const lat = Number(match?.coordinates?.y)
            const lng = Number(match?.coordinates?.x)
            if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
            return { displayName, lat, lng }
        })
        .filter(Boolean)
}

async function censusGeocode(query: string, limit: number) {
    const url =
        `${CENSUS_BASE}/locations/onelineaddress` +
        `?address=${encodeURIComponent(query)}` +
        `&benchmark=Public_AR_Current&format=json`
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
        throw new Error(`Census returned ${response.status}`)
    }
    const data = await response.json()
    return normaliseCensusMatches(data, limit)
}

function clampLimit(raw: unknown): number {
    const num = Number(raw)
    if (!Number.isFinite(num)) return 1
    return Math.max(1, Math.min(MAX_LIMIT, Math.floor(num)))
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    if (req.method !== 'POST') return errorResponse('Method not allowed', headers, 405)

    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop() || ''
        const body = await parseBody(req)
        const query = typeof body?.query === 'string' ? body.query.trim() : ''
        if (!query) return errorResponse('Missing query', headers, 400)
        const limit = clampLimit(body?.limit)

        switch (endpoint) {
            case 'census': {
                const matches = await censusGeocode(query, limit)
                return jsonResponse({ matches }, headers)
            }
            default:
                return errorResponse(`Unknown endpoint: ${endpoint}`, headers, 404)
        }
    } catch (err: any) {
        return errorResponse(err?.message || 'Geocode proxy failed', headers, 502)
    }
})
