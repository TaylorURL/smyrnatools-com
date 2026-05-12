import { APIUtility } from '../utils/APIUtility'

/**
 * Audit-log writer / reader for the "Find a Spot" booking-assist tool.
 * Every recommendation the dispatcher sees gets a row in
 * `plan_book_order_logs` along with the full decision context that
 * produced it. Diagnosing a bad suggestion later means replaying the
 * stored inputs against the current algorithm.
 *
 * Both methods are best-effort: a failed write never blocks the booking
 * flow (the recommendation is already on screen by the time we log it),
 * and a failed read just shows an empty activity list. Errors surface
 * in the console for debugging but never to the dispatcher.
 */
export const BookOrderLogService = {
    async listRecent({ limit = 20 } = {}) {
        try {
            const { json, res } = await APIUtility.post('/book-order-log-service/list-recent', { limit })
            if (!res?.ok) {
                console.warn('[BookOrderLogService] list-recent failed:', res?.status, json?.error)
                return []
            }
            return Array.isArray(json?.logs) ? json.logs : []
        } catch (error) {
            console.warn('[BookOrderLogService] list-recent threw:', error)
            return []
        }
    },

    async logSuggestion(payload) {
        try {
            const { json, res } = await APIUtility.post('/book-order-log-service/log-suggestion', payload)
            if (!res?.ok) {
                console.warn('[BookOrderLogService] log-suggestion failed:', res?.status, json?.error)
                return null
            }
            // Truthy on any 2xx — server may or may not echo back an id, but
            // both indicate the row was written. Callers use truthiness to
            // distinguish success from the failure paths above.
            return json?.id ?? true
        } catch (error) {
            console.warn('[BookOrderLogService] log-suggestion threw:', error)
            return null
        }
    }
}
