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
import { formatOrderAddress } from '../../../utils/AddressUtility'
import { geocodeAddress, getCachedGeocode } from '../../../utils/GeocodingUtility'
import { yphColorFor } from '../../../utils/PlanFlowLayoutUtility'
import {
    buildAssignmentDriverTimes,
    getMissingOperators,
    PRE_TRIP_MINUTES,
    setMissingOperators
} from '../../../utils/PlanUtility'
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

/* Basemap tiles — CartoDB's Positron / Dark Matter sets. Vastly less
 * busy than the default OSM raster (no shaded relief, muted road
 * hierarchy, fewer minor labels) so the plant pins and animated routes
 * stay the visual focus. */
const CARTO_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; ' +
    '<a href="https://carto.com/attributions">CARTO</a>'
const CARTO_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

/** Reads the current theme directly off the `<html>` class list — the
 *  same source the app uses to flip `--bg-*` tokens — so the basemap
 *  matches the active theme without a separate context dependency. */
function isDarkTheme() {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
}

function buildTileLayer() {
    return L.tileLayer(isDarkTheme() ? CARTO_DARK_URL : CARTO_LIGHT_URL, {
        attribution: CARTO_ATTRIBUTION,
        maxZoom: 19,
        subdomains: 'abcd'
    })
}

/* Autoplay timing — how fast the cycle ticks through the day. 5-minute
 * steps every 120ms keeps the same ~35-second full-day loop the larger
 * 15-min tick used to land, but with three times the fidelity so the
 * directional arrows visibly walk along their routes instead of
 * jumping between sparse waypoints. */
const AUTOPLAY_STEP_MINUTES = 5
const AUTOPLAY_TICK_MS = 120
const MINUTES_IN_DAY = 24 * 60

const REGION_STATE_HINTS = {
    AGG: 'Tennessee',
    TN: 'Tennessee'
}

const HTML_ESCAPES = { '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }
/** Escape a free-form string for embedding inside a Leaflet tooltip's
 *  HTML payload. Order matters in `HTML_ESCAPES`: `&` first prevents
 *  double-escaping the entity sequences we then insert. */
function escapeTooltip(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
}

/* Geocoding sanity checks — drive times over 2 hours from the destination
 * plant are not real concrete deliveries; concrete sets in roughly 90
 * minutes from water contact, so anything that far away is a Nominatim
 * misfire ("Memphis, TN" geocoding to Memphis, NY). The straight-line cap
 * is a cheap pre-filter applied at geocode time; the drive-time cap is
 * the precise check applied after OSRM resolves the actual route. */
const MAX_JOB_STRAIGHT_LINE_MILES = 120
const MAX_JOB_DRIVE_SECONDS = 2 * 60 * 60
const EARTH_RADIUS_MILES = 3958.8
const US_STATE_CODE_REGEX = /,\s*([A-Z]{2})\b/

/** Great-circle distance between two `{ lat, lng }` points in miles. */
function haversineMiles(a, b) {
    if (
        !a ||
        !b ||
        !Number.isFinite(a.lat) ||
        !Number.isFinite(a.lng) ||
        !Number.isFinite(b.lat) ||
        !Number.isFinite(b.lng)
    ) {
        return Infinity
    }
    const toRad = (degrees) => (degrees * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h))
}

/** Pull a two-letter state code out of a plant's address string so we can
 *  hint the geocoder with the correct state per plant — Tennessee is the
 *  app's default but Texas / others bleed in for districts whose plant
 *  addresses sit elsewhere. Returns null when the address lacks a clean
 *  ", XX" segment. */
function inferStateCodeFromAddress(address) {
    if (!address) return null
    const match = String(address).toUpperCase().match(US_STATE_CODE_REGEX)
    return match ? match[1] : null
}

/** Route-leg color tokens. Outbound (going to help) is red, return
 *  (heading home) is green. Slate is the at-rest base used when a leg's
 *  drivers haven't started moving on it yet. */
const ROUTE_OUTBOUND_COLOR = '#dc2626'
const ROUTE_RETURN_COLOR = '#16a34a'
const ROUTE_IDLE_COLOR = '#0f172a'

/** Sample a polyline at the given path fraction (0 → 1). Returns the
 *  interpolated point plus the bearing of the segment it lands on as a
 *  CSS rotation so a downstream `▶` glyph points along the route. Falls
 *  back to null for empty / degenerate paths. */
function pointAlongPath(coords, fraction) {
    if (!Array.isArray(coords) || coords.length < 2) return null
    const lens = []
    let total = 0
    for (let i = 1; i < coords.length; i++) {
        const dlat = coords[i][0] - coords[i - 1][0]
        const dlng = coords[i][1] - coords[i - 1][1]
        const len = Math.hypot(dlng, dlat)
        lens.push(len)
        total += len
    }
    if (total <= 0) return null
    const clamped = Math.max(0, Math.min(1, fraction))
    const target = total * clamped
    let acc = 0
    for (let i = 0; i < lens.length; i++) {
        if (acc + lens[i] >= target) {
            const t = lens[i] === 0 ? 0 : (target - acc) / lens[i]
            const lat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t
            const lng = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t
            const dlat = coords[i + 1][0] - coords[i][0]
            const dlng = coords[i + 1][1] - coords[i][1]
            // Bearing (deg, 0 = north, clockwise) → CSS rotation
            // (deg, 0 = pointing right) is bearing − 90.
            const bearing = (Math.atan2(dlng, dlat) * 180) / Math.PI
            return { angleDeg: bearing - 90, lat, lng }
        }
        acc += lens[i]
    }
    return null
}

/** Average progress (0 → 1) along the named leg's transit window across
 *  every driver who is actively on the road right now. Returns null when
 *  nobody is currently transiting this leg. */
function legProgressFraction({ drivers, leg, travel, viewTime }) {
    if (!Number.isFinite(viewTime) || !Array.isArray(drivers) || drivers.length === 0) return null
    const fractions = []
    for (const driver of drivers) {
        if (!Number.isFinite(driver.arriveMin)) continue
        let startMin
        let endMin
        if (leg === 'outbound') {
            startMin = Math.max(0, driver.arriveMin - travel - PRE_TRIP_MINUTES)
            endMin = driver.arriveMin
        } else {
            const leave =
                Number.isFinite(driver.leaveMin) && driver.leaveMin > driver.arriveMin ? driver.leaveMin : null
            if (leave == null) continue
            startMin = leave
            endMin = leave + travel
        }
        if (endMin <= startMin) continue
        if (viewTime < startMin || viewTime >= endMin) continue
        fractions.push((viewTime - startMin) / (endMin - startMin))
    }
    if (fractions.length === 0) return null
    return fractions.reduce((a, b) => a + b, 0) / fractions.length
}

/** Decide where (and whether) to anchor the leg's directional arrow. The
 *  arrow only shows while the leg is actually in transit — it sits at the
 *  average driver's progress fraction so the marker visibly walks along
 *  the route as `viewTime` ticks forward. */
function resolveLegAnchor({ activity, coords, drivers, leg, travel, viewTime }) {
    if (!coords || coords.length < 2) return null
    if (activity !== 'transit') return null
    const fraction = legProgressFraction({ drivers, leg, travel, viewTime })
    if (fraction == null) return null
    const point = pointAlongPath(coords, fraction)
    if (!point) return null
    return point
}

/** Build a Leaflet DivIcon containing a single `▶` glyph rotated to point
 *  along the route at the marker's location. Inactive legs render an
 *  empty icon (no glyph, no dim ghost) so the map stays clean when the
 *  leg isn't currently moving. */
function makeArrowIcon({ active, color, rotationDeg }) {
    if (!active) {
        return L.divIcon({
            className: 'plan-flow-arrow-marker',
            html: '',
            iconAnchor: [10, 10],
            iconSize: [20, 20]
        })
    }
    return L.divIcon({
        className: 'plan-flow-arrow-marker',
        html:
            `<div class="pf-route-arrow" ` +
            `style="color:${color};transform:rotate(${rotationDeg.toFixed(1)}deg)">` +
            `<i class="fas fa-play"></i>` +
            `</div>`,
        iconAnchor: [10, 10],
        iconSize: [20, 20]
    })
}

/** Translate one assignment's `{ outbound, returning }` activity state
 *  into the Leaflet style objects for both legs. The outbound polyline
 *  reads red while operators are en-route to help and tones down once
 *  they've arrived; the return polyline reads green only while they're
 *  actually heading home, otherwise it sits muted so the geometry stays
 *  readable without competing with the active leg. */
function makeLegStyles({ activity, isInvolved, selectedCode }) {
    const selectionOpacity = isInvolved ? 1 : selectedCode ? 0.35 : 0.85

    const leg = (state, activeColor) => {
        const isTransit = state === 'transit'
        const isAtDest = state === 'at-dest'
        const activityOpacity = isTransit ? 1 : isAtDest ? 0.45 : 0.18
        const opacityScale = Math.min(activityOpacity, selectionOpacity)
        const baseColor = isTransit ? activeColor : ROUTE_IDLE_COLOR
        return {
            base: {
                className: 'help-route-base',
                color: baseColor,
                opacity: (isTransit ? 0.95 : 0.62) * opacityScale,
                weight: isInvolved ? 7 : 6
            },
            flow: {
                className: isTransit ? 'help-route-flow' : 'help-route-flow-static',
                color: '#ffffff',
                dashArray: '12 24',
                lineCap: 'round',
                opacity: (isTransit ? 1 : isAtDest ? 0 : 0.5) * opacityScale,
                weight: isInvolved ? 4 : 3
            }
        }
    }

    const outbound = leg(activity.outbound, ROUTE_OUTBOUND_COLOR)
    const returning = leg(activity.returning, ROUTE_RETURN_COLOR)
    return {
        outboundBase: outbound.base,
        outboundFlow: outbound.flow,
        returnBase: returning.base,
        returnFlow: returning.flow
    }
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
    effAtViewTime,
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
    /* When the scrubber is active, the headcount on the pin walks the
     * help schedule minute-by-minute (subtracted while operators are en
     * route, credited at the destination once they arrive, returned home
     * after they leave). Falls back to the day-wide effective count in
     * "All day" mode. */
    const liveEff =
        Number.isFinite(viewTime) && effAtViewTime && Number.isFinite(effAtViewTime[stat.code])
            ? effAtViewTime[stat.code]
            : eff
    const effWithMissing = Math.max(0, liveEff - missingAtPlant)
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
    const tileLayerRef = useRef(null)
    const plantLayerRef = useRef(null)
    const jobLayerRef = useRef(null)
    const routeLayerRef = useRef(null)
    const markersByCodeRef = useRef({})
    const jobMarkersByKeyRef = useRef({})
    const polylinesByEdgeRef = useRef({})
    const draftPolylineRef = useRef(null)
    const initiallyFitRef = useRef(false)

    const [geocodedPlants, setGeocodedPlants] = useState([])
    const [routesByEdgeKey, setRoutesByEdgeKey] = useState({})
    const [draftRouteCoords, setDraftRouteCoords] = useState(null)
    /* Per-assignment "from → job → return" route coords. Populated only
     * when an assignment has `forOrderId` AND the job's address geocodes
     * cleanly — otherwise the renderer falls back to the plain plant-to-
     * plant edge from `routesByEdgeKey`. */
    const [jobRoutesByIdx, setJobRoutesByIdx] = useState({})
    /* Land on midnight + autoplay so the tab loads with the day already
     * cycling — the user sees activity light up plant by plant without
     * having to find the Play button first. */
    const [viewTime, setViewTime] = useState(0)
    const [isPlaying, setIsPlaying] = useState(true)
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

    /* Leaflet marker click handlers are bound once when the marker is
     * created and never re-bound, so a closure over `handleNodeClick`
     * captures the React state at that moment. Without this ref, opening
     * the route editor toggles `pickingDestination` in React state but
     * the marker still fires the original handler — which only ever sees
     * `pickingDestination=false` and falls through to plain selection
     * instead of setting the destination. The ref always points at the
     * latest handler so the click sees current state. */
    const handleNodeClickRef = useRef(handleNodeClick)
    useEffect(() => {
        handleNodeClickRef.current = handleNodeClick
    }, [handleNodeClick])

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
        usePlanFlowMetrics({ assignments, getTravelTime, planDate, plantProduction, stats, viewTime })

    /* ── Init Leaflet map once ──────────────────────────────────── */
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        const map = L.map(containerRef.current, {
            center: TENNESSEE_CENTER,
            scrollWheelZoom: true,
            // Quarter-step zoom snap so the initial fit can tighten in
            // by half a level beyond the natural bounds zoom — keeps the
            // plants in the middle of the viewport instead of hugging
            // the edges.
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
            zoomSnap: 0.25
        })
        const tileLayer = buildTileLayer().addTo(map)
        tileLayerRef.current = tileLayer
        routeLayerRef.current = L.layerGroup().addTo(map) // routes first
        jobLayerRef.current = L.layerGroup().addTo(map) // job pins above routes, below plants
        plantLayerRef.current = L.layerGroup().addTo(map) // plants on top
        mapRef.current = map
        return () => {
            map.remove()
            mapRef.current = null
            tileLayerRef.current = null
            plantLayerRef.current = null
            jobLayerRef.current = null
            routeLayerRef.current = null
            markersByCodeRef.current = {}
            jobMarkersByKeyRef.current = {}
            polylinesByEdgeRef.current = {}
        }
    }, [])

    /* ── Swap basemap when the app theme flips ───────────────────
     * Watches the `<html>` element's class list (where the app toggles
     * `.dark`) and re-creates the tile layer so light mode uses CartoDB
     * Positron and dark mode uses Dark Matter. No-op when the class
     * change doesn't actually change the desired URL. */
    useEffect(() => {
        if (typeof document === 'undefined') return undefined
        const root = document.documentElement
        const swap = () => {
            const map = mapRef.current
            const current = tileLayerRef.current
            if (!map || !current) return
            const desiredUrl = isDarkTheme() ? CARTO_DARK_URL : CARTO_LIGHT_URL
            const currentUrl = typeof current.getTileUrl === 'function' ? current._url : null
            if (currentUrl === desiredUrl) return
            map.removeLayer(current)
            const next = buildTileLayer().addTo(map)
            tileLayerRef.current = next
        }
        const observer = new MutationObserver(swap)
        observer.observe(root, { attributeFilter: ['class'], attributes: true })
        return () => observer.disconnect()
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

    /* ── Fit map bounds to plants on first land ───────────────────
     * `fitBounds` alone leaves the plants hugging the viewport edges
     * (its "fit" assumes you want everything visible at the looser zoom).
     * We tighten the result by half a zoom level once bounds are
     * computed — the same plants stay centered, the basemap reveals
     * more roads + city context behind them. */
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
                effAtViewTime,
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
            // Signature of every visual property the pin renders. The
            // autoplay re-runs this effect every 120ms, but the pin
            // itself only changes when one of these flips. Without the
            // skip, every tick swaps the marker's DOM element and any
            // click landing mid-swap gets dropped — the "spam click to
            // make it open" symptom.
            const sig = [
                status.effWithMissing,
                status.ringColor,
                status.isSelected ? 1 : 0,
                status.isDestinationCandidate ? 1 : 0,
                status.needsHelp ? 1 : 0,
                status.hasLeaveOff ? 1 : 0,
                status.send,
                status.recv
            ].join('|')
            const existing = markersByCodeRef.current[stat.code]
            if (existing) {
                existing.setLatLng([pos.lat, pos.lng])
                if (existing._planFlowSig !== sig) {
                    existing.setIcon(makePlantIcon(stat, status, accentColor))
                    existing._planFlowSig = sig
                }
            } else {
                // zIndexOffset keeps the plant pin above the job pins and
                // directional arrows that sit in the same marker pane —
                // without it, a job pin near a plant could steal the
                // click event and the side panel wouldn't open.
                const marker = L.marker([pos.lat, pos.lng], {
                    icon: makePlantIcon(stat, status, accentColor),
                    riseOnHover: true,
                    zIndexOffset: 1000
                })
                marker._planFlowSig = sig
                marker.on('click', () => handleNodeClickRef.current?.(stat.code))
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
        effAtViewTime,
        geocodedPlants,
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

    /* ── Resolve via-job routes when assignments target a specific order
     * Mirrors the Find-a-Spot address pipeline: compose the order's
     * street + city with `formatOrderAddress`, geocode with the same
     * `geocodeAddress` helper (which already handles state hints and
     * fallback variants), then stitch two OSRM legs (fromPlant → job and
     * job → returnPlant) into one continuous polyline. Falls back
     * silently to the plain plant-to-plant route if any step misses. */
    /** Map of plant_code → { address, state }. State is inferred from the
     *  plant's address so a Texas plant geocodes its orders with Texas as
     *  the hint regardless of the region's global default. */
    const plantMetaByCode = useMemo(() => {
        const out = {}
        ;(plants || []).forEach((plant) => {
            const code = plant?.plant_code
            if (!code) return
            out[code] = {
                address: plant.plant_address || '',
                state: inferStateCodeFromAddress(plant.plant_address) || null
            }
        })
        return out
    }, [plants])

    useEffect(() => {
        const eligible = assignments
            .map((a, idx) => ({ a, idx }))
            .filter(({ a }) => a?.forOrderId && a?.fromPlant && a?.toPlant)
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
        // Drop entries whose underlying assignment no longer routes via a
        // specific job so we don't render stale geometry after edits.
        const activeIdxSet = new Set(eligible.map(({ idx }) => idx))
        setJobRoutesByIdx((prev) => {
            const next = {}
            Object.entries(prev).forEach(([k, v]) => {
                const idx = Number(k)
                if (activeIdxSet.has(idx)) next[k] = v
            })
            return next
        })
        if (eligible.length === 0) return undefined

        let cancelled = false
        ;(async () => {
            const updates = {}
            for (const { a, idx } of eligible) {
                if (cancelled) return
                const destPlant = plantProduction?.[a.toPlant]
                const order = (destPlant?.orders || []).find((o) => (o.orderId || o.orderNum) === a.forOrderId)
                if (!order) continue
                const street = String(order.address || '').trim()
                const city = String(order.city || '').trim()
                if (!street && !city) continue
                const composedLabel = formatOrderAddress(order, ', ')
                const destAnchor = plantsByCode.get(a.toPlant)
                if (!destAnchor) continue
                const orderStateHint = plantMetaByCode[a.toPlant]?.state || stateHint
                // Reject coords that are wildly far from the destination
                // plant — those are Nominatim picking the wrong state /
                // city ("Memphis, TN" → "Memphis, NY"). Cap is a cheap
                // pre-filter; the OSRM drive-time check below catches the
                // borderline cases.
                const validate = (coords) =>
                    haversineMiles(coords, { lat: destAnchor.lat, lng: destAnchor.lng }) <= MAX_JOB_STRAIGHT_LINE_MILES
                const cachedJob = getCachedGeocode(street, city, orderStateHint, { validate })
                const jobCoords = cachedJob || (await geocodeAddress(street, city, orderStateHint, { validate }))
                if (cancelled) return
                if (!jobCoords) continue
                const from = plantsByCode.get(a.fromPlant)
                const returnCode = a.returnPlant || a.fromPlant
                const ret = plantsByCode.get(returnCode)
                if (!from || !ret) continue
                const fromKey = { lat: from.lat, lng: from.lng }
                const jobKey = { lat: jobCoords.lat, lng: jobCoords.lng }
                const retKey = { lat: ret.lat, lng: ret.lng }
                const outRoute = getCachedRoute(fromKey, jobKey) || (await getDrivingRoute(fromKey, jobKey))
                if (cancelled) return
                // Hard cap — any leg over two hours is unrealistic for a
                // ready-mix delivery (concrete sets in ~90 min from water
                // contact) and almost certainly reflects a geocoder
                // misfire that slipped past the straight-line filter.
                // Fall back to plain plant-to-plant routing in that case.
                if (outRoute && outRoute.duration > MAX_JOB_DRIVE_SECONDS) continue
                const backRoute = getCachedRoute(jobKey, retKey) || (await getDrivingRoute(jobKey, retKey))
                if (cancelled) return
                if (backRoute && backRoute.duration > MAX_JOB_DRIVE_SECONDS) continue
                const outCoords =
                    outRoute?.coords?.length >= 2
                        ? outRoute.coords
                        : [
                              [from.lat, from.lng],
                              [jobCoords.lat, jobCoords.lng]
                          ]
                const backCoords =
                    backRoute?.coords?.length >= 2
                        ? backRoute.coords
                        : [
                              [jobCoords.lat, jobCoords.lng],
                              [ret.lat, ret.lng]
                          ]
                const outDistance = outRoute?.distance || 0
                const backDistance = backRoute?.distance || 0
                const outDuration = outRoute?.duration || 0
                const backDuration = backRoute?.duration || 0
                updates[idx] = {
                    backCoords,
                    backDistance,
                    backDuration,
                    backLegMinutes: backDuration ? Math.round(backDuration / 60) : null,
                    forOrderId: a.forOrderId,
                    fromPlant: a.fromPlant,
                    jobCoords,
                    jobLabel: composedLabel || order.customer || `Order ${order.orderNum || ''}`.trim(),
                    outCoords,
                    outDistance,
                    outDuration,
                    outLegMinutes: outDuration ? Math.round(outDuration / 60) : null,
                    returnCode
                }
            }
            if (!cancelled && Object.keys(updates).length) {
                setJobRoutesByIdx((prev) => ({ ...prev, ...updates }))
            }
        })()
        return () => {
            cancelled = true
        }
    }, [assignments, geocodedPlants, plantMetaByCode, plantProduction, stateHint])

    /** Classify each leg of an assignment's day at the given minute. The
     *  outbound and return legs are tracked separately so the renderer can
     *  show the outbound polyline as "in transit" red while the return
     *  polyline reads as "idle" green (and vice-versa during the back leg).
     *
     *  Returns `{ outbound, returning }`, each one of:
     *   - 'transit'  — at least one driver is on that leg right now
     *   - 'at-dest'  — drivers have completed that leg's arrival and are
     *                   between legs (only the outbound leg uses this)
     *   - 'inactive' — nobody is on this leg at the moment
     */
    const classifyAssignmentActivity = (assignment, atMinute, travelMinutes) => {
        if (!Number.isFinite(atMinute)) return { outbound: 'inactive', returning: 'inactive' }
        const drivers = buildAssignmentDriverTimes(assignment)
        if (drivers.length === 0) return { outbound: 'inactive', returning: 'inactive' }
        const travel = Number.isFinite(travelMinutes) ? travelMinutes : 30
        let outboundInTransit = false
        let outboundAtDest = false
        let returningInTransit = false
        for (const driver of drivers) {
            if (!Number.isFinite(driver.arriveMin)) continue
            const transitStart = Math.max(0, driver.arriveMin - travel - PRE_TRIP_MINUTES)
            const transitEnd = driver.arriveMin
            const leaveMin = Number.isFinite(driver.leaveMin) ? driver.leaveMin : null
            const returnArrival = leaveMin != null ? leaveMin + travel : null
            if (atMinute >= transitStart && atMinute < transitEnd) {
                outboundInTransit = true
                continue
            }
            if (leaveMin != null && atMinute >= leaveMin && returnArrival != null && atMinute < returnArrival) {
                returningInTransit = true
                continue
            }
            if (leaveMin != null && atMinute >= transitEnd && atMinute < leaveMin) {
                outboundAtDest = true
            } else if (leaveMin == null && atMinute >= transitEnd) {
                outboundAtDest = true
            }
        }
        return {
            outbound: outboundInTransit ? 'transit' : outboundAtDest ? 'at-dest' : 'inactive',
            returning: returningInTransit ? 'transit' : 'inactive'
        }
    }

    /* ── Render route polylines ───────────────────────────────────
     * Each assignment gets TWO polyline pairs in a single layer group:
     *   - Outbound (going to help) — red base + animated white flow.
     *   - Return (heading home) — green base + animated white flow,
     *     with the coords reversed so the dash flow reads as travelling
     *     toward the home plant.
     *
     * Per-leg styling reacts to the activity state at `viewTime`:
     *   - 'transit'   — full opacity, animated flow (operators on the road)
     *   - 'at-dest'   — base only (outbound only — they've arrived)
     *   - 'inactive'  — heavily dimmed so the geometry stays oriented
     *                   without competing with the active routes
     *   - 'all-day'   — the All-day view: both legs read as always-on. */
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
            const activity = classifyAssignmentActivity(a, viewTime, travelHint)

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

            // Directional ▶ glyphs that walk the route as time advances:
            // outbound from source → destination, return from destination
            // → home. Position is resampled each render from each leg's
            // average driver progress, so the autoplay tick visibly
            // marches the arrow forward. Hidden entirely when the leg
            // isn't in motion.
            const drivers = buildAssignmentDriverTimes(a)
            const outArrowAnchor = resolveLegAnchor({
                activity: activity.outbound,
                coords: outCoords,
                drivers,
                leg: 'outbound',
                travel: travelHint,
                viewTime
            })
            const backArrowAnchor = resolveLegAnchor({
                activity: activity.returning,
                coords: backCoords,
                drivers,
                leg: 'returning',
                travel: travelHint,
                viewTime
            })
            const outActive = !!outArrowAnchor
            const backActive = !!backArrowAnchor
            const arrowFallback = pointAlongPath(outCoords, 0.5)
            const arrowFallbackBack = pointAlongPath(backCoords, 0.5)

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
                if (existing.outArrow) {
                    const anchor = outArrowAnchor || arrowFallback
                    if (anchor) existing.outArrow.setLatLng([anchor.lat, anchor.lng])
                    existing.outArrow.setIcon(
                        makeArrowIcon({
                            active: outActive,
                            color: ROUTE_OUTBOUND_COLOR,
                            rotationDeg: outArrowAnchor?.angleDeg ?? anchor?.angleDeg ?? 0
                        })
                    )
                }
                if (existing.backArrow) {
                    const anchor = backArrowAnchor || arrowFallbackBack
                    if (anchor) existing.backArrow.setLatLng([anchor.lat, anchor.lng])
                    existing.backArrow.setIcon(
                        makeArrowIcon({
                            active: backActive,
                            color: ROUTE_RETURN_COLOR,
                            rotationDeg: backArrowAnchor?.angleDeg ?? anchor?.angleDeg ?? 0
                        })
                    )
                }
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
                const outSeed = outArrowAnchor || arrowFallback
                const backSeed = backArrowAnchor || arrowFallbackBack
                const outArrow = outSeed
                    ? L.marker([outSeed.lat, outSeed.lng], {
                          icon: makeArrowIcon({
                              active: outActive,
                              color: ROUTE_OUTBOUND_COLOR,
                              rotationDeg: outSeed.angleDeg
                          }),
                          interactive: false
                      })
                    : null
                const backArrow = backSeed
                    ? L.marker([backSeed.lat, backSeed.lng], {
                          icon: makeArrowIcon({
                              active: backActive,
                              color: ROUTE_RETURN_COLOR,
                              rotationDeg: backSeed.angleDeg
                          }),
                          interactive: false
                      })
                    : null
                if (outArrow) outArrow.addTo(group)
                if (backArrow) backArrow.addTo(group)
                group.addTo(layer)
                polylinesByEdgeRef.current[key] = { backArrow, backBase, backFlow, group, outArrow, outBase, outFlow }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignments, geocodedPlants, getTravelTime, jobRoutesByIdx, routesByEdgeKey, selectedCode, viewTime])

    /** Aggregate trucks-on-site per job at the current `viewTime`. Each
     *  via-job assignment contributes one count per driver whose work
     *  window covers the current minute (arrived but not yet left). When
     *  the scrubber is in "All day" mode we return an empty list so the
     *  pins only appear while the day is actually playing. */
    const jobNodes = useMemo(() => {
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

    /* ── Render the job pins ─────────────────────────────────────
     * A small amber pin appears at each job site that currently has
     * operators on it; the pin shows the headcount and disappears the
     * moment the last operator's `leaveMin` passes. Sits between routes
     * and plant markers so plant pins always win the hit test. */
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
    }, [jobNodes])

    /* ── Resolve coords for the in-progress draft route ──────────
     * As soon as the user has both a fromPlant and a toPlant on the
     * draft (whether they're adding a new route or editing an existing
     * one), kick off the same OSRM lookup we use for committed routes
     * and seed with the straight-line fallback while we wait. */
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

    /* ── Render the draft polyline ────────────────────────────────
     * One bright amber polyline that always sits above the committed
     * routes so the user can see exactly what they're building. Cleared
     * the moment the editor closes or either endpoint is unset. */
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
    }, [draftRouteCoords])

    /* ── Resize observer so Leaflet re-measures on tab swaps ────── */
    useEffect(() => {
        if (!containerRef.current || !mapRef.current) return
        const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [])

    /* ── Autoplay: cycle viewTime through the day on a loop ──────
     * Runs only while `isPlaying` is true. Every tick advances by
     * `AUTOPLAY_STEP_MINUTES` and wraps from 23:45 back to 00:00 so the
     * cycle is genuinely continuous. Pauses automatically if the editor
     * opens (so the user isn't fighting a moving scrubber). */
    useEffect(() => {
        if (!isPlaying) return undefined
        if (panelMode === 'add' || panelMode === 'edit') {
            setIsPlaying(false)
            return undefined
        }
        const id = window.setInterval(() => {
            setViewTime((prev) => {
                const current = Number.isFinite(prev) ? prev : 0
                const next = current + AUTOPLAY_STEP_MINUTES
                return next >= MINUTES_IN_DAY ? next - MINUTES_IN_DAY : next
            })
        }, AUTOPLAY_TICK_MS)
        return () => window.clearInterval(id)
    }, [isPlaying, panelMode])

    const handlePlayToggle = () => setIsPlaying((prev) => !prev)

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
                .leaflet-container { background: var(--bg-tertiary); }
                .leaflet-control-attribution {
                    background: rgba(255, 255, 255, 0.85) !important;
                    color: #475569 !important;
                    font-size: 10px !important;
                }
                html.dark .leaflet-control-attribution {
                    background: rgba(15, 23, 42, 0.85) !important;
                    color: #cbd5e1 !important;
                }
                html.dark .leaflet-control-attribution a {
                    color: #93c5fd !important;
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
                /* Static variant — same look minus the animation. Used by
                 * routes whose operators are pouring at the destination or
                 * outside their trip window. */
                .help-route-flow-static {
                    stroke-linecap: round;
                    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.45));
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
                html.dark .help-route-flow-static {
                    filter: drop-shadow(0 0 6px rgba(186, 230, 253, 0.55));
                }
                /* Job pin — shows up at a job site only while operators
                 * are actually on-site there. Amber to match the in-transit
                 * route color, hard-hat glyph to read as "active pour". */
                .plan-flow-job-marker { background: transparent !important; border: none !important; }
                .pf-job-pin {
                    position: relative;
                    width: 28px; height: 28px;
                    border-radius: 50%;
                    background: #f59e0b;
                    color: #fff;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 0 0 2px var(--bg-primary), 0 2px 6px rgba(0,0,0,0.35);
                    font-size: 12px;
                    animation: pf-job-pin-pulse 1.6s ease-in-out infinite;
                }
                .pf-job-count {
                    position: absolute;
                    top: -6px; right: -6px;
                    min-width: 16px; height: 16px; padding: 0 4px;
                    border-radius: 8px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    border: 1.5px solid #f59e0b;
                    font-family: 'Exo 2', system-ui, sans-serif;
                    font-size: 10px; font-weight: 800; line-height: 13px;
                    text-align: center;
                }
                @keyframes pf-job-pin-pulse {
                    0%, 100% { box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 0 rgba(245, 158, 11, 0.55); }
                    50%      { box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 6px rgba(245, 158, 11, 0); }
                }
                /* Direction arrows that walk the route while operators
                 * are in transit. Color is set inline so the same icon
                 * component renders red for outbound and green for the
                 * return. */
                .plan-flow-arrow-marker { background: transparent !important; border: none !important; pointer-events: none; }
                .pf-route-arrow {
                    width: 20px; height: 20px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; line-height: 1;
                    filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.55));
                    transition: transform 200ms ease, opacity 200ms ease;
                    transform-origin: 50% 50%;
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
                    {/* Scrubber docks flush in the bottom-right corner so
                     * it sits directly over the Leaflet attribution
                     * watermark instead of leaving a strip of map behind
                     * it. The wrapper z-index has to clear Leaflet's
                     * default `.leaflet-control` (z=800) — otherwise the
                     * attribution renders on top of the scrubber.
                     * `pointer-events-none` on the wrapper keeps the
                     * map draggable everywhere the scrubber doesn't
                     * physically occupy. */}
                    <div className="absolute bottom-0 right-0 z-[1000] pointer-events-none">
                        <PlanFlowTimeScrubber
                            accentColor={accentColor}
                            hasActivity={scrubberActivityCount}
                            isPlaying={isPlaying}
                            onChange={setViewTime}
                            onPlayToggle={handlePlayToggle}
                            viewTime={viewTime}
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
