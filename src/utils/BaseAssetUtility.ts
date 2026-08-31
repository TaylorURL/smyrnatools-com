/**
 * Shared building blocks for the per-asset fleet services (Mixer, Tractor,
 * Trailer, Equipment, Pickup Truck). Each of those services owns its own tables
 * and endpoints; everything they do identically lives here — acting user
 * resolution, edge-function call wrappers, issue and comment counting, status
 * history, region filtering, severity normalization, and duplicate detection.
 *
 * Table and column names are always parameters, never constants, because the
 * asset tables differ only in naming. Counting and history helpers take the full
 * id list and issue one query rather than one per entity.
 */

import { Database } from '../services/DatabaseService'
import { UserService } from '../services/UserService'
import APIUtility, { type APIResponse } from './APIUtility'

interface EntityWithId {
    id: string
    [key: string]: unknown
}

interface ApiPostResult {
    json: Record<string, unknown>
    res: APIResponse['res']
}

interface CountMap {
    [entityId: string]: number
}

interface StatusHistoryMap {
    [entityId: string]: string
}

interface ItemWithCounts {
    commentsCount: number
    openIssuesCount: number
    [key: string]: unknown
}

interface FleetItem extends Record<string, unknown> {
    id: string
    createdAt?: string
    status?: string
    assignedOperator?: string | number | null
}

interface FetchWithDetailsBaseParams {
    enrichFn?: ((item: ItemWithCounts & { statusChangedAt: string | null }) => ItemWithCounts) | null
    fetchAllFn: () => Promise<FleetItem[]>
    historyTableName: string
    idColumnName: string
    plantField?: string
    regionCodes?: Set<string> | null
}

/** Resolves an entity object or raw ID string to its `id` property. */
const resolveEntityId = (entityOrId: EntityWithId | string): string =>
    typeof entityOrId === 'object' && entityOrId?.id ? entityOrId.id : (entityOrId as string)

/** Resolves an entity to its ID, throwing if falsy. */
export const requireEntityId = (entityOrId: EntityWithId | string | null | undefined, label = 'ID'): string => {
    if (!entityOrId) throw new Error(`${label} is required`)
    return resolveEntityId(entityOrId)
}

/** Attribution used when a write happens with no signed-in user to credit. */
const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000'
const VALID_SEVERITIES = ['Low', 'Medium', 'High'] as const
type Severity = (typeof VALID_SEVERITIES)[number]
const DEFAULT_SEVERITY: Severity = 'Medium'

export { resolveEntityId }

/** Uses the caller-supplied user id, falling back to whoever is signed in.
 *  Every write path goes through this so callers may pass the acting user
 *  explicitly without each one having to fetch the current one. */
async function resolveUserId(userId?: string | null): Promise<string | null> {
    if (userId) return userId
    const user = await UserService.getCurrentUser()
    return typeof user === 'object' && user !== null ? user.id : user
}

export async function requireUserId(userId?: string | null, errorMessage = 'User ID is required'): Promise<string> {
    const resolved = await resolveUserId(userId)
    if (!resolved) throw new Error(errorMessage)
    return resolved
}

export async function resolveUserIdOrAnonymous(userId?: string | null): Promise<string> {
    return (await resolveUserId(userId)) || ANONYMOUS_USER_ID
}

/** Normalizes a VIN to upper case before it is written, so duplicate detection
 *  and lookups compare like with like. Mutates the entity in place and returns
 *  the same object. */
export function uppercaseVin<T extends Record<string, unknown>>(entity: T): T {
    if (entity && typeof entity === 'object' && 'vin' in entity && entity.vin) {
        ;(entity as Record<string, unknown>).vin = (entity.vin as string).toUpperCase()
    }
    return entity
}

// Three call shapes sit on top of APIUtility, differing only in how hard they
// insist on success: `apiPost` hands the raw result back, `apiPostOrThrow`
// demands an HTTP-level success, and `apiPostRequireSuccess` additionally
// demands the body's own `success` flag, which the edge functions set for
// operations whose result is reported in the body rather than the status.
export async function apiPost(endpoint: string, payload: Record<string, unknown> = {}): Promise<ApiPostResult> {
    const { json, res } = await APIUtility.post(endpoint, payload)
    return { json, res }
}

export async function apiPostOrThrow(
    endpoint: string,
    payload: Record<string, unknown>,
    errorMessage: string
): Promise<Record<string, unknown>> {
    const { json, res } = await apiPost(endpoint, payload)
    if (!res.ok) throw new Error((json?.error as string) || errorMessage)
    return json
}

export async function apiPostRequireSuccess(
    endpoint: string,
    payload: Record<string, unknown>,
    errorMessage: string
): Promise<true> {
    const { json, res } = await apiPost(endpoint, payload)
    if (!res.ok || json?.success !== true) throw new Error((json?.error as string) || errorMessage)
    return true
}

/** Rows per entity in a child table, as one query over the whole id list.
 *  On success every requested id is present with an explicit zero, so callers
 *  need no guard for missing keys. A query error yields an empty map instead,
 *  which reads downstream as "no counts" rather than failing the load. */
export async function fetchAllCountsFromTable(
    tableName: string,
    idColumnName: string,
    entityIds: string[]
): Promise<CountMap> {
    if (!entityIds?.length) return {}
    const { data, error } = await Database.from(tableName)
        .select(idColumnName)
        .in(idColumnName, entityIds)
        .overrideTypes<Record<string, string>[], { merge: false }>()
    if (error) return {}
    const counts: CountMap = {}
    entityIds.forEach((id) => (counts[id] = 0))
    ;(data || []).forEach((row) => {
        if (row[idColumnName]) counts[row[idColumnName]] = (counts[row[idColumnName]] || 0) + 1
    })
    return counts
}

/** Open-issue counts for a set of entities. An issue is open until
 *  `time_completed` is stamped, so completion is what closes it, not a status
 *  column. Shares the zero-filling and error behavior of the count helper
 *  above. */
export async function fetchAllOpenIssueCountsFromTable(
    tableName: string,
    idColumnName: string,
    entityIds: string[]
): Promise<CountMap> {
    if (!entityIds?.length) return {}
    const { data, error } = await Database.from(tableName)
        .select(`${idColumnName}, time_completed`)
        .in(idColumnName, entityIds)
        .overrideTypes<Record<string, string | null>[], { merge: false }>()
    if (error) return {}
    const counts: CountMap = {}
    entityIds.forEach((id) => (counts[id] = 0))
    ;(data || []).forEach((row) => {
        const entityId = row[idColumnName]
        if (entityId && !row.time_completed) {
            counts[entityId] = (counts[entityId] || 0) + 1
        }
    })
    return counts
}

/** Most recent status change per entity, as an ISO timestamp. The query orders
 *  newest first and only the first row seen per entity is kept, so the ordering
 *  is what makes the result the latest change rather than an arbitrary one.
 *  Entities that never changed status are absent from the map. */
export async function fetchStatusHistoryMap(
    historyTableName: string,
    idColumnName: string,
    entityIds: string[]
): Promise<StatusHistoryMap> {
    if (!entityIds?.length) return {}
    const statusHistoryMap: StatusHistoryMap = {}
    try {
        const { data: statusHistory } = await Database.from(historyTableName)
            .select(`${idColumnName}, changed_at`)
            .eq('field_name', 'status')
            .in(idColumnName, entityIds)
            .order('changed_at', { ascending: false })
            .overrideTypes<Record<string, string>[], { merge: false }>()
        if (statusHistory) {
            for (const entry of statusHistory) {
                if (!statusHistoryMap[entry[idColumnName]]) {
                    statusHistoryMap[entry[idColumnName]] = entry.changed_at
                }
            }
        }
    } catch (error) {
        console.error(`Failed to fetch status history from ${historyTableName}:`, error)
    }
    return statusHistoryMap
}

export function ensureDefaultCounts(item: Record<string, unknown>): ItemWithCounts {
    return {
        ...item,
        commentsCount: typeof item.commentsCount === 'number' ? item.commentsCount : 0,
        openIssuesCount: typeof item.openIssuesCount === 'number' ? item.openIssuesCount : 0
    }
}

/** Keeps only items whose plant belongs to the region. A null `regionCodes`
 *  means the caller is not region-scoped and everything passes; an empty set
 *  means a region with no plants, and correctly keeps nothing. */
export function filterByRegionCodes<T extends Record<string, unknown>>(
    items: T[],
    regionCodes: Set<string> | null | undefined,
    plantField = 'assignedPlant'
): T[] {
    if (!regionCodes) return items
    return items.filter((item) =>
        regionCodes.has(
            String(item[plantField] || '')
                .trim()
                .toUpperCase()
        )
    )
}

/** The list-view load every asset service shares: fetch the rows, stamp each one
 *  with `statusChangedAt` (falling back to creation, so tenure math always has a
 *  date), guarantee the comment and issue counters exist, run the service's own
 *  `enrichFn`, then cut the result down to the caller's region.
 *
 *  A failed fetch degrades to an empty list rather than rejecting, so one broken
 *  asset type cannot take down a page that loads several. */
export async function fetchWithDetailsBase({
    enrichFn = null,
    fetchAllFn,
    historyTableName,
    idColumnName,
    plantField = 'assignedPlant',
    regionCodes = null
}: FetchWithDetailsBaseParams): Promise<ItemWithCounts[]> {
    const base = await fetchAllFn().catch(() => [])
    const safeBase = Array.isArray(base) ? base : []
    const entityIds = safeBase.map((item) => item.id).filter(Boolean)
    const statusHistoryMap = await fetchStatusHistoryMap(historyTableName, idColumnName, entityIds)
    const processed = safeBase.map((item) => {
        const enriched = ensureDefaultCounts({
            ...item,
            statusChangedAt: statusHistoryMap[item.id] || item.createdAt || null
        })
        return enrichFn ? enrichFn(enriched as ItemWithCounts & { statusChangedAt: string | null }) : enriched
    })
    return filterByRegionCodes(processed, regionCodes, plantField)
}

/** Converts a camelCase model field to the snake_case column name. Names that
 *  already contain an underscore are passed through untouched, so a column name
 *  can be handed in directly. */
export function toSnakeCase(fieldName: string): string {
    return fieldName.includes('_') ? fieldName : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/** Coerces an issue severity to one the UI can render, defaulting anything
 *  unrecognized to Medium. */
export function normalizeSeverity(severity: string): Severity {
    return (VALID_SEVERITIES as readonly string[]).includes(severity) ? (severity as Severity) : DEFAULT_SEVERITY
}

/** The field values that occur more than once, for flagging duplicate truck
 *  numbers or VINs in a list. Values the extractor reports as empty are ignored,
 *  since several blanks are not a collision. */
export function getDuplicateFieldValues<T>(items: T[], fieldExtractor: (item: T) => string | null): Set<string> {
    const counts = new Map<string, number>()
    for (const item of items) {
        const key = fieldExtractor(item)
        if (!key) continue
        counts.set(key, (counts.get(key) || 0) + 1)
    }
    const duplicates = new Set<string>()
    counts.forEach((count, key) => {
        if (count > 1) duplicates.add(key)
    })
    return duplicates
}

/** True when the item has no usable operator assignment. Unassignment reaches
 *  the client as several different sentinels — absent, the string or number
 *  zero, the string "null" — so every check has to go through here rather than
 *  testing the field directly. */
export function hasNoOperator(item: FleetItem): boolean {
    return (
        !item.assignedOperator ||
        item.assignedOperator === '0' ||
        item.assignedOperator === 0 ||
        item.assignedOperator === null ||
        item.assignedOperator === 'null'
    )
}
