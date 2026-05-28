/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'

import { formatFullAddress, formatOrderAddress } from '../../../utils/AddressUtility'

const composeAddress = (order) => formatOrderAddress(order, ', ')

/**
 * Full-screen map modal for a single dispatch order. Embeds a Google Maps
 * iframe routed from the assigned plant to the job site; an inline plant
 * picker lets dispatch compare other plants visually without leaving the
 * modal. No travel-time metrics — the project doesn't carry a Maps API key
 * so live numbers aren't available and stale numbers are worse than none.
 */
export default function JobMapModal({ onClose, order, plantAddress, plantCode, plantName, plants = [] }) {
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
    const hasPlant = !!originAddress
    const canRoute = hasJob && hasPlant
    const hasMultiplePlants = plantOptions.length > 1

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

    if (typeof document === 'undefined' || !document.body) return null

    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.55)] z-[2147483000]"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg flex flex-col w-full overflow-hidden bg-bg-primary border border-border-light"
                style={{
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '90vh',
                    maxWidth: 1000
                }}
            >
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border-light bg-bg-primary">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-[15px] font-semibold text-text-primary truncate font-heading">
                                {order?.customer || 'Job location'}
                            </span>
                            {order?.orderNum && (
                                <span className="text-[12px] text-text-tertiary font-mono">#{order.orderNum}</span>
                            )}
                        </div>
                        <div className="text-[12px] text-text-secondary truncate mt-0.5" title={jobAddress}>
                            {jobAddress || 'Address not provided'}
                        </div>
                    </div>
                    <a
                        href={externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] px-2.5 py-1.5 rounded border border-border-light bg-transparent cursor-pointer text-text-secondary no-underline hover:text-text-primary hover:bg-bg-tertiary"
                        title={canRoute ? 'Open route in Google Maps' : 'Open in Google Maps'}
                    >
                        Open in Maps
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 rounded flex items-center justify-center bg-transparent border-0 cursor-pointer text-text-tertiary hover:text-text-primary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        aria-label="Close"
                        title="Close (Esc)"
                    >
                        <i className="fas fa-xmark text-[14px]" />
                    </button>
                </div>

                {hasJob && (
                    <div className="flex items-center gap-3 flex-wrap px-5 py-2 border-b border-border-light bg-bg-secondary text-[12px]">
                        <div className="flex items-baseline gap-2 min-w-0 flex-1">
                            <span className="text-[10.5px] uppercase tracking-wider text-text-tertiary shrink-0">
                                From
                            </span>
                            {hasMultiplePlants ? (
                                <select
                                    value={selectedCode}
                                    onChange={(e) => setSelectedCode(e.target.value)}
                                    className="text-[12px] font-mono font-semibold cursor-pointer text-text-primary rounded appearance-none bg-bg-tertiary border border-border-light hover:border-border-medium pl-2 pr-7 py-0.5 bg-no-repeat bg-[right_6px_center] bg-[length:12px_12px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke=%22currentColor%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20stroke-width=%222%22%20d=%22M19%209l-7%207-7-7%22%3E%3C/path%3E%3C/svg%3E')]"
                                    title="Switch origin plant to compare routes"
                                    aria-label="Origin plant"
                                >
                                    {plantOptions.map((p) => (
                                        <option key={p.code} value={p.code}>
                                            Plant {p.code}
                                            {p.code === assignedPlantCode ? ' (assigned)' : ''}
                                            {p.name ? ` — ${p.name}` : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className="font-mono font-semibold text-text-primary">
                                    Plant {originCode || '—'}
                                    {isAssignedPlant ? '' : ' (comparing)'}
                                </span>
                            )}
                            <span className="text-text-tertiary truncate" title={originAddress}>
                                {hasPlant ? formatFullAddress(originAddress) : 'address missing'}
                            </span>
                        </div>
                        <span className="text-text-tertiary shrink-0">→</span>
                        <div className="flex items-baseline gap-2 min-w-0 flex-1">
                            <span className="text-[10.5px] uppercase tracking-wider text-text-tertiary shrink-0">
                                To
                            </span>
                            <span className="font-semibold text-text-primary truncate" title={jobAddress}>
                                {jobAddress}
                            </span>
                        </div>
                    </div>
                )}

                <div className="relative bg-bg-secondary flex-1" style={{ minHeight: 360 }}>
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
                        <div className="flex items-center justify-center text-center p-10 text-[13px] text-text-tertiary">
                            No address on this order — nothing to map.
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
