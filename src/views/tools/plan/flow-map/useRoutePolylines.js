import L from 'leaflet'
import { useEffect } from 'react'

import { buildAssignmentDriverTimes } from '../../../../utils/PlanUtility'
import { classifyAssignmentActivity } from './flowMapActivity'
import { makeArrowIcon, makeLegStyles, updateArrow } from './flowMapIcons'
import { pointAlongPath, resolveDriverLegAnchor } from './flowMapPath'
import { DIRECT_LOAD_HOLD_MINUTES, escapeTooltip, ROUTE_OUTBOUND_COLOR, ROUTE_RETURN_COLOR } from './flowMapShared'

/** Render the route polylines for every assignment.
 *
 *  Each assignment gets TWO polyline pairs in a single layer group:
 *   - Outbound (going to help) — green base + animated white flow.
 *   - Return (heading home) — orange base + animated white flow, with the
 *     coords reversed so the dash flow reads as travelling toward the
 *     home plant.
 *
 *  Per-leg styling reacts to the activity state at `viewTime`:
 *   - 'transit'   — full opacity, animated flow (operators on the road)
 *   - 'at-dest'   — base only (outbound only — they've arrived)
 *   - 'inactive'  — heavily dimmed so the geometry stays oriented without
 *                   competing with the active routes
 *   - 'all-day'   — the All-day view: both legs read as always-on. */
export function useRoutePolylines({
    assignments,
    geocodedPlants,
    getTravelTime,
    jobRoutesByIdx,
    polylinesByEdgeRef,
    routeLayerRef,
    routesByEdgeKey,
    selectedCode,
    viewTime
}) {
    useEffect(() => {
        const layer = routeLayerRef.current
        if (!layer) return
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))

        const wanted = new Map()
        assignments.forEach((a, idx) => {
            if (!a.fromPlant || !a.toPlant || a.fromPlant === a.toPlant) return
            const key = `${a.fromPlant}->${a.toPlant}#${idx}`
            wanted.set(key, { a, idx })
        })

        Object.keys(polylinesByEdgeRef.current).forEach((k) => {
            if (!wanted.has(k)) {
                layer.removeLayer(polylinesByEdgeRef.current[k].group)
                delete polylinesByEdgeRef.current[k]
            }
        })

        wanted.forEach(({ a, idx }, key) => {
            const from = plantsByCode.get(a.fromPlant)
            const to = plantsByCode.get(a.toPlant)
            if (!from || !to) return
            const cachedJob = jobRoutesByIdx[idx]
            const useJobRoute =
                cachedJob &&
                cachedJob.forOrderId === a.forOrderId &&
                cachedJob.fromPlant === a.fromPlant &&
                cachedJob.returnCode === (a.returnPlant || a.fromPlant)
            const route = routesByEdgeKey[`${a.fromPlant}->${a.toPlant}`]
            const fallbackCoords =
                route?.coords?.length >= 2
                    ? route.coords
                    : [
                          [from.lat, from.lng],
                          [to.lat, to.lng]
                      ]
            const outCoords = useJobRoute ? cachedJob.outCoords : fallbackCoords
            // Without a dedicated return leg fetched, mirror the outbound
            // polyline so the green flow reads as "coming back the same
            // way." OSRM A→B and B→A typically share the same physical
            // roads; the small reality gaps (one-way streets) aren't
            // worth a second round-trip per route.
            const backCoords = useJobRoute ? cachedJob.backCoords : [...fallbackCoords].reverse()

            const isInvolved = selectedCode === a.fromPlant || selectedCode === a.toPlant
            // Outbound leg drives the transit-window timing; return drive
            // mirrors it when we don't have a separate measurement.
            const outDriveMinutes = useJobRoute
                ? cachedJob.outLegMinutes
                : route
                  ? Math.round(route.duration / 60)
                  : null
            const travelHint = outDriveMinutes ?? getTravelTime?.(a.fromPlant, a.toPlant)
            /* Return-leg travel for direct-load assignments runs from the
             * job site to the return plant, NOT from the destination
             * plant — `cachedJob.backLegMinutes` is the OSRM-resolved
             * duration for that leg. Falls back to `travelHint` for
             * non-direct help routes where the return path mirrors the
             * outbound geometry. */
            const returnTravelHint =
                useJobRoute && Number.isFinite(cachedJob.backLegMinutes) ? cachedJob.backLegMinutes : travelHint
            const directLoadHoldMin = useJobRoute ? DIRECT_LOAD_HOLD_MINUTES : null
            /* Visual stagger applied to the return-leg chevrons (and to
             * the polyline's `transit` window). In stagger mode every
             * driver shares the assignment's single `leaveTime`, so we
             * fan their return-leg start times out by the same per-driver
             * stagger the outbound leg uses — otherwise the convoy
             * collapses to a single visible chevron on the return road.
             * Custom-time mode keeps each driver's per-row leave time
             * intact (no extra stagger). Direct-load is naturally
             * staggered via `arriveMin`. */
            const isCustomTimeMode = a?.timeMode === 'custom' && Array.isArray(a?.customTimes)
            const returnStaggerMin = useJobRoute || isCustomTimeMode ? 0 : parseInt(a?.staggerMinutes, 10) || 0
            const activity = classifyAssignmentActivity(a, viewTime, travelHint, {
                directLoadHoldMin,
                returnStaggerMin,
                returnTravelMinutes: returnTravelHint
            })

            const styles = makeLegStyles({ activity, isInvolved, selectedCode })

            const ops = parseInt(a.driverCount, 10) || 0
            const timeLabel = a.time || ''
            const homeCode = useJobRoute ? cachedJob.returnCode : a.returnPlant || a.fromPlant
            const headline = useJobRoute
                ? `${a.fromPlant} &rarr; <span style="opacity:0.85">job</span> &rarr; ${homeCode}`
                : `${a.fromPlant} &rarr; ${a.toPlant} &rarr; ${homeCode}`
            const jobLine = useJobRoute ? `<br/><small>via ${escapeTooltip(cachedJob.jobLabel)}</small>` : ''
            const distanceSource = useJobRoute
                ? {
                      distance: cachedJob.outDistance + cachedJob.backDistance,
                      duration: cachedJob.outDuration + cachedJob.backDuration
                  }
                : route
            const distanceLine = distanceSource
                ? `<br/><small>${(distanceSource.distance / 1609.34).toFixed(1)} mi · ${Math.round(distanceSource.duration / 60)} min drive</small>`
                : ''
            const tipContent =
                `<strong>${headline}</strong><br/>` +
                `${ops} operator${ops === 1 ? '' : 's'}${timeLabel ? ` · arrive ${timeLabel}` : ''}` +
                jobLine +
                distanceLine

            // Directional ▶ glyphs — ONE per truck on each leg, so a 3-driver
            // crew renders three outbound arrows and three return arrows.
            // Each marker is positioned at its own driver's progress fraction
            // (not the leg-wide union) so staggered crews visibly spread out
            // along the route instead of stacking at the average. Arrows
            // whose driver isn't on the leg right now stay in place with
            // opacity 0 — that preserves the marker DOM across ticks so the
            // CSS transitions on transform / opacity actually fire (the
            // old single-arrow rebuild-every-tick path is what caused the
            // jump-then-rewind motion we hit earlier).
            const drivers = buildAssignmentDriverTimes(a)
            const driverCount = Math.max(0, drivers.length)
            const arrowFallback = pointAlongPath(outCoords, 0.5)
            const arrowFallbackBack = pointAlongPath(backCoords, 0.5)
            const outAnchors = drivers.map((driver) =>
                resolveDriverLegAnchor({ coords: outCoords, driver, leg: 'outbound', travel: travelHint, viewTime })
            )
            const backAnchors = drivers.map((driver) =>
                resolveDriverLegAnchor({
                    coords: backCoords,
                    directLoadHoldMin,
                    driver,
                    leg: 'returning',
                    returnStaggerMin,
                    travel: returnTravelHint,
                    viewTime
                })
            )

            const syncArrows = (group, existingArrows, anchors, fallbackAnchor, color) => {
                const arrows = Array.isArray(existingArrows) ? [...existingArrows] : []
                // Trim arrows beyond the current driver count.
                while (arrows.length > driverCount) {
                    const stale = arrows.pop()
                    if (stale && group) group.removeLayer(stale)
                }
                /* Add markers for new drivers. When the driver is already
                 * on this leg at the current viewTime, mount the marker
                 * directly at their per-driver anchor (start-of-leg if
                 * they just entered, mid-leg if they were partway when
                 * the view first loaded) so it appears in place. When the
                 * driver isn't on the leg yet, fall back to the route
                 * midpoint — the marker is hidden (opacity 0) and will
                 * snap to the start of the leg on activation without
                 * sliding across the map. */
                while (arrows.length < driverCount) {
                    const idx = arrows.length
                    const driverAnchor = anchors[idx]
                    const seed = driverAnchor || fallbackAnchor
                    if (!seed) break
                    const marker = L.marker([seed.lat, seed.lng], {
                        icon: makeArrowIcon({
                            active: !!driverAnchor,
                            color,
                            rotationDeg: seed.angleDeg
                        }),
                        interactive: false
                    })
                    if (group) marker.addTo(group)
                    marker._pfArrowActive = !!driverAnchor
                    arrows.push(marker)
                }
                /* Update each driver's arrow. The `_pfArrowActive` flag
                 * tracks whether this driver was on the leg in the
                 * previous tick. The first frame a driver becomes active
                 * (inactive → active) the marker's previous translate3d
                 * still points at the fallback / last-active position; if
                 * we let the CSS transition run, the truck visibly streaks
                 * from there to the start of its route. Pinning
                 * `transition:none` inline around that one setLatLng makes
                 * the marker pop into place at the leg start; the rAF
                 * restores the transition so the next tick's lerp keeps
                 * the smooth in-leg motion. */
                anchors.forEach((anchor, idx) => {
                    const marker = arrows[idx]
                    if (!marker) return
                    const wasActive = marker._pfArrowActive === true
                    const willActivate = !!anchor && !wasActive
                    if (willActivate && marker._icon) {
                        marker._icon.style.transition = 'none'
                    }
                    if (anchor) marker.setLatLng([anchor.lat, anchor.lng])
                    updateArrow(marker, {
                        active: !!anchor,
                        color,
                        rotationDeg: anchor?.angleDeg ?? 0
                    })
                    marker._pfArrowActive = !!anchor
                    if (willActivate && marker._icon) {
                        const iconEl = marker._icon
                        requestAnimationFrame(() => {
                            iconEl.style.transition = ''
                        })
                    }
                })
                return arrows
            }

            const existing = polylinesByEdgeRef.current[key]
            if (existing) {
                existing.outBase.setLatLngs(outCoords)
                existing.outBase.setStyle(styles.outboundBase)
                existing.outFlow.setLatLngs(outCoords)
                existing.outFlow.setStyle(styles.outboundFlow)
                existing.outFlow.unbindTooltip()
                existing.outFlow.bindTooltip(tipContent, { sticky: true })
                existing.backBase.setLatLngs(backCoords)
                existing.backBase.setStyle(styles.returnBase)
                existing.backFlow.setLatLngs(backCoords)
                existing.backFlow.setStyle(styles.returnFlow)
                existing.backFlow.unbindTooltip()
                existing.backFlow.bindTooltip(tipContent, { sticky: true })
                existing.outArrows = syncArrows(
                    existing.group,
                    existing.outArrows,
                    outAnchors,
                    arrowFallback,
                    ROUTE_OUTBOUND_COLOR
                )
                existing.backArrows = syncArrows(
                    existing.group,
                    existing.backArrows,
                    backAnchors,
                    arrowFallbackBack,
                    ROUTE_RETURN_COLOR
                )
            } else {
                const group = L.layerGroup()
                const outBase = L.polyline(outCoords, styles.outboundBase)
                const outFlow = L.polyline(outCoords, styles.outboundFlow)
                const backBase = L.polyline(backCoords, styles.returnBase)
                const backFlow = L.polyline(backCoords, styles.returnFlow)
                outFlow.bindTooltip(tipContent, { sticky: true })
                backFlow.bindTooltip(tipContent, { sticky: true })
                outBase.addTo(group)
                outFlow.addTo(group)
                backBase.addTo(group)
                backFlow.addTo(group)
                group.addTo(layer)
                const outArrows = syncArrows(group, [], outAnchors, arrowFallback, ROUTE_OUTBOUND_COLOR)
                const backArrows = syncArrows(group, [], backAnchors, arrowFallbackBack, ROUTE_RETURN_COLOR)
                polylinesByEdgeRef.current[key] = {
                    backArrows,
                    backBase,
                    backFlow,
                    group,
                    outArrows,
                    outBase,
                    outFlow
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignments, geocodedPlants, getTravelTime, jobRoutesByIdx, routesByEdgeKey, selectedCode, viewTime])
}
