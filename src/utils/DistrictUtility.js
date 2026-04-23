/**
 * District-aware helpers for the Plan view and related features.
 *
 * Districts are stored at the region-plant level: each plant record returned
 * from `PlantService.fetchRegionPlants(regionCode)` has a `districts` array of
 * string names. A user is the District Manager for a district if their own
 * assigned plant (from their profile) has that district in its list.
 */

/** Normalize a plant record from either PlantService shape (`plant_code`/`plant_name`)
 *  or region-plant shape (`plantCode`/`plantName`). */
export const getPlantCode = (plant) => plant?.plantCode ?? plant?.plant_code ?? null

/** Extract district names from a plant record, tolerating null/non-array inputs. */
export const getPlantDistricts = (plant) => {
    const districts = plant?.districts ?? plant?.district_names ?? []
    if (!Array.isArray(districts)) return []
    return districts
        .filter(Boolean)
        .map((d) => String(d).trim())
        .filter(Boolean)
}

/** Find the region-plant record matching a plant code (case-sensitive code match). */
export const findRegionPlant = (plantCode, regionPlants) => {
    if (!plantCode || !Array.isArray(regionPlants)) return null
    return regionPlants.find((p) => getPlantCode(p) === plantCode) || null
}

/** Districts associated with a specific plant code within a region plant list. */
export const getDistrictsForPlantCode = (plantCode, regionPlants) =>
    getPlantDistricts(findRegionPlant(plantCode, regionPlants))

/**
 * All plant codes in the region that share at least one district with the
 * given plant code. Includes the plant itself when it has a district assigned.
 * Returns [] if the plant has no districts (i.e. no meaningful scope).
 */
export const getDistrictPlantCodes = (plantCode, regionPlants) => {
    const own = new Set(getDistrictsForPlantCode(plantCode, regionPlants))
    if (own.size === 0) return []
    const matches = new Set()
    for (const plant of regionPlants || []) {
        const code = getPlantCode(plant)
        if (!code) continue
        const districts = getPlantDistricts(plant)
        if (districts.some((d) => own.has(d))) matches.add(code)
    }
    return Array.from(matches)
}

/**
 * Resolve the district manager for a plant by scanning a list of candidate
 * users. A user qualifies if their own assigned plant shares at least one
 * district with the given plant (within the provided region plant list).
 *
 * @param {object} plant - The plant to look up (any shape with `plant_code`/`plantCode`).
 * @param {object} options
 * @param {Array<object>} options.regionPlants - Region plant records with district info.
 * @param {Array<{id, name, plant_code}>} options.candidateUsers - Users to check
 *        (pre-filtered to those with a plant assignment, ideally with a
 *        District-Manager-ish role).
 * @returns {object|null} The first matching user, or null.
 */
export const getDistrictManager = (plant, { candidateUsers = [], regionPlants = [] } = {}) => {
    const targetDistricts = new Set(getPlantDistricts(plant))
    if (targetDistricts.size === 0) return null
    for (const user of candidateUsers) {
        const userPlantCode = user?.plant_code ?? user?.plantCode
        if (!userPlantCode) continue
        const userDistricts = getDistrictsForPlantCode(userPlantCode, regionPlants)
        if (userDistricts.some((d) => targetDistricts.has(d))) return user
    }
    return null
}

/* ── Role-name predicates ────────────────────────────────────────────────── */

const normalizeRoleName = (name) =>
    String(name || '')
        .trim()
        .toLowerCase()

/** True for "Plant Manager" or any role containing "Plant Manager" (e.g. "Senior Plant Manager"). */
export const isPlantManagerRole = (name) => normalizeRoleName(name).includes('plant manager')
export const isGeneralManagerRole = (name) => normalizeRoleName(name).includes('general manager')
export const isDistrictManagerRole = (name) => normalizeRoleName(name).includes('district manager')
export const isDispatchManagerRole = (name) => normalizeRoleName(name).includes('dispatch manager')
/** Matches "Dispatcher" but not "Dispatch Manager" (handled above). */
export const isDispatcherRole = (name) => {
    const normalized = normalizeRoleName(name)
    return normalized.includes('dispatcher') && !normalized.includes('manager')
}
/** True for any dispatch-focused role (Dispatcher or Dispatch Manager). */
export const isDispatchRole = (name) => isDispatcherRole(name) || isDispatchManagerRole(name)

/** Any of the roles the `plan.yourtab` section is designed for. */
export const isYourTabRole = (name) =>
    isPlantManagerRole(name) || isGeneralManagerRole(name) || isDistrictManagerRole(name) || isDispatchRole(name)

/* ── Scope resolution for the Plan "Your Plant" section ──────────────────── */

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
}) => {
    const names = (roleNames || []).map((r) => (typeof r === 'string' ? r : r?.name)).filter(Boolean)
    const hasGm = names.some(isGeneralManagerRole)
    const hasDispatch = names.some(isDispatchRole)
    const hasDm = names.some(isDistrictManagerRole)
    const hasPm = names.some(isPlantManagerRole)

    // Highest scope wins: GM → full region, Dispatch → full region (custom framing),
    // DM → their district, PM → own plant.
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
            label: 'Your dispatch · region-wide',
            plantCodes: codes,
            primaryPlantCode: userPlantCode || null
        }
    }

    if (hasDm && userPlantCode) {
        const districtCodes = getDistrictPlantCodes(userPlantCode, regionPlants)
        if (districtCodes.length === 0) return null
        const districts = getDistrictsForPlantCode(userPlantCode, regionPlants)
        const districtLabel = districts.length === 1 ? `· ${districts[0]}` : `· ${districts.length} districts`
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
            label: `Your plant · ${userPlantCode}${name ? ` · ${name}` : ''}`,
            plantCodes: [userPlantCode],
            primaryPlantCode: userPlantCode
        }
    }

    return null
}
