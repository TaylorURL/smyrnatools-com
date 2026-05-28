import L from 'leaflet'
import { useEffect } from 'react'

import { DIRECT_LOAD_COLOR } from '../../views/tools/plan/flow-map/flowMapShared'

/** Dotted "loaded direct" job → home-plant lines.
 *
 *  For every assignment that loads direct to a specific job (`forOrderId`
 *  set, address geocoded), draw a thin dotted straight line from the
 *  geocoded job location to the plant the order is assigned to
 *  (`toPlant`). Pure relationship indicator — sits below the animated
 *  transit polylines so the dispatcher can see at a glance which plant
 *  owns each job pin without the line competing visually with the active
 *  route chrome. Dedupe is keyed by `${forOrderId}@${toPlant}` so multiple
 *  help routes converging on the same job collapse to a single line. */
export function useDirectLoadLines({
    assignments,
    directLinesByKeyRef,
    geocodedPlants,
    jobRoutesByIdx,
    routeLayerRef
}) {
    useEffect(() => {
        const layer = routeLayerRef.current
        if (!layer) return undefined
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
        const wanted = new Map()
        Object.entries(jobRoutesByIdx).forEach(([idxStr, entry]) => {
            const assignment = assignments[Number(idxStr)]
            if (!assignment?.toPlant || assignment.forOrderId !== entry.forOrderId) return
            if (!entry.jobCoords) return
            const dest = plantsByCode.get(assignment.toPlant)
            if (!dest) return
            const key = `${entry.forOrderId}@${assignment.toPlant}`
            if (wanted.has(key)) return
            wanted.set(key, {
                coords: [
                    [entry.jobCoords.lat, entry.jobCoords.lng],
                    [dest.lat, dest.lng]
                ]
            })
        })
        Object.keys(directLinesByKeyRef.current).forEach((k) => {
            if (!wanted.has(k)) {
                layer.removeLayer(directLinesByKeyRef.current[k])
                delete directLinesByKeyRef.current[k]
            }
        })
        wanted.forEach(({ coords }, key) => {
            const existing = directLinesByKeyRef.current[key]
            if (existing) {
                existing.setLatLngs(coords)
                return
            }
            const line = L.polyline(coords, {
                className: 'pf-direct-load-line',
                color: DIRECT_LOAD_COLOR,
                dashArray: '2 6',
                interactive: false,
                lineCap: 'round',
                opacity: 0.7,
                weight: 2
            })
            line.addTo(layer)
            directLinesByKeyRef.current[key] = line
        })
        return undefined
    }, [assignments, directLinesByKeyRef, geocodedPlants, jobRoutesByIdx, routeLayerRef])
}
