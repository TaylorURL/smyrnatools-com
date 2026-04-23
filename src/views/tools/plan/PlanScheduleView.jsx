import React, { useEffect, useMemo, useState } from 'react'

import { timeToMinutes } from '../../../utils/PlanUtility'

const composeAddress = (order) =>
    [order?.address, order?.city]
        .map((s) => (s == null ? '' : String(s).trim()))
        .filter(Boolean)
        .join(', ')

/** Parse a `HH:MM` duration string (from the dispatch report) into minutes.
 *  Returns null when the value is missing or unparseable. */
const parseHhmmToMinutes = (value) => {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hours = parseInt(m[1], 10)
    const mins = parseInt(m[2], 10)
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
    return hours * 60 + mins
}

/**
 * Sentinel start times the dispatch system uses to mark special order states.
 *  - `17:00` → order was cancelled
 *  - `15:00` → same-day order
 * Returns null for everything else.
 */
const ORDER_STATUS_BY_START = {
    '17:00': { color: '#dc2626', icon: 'fa-ban', kind: 'cancelled', label: 'Cancelled' },
    '15:00': { color: '#d97706', icon: 'fa-bolt', kind: 'sameDay', label: 'Same-day' }
}
const getOrderStatus = (startTime) => {
    const v = String(startTime || '').trim()
    if (!v) return null
    return ORDER_STATUS_BY_START[v.padStart(5, '0')] || null
}

/**
 * Detect garbage / placeholder addresses that the dispatcher needs to fix
 * before the load can be sent (e.g. "GET NEW ADD....!", "GOING WHERE?",
 * "TBD", "N/A"). Empty strings are treated as "missing", not "bad".
 */
const BAD_ADDRESS_TOKENS = [
    'get address',
    'get add',
    'get new',
    'going where',
    'going to',
    'where?',
    'tbd',
    'tba',
    'n/a',
    'n a',
    'fix',
    'fixme',
    'unknown',
    'no address',
    'need address',
    'need add',
    'pending',
    'placeholder',
    'verify',
    'update',
    'address?',
    '???',
    'find address',
    'no addr'
]
const isLikelyBadAddress = (raw) => {
    const value = String(raw || '').trim()
    if (!value) return false
    const lower = value.toLowerCase()
    if (/[?!]/.test(value)) return true
    if (/\.{3,}/.test(value)) return true
    if (BAD_ADDRESS_TOKENS.some((tok) => lower.includes(tok))) return true
    // Real addresses almost always have a digit — anything ≥ 5 chars without one
    // is suspicious (e.g. "GO WHERE", "FIND IT").
    if (value.length < 5) return true
    if (!/\d/.test(value) && value.length < 12) return true
    return false
}

/* ── Map modal ──────────────────────────────────────────────────────────── */

const formatMinutesToHm = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return null
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    if (h === 0) return `${m} min`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

function JobMapModal({ accentColor, onClose, order, plantAddress, plantCode, plantName, travelMinutes }) {
    const jobAddress = composeAddress(order)
    const hasJob = !!jobAddress
    const hasPlant = !!plantAddress
    const canRoute = hasJob && hasPlant
    const jobQuery = encodeURIComponent(jobAddress || order?.customer || '')
    const plantQuery = hasPlant ? encodeURIComponent(plantAddress) : null
    // Round trip: plant -> job -> plant. Google Maps' query-string embed
    // supports `saddr` + `daddr` with `+to:` waypoints and renders without an
    // API key. When the plant address is missing, fall back to a single-point
    // map of the job so the modal is still useful.
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

    const oneWayMinutes = Number.isFinite(travelMinutes) ? travelMinutes : null
    const roundTripMinutes = oneWayMinutes != null ? oneWayMinutes * 2 : null
    const oneWayLabel = formatMinutesToHm(oneWayMinutes)
    const roundTripLabel = formatMinutesToHm(roundTripMinutes)

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
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

                {/* Route summary strip — origin / destination / round-trip times */}
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
                        >
                            <div
                                className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Travel time
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
                            {!oneWayLabel && (
                                <div className="text-[10.5px] mt-0.5 italic" style={{ color: 'var(--text-tertiary)' }}>
                                    Set a plant→plant time in Settings to seed this
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

const PLAN_META_KEY = '_meta'
const VIEW_MODES = ['table', 'cards']

/** Plant badge colors. Values picked to read well on both light and dark bg
 *  with white foreground text. `null` entries fall through to the accent. */
const PLANT_BADGE_COLORS = {
    401: '#f97316', // orange
    402: '#15803d', // dark green
    403: '#7c3aed', // purple
    405: '#b98a50', // tan
    406: '#06b6d4', // cyan
    407: '#0d9488', // teal
    408: '#4f46e5', // purple/blue (indigo) — Conroe
    410: '#6b7280', // gray
    453: '#a855f7', // purple (lighter than 403/408)
    455: '#d4a373', // tan (lighter)
    461: '#2563eb', // blue
    468: '#eab308' // yellow
}
const plantBadgeColor = (code, fallback) => PLANT_BADGE_COLORS[String(code)] || fallback

/* ── helpers ────────────────────────────────────────────────────────────── */

const clean = (value) => (value == null ? '' : String(value).trim())

const formatHhmm = (value) => {
    const v = clean(value)
    if (!v) return ''
    if (/^\d{1,2}:\d{2}$/.test(v)) return v.padStart(5, '0')
    if (/^\d{3,4}$/.test(v)) {
        const padded = v.padStart(4, '0')
        return `${padded.slice(0, 2)}:${padded.slice(2)}`
    }
    return v
}

const sumField = (orders, key) =>
    orders.reduce((acc, o) => {
        const n = parseFloat(o?.[key])
        return acc + (Number.isFinite(n) ? n : 0)
    }, 0)

const timeBucket = (hhmm) => {
    const mins = timeToMinutes(hhmm)
    if (mins == null) return 'unscheduled'
    if (mins < 6 * 60) return 'early'
    if (mins < 12 * 60) return 'morning'
    if (mins < 17 * 60) return 'afternoon'
    return 'evening'
}

const TIME_BUCKETS = [
    { icon: 'fa-moon', key: 'early', label: 'Before 6a' },
    { icon: 'fa-mug-hot', key: 'morning', label: '6a – 12p' },
    { icon: 'fa-sun', key: 'afternoon', label: '12p – 5p' },
    { icon: 'fa-cloud-moon', key: 'evening', label: 'After 5p' },
    { icon: 'fa-calendar-xmark', key: 'unscheduled', label: 'No start time' }
]

/* ── small building blocks ──────────────────────────────────────────────── */

function KpiCard({ accent, hint, icon, label, value }) {
    return (
        <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                minWidth: 180
            }}
        >
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${accent}14`, color: accent }}
            >
                <i className={`fas ${icon} text-[14px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {label}
                </div>
                <div
                    className="font-bold text-[22px] leading-none mt-0.5"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {value}
                </div>
                {hint && (
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {hint}
                    </div>
                )}
            </div>
        </div>
    )
}

function FilterField({ children, label }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            {children}
        </label>
    )
}

function Pill({ accent, active, children, icon, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border cursor-pointer transition-colors"
            style={{
                background: active ? accent : 'var(--bg-primary)',
                borderColor: active ? accent : 'var(--border-light)',
                color: active ? '#fff' : 'var(--text-secondary)'
            }}
        >
            {icon && <i className={`fas ${icon} text-[9px]`} />}
            {children}
        </button>
    )
}

/* ── order card ─────────────────────────────────────────────────────────── */

function OrderCard({ accentColor, order, plantCode, plantName }) {
    const yardage = parseFloat(order.yardage) || 0
    const trucks = parseFloat(order.truckCount) || 0
    const loadSize = parseFloat(order.loadSize) || 0
    const start = formatHhmm(order.startTime)
    const status = getOrderStatus(order.startTime)
    const isCancelled = status?.kind === 'cancelled'
    return (
        <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{
                background: isCancelled ? 'rgba(220, 38, 38, 0.05)' : 'var(--bg-primary)',
                border: `1px solid ${isCancelled ? 'rgba(220, 38, 38, 0.35)' : 'var(--border-light)'}`,
                opacity: isCancelled ? 0.78 : 1
            }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="rounded-lg px-3 py-2 text-center shrink-0"
                    style={{
                        background: status ? `${status.color}14` : `${accentColor}14`,
                        color: status ? status.color : accentColor,
                        minWidth: 72
                    }}
                >
                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Start</div>
                    <div
                        className="font-bold text-[18px] leading-none font-mono"
                        style={{
                            fontFamily: 'var(--font-heading)',
                            textDecoration: isCancelled ? 'line-through' : 'none'
                        }}
                    >
                        {start || '—'}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div
                            className="text-[15px] font-bold leading-tight"
                            style={{
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-heading)',
                                textDecoration: isCancelled ? 'line-through' : 'none'
                            }}
                        >
                            {clean(order.customer) || 'Unknown customer'}
                        </div>
                        {status && <OrderStatusBadge status={status} />}
                    </div>
                    <div
                        className="text-[11.5px] flex flex-wrap items-center gap-x-2"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {plantCode && (
                            <span className="font-semibold" style={{ color: accentColor }}>
                                {plantCode}
                                {plantName ? ` · ${plantName}` : ''}
                            </span>
                        )}
                        {order.orderNum && <span>#{order.orderNum}</span>}
                        {order.customerNum && <span>Cust {order.customerNum}</span>}
                        {order.truckClass && <span>Class {order.truckClass}</span>}
                    </div>
                    {(order.address || order.city) && (
                        <div
                            className="text-[12px] mt-1 flex items-center gap-1.5"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <i className="fas fa-location-dot text-[10px] opacity-70" />
                            <span className="truncate">
                                {[clean(order.address), clean(order.city)].filter(Boolean).join(' · ')}
                            </span>
                        </div>
                    )}
                </div>
                <div className="text-right shrink-0">
                    <div
                        className="text-[18px] font-bold leading-none"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                    >
                        {yardage > 0 ? yardage : '—'}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        yards
                    </div>
                </div>
            </div>
            {(order.productCode || order.description) && (
                <div
                    className="rounded-md px-2.5 py-1.5 flex items-center gap-2"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                >
                    <i className="fas fa-cube text-[10px]" style={{ color: accentColor }} />
                    <span className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {clean(order.productCode)}
                    </span>
                    {order.description && (
                        <span className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                            {clean(order.description)}
                        </span>
                    )}
                </div>
            )}
            <div className="flex flex-wrap gap-1.5 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                {order.tktTime && <KeyValue label="Tkt" value={formatHhmm(order.tktTime)} />}
                {order.rate && <KeyValue label="Rate" value={clean(order.rate)} />}
                {order.toJobTime && <KeyValue label="To Job" value={clean(order.toJobTime)} />}
                {order.toPlantTime && <KeyValue label="To Plant" value={clean(order.toPlantTime)} />}
                {trucks > 0 && <KeyValue label="Trucks" value={trucks} />}
                {loadSize > 0 && <KeyValue label="Load" value={`${loadSize} yd`} />}
                {order.poNumber && <KeyValue label="PO" value={clean(order.poNumber)} />}
                {order.jobNumber && <KeyValue label="Job" value={clean(order.jobNumber)} />}
                {order.contact && <KeyValue label="Contact" value={clean(order.contact)} />}
                {order.phone && <KeyValue label="Phone" value={clean(order.phone)} />}
            </div>
        </div>
    )
}

function OrderStatusBadge({ status }) {
    if (!status) return null
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ background: status.color, color: '#fff' }}
            title={`Start time sentinel — order is ${status.label.toLowerCase()}`}
        >
            <i className={`fas ${status.icon} text-[8px]`} />
            {status.label}
        </span>
    )
}

function PlantBadge({ code, fallback, name }) {
    const bg = plantBadgeColor(code, fallback)
    // Dark-on-yellow reads better than white-on-yellow.
    const fg = bg && bg.toLowerCase() === '#eab308' ? '#3f2d00' : '#fff'
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 font-semibold whitespace-nowrap"
            style={{ background: bg, color: fg }}
        >
            <span
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                    background: 'rgba(255,255,255,0.22)',
                    color: fg,
                    fontFamily: 'var(--font-heading)',
                    fontSize: 10.5,
                    height: 18,
                    minWidth: 34
                }}
            >
                {code}
            </span>
            {name && <span className="text-[11.5px]">{name}</span>}
        </span>
    )
}

function KeyValue({ label, value }) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ background: 'var(--bg-secondary)' }}
        >
            <span className="text-[9.5px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                {value}
            </span>
        </span>
    )
}

/* ── table view ─────────────────────────────────────────────────────────── */

const SORT_OPTIONS = [
    { key: 'plantThenTime', label: 'Plant, then start time' },
    { key: 'startTime', label: 'Start time' },
    { key: 'plantCode', label: 'Plant' },
    { key: 'yardage', label: 'Yardage', numeric: true, desc: true },
    { key: 'truckCount', label: 'Trucks', numeric: true, desc: true },
    { key: 'customer', label: 'Customer' }
]

const compareByStartTime = (a, b) => {
    const am = timeToMinutes(a.startTime)
    const bm = timeToMinutes(b.startTime)
    if (am == null && bm == null) return 0
    if (am == null) return 1
    if (bm == null) return -1
    return am - bm
}

const compareByPlant = (a, b) => String(a.plantCode || '').localeCompare(String(b.plantCode || ''))

const compareOrders = (a, b, sortKey) => {
    const opt = SORT_OPTIONS.find((o) => o.key === sortKey) || SORT_OPTIONS[0]
    if (opt.key === 'plantThenTime') {
        return compareByPlant(a, b) || compareByStartTime(a, b)
    }
    if (opt.numeric) {
        const av = parseFloat(a[sortKey]) || 0
        const bv = parseFloat(b[sortKey]) || 0
        return (opt.desc ? bv - av : av - bv) || compareByPlant(a, b) || compareByStartTime(a, b)
    }
    if (opt.key === 'startTime') {
        return compareByStartTime(a, b) || compareByPlant(a, b)
    }
    if (opt.key === 'plantCode') {
        return compareByPlant(a, b) || compareByStartTime(a, b)
    }
    const cmp = String(a[opt.key] || '').localeCompare(String(b[opt.key] || ''))
    return cmp || compareByPlant(a, b) || compareByStartTime(a, b)
}

function ScheduleTable({ accentColor, onOpenLocation, orders, plantNameByCode }) {
    return (
        <div
            className="rounded-xl overflow-auto"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr
                        style={{
                            background: 'var(--bg-tertiary)',
                            borderBottom: '1px solid var(--border-light)'
                        }}
                    >
                        {[
                            'Start',
                            'Plant',
                            'Order',
                            'Customer',
                            'Location',
                            'Product',
                            'Yards',
                            'Load',
                            'Trucks',
                            'Travel',
                            'Spacing',
                            'PO',
                            'Contact'
                        ].map((h) => (
                            <th
                                key={h}
                                className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {orders.map((o, idx) => {
                        const yardage = parseFloat(o.yardage) || 0
                        const trucks = parseFloat(o.truckCount) || 0
                        const loadSize = parseFloat(o.loadSize) || 0
                        const plantName = plantNameByCode?.[o.plantCode] || ''
                        const status = getOrderStatus(o.startTime)
                        const isCancelled = status?.kind === 'cancelled'
                        return (
                            <tr
                                key={`${o.plantCode}-${o.orderId || idx}`}
                                style={{
                                    borderTop: '1px solid var(--border-light)',
                                    background: isCancelled ? 'rgba(220, 38, 38, 0.05)' : undefined,
                                    opacity: isCancelled ? 0.7 : 1
                                }}
                            >
                                <td
                                    className="px-3 py-2 font-mono font-bold whitespace-nowrap"
                                    style={{
                                        color: isCancelled ? 'var(--text-tertiary)' : accentColor,
                                        textDecoration: isCancelled ? 'line-through' : 'none'
                                    }}
                                >
                                    {formatHhmm(o.startTime) || '—'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <PlantBadge code={o.plantCode} fallback={accentColor} name={plantName} />
                                </td>
                                <td
                                    className="px-3 py-2 whitespace-nowrap font-semibold"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {o.orderNum ? `#${o.orderNum}` : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 max-w-[260px]"
                                    style={{ color: 'var(--text-primary)' }}
                                    title={clean(o.customer)}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="font-semibold truncate"
                                            style={{
                                                textDecoration: isCancelled ? 'line-through' : 'none'
                                            }}
                                        >
                                            {clean(o.customer) || '—'}
                                        </span>
                                        {status && <OrderStatusBadge status={status} />}
                                    </div>
                                </td>
                                <td className="px-3 py-2 max-w-[280px]">
                                    {(() => {
                                        const address = clean(o.address)
                                        const city = clean(o.city)
                                        if (!address && !city) {
                                            return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                        }
                                        if (isLikelyBadAddress(address)) {
                                            return (
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap"
                                                    style={{ background: '#dc2626', color: '#fff' }}
                                                    title={`Address looks invalid — original value: "${address}"${city ? ` · City: ${city}` : ''}`}
                                                >
                                                    <i className="fas fa-triangle-exclamation text-[9px]" />
                                                    Bad Address
                                                </span>
                                            )
                                        }
                                        return (
                                            <button
                                                type="button"
                                                onClick={() => onOpenLocation?.(o)}
                                                className="text-left underline-offset-2 hover:underline cursor-pointer bg-transparent border-none p-0 truncate max-w-full uppercase tracking-wide font-semibold"
                                                style={{ color: accentColor, fontSize: 12 }}
                                                title={`Open map for ${composeAddress(o)}`}
                                            >
                                                <i className="fas fa-location-dot text-[10px] mr-1.5 opacity-70" />
                                                {composeAddress(o).toUpperCase()}
                                            </button>
                                        )
                                    })()}
                                </td>
                                <td
                                    className="px-3 py-2 whitespace-nowrap"
                                    style={{ color: 'var(--text-primary)' }}
                                    title={clean(o.description)}
                                >
                                    <span className="font-mono font-semibold">{clean(o.productCode) || '—'}</span>
                                    {o.description && (
                                        <span
                                            className="ml-1 max-w-[180px] truncate inline-block align-middle"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            {clean(o.description)}
                                        </span>
                                    )}
                                </td>
                                <td
                                    className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {yardage > 0 ? yardage : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {loadSize > 0 ? loadSize : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {trucks > 0 ? trucks : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 font-mono whitespace-nowrap"
                                    style={{ color: 'var(--text-secondary)' }}
                                    title={
                                        o.toJobTime || o.toPlantTime
                                            ? `To job ${clean(o.toJobTime) || '—'} · To plant ${clean(o.toPlantTime) || '—'}`
                                            : undefined
                                    }
                                >
                                    {clean(o.toJobTime) || '—'}
                                </td>
                                <td
                                    className="px-3 py-2 font-mono whitespace-nowrap"
                                    style={{ color: 'var(--text-secondary)' }}
                                    title="Spacing between loads (rate)"
                                >
                                    {clean(o.rate) || '—'}
                                </td>
                                <td
                                    className="px-3 py-2 font-mono whitespace-nowrap"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {clean(o.poNumber) || '—'}
                                </td>
                                <td
                                    className="px-3 py-2 whitespace-nowrap max-w-[180px] truncate"
                                    style={{ color: 'var(--text-secondary)' }}
                                    title={[clean(o.contact), clean(o.phone)].filter(Boolean).join(' · ')}
                                >
                                    {clean(o.contact) || clean(o.phone) || '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/* ── main view ──────────────────────────────────────────────────────────── */

/**
 * Schedule view — flat, filterable, sortable table (or grouped cards) of every
 * order pulled from the Daily Order Listing HTML import. Dispatchers can
 * narrow by plant, customer, product, time bucket, truck class, minimum
 * yardage, and a free-text search across customer/address/PO.
 */
function PlanScheduleView({ accentColor, onSwitchToPlanner, plantAddressByCode, plantNameByCode, plantProduction }) {
    const [query, setQuery] = useState('')
    const [plantFilter, setPlantFilter] = useState('all')
    const [classFilter, setClassFilter] = useState('all')
    const [productFilter, setProductFilter] = useState('all')
    const [bucket, setBucket] = useState('all')
    const [minYards, setMinYards] = useState('')
    const [sortKey, setSortKey] = useState('plantThenTime')
    const [viewMode, setViewMode] = useState('table')
    const [mapOrder, setMapOrder] = useState(null)

    /** Flat list of every order with plantCode attached. */
    const allOrders = useMemo(() => {
        const out = []
        Object.entries(plantProduction || {}).forEach(([code, data]) => {
            if (code === PLAN_META_KEY) return
            if (!Array.isArray(data?.orders)) return
            data.orders.forEach((o) => out.push({ ...o, plantCode: code }))
        })
        return out
    }, [plantProduction])

    const plantOptions = useMemo(() => {
        const codes = new Set(allOrders.map((o) => o.plantCode))
        return Array.from(codes).sort()
    }, [allOrders])

    const classOptions = useMemo(() => {
        const set = new Set()
        allOrders.forEach((o) => {
            const c = clean(o.truckClass)
            if (c) set.add(c)
        })
        return Array.from(set).sort()
    }, [allOrders])

    const productOptions = useMemo(() => {
        const set = new Set()
        allOrders.forEach((o) => {
            const c = clean(o.productCode)
            if (c) set.add(c)
        })
        return Array.from(set).sort()
    }, [allOrders])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const minYd = parseFloat(minYards) || 0
        return allOrders
            .filter((o) => {
                if (plantFilter !== 'all' && o.plantCode !== plantFilter) return false
                if (classFilter !== 'all' && clean(o.truckClass) !== classFilter) return false
                if (productFilter !== 'all' && clean(o.productCode) !== productFilter) return false
                if (bucket !== 'all' && timeBucket(o.startTime) !== bucket) return false
                if (minYd > 0 && (parseFloat(o.yardage) || 0) < minYd) return false
                if (q) {
                    const haystack = [
                        o.orderNum,
                        o.customer,
                        o.customerNum,
                        o.address,
                        o.city,
                        o.productCode,
                        o.description,
                        o.contact,
                        o.phone,
                        o.poNumber,
                        o.jobNumber,
                        o.plantCode
                    ]
                        .filter(Boolean)
                        .map((v) => String(v).toLowerCase())
                        .join(' | ')
                    if (!haystack.includes(q)) return false
                }
                return true
            })
            .sort((a, b) => compareOrders(a, b, sortKey))
    }, [allOrders, bucket, classFilter, minYards, plantFilter, productFilter, query, sortKey])

    /* ── KPI numbers — cancelled orders (start time 17:00) are kept in
       the table for transparency but excluded from yardage / truck totals. */
    const liveOrders = useMemo(
        () => filtered.filter((o) => getOrderStatus(o.startTime)?.kind !== 'cancelled'),
        [filtered]
    )
    const totalYards = sumField(liveOrders, 'yardage')
    const totalTrucks = sumField(liveOrders, 'truckCount')
    const uniquePlants = new Set(filtered.map((o) => o.plantCode)).size
    const uniqueCustomers = new Set(filtered.map((o) => (clean(o.customer) || '').toLowerCase()).filter(Boolean)).size
    const earliest = filtered
        .map((o) => timeToMinutes(o.startTime))
        .filter((t) => t != null)
        .sort((a, b) => a - b)[0]
    const latest = filtered
        .map((o) => timeToMinutes(o.startTime))
        .filter((t) => t != null)
        .sort((a, b) => b - a)[0]
    const earliestTime =
        earliest != null
            ? `${String(Math.floor(earliest / 60)).padStart(2, '0')}:${String(earliest % 60).padStart(2, '0')}`
            : null
    const latestTime =
        latest != null
            ? `${String(Math.floor(latest / 60)).padStart(2, '0')}:${String(latest % 60).padStart(2, '0')}`
            : null

    const bucketCounts = useMemo(() => {
        const counts = {}
        allOrders.forEach((o) => {
            const b = timeBucket(o.startTime)
            counts[b] = (counts[b] || 0) + 1
        })
        return counts
    }, [allOrders])

    const hasAnyOrders = allOrders.length > 0
    const hasActiveFilters =
        query ||
        plantFilter !== 'all' ||
        classFilter !== 'all' ||
        productFilter !== 'all' ||
        bucket !== 'all' ||
        (parseFloat(minYards) || 0) > 0

    const clearAllFilters = () => {
        setQuery('')
        setPlantFilter('all')
        setClassFilter('all')
        setProductFilter('all')
        setBucket('all')
        setMinYards('')
    }

    const groupedByPlant = useMemo(() => {
        const groups = new Map()
        filtered.forEach((o) => {
            if (!groups.has(o.plantCode)) groups.set(o.plantCode, [])
            groups.get(o.plantCode).push(o)
        })
        return Array.from(groups.entries())
            .map(([code, orders]) => ({ code, orders }))
            .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    }, [filtered])

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-4 lg:px-6 py-5 flex flex-col gap-4">
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <div
                            className="text-[22px] font-bold leading-tight"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                        >
                            Schedule
                        </div>
                        <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            Pulled from the Daily Order Listing import. Filter, sort, and scan every plant&apos;s orders
                            on one page.
                        </div>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                        <div
                            className="flex items-center rounded-lg p-0.5"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                        >
                            {VIEW_MODES.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setViewMode(m)}
                                    className="px-3 py-1.5 rounded-md text-[11.5px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                                    style={{
                                        background: viewMode === m ? accentColor : 'transparent',
                                        color: viewMode === m ? '#fff' : 'var(--text-secondary)'
                                    }}
                                >
                                    <i className={`fas ${m === 'table' ? 'fa-table' : 'fa-grip'} text-[10px]`} />
                                    {m === 'table' ? 'Table' : 'Cards'}
                                </button>
                            ))}
                        </div>
                        {onSwitchToPlanner && (
                            <button
                                type="button"
                                onClick={onSwitchToPlanner}
                                className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                                style={{ background: accentColor, color: '#fff' }}
                            >
                                <i className="fas fa-project-diagram text-[10px]" /> Planner
                            </button>
                        )}
                    </div>
                </div>

                {!hasAnyOrders ? (
                    <div
                        className="rounded-xl p-10 text-center"
                        style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border-medium)' }}
                    >
                        <i
                            className="fas fa-calendar-xmark text-3xl mb-3 opacity-60"
                            style={{ color: 'var(--text-tertiary)' }}
                        />
                        <div
                            className="text-[15px] font-bold mb-1"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                        >
                            No schedule yet
                        </div>
                        <div className="text-[12.5px] max-w-[480px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
                            Import the Daily Order Listing HTML to populate every plant&apos;s orders. Customer, start
                            time, product, yardage, and truck count will all land here.
                        </div>
                    </div>
                ) : (
                    <>
                        {/* KPI row */}
                        <div className="flex flex-wrap gap-3">
                            <KpiCard
                                accent={accentColor}
                                icon="fa-clipboard-list"
                                label="Orders"
                                value={filtered.length.toLocaleString()}
                                hint={
                                    hasActiveFilters && filtered.length !== allOrders.length
                                        ? `of ${allOrders.length} total`
                                        : undefined
                                }
                            />
                            <KpiCard
                                accent={accentColor}
                                icon="fa-industry"
                                label="Plants"
                                value={uniquePlants.toLocaleString()}
                                hint={`${uniqueCustomers} customers`}
                            />
                            <KpiCard
                                accent={accentColor}
                                icon="fa-cubes"
                                label="Yardage"
                                value={totalYards.toLocaleString()}
                            />
                            <KpiCard
                                accent={accentColor}
                                icon="fa-truck"
                                label="Trucks"
                                value={totalTrucks.toLocaleString()}
                            />
                            <KpiCard
                                accent={accentColor}
                                icon="fa-clock"
                                label="Window"
                                value={earliestTime && latestTime ? `${earliestTime}–${latestTime}` : '—'}
                            />
                        </div>

                        {/* Time-bucket quick chips */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className="text-[10px] font-bold uppercase tracking-wider mr-1"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Time
                            </span>
                            <Pill
                                accent={accentColor}
                                active={bucket === 'all'}
                                icon="fa-border-all"
                                onClick={() => setBucket('all')}
                            >
                                All · {allOrders.length}
                            </Pill>
                            {TIME_BUCKETS.map((b) => (
                                <Pill
                                    key={b.key}
                                    accent={accentColor}
                                    active={bucket === b.key}
                                    icon={b.icon}
                                    onClick={() => setBucket(b.key)}
                                >
                                    {b.label} · {bucketCounts[b.key] || 0}
                                </Pill>
                            ))}
                        </div>

                        {/* Filter bar */}
                        <div
                            className="rounded-xl p-3 grid gap-3"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-light)',
                                boxShadow: 'var(--shadow-sm)',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
                            }}
                        >
                            <FilterField label="Search">
                                <div
                                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <i
                                        className="fas fa-magnifying-glass text-[11px]"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    />
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Customer, address, PO…"
                                        className="bg-transparent outline-none border-none text-[12.5px] w-full"
                                        style={{ color: 'var(--text-primary)' }}
                                    />
                                    {query && (
                                        <button
                                            type="button"
                                            onClick={() => setQuery('')}
                                            className="border-none bg-transparent cursor-pointer"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            <i className="fas fa-times text-[10px]" />
                                        </button>
                                    )}
                                </div>
                            </FilterField>

                            <FilterField label="Plant">
                                <select
                                    value={plantFilter}
                                    onChange={(e) => setPlantFilter(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="all">All plants · {plantOptions.length}</option>
                                    {plantOptions.map((code) => (
                                        <option key={code} value={code}>
                                            {code}
                                            {plantNameByCode?.[code] ? ` · ${plantNameByCode[code]}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </FilterField>

                            <FilterField label="Truck class">
                                <select
                                    value={classFilter}
                                    onChange={(e) => setClassFilter(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="all">All classes · {classOptions.length}</option>
                                    {classOptions.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </FilterField>

                            <FilterField label="Product">
                                <select
                                    value={productFilter}
                                    onChange={(e) => setProductFilter(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="all">All products · {productOptions.length}</option>
                                    {productOptions.map((p) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                            </FilterField>

                            <FilterField label="Min yardage">
                                <input
                                    type="number"
                                    value={minYards}
                                    onChange={(e) => setMinYards(e.target.value)}
                                    placeholder="Any"
                                    min={0}
                                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] font-mono"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </FilterField>

                            <FilterField label="Sort by">
                                <select
                                    value={sortKey}
                                    onChange={(e) => setSortKey(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    {SORT_OPTIONS.map((o) => (
                                        <option key={o.key} value={o.key}>
                                            {o.label}
                                            {o.desc ? ' (high → low)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </FilterField>
                        </div>

                        {hasActiveFilters && (
                            <div className="flex items-center gap-2">
                                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                    {filtered.length} of {allOrders.length} orders match your filters.
                                </span>
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold border-none cursor-pointer"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-secondary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <i className="fas fa-rotate-left mr-1" /> Reset filters
                                </button>
                            </div>
                        )}

                        {filtered.length === 0 ? (
                            <div
                                className="rounded-xl p-10 text-center italic"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px dashed var(--border-medium)',
                                    color: 'var(--text-tertiary)'
                                }}
                            >
                                No orders match the current filters.
                            </div>
                        ) : viewMode === 'table' ? (
                            <ScheduleTable
                                accentColor={accentColor}
                                onOpenLocation={setMapOrder}
                                orders={filtered}
                                plantNameByCode={plantNameByCode}
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {groupedByPlant.map(({ code, orders }) => (
                                    <div key={code} className="flex flex-col gap-2">
                                        <div
                                            className="flex items-center gap-2 px-1 text-[13px]"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            <PlantBadge
                                                code={code}
                                                fallback={accentColor}
                                                name={plantNameByCode?.[code]}
                                            />
                                            <span style={{ color: 'var(--text-tertiary)' }}>
                                                {orders.length} order{orders.length === 1 ? '' : 's'} ·{' '}
                                                {sumField(orders, 'yardage').toLocaleString()} yd
                                            </span>
                                        </div>
                                        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                                            {orders.map((o, idx) => (
                                                <OrderCard
                                                    key={`${code}-${o.orderId || idx}`}
                                                    accentColor={accentColor}
                                                    order={o}
                                                    plantCode={code}
                                                    plantName={plantNameByCode?.[code]}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
            {mapOrder && (
                <JobMapModal
                    accentColor={accentColor}
                    onClose={() => setMapOrder(null)}
                    order={mapOrder}
                    plantAddress={plantAddressByCode?.[mapOrder?.plantCode] || ''}
                    plantCode={mapOrder?.plantCode}
                    plantName={plantNameByCode?.[mapOrder?.plantCode] || ''}
                    travelMinutes={parseHhmmToMinutes(mapOrder?.toJobTime)}
                />
            )}
        </div>
    )
}

export default PlanScheduleView
