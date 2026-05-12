import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { geocodeAddress, getCachedGeocode } from '../../../utils/GeocodingUtility'
import { yphColorFor } from '../../../utils/PlanFlowLayoutUtility'
import { getMissingOperators } from '../../../utils/PlanUtility'
import { getCachedRoute, getDrivingRoute } from '../../../utils/RoutingUtility'
import { usePreferences } from '../../context/PreferencesContext'
import { usePlanFlowPreviewMetrics } from '../../hooks/usePlanFlowPreviewMetrics'

/**
 * Compact read-only mirror of the Planner tab — same real-OSM map surface,
 * same plant-marker visual vocabulary, same OSRM-routed help lines. Drops
 * the side rail, the time scrubber, the destination picker, and direct
 * editing because this lives inside a dashboard card and is purely a
 * preview. Tapping the "Open Planner" pin in the corner hands control off
 * to the full tab.
 */

const TENNESSEE_CENTER = [35.86, -86.66]
const DEFAULT_ZOOM = 7

const PLANT_RADIUS_MIN = 24
const PLANT_RADIUS_MAX = 38

const NEEDS_HELP_COLOR = '#dc2626'
const LEAVE_OFF_COLOR = '#d97706'

const REGION_STATE_HINTS = {
    AGG: 'Tennessee',
    TN: 'Tennessee'
}

const HEIGHT_NARROW_PX = 280
const HEIGHT_TABLET_PX = 340
const HEIGHT_WIDE_PX = 400
const NARROW_WIDTH_PX = 480
const TABLET_WIDTH_PX = 768

function resolveStateHint(region) {
    if (!region) return 'Tennessee'
    if (region.state) return region.state
    if (region.code && REGION_STATE_HINTS[region.code]) return REGION_STATE_HINTS[region.code]
    return 'Tennessee'
}

function radiusForOps(ops) {
    const n = Math.max(0, Number.isFinite(ops) ? ops : 0)
    const scaled = PLANT_RADIUS_MIN + Math.sqrt(n) * 2.5
    return Math.round(Math.max(PLANT_RADIUS_MIN, Math.min(PLANT_RADIUS_MAX, scaled)))
}

/** Read-only plant marker icon. Compact version of the Planner's marker —
 *  same colour vocabulary (needs-help red ring / leave-off amber ring),
 *  smaller, no selection/picking states. */
function makePreviewIcon({ accentColor, leaveOff, minPool, stat, yph }) {
    const eff = Math.max(0, (stat?.eff ?? 0) - (stat?.missing ?? 0))
    const r = radiusForOps(eff)
    const peakOverbookShortage = Number.isFinite(minPool) && minPool < 0 ? -minPool : 0
    const needsHelp = peakOverbookShortage > 0
    const hasLeaveOff = !needsHelp && (leaveOff || 0) > 0
    const ringColor = needsHelp
        ? NEEDS_HELP_COLOR
        : hasLeaveOff
          ? LEAVE_OFF_COLOR
          : yphColorFor(yph, accentColor) || 'var(--border-medium)'
    const codeFontSize = Math.max(11, Math.min(14, Math.round(r * 0.36)))
    return L.divIcon({
        className: 'plan-flow-preview-marker',
        html: `
            <div class="pfp-pin" style="
                width:${r}px;height:${r}px;
                box-shadow:0 0 0 2px ${ringColor}, 0 1px 4px rgba(0,0,0,0.3);
            ">
                <span class="pfp-code" style="font-size:${codeFontSize}px">${stat.code}</span>
                ${needsHelp ? '<span class="pfp-badge pfp-needs">!</span>' : ''}
                ${hasLeaveOff ? '<span class="pfp-badge pfp-leave">·</span>' : ''}
            </div>
        `,
        iconAnchor: [r / 2, r / 2],
        iconSize: [r, r]
    })
}

export function PlanFlowPreview({
    accentColor,
    allPlantStats,
    assignments,
    onOpenPlanner,
    plantProduction,
    plants = []
}) {
    const { preferences } = usePreferences()
    const stateHint = resolveStateHint(preferences?.selectedRegion)

    const containerRef = useRef(null)
    const mapRef = useRef(null)
    const plantLayerRef = useRef(null)
    const routeLayerRef = useRef(null)
    const markersByCodeRef = useRef({})
    const polylinesByKeyRef = useRef({})
    const initiallyFitRef = useRef(false)

    const [geocodedPlants, setGeocodedPlants] = useState([])
    const [routesByEdgeKey, setRoutesByEdgeKey] = useState({})
    const [previewHeight, setPreviewHeight] = useState(HEIGHT_WIDE_PX)

    const { leaveOffByCode, minPoolByCode, yphByCode } = usePlanFlowPreviewMetrics({
        allPlantStats,
        assignments,
        plantProduction
    })

    /* ── Width-driven height ────────────────────────────────────── */
    useEffect(() => {
        const node = containerRef.current
        if (!node) return
        const update = (w) => {
            setPreviewHeight(
                w < NARROW_WIDTH_PX ? HEIGHT_NARROW_PX : w < TABLET_WIDTH_PX ? HEIGHT_TABLET_PX : HEIGHT_WIDE_PX
            )
        }
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) update(entry.contentRect.width)
        })
        ro.observe(node)
        return () => ro.disconnect()
    }, [])

    /* ── Init Leaflet map once ──────────────────────────────────── */
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        const map = L.map(containerRef.current, {
            attributionControl: true,
            center: TENNESSEE_CENTER,
            doubleClickZoom: false,
            dragging: false,
            keyboard: false,
            scrollWheelZoom: false,
            tap: false,
            touchZoom: false,
            zoom: DEFAULT_ZOOM,
            zoomControl: false
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map)
        routeLayerRef.current = L.layerGroup().addTo(map)
        plantLayerRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
        return () => {
            map.remove()
            mapRef.current = null
            plantLayerRef.current = null
            routeLayerRef.current = null
            markersByCodeRef.current = {}
            polylinesByKeyRef.current = {}
        }
    }, [])

    /* ── Invalidate size when our height changes (card resize) ─── */
    useEffect(() => {
        if (mapRef.current) mapRef.current.invalidateSize()
    }, [previewHeight])

    /* ── Geocode plants ─────────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false
        async function run() {
            const initial = []
            for (const plant of plants || []) {
                const code = plant.plant_code
                let lat = Number.isFinite(plant.latitude) ? plant.latitude : null
                let lng = Number.isFinite(plant.longitude) ? plant.longitude : null
                if (lat == null || lng == null) {
                    const cached = getCachedGeocode(plant.plant_address, '', stateHint)
                    if (cached) {
                        lat = cached.lat
                        lng = cached.lng
                    }
                }
                if (lat != null && lng != null) initial.push({ code, lat, lng })
            }
            if (!cancelled) setGeocodedPlants(initial)

            const missing = (plants || []).filter((p) => !(Number.isFinite(p.latitude) && Number.isFinite(p.longitude)))
            for (const plant of missing) {
                if (cancelled) return
                const coords = await geocodeAddress(plant.plant_address, '', stateHint)
                if (cancelled) return
                if (!coords) continue
                setGeocodedPlants((prev) => {
                    if (prev.some((p) => p.code === plant.plant_code)) return prev
                    return [...prev, { code: plant.plant_code, lat: coords.lat, lng: coords.lng }]
                })
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [plants, stateHint])

    /* ── Fit bounds on first plant land ─────────────────────────── */
    useEffect(() => {
        if (initiallyFitRef.current) return
        if (!mapRef.current || geocodedPlants.length === 0) return
        const bounds = L.latLngBounds(geocodedPlants.map((p) => [p.lat, p.lng]))
        if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, { maxZoom: 9, padding: [24, 24] })
            initiallyFitRef.current = true
        }
    }, [geocodedPlants])

    /* ── Index helpers ──────────────────────────────────────────── */
    const statsByCode = useMemo(() => {
        const m = new Map()
        ;(allPlantStats || []).forEach((s) => m.set(s.code, s))
        return m
    }, [allPlantStats])

    /* ── Render plant markers ───────────────────────────────────── */
    useEffect(() => {
        const layer = plantLayerRef.current
        if (!layer) return
        const seen = new Set()
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))

        plantsByCode.forEach((pos, code) => {
            const stat = statsByCode.get(code) || { code, eff: 0, recv: 0, send: 0 }
            const missing = getMissingOperators(plantProduction, code)
            const icon = makePreviewIcon({
                accentColor,
                leaveOff: leaveOffByCode[code] || 0,
                minPool: minPoolByCode[code],
                stat: { ...stat, missing },
                yph: yphByCode[code]
            })
            seen.add(code)
            const existing = markersByCodeRef.current[code]
            if (existing) {
                existing.setLatLng([pos.lat, pos.lng])
                existing.setIcon(icon)
            } else {
                const marker = L.marker([pos.lat, pos.lng], {
                    icon,
                    interactive: false,
                    keyboard: false
                })
                marker.addTo(layer)
                markersByCodeRef.current[code] = marker
            }
        })

        Object.keys(markersByCodeRef.current).forEach((code) => {
            if (!seen.has(code)) {
                layer.removeLayer(markersByCodeRef.current[code])
                delete markersByCodeRef.current[code]
            }
        })
    }, [accentColor, geocodedPlants, leaveOffByCode, minPoolByCode, plantProduction, statsByCode, yphByCode])

    /* ── Fetch OSRM routes for each unique assignment edge ──────── */
    useEffect(() => {
        let cancelled = false
        async function run() {
            const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
            const uniquePairs = new Map()
            ;(assignments || []).forEach((a) => {
                if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
                const key = `${a.fromPlant}->${a.toPlant}`
                if (!uniquePairs.has(key)) uniquePairs.set(key, a)
            })

            const seeded = {}
            uniquePairs.forEach((a, key) => {
                const from = plantsByCode.get(a.fromPlant)
                const to = plantsByCode.get(a.toPlant)
                if (!from || !to) return
                const cached = getCachedRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
                if (cached) seeded[key] = cached
            })
            if (!cancelled && Object.keys(seeded).length) {
                setRoutesByEdgeKey((prev) => ({ ...prev, ...seeded }))
            }

            for (const [key, a] of uniquePairs) {
                if (cancelled) return
                if (seeded[key]) continue
                const from = plantsByCode.get(a.fromPlant)
                const to = plantsByCode.get(a.toPlant)
                if (!from || !to) continue
                const route = await getDrivingRoute({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
                if (cancelled) return
                if (!route) continue
                setRoutesByEdgeKey((prev) => ({ ...prev, [key]: route }))
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [assignments, geocodedPlants])

    /* ── Render route polylines ───────────────────────────────────
     * Mirror the Planner tab's two-layer cyan/teal animated flow line:
     * a soft base under a brighter dashed overlay whose dashes loop
     * continuously via CSS. Scaled thinner here for the compact card. */
    useEffect(() => {
        const layer = routeLayerRef.current
        if (!layer) return
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
        const wantedKeys = new Set()

        ;(assignments || []).forEach((a, idx) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const fromPos = plantsByCode.get(a.fromPlant)
            const toPos = plantsByCode.get(a.toPlant)
            if (!fromPos || !toPos) return
            const key = `${a.fromPlant}->${a.toPlant}#${idx}`
            wantedKeys.add(key)
            const route = routesByEdgeKey[`${a.fromPlant}->${a.toPlant}`]
            const coords =
                route?.coords?.length >= 2
                    ? route.coords
                    : [
                          [fromPos.lat, fromPos.lng],
                          [toPos.lat, toPos.lng]
                      ]
            // Match the Planner's glossy white-on-slate routing,
            // scaled thinner for the dashboard card.
            const baseStyle = {
                className: 'help-route-base',
                color: '#0f172a',
                interactive: false,
                opacity: 0.55,
                weight: 5
            }
            const flowStyle = {
                className: 'help-route-flow',
                color: '#ffffff',
                dashArray: '10 20',
                interactive: false,
                lineCap: 'round',
                opacity: 1,
                weight: 2.5
            }

            const existing = polylinesByKeyRef.current[key]
            if (existing) {
                existing.base.setLatLngs(coords)
                existing.base.setStyle(baseStyle)
                existing.flow.setLatLngs(coords)
                existing.flow.setStyle(flowStyle)
            } else {
                const group = L.layerGroup()
                const base = L.polyline(coords, baseStyle)
                const flow = L.polyline(coords, flowStyle)
                base.addTo(group)
                flow.addTo(group)
                group.addTo(layer)
                polylinesByKeyRef.current[key] = { base, flow, group }
            }
        })

        Object.keys(polylinesByKeyRef.current).forEach((k) => {
            if (!wantedKeys.has(k)) {
                layer.removeLayer(polylinesByKeyRef.current[k].group)
                delete polylinesByKeyRef.current[k]
            }
        })
    }, [assignments, geocodedPlants, routesByEdgeKey])

    const hasNodes = (allPlantStats || []).length > 0

    return (
        <div className="relative rounded-lg overflow-hidden" style={{ height: previewHeight }}>
            <style>{`
                .plan-flow-preview-marker { background: transparent !important; border: none !important; }
                .pfp-pin {
                    position: relative;
                    border-radius: 50%;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    display: flex; align-items: center; justify-content: center;
                    font-family: 'Exo 2', system-ui, sans-serif;
                }
                .pfp-code { font-weight: 700; letter-spacing: 0.02em; }
                .pfp-badge {
                    position: absolute; top: -3px; right: -3px;
                    min-width: 13px; height: 13px; padding: 0 3px; border-radius: 999px;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; font-size: 9px; font-weight: 800;
                    border: 1.5px solid var(--bg-primary);
                }
                .pfp-needs { background: ${NEEDS_HELP_COLOR}; }
                .pfp-leave { background: ${LEAVE_OFF_COLOR}; }
                html.dark .leaflet-tile { filter: brightness(0.78) saturate(0.85) hue-rotate(190deg); }
                .leaflet-container { background: var(--bg-tertiary); }
                .leaflet-control-attribution {
                    background: rgba(255,255,255,0.7) !important;
                    font-size: 9px !important;
                    padding: 0 4px !important;
                }
                /* Help-route lines — same glossy white-on-slate flow as
                 * the Planner tab, scaled smaller for the dashboard
                 * card. The dashes march continuously along the route. */
                .help-route-base {
                    stroke-linecap: round;
                    filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.55));
                }
                .help-route-flow {
                    animation: help-route-flow 1.6s linear infinite;
                    filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.9))
                            drop-shadow(0 0 9px rgba(148, 163, 184, 0.5));
                }
                @keyframes help-route-flow {
                    to { stroke-dashoffset: -30; }
                }
                html.dark .help-route-base {
                    filter: drop-shadow(0 0 4px rgba(15, 23, 42, 0.85));
                }
                html.dark .help-route-flow {
                    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 1))
                            drop-shadow(0 0 12px rgba(186, 230, 253, 0.7));
                }
            `}</style>

            <div className="h-full w-full" ref={containerRef} />

            {!hasNodes && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-bg-secondary text-text-secondary">
                    <i className="fas fa-map-location-dot text-2xl mb-2 opacity-50" />
                    <span className="text-[12px]">Add plants or routes to see the flow</span>
                </div>
            )}

            {onOpenPlanner && (
                <button
                    onClick={onOpenPlanner}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white cursor-pointer border-none flex items-center gap-1.5 z-[400]"
                    style={{ background: accentColor, boxShadow: 'var(--shadow)' }}
                >
                    <i className="fas fa-project-diagram text-[10px]" /> Open Planner
                </button>
            )}
        </div>
    )
}

export default PlanFlowPreview
