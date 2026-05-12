import { Mixer } from '../app/models/mixers/Mixer'
import { MixerComment } from '../app/models/mixers/MixerComment'
import { MixerHistory } from '../app/models/mixers/MixerHistory'
import { MixerImage } from '../app/models/mixers/MixerImage'
import { apiPostOrThrow, ensureSpareIfNoOperatorBase } from '../utils/BaseAssetUtility'
import CleanupUtility from '../utils/CleanupUtility'
import { ValidationUtility } from '../utils/ValidationUtility'
import VerifiedUtility from '../utils/VerifiedUtility'
import { createAssetService } from './BaseAssetService'

const SERVICE_PREFIX = '/mixer-service'

/** Attaches an isVerified() method using current mixer field values. */
function enrichMixerWithVerification(mixer) {
    if (!mixer) return mixer
    mixer.isVerified = () => VerifiedUtility.isVerified(mixer.updatedLast, mixer.updatedAt, mixer.updatedBy)
    return mixer
}

const base = createAssetService({
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
 * Generic asset methods (comments, issues, counts, history entry) provided by createAssetService.
 */
export const MixerService = {
    ...base,
    getAllMixers() { return base._base.getAll() },
    fetchMixers() { return this.getAllMixers() },
    fetchMixerById(id) { return base._base.fetchById(id) },
    getMixerHistory(mixerId, limit = null) { return base._base.getHistory(mixerId, limit) },
    createMixer(mixer, userId) { return base._base.create(mixer, userId) },
    updateMixer(mixerId, mixer, userId, prevMixerState = null) {
        return base._base.update(mixerId, mixer, userId, prevMixerState)
    },
    deleteMixer(id) { return base._base.delete(id) },
    getMixersByOperator(operatorId) { return base._base.getByOperator(operatorId) },
    async searchMixersByVin(query) {
        const rows = await base._base.searchByVin(query)
        return rows.map(enrichMixerWithVerification)
    },
    searchMixersByVinProcessed(query) { return this.searchMixersByVin(query) },
    fetchMixersWithDetails(regionCodes = null) { return base._base.fetchWithDetails(regionCodes) },
    verifyMixer(mixerId, userId) { return base._base.verify(mixerId, userId) },
    /** Mixer-specific: fetches the image gallery rows attached to one mixer. */
    async fetchMixerImages(mixerId) {
        ValidationUtility.requireUUID(mixerId, 'Mixer ID is required')
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/fetch-images`, { mixerId }, 'Failed to fetch mixer images')
        return (json?.data ?? []).map(MixerImage.fromRow)
    },
    /** Sets unassigned-operator mixers to Spare status in batch. */
    ensureSpareIfNoOperator(mixersList) {
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
    },
    /** Batch-corrects null operator fields by setting affected mixers to Spare. */
    cleanupNullOperators(mixers = null) {
        return CleanupUtility.cleanupNullOperators(
            mixers,
            (id, updates, userId) => this.updateMixer(id, updates, userId),
            () => this.getAllMixers()
        )
    }
}
