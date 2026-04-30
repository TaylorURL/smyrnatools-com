import { useMemo } from 'react'

import { buildYourPlantScope } from '../../utils/DistrictUtility'

/**
 * Centralizes the small derived plant-lookup maps every Plan tab needs
 * (code → name, code → address, plants enriched with district memberships).
 *
 * Also computes `yourPlantScope` — the role-aware "Your Plant / District /
 * Region" filter used by the dashboard. Memoization here keeps every tab
 * from re-deriving these on every render.
 *
 * @param {Object} args
 * @param {Array}  args.plants - Base plant list from `usePlanData`.
 * @param {Array}  args.regionPlants - Region/district memberships.
 * @param {boolean} args.canSeeYourTab - `plan.yourtab` permission.
 * @param {string[]} args.userRoleNames - Role names for the signed-in user.
 * @param {string} args.userPlantCode - Signed-in user's home plant code.
 */
export function usePlanLookups({ canSeeYourTab, plants, regionPlants, userPlantCode, userRoleNames }) {
    const plantNameByCode = useMemo(() => {
        const out = {}
        ;(plants || []).forEach((p) => {
            if (p?.plant_code) out[p.plant_code] = p.plant_name || null
        })
        return out
    }, [plants])

    /** Plant code → street address lookup for the schedule's route map. */
    const plantAddressByCode = useMemo(() => {
        const out = {}
        ;(plants || []).forEach((p) => {
            if (p?.plant_code && p.plant_address) out[p.plant_code] = p.plant_address
        })
        return out
    }, [plants])

    /* Enrich the base plant list with district memberships from the region
     * service so PlantDropdownModal can render the same district groupings
     * the rest of the app shows. Without this merge the plan tabs render an
     * empty Districts section in the picker. */
    const plantsWithDistricts = useMemo(() => {
        if (!regionPlants?.length) return plants || []
        const districtsByCode = {}
        regionPlants.forEach((rp) => {
            const code = rp.plantCode || rp.plant_code
            if (code && rp.districts?.length) districtsByCode[code] = rp.districts
        })
        return (plants || []).map((p) =>
            districtsByCode[p.plant_code] ? { ...p, districts: districtsByCode[p.plant_code] } : p
        )
    }, [plants, regionPlants])

    /* Role-aware scope: Plant Managers see their plant, District Managers see
     * every plant in their district, General Managers see the whole region. */
    const yourPlantScope = useMemo(() => {
        if (!canSeeYourTab) return null
        return buildYourPlantScope({
            plantNameByCode,
            regionPlantCodes: (plants || []).map((p) => p.plant_code).filter(Boolean),
            regionPlants,
            roleNames: userRoleNames,
            userPlantCode
        })
    }, [canSeeYourTab, plantNameByCode, plants, regionPlants, userRoleNames, userPlantCode])

    return { plantAddressByCode, plantNameByCode, plantsWithDistricts, yourPlantScope }
}
