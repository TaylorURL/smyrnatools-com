import CacheUtility from '../utils/CacheUtility'
import { Database } from './DatabaseService'
import { PlantService } from './PlantService'
import { UserService } from './UserService'

const TTL_SHORT = 5 * 60 * 1000
const TTL_MED = 10 * 60 * 1000
/** Sorts plants by plant_code numerically, falling back to string comparison. */
function sortPlants(plants) {
    return (plants || [])
        .filter((p) => p.plant_code && p.plant_name)
        .sort((a, b) => {
            const aNum = parseInt(a.plant_code, 10)
            const bNum = parseInt(b.plant_code, 10)
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
            return String(a.plant_code).localeCompare(String(b.plant_code))
        })
}
/**
 * Plant and mixer-roster fetching utilities shared by the Dashboard and
 * Plan/Planner views (plant lists, per-user plant scoping, active mixer
 * operator counts) with light caching.
 */
class ReportServiceImpl {
    /** Fetches active mixer operator counts (assigned + unassigned) grouped by plant code. */
    async fetchActiveMixerCountsByPlant(plantCodes = []) {
        if (!plantCodes || plantCodes.length === 0) return {}
        const [mixersResult, operatorsResult] = await Promise.all([
            Database.from('mixers')
                .select('assigned_plant, assigned_operator')
                .eq('status', 'Active')
                .in('assigned_plant', plantCodes),
            Database.from('operators')
                .select('employee_id, plant_code')
                .eq('status', 'Active')
                .eq('position', 'Mixer Operator')
                .in('plant_code', plantCodes)
        ])
        const counts = {}
        plantCodes.forEach((code) => {
            counts[code] = 0
        })
        if (mixersResult.error || !Array.isArray(mixersResult.data)) return counts
        const assignedOperatorIds = new Set()
        mixersResult.data.forEach((m) => {
            if (m.assigned_operator) assignedOperatorIds.add(m.assigned_operator)
        })
        if (!operatorsResult.error && Array.isArray(operatorsResult.data)) {
            operatorsResult.data.forEach((op) => {
                if (op.plant_code && counts[op.plant_code] !== undefined) {
                    counts[op.plant_code]++
                }
            })
        }
        return counts
    }
    /** Fetches all plants sorted by code with a 10-minute cache. The
     *  Plan → Planner tab consumes `latitude` / `longitude` from these
     *  rows to anchor each plant marker to its real location on the
     *  map, so include them in the select — otherwise plants with
     *  authoritative DB coords silently fall back to geocoding (or fail
     *  outright when their address isn't in OSM). */
    async fetchPlantsSorted() {
        // Cache key bumped to `:v4` because the select now includes
        // `colocated_alias_codes` — older cache entries were missing it
        // and would silently strip the phantom-code co-location
        // mappings for everyone with a warm cache when this lands.
        const cacheKey = 'plants:all:v4'
        const cached = CacheUtility.get(cacheKey)
        if (cached) return cached
        const { data, error } = await Database.from('plants')
            .select('plant_code,plant_name,plant_address,latitude,longitude,location_group_id,colocated_alias_codes')
            .order('plant_code', { ascending: true })
        const plants = !error && Array.isArray(data) ? sortPlants(data) : []
        CacheUtility.set(cacheKey, plants, TTL_MED)
        return plants
    }
    /**
     * Fetches plants accessible to a user based on their profile plant
     * and region memberships, with a 5-minute cache.
     */
    async fetchPlantsForUser(userId) {
        if (!userId) return []
        const cacheKey = `plants:user:${userId}`
        const cached = CacheUtility.get(cacheKey)
        if (cached) return cached
        const basePlants = await this.fetchPlantsSorted()
        try {
            const userPlant = await UserService.getUserPlant(userId)
            if (!userPlant) {
                CacheUtility.set(cacheKey, [], TTL_SHORT)
                return []
            }
            const regions = await PlantService.fetchRegionsByPlantCode(userPlant)
            const regionCodes = Array.isArray(regions) ? regions.map((r) => r.regionCode).filter(Boolean) : []
            if (regionCodes.length === 0) {
                CacheUtility.set(cacheKey, [], TTL_SHORT)
                return []
            }
            const results = await Promise.all(regionCodes.map((rc) => PlantService.fetchRegionPlants(rc)))
            const allowedCodes = new Set()
            results.forEach((list) => {
                const listArr = list || []
                listArr.forEach((rp) => {
                    const c = rp.plantCode || rp.plant_code
                    if (c) allowedCodes.add(String(c).trim())
                })
            })
            const filtered = basePlants.filter((p) => allowedCodes.has(String(p.plant_code).trim()))
            CacheUtility.set(cacheKey, filtered, TTL_SHORT)
            return filtered
        } catch {
            CacheUtility.set(cacheKey, [], TTL_SHORT)
            return []
        }
    }
}
export const ReportService = new ReportServiceImpl()
