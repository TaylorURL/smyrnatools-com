/**
 * District-aware helpers for the Plan view and related features.
 *
 * Districts are stored at the region-plant level: each plant record returned
 * from `PlantService.fetchRegionPlants(regionCode)` has a `districts` array of
 * string names. A user is the District Manager for a district if their own
 * assigned plant (from their profile) has that district in its list.
 */

interface PlantRecord {
    districts?: string[] | null
    district_names?: string[] | null
    plantCode?: string | null
    plant_code?: string | null
    [key: string]: unknown
}

interface RoleRecord {
    name?: string
    [key: string]: unknown
}

type RoleInput = string | RoleRecord

type ScopeKind = 'dispatch' | 'district' | 'plant' | 'region'

interface PlantScope {
    kind: ScopeKind
    label: string
    plantCodes: string[]
    primaryPlantCode: string | null
}

interface BuildYourPlantScopeParams {
    plantNameByCode?: Record<string, string>
    regionPlantCodes?: string[]
    regionPlants?: PlantRecord[]
    roleNames?: RoleInput[]
    userPlantCode?: string
}

/** Normalize a plant record from either PlantService shape (`plant_code`/`plant_name`)
 *  or region-plant shape (`plantCode`/`plantName`). */
export const getPlantCode = (plant: PlantRecord | null | undefined): string | null =>
    plant?.plantCode ?? plant?.plant_code ?? null

/** Extract district names from a plant record, tolerating null/non-array inputs. */
export const getPlantDistricts = (plant: PlantRecord | null | undefined): string[] => {
    const districts = plant?.districts ?? plant?.district_names ?? []
    if (!Array.isArray(districts)) return []
    return districts
        .filter(Boolean)
        .map((d) => String(d).trim())
        .filter(Boolean)
}

/** Find the region-plant record matching a plant code (case-sensitive code match). */
export const findRegionPlant = (
    plantCode: string | null | undefined,
    regionPlants: PlantRecord[] | null | undefined
): PlantRecord | null => {
    if (!plantCode || !Array.isArray(regionPlants)) return null
    return regionPlants.find((p) => getPlantCode(p) === plantCode) || null
}

/** Districts associated with a specific plant code within a region plant list. */
export const getDistrictsForPlantCode = (
    plantCode: string | null | undefined,
    regionPlants: PlantRecord[] | null | undefined
): string[] => getPlantDistricts(findRegionPlant(plantCode, regionPlants))

/**
 * All plant codes in the region that share at least one district with the
 * given plant code. Includes the plant itself when it has a district assigned.
 * Returns [] if the plant has no districts (i.e. no meaningful scope).
 */
export const getDistrictPlantCodes = (
    plantCode: string | null | undefined,
    regionPlants: PlantRecord[] | null | undefined
): string[] => {
    const own = new Set(getDistrictsForPlantCode(plantCode, regionPlants))
    if (own.size === 0) return []
    const matches = new Set<string>()
    for (const plant of regionPlants || []) {
        const code = getPlantCode(plant)
        if (!code) continue
        const districts = getPlantDistricts(plant)
        if (districts.some((d) => own.has(d))) matches.add(code)
    }
    return Array.from(matches)
}

/* -- Role-name predicates ------------------------------------------------- */

const normalizeRoleName = (name: string | null | undefined): string =>
    String(name || '')
        .trim()
        .toLowerCase()

/** True for "Plant Manager" or any role containing "Plant Manager" (e.g. "Senior Plant Manager"). */
export const isPlantManagerRole = (name: string | null | undefined): boolean =>
    normalizeRoleName(name).includes('plant manager')
export const isGeneralManagerRole = (name: string | null | undefined): boolean =>
    normalizeRoleName(name).includes('general manager')
export const isDistrictManagerRole = (name: string | null | undefined): boolean =>
    normalizeRoleName(name).includes('district manager')
export const isDispatchManagerRole = (name: string | null | undefined): boolean =>
    normalizeRoleName(name).includes('dispatch manager')
/** Matches "Dispatcher" but not "Dispatch Manager" (handled above). */
export const isDispatcherRole = (name: string | null | undefined): boolean => {
    const normalized = normalizeRoleName(name)
    return normalized.includes('dispatcher') && !normalized.includes('manager')
}
/** True for any dispatch-focused role (Dispatcher or Dispatch Manager). */
export const isDispatchRole = (name: string | null | undefined): boolean =>
    isDispatcherRole(name) || isDispatchManagerRole(name)

/* -- Scope resolution for the Plan "Your Plant" section ------------------- */

/**
 * Shape of the scope object returned to the Plan dashboard.
 * - `kind`: 'plant' | 'district' | 'region'
 * - `plantCodes`: the plants the current user is responsible for
 * - `label`: heading text for the section
 * - `primaryPlantCode`: the user's own plant, when relevant
 */
export const buildYourPlantScope = ({
    plantNameByCode = {},
    regionPlantCodes = [],
    regionPlants = [],
    roleNames = [],
    userPlantCode = ''
}: BuildYourPlantScopeParams): PlantScope | null => {
    const names = (roleNames || []).map((r) => (typeof r === 'string' ? r : r?.name)).filter(Boolean) as string[]
    const hasGm = names.some(isGeneralManagerRole)
    const hasDispatch = names.some(isDispatchRole)
    const hasDm = names.some(isDistrictManagerRole)
    const hasPm = names.some(isPlantManagerRole)

    if (hasGm) {
        const codes = Array.from(new Set(regionPlantCodes)).sort()
        if (codes.length === 0) return null
        return {
            kind: 'region',
            label: 'Your region',
            plantCodes: codes,
            primaryPlantCode: userPlantCode || null
        }
    }

    if (hasDispatch) {
        const codes = Array.from(new Set(regionPlantCodes)).sort()
        if (codes.length === 0) return null
        return {
            kind: 'dispatch',
            label: 'Your dispatch \u00b7 region-wide',
            plantCodes: codes,
            primaryPlantCode: userPlantCode || null
        }
    }

    if (hasDm && userPlantCode) {
        const districtCodes = getDistrictPlantCodes(userPlantCode, regionPlants)
        if (districtCodes.length === 0) return null
        const districts = getDistrictsForPlantCode(userPlantCode, regionPlants)
        const districtLabel = districts.length === 1 ? `\u00b7 ${districts[0]}` : `\u00b7 ${districts.length} districts`
        return {
            kind: 'district',
            label: `Your district ${districtLabel}`,
            plantCodes: Array.from(new Set(districtCodes)).sort(),
            primaryPlantCode: userPlantCode
        }
    }

    if (hasPm && userPlantCode) {
        const name = plantNameByCode?.[userPlantCode] || ''
        return {
            kind: 'plant',
            label: `Your plant \u00b7 ${userPlantCode}${name ? ` \u00b7 ${name}` : ''}`,
            plantCodes: [userPlantCode],
            primaryPlantCode: userPlantCode
        }
    }

    return null
}
