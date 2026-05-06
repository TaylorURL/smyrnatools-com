import APIUtility from '../utils/APIUtility'

const SERVICE_PREFIX = 'call-list-service'

/**
 * Client wrapper for the call-list-service edge function. Backs the
 * Plan -> Call List tab where dispatchers cold-call dormant customers.
 */
class CallListServiceImpl {
    /** Returns one row per dormant customer (poured in past year, but
     *  not in past 30 days) with their last contact, days-since-last-pour,
     *  and most recent call log summary. */
    async fetchRoster() {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/roster`)
        if (!res.ok) throw new Error(json?.error || 'Failed to load call list')
        return Array.isArray(json?.data) ? json.data : []
    }

    /** Full call/comment history for a single customer, newest first. */
    async fetchHistory(customerNum, limit = 50) {
        if (!customerNum) return []
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/history`, { customerNum, limit })
        if (!res.ok) throw new Error(json?.error || 'Failed to load history')
        return Array.isArray(json?.data) ? json.data : []
    }

    /** Records a new call entry. `outcome` must be one of
     *  no_answer | booked | not_interested | will_book_again | note. */
    async logCall({ customerNum, outcome, comment, customerName, contactName, phone }) {
        if (!customerNum) throw new Error('customerNum is required')
        if (!outcome) throw new Error('outcome is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/log-call`, {
            comment,
            contactName,
            customerName,
            customerNum,
            outcome,
            phone
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to save call')
        return json?.data ?? null
    }

    /** Removes an entry the caller authored. Other users' entries are not
     *  deletable from the client (server enforces created_by match). */
    async deleteLog(logId) {
        if (!logId) throw new Error('logId is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/delete-log`, { logId })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete entry')
        return true
    }
}

const CallListService = new CallListServiceImpl()
export default CallListService
