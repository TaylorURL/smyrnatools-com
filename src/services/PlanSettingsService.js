import { hydrateBookOrderSettings } from '../app/constants/bookOrderConstants'
import { hydratePlanSettings } from '../app/constants/planConstants'
import APIUtility from '../utils/APIUtility'
import { hydratePlanScheduleSettings } from '../utils/PlanScheduleUtility'

const SERVICE_PREFIX = 'plan-service'

/**
 * Per-region operational settings for the Plan / Operations view. Reads
 * the `plan_settings` row for the supplied `regionCode` via the
 * `plan-service` edge function, then fans the snapshot out to the three
 * runtime-mutable constant modules so every dispatcher-tunable value
 * (pre-trip / load / slump / DOT cap / big-pour thresholds / slot grid)
 * is sourced from the database without code changes at the call site.
 *
 * The application falls back to baked-in defaults when no row exists or
 * the fetch fails — every consumer reads constants via ESM live
 * bindings, so a missing row simply leaves the hardcoded values in
 * place. This keeps the planner functional even before a dispatcher has
 * saved overrides for the active region.
 */
class PlanSettingsServiceImpl {
    /** Latest snapshot applied via `hydrate`. `null` until first fetch. */
    currentSnapshot = null
    /** Region code the current snapshot belongs to. Tracked so a no-op
     *  re-hydration on the same region can be detected by callers. */
    currentRegionCode = null

    /**
     * Fetch the settings row for one region. Returns `null` when the
     * region has no row yet — callers should treat that as "use defaults"
     * and not block on it.
     */
    async fetchByRegion(regionCode) {
        if (!regionCode) return null
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-plan-settings`, { regionCode })
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch plan settings')
        return json?.data ?? null
    }

    /**
     * Insert or update the settings row for one region. The edge
     * function enforces CHECK constraints from the migration; the
     * server-side error message bubbles up unchanged so the form can
     * display a precise validation reason.
     */
    async upsertByRegion(regionCode, patch) {
        if (!regionCode) throw new Error('regionCode is required')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/upsert-plan-settings`, { patch, regionCode })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to save plan settings')
        return json?.data ?? null
    }

    /**
     * Push a snapshot through every constant module. Called after a
     * fetch and after a successful upsert so the active session reflects
     * the new values immediately. A `null` snapshot resets in-memory
     * state without mutating constants — the previous values remain.
     */
    hydrate(snapshot, regionCode = null) {
        this.currentSnapshot = snapshot ?? null
        this.currentRegionCode = regionCode
        if (!snapshot) return
        hydratePlanSettings(snapshot)
        hydratePlanScheduleSettings(snapshot)
        hydrateBookOrderSettings(snapshot)
    }

    /**
     * Convenience: fetch + hydrate in one call. Swallows errors so a
     * settings outage never blocks the rest of the app — the planner
     * keeps using whichever values are already in memory (the baked-in
     * defaults on first launch).
     */
    async loadAndHydrate(regionCode) {
        try {
            const snapshot = await this.fetchByRegion(regionCode)
            this.hydrate(snapshot, regionCode)
            return snapshot
        } catch {
            return null
        }
    }
}

const PlanSettingsService = new PlanSettingsServiceImpl()
export default PlanSettingsService
export { PlanSettingsService }
