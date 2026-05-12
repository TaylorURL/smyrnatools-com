import Trailer from '../app/models/trailers/Trailer'
import BaseAssetService from './BaseAssetService'

const SERVICE_PREFIX = '/trailer-service'

/** Hydrates a trailer payload, accepting either a model instance or a plain object for update calls. */
const parseTrailer = (row) => (row ? Trailer.fromApiFormat(row) : null)

const baseService = new BaseAssetService({
    commentsTable: 'trailers_comments',
    entityIdParam: 'trailerId',
    entityKey: 'trailer',
    entityName: 'Trailer',
    historyTable: 'trailers_history',
    idColumn: 'trailer_id',
    issuesTable: 'trailers_maintenance',
    parseRow: parseTrailer,
    servicePrefix: SERVICE_PREFIX
})

/** Trailer CRUD, comments, issues, and history service. */
class TrailerServiceImpl {
    static addComment(trailerId, text, author) {
        return baseService.addComment(trailerId, text, author)
    }
    static addIssue(trailerId, issueText, severity, createdBy = null) {
        return baseService.addIssue(trailerId, issueText, severity, createdBy)
    }
    static completeIssue(issueId) {
        return baseService.completeIssue(issueId)
    }
    static createHistoryEntry(trailerId, fieldName, oldValue, newValue, changedBy) {
        return baseService.createHistoryEntry(trailerId, fieldName, oldValue, newValue, changedBy)
    }
    static async createTrailer(trailer, userId) {
        return baseService.create(trailer, userId)
    }
    static deleteComment(commentId) {
        return baseService.deleteComment(commentId)
    }
    static deleteIssue(issueId) {
        return baseService.deleteIssue(issueId)
    }
    static deleteTrailer(id) {
        return baseService.delete(id)
    }
    static fetchAllCommentsCounts(trailerIds) {
        return baseService.fetchAllCommentsCounts(trailerIds)
    }
    static fetchAllIssuesCounts(trailerIds) {
        return baseService.fetchAllIssuesCounts(trailerIds)
    }
    static fetchComments(trailerId) {
        return baseService.fetchComments(trailerId)
    }
    static fetchIssues(trailerId) {
        return baseService.fetchIssues(trailerId)
    }
    /** Fetches a single trailer by ID. Accepts string IDs or `{ id }` / `{ trailerId }` objects. */
    static fetchTrailerById(trailerId) {
        if (!trailerId) throw new Error('Trailer ID is required')
        const resolved = typeof trailerId === 'object' ? trailerId.id || trailerId.trailerId || '' : trailerId
        return baseService.fetchById(resolved)
    }
    static fetchTrailers() {
        return baseService.getAll()
    }
    static fetchTrailersWithDetails(regionCodes = null) {
        return baseService.fetchWithDetails(regionCodes)
    }
    static async getTrailerHistory(trailerId, limit = null) {
        const rows = await baseService.getHistory(trailerId, limit)
        return rows
    }
    /** Updates a trailer record. Coerces plain objects to Trailer instances for serialization. */
    static updateTrailer(trailerId, updatedTrailer, userId, _oldTrailer) {
        const trailer = updatedTrailer instanceof Trailer ? updatedTrailer : Trailer.ensureInstance(updatedTrailer)
        return baseService.update(trailerId, trailer, userId)
    }
}

export const TrailerService = TrailerServiceImpl
