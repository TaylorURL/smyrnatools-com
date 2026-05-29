import APIUtility from '../utils/APIUtility'

const SERVICE_PREFIX = 'call-list-service'

/**
 * Legacy roster/contacts/call-log wrapper for the CRM (sibling to CrmService which owns accounts/interactions/opportunities).
 */
class CrmRosterServiceImpl {
    /** Returns one row per customer with last contact, days-since-last-pour,
     *  and most recent call log summary. By default returns the dormant
     *  pool only (no pour in past 30 days); pass `includeActive: true` to
     *  include currently-pouring customers as well — used by the Directory
     *  tab. */
    async fetchRoster({ includeActive = false } = {}) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/roster`, { includeActive })
        if (!res.ok) throw new Error(json?.error || 'Failed to load call list')
        return Array.isArray(json?.data) ? json.data : []
    }

    /** All manually-curated contact rows for a single customer. Returns
     *  empty array if the customer has only auto-populated dispatch
     *  numbers and nobody has saved an override yet. */
    async fetchContacts(customerNum) {
        if (!customerNum) return []
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/contacts`, { customerNum })
        if (!res.ok) throw new Error(json?.error || 'Failed to load contacts')
        return Array.isArray(json?.data) ? json.data : []
    }

    /** Upsert a phone-number entry. `phoneDigits` is the join key (digits
     *  only); `phoneDisplay` is what the user typed/sees. Marking
     *  `isPrimary` clears the flag on any other row for the same customer. */
    async saveContact({
        contactName,
        customerNum,
        isHidden = false,
        isPrimary = false,
        label,
        notes,
        phoneDigits,
        phoneDisplay,
        source = 'manual'
    }) {
        if (!customerNum) throw new Error('customerNum is required')
        if (!phoneDigits && !phoneDisplay) throw new Error('phoneDigits or phoneDisplay is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/save-contact`, {
            contactName,
            customerNum,
            isHidden,
            isPrimary,
            label,
            notes,
            phoneDigits,
            phoneDisplay,
            source
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to save contact')
        return json?.data ?? null
    }

    /** Removes a phone number from the visible roster. Manual entries are
     *  hard-deleted; dispatch-sourced entries are soft-hidden so the
     *  dispatch HTML doesn't re-surface them on the next import. */
    async deleteContact({ customerNum, phoneDigits, phoneDisplay }) {
        if (!customerNum) throw new Error('customerNum is required')
        if (!phoneDigits && !phoneDisplay) throw new Error('phoneDigits is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/delete-contact`, {
            customerNum,
            phoneDigits,
            phoneDisplay
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to delete contact')
        return json
    }

    /** Full call/comment history for a single customer, newest first. */
    async fetchHistory(customerNum, limit = 50) {
        if (!customerNum) return []
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/history`, { customerNum, limit })
        if (!res.ok) throw new Error(json?.error || 'Failed to load history')
        return Array.isArray(json?.data) ? json.data : []
    }

    /** Per-user productivity rollup over the trailing `daysWindow` days.
     *  Returns one row per dispatcher with totals + per-outcome counts +
     *  unique customers reached. Backs the Call List → Leaderboard page. */
    async fetchLeaderboard({ daysWindow = 30 } = {}) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/leaderboard`, { daysWindow })
        if (!res.ok) throw new Error(json?.error || 'Failed to load leaderboard')
        return {
            daysWindow: Number.isInteger(json?.daysWindow) ? json.daysWindow : daysWindow,
            rows: Array.isArray(json?.data) ? json.data : []
        }
    }

    /** Latest N call entries across every customer + every user. Used by
     *  the Call List → Activity Feed sub-page so dispatchers can see who
     *  on the team called whom recently without opening each customer. */
    async fetchRecentActivity(limit = 200) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/recent-activity`, { limit })
        if (!res.ok) throw new Error(json?.error || 'Failed to load activity')
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

const CrmRosterService = new CrmRosterServiceImpl()
export default CrmRosterService
