import APIUtility from '../utils/APIUtility'

const SERVICE_PREFIX = 'call-list-service'

/** Client wrapper for the CRM endpoints on the call-list-service edge function. */
class CrmServiceImpl {
    async fetchRoster({ scope = 'all', includeActive = false } = {}) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/roster`, { includeActive, scope })
        if (!res.ok) throw new Error(json?.error || 'Failed to load accounts')
        return Array.isArray(json?.data) ? json.data : []
    }

    async fetchAccount(accountId) {
        if (!accountId) throw new Error('accountId is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/account`, { accountId })
        if (!res.ok) throw new Error(json?.error || 'Failed to load account')
        return json?.data ?? null
    }

    async saveAccount({ id, name, lifecycleStage, tags, phone, notes, salesRepUserId }) {
        if (!name) throw new Error('name is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/save-account`, {
            id,
            lifecycleStage,
            name,
            notes,
            phone,
            salesRepUserId,
            tags
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to save account')
        return json?.data ?? null
    }

    async logInteraction({ accountId, interactionType, roleLens, outcome, comment, occurredAt }) {
        if (!accountId) throw new Error('accountId is required')
        if (!interactionType) throw new Error('interactionType is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/log-interaction`, {
            accountId,
            comment,
            interactionType,
            occurredAt,
            outcome,
            roleLens
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to log interaction')
        return json?.data ?? null
    }

    async fetchInteractions({ accountId, limit = 100 }) {
        if (!accountId) throw new Error('accountId is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/interactions`, { accountId, limit })
        if (!res.ok) throw new Error(json?.error || 'Failed to load interactions')
        return Array.isArray(json?.data) ? json.data : []
    }

    async fetchFollowups({ accountId, assignedTo, status, mineOnly } = {}) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/followups-list`, {
            accountId,
            assignedTo,
            mineOnly,
            status
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to load follow-ups')
        return Array.isArray(json?.data) ? json.data : []
    }

    async saveFollowup({
        id,
        accountId,
        title,
        details,
        dueAt,
        assignedTo,
        status,
        snoozeUntil,
        sourceInteractionId
    } = {}) {
        if (!title) throw new Error('title is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/save-followup`, {
            accountId,
            assignedTo,
            details,
            dueAt,
            id,
            snoozeUntil,
            sourceInteractionId,
            status,
            title
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to save follow-up')
        return json?.data ?? null
    }

    async completeFollowup(id) {
        if (!id) throw new Error('id is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/complete-followup`, { id })
        if (!res.ok) throw new Error(json?.error || 'Failed to complete follow-up')
        return json?.data ?? null
    }

    async fetchMyDesk() {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/my-desk`, {})
        if (!res.ok) throw new Error(json?.error || 'Failed to load desk')
        return json?.data ?? { accounts: [], followups: [], opportunities: [], recentActivity: [] }
    }

    async bulkAssignSalesReps(assignments) {
        if (!Array.isArray(assignments) || assignments.length === 0) {
            throw new Error('assignments must be a non-empty array')
        }
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/bulk-assign-sales-reps`, { assignments })
        if (!res.ok) throw new Error(json?.error || 'Failed to assign sales reps')
        return json?.data ?? { matched: 0, unmatched: [] }
    }

    async fetchOpportunities({ accountId, ownerUserId, openOnly } = {}) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/opportunities-list`, {
            accountId,
            openOnly,
            ownerUserId
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to load opportunities')
        return Array.isArray(json?.data) ? json.data : []
    }

    async saveOpportunity({ id, accountId, title, stage, ownerUserId, expectedClose, notes, lostReason, source } = {}) {
        if (!title) throw new Error('title is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/save-opportunity`, {
            accountId,
            expectedClose,
            id,
            lostReason,
            notes,
            ownerUserId,
            source,
            stage,
            title
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to save opportunity')
        return json?.data ?? null
    }

    async moveStage(id, stage, lostReason) {
        if (!id) throw new Error('id is required')
        if (!stage) throw new Error('stage is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/move-stage`, { id, lostReason, stage })
        if (!res.ok) throw new Error(json?.error || 'Failed to move stage')
        return json?.data ?? null
    }

    async deleteOpportunity(id) {
        if (!id) throw new Error('id is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/delete-opportunity`, { id })
        if (!res.ok) throw new Error(json?.error || 'Failed to delete opportunity')
        return true
    }

    /**
     * Geocode a batch of accounts whose lat/lng are null using the US Census geocoder.
     * @param {{ limit?: number }} [options]
     * @returns {Promise<{ geocoded: number, failed: number, remaining: number }>}
     */
    async geocodeAccounts({ limit = 15 } = {}) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/geocode-accounts`, { limit })
        if (!res.ok) throw new Error(json?.error || 'Failed to geocode accounts')
        return json?.data ?? { failed: 0, geocoded: 0, remaining: 0 }
    }

    /**
     * Save a field pin for the current user's location.
     * @param {{ lat: number, lng: number, comment?: string, accountId?: string, label?: string }} pin
     */
    async savePin({ lat, lng, comment, accountId, label } = {}) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error('lat and lng must be finite numbers')
        }
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/save-pin`, {
            accountId,
            comment,
            label,
            lat,
            lng
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to save pin')
        return json?.data ?? null
    }

    /**
     * Fetch field pins.
     * @param {{ mineOnly?: boolean, limit?: number }} [options]
     * @returns {Promise<Array>}
     */
    async fetchPins({ mineOnly = false, limit = 200 } = {}) {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/pins-list`, { limit, mineOnly })
        if (!res.ok) throw new Error(json?.error || 'Failed to load pins')
        return Array.isArray(json?.data) ? json.data : []
    }

    /**
     * Delete a pin by id.
     * @param {string} id
     */
    async deletePin(id) {
        if (!id) throw new Error('id is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/delete-pin`, { id })
        if (!res.ok) throw new Error(json?.error || 'Failed to delete pin')
        return true
    }
}

const CrmService = new CrmServiceImpl()
export default CrmService
