import APIUtility from '../utils/APIUtility'
import CacheUtility from '../utils/CacheUtility'
import GrammarUtility from '../utils/GrammarUtility'
import * as ListItemUtility from '../utils/ListItemUtility'
import { AIService } from './AIService'
import { UserService } from './UserService'

const PRIORITY_CACHE_TTL_MS = 30 * 60_000
const PRIORITY_CACHE_PREFIX = 'ai:priority:'

/**
 * Task list management service handling CRUD, filtering, sorting, and status tracking
 * for plant-level list items. Caches items and creator profiles for performance.
 *
 * Pure helpers and display formatters live in `src/utils/ListItemUtility.js`. This class
 * owns DB/network methods and stateful caches (listItems, creatorProfiles, plants), and
 * delegates the pure helpers for backward compatibility with existing call sites.
 */
class ListServiceImpl {
    listItems = []
    creatorProfiles = {}
    plants = []
    plantDistribution = {}
    _emitScheduled = false

    /**
     * Notifies subscribers (typically `useListData`) that `listItems` has mutated.
     * Multiple synchronous patches coalesce into a single dispatch via microtask
     * scheduling, so a bulk operation that touches N items still produces only
     * one re-render in React.
     */
    _emitChange() {
        if (typeof window === 'undefined') return
        if (this._emitScheduled) return
        this._emitScheduled = true
        queueMicrotask(() => {
            this._emitScheduled = false
            window.dispatchEvent(new Event('list-items-changed'))
        })
    }

    /**
     * Applies a shallow patch to a cached list item in place and notifies
     * subscribers. Returns the previous snapshot so callers can roll back on
     * network failure — `null` when the item is not in the cache (no-op).
     */
    optimisticPatch(itemId, patch) {
        const idx = this.listItems.findIndex((i) => i.id === itemId)
        if (idx < 0) return null
        const prev = this.listItems[idx]
        this.listItems[idx] = { ...prev, ...patch }
        this._emitChange()
        return prev
    }

    /** Restores a previously-patched item. Safe to call with a `null` rollback. */
    optimisticRevertPatch(itemId, prev) {
        if (!prev) return
        const idx = this.listItems.findIndex((i) => i.id === itemId)
        if (idx < 0) this.listItems.push(prev)
        else this.listItems[idx] = prev
        this._emitChange()
    }

    /** Removes an item from the cache and returns a rollback token. */
    optimisticRemove(itemId) {
        const idx = this.listItems.findIndex((i) => i.id === itemId)
        if (idx < 0) return null
        const [item] = this.listItems.splice(idx, 1)
        this._emitChange()
        return { index: idx, item }
    }

    /** Re-inserts a previously-removed item at its original index. */
    optimisticRestore(rollback) {
        if (!rollback) return
        const clampedIndex = Math.min(rollback.index, this.listItems.length)
        this.listItems.splice(clampedIndex, 0, rollback.item)
        this._emitChange()
    }

    /**
     * Fetches all list items with their creator profiles in a single call.
     * Uses a 60-second cache to reduce redundant API calls.
     */
    async fetchListItems(opts = {}) {
        const { force = false } = opts || {}
        const user = await UserService.getCurrentUser()
        if (!user) throw new Error('No authenticated user')
        if (!force) {
            const cached = CacheUtility.get('list:items-with-profiles')
            if (cached && Array.isArray(cached.items)) {
                this.listItems = cached.items
                this.creatorProfiles = cached.profiles || {}
                return this.listItems
            }
        }
        const { res, json } = await APIUtility.post('/list-service/fetch-items-with-profiles')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch list items')
        const data = json?.data ?? []
        const profilesArr = json?.profiles ?? []
        const profiles = {}
        for (const p of profilesArr) {
            if (p?.id) profiles[p.id] = p
        }
        const cleaned = data.map((i) => ({
            ...i,
            comments: GrammarUtility.cleanComments(i?.comments || ''),
            description: GrammarUtility.cleanDescription(i?.description || '')
        }))
        this.listItems = cleaned
        this.creatorProfiles = profiles
        CacheUtility.set('list:items-with-profiles', { items: cleaned, profiles }, 60_000)
        this._emitChange()
        return this.listItems
    }

    /** Fetches available plants for list item assignment with a 10-minute cache. */
    async fetchPlants(opts = {}) {
        const { force = false } = opts || {}
        if (!force) {
            const cached = CacheUtility.get('list:plants')
            if (cached && Array.isArray(cached)) {
                this.plants = cached
                return this.plants
            }
        }
        const { res, json } = await APIUtility.post('/list-service/fetch-plants')
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch plants')
        this.plants = json?.data ?? []
        CacheUtility.set('list:plants', this.plants, 10 * 60_000)
        return this.plants
    }

    /** Fetches display profiles for list item creators by their user IDs. */
    async fetchCreatorProfiles(listItems) {
        const userIds = [...new Set(listItems.map((item) => item.user_id).filter((id) => id))]
        const newProfiles = { ...this.creatorProfiles }
        if (userIds.length === 0) {
            this.creatorProfiles = newProfiles
            return this.creatorProfiles
        }
        const { res, json } = await APIUtility.post('/list-service/fetch-creator-profiles', { userIds })
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch creator profiles')
        const profiles = json?.profiles ?? []
        profiles.forEach((profile) => (newProfiles[profile.id] = profile))
        this.creatorProfiles = newProfiles
        return this.creatorProfiles
    }

    /** Creates a new list item with grammar-cleaned description and comments. */
    async createListItem(
        plantCode,
        description,
        deadline,
        comments,
        status = 'pending',
        responsibleRole = null,
        priority = 'none'
    ) {
        const user = await UserService.getCurrentUser()
        if (!user) throw new Error('No authenticated user')
        const desc = GrammarUtility.cleanDescription(description || '')
        if (!desc?.trim()) throw new Error('Description is required')
        const userId = user.id
        if (!userId) throw new Error('User ID is required')
        const deadlineString = deadline instanceof Date ? deadline.toISOString() : deadline
        const { res, json } = await APIUtility.post('/list-service/create', {
            comments: GrammarUtility.cleanComments(comments || ''),
            deadline: deadlineString,
            description: desc,
            plantCode,
            priority: priority || 'none',
            responsible_role: responsibleRole || null,
            status: status || 'pending',
            userId
        })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to create list item')
        CacheUtility.delete('list:items-with-profiles')
        await this.fetchListItems({ force: true })
        this.invalidateAllPriorityScores()
        return true
    }

    /**
     * Optimistic quick-add: inserts a temp item at the top of the cache,
     * dispatches the change event so the UI updates immediately, then fires
     * the create request in the background. On success, refetches so the
     * temp row is replaced by the real one; on failure, removes the temp
     * row. Returns the temp item so callers can correlate or display state.
     */
    quickAdd({
        comments = '',
        deadline,
        description,
        plantCode,
        priority = 'none',
        responsibleRole = null,
        status = 'pending',
        userId
    }) {
        const desc = GrammarUtility.cleanDescription(description || '')
        if (!desc.trim()) throw new Error('Description is required')
        if (!plantCode) throw new Error('Plant is required')
        if (!userId) throw new Error('User ID is required')
        const deadlineString = deadline instanceof Date ? deadline.toISOString() : deadline
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const tempItem = {
            _optimistic: true,
            comments: GrammarUtility.cleanComments(comments || ''),
            completed: false,
            completed_at: null,
            completed_by: null,
            created_at: new Date().toISOString(),
            deadline: deadlineString,
            description: desc,
            id: tempId,
            plant_code: plantCode,
            priority,
            responsible_role: responsibleRole,
            status,
            user_id: userId
        }
        this.listItems.unshift(tempItem)
        this._emitChange()
        const cleanup = () => this.optimisticRemove(tempId)
        APIUtility.post('/list-service/create', {
            comments: tempItem.comments,
            deadline: deadlineString,
            description: desc,
            plantCode,
            priority,
            responsible_role: responsibleRole,
            status,
            userId
        })
            .then(({ res, json }) => {
                if (!res.ok || json?.success !== true) {
                    cleanup()
                    return
                }
                CacheUtility.delete('list:items-with-profiles')
                return this.fetchListItems({ force: true }).catch(cleanup)
            })
            .catch(cleanup)
        return tempItem
    }

    /**
     * Updates an existing list item with grammar-cleaned text fields. The local
     * cache is patched immediately so the UI reflects the change without
     * waiting for the network; if the API call fails the patch is reverted.
     */
    async updateListItem(item) {
        if (!item?.id) throw new Error('Item ID is required')
        const desc = GrammarUtility.cleanDescription(item?.description || '')
        if (!desc.trim()) throw new Error('Description is required')
        const cleaned = {
            comments: GrammarUtility.cleanComments(item?.comments || ''),
            completed: item.completed ?? false,
            completed_at: item.completed_at,
            deadline: item.deadline,
            description: desc,
            plant_code: item.plant_code?.trim() ?? '',
            priority: item.priority || 'none',
            responsible_role: item.responsible_role || null,
            status: item.status || 'pending'
        }
        const rollback = this.optimisticPatch(item.id, cleaned)
        try {
            const { res, json } = await APIUtility.post('/list-service/update', {
                item: { ...cleaned, id: item.id }
            })
            if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to update list item')
            CacheUtility.delete('list:items-with-profiles')
            CacheUtility.delete(`${PRIORITY_CACHE_PREFIX}${item.id}`)
            return true
        } catch (err) {
            this.optimisticRevertPatch(item.id, rollback)
            throw err
        }
    }

    /**
     * Toggles completion immediately in the local cache, then confirms with the
     * server. Reverts on failure. Skipping the post-success refetch keeps the
     * interaction feeling instant; the cache key is invalidated so the next
     * load fetches fresh data from the server.
     */
    async toggleCompletion(item, currentUserId) {
        if (!item?.id) throw new Error('Item ID is required')
        if (!currentUserId) throw new Error('No authenticated user')
        const newCompletionStatus = !item.completed
        const rollback = this.optimisticPatch(item.id, {
            completed: newCompletionStatus,
            completed_at: newCompletionStatus ? new Date().toISOString() : null,
            completed_by: newCompletionStatus ? currentUserId : null,
            status:
                newCompletionStatus && item.status !== 'completed'
                    ? 'completed'
                    : !newCompletionStatus && item.status === 'completed'
                      ? 'pending'
                      : item.status
        })
        try {
            const { res, json } = await APIUtility.post('/list-service/toggle-completion', {
                completed: newCompletionStatus,
                currentUserId,
                id: item.id
            })
            if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to toggle completion')
            CacheUtility.delete('list:items-with-profiles')
            return true
        } catch (err) {
            this.optimisticRevertPatch(item.id, rollback)
            throw err
        }
    }

    /** Removes the item from the local cache immediately, then deletes server-side. */
    async deleteListItem(id) {
        if (!id) throw new Error('Item ID is required')
        const rollback = this.optimisticRemove(id)
        try {
            const { res, json } = await APIUtility.post('/list-service/delete', { id })
            if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete list item')
            CacheUtility.delete('list:items-with-profiles')
            return true
        } catch (err) {
            this.optimisticRestore(rollback)
            throw err
        }
    }

    /**
     * Fetches the activity feed from the list_items_activity table.
     * Returns activity entries with resolved user profiles.
     * @param {{ limit?: number, offset?: number }} opts - Pagination options.
     * @returns {Promise<{entries: Array, profiles: Object}>}
     */
    async fetchActivityFeed(opts = {}) {
        const { limit = 100, offset = 0 } = opts
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const cacheKey = `list:activity:${limit}:${offset}`
        const cached = CacheUtility.get(cacheKey)
        if (cached) return cached
        const { res, json } = await APIUtility.post('/list-service/fetch-activity', { limit, offset, since })
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch activity')
        const profilesArr = json?.profiles ?? []
        const profiles = {}
        for (const p of profilesArr) {
            if (p?.id) profiles[p.id] = p
        }
        const result = { entries: json?.data ?? [], profiles }
        CacheUtility.set(cacheKey, result, 30_000)
        return result
    }

    /** Fetches planned items within a date range for calendar views. */
    async fetchPlannedItems(startDate, endDate) {
        const { res, json } = await APIUtility.post('/list-service/fetch-planned-items', { endDate, startDate })
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch planned items')
        return json?.data ?? []
    }

    /** Associates a list item with a planned date for scheduling. */
    async addPlannedItem(listItemId, plannedDate) {
        const user = await UserService.getCurrentUser()
        const { res, json } = await APIUtility.post('/list-service/add-planned-item', {
            listItemId,
            plannedDate,
            userId: user?.id
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to add planned item')
        return json
    }

    /** Removes a planned date association from a list item. */
    async removePlannedItem(listItemId, plannedDate) {
        const { res, json } = await APIUtility.post('/list-service/remove-planned-item', { listItemId, plannedDate })
        if (!res.ok) throw new Error(json?.error || 'Failed to remove planned item')
        return json
    }

    /** Clears all planned items within a date range. */
    async clearPlannedItems(startDate, endDate) {
        const { res, json } = await APIUtility.post('/list-service/clear-planned-items', { endDate, startDate })
        if (!res.ok) throw new Error(json?.error || 'Failed to clear planned items')
        return json
    }

    /** Invalidates all cached priority scores so the next auto-plan re-scores everything. */
    invalidateAllPriorityScores() {
        ListItemUtility.invalidateAllPriorityScores()
    }

    /**
     * Retrieves cached priority scores for items that have them, identifies items needing scoring.
     * @returns {{ cached: Map<string, number>, uncached: Array }} Partitioned results.
     */
    partitionItemsByScoreCache(openItems) {
        return ListItemUtility.partitionItemsByScoreCache(openItems)
    }

    /**
     * AI-powered auto-plan: scores open items by operational priority, then distributes
     * the highest-priority items across the week while respecting deadlines and existing plans.
     * Returns assignments grouped by day for progressive rendering.
     */
    async autoPlanWeek(weekDates, existingPlannedItems) {
        const openItems = this.listItems.filter((item) => !item.completed && item.status !== 'completed')
        if (openItems.length === 0) return new Map()
        const alreadyPlannedIds = new Set(existingPlannedItems.map((pi) => pi.list_item_id))
        const plannable = openItems.filter((item) => !alreadyPlannedIds.has(item.id))
        if (plannable.length === 0) return new Map()
        const allScores = await this.getScoresForItems(plannable)
        if (!allScores || allScores.size === 0) return new Map()
        const ranked = [...plannable]
            .map((item) => ({ item, score: allScores.get(item.id) ?? 5 }))
            .sort((a, b) => b.score - a.score)
        const flatAssignments = this.distributeItemsAcrossWeek(ranked, weekDates, existingPlannedItems)
        const byDay = new Map()
        for (const { itemId, plannedDate } of flatAssignments) {
            if (!byDay.has(plannedDate)) byDay.set(plannedDate, [])
            byDay.get(plannedDate).push(itemId)
        }
        return byDay
    }

    /**
     * Fetches priority scores for items. Uses cached AI scores when available,
     * falls back to deterministic scoring, and calls AI for uncached items
     * to get scores + update deadline/status.
     */
    async getScoresForItems(items) {
        const scores = new Map()
        const uncached = []
        for (const item of items) {
            const cached = CacheUtility.get(`${PRIORITY_CACHE_PREFIX}${item.id}`)
            if (cached !== null) {
                scores.set(item.id, cached)
            } else {
                uncached.push(item)
                scores.set(item.id, this.computeDeterministicScore(item))
            }
        }
        if (uncached.length > 0) {
            try {
                const aiResults = await AIService.prioritizeListItems(uncached)
                if (aiResults) {
                    for (const [itemId, data] of aiResults) {
                        scores.set(itemId, data.score)
                        CacheUtility.set(`${PRIORITY_CACHE_PREFIX}${itemId}`, data.score, PRIORITY_CACHE_TTL_MS)
                    }
                    await this.applyAIUpdates(uncached, aiResults)
                }
            } catch {
                // Deterministic scores already set as fallback
            }
        }
        return scores
    }

    /**
     * Applies AI-recommended deadline and status updates to list items.
     * Only updates if the AI suggestion differs from the current value.
     */
    async applyAIUpdates(items, aiResults) {
        for (const item of items) {
            const aiData = aiResults.get(item.id)
            if (!aiData) continue
            const updates = {}
            let needsUpdate = false
            if (aiData.status && aiData.status !== item.status && !item.completed) {
                updates.status = aiData.status
                needsUpdate = true
            }
            if (aiData.deadline) {
                const aiDeadline = new Date(`${aiData.deadline}T17:00:00.000Z`)
                const currentDeadline = item.deadline ? new Date(item.deadline) : null
                if (!currentDeadline || aiDeadline < currentDeadline) {
                    updates.deadline = aiDeadline.toISOString()
                    needsUpdate = true
                }
            }
            if (needsUpdate) {
                try {
                    await this.updateListItem({ ...item, ...updates })
                } catch {}
            }
        }
    }

    /**
     * Distributes ranked items across the week's days, respecting deadlines and per-day caps.
     * Items with deadlines within the week are placed on or before their deadline day.
     */
    distributeItemsAcrossWeek(rankedItems, weekDates, existingPlannedItems) {
        return ListItemUtility.distributeItemsAcrossWeek(
            rankedItems,
            weekDates,
            existingPlannedItems,
            ListItemUtility.MAX_PLANNED_ITEMS_PER_DAY
        )
    }

    // ─── Pure helpers — delegated to ListItemUtility ────────────────────────
    // These shims preserve the existing `ListService.foo(...)` call sites.
    // New code should import the functions directly from `utils/ListItemUtility`.

    formatDate(dateString) {
        return ListItemUtility.formatDate(dateString)
    }

    formatDateForInput(dateString) {
        return ListItemUtility.formatDateForInput(dateString)
    }

    isOverdue(item) {
        return ListItemUtility.isOverdue(item)
    }

    calculateStatusInfo(item) {
        return ListItemUtility.calculateStatusInfo(item)
    }

    getStatusLabel(status) {
        return ListItemUtility.getStatusLabel(status)
    }

    getStatusIcon(status) {
        return ListItemUtility.getStatusIcon(status)
    }

    getStatusColor(status) {
        return ListItemUtility.getStatusColor(status)
    }

    getResponsibleRoleLabel(role) {
        return ListItemUtility.getResponsibleRoleLabel(role)
    }

    getPriorityConfig(priority) {
        return ListItemUtility.getPriorityConfig(priority)
    }

    getPriorityOptions() {
        return ListItemUtility.getPriorityOptions()
    }

    getResponsibleRoleIcon(role) {
        return ListItemUtility.getResponsibleRoleIcon(role)
    }

    truncateText(text, maxLength, byWords = false) {
        return ListItemUtility.truncateText(text, maxLength, byWords)
    }

    getActivityDisplay(action, fieldName) {
        return ListItemUtility.getActivityDisplay(action, fieldName)
    }

    formatActivityValue(fieldName, value) {
        return ListItemUtility.formatActivityValue(fieldName, value)
    }

    formatRelativeTime(timestamp) {
        return ListItemUtility.formatRelativeTime(timestamp)
    }

    computeDeterministicScore(item) {
        return ListItemUtility.computeDeterministicScore(item)
    }

    // ─── Stateful helpers — read from instance caches and delegate ──────────

    /** Filters/sorts the cached `listItems`. Pure logic lives in `ListItemUtility.getFilteredItems`. */
    getFilteredItems(filters) {
        return ListItemUtility.getFilteredItems(this.listItems, filters)
    }

    /** Resolves a plant code to its display name from the cached plants list. */
    getPlantName(plantCode) {
        return ListItemUtility.getPlantName(plantCode, this.plants)
    }

    /** Resolves a creator's display name from the cached profiles. */
    getCreatorName(userId) {
        return ListItemUtility.getProfileName(userId, this.creatorProfiles)
    }

    /** Resolves a user ID to a display name, checking the provided map first then cached creator profiles. */
    getProfileName(userId, profilesMap) {
        if (!userId) return 'Unknown'
        const merged = profilesMap ? { ...this.creatorProfiles, ...profilesMap } : this.creatorProfiles
        return ListItemUtility.getProfileName(userId, merged)
    }

    /** Computes per-plant distribution of total, completed, pending, and overdue items. Caches result on instance. */
    getPlantDistribution(listItems) {
        const distribution = ListItemUtility.getPlantDistribution(listItems)
        this.plantDistribution = distribution
        return distribution
    }
}

export const ListService = new ListServiceImpl()
