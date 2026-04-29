import APIUtility from '../utils/APIUtility'
const SERVICE_PREFIX = 'plan-service'
/**
 * Shared daily dispatch planning service managing inter-plant travel times
 * and collaborative daily assignment plans.
 */
class PlanServiceImpl {
    travelTimesCache = null
    /** Fetches all configured travel times between plants. */
    async fetchTravelTimes() {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-travel-times`)
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch travel times')
        const data = json?.data ?? []
        this.travelTimesCache = data
        return data
    }
    /** Creates or updates a travel time entry between two plants. */
    async upsertTravelTime(fromPlantCode, toPlantCode, travelMinutes) {
        if (!fromPlantCode || !toPlantCode || typeof travelMinutes !== 'number') {
            throw new Error('fromPlantCode, toPlantCode, and travelMinutes are required')
        }
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/upsert-travel-time`, {
            fromPlantCode,
            toPlantCode,
            travelMinutes
        })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to save travel time')
        this.travelTimesCache = null
        return true
    }
    /** Removes a travel time configuration between two plants. */
    async deleteTravelTime(fromPlantCode, toPlantCode) {
        if (!fromPlantCode || !toPlantCode) {
            throw new Error('fromPlantCode and toPlantCode are required')
        }
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/delete-travel-time`, {
            fromPlantCode,
            toPlantCode
        })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete travel time')
        this.travelTimesCache = null
        return true
    }
    /** Looks up a cached travel time between two plants. Returns null if not cached. */
    getTravelTime(fromPlantCode, toPlantCode) {
        if (!this.travelTimesCache) return null
        const entry = this.travelTimesCache.find(
            (t) => t.from_plant_code === fromPlantCode && t.to_plant_code === toPlantCode
        )
        return entry?.travel_minutes ?? null
    }
    /** Builds a lookup map of all cached travel times keyed by "from→to" plant pairs. */
    getTravelTimesMap() {
        if (!this.travelTimesCache) return {}
        const map = {}
        for (const entry of this.travelTimesCache) {
            const key = `${entry.from_plant_code}->${entry.to_plant_code}`
            map[key] = entry.travel_minutes
        }
        return map
    }
    /** Fetches the shared plan for a specific date. */
    async fetchPlan(planDate) {
        if (!planDate) return null
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-plan`, { planDate })
        if (!res.ok) return null
        return json?.data ?? null
    }
    /**
     * Fetches every saved plan whose `plan_date` falls within `[startDate, endDate]`
     * (inclusive). Returns an array of raw plan rows in ascending date order.
     * Used by the Statistics tab to compute trend / comparison metrics across
     * arbitrary day-, week-, or month-sized windows.
     *
     * Tries the bulk `fetch-plans-range` endpoint first; falls back to parallel
     * per-day `fetch-plan` calls if the bulk endpoint is unavailable (e.g. not
     * yet deployed). Either way the caller gets the same shape.
     */
    async fetchPlansInRange(startDate, endDate) {
        if (!startDate || !endDate) return []
        try {
            const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-plans-range`, {
                endDate,
                startDate
            })
            if (res?.ok && Array.isArray(json?.data)) return json.data
        } catch {
            /* fall through to per-day fetches below */
        }
        const dates = []
        const cursor = new Date(`${startDate}T00:00:00`)
        const end = new Date(`${endDate}T00:00:00`)
        while (cursor <= end) {
            const y = cursor.getFullYear()
            const m = String(cursor.getMonth() + 1).padStart(2, '0')
            const d = String(cursor.getDate()).padStart(2, '0')
            dates.push(`${y}-${m}-${d}`)
            cursor.setDate(cursor.getDate() + 1)
        }
        const results = await Promise.allSettled(dates.map((d) => this.fetchPlan(d)))
        return results
            .map((r, i) => (r.status === 'fulfilled' && r.value ? { ...r.value, plan_date: dates[i] } : null))
            .filter(Boolean)
    }
    /** Returns the ISO date of the most recently saved plan, or null when no plans exist yet. */
    async fetchLatestPlanDate() {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-latest-plan-date`)
        if (!res.ok) return null
        return json?.planDate ?? null
    }
    /** Saves or updates the shared daily plan with assignments and notes. */
    async savePlan(planDate, assignments, notes, plantProduction) {
        if (!planDate) throw new Error('planDate is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/save-plan`, {
            assignments: assignments || [],
            notes: notes || '',
            planDate,
            plantProduction: plantProduction || {}
        })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to save plan')
        return true
    }
    /** Fetches all saved plan templates for a user. */
    async fetchTemplates(userId) {
        if (!userId) return []
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-templates`, { userId })
        if (!res.ok) return []
        return json?.data ?? []
    }
    /** Saves the current plan as a named template. */
    async saveTemplate(userId, name, assignments, notes) {
        if (!userId || !name) throw new Error('userId and name are required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/save-template`, {
            assignments: assignments || [],
            name,
            notes: notes || '',
            userId
        })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to save template')
        return true
    }
    /** Deletes a saved plan template by ID. */
    async deleteTemplate(templateId) {
        if (!templateId) throw new Error('templateId is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/delete-template`, { templateId })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete template')
        return true
    }
}
export const PlanService = new PlanServiceImpl()
