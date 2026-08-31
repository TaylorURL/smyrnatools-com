import { Mixer } from '../app/models/mixers/Mixer'
import { MixerComment } from '../app/models/mixers/MixerComment'
import { MixerHistory } from '../app/models/mixers/MixerHistory'
import CleanupUtility from '../utils/CleanupUtility'
import VerifiedUtility from '../utils/VerifiedUtility'
import { createAssetService } from './BaseAssetService'

const SERVICE_PREFIX = '/mixer-service'

/**
 * Gives a mixer an `isVerified()` method. The closure reads the fields at
 * call time rather than capturing a result, so editing the mixer in place and
 * asking again reflects the edit.
 */
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
 * Mixer CRUD, history, comments, issues, and verification. The comment,
 * issue, count, and history-entry methods come from `createAssetService`;
 * everything below delegates to the same base instance under mixer-specific
 * names.
 */
export const MixerService = {
    ...base,
    /**
     * Moves every mixer with no assigned operator to Spare status, so an
     * unmanned mixer is not counted as an active one. Pass a list to work
     * from it; omit it to load all mixers first.
     */
    cleanupNullOperators(mixers = null) {
        return CleanupUtility.cleanupNullOperators(
            mixers,
            (id, updates, userId) => this.updateMixer(id, updates, userId),
            () => this.getAllMixers()
        )
    },

    createMixer(mixer, userId) {
        return base._base.create(mixer, userId)
    },

    deleteMixer(id) {
        return base._base.delete(id)
    },

    fetchMixerById(id) {
        return base._base.fetchById(id)
    },

    fetchMixers() {
        return this.getAllMixers()
    },

    fetchMixersWithDetails(regionCodes = null) {
        return base._base.fetchWithDetails(regionCodes)
    },

    getAllMixers() {
        return base._base.getAll()
    },

    /** Fetches change history for a mixer. Invoked dynamically via
     *  HISTORY_SERVICE_MAP in useHistoryDataFetchers. */
    getMixerHistory(mixerId, limit = null) {
        return base._base.getHistory(mixerId, limit)
    },

    getMixersByOperator(operatorId) {
        return base._base.getByOperator(operatorId)
    },

    async searchMixersByVin(query) {
        const rows = await base._base.searchByVin(query)
        return rows.map(enrichMixerWithVerification)
    },

    searchMixersByVinProcessed(query) {
        return this.searchMixersByVin(query)
    },

    updateMixer(mixerId, mixer, userId, prevMixerState = null) {
        return base._base.update(mixerId, mixer, userId, prevMixerState)
    },

    verifyMixer(mixerId, userId) {
        return base._base.verify(mixerId, userId)
    }
}
