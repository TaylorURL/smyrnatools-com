import L from 'leaflet'
import { useEffect, useState } from 'react'

import { getCachedRoute, getDrivingRoute } from '../../utils/RoutingUtility'

/** Resolve coords for the in-progress draft route.
 *
 *  As soon as the user has both a fromPlant and a toPlant on the draft
 *  (whether they're adding a new route or editing an existing one), kick
 *  off the same OSRM lookup we use for committed routes and seed with the
 *  straight-line fallback while we wait. */
function useDraftRouteCoords({ draft, geocodedPlants, panelMode }) {
    const [draftRouteCoords, setDraftRouteCoords] = useState(null)

    useEffect(() => {
        if (panelMode === 'overview' || !draft?.fromPlant || !draft?.toPlant || draft.fromPlant === draft.toPlant) {
            setDraftRouteCoords(null)
            return undefined
        }
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
        const from = plantsByCode.get(draft.fromPlant)
        const to = plantsByCode.get(draft.toPlant)
        if (!from || !to) {
            setDraftRouteCoords(null)
            return undefined
        }
        let cancelled = false
        const straightLine = [
            [from.lat, from.lng],
            [to.lat, to.lng]
        ]
        const cached = getCachedRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
        if (cached?.coords?.length >= 2) {
            setDraftRouteCoords(cached.coords)
            return undefined
        }
        // No cache yet — show the straight-line preview immediately, then
        // upgrade to the real driving route as soon as OSRM responds.
        setDraftRouteCoords(straightLine)
        ;(async () => {
            const route = await getDrivingRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
            if (cancelled) return
            if (route?.coords?.length >= 2) setDraftRouteCoords(route.coords)
        })()
        return () => {
            cancelled = true
        }
    }, [draft?.fromPlant, draft?.toPlant, geocodedPlants, panelMode])

    return draftRouteCoords
}

/** Render the draft polyline.
 *
 *  One bright amber polyline that always sits above the committed routes
 *  so the user can see exactly what they're building. Cleared the moment
 *  the editor closes or either endpoint is unset. */
export function useDraftRoute({ draft, draftPolylineRef, geocodedPlants, panelMode, routeLayerRef }) {
    const draftRouteCoords = useDraftRouteCoords({ draft, geocodedPlants, panelMode })

    useEffect(() => {
        const layer = routeLayerRef.current
        if (!layer) return undefined
        if (draftPolylineRef.current) {
            layer.removeLayer(draftPolylineRef.current.group)
            draftPolylineRef.current = null
        }
        if (!draftRouteCoords) return undefined
        const baseStyle = {
            className: 'help-route-base',
            color: '#f59e0b',
            opacity: 0.92,
            weight: 6
        }
        const flowStyle = {
            className: 'help-route-flow',
            color: '#ffffff',
            dashArray: '10 14',
            lineCap: 'round',
            opacity: 0.95,
            weight: 3
        }
        const group = L.layerGroup()
        const base = L.polyline(draftRouteCoords, baseStyle)
        const flow = L.polyline(draftRouteCoords, flowStyle)
        base.addTo(group)
        flow.addTo(group)
        group.addTo(layer)
        base.bringToFront()
        flow.bringToFront()
        draftPolylineRef.current = { base, flow, group }
        return () => {
            if (draftPolylineRef.current && layer) {
                layer.removeLayer(draftPolylineRef.current.group)
                draftPolylineRef.current = null
            }
        }
    }, [draftPolylineRef, draftRouteCoords, routeLayerRef])
}
