/* eslint-disable react/forbid-dom-props */
import L from 'leaflet'
import React, { useEffect, useRef } from 'react'

import { buildTileLayer, isDarkTheme, TENNESSEE_CENTER } from '../../../../views/tools/plan/flow-map/flowMapShared'

/** Lifecycle stage display config — label + color pair for popup badges. */
const LIFECYCLE_BADGE_STYLES = {
    active: { color: '#16a34a', label: 'Active' },
    churned: { color: '#dc2626', label: 'Churned' },
    customer: { color: '#2563eb', label: 'Customer' },
    inactive: { color: '#9ca3af', label: 'Inactive' },
    prospect: { color: '#d97706', label: 'Prospect' },
    win_back: { color: '#7c3aed', label: 'Win Back' }
}

const DEFAULT_ZOOM = 8

/** Build a Leaflet DivIcon for a CRM account pin. Uses the same DivIcon
 *  pattern as the flow-map so PNG icon paths are never needed. */
function makeAccountIcon(accentColor) {
    const color = accentColor || '#2563eb'
    return L.divIcon({
        className: 'crm-account-marker',
        html: `<div style="
            width:14px;height:14px;
            border-radius:50%;
            background:${color};
            box-shadow:0 0 0 2.5px #fff,0 1px 4px rgba(0,0,0,0.4);
        "></div>`,
        iconAnchor: [7, 7],
        iconSize: [14, 14]
    })
}

/** Popup HTML for a single mapped account — name + lifecycle badge. */
function buildPopupHtml(row) {
    const badge = LIFECYCLE_BADGE_STYLES[row.lifecycle_stage] || null
    const badgeHtml = badge
        ? `<span style="
            display:inline-block;
            margin-top:4px;
            padding:1px 7px;
            border-radius:9999px;
            font-size:10px;
            font-weight:600;
            color:#fff;
            background:${badge.color};
            letter-spacing:0.03em;
          ">${badge.label}</span>`
        : ''
    const name = String(row.customer_name ?? row.name ?? 'Unknown').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    )
    return `<div style="font-size:12.5px;font-weight:600;color:var(--text-primary);line-height:1.3;">${name}</div>${badgeHtml}`
}

/**
 * Map view for the CRM Call List tab. Renders a Leaflet map with one pin
 * per account that has finite lat/lng coordinates. Falls back to an empty
 * state when none are geocoded yet.
 *
 * @param {{ accentColor: string, roster: Array }} props
 */
export function CrmMapPage({ accentColor, roster }) {
    const containerRef = useRef(null)
    const mapRef = useRef(null)
    const tileLayerRef = useRef(null)
    const markerLayerRef = useRef(null)

    const mapped = (roster ?? []).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))

    /* ── Init Leaflet map once (mirrors useFlowMapInstance) ─────────
     * Guard: no container → nothing to init. Guard: map already exists
     * → skip to avoid double-init on StrictMode double-invocation. */
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        const map = L.map(containerRef.current, {
            center: TENNESSEE_CENTER,
            scrollWheelZoom: true,
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
            zoomSnap: 0.25
        })
        const tileLayer = buildTileLayer().addTo(map)
        tileLayerRef.current = tileLayer
        markerLayerRef.current = L.layerGroup().addTo(map)
        mapRef.current = map

        return () => {
            map.remove()
            mapRef.current = null
            tileLayerRef.current = null
            markerLayerRef.current = null
        }
    }, [])

    /* ── Swap basemap when app theme flips (mirrors useFlowMapInstance) */
    useEffect(() => {
        if (typeof document === 'undefined') return undefined
        const root = document.documentElement
        const swap = () => {
            const map = mapRef.current
            const current = tileLayerRef.current
            if (!map || !current) return
            const desiredUrl = isDarkTheme()
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            const currentUrl = current._url ?? null
            if (currentUrl === desiredUrl) return
            map.removeLayer(current)
            tileLayerRef.current = buildTileLayer().addTo(map)
        }
        const observer = new MutationObserver(swap)
        observer.observe(root, { attributeFilter: ['class'], attributes: true })
        return () => observer.disconnect()
    }, [])

    /* ── Resize observer so Leaflet re-measures on tab swaps ─────── */
    useEffect(() => {
        if (!containerRef.current) return undefined
        const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [])

    /* ── Plot / refresh markers whenever the mapped set changes ───── */
    useEffect(() => {
        const layer = markerLayerRef.current
        const map = mapRef.current
        if (!layer || !map) return

        layer.clearLayers()
        if (mapped.length === 0) return

        const icon = makeAccountIcon(accentColor)
        const latLngs = mapped.map((row) => {
            const marker = L.marker([row.lat, row.lng], { icon })
            marker.bindPopup(buildPopupHtml(row), { maxWidth: 240, minWidth: 160 })
            marker.addTo(layer)
            return [row.lat, row.lng]
        })

        /* Fit bounds with padding so pins aren't cropped at the viewport edge. */
        if (latLngs.length === 1) {
            map.setView(latLngs[0], 12)
        } else {
            map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] })
        }
        // NOTE: Re-run whenever mapped length, accent, or coordinates could change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapped.length, accentColor, roster])

    if (mapped.length === 0) {
        return (
            <div className="rounded-md border border-border-light bg-bg-primary p-8 text-center flex flex-col items-center gap-2">
                <i className="fas fa-map-location-dot text-[28px] text-text-tertiary" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-text-primary mt-1">No mapped account locations yet</p>
                <p className="text-[12px] text-text-secondary max-w-xs leading-relaxed">
                    Account addresses need geocoding — run the geocoder from the Settings tab.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-md overflow-hidden border border-border-light" style={{ height: '520px' }}>
            <div ref={containerRef} className="h-full w-full" />
        </div>
    )
}

export default CrmMapPage
