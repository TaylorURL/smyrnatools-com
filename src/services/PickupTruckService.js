import PickupTruck from '../app/models/pickup-trucks/PickupTruck'
import { apiPostOrThrow, getDuplicateFieldValues, requireUserId, resolveEntityId } from '../utils/BaseAssetUtility'
import { ValidationUtility } from '../utils/ValidationUtility'
import BaseAssetService from './BaseAssetService'

const SERVICE_PREFIX = '/pickup-truck-service'

const baseService = new BaseAssetService({
    commentsTable: 'pickup_trucks_comments',
    entityIdParam: 'pickupId',
    entityKey: 'pickup',
    entityName: 'Pickup Truck',
    historyTable: 'pickup_trucks_history',
    idColumn: 'truck_id',
    issuesTable: 'pickup_trucks_maintenance',
    parseRow: (row) => (row ? PickupTruck.fromApiFormat(row) : null),
    servicePrefix: SERVICE_PREFIX
})

/** Pickup truck CRUD, comments, issues, history, and verification service. */
class PickupTruckServiceImpl {
    static fetchAllCommentsCounts(pickupIds) {
        return baseService.fetchAllCommentsCounts(pickupIds)
    }
    static fetchAllIssuesCounts(pickupIds) {
        return baseService.fetchAllIssuesCounts(pickupIds)
    }
    static getAll() {
        return baseService.getAll()
    }
    static fetchAll(regionCodes = null) {
        return baseService.fetchWithDetails(regionCodes)
    }
    static getById(id) {
        return baseService.fetchById(id)
    }
    static create(pickup, userId) {
        return baseService.create(pickup, userId)
    }
    static update(id, pickup, userId) {
        return baseService.update(id, pickup, userId)
    }
    static remove(id) {
        return baseService.delete(id)
    }
    static searchByVin(query) {
        return baseService.searchByVin(query)
    }
    /** Pickup-specific search by assigned-person name (not in the generic BaseAssetService API). */
    static async searchByAssigned(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/search-by-assigned`,
            { query: query.trim() },
            'Failed to search pickup trucks by assignee'
        )
        return (json?.data ?? []).map(PickupTruck.fromApiFormat)
    }
    /**
     * Verifies via the `/update` endpoint with a fresh `updatedLast` timestamp
     * — the pickup-truck service has no dedicated `/verify` route.
     */
    static async verify(pickupId, userId) {
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
    static getDuplicateVINs(pickups) {
        return getDuplicateFieldValues(pickups, (p) => {
            const key = String(p.vin || '')
                .trim()
                .toUpperCase()
                .replace(/\s+/g, '')
            return key || null
        })
    }
    static getDuplicateAssigned(pickups) {
        return getDuplicateFieldValues(pickups, (p) => {
            const key = String(p.assigned || '')
                .trim()
                .toLowerCase()
            return key || null
        })
    }
    static fetchComments(pickupId) {
        return baseService.fetchComments(pickupId)
    }
    static addComment(pickupId, text, author) {
        return baseService.addComment(pickupId, text, author)
    }
    static deleteComment(commentId) {
        return baseService.deleteComment(commentId)
    }
    static fetchIssues(pickupId) {
        return baseService.fetchIssues(pickupId)
    }
    static completeIssue(issueId) {
        return baseService.completeIssue(issueId)
    }
    static addIssue(pickupId, issue, severity, createdBy = null) {
        return baseService.addIssue(pickupId, issue, severity, createdBy)
    }
    static deleteIssue(issueId) {
        return baseService.deleteIssue(issueId)
    }
    static fetchHistory(pickupId, limit = null) {
        return baseService.getHistory(pickupId, limit)
    }
}

export const PickupTruckService = PickupTruckServiceImpl
