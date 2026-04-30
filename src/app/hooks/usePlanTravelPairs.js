import { useMemo } from 'react'

import { formatOrderAddress } from '../../utils/AddressUtility'
import { clean, isLikelyBadAddress } from '../../utils/PlanScheduleUtility'

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
 * Compute the unique `(plant, job)` pairs that need a live-traffic lookup.
 *
 * Pulled out of `useCloserPlantLookup` so the closer-plant memo can take a
 * `getLiveTravelMinutes` input without forcing a circular call (the lookup
 * needs travel data; travel data needs the pair list). With this split the
 * consumer just chains:
 *
 *     const pairs = usePlanTravelPairs(...)
 *     const { getMinutes } = useLiveTravelTimes(pairs)
 *     const { getCloserPlantForOrder } = useCloserPlantLookup(..., getMinutes)
 *
 * No stub callbacks, no double-render of the closer-plant hook.
 *
 * Returns a flat list of `{ key, origin, destination }` entries — one per
 * `(candidate plant, distinct job address)` combination. Bad / empty
 * addresses are skipped so we don't waste live-traffic quota on placeholder
 * strings the dispatcher hasn't fixed yet.
 */
export default function usePlanTravelPairs({ allOrders, plantCityByCode, plantOptionsForMap }) {
    return useMemo(() => {
        const seen = new Map()
        const candidatePlants = (plantOptionsForMap || []).filter((p) => p.address)
        for (const o of allOrders || []) {
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
}
