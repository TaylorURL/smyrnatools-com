import React, { useEffect, useState } from 'react'

import { TrafficService } from '../../../services/TrafficService'

/** Compose a single-line "address, city" string from an order, tolerant of nulls. */
const composeAddress = (order) =>
    [order?.address, order?.city]
        .map((s) => (s == null ? '' : String(s).trim()))
        .filter(Boolean)
        .join(', ')

/** Format a minute count as a short human label — "45 min", "1h 20m", "2h". */
const formatMinutesToHm = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return null
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    if (h === 0) return `${m} min`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

/**
 * Origin/destination label used inside the map modal's route summary strip.
 * Shows the icon + label on top and a primary/secondary description below.
 */
function RoutePoint({ color, icon, label, primary, sub, warn }) {
    return (
        <div
            className="rounded-lg px-3 py-2 flex items-start gap-2.5 min-w-0"
            style={{
                background: 'var(--bg-primary)',
                border: `1px solid ${warn ? '#fbbf24' : 'var(--border-light)'}`
            }}
        >
            <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: warn ? '#fef3c7' : `${color}14`, color: warn ? '#92400e' : color }}
            >
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    {label}
                </div>
                <div
                    className="text-[12.5px] font-semibold leading-tight mt-0.5 truncate"
                    style={{ color: warn ? '#92400e' : 'var(--text-primary)' }}
                    title={primary}
                >
                    {primary || '—'}
                </div>
                {sub && (
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }} title={sub}>
                        {sub}
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * Full-screen map modal for a single dispatch order. Embeds a Google Maps
 * iframe with a plant → job → plant route (falls back to a single-point map
 * when the plant address is missing), plus a live-traffic summary bar
 * powered by the traffic-service edge function.
 *
 * Shared between PlanView's schedule tab and the dashboard schedule preview
 * so both surfaces open the exact same modal.
 */
export default function JobMapModal({
    accentColor,
    onClose,
    order,
    plantAddress,
    plantCode,
    plantName,
    travelMinutes
}) {
    const jobAddress = composeAddress(order)
    const hasJob = !!jobAddress
    const hasPlant = !!plantAddress
    const canRoute = hasJob && hasPlant
    const jobQuery = encodeURIComponent(jobAddress || order?.customer || '')
    const plantQuery = hasPlant ? encodeURIComponent(plantAddress) : null
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

    const dispatchMinutes = Number.isFinite(travelMinutes) ? travelMinutes : null

    const [live, setLive] = useState({ status: 'idle', data: null })
    useEffect(() => {
        if (!canRoute) {
            setLive({ status: 'idle', data: null })
            return undefined
        }
        let cancelled = false
        setLive({ status: 'loading', data: null })
        TrafficService.fetchDistance(plantAddress, jobAddress).then((result) => {
            if (cancelled) return
            if (!result) {
                setLive({ status: 'error', data: null })
                return
            }
            if (result.error) {
                setLive({ status: result.error === 'not_configured' ? 'not_configured' : 'error', data: null })
                return
            }
            setLive({ status: 'ok', data: result })
        })
        return () => {
            cancelled = true
        }
    }, [canRoute, plantAddress, jobAddress])

    const liveMinutes =
        live.status === 'ok' && Number.isFinite(live.data?.durationInTrafficSeconds)
            ? Math.round(live.data.durationInTrafficSeconds / 60)
            : null
    const liveFreeFlowMinutes =
        live.status === 'ok' && Number.isFinite(live.data?.durationSeconds)
            ? Math.round(live.data.durationSeconds / 60)
            : null
    const oneWayMinutes = liveMinutes ?? dispatchMinutes
    const roundTripMinutes = oneWayMinutes != null ? oneWayMinutes * 2 : null
    const oneWayLabel = formatMinutesToHm(oneWayMinutes)
    const roundTripLabel = formatMinutesToHm(roundTripMinutes)
    const sourceLabel =
        live.status === 'loading'
            ? 'Loading live traffic…'
            : liveMinutes != null
              ? 'Google live · with traffic'
              : live.status === 'not_configured'
                ? 'Dispatch Estimate (Traffic not Included)'
                : live.status === 'error'
                  ? 'Dispatch Estimate (Traffic not Included)'
                  : dispatchMinutes != null
                    ? 'Dispatch Estimate (Traffic not Included)'
                    : 'No travel time available'
    const trafficDelta = liveMinutes != null && liveFreeFlowMinutes != null ? liveMinutes - liveFreeFlowMinutes : null
    const dispatchVsLive = liveMinutes != null && dispatchMinutes != null ? liveMinutes - dispatchMinutes : null

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', zIndex: 2147483000 }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl flex flex-col w-full overflow-hidden"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '90vh',
                    maxWidth: 1000
                }}
            >
                <div
                    className="flex items-start gap-3 px-5 py-3 border-b"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}14`, color: accentColor }}
                    >
                        <i className="fas fa-route text-[14px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div
                            className="text-[15px] font-bold leading-tight"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                        >
                            {(order?.customer || 'Job location').toUpperCase()}
                        </div>
                        <div
                            className="text-[12px] mt-0.5 uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {jobAddress || 'Address not provided'}
                        </div>
                        {(order?.orderNum || plantCode) && (
                            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                {plantCode && (
                                    <span>
                                        Plant {plantCode}
                                        {plantName ? ` · ${plantName}` : ''}
                                    </span>
                                )}
                                {plantCode && order?.orderNum && <span> · </span>}
                                {order?.orderNum && <span>Order #{order.orderNum}</span>}
                            </div>
                        )}
                    </div>
                    <a
                        href={externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                        <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                        {canRoute ? 'Open route' : 'Open in Maps'}
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[12px]" />
                    </button>
                </div>

                {hasJob && (
                    <div
                        className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 py-3 border-b"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
                    >
                        <RoutePoint
                            color={accentColor}
                            icon="fa-industry"
                            label={hasPlant ? `Plant ${plantCode || ''}` : 'Plant address missing'}
                            primary={hasPlant ? plantAddress : 'Add an address in Plan Settings → Plant Addresses'}
                            sub={!hasPlant ? 'Required to draw the route' : plantName || ''}
                            warn={!hasPlant}
                        />
                        <div
                            className="rounded-lg px-3 py-2 flex flex-col justify-center text-center"
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                            title={
                                liveMinutes != null
                                    ? 'Live driving time from Google with current traffic conditions.'
                                    : 'Dispatch report estimate. Live traffic unavailable.'
                            }
                        >
                            <div
                                className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Travel time
                                {live.status === 'loading' && <i className="fas fa-spinner fa-spin text-[9px]" />}
                                {liveMinutes != null && (
                                    <i
                                        className="fas fa-traffic-light text-[10px]"
                                        style={{ color: '#16a34a' }}
                                        title="Includes live traffic"
                                    />
                                )}
                            </div>
                            <div
                                className="font-bold text-[16px] leading-none mt-1"
                                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                            >
                                {oneWayLabel ? `${oneWayLabel} one-way` : '—'}
                            </div>
                            {roundTripLabel && (
                                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    Round trip ≈ {roundTripLabel}
                                </div>
                            )}
                            <div className="text-[10px] mt-1 italic" style={{ color: 'var(--text-tertiary)' }}>
                                {sourceLabel}
                                {trafficDelta != null && trafficDelta > 1 && (
                                    <span style={{ color: '#dc2626' }}> · +{trafficDelta}m vs free-flow</span>
                                )}
                            </div>
                            {dispatchVsLive != null && Math.abs(dispatchVsLive) >= 3 && dispatchMinutes != null && (
                                <div
                                    className="text-[10px] mt-0.5"
                                    style={{ color: dispatchVsLive > 0 ? '#dc2626' : '#16a34a' }}
                                    title={`Live ${liveMinutes}m vs dispatch ${dispatchMinutes}m`}
                                >
                                    {dispatchVsLive > 0 ? '⚠ ' : '↓ '}
                                    {dispatchVsLive > 0 ? '+' : ''}
                                    {dispatchVsLive}m vs dispatch est ({dispatchMinutes}m)
                                </div>
                            )}
                        </div>
                        <RoutePoint
                            color="#16a34a"
                            icon="fa-flag-checkered"
                            label="Job site"
                            primary={jobAddress}
                            sub={order?.customer || ''}
                        />
                    </div>
                )}

                <div className="relative" style={{ background: 'var(--bg-secondary)', minHeight: 360 }}>
                    {hasJob ? (
                        <iframe
                            title={canRoute ? `Route to ${jobAddress}` : `Map of ${jobAddress}`}
                            src={mapSrc}
                            className="w-full"
                            style={{ border: 0, height: '60vh', minHeight: 360 }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                        />
                    ) : (
                        <div
                            className="flex flex-col items-center justify-center text-center p-10"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <i className="fas fa-map-location-dot text-3xl mb-2 opacity-60" />
                            <div className="text-[13px]">No address on this order — nothing to map.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
