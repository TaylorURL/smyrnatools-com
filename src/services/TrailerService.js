import Trailer from '../app/models/trailers/Trailer'
import { createAssetService } from './BaseAssetService'

const base = createAssetService({
    commentsTable: 'trailers_comments',
    entityIdParam: 'trailerId',
    entityKey: 'trailer',
    entityName: 'Trailer',
    historyTable: 'trailers_history',
    idColumn: 'trailer_id',
    issuesTable: 'trailers_maintenance',
    parseRow: (row) => (row ? Trailer.fromApiFormat(row) : null),
    servicePrefix: '/trailer-service'
})

/** Trailer CRUD, comments, issues, and history service. */
export const TrailerService = {
    ...base,
    fetchTrailers() { return base._base.getAll() },
    /** Fetches a single trailer by ID. Accepts string IDs or `{ id }` / `{ trailerId }` objects. */
    fetchTrailerById(trailerId) {
        if (!trailerId) throw new Error('Trailer ID is required')
        const resolved = typeof trailerId === 'object' ? trailerId.id || trailerId.trailerId || '' : trailerId
        return base._base.fetchById(resolved)
    },
    createTrailer(trailer, userId) { return base._base.create(trailer, userId) },
    /** Updates a trailer record. Coerces plain objects to Trailer instances for serialization. */
    updateTrailer(trailerId, updatedTrailer, userId, _oldTrailer) {
        const trailer = updatedTrailer instanceof Trailer ? updatedTrailer : Trailer.ensureInstance(updatedTrailer)
        return base._base.update(trailerId, trailer, userId)
    },
    deleteTrailer(id) { return base._base.delete(id) },
    fetchTrailersWithDetails(regionCodes = null) { return base._base.fetchWithDetails(regionCodes) },
    getTrailerHistory(trailerId, limit = null) { return base._base.getHistory(trailerId, limit) }
}
