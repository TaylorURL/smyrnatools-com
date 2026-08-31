import CacheUtility from '../utils/CacheUtility'
import { Database } from './DatabaseService'

const TTL_MED = 10 * 60 * 1000
/**
 * Drops rows missing a code or name, then orders by plant code numerically so
 * plant 9 precedes plant 10. Codes that are not numeric sort lexically, which
 * puts them in a stable but arbitrary position relative to the numeric ones.
 */
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
 * Read-only plant list for the dashboard, cached so repeated renders and the
 * dashboard's refresh interval do not re-query on every pass.
 *
 * Reads the `plants` table directly under RLS rather than going through
 * PlantService's edge-function endpoints, so it returns raw snake_case rows,
 * not `Plant` models.
 */
class ReportServiceImpl {
    /** Fetches every plant, sorted by code, cached for TTL_MED.
     *
     *  The select carries the plant's own address and coordinates alongside
     *  its identity, so consumers can place a plant from stored values rather
     *  than geocoding its address, and the co-location columns, so a group of
     *  plants sharing one site can be recognised without a second query. */
    async fetchPlantsSorted() {
        // The cache key's version suffix pins an entry to this exact select
        // list. Adding a column here without bumping the suffix leaves anyone
        // holding a warm entry with rows that silently lack the new field.
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
}
export const ReportService = new ReportServiceImpl()
