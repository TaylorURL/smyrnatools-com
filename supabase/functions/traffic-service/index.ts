// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'

/**
 * Live driving-time proxy backed by Google's Distance Matrix API.
 *
 * Frontend never sees the API key — calls hit `/traffic-service/distance`
 * with `{ origin, destination }` and get back `{ minutes, minutesInTraffic,
 * distanceMeters }`. Results are cached in `travel_time_cache` keyed by
 * (origin, destination, 15-minute departure bucket) so repeat opens within
 * the same window return instantly without billing the API again.
 *
 * Required env vars:
 *   GOOGLE_MAPS_API_KEY  — Distance Matrix–enabled Google Cloud key
 *   SUPABASE_URL         — auto-provided
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided
 */

const CACHE_TABLE = 'travel_time_cache'
const CACHE_BUCKET_MINUTES = 15
const SESSIONS_TABLE = 'users_sessions'
const SESSION_EXPIRY_DAYS = 7

function getAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
}

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

async function requireAuthenticated(req: Request, headers: any, body?: any): Promise<string | Response> {
    let userId = body?.__sessionUserId || req.headers.get('x-user-id') || null
    let sessionId = body?.__sessionId || req.headers.get('x-session-id') || null
    if (!userId || !sessionId) {
        try {
            const b = await req.clone().json()
            userId = userId || b?.__sessionUserId
            sessionId = sessionId || b?.__sessionId
        } catch {}
    }
    if (!userId || !sessionId) return errorResponse('Unauthorized', headers, 401)
    const admin = getAdminClient()
    const { data, error } = await admin
        .from(SESSIONS_TABLE)
        .select('id, last_active')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle()
    if (error || !data) return errorResponse('Unauthorized', headers, 401)
    if (data.last_active) {
        const lastActive = new Date(data.last_active)
        const expiry = new Date()
        expiry.setDate(expiry.getDate() - SESSION_EXPIRY_DAYS)
        if (lastActive < expiry) return errorResponse('Session expired', headers, 401)
    }
    admin
        .from(SESSIONS_TABLE)
        .update({ last_active: new Date().toISOString() })
        .eq('id', sessionId)
        .then(() => {})
        .catch(() => {})
    return userId
}

function bucketDeparture(): { iso: string; key: string } {
    const now = new Date()
    const minutes = now.getUTCMinutes()
    const bucketed = Math.floor(minutes / CACHE_BUCKET_MINUTES) * CACHE_BUCKET_MINUTES
    now.setUTCMinutes(bucketed, 0, 0)
    return { iso: now.toISOString(), key: now.toISOString().slice(0, 16) }
}

function cacheKey(origin: string, destination: string, bucket: string): string {
    return `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}|${bucket}`
}

async function fetchFromGoogle(origin: string, destination: string, apiKey: string): Promise<any> {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins', origin)
    url.searchParams.set('destinations', destination)
    url.searchParams.set('departure_time', 'now')
    url.searchParams.set('traffic_model', 'best_guess')
    url.searchParams.set('mode', 'driving')
    url.searchParams.set('units', 'imperial')
    url.searchParams.set('key', apiKey)
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Distance Matrix HTTP ${res.status}`)
    const json = await res.json()
    if (json?.status !== 'OK') throw new Error(`Distance Matrix status ${json?.status}: ${json?.error_message ?? ''}`)
    const element = json?.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') throw new Error(`Element status ${element?.status ?? 'missing'}`)
    return {
        durationSeconds: element.duration?.value ?? null,
        durationInTrafficSeconds: element.duration_in_traffic?.value ?? element.duration?.value ?? null,
        distanceMeters: element.distance?.value ?? null
    }
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()
        if (endpoint !== 'distance') return errorResponse('Unknown endpoint', headers, 404)

        const body = await parseBody(req)
        const auth = await requireAuthenticated(req, headers, body)
        if (auth instanceof Response) return auth

        const originAddr = String(body?.origin ?? '').trim()
        const destinationAddr = String(body?.destination ?? '').trim()
        if (!originAddr || !destinationAddr) {
            return errorResponse('origin and destination are required', headers, 400)
        }

        const { iso: bucketIso, key: bucketKey } = bucketDeparture()
        const key = cacheKey(originAddr, destinationAddr, bucketKey)
        const admin = getAdminClient()

        // Try cache first
        const cached = await admin
            .from(CACHE_TABLE)
            .select('duration_seconds, duration_in_traffic_seconds, distance_meters, fetched_at, provider')
            .eq('cache_key', key)
            .maybeSingle()
        if (cached?.data) {
            return jsonResponse(
                {
                    cached: true,
                    distanceMeters: cached.data.distance_meters,
                    durationInTrafficSeconds: cached.data.duration_in_traffic_seconds ?? cached.data.duration_seconds,
                    durationSeconds: cached.data.duration_seconds,
                    provider: cached.data.provider,
                    bucket: bucketIso
                },
                headers
            )
        }

        const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? ''
        if (!apiKey) {
            return jsonResponse(
                {
                    error: 'not_configured',
                    message: 'GOOGLE_MAPS_API_KEY is not set on the traffic-service edge function.'
                },
                headers,
                503
            )
        }

        let result
        try {
            result = await fetchFromGoogle(originAddr, destinationAddr, apiKey)
        } catch (err) {
            return errorResponse(
                `Provider lookup failed: ${err instanceof Error ? err.message : String(err)}`,
                headers,
                502
            )
        }

        // Best-effort cache write — failure here doesn't block the response.
        admin
            .from(CACHE_TABLE)
            .upsert({
                cache_key: key,
                origin: originAddr,
                destination: destinationAddr,
                departure_bucket: bucketIso,
                duration_seconds: result.durationSeconds,
                duration_in_traffic_seconds: result.durationInTrafficSeconds,
                distance_meters: result.distanceMeters,
                provider: 'google',
                fetched_at: new Date().toISOString()
            })
            .then(() => {})
            .catch(() => {})

        return jsonResponse(
            {
                cached: false,
                distanceMeters: result.distanceMeters,
                durationInTrafficSeconds: result.durationInTrafficSeconds,
                durationSeconds: result.durationSeconds,
                provider: 'google',
                bucket: bucketIso
            },
            headers
        )
    } catch (err) {
        return errorResponse(`Internal error: ${err instanceof Error ? err.message : String(err)}`, headers, 500)
    }
})
