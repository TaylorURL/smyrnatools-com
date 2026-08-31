import {
    apiPostOrThrow,
    apiPostRequireSuccess,
    fetchAllCountsFromTable,
    fetchAllOpenIssueCountsFromTable,
    fetchWithDetailsBase,
    normalizeSeverity,
    requireUserId,
    resolveEntityId,
    resolveUserIdOrAnonymous,
    toSnakeCase,
    uppercaseVin as uppercaseVinHelper
} from '../utils/BaseAssetUtility'
import { ValidationUtility } from '../utils/ValidationUtility'

/** Leaves rows in their raw API shape when no parser is configured. */
const identity = (row) => row

/**
 * Base service for fleet assets (mixers, tractors, trailers, equipment, pickup trucks).
 *
 * Provides the shared CRUD/history/comments/issues/verify pipeline. Concrete
 * services compose this by passing a config object — they only need to expose
 * their domain-typed method names (getAllMixers, fetchTractorById, etc.) as
 * thin delegations to the corresponding generic methods here.
 *
 * Most methods post to `${servicePrefix}/<action>` on the edge functions. The
 * tables named in the config are the exception: the count helpers and the
 * status-history lookup behind `fetchWithDetails` query them directly through
 * the Supabase client, so those calls answer to RLS rather than to the
 * function's own authorization.
 *
 * @param {Object} config
 * @param {string} config.servicePrefix          - API route prefix (e.g. '/mixer-service')
 * @param {string} config.entityName             - Human-readable name for errors (e.g. 'Mixer')
 * @param {string} config.entityKey              - JSON payload key for the entity body (e.g. 'mixer')
 * @param {string} config.entityIdParam          - Payload key for entity ID in subresource calls (e.g. 'mixerId')
 * @param {string} config.idColumn               - DB column for entity FK (e.g. 'mixer_id')
 * @param {string} config.commentsTable          - DB table for comments
 * @param {string} config.issuesTable            - DB table for maintenance issues
 * @param {string} [config.historyTable]         - DB table for history rows (used by fetchWithDetails)
 * @param {Function} [config.parseRow]           - Maps a raw API row to a domain model instance
 * @param {Function} [config.parseHistoryRow]    - Maps a raw history row to a domain model instance
 * @param {Function} [config.commentModelFn]     - Maps a raw comment row to a model instance
 * @param {Function} [config.enrichFn]           - Post-parse enrichment (e.g. attaches isVerified())
 * @param {boolean}  [config.uppercaseVin=false] - Uppercase entity.vin on create/update
 * @param {boolean}  [config.clearOperatorOnPlantChange=false] - Null assignedOperator when plant changes
 * @param {string[]} [config.allowedHistoryFields] - Whitelist for createHistoryEntry (snake_case)
 */
class BaseAssetService {
    constructor(config) {
        this.servicePrefix = config.servicePrefix
        this.entityName = config.entityName
        this.entityKey = config.entityKey || null
        this.entityIdParam = config.entityIdParam
        this.idColumn = config.idColumn
        this.commentsTable = config.commentsTable
        this.issuesTable = config.issuesTable
        this.historyTable = config.historyTable || null
        this.parseRow = config.parseRow || identity
        this.parseHistoryRow = config.parseHistoryRow || identity
        this.commentModelFn = config.commentModelFn || null
        this.enrichFn = config.enrichFn || null
        this.uppercaseVin = !!config.uppercaseVin
        this.clearOperatorOnPlantChange = !!config.clearOperatorOnPlantChange
        this.allowedHistoryFields = config.allowedHistoryFields || null
    }

    /**
     * Turns a raw row into the domain shape callers expect. Only the paths
     * that return a single entity to the UI (`fetchById`, `verify`) hydrate;
     * list endpoints run `parseRow` alone, so an entity coming back from a
     * list is missing whatever `enrichFn` attaches.
     */
    _hydrate(row) {
        if (!row) return null
        const parsed = this.parseRow(row)
        return this.enrichFn ? this.enrichFn(parsed) : parsed
    }

    _hydrateList(rows) {
        return (rows ?? []).map((row) => this._hydrate(row))
    }

    /** Fetches every entity. Rows are parsed but not enriched — see `_hydrate`. */
    async getAll() {
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/fetch-all`,
            {},
            `Failed to fetch ${this.entityName.toLowerCase()}s`
        )
        return (json?.data ?? []).map((row) => this.parseRow(row))
    }

    /** Fetches one entity by ID, hydrated and enriched. Accepts an id or an entity. */
    async fetchById(id) {
        const resolvedId = resolveEntityId(id)
        ValidationUtility.requireUUID(resolvedId, `Invalid ${this.entityName} ID`)
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/fetch-by-id`,
            { id: resolvedId },
            `Failed to fetch ${this.entityName.toLowerCase()}`
        )
        return this._hydrate(json?.data)
    }

    /**
     * Creates a new entity. Any `id` on the passed object is deleted in place
     * so the server assigns one — a client-side draft model that pre-generates
     * a UUID can be handed straight to this method.
     */
    async create(entity, userId) {
        const resolvedUserId = await requireUserId(userId, 'Authentication required')
        if (entity?.id) delete entity.id
        if (this.uppercaseVin) uppercaseVinHelper(entity)
        const payload = { [this.entityKey]: entity, userId: resolvedUserId }
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/create`,
            payload,
            `Failed to create ${this.entityName.toLowerCase()}`
        )
        return this.parseRow(json?.data)
    }

    /**
     * Updates an entity.
     *
     * When `clearOperatorOnPlantChange` is set, moving an asset to a different
     * plant drops its operator assignment, since operators belong to a plant
     * and would otherwise be left driving an asset at a plant they do not work
     * at. `prevState` supplies the plant to compare against; omitting it makes
     * the comparison see `undefined` and clear the operator on every update.
     */
    async update(idOrEntity, entity, userId, prevState = null) {
        const id = resolveEntityId(idOrEntity)
        ValidationUtility.requireUUID(id, `${this.entityName} ID is required`)
        const resolvedUserId = await requireUserId(userId)
        if (this.uppercaseVin) uppercaseVinHelper(entity)
        if (this.clearOperatorOnPlantChange && prevState?.assignedPlant !== entity?.assignedPlant) {
            entity.assignedOperator = null
        }
        const payload = { id, [this.entityKey]: entity, userId: resolvedUserId }
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/update`,
            payload,
            `Failed to update ${this.entityName.toLowerCase()}`
        )
        return this.parseRow(json?.data)
    }

    /** Deletes the entity. Requires a bare UUID, unlike the id-or-entity methods. */
    async delete(id) {
        ValidationUtility.requireUUID(id, `${this.entityName} ID is required`)
        return apiPostRequireSuccess(
            `${this.servicePrefix}/delete`,
            { id },
            `Failed to delete ${this.entityName.toLowerCase()}`
        )
    }

    /**
     * Stamps the entity as verified by the given user. The server owns the
     * verification timestamp; the model's `isVerified()` reads it back.
     */
    async verify(id, userId) {
        const resolvedId = resolveEntityId(id)
        ValidationUtility.requireUUID(resolvedId, `${this.entityName} ID is required`)
        const resolvedUserId = await requireUserId(userId)
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/verify`,
            { id: resolvedId, userId: resolvedUserId },
            `Failed to verify ${this.entityName.toLowerCase()}`
        )
        return this._hydrate(json?.data)
    }

    /** VIN search. Rows come back parsed but un-enriched — see `_hydrate`. */
    async searchByVin(query) {
        if (!query?.trim()) throw new Error('Search query is required')
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/search-by-vin`,
            { query: query.trim().toUpperCase() },
            `Failed to search ${this.entityName.toLowerCase()}s by VIN`
        )
        return (json?.data ?? []).map((row) => this.parseRow(row))
    }

    /** Returns all entities currently assigned to the given operator UUID. */
    async getByOperator(operatorId) {
        ValidationUtility.requireUUID(operatorId, 'Operator ID is required')
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/fetch-by-operator`,
            { operatorId },
            `Failed to fetch ${this.entityName.toLowerCase()}s by operator`
        )
        return (json?.data ?? []).map((row) => this.parseRow(row))
    }

    /**
     * Fetches every entity with `statusChangedAt` resolved from the history
     * table (falling back to `createdAt`), `commentsCount` / `openIssuesCount`
     * defaulted to 0 so list rendering never sees undefined, and `enrichFn`
     * applied. The counts are placeholders — callers that display real numbers
     * fetch them separately via `fetchAllCommentsCounts` / `fetchAllIssuesCounts`.
     *
     * `regionCodes` is a set of allowed *plant* codes, as returned by
     * `PlantService.getAllowedPlantCodes`; null means no scoping.
     */
    async fetchWithDetails(regionCodes = null) {
        return fetchWithDetailsBase({
            enrichFn: this.enrichFn || undefined,
            fetchAllFn: () => this.getAll(),
            historyTableName: this.historyTable,
            idColumnName: this.idColumn,
            regionCodes
        })
    }

    async fetchComments(entityId) {
        ValidationUtility.requireUUID(entityId, `${this.entityName} ID is required`)
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/fetch-comments`,
            { [this.entityIdParam]: entityId },
            'Failed to fetch comments'
        )
        const rows = json?.data ?? []
        return this.commentModelFn ? rows.map(this.commentModelFn) : rows
    }

    async addComment(entityId, text, author) {
        ValidationUtility.requireUUID(entityId, `${this.entityName} ID is required`)
        if (!text?.trim()) throw new Error('Comment text is required')
        if (!author?.trim?.()) throw new Error('Author is required')
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/add-comment`,
            {
                author: typeof author === 'string' ? author.trim() : author,
                [this.entityIdParam]: entityId,
                text: typeof text === 'string' ? text.trim() : text
            },
            'Failed to add comment'
        )
        const row = json?.data
        if (!row) return null
        return this.commentModelFn ? this.commentModelFn(row) : row
    }

    async deleteComment(commentId) {
        ValidationUtility.requireUUID(commentId, 'Comment ID is required')
        return apiPostRequireSuccess(`${this.servicePrefix}/delete-comment`, { commentId }, 'Failed to delete comment')
    }

    async fetchIssues(entityId) {
        ValidationUtility.requireUUID(entityId, `${this.entityName} ID is required`)
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/fetch-issues`,
            { [this.entityIdParam]: entityId },
            'Failed to fetch issues'
        )
        return json?.data ?? []
    }

    async addIssue(entityId, issue, severity, createdBy = null) {
        ValidationUtility.requireUUID(entityId, `${this.entityName} ID is required`)
        if (!issue?.trim()) throw new Error('Issue description is required')
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/add-issue`,
            {
                [this.entityIdParam]: entityId,
                issue: issue.trim(),
                severity: normalizeSeverity(severity),
                userId: createdBy
            },
            'Failed to add issue'
        )
        return json?.data
    }

    async completeIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        return apiPostRequireSuccess(`${this.servicePrefix}/complete-issue`, { issueId }, 'Failed to complete issue')
    }

    async deleteIssue(issueId) {
        ValidationUtility.requireUUID(issueId, 'Issue ID is required')
        return apiPostRequireSuccess(`${this.servicePrefix}/delete-issue`, { issueId }, 'Failed to delete issue')
    }

    async fetchAllCommentsCounts(entityIds) {
        return fetchAllCountsFromTable(this.commentsTable, this.idColumn, entityIds)
    }

    async fetchAllIssuesCounts(entityIds) {
        return fetchAllOpenIssueCountsFromTable(this.issuesTable, this.idColumn, entityIds)
    }

    /**
     * Fetches change history for one entity, newest first. `limit` is only
     * forwarded when it is a positive integer; anything else fetches
     * everything the endpoint returns.
     */
    async getHistory(entityId, limit = null) {
        ValidationUtility.requireUUID(entityId, `${this.entityName} ID is required`)
        const payload = { [this.entityIdParam]: entityId }
        if (limit && Number.isInteger(limit) && limit > 0) payload.limit = limit
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/fetch-history`,
            payload,
            `Failed to fetch ${this.entityName.toLowerCase()} history`
        )
        return (json?.data ?? []).map((row) => this.parseHistoryRow(row))
    }

    /**
     * Records a field-level change in the entity's history audit trail.
     * `fieldName` may be camelCase or snake_case; it is normalized to
     * snake_case before both the allowlist check and the write, so
     * `allowedHistoryFields` is always spelled in snake_case.
     *
     * Returns null without writing when the field is outside a configured
     * allowlist — a dropped field is not an error.
     */
    async createHistoryEntry(entityId, fieldName, oldValue, newValue, changedBy) {
        ValidationUtility.requireUUID(entityId, `${this.entityName} ID is required`)
        if (!fieldName) throw new Error('Field name required')
        const snake = toSnakeCase(fieldName)
        if (this.allowedHistoryFields && !this.allowedHistoryFields.includes(snake)) return null
        const userId = await resolveUserIdOrAnonymous(changedBy)
        const finalNewValue = snake === 'vin' ? (newValue || '').toUpperCase() : newValue
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/add-history`,
            {
                changedBy: userId,
                fieldName: snake,
                [this.entityIdParam]: entityId,
                newValue: finalNewValue,
                oldValue
            },
            'Failed to create history entry'
        )
        return json?.data
    }

    /**
     * Returns `changed_at` of the newest history entry, or null when there is
     * none. Reads the raw row rather than a parsed model, and swallows request
     * failures — a missing date only means "no known change", which callers
     * such as `Trailer.isVerified` treat as no staleness signal.
     */
    async getLatestHistoryDate(entityId) {
        if (!entityId) return null
        const json = await apiPostOrThrow(
            `${this.servicePrefix}/fetch-history`,
            { limit: 1, [this.entityIdParam]: entityId },
            'Failed to fetch history'
        ).catch(() => null)
        if (!json) return null
        return (json?.data ?? [])[0]?.changed_at ?? null
    }
}

/**
 * Builds the shared half of an entity service: the comment, issue, count, and
 * history-entry methods, pre-bound and ready to spread into the entity's own
 * service object.
 *
 * CRUD and search are deliberately not exposed here — each entity service
 * names them in its own vocabulary (`createMixer`, `fetchTractorById`) and
 * delegates to the instance handed back as `_base`.
 */
export function createAssetService(config) {
    const base = new BaseAssetService(config)
    return {
        _base: base,
        addComment: (entityId, text, author) => base.addComment(entityId, text, author),
        addIssue: (entityId, issue, severity, createdBy = null) => base.addIssue(entityId, issue, severity, createdBy),
        completeIssue: (issueId) => base.completeIssue(issueId),
        createHistoryEntry: (entityId, fieldName, oldValue, newValue, changedBy) =>
            base.createHistoryEntry(entityId, fieldName, oldValue, newValue, changedBy),
        deleteComment: (commentId) => base.deleteComment(commentId),
        deleteIssue: (issueId) => base.deleteIssue(issueId),
        fetchAllCommentsCounts: (entityIds) => base.fetchAllCommentsCounts(entityIds),
        fetchAllIssuesCounts: (entityIds) => base.fetchAllIssuesCounts(entityIds),
        fetchComments: (entityId) => base.fetchComments(entityId),
        fetchIssues: (entityId) => base.fetchIssues(entityId),
        getLatestHistoryDate: (entityId) => base.getLatestHistoryDate(entityId)
    }
}

export default BaseAssetService
