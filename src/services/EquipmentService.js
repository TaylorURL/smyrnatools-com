import { Equipment } from '../app/models/equipment/Equipment'
import { EquipmentComment } from '../app/models/equipment/EquipmentComment'
import { EquipmentHistory } from '../app/models/equipment/EquipmentHistory'
import VerifiedUtility from '../utils/VerifiedUtility'
import BaseAssetService from './BaseAssetService'

const SERVICE_PREFIX = '/equipment-service'

/** Attaches a lazy isVerified() method using current row state. */
function attachIsVerified(equipment) {
    if (!equipment) return equipment
    if (typeof equipment.isVerified !== 'function') {
        equipment.isVerified = function () {
            return VerifiedUtility.isVerified(this.updatedLast, this.updatedAt, this.updatedBy)
        }
    }
    return equipment
}

const baseService = new BaseAssetService({
    commentModelFn: EquipmentComment.fromRow,
    commentsTable: 'heavy_equipment_comments',
    enrichFn: attachIsVerified,
    entityIdParam: 'equipmentId',
    entityKey: 'equipment',
    entityName: 'Equipment',
    historyTable: 'heavy_equipment_history',
    idColumn: 'equipment_id',
    issuesTable: 'heavy_equipment_maintenance',
    parseHistoryRow: EquipmentHistory.fromApiFormat,
    parseRow: (row) => (row ? new Equipment(row) : null),
    servicePrefix: SERVICE_PREFIX
})

/** Heavy equipment CRUD, history, comments, issues, and verification service. */
class EquipmentServiceImpl {
    static fetchAllCommentsCounts(equipmentIds) {
        return baseService.fetchAllCommentsCounts(equipmentIds)
    }
    static fetchAllIssuesCounts(equipmentIds) {
        return baseService.fetchAllIssuesCounts(equipmentIds)
    }
    static getAllEquipments() {
        return baseService.getAll()
    }
    static fetchEquipmentById(id) {
        return baseService.fetchById(id)
    }
    static getEquipmentHistory(equipmentId, limit = null) {
        return baseService.getHistory(equipmentId, limit)
    }
    static createEquipment(equipment, userId) {
        return baseService.create(equipment, userId)
    }
    static updateEquipment(equipmentId, equipment, userId) {
        return baseService.update(equipmentId, equipment, userId)
    }
    static deleteEquipment(id) {
        return baseService.delete(id)
    }
    static createHistoryEntry(equipmentId, fieldName, oldValue, newValue, changedBy) {
        return baseService.createHistoryEntry(equipmentId, fieldName, oldValue, newValue, changedBy)
    }
    static fetchComments(equipmentId) {
        return baseService.fetchComments(equipmentId)
    }
    static addComment(equipmentId, text, author) {
        return baseService.addComment(equipmentId, text, author)
    }
    static deleteComment(commentId) {
        return baseService.deleteComment(commentId)
    }
    static fetchIssues(equipmentId) {
        return baseService.fetchIssues(equipmentId)
    }
    static addIssue(equipmentId, issueText, severity, createdBy = null) {
        return baseService.addIssue(equipmentId, issueText, severity, createdBy)
    }
    static deleteIssue(issueId) {
        return baseService.deleteIssue(issueId)
    }
    static completeIssue(issueId) {
        return baseService.completeIssue(issueId)
    }
    static fetchEquipmentsWithDetails(regionCodes = null) {
        return baseService.fetchWithDetails(regionCodes)
    }
    static verifyEquipment(equipmentId, userId) {
        return baseService.verify(equipmentId, userId)
    }
}

export const EquipmentService = EquipmentServiceImpl
