/* eslint-disable max-lines, react/forbid-dom-props */
import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { PlanFlowRouteEditor } from '../../../app/components/plan/tabs/flow/PlanFlowRouteEditor'
import { PlanFlowEmptyPanel, PlanFlowPlantOverview } from '../../../app/components/plan/tabs/flow/PlanFlowSidePanel'
import { PlanFlowTimeScrubber } from '../../../app/components/plan/tabs/flow/PlanFlowTimeScrubber'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { usePlanFlowEditor } from '../../../app/hooks/usePlanFlowEditor'
import { usePlanFlowMetrics } from '../../../app/hooks/usePlanFlowMetrics'
import { geocodeAddress, getCachedGeocode } from '../../../utils/GeocodingUtility'
import { yphColorFor } from '../../../utils/PlanFlowLayoutUtility'
import { getMissingOperators, setMissingOperators } from '../../../utils/PlanUtility'
import { getCachedRoute, getDrivingRoute } from '../../../utils/RoutingUtility'

/**
 * PlanFlowMapView — Planner tab backed by a real OpenStreetMap surface.
 *
 *   • Plants render as DivIcon markers at their real lat/lng (from the
 *     `plants` table or geocoded via Nominatim).
 *   • Each assignment renders as a Leaflet polyline that follows the
 *     actual driving route returned by OSRM, instead of a straight
 *     schematic line. While a route is still loading we draw a dashed
 *     straight-line placeholder so the edge is visible immediately.
 *   • The side rail (overview / route editor) is unchanged from the
 *     legacy schematic Planner — node clicks, "Send Help" picking, and
 *     edit / delete flows route through the same `usePlanFlowEditor`
 *     hook so behaviour stays identical.
 */

const TENNESSEE_CENTER = [35.86, -86.66]
const DEFAULT_ZOOM = 8

const PLANT_RADIUS_MIN = 34
const PLANT_RADIUS_MAX = 56

const NEEDS_HELP_COLOR = '#dc2626'
const LEAVE_OFF_COLOR = '#d97706'
const PICKING_COLOR = '#f59e0b'

const REGION_STATE_HINTS = {
    AGG: 'Tennessee',
    TN: 'Tennessee'
}

function resolveStateHint(region) {
    if (!region) return 'Tennessee'
    if (region.state) return region.state
    if (region.code && REGION_STATE_HINTS[region.code]) return REGION_STATE_HINTS[region.code]
    return 'Tennessee'
}

/** Visual diameter (px) for a plant based on its effective operator count.
 *  Mirrors the schematic Planner's sizing so dense plants read first. */
function radiusForOps(ops) {
    const n = Math.max(0, Number.isFinite(ops) ? ops : 0)
    const scaled = PLANT_RADIUS_MIN + Math.sqrt(n) * 4
    return Math.round(Math.max(PLANT_RADIUS_MIN, Math.min(PLANT_RADIUS_MAX, scaled)))
}

/** Computes the rich status snapshot for a plant — derived from the
 *  schematic Planner's `PlanFlowNode` so map markers carry the same
 *  needs-help / leave-off / yph cues without duplicating the entire
 *  visual component. */
function buildPlantStatus({
    accentColor,
    activeOrdersAtTime,
    draft,
    leaveOffByCode,
    maxYph,
    minPoolByCode,
    pickingDestination,
    plantProduction,
    poolAtViewTime,
    selectedCode,
    stat,
    viewTime,
    yphByCode
}) {
    const { eff = 0, recv = 0, send = 0, base = 0 } = stat
    const missingAtPlant = getMissingOperators(plantProduction, stat.code)
    const effWithMissing = Math.max(0, eff - missingAtPlant)
    const yph = yphByCode[stat.code]
    const isTimeView = Number.isFinite(viewTime)
    const poolNow = isTimeView ? poolAtViewTime?.[stat.code] : null
    const activeNow = isTimeView ? activeOrdersAtTime?.[stat.code]?.length || 0 : 0
    const timeDeficit = isTimeView && Number.isFinite(poolNow) && poolNow < 0 && activeNow > 0 ? -poolNow : 0
    const minPool = minPoolByCode?.[stat.code]
    const peakOverbookShortage = isTimeView ? timeDeficit : Number.isFinite(minPool) && minPool < 0 ? -minPool : 0
    const needsHelp = isTimeView ? timeDeficit > 0 : (yph != null && yph > maxYph) || peakOverbookShortage > 0
    const leaveOffInfo = !needsHelp && !isTimeView ? leaveOffByCode?.[stat.code] || { count: 0 } : { count: 0 }
    const hasLeaveOff = (leaveOffInfo.count || 0) > 0
    const isSelected = selectedCode === stat.code
    const isDestinationCandidate = pickingDestination && draft && stat.code !== draft.fromPlant
    const ringColor = needsHelp
        ? NEEDS_HELP_COLOR
        : hasLeaveOff
          ? LEAVE_OFF_COLOR
          : isSelected
            ? accentColor
            : isDestinationCandidate
              ? PICKING_COLOR
              : yphColorFor(yph, accentColor) || 'var(--border-medium)'
    return {
        base,
        effWithMissing,
        hasLeaveOff,
        isDestinationCandidate,
        isSelected,
        needsHelp,
        recv,
        ringColor,
        send
    }
}

/** Builds the DivIcon HTML for a single plant marker. Same visual
 *  vocabulary as the schematic Planner — sized by ops count, status ring
 *  in the same colour. Click handling is wired via Leaflet's marker
 *  click event rather than HTML onclick. */
function makePlantIcon(stat, status, accentColor) {
    const r = radiusForOps(status.effWithMissing)
    const codeFontSize = Math.max(13, Math.min(18, Math.round(r * 0.32)))
    const ringWidth = status.isSelected ? 4 : status.isDestinationCandidate ? 4 : 3
    return L.divIcon({
        className: 'plan-flow-map-marker',
        html: `
            <div class="pf-plant-pin" style="
                width:${r}px;height:${r}px;
                box-shadow:0 0 0 ${ringWidth}px ${status.ringColor}, 0 2px 6px rgba(0,0,0,0.35);
                background:${status.isSelected ? accentColor : 'var(--bg-primary)'};
                color:${status.isSelected ? '#fff' : 'var(--text-primary)'};
            ">
                <div class="pf-plant-code" style="font-size:${codeFontSize}px">${stat.code}</div>
                <div class="pf-plant-ops">${status.effWithMissing}<span>OP${status.effWithMissing === 1 ? '' : 'S'}</span></div>
                ${status.needsHelp ? '<div class="pf-plant-badge pf-needs">!</div>' : ''}
                ${status.hasLeaveOff ? '<div class="pf-plant-badge pf-leave">·</div>' : ''}
            </div>
        `,
        iconAnchor: [r / 2, r / 2],
        iconSize: [r, r]
    })
}

function PlanFlowMapView({
    accentColor,
    assignments,
    calcClockIn,
    canEdit = false,
    getTravelTime,
    mixerCountsByPlant,
    planDate,
    plantProduction,
    plants = [],
    setAssignments,
    setPlantProduction,
    stats
}) {
    const { preferences } = usePreferences()
    const stateHint = resolveStateHint(preferences?.selectedRegion)

    const containerRef = useRef(null)
    const mapRef = useRef(null)
    const plantLayerRef = useRef(null)
    const routeLayerRef = useRef(null)
    const markersByCodeRef = useRef({})
    const polylinesByEdgeRef = useRef({})
    const initiallyFitRef = useRef(false)

    const [geocodedPlants, setGeocodedPlants] = useState([])
    const [routesByEdgeKey, setRoutesByEdgeKey] = useState({})
    const [viewTime, setViewTime] = useState(null)
    const [pendingPlantGeocodes, setPendingPlantGeocodes] = useState(0)
    const [pendingRoutes, setPendingRoutes] = useState(0)

    const {
        cancelEditor,
        deleteAssignment,
        draft,
        editingIndex,
        handleNodeClick,
        openAddRoute,
        openEditRoute,
        panelMode,
        pickingDestination,
        selectedCode,
        setDraft,
        setPickingDestination,
        setSelectedCode,
        submitEditor
    } = usePlanFlowEditor({ assignments, setAssignments })

    /* ── All-plants stats (mirrors PlanFlowView) ────────────────── */
    const allPlantStats = useMemo(() => {
        const existing = new Map(stats.map((stat) => [stat.code, stat]))
        const list = (plants || []).map((plant) => {
            const code = plant.plant_code
            if (existing.has(code)) return existing.get(code)
            const base = mixerCountsByPlant?.[code] || 0
            return { base, code, eff: base, recv: 0, send: 0 }
        })
        stats.forEach((stat) => {
            if (!list.some((entry) => entry.code === stat.code)) list.push(stat)
        })
        return list.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [plants, stats, mixerCountsByPlant])

    const { activeOrdersAtTime, effAtViewTime, leaveOffByCode, minPoolByCode, poolAtViewTime, thresholds, yphByCode } =
        usePlanFlowMetrics({ assignments, planDate, plantProduction, stats, viewTime })

    /* ── Init Leaflet map once ──────────────────────────────────── */
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        const map = L.map(containerRef.current, {
            center: TENNESSEE_CENTER,
            scrollWheelZoom: true,
            zoom: DEFAULT_ZOOM,
            zoomControl: true
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map)
        routeLayerRef.current = L.layerGroup().addTo(map) // routes first → markers on top
        plantLayerRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
        return () => {
            map.remove()
            mapRef.current = null
            plantLayerRef.current = null
            routeLayerRef.current = null
            markersByCodeRef.current = {}
            polylinesByEdgeRef.current = {}
        }
    }, [])

    /* ── Geocode plants ─────────────────────────────────────────── */
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

    /* ── Fit map bounds to plants on first land ─────────────────── */
    useEffect(() => {
        if (initiallyFitRef.current) return
        if (!mapRef.current || geocodedPlants.length === 0) return
        const bounds = L.latLngBounds(geocodedPlants.map((p) => [p.lat, p.lng]))
        if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, { maxZoom: 10, padding: [60, 60] })
            initiallyFitRef.current = true
        }
    }, [geocodedPlants])

    /* ── Render plant markers (re-runs on metric changes too) ───── */
    useEffect(() => {
        const layer = plantLayerRef.current
        if (!layer) return
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
        const seen = new Set()

        allPlantStats.forEach((stat) => {
            const pos = plantsByCode.get(stat.code)
            if (!pos) return
            seen.add(stat.code)
            const status = buildPlantStatus({
                accentColor,
                activeOrdersAtTime,
                draft,
                leaveOffByCode,
                maxYph: thresholds.MAX_YPH,
                minPoolByCode,
                pickingDestination,
                plantProduction,
                poolAtViewTime,
                selectedCode,
                stat,
                viewTime,
                yphByCode
            })
            const icon = makePlantIcon(stat, status, accentColor)
            const existing = markersByCodeRef.current[stat.code]
            if (existing) {
                existing.setLatLng([pos.lat, pos.lng])
                existing.setIcon(icon)
            } else {
                const marker = L.marker([pos.lat, pos.lng], { icon, riseOnHover: true })
                marker.on('click', () => handleNodeClick(stat.code))
                marker.bindTooltip(
                    () =>
                        `<strong>Plant ${stat.code}</strong><br/>${status.effWithMissing} op${status.effWithMissing === 1 ? '' : 's'}` +
                        (status.send ? ` · sending ${status.send}` : '') +
                        (status.recv ? ` · receiving ${status.recv}` : '') +
                        (status.needsHelp ? '<br/><span style="color:#dc2626">Needs help</span>' : '') +
                        (status.hasLeaveOff ? '<br/><span style="color:#d97706">Leave off available</span>' : ''),
                    { direction: 'top', offset: [0, -10] }
                )
                marker.addTo(layer)
                markersByCodeRef.current[stat.code] = marker
            }
        })

        // Drop markers for plants that no longer have positions / stats.
        Object.keys(markersByCodeRef.current).forEach((code) => {
            if (!seen.has(code)) {
                const marker = markersByCodeRef.current[code]
                layer.removeLayer(marker)
                delete markersByCodeRef.current[code]
            }
        })
    }, [
        accentColor,
        activeOrdersAtTime,
        allPlantStats,
        draft,
        geocodedPlants,
        handleNodeClick,
        leaveOffByCode,
        minPoolByCode,
        pickingDestination,
        plantProduction,
        poolAtViewTime,
        selectedCode,
        thresholds.MAX_YPH,
        viewTime,
        yphByCode
    ])

    /* ── Fetch OSRM routes for every assignment edge ────────────── */
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

    /* ── Render route polylines ───────────────────────────────────
     * Each route is drawn as TWO stacked polylines: a soft cyan "base"
     * underneath, and a brighter dashed overlay on top whose dash offset
     * is animated via CSS so the whole line reads as energy flowing
     * from plant to plant. Both polylines for a route live in a
     * sub-LayerGroup so add / update / remove stay one-line. */
    useEffect(() => {
        const layer = routeLayerRef.current
        if (!layer) return
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))

        const wanted = new Map()
        assignments.forEach((a, idx) => {
            if (!a.fromPlant || !a.toPlant || a.fromPlant === a.toPlant) return
            const key = `${a.fromPlant}->${a.toPlant}#${idx}`
            wanted.set(key, a)
        })

        Object.keys(polylinesByEdgeRef.current).forEach((k) => {
            if (!wanted.has(k)) {
                layer.removeLayer(polylinesByEdgeRef.current[k].group)
                delete polylinesByEdgeRef.current[k]
            }
        })

        wanted.forEach((a, key) => {
            const from = plantsByCode.get(a.fromPlant)
            const to = plantsByCode.get(a.toPlant)
            if (!from || !to) return
            const route = routesByEdgeKey[`${a.fromPlant}->${a.toPlant}`]
            const coords =
                route?.coords?.length >= 2
                    ? route.coords
                    : [
                          [from.lat, from.lng],
                          [to.lat, to.lng]
                      ]
            const isInvolved = selectedCode === a.fromPlant || selectedCode === a.toPlant
            const opacityScale = isInvolved ? 1 : selectedCode ? 0.35 : 0.85
            // Glossy white-on-slate routing: deep slate base for body,
            // a bright near-white dashed overlay that marches along the
            // route on a 1.6s loop. Reads like a premium GPS app —
            // high-contrast on light and dark tiles alike, neutral
            // against whatever accent the user has set.
            const baseStyle = {
                className: 'help-route-base',
                color: '#0f172a',
                opacity: 0.62 * opacityScale,
                weight: isInvolved ? 7 : 6
            }
            const flowStyle = {
                className: 'help-route-flow',
                color: '#ffffff',
                dashArray: '12 24',
                lineCap: 'round',
                opacity: opacityScale,
                weight: isInvolved ? 4 : 3
            }

            const ops = parseInt(a.driverCount, 10) || 0
            const timeLabel = a.time || ''
            const tipContent =
                `<strong>${a.fromPlant} &rarr; ${a.toPlant}</strong><br/>` +
                `${ops} operator${ops === 1 ? '' : 's'}${timeLabel ? ` · arrive ${timeLabel}` : ''}` +
                (route
                    ? `<br/><small>${(route.distance / 1609.34).toFixed(1)} mi · ${Math.round(route.duration / 60)} min drive</small>`
                    : '')

            const existing = polylinesByEdgeRef.current[key]
            if (existing) {
                existing.base.setLatLngs(coords)
                existing.base.setStyle(baseStyle)
                existing.flow.setLatLngs(coords)
                existing.flow.setStyle(flowStyle)
                existing.flow.unbindTooltip()
                existing.flow.bindTooltip(tipContent, { sticky: true })
            } else {
                const group = L.layerGroup()
                const base = L.polyline(coords, baseStyle)
                const flow = L.polyline(coords, flowStyle)
                flow.bindTooltip(tipContent, { sticky: true })
                base.addTo(group)
                flow.addTo(group)
                group.addTo(layer)
                polylinesByEdgeRef.current[key] = { base, flow, group }
            }
        })
    }, [assignments, geocodedPlants, routesByEdgeKey, selectedCode])

    /* ── Resize observer so Leaflet re-measures on tab swaps ────── */
    useEffect(() => {
        if (!containerRef.current || !mapRef.current) return
        const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [])

    const selected = selectedCode ? allPlantStats.find((stat) => stat.code === selectedCode) : null

    const outbound = useMemo(() => {
        if (!selectedCode) return []
        return assignments
            .map((assignment, idx) => ({ ...assignment, idx }))
            .filter((assignment) => assignment.fromPlant === selectedCode && assignment.toPlant)
    }, [assignments, selectedCode])
    const inbound = useMemo(() => {
        if (!selectedCode) return []
        return assignments
            .map((assignment, idx) => ({ ...assignment, idx }))
            .filter((assignment) => assignment.toPlant === selectedCode && assignment.fromPlant)
    }, [assignments, selectedCode])

    const draftTravel =
        draft?.fromPlant && draft?.toPlant && getTravelTime ? getTravelTime(draft.fromPlant, draft.toPlant) : null
    const draftClockIn =
        draft?.fromPlant && draft?.toPlant && draft?.time && calcClockIn
            ? calcClockIn(draft.time, draft.fromPlant, draft.toPlant)
            : null

    const scrubberActivityCount = Number.isFinite(viewTime) ? Object.keys(activeOrdersAtTime || {}).length : null

    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            <style>{`
                .plan-flow-map-marker { background: transparent !important; border: none !important; }
                .pf-plant-pin {
                    position: relative;
                    border-radius: 50%;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    font-family: 'Exo 2', system-ui, sans-serif;
                    cursor: pointer;
                    transition: transform 0.12s ease;
                }
                .pf-plant-pin:hover { transform: scale(1.05); }
                .pf-plant-code { font-weight: 800; line-height: 1; letter-spacing: 0.02em; }
                .pf-plant-ops {
                    font-family: 'Exo 2', monospace; font-variant-numeric: tabular-nums;
                    font-size: 10px; font-weight: 700; margin-top: 2px;
                    display: flex; align-items: baseline; gap: 2px;
                }
                .pf-plant-ops span { font-size: 8px; opacity: 0.7; letter-spacing: 0.05em; }
                .pf-plant-badge {
                    position: absolute; top: -4px; right: -4px;
                    width: 16px; height: 16px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; font-size: 11px; font-weight: 800;
                    border: 2px solid var(--bg-primary);
                }
                .pf-needs { background: ${NEEDS_HELP_COLOR}; }
                .pf-leave { background: ${LEAVE_OFF_COLOR}; }
                html.dark .leaflet-tile { filter: brightness(0.78) saturate(0.85) hue-rotate(190deg); }
                .leaflet-container { background: var(--bg-tertiary); }
                .leaflet-control-attribution {
                    background: rgba(255,255,255,0.85) !important;
                    font-size: 10px !important;
                }
                /* Help-route lines — a deep slate base under a glossy
                 * white dashed overlay that marches along the route on
                 * a continuous loop. Reads like premium GPS routing,
                 * neutral against any accent the user has set. */
                .help-route-base {
                    stroke-linecap: round;
                    filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.55));
                }
                .help-route-flow {
                    animation: help-route-flow 1.6s linear infinite;
                    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.9))
                            drop-shadow(0 0 14px rgba(148, 163, 184, 0.55));
                }
                @keyframes help-route-flow {
                    to { stroke-dashoffset: -36; }
                }
                html.dark .help-route-base {
                    filter: drop-shadow(0 0 5px rgba(15, 23, 42, 0.85));
                }
                html.dark .help-route-flow {
                    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 1))
                            drop-shadow(0 0 18px rgba(186, 230, 253, 0.7));
                }
            `}</style>

            <div className="relative flex-1 flex flex-col">
                {/* Toolbar overlay */}
                <div className="shrink-0 flex items-center flex-wrap gap-2 px-3 sm:px-4 py-2 bg-bg-primary border-b border-border-light">
                    <span className="inline-flex items-center gap-1.5 rounded text-[12px] font-medium px-2.5 py-1 bg-bg-secondary border border-border-light">
                        <i className="fas fa-building text-[10px] text-text-tertiary" />
                        <span className="font-mono tabular-nums font-bold text-text-primary">
                            {allPlantStats.length}
                        </span>
                        <span className="text-text-secondary">plants</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded text-[12px] font-medium px-2.5 py-1 bg-bg-secondary border border-border-light">
                        <i className="fas fa-route text-[10px] text-text-tertiary" />
                        <span className="font-mono tabular-nums font-bold text-text-primary">
                            {Object.keys(polylinesByEdgeRef.current).length ||
                                assignments.filter((a) => a.fromPlant && a.toPlant && a.fromPlant !== a.toPlant).length}
                        </span>
                        <span className="text-text-secondary">help routes</span>
                    </span>
                    {pickingDestination && (
                        <span className="inline-flex items-center gap-1.5 rounded text-[11px] font-semibold px-2 py-1 bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.4)] text-[#b45309]">
                            <i className="fas fa-crosshairs text-[10px]" />
                            Click a plant to set the destination
                            <button
                                type="button"
                                onClick={() => setPickingDestination(false)}
                                className="ml-1 border-none bg-transparent cursor-pointer p-0 text-[#b45309] font-bold"
                                aria-label="Cancel picking"
                            >
                                ×
                            </button>
                        </span>
                    )}
                    {selectedCode && !pickingDestination && (
                        <span
                            className="inline-flex items-center gap-1.5 rounded text-[12px] font-medium px-2.5 py-1"
                            style={{
                                background: `${accentColor}1a`,
                                border: `1px solid ${accentColor}55`,
                                color: accentColor
                            }}
                        >
                            <i className="fas fa-map-pin text-[10px]" />
                            Plant {selectedCode}
                            <button
                                type="button"
                                onClick={() => setSelectedCode(null)}
                                className="ml-1 border-none bg-transparent cursor-pointer p-0 font-bold"
                                style={{ color: accentColor }}
                                aria-label="Clear selection"
                            >
                                ×
                            </button>
                        </span>
                    )}
                    {(pendingPlantGeocodes > 0 || pendingRoutes > 0) && (
                        <span className="inline-flex items-center gap-1.5 rounded text-[11px] font-semibold px-2 py-1 bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.35)] text-blue-600">
                            <i className="fas fa-circle-notch fa-spin text-[10px]" />
                            {pendingPlantGeocodes > 0 ? `Locating ${pendingPlantGeocodes}` : `Routing ${pendingRoutes}`}
                            …
                        </span>
                    )}
                    <div className="flex-1 min-w-[8px]" />
                </div>

                <div className="flex-1 min-h-0 relative">
                    <div className="h-full w-full" ref={containerRef} />
                    <div className="absolute bottom-3 right-3 z-[400] pointer-events-none">
                        <PlanFlowTimeScrubber
                            accentColor={accentColor}
                            viewTime={viewTime}
                            onChange={setViewTime}
                            hasActivity={scrubberActivityCount}
                        />
                    </div>
                </div>
            </div>

            <aside className="w-[360px] shrink-0 overflow-y-auto flex flex-col bg-bg-primary border-l border-border-light">
                {!selected && panelMode === 'overview' && <PlanFlowEmptyPanel accentColor={accentColor} />}
                {selected && panelMode === 'overview' && (
                    <PlanFlowPlantOverview
                        accentColor={accentColor}
                        selected={selected}
                        mixerCountsByPlant={mixerCountsByPlant}
                        missingOperators={getMissingOperators(plantProduction, selected.code)}
                        onMissingOperatorsChange={(count) =>
                            setMissingOperators(setPlantProduction, selected.code, count)
                        }
                        yphByCode={yphByCode}
                        yphColorFor={yphColorFor}
                        production={plantProduction[selected.code] || {}}
                        outbound={outbound}
                        inbound={inbound}
                        canEdit={canEdit}
                        onAddRoute={() => openAddRoute(selected)}
                        onEditRoute={openEditRoute}
                        onDeleteRoute={deleteAssignment}
                        calcClockIn={calcClockIn}
                        getTravelTime={getTravelTime}
                    />
                )}
                {(panelMode === 'add' || panelMode === 'edit') && draft && (
                    <PlanFlowRouteEditor
                        accentColor={accentColor}
                        mode={panelMode}
                        draft={draft}
                        setDraft={setDraft}
                        plantProduction={plantProduction}
                        plants={plants}
                        stats={allPlantStats}
                        travel={draftTravel}
                        clockIn={draftClockIn}
                        pickingDestination={pickingDestination}
                        setPickingDestination={setPickingDestination}
                        onCancel={cancelEditor}
                        onSubmit={submitEditor}
                        onDelete={panelMode === 'edit' ? () => deleteAssignment(editingIndex) : null}
                    />
                )}
            </aside>

            {effAtViewTime && null /* keep linter happy until v2 surfaces this in the marker label */}
        </div>
    )
}

export default PlanFlowMapView
