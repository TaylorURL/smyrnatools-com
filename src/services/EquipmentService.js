import { Equipment } from '../app/models/equipment/Equipment'
import { EquipmentComment } from '../app/models/equipment/EquipmentComment'
import { EquipmentHistory } from '../app/models/equipment/EquipmentHistory'
import {
    apiPostOrThrow,
    apiPostRequireSuccess,
    fetchWithDetailsBase,
    normalizeSeverity,
    requireUserId,
    resolveEntityId
} from '../utils/BaseAssetUtility'
import { ValidationUtility } from '../utils/ValidationUtility'
import VerifiedUtility from '../utils/VerifiedUtility'
import BaseAssetService from './BaseAssetService'

const SERVICE_PREFIX = '/equipment-service'

const baseService = new BaseAssetService({
    commentModelFn: EquipmentComment.fromRow,
    commentsTable: 'heavy_equipment_comments',
    entityIdParam: 'equipmentId',
    entityName: 'Equipment',
    idColumn: 'equipment_id',
    issuesTable: 'heavy_equipment_maintenance',
    servicePrefix: SERVICE_PREFIX
})

/** Attaches a lazy isVerified() method to an equipment instance using VerifiedUtility logic. */
function attachIsVerified(equipment) {
    if (!equipment) return equipment
    if (typeof equipment.isVerified !== 'function') {
        equipment.isVerified = function () {
            return VerifiedUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy)
        }
    }
    return equipment
}
/**
 * Heavy equipment CRUD, history, comments, issues, and verification service.
 * Delegates shared asset operations to BaseAssetService.
 */
class EquipmentServiceImpl {
    /** Fetches comment counts for multiple equipment IDs in a single query. */
    static async fetchAllCommentsCounts(equipmentIds) {
        return baseService.fetchAllCommentsCounts(equipmentIds)
    }
    /** Fetches open issue counts for multiple equipment IDs in a single query. */
    static async fetchAllIssuesCounts(equipmentIds) {
        return baseService.fetchAllIssuesCounts(equipmentIds)
    }
    /** Fetches all equipment records. */
    static async getAllEquipments() {
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/fetch-all`, {}, 'Failed to fetch equipment')
        return (json?.data ?? []).map((row) => new Equipment(row))
    }
    /** Fetches equipment by ID with verification status attached. */
    static async fetchEquipmentById(id) {
        ValidationUtility.requireUUID(id, 'Invalid equipment ID')
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/fetch-by-id`, { id }, 'Failed to fetch equipment')
        return json?.data ? attachIsVerified(new Equipment(json.data)) : null
    }
    /** Fetches change history for a specific equipment, optionally limited. */
    static async getEquipmentHistory(equipmentId, limit = null) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        const payload = { equipmentId }
        if (limit && Number.isInteger(limit) && limit > 0) payload.limit = limit
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/fetch-history`,
            payload,
            'Failed to fetch equipment history'
        )
        return (json?.data ?? []).map((entry) => EquipmentHistory.fromApiFormat(entry))
    }
    /** Creates equipment with user ID resolution and ID cleanup. */
    static async createEquipment(equipment, userId) {
        const resolvedUserId = await requireUserId(userId, 'Authentication required')
        if (equipment.id) delete equipment.id
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/create`,
            { equipment, userId: resolvedUserId },
            'Failed to create equipment'
        )
        return json?.data ? new Equipment(json.data) : null
    }
    /**
     * Updates an equipment record and dispatches a notifications refresh
     * so verification status badges update across the UI.
     */
    static async updateEquipment(equipmentId, equipment, userId, _prevEquipmentState = null) {
        const id = resolveEntityId(equipmentId)
        ValidationUtility.requireUUID(id, 'Equipment ID is required')
        const resolvedUserId = await requireUserId(userId)
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/update`,
            { equipment, id, userId: resolvedUserId },
            'Failed to update equipment'
        )
        return json?.data ? new Equipment(json.data) : null
    }
    /** Soft-deletes an equipment record. */
    static async deleteEquipment(id) {
        ValidationUtility.requireUUID(id, 'Equipment ID is required')
        return apiPostRequireSuccess(`${SERVICE_PREFIX}/delete`, { id }, 'Failed to delete equipment')
    }
    /** Records a field-level change in the equipment history audit trail. */
    static async createHistoryEntry(equipmentId, fieldName, oldValue, newValue, changedBy) {
        return baseService.createHistoryEntry(equipmentId, fieldName, oldValue, newValue, changedBy)
    }
    /** Fetches all comments for a specific equipment record. */
    static async fetchComments(equipmentId) {
        return baseService.fetchComments(equipmentId)
    }
    /** Adds a text comment to an equipment record. */
    static async addComment(equipmentId, text, author) {
        return baseService.addComment(equipmentId, text, author)
    }
    /** Deletes a comment by its UUID. */
    static async deleteComment(commentId) {
        return baseService.deleteComment(commentId)
    }
    /** Fetches all open issues for a specific equipment record. */
    static async fetchIssues(equipmentId) {
        return baseService.fetchIssues(equipmentId)
    }
    /** Reports a new maintenance issue with severity classification. */
    static async addIssue(equipmentId, issueText, severity, createdBy = null) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        if (!issueText?.trim()) throw new Error('Issue description is required')
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/add-issue`,
            {
                equipmentId,
                issue: issueText.trim(),
                severity: normalizeSeverity(severity),
                userId: createdBy
            },
            'Failed to add issue'
        )
        return json?.data
    }
    /** Deletes an issue by its UUID. */
    static async deleteIssue(issueId) {
        return baseService.deleteIssue(issueId)
    }
    /** Marks an issue as completed/resolved. */
    static async completeIssue(issueId) {
        return baseService.completeIssue(issueId)
    }
    /**
     * Fetches all equipment with enriched details (comments count, issues count, status history).
     * Optionally filtered by region codes.
     */
    static async fetchEquipmentsWithDetails(regionCodes = null) {
        return fetchWithDetailsBase({
            fetchAllFn: () => this.getAllEquipments(),
            historyTableName: 'heavy_equipment_history',
            idColumnName: 'equipment_id',
            regionCodes
        })
    }
    /** Marks equipment as verified by the given user and refreshes notification badges. */
    static async verifyEquipment(equipmentId, userId) {
        ValidationUtility.requireUUID(equipmentId, 'Equipment ID is required')
        const resolvedUserId = await requireUserId(userId)
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/verify`,
            { id: equipmentId, userId: resolvedUserId },
            'Failed to verify equipment'
        )
        return attachIsVerified(new Equipment(json?.data))
    }
}
export const EquipmentService = EquipmentServiceImpl
