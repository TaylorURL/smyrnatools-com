import { Tractor } from '../app/models/tractors/Tractor'
import { TractorComment } from '../app/models/tractors/TractorComment'
import { TractorHistory } from '../app/models/tractors/TractorHistory'
import CleanupUtility from '../utils/CleanupUtility'
import VerifiedUtility from '../utils/VerifiedUtility'
import BaseAssetService from './BaseAssetService'

const SERVICE_PREFIX = '/tractor-service'

/** Tractor history columns allowed in the audit trail; others are silently dropped. */
const ALLOWED_HISTORY_FIELDS = [
    'truck_number',
    'assigned_plant',
    'assigned_operator',
    'last_service_date',
    'cleanliness_rating',
    'has_blower',
    'vin',
    'make',
    'model',
    'year',
    'freight',
    'status',
    'hours'
]

/** Attaches isVerified() and normalizes VIN casing on a tractor instance. */
function enrichTractorWithVerification(tractor) {
    if (!tractor) return tractor
    tractor.vin = (tractor.vin || '').toUpperCase()
    tractor.isVerified = () => VerifiedUtility.isVerified(tractor.updatedLast, tractor.updatedAt, tractor.updatedBy)
    return tractor
}

const baseService = new BaseAssetService({
    allowedHistoryFields: ALLOWED_HISTORY_FIELDS,
    clearOperatorOnPlantChange: true,
    commentModelFn: TractorComment.fromRow,
    commentsTable: 'tractors_comments',
    enrichFn: enrichTractorWithVerification,
    entityIdParam: 'tractorId',
    entityKey: 'tractor',
    entityName: 'Tractor',
    historyTable: 'tractors_history',
    idColumn: 'tractor_id',
    issuesTable: 'tractors_maintenance',
    parseHistoryRow: TractorHistory.fromApiFormat,
    parseRow: Tractor.fromApiFormat,
    servicePrefix: SERVICE_PREFIX,
    uppercaseVin: true
})

/** Tractor CRUD, history, comments, issues, and verification service. */
export class TractorService {
    static getAllTractors() {
        return baseService.getAll()
    }
    static fetchTractors() {
        return this.getAllTractors()
    }
    static fetchTractorById(id) {
        return baseService.fetchById(id)
    }
    static getLatestHistoryDate(tractorId) {
        return baseService.getLatestHistoryDate(tractorId)
    }
    static getTractorHistory(tractorId, limit = null) {
        return baseService.getHistory(tractorId, limit)
    }
    static createTractor(tractor, userId) {
        return baseService.create(tractor, userId)
    }
    static updateTractor(tractorId, tractor, userId, prevTractorState = null) {
        return baseService.update(tractorId, tractor, userId, prevTractorState)
    }
    static verifyTractor(tractorId, userId) {
        return baseService.verify(tractorId, userId)
    }
    static deleteTractor(id) {
        return baseService.delete(id)
    }
    static createHistoryEntry(tractorId, fieldName, oldValue, newValue, changedBy) {
        return baseService.createHistoryEntry(tractorId, fieldName, oldValue, newValue, changedBy)
    }
    static getTractorsByOperator(operatorId) {
        return baseService.getByOperator(operatorId)
    }
    static searchTractorsByVin(query) {
        return baseService.searchByVin(query)
    }
    /** VIN search with enrichment + safe count defaults for downstream consumers. */
    static async searchTractorsByVinProcessed(query) {
        const rows = await this.searchTractorsByVin(query)
        return rows.map((t) => {
            t.isVerified = () => VerifiedUtility.isVerified(t.updatedLast, t.updatedAt, t.updatedBy)
            if (typeof t.openIssuesCount !== 'number') t.openIssuesCount = 0
            if (typeof t.commentsCount !== 'number') t.commentsCount = 0
            return t
        })
    }
    static fetchAllCommentsCounts(tractorIds) {
        return baseService.fetchAllCommentsCounts(tractorIds)
    }
    static fetchAllIssuesCounts(tractorIds) {
        return baseService.fetchAllIssuesCounts(tractorIds)
    }
    static fetchComments(tractorId) {
        return baseService.fetchComments(tractorId)
    }
    static addComment(tractorId, text, author) {
        return baseService.addComment(tractorId, text, author)
    }
    static deleteComment(commentId) {
        return baseService.deleteComment(commentId)
    }
    static fetchIssues(tractorId) {
        return baseService.fetchIssues(tractorId)
    }
    static addIssue(tractorId, issueText, severity, createdBy = null) {
        return baseService.addIssue(tractorId, issueText, severity, createdBy)
    }
    static deleteIssue(issueId) {
        return baseService.deleteIssue(issueId)
    }
    static completeIssue(issueId) {
        return baseService.completeIssue(issueId)
    }
    static fetchTractorsWithDetails(regionCodes = null) {
        return baseService.fetchWithDetails(regionCodes)
    }
    /** Batch-corrects null operator fields by setting affected tractors to Spare. */
    static cleanupNullOperators(tractors = null) {
        return CleanupUtility.cleanupNullOperators(
            tractors,
            (id, updates, userId) => this.updateTractor(id, updates, userId),
            () => this.getAllTractors()
        )
    }
}
