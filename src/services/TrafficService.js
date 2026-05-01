/**
 * Live driving-time service — DISABLED.
 *
 * The Plan view originally proxied Google Distance Matrix lookups through a
 * `traffic-service` Supabase edge function so the schedule could show live
 * pour-pace data alongside dispatch estimates. The project decided not to
 * provision a `GOOGLE_MAPS_API_KEY`, so every call to that edge function
 * returns `503 not_configured`. Even with client-side latching, the first
 * probe of every session produced console noise and wasted a network round-
 * trip.
 *
 * This module now exposes the same public surface (`fetchDistance`,
 * `isUnavailable`, `markUnavailable`, `reset`) but never hits the network.
 * Every caller gets `{ error: 'not_configured' }` synchronously and falls
 * back to the dispatch report's `toJobTime` field, which is what they did
 * anyway in the latched-unavailable branch.
 *
 * If the project ever adopts a Maps key, swap this module back to the
 * networked version (see git history for the original implementation).
 */
class TrafficServiceImpl {
    isUnavailable() {
        return true
    }

    markUnavailable() {
        // No-op — the service is hardcoded unavailable.
    }

    reset() {
        // No-op — there's nothing to retry. Kept so existing callers
        // (`JobMapModal`'s origin-plant switcher) don't break.
    }

    /**
     * Returns the same shape the networked version returned on a permanent
     * failure, so consumers' fallback branches handle it without changes.
     */
    async fetchDistance() {
        return { error: 'not_configured' }
    }
}

export const TrafficService = new TrafficServiceImpl()
