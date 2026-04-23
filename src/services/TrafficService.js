import APIUtility from '../utils/APIUtility'

const SERVICE_PREFIX = 'traffic-service'

/**
 * Live driving-time service backed by `traffic-service` edge function (Google
 * Distance Matrix). Returns null on any failure so callers can fall back to
 * the dispatch estimate without crashing the UI.
 *
 * Response shape on success:
 *   { durationSeconds, durationInTrafficSeconds, distanceMeters, provider, cached }
 */
class TrafficServiceImpl {
    /** Look up live travel time between two free-text addresses. */
    async fetchDistance(origin, destination) {
        const o = String(origin || '').trim()
        const d = String(destination || '').trim()
        if (!o || !d) return null
        try {
            const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/distance`, {
                destination: d,
                origin: o
            })
            if (!res.ok) {
                if (res.status === 503 && json?.error === 'not_configured') {
                    return { error: 'not_configured' }
                }
                return { error: 'lookup_failed', status: res.status }
            }
            return json
        } catch {
            return { error: 'network' }
        }
    }
}

export const TrafficService = new TrafficServiceImpl()
