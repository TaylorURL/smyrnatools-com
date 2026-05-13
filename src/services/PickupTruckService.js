import PickupTruck from '../app/models/pickup-trucks/PickupTruck'
import { PickupTruckComment } from '../app/models/pickup-trucks/PickupTruckComment'
import { PickupTruckHistory } from '../app/models/pickup-trucks/PickupTruckHistory'
import { apiPostOrThrow, getDuplicateFieldValues, requireUserId, resolveEntityId } from '../utils/BaseAssetUtility'
import { ValidationUtility } from '../utils/ValidationUtility'
import { createAssetService } from './BaseAssetService'

const SERVICE_PREFIX = '/pickup-truck-service'

const base = createAssetService({
    commentModelFn: PickupTruckComment.fromRow,
    commentsTable: 'pickup_trucks_comments',
    entityIdParam: 'pickupId',
    entityKey: 'pickup',
    entityName: 'Pickup Truck',
    historyTable: 'pickup_trucks_history',
    idColumn: 'truck_id',
    issuesTable: 'pickup_trucks_maintenance',
    parseHistoryRow: PickupTruckHistory.fromApiFormat,
    parseRow: (row) => (row ? PickupTruck.fromApiFormat(row) : null),
    servicePrefix: SERVICE_PREFIX
})

/** Pickup truck CRUD, comments, issues, history, and verification service. */
export const PickupTruckService = {
    ...base,
    create(pickup, userId) {
        return base._base.create(pickup, userId)
    },
    fetchAll(regionCodes = null) {
        return base._base.fetchWithDetails(regionCodes)
    },
    fetchHistory(pickupId, limit = null) {
        return base._base.getHistory(pickupId, limit)
    },
    getAll() {
        return base._base.getAll()
    },
    getById(id) {
        return base._base.fetchById(id)
    },

    getDuplicateAssigned(pickups) {
        return getDuplicateFieldValues(pickups, (p) => {
            const key = String(p.assigned || '')
                .trim()
                .toLowerCase()
            return key || null
        })
    },

    getDuplicateVINs(pickups) {
        return getDuplicateFieldValues(pickups, (p) => {
            const key = String(p.vin || '')
                .trim()
                .toUpperCase()
                .replace(/\s+/g, '')
            return key || null
        })
    },

    remove(id) {
        return base._base.delete(id)
    },

    /** Pickup-specific search by assigned-person name (not in the generic BaseAssetService API). */
    async searchByAssigned(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/search-by-assigned`,
            { query: query.trim() },
            'Failed to search pickup trucks by assignee'
        )
        return (json?.data ?? []).map(PickupTruck.fromApiFormat)
    },

    searchByVin(query) {
        return base._base.searchByVin(query)
    },

    update(id, pickup, userId) {
        return base._base.update(id, pickup, userId)
    },
    /**
     * Verifies via the `/update` endpoint with a fresh `updatedLast` timestamp
     * -- the pickup-truck service has no dedicated `/verify` route.
     */
    async verify(pickupId, userId) {
        const id = resolveEntityId(pickupId)
        ValidationUtility.requireUUID(id, 'Pickup Truck ID is required')
        const resolvedUserId = await requireUserId(userId)
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/update`,
            { id, pickup: { updatedLast: new Date().toISOString() }, userId: resolvedUserId },
            'Failed to verify pickup truck'
        )
        return PickupTruck.fromApiFormat(json?.data)
    }
}
