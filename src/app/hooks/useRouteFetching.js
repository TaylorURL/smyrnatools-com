import { useEffect, useState } from 'react'

import { getCachedRoute, getDrivingRoute } from '../../utils/RoutingUtility'

/** Fetch OSRM driving routes for every `fromPlant → toPlant` edge across
 *  all assignments. Reads from the routing cache first (cheap) and only
 *  triggers a network request for the misses, decrementing the pending
 *  counter as each one settles so the toolbar progress chip stays honest. */
export function useRouteFetching(assignments, geocodedPlants) {
    const [routesByEdgeKey, setRoutesByEdgeKey] = useState({})
    const [pendingRoutes, setPendingRoutes] = useState(0)

    useEffect(() => {
        let cancelled = false
        async function run() {
            const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
            const valid = assignments
                .map((a, idx) => ({ a, idx }))
                .filter(({ a }) => a.fromPlant && a.toPlant && a.fromPlant !== a.toPlant)
            const seeded = {}
            for (const { a } of valid) {
                const from = plantsByCode.get(a.fromPlant)
                const to = plantsByCode.get(a.toPlant)
                if (!from || !to) continue
                const cached = getCachedRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
                if (cached) seeded[`${a.fromPlant}->${a.toPlant}`] = cached
            }
            if (!cancelled && Object.keys(seeded).length) {
                setRoutesByEdgeKey((prev) => ({ ...prev, ...seeded }))
            }
            const missing = valid.filter(({ a }) => !seeded[`${a.fromPlant}->${a.toPlant}`])
            if (missing.length === 0) return
            setPendingRoutes((n) => n + missing.length)
            for (const { a } of missing) {
                if (cancelled) return
                const from = plantsByCode.get(a.fromPlant)
                const to = plantsByCode.get(a.toPlant)
                if (!from || !to) {
                    setPendingRoutes((n) => Math.max(0, n - 1))
                    continue
                }
                const route = await getDrivingRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
                if (cancelled) return
                setPendingRoutes((n) => Math.max(0, n - 1))
                if (!route) continue
                setRoutesByEdgeKey((prev) => ({ ...prev, [`${a.fromPlant}->${a.toPlant}`]: route }))
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [assignments, geocodedPlants])

    return { pendingRoutes, routesByEdgeKey }
}
