/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { formatFullAddress, formatOrderAddress } from '../../../utils/AddressUtility'

// Run order addresses through the shared normalizer so the popup matches
// the schedule table — no more `.lady Leslie Lane …` or `RD .` artifacts.
const composeAddress = (order) => formatOrderAddress(order, ', ')

function RoutePoint({ children, color, icon, label, primary, sub, warn }) {
    return (
        <div
            className="rounded-lg px-3 py-2 flex items-start gap-2.5 min-w-0 bg-bg-primary"
            style={{ border: `1px solid ${warn ? '#fbbf24' : 'var(--border-light)'}` }}
        >
            <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: warn ? '#fef3c7' : `${color}14`, color: warn ? '#92400e' : color }}
            >
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</div>
                <div
                    className="text-[12.5px] font-semibold leading-tight mt-0.5 truncate uppercase tracking-wide"
                    style={{ color: warn ? '#92400e' : 'var(--text-primary)' }}
                    title={primary}
                >
                    {primary || '—'}
                </div>
                {sub && (
                    <div className="text-[11px] mt-0.5 truncate text-text-tertiary" title={sub}>
                        {sub}
                    </div>
                )}
                {children}
            </div>
        </div>
    )
}

/**
 * Full-screen map modal for a single dispatch order. Shows the route as an
 * embedded Google Maps iframe with the assigned plant as the default origin.
 * The dispatcher can switch the origin via a dropdown to compare any plant
 * visually on the map.
 *
 * Travel-time metrics are intentionally NOT displayed — the project doesn't
 * provision a Google Maps API key, so live traffic data isn't available and
 * dispatch-report estimates only meaningfully apply to the assigned plant.
 * Without a clean number to show for every origin, the map alone is more
 * honest than a partial / fallback metric strip.
 */
export default function JobMapModal({ accentColor, onClose, order, plantAddress, plantCode, plantName, plants = [] }) {
    const jobAddress = composeAddress(order)
    const hasJob = !!jobAddress
    const assignedPlantCode = plantCode || order?.plantCode || ''

    const plantOptions = useMemo(() => {
        const seen = new Map()
        const push = (code, name, address) => {
            if (!code) return
            const key = String(code)
            if (seen.has(key)) {
                const existing = seen.get(key)
                if (!existing.address && address) existing.address = address
                if (!existing.name && name) existing.name = name
                return
            }
            seen.set(key, { address: address || '', code: key, name: name || '' })
        }
        if (assignedPlantCode) push(assignedPlantCode, plantName, plantAddress)
        plants.forEach((p) => push(p?.code, p?.name, p?.address))
        return Array.from(seen.values())
            .filter((p) => p.address)
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    }, [assignedPlantCode, plantAddress, plantName, plants])

    const [selectedCode, setSelectedCode] = useState(assignedPlantCode)
    useEffect(() => {
        setSelectedCode(assignedPlantCode)
    }, [assignedPlantCode])

    const selected = useMemo(() => {
        const fromOptions = plantOptions.find((p) => p.code === selectedCode)
        if (fromOptions) return fromOptions
        if (selectedCode === assignedPlantCode) {
            return { address: plantAddress || '', code: assignedPlantCode, name: plantName || '' }
        }
        return { address: '', code: selectedCode, name: '' }
    }, [assignedPlantCode, plantAddress, plantName, plantOptions, selectedCode])

    const isAssignedPlant = selected.code === assignedPlantCode
    const originAddress = selected.address
    const originCode = selected.code
    const originName = selected.name
    const hasPlant = !!originAddress
    const canRoute = hasJob && hasPlant

    const jobQuery = encodeURIComponent(jobAddress || order?.customer || '')
    const plantQuery = hasPlant ? encodeURIComponent(originAddress) : null
    const mapSrc = canRoute
        ? `https://www.google.com/maps?saddr=${plantQuery}&daddr=${jobQuery}+to:${plantQuery}&output=embed`
        : `https://www.google.com/maps?q=${jobQuery}&t=&z=14&ie=UTF8&iwloc=&output=embed`
    const externalUrl = canRoute
        ? `https://www.google.com/maps/dir/?api=1&origin=${plantQuery}&destination=${plantQuery}&waypoints=${jobQuery}&travelmode=driving`
        : `https://www.google.com/maps/search/?api=1&query=${jobQuery}`

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.55)] z-[2147483000]"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl flex flex-col w-full overflow-hidden bg-bg-primary border border-border-light"
                style={{
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '90vh',
                    maxWidth: 1000
                }}
            >
                <div className="flex items-start gap-3 px-5 py-3 border-b border-border-light">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}14`, color: accentColor }}
                    >
                        <i className="fas fa-route text-[14px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold leading-tight text-text-primary font-heading">
                            {(order?.customer || 'Job location').toUpperCase()}
                        </div>
                        <div className="text-[12px] mt-0.5 uppercase tracking-wider text-text-secondary">
                            {jobAddress || 'Address not provided'}
                        </div>
                        {(order?.orderNum || assignedPlantCode) && (
                            <div className="text-[11px] mt-0.5 text-text-tertiary">
                                {assignedPlantCode && (
                                    <span>
                                        Assigned Plant {assignedPlantCode}
                                        {plantName ? ` · ${plantName}` : ''}
                                    </span>
                                )}
                                {assignedPlantCode && order?.orderNum && <span> · </span>}
                                {order?.orderNum && <span>Order #{order.orderNum}</span>}
                            </div>
                        )}
                    </div>
                    <a
                        href={externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold border-none cursor-pointer flex items-center gap-1.5 bg-bg-secondary text-text-secondary"
                    >
                        <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                        {canRoute ? 'Open route' : 'Open in Maps'}
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center bg-bg-secondary text-text-secondary"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[12px]" />
                    </button>
                </div>

                {hasJob && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 py-3 border-b bg-bg-secondary border-border-light">
                        <RoutePoint
                            color={accentColor}
                            icon="fa-industry"
                            label={
                                hasPlant
                                    ? `Plant ${originCode}${isAssignedPlant ? ' · Assigned' : ' · Comparing'}`
                                    : 'Plant address missing'
                            }
                            primary={
                                hasPlant
                                    ? formatFullAddress(originAddress)
                                    : 'Add an address in Plan Settings → Plant Addresses'
                            }
                            sub={!hasPlant ? 'Required to draw the route' : originName || ''}
                            warn={!hasPlant}
                        >
                            {plantOptions.length > 1 && (
                                <div className="mt-2">
                                    <label className="block text-[9.5px] font-semibold uppercase tracking-wider mb-1 text-text-tertiary">
                                        Origin Plant
                                    </label>
                                    <select
                                        value={selectedCode}
                                        onChange={(e) => setSelectedCode(e.target.value)}
                                        className="w-full rounded outline-none px-2 py-1 text-[11.5px] font-semibold cursor-pointer bg-bg-secondary border border-border-light text-text-primary"
                                    >
                                        {plantOptions.map((p) => (
                                            <option key={p.code} value={p.code}>
                                                {p.code === assignedPlantCode ? '★ ' : ''}
                                                {p.code}
                                                {p.name ? ` — ${p.name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </RoutePoint>
                        <RoutePoint
                            color="#16a34a"
                            icon="fa-flag-checkered"
                            label="Job site"
                            primary={jobAddress}
                            sub={order?.customer || ''}
                        />
                    </div>
                )}

                <div className="relative bg-bg-secondary" style={{ minHeight: 360 }}>
                    {hasJob ? (
                        <iframe
                            title={canRoute ? `Route from ${originCode} to ${jobAddress}` : `Map of ${jobAddress}`}
                            src={mapSrc}
                            className="w-full h-[60vh]"
                            style={{ border: 0, minHeight: 360 }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-10 text-text-tertiary">
                            <i className="fas fa-map-location-dot text-3xl mb-2 opacity-60" />
                            <div className="text-[13px]">No address on this order — nothing to map.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
