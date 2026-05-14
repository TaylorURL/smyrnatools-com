import { useEffect, useMemo, useState } from 'react'

import { PlantService } from '../../services/PlantService'
import { UserService } from '../../services/UserService'

/**
 * Resolves the report owner's region scope. Used by both the Submit and
 * Review plugins of the Ready Mix Instructor report so they share identical
 * region-narrowing logic.
 *
 * Inputs are flexible: pass `userPlantCode` (already resolved by parent),
 * `userId` (lookup from `users_profiles`), or neither (falls back to the
 * current user). The hook produces:
 *
 *   - `resolvedRegionCodes`: a Set of uppercase plant codes, or null while
 *     resolution is in flight / on failure
 *   - `regionPlantCodes`: same Set, narrowed by the `plants` prop when
 *     resolution failed (so callers always have a usable scope)
 *   - `regionalPlants`: a plant-record list scoped to the region, suitable
 *     for the hiring-goals table
 *   - `isInRegion(op)`: predicate against `op.plantCode`
 */
export function useRmiRegionScope({ plants, useCurrentUser, userId, userPlantCode }) {
    const [resolvedRegionCodes, setResolvedRegionCodes] = useState(null)

    useEffect(() => {
        let cancelled = false
        async function resolve() {
            try {
                let plantCode = (userPlantCode || '').trim()
                if (!plantCode) {
                    let ownerId = userId
                    if (!ownerId && useCurrentUser) {
                        const user = await UserService.getCurrentUser()
                        ownerId = user?.id
                    }
                    if (!ownerId) return
                    const profilePlant = await UserService.getUserPlant(ownerId)
                    plantCode =
                        typeof profilePlant === 'string'
                            ? profilePlant
                            : profilePlant?.plant_code || profilePlant?.plantCode || ''
                }
                if (!plantCode) return
                const regions = await PlantService.fetchRegionsByPlantCode(plantCode)
                const regionCodes = (Array.isArray(regions) ? regions : [])
                    .map((r) => r?.regionCode || r?.region_code)
                    .filter(Boolean)
                if (regionCodes.length === 0) return
                const lists = await Promise.all(regionCodes.map((rc) => PlantService.fetchRegionPlants(rc)))
                const set = new Set()
                lists.forEach((list) =>
                    (list || []).forEach((rp) => {
                        const c = rp?.plantCode || rp?.plant_code
                        if (c) set.add(String(c).trim().toUpperCase())
                    })
                )
                if (!cancelled) setResolvedRegionCodes(set)
            } catch {
                /* Region resolution is best-effort — fall back to the plants prop. */
            }
        }
        resolve()
        return () => {
            cancelled = true
        }
    }, [userId, userPlantCode, useCurrentUser])

    /** Region plant codes used for operator filtering. Prefers the directly
     *  resolved set; falls back to whatever's in `plants` so we don't block
     *  the user when resolution is still in flight or fails. */
    const regionPlantCodes = useMemo(() => {
        if (resolvedRegionCodes && resolvedRegionCodes.size > 0) return resolvedRegionCodes
        const set = new Set()
        ;(plants || []).forEach((p) => {
            const code = p?.plant_code || p?.code
            if (code) set.add(String(code).trim().toUpperCase())
        })
        return set
    }, [plants, resolvedRegionCodes])

    /** Plants list narrowed to the user's region for the Hiring Goals table.
     *  Strict mode when `resolvedRegionCodes` is available; permissive
     *  fallback to the `plants` prop when resolution is in flight or has
     *  failed (better than showing an empty table). */
    const regionalPlants = useMemo(() => {
        if (!resolvedRegionCodes || resolvedRegionCodes.size === 0) return plants || []
        const byCode = new Map()
        ;(plants || []).forEach((p) => {
            const c = String(p?.plant_code || p?.code || '')
                .trim()
                .toUpperCase()
            if (c) byCode.set(c, p)
        })
        return Array.from(resolvedRegionCodes)
            .map((code) => byCode.get(code) || { plant_code: code, plant_name: code })
            .sort((a, b) => (a.plant_code || '').localeCompare(b.plant_code || ''))
    }, [plants, resolvedRegionCodes])

    const isInRegion = useMemo(
        () => (op) =>
            regionPlantCodes.has(
                String(op?.plantCode || '')
                    .trim()
                    .toUpperCase()
            ),
        [regionPlantCodes]
    )

    return { isInRegion, regionPlantCodes, regionalPlants, resolvedRegionCodes }
}
