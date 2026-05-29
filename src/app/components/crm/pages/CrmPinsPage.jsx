/* eslint-disable react/forbid-dom-props */
import L from 'leaflet'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import CrmService from '../../../../services/CrmService'
import { buildTileLayer, isDarkTheme, TENNESSEE_CENTER } from '../../../../views/tools/plan/flow-map/flowMapShared'
import { useAuth } from '../../../context/AuthContext'
import { useCrmViewMode } from '../../../hooks/useCrmViewMode'
import { CrmTable } from '../CrmTable'
import { CrmViewToggle } from '../CrmViewToggle'

const DEFAULT_ZOOM = 8

/** Build a DivIcon for a field pin — distinguishes from account markers with a teardrop shape. */
function makePinIcon(accentColor) {
    const color = accentColor || '#2563eb'
    return L.divIcon({
        className: 'crm-field-pin-marker',
        html: `<div style="
            width:12px;height:12px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:${color};
            box-shadow:0 0 0 2.5px #fff,0 1px 4px rgba(0,0,0,0.4);
        "></div>`,
        iconAnchor: [6, 12],
        iconSize: [12, 12]
    })
}

/** Sanitize text for insertion into popup HTML. */
function escapeHtml(text) {
    return String(text ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    )
}

/** Build popup HTML for a field pin row. */
function buildPinPopupHtml(pin) {
    const comment = pin.comment
        ? `<p style="margin:4px 0 0;font-size:11.5px;color:var(--text-secondary)">${escapeHtml(pin.comment)}</p>`
        : ''
    const author = pin.created_by_name
        ? `<p style="margin:4px 0 0;font-size:10.5px;color:var(--text-tertiary)">${escapeHtml(pin.created_by_name)}</p>`
        : ''
    return `<div style="font-size:12.5px;font-weight:600;color:var(--text-primary);">${escapeHtml(pin.label || 'Field pin')}</div>${comment}${author}`
}

/** Short relative-time label ("3d ago", "2h ago", "just now") from an ISO timestamp. */
function relTimeShort(isoString) {
    if (!isoString) return '—'
    const diffMs = Date.now() - new Date(isoString).getTime()
    if (Number.isNaN(diffMs)) return '—'
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

/** Inline spinner/trash icon for the delete cell — keeps row height stable. */
function DeleteCell({ isDeleting, isOwn, onDelete, pin }) {
    if (!isOwn) return null
    return (
        <button
            type="button"
            aria-label="Delete pin"
            disabled={isDeleting}
            onClick={(e) => {
                e.stopPropagation()
                onDelete(pin.id)
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-text-tertiary hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
            {isDeleting ? (
                <i className="fas fa-circle-notch fa-spin text-[10px]" aria-hidden="true" />
            ) : (
                <i className="fas fa-trash text-[10px]" aria-hidden="true" />
            )}
        </button>
    )
}

/** Leaflet map mounted in the Cards (Map) view — unchanged behavior. */
function PinMap({ accentColor, containerRef }) {
    return (
        <div className="rounded-md overflow-hidden border border-border-light" style={{ height: '480px' }}>
            <div ref={containerRef} className="h-full w-full" />
        </div>
    )
}

/**
 * CRM Pins page — shows all field pins. Default view is a `CrmTable` list;
 * the Cards toggle switches to the existing Leaflet map. Field workers can
 * delete their own pins in both views.
 *
 * @param {{ accentColor: string }} props
 */
export function CrmPinsPage({ accentColor }) {
    const { user } = useAuth()
    const [pins, setPins] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const [viewMode, setViewMode] = useCrmViewMode('pins', 'list')

    const containerRef = useRef(null)
    const mapRef = useRef(null)
    const tileLayerRef = useRef(null)
    const markerLayerRef = useRef(null)

    const loadPins = useCallback(async () => {
        setIsLoading(true)
        setLoadError(null)
        try {
            const rows = await CrmService.fetchPins()
            setPins(rows)
        } catch (err) {
            setLoadError(err.message || 'Failed to load pins')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPins()
    }, [loadPins])

    const handleDelete = async (pinId) => {
        setDeletingId(pinId)
        try {
            await CrmService.deletePin(pinId)
            await loadPins()
        } catch {
            // Silently re-enable — user can retry
        } finally {
            setDeletingId(null)
        }
    }

    // ── Leaflet map init ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        const map = L.map(containerRef.current, {
            center: TENNESSEE_CENTER,
            scrollWheelZoom: true,
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
            zoomSnap: 0.25
        })
        tileLayerRef.current = buildTileLayer().addTo(map)
        markerLayerRef.current = L.layerGroup().addTo(map)
        mapRef.current = map

        return () => {
            map.remove()
            mapRef.current = null
            tileLayerRef.current = null
            markerLayerRef.current = null
        }
    }, [])

    /* Swap basemap tile layer when theme flips. */
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
            if ((current._url ?? null) === desiredUrl) return
            map.removeLayer(current)
            tileLayerRef.current = buildTileLayer().addTo(map)
        }
        const observer = new MutationObserver(swap)
        observer.observe(root, { attributeFilter: ['class'], attributes: true })
        return () => observer.disconnect()
    }, [])

    /* Invalidate size when container resizes or view switches to map. */
    useEffect(() => {
        if (!containerRef.current) return undefined
        const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [])

    /* Re-invalidate when user toggles to the map tab so Leaflet fills the container. */
    useEffect(() => {
        if (viewMode === 'cards') {
            setTimeout(() => mapRef.current?.invalidateSize(), 50)
        }
    }, [viewMode])

    /* Plot pins as markers — re-runs whenever pins change. */
    useEffect(() => {
        const layer = markerLayerRef.current
        const map = mapRef.current
        if (!layer || !map) return

        layer.clearLayers()
        const mappablePins = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        if (mappablePins.length === 0) return

        const icon = makePinIcon(accentColor)
        const latLngs = mappablePins.map((pin) => {
            const marker = L.marker([pin.lat, pin.lng], { icon })
            marker.bindPopup(buildPinPopupHtml(pin), { maxWidth: 240, minWidth: 160 })
            marker.addTo(layer)
            return [pin.lat, pin.lng]
        })

        if (latLngs.length === 1) {
            map.setView(latLngs[0], 14)
        } else {
            map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pins, accentColor])

    // ── Table columns ─────────────────────────────────────────────────────────

    const tableColumns = [
        {
            key: 'comment',
            label: 'Note',
            render: (pin) => (
                <span className="text-text-primary">
                    {pin.comment || <span className="text-text-tertiary">—</span>}
                </span>
            )
        },
        {
            key: 'created_by_name',
            label: 'Dropped by',
            render: (pin) => pin.created_by_name || '—'
        },
        {
            align: 'right',
            key: 'created_at',
            label: 'When',
            mono: true,
            render: (pin) => relTimeShort(pin.created_at)
        },
        {
            align: 'right',
            key: '_actions',
            label: '',
            render: (pin) => {
                const isOwn = Boolean(user?.id && pin.created_by === user.id)
                return <DeleteCell isDeleting={deletingId === pin.id} isOwn={isOwn} onDelete={handleDelete} pin={pin} />
            }
        }
    ]

    // ── Render ───────────────────────────────────────────────────────────────

    const hasPins = pins.length > 0

    const toggleRight = <CrmViewToggle accentColor={accentColor} value={viewMode} onChange={setViewMode} />

    const refreshButton = !isLoading && (
        <button
            type="button"
            onClick={loadPins}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold border-none bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer transition-colors duration-150 active:scale-[0.97]"
        >
            <i className="fas fa-arrows-rotate text-[10px]" aria-hidden="true" />
            Refresh
        </button>
    )

    return (
        <div className="flex flex-col gap-4">
            {/* Header: title + toggle + refresh */}
            <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-sm font-semibold m-0 text-text-primary flex-1 min-w-0">Field pins</h3>
                {refreshButton}
                {toggleRight}
            </div>

            {/* Error */}
            {loadError && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-500">
                    {loadError}
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <div className="flex flex-col gap-2" aria-hidden="true">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 rounded-md bg-bg-secondary animate-pulse" />
                    ))}
                </div>
            )}

            {/* Empty state — shown in both views */}
            {!isLoading && !hasPins && !loadError && (
                <div className="rounded-md border border-border-light bg-bg-primary p-8 text-center flex flex-col items-center gap-2">
                    <i className="fas fa-map-pin text-[28px] text-text-tertiary" aria-hidden="true" />
                    <p className="text-[13px] font-semibold text-text-primary mt-1">No pins dropped yet.</p>
                    <p className="text-[12px] text-text-secondary max-w-xs leading-relaxed">
                        Field workers can drop pins from the mobile nav bar.
                    </p>
                </div>
            )}

            {/* List view (default) — CrmTable */}
            {!isLoading && hasPins && viewMode === 'list' && (
                <CrmTable
                    columns={tableColumns}
                    emptyMessage="No pins dropped yet."
                    maxHeight="calc(100dvh - 280px)"
                    rowKey={(pin) => pin.id}
                    rows={pins}
                />
            )}

            {/* Map view — Leaflet (always mounted to preserve state; hidden when not active) */}
            <div style={{ display: !isLoading && viewMode === 'cards' ? 'block' : 'none' }}>
                <PinMap accentColor={accentColor} containerRef={containerRef} />
            </div>
        </div>
    )
}

export default CrmPinsPage
