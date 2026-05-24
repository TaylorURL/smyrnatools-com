import { useEffect, useState } from 'react'

import { geocodeAddress, getCachedGeocode } from '../../utils/GeocodingUtility'

/** Geocode every plant in `plants` to `{ code, lat, lng, name }`. Plants
 *  with a stored lat/lng on the row use that directly; the rest fall back
 *  to the cached / live Nominatim lookup keyed by `(address, '', stateHint)`.
 *  Returns the resolved list plus a counter of in-flight Nominatim requests
 *  so the toolbar can surface a progress pill. */
export function usePlantGeocoding(plants, stateHint) {
    const [geocodedPlants, setGeocodedPlants] = useState([])
    const [pendingPlantGeocodes, setPendingPlantGeocodes] = useState(0)

    useEffect(() => {
        let cancelled = false
        async function run() {
            const initial = []
            for (const plant of plants || []) {
                const code = plant.plant_code
                const name = plant.plant_name || code
                let lat = Number.isFinite(plant.latitude) ? plant.latitude : null
                let lng = Number.isFinite(plant.longitude) ? plant.longitude : null
                if (lat == null || lng == null) {
                    const cached = getCachedGeocode(plant.plant_address, '', stateHint)
                    if (cached) {
                        lat = cached.lat
                        lng = cached.lng
                    }
                }
                if (lat != null && lng != null) initial.push({ code, lat, lng, name })
            }
            if (!cancelled) setGeocodedPlants(initial)

            const missing = (plants || []).filter((p) => !(Number.isFinite(p.latitude) && Number.isFinite(p.longitude)))
            if (missing.length === 0) return
            setPendingPlantGeocodes((n) => n + missing.length)
            for (const plant of missing) {
                if (cancelled) return
                const coords = await geocodeAddress(plant.plant_address, '', stateHint)
                if (cancelled) return
                setPendingPlantGeocodes((n) => Math.max(0, n - 1))
                if (!coords) continue
                setGeocodedPlants((prev) => {
                    if (prev.some((p) => p.code === plant.plant_code)) return prev
                    return [
                        ...prev,
                        {
                            code: plant.plant_code,
                            lat: coords.lat,
                            lng: coords.lng,
                            name: plant.plant_name || plant.plant_code
                        }
                    ]
                })
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [plants, stateHint])

    return { geocodedPlants, pendingPlantGeocodes }
}
