import Trailer from '../app/models/trailers/Trailer'
import {
    apiPostOrThrow,
    apiPostRequireSuccess,
    fetchWithDetailsBase,
    normalizeSeverity,
    resolveEntityId
} from '../utils/BaseAssetUtility'
import { ValidationUtility } from '../utils/ValidationUtility'
import BaseAssetService from './BaseAssetService'

const SERVICE_PREFIX = '/trailer-service'

const baseService = new BaseAssetService({
    commentsTable: 'trailers_comments',
    entityIdParam: 'trailerId',
    entityName: 'Trailer',
    idColumn: 'trailer_id',
    issuesTable: 'trailers_maintenance',
    servicePrefix: SERVICE_PREFIX
})

/**
 * Trailer CRUD, comments, issues, and history service.
 * Delegates shared asset operations to BaseAssetService.
 */
class TrailerServiceImpl {
    /** Adds a text comment to a trailer record. */
    static async addComment(trailerId, commentText, userId) {
        return baseService.addComment(trailerId, commentText, userId)
    }
    /** Reports a new maintenance issue with severity classification. */
    static async addIssue(trailerId, issueText, severity, createdBy = null) {
        ValidationUtility.requireUUID(trailerId, `Invalid trailer ID format: ${trailerId}`)
        if (!issueText?.trim()) throw new Error('Issue description is required')
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/add-issue`,
            {
                issue: issueText.trim(),
                severity: normalizeSeverity(severity),
                trailerId,
                userId: createdBy
            },
            'Failed to add issue'
        )
        return json?.data ?? null
    }
    /** Marks an issue as completed/resolved. */
    static async completeIssue(issueId) {
        return baseService.completeIssue(issueId)
    }
    /** Records a field-level change in the trailer history audit trail. */
    static async createHistoryEntry(trailerId, fieldName, oldValue, newValue, changedBy) {
        return baseService.createHistoryEntry(trailerId, fieldName, oldValue, newValue, changedBy)
    }
    /** Creates a new trailer record. */
    static async createTrailer(trailer, userId) {
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/create`, { trailer, userId }, 'Failed to create trailer')
        return json?.data ? Trailer.fromApiFormat(json.data) : null
    }
    static async deleteComment(commentId) {
        return baseService.deleteComment(commentId)
    }
    static async deleteIssue(issueId) {
        return baseService.deleteIssue(issueId)
    }
    static async deleteTrailer(id) {
        ValidationUtility.requireUUID(id, `Invalid trailer ID format: ${id}`)
        return apiPostRequireSuccess(`${SERVICE_PREFIX}/delete`, { id }, 'Failed to delete trailer')
    }
    static async fetchAllCommentsCounts(trailerIds) {
        return baseService.fetchAllCommentsCounts(trailerIds)
    }
    static async fetchAllIssuesCounts(trailerIds) {
        return baseService.fetchAllIssuesCounts(trailerIds)
    }
    static async fetchComments(trailerId) {
        return baseService.fetchComments(trailerId)
    }
    static async fetchIssues(trailerId) {
        return baseService.fetchIssues(trailerId)
    }

    /** Fetches a single trailer by ID, handling both string and object ID arguments. */
    static async fetchTrailerById(trailerId) {
        if (!trailerId) throw new Error('Trailer ID is required')
        const resolvedId = typeof trailerId === 'object' ? trailerId.id || trailerId.trailerId || '' : trailerId
        ValidationUtility.requireUUID(resolvedId, `Invalid trailer ID format: ${resolvedId}`)
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/fetch-by-id`,
            { id: resolvedId },
            'Failed to fetch trailer'
        )
        return json?.data ? Trailer.fromApiFormat(json.data) : null
    }

    /** Fetches all trailers from the API. */
    static async fetchTrailers() {
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/fetch-all`, {}, 'Failed to fetch trailers')
        return (json?.data ?? []).map(Trailer.fromApiFormat)
    }
    /**
     * Fetches all trailers with enriched details (comments count, issues count, status history).
     * Optionally filtered by region codes.
     */
    static async fetchTrailersWithDetails(regionCodes = null) {
        return fetchWithDetailsBase({
            fetchAllFn: () => this.fetchTrailers(),
            historyTableName: 'trailers_history',
            idColumnName: 'trailer_id',
            regionCodes
        })
    }
    static async getTrailerHistory(trailerId, limit = null) {
        ValidationUtility.requireUUID(trailerId, `Invalid trailer ID format: ${trailerId}`)
        const payload = { trailerId }
        if (limit && Number.isInteger(limit)) payload.limit = limit
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/fetch-history`, payload, 'Failed to fetch trailer history')
        return json?.data ?? []
    }
    /** Updates a trailer record, ensuring proper model instantiation. */
    static async updateTrailer(trailerId, updatedTrailer, userId, _oldTrailer) {
        const id = resolveEntityId(trailerId)
        ValidationUtility.requireUUID(id, `Invalid trailer ID format: ${id}`)
        const trailer = updatedTrailer instanceof Trailer ? updatedTrailer : Trailer.ensureInstance(updatedTrailer)
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/update`,
            { id, trailer, userId },
            'Failed to update trailer'
        )
        return json?.data ? Trailer.fromApiFormat(json.data) : null
    }
}
export const TrailerService = TrailerServiceImpl
