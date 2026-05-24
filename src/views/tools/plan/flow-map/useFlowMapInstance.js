import L from 'leaflet'
import { useEffect, useRef } from 'react'

import {
    buildTileLayer,
    CARTO_DARK_URL,
    CARTO_LIGHT_URL,
    DEFAULT_ZOOM,
    isDarkTheme,
    TENNESSEE_CENTER
} from './flowMapShared'

/** Owns the Leaflet map instance, the four layer groups (routes / jobs /
 *  plants / draft), the theme-flip observer, the resize observer, and the
 *  pan/zoom transition-suspend body class. Returns the refs the rest of
 *  the map effects mutate in place. */
export function useFlowMapInstance() {
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
    /* Dotted "loaded direct" edges. One Leaflet polyline per
     * `${forOrderId}@${toPlant}` pair — a thin slate dashed line
     * from the geocoded job location to the plant the order belongs
     * to. Independent of the transit polylines so a route can show
     * its green outbound + orange return chrome AND a quiet relationship
     * indicator to the order's home plant at the same time. */
    const directLinesByKeyRef = useRef({})
    const initiallyFitRef = useRef(false)

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

    /* ── Resize observer so Leaflet re-measures on tab swaps ────── */
    useEffect(() => {
        if (!containerRef.current || !mapRef.current) return
        const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [])

    /* ── Suspend arrow position transitions during pan / zoom ─────
     * The arrow markers carry a `transition: transform` so their per-
     * tick lat/lng updates lerp smoothly between ticks. During a map
     * drag or zoom, every marker's projection shifts at once — without
     * this guard each arrow would slide a frame behind the basemap.
     * We toggle a body-level class so all arrows can opt out via CSS
     * specificity, then re-enable the transition on the next animation
     * frame after the move settles. */
    useEffect(() => {
        const map = mapRef.current
        if (!map) return undefined
        const cls = 'pf-map-moving'
        const disable = () => document.body.classList.add(cls)
        const enable = () => {
            // rAF defer so the transform Leaflet just wrote lands before
            // we re-enable transitions — otherwise the next tick would
            // animate from the pre-pan position.
            requestAnimationFrame(() => document.body.classList.remove(cls))
        }
        map.on('movestart zoomstart', disable)
        map.on('moveend zoomend', enable)
        return () => {
            map.off('movestart zoomstart', disable)
            map.off('moveend zoomend', enable)
            document.body.classList.remove(cls)
        }
    }, [])

    return {
        containerRef,
        directLinesByKeyRef,
        draftPolylineRef,
        initiallyFitRef,
        jobLayerRef,
        jobMarkersByKeyRef,
        mapRef,
        markersByCodeRef,
        plantLayerRef,
        polylinesByEdgeRef,
        routeLayerRef,
        tileLayerRef
    }
}
