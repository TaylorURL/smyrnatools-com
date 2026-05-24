import L from 'leaflet'
import { useEffect } from 'react'

/** Fit the map to the geocoded plants the first time we have at least one
 *  position. `fitBounds` alone leaves the plants hugging the viewport
 *  edges (its "fit" assumes you want everything visible at the looser
 *  zoom). We tighten the result by half a zoom level once bounds are
 *  computed — the same plants stay centered, the basemap reveals more
 *  roads + city context behind them. */
export function useFitToPlants({ geocodedPlants, initiallyFitRef, mapRef }) {
    useEffect(() => {
        if (initiallyFitRef.current) return
        if (!mapRef.current || geocodedPlants.length === 0) return
        const bounds = L.latLngBounds(geocodedPlants.map((p) => [p.lat, p.lng]))
        if (!bounds.isValid()) return
        mapRef.current.fitBounds(bounds, { animate: false, maxZoom: 12, padding: [40, 40] })
        if (geocodedPlants.length > 1) {
            mapRef.current.setView(bounds.getCenter(), mapRef.current.getZoom() + 0.5, { animate: false })
        }
        initiallyFitRef.current = true
    }, [geocodedPlants, initiallyFitRef, mapRef])
}
