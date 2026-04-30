import { useCallback, useMemo } from 'react'

import { formatOrderAddress } from '../../utils/AddressUtility'
import { clean, CLOSER_PLANT_MIN_SAVINGS, isLikelyBadAddress } from '../../utils/PlanScheduleUtility'

const composeAddress = (order) => formatOrderAddress(order, ', ')

/**
 * Resolve the effective city for an order — using the plant's city as a
 * fallback when dispatch didn't enter one. Mirrors the geocoding logic used
 * elsewhere in the schedule so every "where is this job" lookup keys off the
 * same string.
 */
const orderWithFallbackCity = (order, plantCityByCode) => {
    if (clean(order?.city)) return order
    const fallbackCity = plantCityByCode?.[order?.plantCode] || ''
    return fallbackCity ? { ...order, city: fallbackCity } : order
}

/**
 * For every job address with assigned plant(s), find a non-assigned plant
 * whose live drive time is shorter than the assigned plant's by at least
 * `CLOSER_PLANT_MIN_SAVINGS` minutes. Returns:
 *   - `travelPairs` — flat list of `(origin, destination)` lookups to prefetch
 *   - `getCloserPlantForOrder(order)` — closer-plant descriptor for an order
 *
 * The travel-pair set only includes orders with valid addresses; bad / empty
 * addresses are skipped entirely so we don't waste live-traffic quota on
 * placeholder strings the dispatcher hasn't fixed yet.
 */
export default function useCloserPlantLookup({ allOrders, getLiveTravelMinutes, plantCityByCode, plantOptionsForMap }) {
    /** Unique `(plant, job)` pairs that have addresses on both sides. Includes
     *  pairs for every plant in `plantOptionsForMap` so the address column can
     *  flag jobs that are closer to a non-assigned plant. The edge function
     *  caches by 15-min bucket, so the additional pairs hit the cache on every
     *  render after the first fetch wave. */
    const travelPairs = useMemo(() => {
        const seen = new Map()
        const candidatePlants = (plantOptionsForMap || []).filter((p) => p.address)
        for (const o of allOrders) {
            if (isLikelyBadAddress(clean(o.address))) continue
            const orderForGeocode = orderWithFallbackCity(o, plantCityByCode)
            const jobAddr = composeAddress(orderForGeocode)
            if (!jobAddr) continue
            for (const p of candidatePlants) {
                const key = `${p.code}::${jobAddr}`
                if (!seen.has(key)) seen.set(key, { destination: jobAddr, key, origin: p.address })
            }
        }
        return Array.from(seen.values())
    }, [allOrders, plantCityByCode, plantOptionsForMap])

    /** Per-job-address closer-plant descriptor, or null when there isn't one
     *  with enough savings or we don't yet have live data to compare. Keyed
     *  by job address so every order at the same address shares the lookup. */
    const closerPlantByJobAddr = useMemo(() => {
        const out = {}
        const byJob = new Map()
        for (const o of allOrders) {
            if (!o.plantCode) continue
            const orderForKey = orderWithFallbackCity(o, plantCityByCode)
            const jobAddr = composeAddress(orderForKey)
            if (!jobAddr) continue
            if (!byJob.has(jobAddr)) byJob.set(jobAddr, new Set())
            byJob.get(jobAddr).add(o.plantCode)
        }
        for (const [jobAddr, assignedPlants] of byJob.entries()) {
            const candidatePlants = plantOptionsForMap || []
            let bestPlant = null
            let bestMinutes = Infinity
            for (const p of candidatePlants) {
                if (!p.address) continue
                const mins = getLiveTravelMinutes(`${p.code}::${jobAddr}`)
                if (!Number.isFinite(mins)) continue
                if (mins < bestMinutes) {
                    bestMinutes = mins
                    bestPlant = p
                }
            }
            if (!bestPlant) continue
            // Compare against the best assigned plant for this job — if the
            // job is split between two assigned plants we don't want to flag
            // it as "closer to plant X" if X is already one of them.
            if (assignedPlants.has(bestPlant.code)) continue
            let assignedMin = Infinity
            for (const code of assignedPlants) {
                const mins = getLiveTravelMinutes(`${code}::${jobAddr}`)
                if (Number.isFinite(mins) && mins < assignedMin) assignedMin = mins
            }
            if (!Number.isFinite(assignedMin)) continue
            const savings = assignedMin - bestMinutes
            if (savings < CLOSER_PLANT_MIN_SAVINGS) continue
            out[jobAddr] = {
                assignedMinutes: assignedMin,
                minutes: bestMinutes,
                plantCode: bestPlant.code,
                plantName: bestPlant.name,
                savings
            }
        }
        return out
    }, [allOrders, getLiveTravelMinutes, plantCityByCode, plantOptionsForMap])

    const getCloserPlantForOrder = useCallback(
        (order) => {
            if (!order?.plantCode) return null
            const orderForKey = orderWithFallbackCity(order, plantCityByCode)
            const jobAddr = composeAddress(orderForKey)
            if (!jobAddr) return null
            const closer = closerPlantByJobAddr[jobAddr]
            if (!closer) return null
            // Only flag for orders whose assigned plant is the slow one.
            if (closer.plantCode === order.plantCode) return null
            return closer
        },
        [closerPlantByJobAddr, plantCityByCode]
    )

    return { getCloserPlantForOrder, travelPairs }
}
