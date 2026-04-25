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
 * Latching behavior: only the explicit `not_configured` signal (GOOGLE_MAPS_API_KEY
 * missing on the edge function) is treated as permanent — retrying that case
 * never helps. Transient failures (502, network errors, generic 503) are NOT
 * latched so callers like the JobMapModal origin-plant switcher can retry on
 * subsequent calls and actually get live data when conditions recover.
 */
class TrafficServiceImpl {
    constructor() {
        this._unavailable = false
    }

    /** Flag the service as unavailable so subsequent calls bail locally. */
    markUnavailable() {
        this._unavailable = true
    }

    /** Clear the latch so the next call retries the upstream service. */
    reset() {
        this._unavailable = false
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
                // Only the explicit `not_configured` payload is permanent
                // (API key missing). Other 503s and non-2xx responses can be
                // transient — let the caller retry on the next interaction.
                if (res.status === 503 && json?.error === 'not_configured') {
                    this._unavailable = true
                    return { error: 'not_configured' }
                }
                return { error: json?.error || 'lookup_failed', status: res.status }
            }
            return json
        } catch {
            return { error: 'network' }
        }
    }
}

export const TrafficService = new TrafficServiceImpl()
