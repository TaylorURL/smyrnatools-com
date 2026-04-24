import APIUtility from '../utils/APIUtility'

const SERVICE_PREFIX = 'traffic-service'

/**
 * Live driving-time service backed by `traffic-service` edge function (Google
 * Distance Matrix). Returns null on any failure so callers can fall back to
 * the dispatch estimate without crashing the UI.
 *
 * Response shape on success:
 *   { durationSeconds, durationInTrafficSeconds, distanceMeters, provider, cached }
 *
 * Once the edge function reports `not_configured` (GOOGLE_MAPS_API_KEY not
 * set), or repeatedly 503s, we latch "unavailable" for the rest of the page
 * lifecycle so subsequent calls short-circuit without hitting the network.
 * Prevents the devtools console from filling with 503s every time the
 * schedule view re-renders.
 */
class TrafficServiceImpl {
    constructor() {
        this._unavailable = false
    }

    /** Flag the service as unavailable so subsequent calls bail locally. */
    markUnavailable() {
        this._unavailable = true
    }

    isUnavailable() {
        return this._unavailable
    }

    /** Look up live travel time between two free-text addresses. */
    async fetchDistance(origin, destination) {
        if (this._unavailable) return { error: 'not_configured' }
        const o = String(origin || '').trim()
        const d = String(destination || '').trim()
        if (!o || !d) return null
        try {
            const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/distance`, {
                destination: d,
                origin: o
            })
            if (!res.ok) {
                // 503s generally mean the edge function is misconfigured or
                // can't reach Google. Latch unavailable either way — the UI
                // already falls back to the dispatch report's travel times.
                if (res.status === 503) {
                    this._unavailable = true
                    return { error: json?.error || 'not_configured' }
                }
                return { error: 'lookup_failed', status: res.status }
            }
            return json
        } catch {
            this._unavailable = true
            return { error: 'network' }
        }
    }
}

export const TrafficService = new TrafficServiceImpl()
