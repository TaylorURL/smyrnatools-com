import { Mixer } from '../app/models/mixers/Mixer'
import { MixerComment } from '../app/models/mixers/MixerComment'
import { MixerHistory } from '../app/models/mixers/MixerHistory'
import { MixerImage } from '../app/models/mixers/MixerImage'
import { apiPostOrThrow, ensureSpareIfNoOperatorBase } from '../utils/BaseAssetUtility'
import CleanupUtility from '../utils/CleanupUtility'
import { ValidationUtility } from '../utils/ValidationUtility'
import VerifiedUtility from '../utils/VerifiedUtility'
import BaseAssetService from './BaseAssetService'

const SERVICE_PREFIX = '/mixer-service'

/** Attaches an isVerified() method using current mixer field values. */
function enrichMixerWithVerification(mixer) {
    if (!mixer) return mixer
    mixer.isVerified = () => VerifiedUtility.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy)
    return mixer
}

const baseService = new BaseAssetService({
    clearOperatorOnPlantChange: true,
    commentModelFn: MixerComment.fromRow,
    commentsTable: 'mixers_comments',
    enrichFn: enrichMixerWithVerification,
    entityIdParam: 'mixerId',
    entityKey: 'mixer',
    entityName: 'Mixer',
    historyTable: 'mixers_history',
    idColumn: 'mixer_id',
    issuesTable: 'mixers_maintenance',
    parseHistoryRow: (row) => new MixerHistory(row),
    parseRow: (row) => (row ? new Mixer(row) : null),
    servicePrefix: SERVICE_PREFIX,
    uppercaseVin: true
})

/**
 * Mixer CRUD, history, comments, issues, images, and verification service.
 * Delegates shared asset operations to BaseAssetService.
 */
class MixerServiceImpl {
    static getAllMixers() {
        return baseService.getAll()
    }
    static fetchMixers() {
        return this.getAllMixers()
    }
    static fetchMixerById(id) {
        return baseService.fetchById(id)
    }
    static getLatestHistoryDate(mixerId) {
        return baseService.getLatestHistoryDate(mixerId)
    }
    static getMixerHistory(mixerId, limit = null) {
        return baseService.getHistory(mixerId, limit)
    }
    static createMixer(mixer, userId) {
        return baseService.create(mixer, userId)
    }
    static updateMixer(mixerId, mixer, userId, prevMixerState = null) {
        return baseService.update(mixerId, mixer, userId, prevMixerState)
    }
    static deleteMixer(id) {
        return baseService.delete(id)
    }
    static getMixersByOperator(operatorId) {
        return baseService.getByOperator(operatorId)
    }
    static async searchMixersByVin(query) {
        const rows = await baseService.searchByVin(query)
        return rows.map(enrichMixerWithVerification)
    }
    static searchMixersByVinProcessed(query) {
        return this.searchMixersByVin(query)
    }
    static fetchAllCommentsCounts(mixerIds) {
        return baseService.fetchAllCommentsCounts(mixerIds)
    }
    static fetchAllIssuesCounts(mixerIds) {
        return baseService.fetchAllIssuesCounts(mixerIds)
    }
    static fetchComments(mixerId) {
        return baseService.fetchComments(mixerId)
    }
    static addComment(mixerId, text, author) {
        return baseService.addComment(mixerId, text, author)
    }
    static deleteComment(commentId) {
        return baseService.deleteComment(commentId)
    }
    /** Mixer-specific: fetches the image gallery rows attached to one mixer. */
    static async fetchMixerImages(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/fetch-images`, { mixerId }, 'Failed to fetch mixer images')
        return (json?.data ?? []).map(MixerImage.fromRow)
    }
    static fetchIssues(mixerId) {
        return baseService.fetchIssues(mixerId)
    }
    static completeIssue(issueId) {
        return baseService.completeIssue(issueId)
    }
    static addIssue(mixerId, issue, severity, createdBy = null) {
        return baseService.addIssue(mixerId, issue, severity, createdBy)
    }
    static deleteIssue(issueId) {
        return baseService.deleteIssue(issueId)
    }
    static fetchMixersWithDetails(regionCodes = null) {
        return baseService.fetchWithDetails(regionCodes)
    }
    /** Sets unassigned-operator mixers to Spare status in batch. */
    static ensureSpareIfNoOperator(mixersList) {
        return ensureSpareIfNoOperatorBase(mixersList, async (m) => {
            await this.updateMixer(m.id, {
                assignedOperator: null,
                status: 'Spare',
                updatedAt: null,
                updatedBy: null,
                updatedLast: null
            })
            m.assignedOperator = null
            m.updatedLast = null
            m.updatedAt = null
            m.updatedBy = null
        })
    }
    /** Batch-corrects null operator fields by setting affected mixers to Spare. */
    static cleanupNullOperators(mixers = null) {
        return CleanupUtility.cleanupNullOperators(
            mixers,
            (id, updates, userId) => this.updateMixer(id, updates, userId),
            () => this.getAllMixers()
        )
    }
    static verifyMixer(mixerId, userId) {
        return baseService.verify(mixerId, userId)
    }
}

export const MixerService = MixerServiceImpl
