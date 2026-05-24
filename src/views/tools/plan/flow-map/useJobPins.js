import L from 'leaflet'
import { useEffect, useMemo } from 'react'

import { buildAssignmentDriverTimes } from '../../../../utils/PlanUtility'

/** Aggregate trucks-on-site per job at the current `viewTime`. Each
 *  via-job assignment contributes one count per driver whose work window
 *  covers the current minute (arrived but not yet left). When the
 *  scrubber is in "All day" mode we return an empty list so the pins
 *  only appear while the day is actually playing. */
function useJobNodes({ assignments, jobRoutesByIdx, viewTime }) {
    return useMemo(() => {
        if (!Number.isFinite(viewTime)) return []
        const byKey = new Map()
        Object.entries(jobRoutesByIdx).forEach(([idxStr, entry]) => {
            const idx = Number(idxStr)
            const assignment = assignments[idx]
            if (!assignment) return
            if (assignment.forOrderId !== entry.forOrderId) return
            const drivers = buildAssignmentDriverTimes(assignment)
            let onSite = 0
            for (const driver of drivers) {
                if (!Number.isFinite(driver.arriveMin)) continue
                if (viewTime < driver.arriveMin) continue
                const leave = Number.isFinite(driver.leaveMin) ? driver.leaveMin : null
                if (leave != null && viewTime >= leave) continue
                onSite += 1
            }
            if (onSite <= 0) return
            const latKey = entry.jobCoords.lat.toFixed(4)
            const lngKey = entry.jobCoords.lng.toFixed(4)
            const key = `${entry.forOrderId}@${latKey},${lngKey}`
            const prior = byKey.get(key)
            if (prior) {
                prior.count += onSite
                prior.fromPlants.add(assignment.fromPlant)
            } else {
                byKey.set(key, {
                    count: onSite,
                    forOrderId: entry.forOrderId,
                    fromPlants: new Set([assignment.fromPlant]),
                    jobCoords: entry.jobCoords,
                    jobLabel: entry.jobLabel,
                    key
                })
            }
        })
        return Array.from(byKey.values())
    }, [assignments, jobRoutesByIdx, viewTime])
}

/** Render the job pins.
 *
 *  A small amber pin appears at each job site that currently has
 *  operators on it; the pin shows the headcount and disappears the
 *  moment the last operator's `leaveMin` passes. Sits between routes and
 *  plant markers so plant pins always win the hit test. */
export function useJobPins({ assignments, jobLayerRef, jobMarkersByKeyRef, jobRoutesByIdx, viewTime }) {
    const jobNodes = useJobNodes({ assignments, jobRoutesByIdx, viewTime })

    useEffect(() => {
        const layer = jobLayerRef.current
        if (!layer) return undefined
        const seen = new Set()
        jobNodes.forEach((node) => {
            seen.add(node.key)
            const icon = L.divIcon({
                className: 'plan-flow-job-marker',
                html:
                    `<div class="pf-job-pin">` +
                    `<i class="fas fa-hard-hat"></i>` +
                    `<span class="pf-job-count">${node.count}</span>` +
                    `</div>`,
                iconAnchor: [14, 14],
                iconSize: [28, 28]
            })
            const existing = jobMarkersByKeyRef.current[node.key]
            if (existing) {
                existing.setLatLng([node.jobCoords.lat, node.jobCoords.lng])
                existing.setIcon(icon)
            } else {
                // Job pins are read-only indicators; the count is on the
                // pin itself, so we drop the tooltip and the marker's
                // hit-test so it can't intercept clicks meant for a
                // nearby plant pin.
                const marker = L.marker([node.jobCoords.lat, node.jobCoords.lng], {
                    icon,
                    interactive: false,
                    riseOnHover: false
                })
                marker.addTo(layer)
                jobMarkersByKeyRef.current[node.key] = marker
            }
        })
        Object.keys(jobMarkersByKeyRef.current).forEach((k) => {
            if (!seen.has(k)) {
                layer.removeLayer(jobMarkersByKeyRef.current[k])
                delete jobMarkersByKeyRef.current[k]
            }
        })
        return undefined
    }, [jobLayerRef, jobMarkersByKeyRef, jobNodes])
}
