import L from 'leaflet'
import { useEffect, useMemo } from 'react'

import { buildAssignmentDriverTimes } from '../../utils/PlanUtility'

/** Aggregate trucks-on-site per job at the current `viewTime`. Each
 *  via-job assignment contributes one count per driver whose work window
 *  covers the current minute (arrived but not yet left), plus a
 *  `plannedCount` of every driver assigned to the job regardless of
 *  whether they're on-site right now. Jobs with `onSite === 0` are kept
 *  in the list so the parent can render them as faded "inactive" pins —
 *  matches the route behavior (in-transit polylines stay visible as
 *  slate-600 idle lines when their drivers aren't currently moving).
 *  When the scrubber is in "All day" mode we return an empty list so
 *  the pins only appear while the day is actually playing. */
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
            if (drivers.length === 0) return
            let onSite = 0
            for (const driver of drivers) {
                if (!Number.isFinite(driver.arriveMin)) continue
                if (viewTime < driver.arriveMin) continue
                const leave = Number.isFinite(driver.leaveMin) ? driver.leaveMin : null
                if (leave != null && viewTime >= leave) continue
                onSite += 1
            }
            const latKey = entry.jobCoords.lat.toFixed(4)
            const lngKey = entry.jobCoords.lng.toFixed(4)
            const key = `${entry.forOrderId}@${latKey},${lngKey}`
            const prior = byKey.get(key)
            if (prior) {
                prior.count += onSite
                prior.plannedCount += drivers.length
                prior.fromPlants.add(assignment.fromPlant)
            } else {
                byKey.set(key, {
                    count: onSite,
                    forOrderId: entry.forOrderId,
                    fromPlants: new Set([assignment.fromPlant]),
                    jobCoords: entry.jobCoords,
                    jobLabel: entry.jobLabel,
                    key,
                    plannedCount: drivers.length
                })
            }
        })
        return Array.from(byKey.values())
    }, [assignments, jobRoutesByIdx, viewTime])
}

/** Render the job pins.
 *
 *  A small amber pin appears at each job site that currently has
 *  operators on it; jobs whose drivers have already cleared (or haven't
 *  arrived yet) keep their pin on the map in a faded slate state —
 *  same idea as the idle slate-600 polylines, so the dispatcher always
 *  sees the day's full set of job sites without active ones being lost
 *  in the noise. Sits between routes and plant markers so plant pins
 *  always win the hit test. */
export function useJobPins({ assignments, jobLayerRef, jobMarkersByKeyRef, jobRoutesByIdx, viewTime }) {
    const jobNodes = useJobNodes({ assignments, jobRoutesByIdx, viewTime })

    useEffect(() => {
        const layer = jobLayerRef.current
        if (!layer) return undefined
        const seen = new Set()
        jobNodes.forEach((node) => {
            seen.add(node.key)
            const active = node.count > 0
            const displayCount = active ? node.count : node.plannedCount
            const pinClass = active ? 'pf-job-pin' : 'pf-job-pin pf-job-pin-inactive'
            const icon = L.divIcon({
                className: 'plan-flow-job-marker',
                html:
                    `<div class="${pinClass}">` +
                    `<i class="fas fa-hard-hat"></i>` +
                    `<span class="pf-job-count">${displayCount}</span>` +
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
