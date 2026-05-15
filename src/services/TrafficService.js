/**
 * Live driving-time service — DISABLED.
 *
 * Might work on getting Google API key but not paying anymore for this project.
 *
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
