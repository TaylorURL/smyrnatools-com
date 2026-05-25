import { reportTypes } from '../../../../app/types/ReportTypes'
import { ReportUtility } from '../../../../utils/ReportUtility'

/**
 * Build the active review-type options the user can filter by. An option is
 * included when the user either has assigned reports of that type OR has
 * review permission for it. Home Office (`office` region) is locked down to
 * General Manager reports only.
 */
export function buildReviewTypeOptions({ hasAssigned, hasReviewPermission, regionType }) {
    return reportTypes.filter(
        (rt) =>
            (hasAssigned[rt.name] || hasReviewPermission[rt.name]) &&
            (regionType !== 'office' || rt.name === 'general_manager')
    )
}

/**
 * Names of report types the current user is permitted to review. Same office
 * lockdown as `buildReviewTypeOptions`. Returns `[]` while permissions are
 * still loading so downstream queries don't fire with a half-resolved scope.
 */
export function buildAllowedReviewReportNames({ hasReviewPermission, regionType, isLoadingPermissions }) {
    if (isLoadingPermissions) return []
    if (regionType === 'office') return hasReviewPermission['general_manager'] ? ['general_manager'] : []
    return reportTypes
        .filter((rt) => hasReviewPermission[rt.name] && rt.name !== 'general_manager')
        .map((rt) => rt.name)
}

/**
 * Return up to 2 most-recent ISO week strings whose Saturday has already
 * passed. Used by the missing-reports queue to scope its lookback to weeks
 * that are actually due.
 */
export function getPreviousTwoCompletedWeekIsos() {
    const now = new Date()
    const candidates = ReportUtility.getLastNWeekIsos(4, now)
    const completed = []
    for (const iso of candidates) {
        const { saturday } = ReportUtility.getWeekDatesFromIso(iso)
        if (saturday && saturday < now) {
            completed.push(iso)
            if (completed.length === 2) break
        }
    }
    return completed
}

/**
 * Build the set of plant codes the current user is directly associated with
 * (primary + additional). Returns `null` when the user has no plant scope at
 * all, signalling "no MY_PLANTS filter available".
 */
export function buildMyPlantCodesSet({ userPlantCode, userAdditionalPlants }) {
    if (!userPlantCode && !userAdditionalPlants.length) return null
    const codes = new Set()
    if (userPlantCode) codes.add(userPlantCode)
    userAdditionalPlants.forEach((code) => codes.add(code))
    return codes
}

/**
 * Filter the full plant list to the active region and decorate each plant
 * with its districts (when known via `regionPlantsWithDistricts`).
 */
export function buildRegionalPlants({ plants, selectedRegionCode, regionPlantCodes, regionPlantsWithDistricts }) {
    const filtered = plants.filter(
        (p) => !selectedRegionCode || !regionPlantCodes || regionPlantCodes.has(p.plant_code)
    )
    if (!regionPlantsWithDistricts.length) return filtered
    const districtMap = {}
    regionPlantsWithDistricts.forEach((rp) => {
        const code = rp.plantCode || rp.plant_code
        if (code && rp.districts?.length) districtMap[code] = rp.districts
    })
    return filtered.map((p) => (districtMap[p.plant_code] ? { ...p, districts: districtMap[p.plant_code] } : p))
}

/**
 * Resolve the human-readable label for the active plant filter, supporting
 * the synthetic `All`, `MY_PLANTS`, and `DISTRICT:<name>` selections.
 */
export function resolvePlantDisplayText({ filterPlant, regionalPlants }) {
    if (!filterPlant || filterPlant === 'All') return 'All Plants'
    if (filterPlant === 'MY_PLANTS') return 'My Plants'
    if (filterPlant.startsWith('DISTRICT:')) return filterPlant.slice(9)
    const selected = regionalPlants.find((p) => p.plant_code === filterPlant)
    if (selected) return `(${selected.plant_code}) ${selected.plant_name}`
    return 'All Plants'
}

/**
 * Build the pill tabs the user can switch between, based on their
 * permission matrix. Order is fixed: My Reports → Review → Loss → Quality
 * Reports → Quality Issues.
 */
export function buildPillTabs({
    hasAnyAssigned,
    hasAnyReviewPermission,
    hasLostLoadsPermission,
    hasOneOffReviewPermission,
    hasQCStrengthPermission
}) {
    const qualityVisible = hasOneOffReviewPermission?.qc_strength || hasQCStrengthPermission
    return [
        ...(hasAnyAssigned ? [{ icon: 'fa-file-alt', key: 'all', label: 'My Reports' }] : []),
        ...(hasAnyReviewPermission ? [{ icon: 'fa-clipboard-check', key: 'review', label: 'Review' }] : []),
        ...(hasLostLoadsPermission ? [{ icon: 'fa-truck', key: 'lost_loads', label: 'Loss Reports' }] : []),
        ...(qualityVisible ? [{ icon: 'fa-flask', key: 'quality', label: 'Quality Reports' }] : []),
        ...(qualityVisible ? [{ icon: 'fa-clipboard-list', key: 'quality_issues', label: 'Quality Issues' }] : [])
    ]
}
