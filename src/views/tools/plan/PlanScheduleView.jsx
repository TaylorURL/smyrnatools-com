import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import JobMapModal from '../../../app/components/schedule/JobMapModal'
import TruckCoverageHoverCard from '../../../app/components/schedule/TruckCoverageHoverCard'
import { TrafficService } from '../../../services/TrafficService'
import {
    BIG_POUR_MIN_TRUCKS,
    buildAssignmentDriverTimes,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computePullUpRows,
    computeSendHomeRows,
    computeSuggestedSlots,
    estimateOrderTiming,
    findNextViableStart,
    getCalculatedTruckCount,
    getEffectiveBase,
    getEffectiveMinTrucks,
    getMissingOperators,
    getOffsetDate,
    getOrderPourDurationMinutes,
    getOrderPourRate,
    getPoolDayMultiplier,
    getRequiredTrucksForPourRate,
    isBigPourOrder,
    isClosedDay,
    isExcludedOrder,
    plantBadgeColor,
    timeToMinutes,
    trucksToHitBigPourGoal
} from '../../../utils/PlanUtility'

const formatMinutesClock = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const composeAddress = (order) =>
    [order?.address, order?.city]
        .map((s) => (s == null ? '' : String(s).trim()))
        .filter(Boolean)
        .join(', ')

/**
 * Pull the city segment out of a plant's full street address so we can fall
 * back to it when an order's city is missing. Accepts common formats:
 *   "123 Main St, Houston, TX 77001"  → "Houston"
 *   "123 Main St, Houston TX 77001"   → "Houston"
 *   "123 Main St"                      → ""
 */
const extractCityFromFullAddress = (fullAddress) => {
    const value = String(fullAddress || '').trim()
    if (!value) return ''
    const parts = value
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean)
    if (parts.length >= 3) return parts[1]
    if (parts.length === 2) {
        // "street, city STATE ZIP" — strip trailing state + zip to isolate city.
        return parts[1].replace(/\s+[A-Za-z]{2}(\s+\d{5}(-\d{4})?)?\s*$/i, '').trim()
    }
    return ''
}

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
    '15:00': { color: '#d97706', icon: 'fa-bolt', kind: 'sameDay', label: 'Same-day' },
    '17:00': { color: '#dc2626', icon: 'fa-ban', kind: 'cancelled', label: 'Cancelled' },
    '18:00': { color: '#6366f1', icon: 'fa-flask', kind: 'test', label: 'Test' }
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

const PLAN_META_KEY = '_meta'
const VIEW_MODES = ['table', 'cards']

// Plant badge colors live in PlanUtility so every view (Schedule, Demand,
// Planner markers, …) draws the same plant the same color.

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

/* ── small building blocks ──────────────────────────────────────────────── */

/**
 * Compact inline stat for the Schedule's KPI strip. Designed to sit shoulder-
 * to-shoulder with siblings inside one rounded panel, separated by hairline
 * dividers. No icons, no big colored chips — just a label, a hero number,
 * an optional unit suffix, and a one-line hint. The badge slot floats next
 * to the value (used by the yardage delta pill).
 */
function Stat({ badge, first, hint, label, unit, value }) {
    return (
        <div
            className="flex-1 min-w-[120px] px-3.5 py-2.5"
            style={{ borderLeft: first ? 'none' : '1px solid var(--border-light)' }}
        >
            <div
                className="text-[9.5px] font-bold uppercase tracking-[0.08em]"
                style={{ color: 'var(--text-tertiary)' }}
            >
                {label}
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5 truncate" title={String(value)}>
                <span
                    className="font-bold leading-none"
                    style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-heading)',
                        fontSize: 22,
                        letterSpacing: '-0.01em'
                    }}
                >
                    {value}
                </span>
                {unit && (
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                        {unit}
                    </span>
                )}
                {badge}
            </div>
            {hint && (
                <div className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }} title={hint}>
                    {hint}
                </div>
            )}
        </div>
    )
}

/** +/- percentage pill shown next to the Yardage KPI value. Green when
 *  up day-over-day, red when down, gray at zero. */
function YardageDeltaBadge({ pct, yesterdayYardage }) {
    if (!Number.isFinite(pct)) return null
    const isFlat = pct === 0
    const isUp = pct > 0
    const color = isFlat ? '#64748b' : isUp ? '#16a34a' : '#dc2626'
    const icon = isFlat ? 'fa-minus' : isUp ? 'fa-arrow-up' : 'fa-arrow-down'
    const sign = isUp ? '+' : ''
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5"
            style={{ background: `${color}1a`, color }}
            title={`Day-over-day change · yesterday ${yesterdayYardage.toLocaleString()} yd`}
        >
            <i className={`fas ${icon} text-[9px]`} />
            {sign}
            {pct.toFixed(1)}%
        </span>
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

function OrderCard({
    accentColor,
    closerPlant,
    onOpenLocation,
    onPickPlant,
    onPickProduct,
    onPickStatus,
    order,
    plantCode,
    plantName,
    travelOverrides
}) {
    const yardage = parseFloat(order.yardage) || 0
    const loadSize = parseFloat(order.loadSize) || 0
    const start = formatHhmm(order.startTime)
    const status = getOrderStatus(order.startTime)
    const isCancelled = status?.kind === 'cancelled'
    const isTest = status?.kind === 'test'
    // Test + cancelled orders are not real pours — suppress truck count and
    // style the card so the dispatcher knows not to act on it.
    const isNonProduction = isCancelled || isTest
    const computedTrucks = isNonProduction ? null : getCalculatedTruckCount(order, travelOverrides)
    const trucks = computedTrucks ?? 0
    const addressBad = isLikelyBadAddress(clean(order.address))
    const hasAddress = !!(clean(order.address) || clean(order.city))
    return (
        <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{
                background: isCancelled
                    ? 'rgba(220, 38, 38, 0.05)'
                    : isTest
                      ? 'rgba(99, 102, 241, 0.05)'
                      : 'var(--bg-primary)',
                border: `1px solid ${isCancelled ? 'rgba(220, 38, 38, 0.35)' : isTest ? 'rgba(99, 102, 241, 0.35)' : 'var(--border-light)'}`,
                opacity: isNonProduction ? 0.78 : 1
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
                        {status &&
                            (onPickStatus ? (
                                <button
                                    type="button"
                                    onClick={() => onPickStatus(status.kind)}
                                    className="border-none bg-transparent p-0 cursor-pointer"
                                    title={`Filter to ${status.label.toLowerCase()} orders`}
                                >
                                    <OrderStatusBadge status={status} />
                                </button>
                            ) : (
                                <OrderStatusBadge status={status} />
                            ))}
                        <BigPourBadge order={order} travelOverrides={travelOverrides} />
                    </div>
                    <div
                        className="text-[11.5px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {plantCode &&
                            (onPickPlant ? (
                                <button
                                    type="button"
                                    onClick={() => onPickPlant(plantCode)}
                                    className="font-semibold underline-offset-2 hover:underline border-none bg-transparent p-0 cursor-pointer"
                                    style={{ color: accentColor }}
                                    title={`Filter to plant ${plantCode}`}
                                >
                                    {plantCode}
                                    {plantName ? ` · ${plantName}` : ''}
                                </button>
                            ) : (
                                <span className="font-semibold" style={{ color: accentColor }}>
                                    {plantCode}
                                    {plantName ? ` · ${plantName}` : ''}
                                </span>
                            ))}
                        {order.orderNum && <span>#{order.orderNum}</span>}
                        {order.customerNum && <span>Cust {order.customerNum}</span>}
                        {order.truckClass && <span>Class {order.truckClass}</span>}
                    </div>
                    {hasAddress &&
                        (addressBad ? (
                            <span
                                className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider"
                                style={{ background: '#dc2626', color: '#fff' }}
                                title={`Address looks invalid — original value: "${clean(order.address)}"`}
                            >
                                <i className="fas fa-triangle-exclamation text-[9px]" />
                                Bad Address
                            </span>
                        ) : onOpenLocation ? (
                            <div className="mt-1 flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={() => onOpenLocation(order)}
                                    className="text-[12px] flex items-center gap-1.5 border-none bg-transparent p-0 cursor-pointer underline-offset-2 hover:underline w-full text-left"
                                    style={{ color: accentColor }}
                                    title="Open route map"
                                >
                                    <i className="fas fa-location-dot text-[10px] opacity-80" />
                                    <span className="truncate uppercase tracking-wide font-semibold">
                                        {composeAddress(order).toUpperCase()}
                                    </span>
                                </button>
                                {closerPlant && (
                                    <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap self-start"
                                        style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8' }}
                                        title={`Live drive time: ${closerPlant.minutes} min from plant ${closerPlant.plantCode}${closerPlant.plantName ? ` (${closerPlant.plantName})` : ''} vs ${closerPlant.assignedMinutes} min from assigned plant ${plantCode}. Saves ~${closerPlant.savings} min one-way.`}
                                    >
                                        <i className="fas fa-route text-[9px]" />
                                        Closer to {closerPlant.plantCode} · −{closerPlant.savings}m
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div
                                className="text-[12px] mt-1 flex items-center gap-1.5"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <i className="fas fa-location-dot text-[10px] opacity-70" />
                                <span className="truncate">
                                    {[clean(order.address), clean(order.city)].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                        ))}
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
            {(order.productCode || order.description) &&
                (onPickProduct && order.productCode ? (
                    <button
                        type="button"
                        onClick={() => onPickProduct(clean(order.productCode))}
                        className="rounded-md px-2.5 py-1.5 flex items-center gap-2 border cursor-pointer text-left"
                        style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border-light)'
                        }}
                        title={`Filter to product ${clean(order.productCode)}`}
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
                    </button>
                ) : (
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
                ))}
            <div className="flex flex-wrap gap-1.5 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                {order.tktTime && <KeyValue label="Tkt" value={formatHhmm(order.tktTime)} />}
                {order.rate && <KeyValue label="Rate" value={clean(order.rate)} />}
                {order.toJobTime && <KeyValue label="To Job" value={clean(order.toJobTime)} />}
                {order.toPlantTime && <KeyValue label="To Plant" value={clean(order.toPlantTime)} />}
                {trucks > 0 && <KeyValue label="Trucks" value={trucks} />}
                {loadSize > 0 && <KeyValue label="Load" value={`${loadSize} yd`} />}
                {order.poNumber && <KeyValue label="PO" value={clean(order.poNumber)} />}
                {order.jobNumber && <KeyValue label="Job" value={clean(order.jobNumber)} />}
                {order.phone && <KeyValue label="Contact" value={clean(order.phone)} />}
                {order.contact && <KeyValue label="Dispatcher" value={clean(order.contact)} />}
            </div>
        </div>
    )
}

function BigPourBadge({ order, travelOverrides }) {
    const isBigPour = isBigPourOrder(order)
    const needed = getEffectiveMinTrucks(order, travelOverrides)
    // Only flag under-booked when dispatch booked fewer than our canonical count.
    const dispatchBooked = parseFloat(order?.truckCount) || 0
    const shortfall = needed && dispatchBooked > 0 ? Math.max(0, needed - dispatchBooked) : 0
    const trucks = parseFloat(order.truckCount) || 0
    // Show when the order is a flagged big pour OR when any order is
    // understaffed vs the travel-time-derived requirement.
    if (!isBigPour && shortfall === 0) return null
    const rate = getOrderPourRate(order)
    const calculated = getRequiredTrucksForPourRate(order, travelOverrides)
    const pourMinutes = getOrderPourDurationMinutes(order)
    const usingLive = !!travelOverrides
    const pourHours = pourMinutes != null ? (pourMinutes / 60).toFixed(1) : null
    const understaffed = shortfall > 0
    const tooltipLines = []
    if (rate != null) tooltipLines.push(`Pour rate: ${rate} yd/hr`)
    if (calculated != null)
        tooltipLines.push(
            `Travel-based requirement: ${calculated} trucks${usingLive ? ' (live Google traffic)' : ' (dispatch estimate)'}`
        )
    if (isBigPour) {
        tooltipLines.push(`Big-pour floor (≥ 120 yd · <10 min spacing): ${BIG_POUR_MIN_TRUCKS} trucks`)
        const goalTrucks = trucksToHitBigPourGoal(order, travelOverrides)
        if (Number.isFinite(goalTrucks) && goalTrucks > BIG_POUR_MIN_TRUCKS) {
            tooltipLines.push(`Trucks to hit 120 yd/hr loaded at this travel: ${goalTrucks}`)
        }
    }
    if (needed != null) tooltipLines.push(`Effective minimum: ${needed} trucks`)
    if (dispatchBooked > 0 && needed !== dispatchBooked) {
        tooltipLines.push(`On Jonel: ${dispatchBooked} trucks`)
        tooltipLines.push('(Jonel is likely wrong — use the required count above)')
    }
    if (pourHours) tooltipLines.push(`Est. pour time: ~${pourHours}h`)
    if (understaffed) tooltipLines.push(`Short by ${shortfall} truck${shortfall === 1 ? '' : 's'}`)
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{
                background: understaffed ? '#dc2626' : isBigPour ? '#4f46e5' : '#d97706',
                color: '#fff'
            }}
            title={tooltipLines.join('\n')}
        >
            <i
                className={`fas ${understaffed ? 'fa-triangle-exclamation' : isBigPour ? 'fa-fire' : 'fa-users'} text-[9px]`}
            />
            {understaffed
                ? `${isBigPour ? 'Big pour · ' : ''}+${shortfall} trucks`
                : isBigPour
                  ? `Big Pour · ${rate} yd/hr`
                  : `Needs ${needed} trucks`}
        </span>
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

/**
 * Shared visual shell for every non-order row in the schedule (truck returns,
 * help transfers, send-home recommendations, trade-off decisions, open-slot
 * suggestions). Keeps the visual rhythm consistent so order rows always read
 * as the "primary" content while synthetic rows feel like quiet annotations.
 *
 * Layout:
 *   [accent time col] [plant badge col] [pill + primary + secondary + chips]
 */
function SyntheticRow({ accentColor, chips, icon, pillIcon, pillLabel, plantCell, primary, secondary, time, tint }) {
    return (
        <tr
            style={{
                background: tint,
                borderLeft: `3px solid ${accentColor}`,
                borderTop: '1px solid var(--border-light)'
            }}
        >
            <td
                className="px-3 py-2 font-mono font-bold whitespace-nowrap align-top"
                style={{ color: accentColor, width: 1 }}
            >
                <span className="inline-flex items-center gap-1.5">
                    <i className={`fas ${icon} text-[11px]`} />
                    {formatMinutesClock(time)}
                </span>
            </td>
            <td className="px-3 py-2 whitespace-nowrap align-top" style={{ width: 1 }}>
                {plantCell}
            </td>
            <td className="px-3 py-2 align-top" colSpan={11}>
                <div className="flex items-start gap-2.5 text-[12px] flex-wrap">
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
                        style={{ background: accentColor, color: '#fff' }}
                    >
                        <i className={`fas ${pillIcon} text-[8px]`} />
                        {pillLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="leading-snug" style={{ color: 'var(--text-primary)' }}>
                            {primary}
                        </div>
                        {secondary && (
                            <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                                {secondary}
                            </div>
                        )}
                        {chips}
                    </div>
                </div>
            </td>
        </tr>
    )
}

function ScheduleTable({
    accentColor,
    filteredPlantCode = null,
    getCloserPlantForOrder,
    getTravelOverrides,
    helpRows = [],
    isPlantFiltered = false,
    keyForOrder,
    onOpenLocation,
    orders,
    plantCityByCode,
    plantNameByCode,
    poolSourceByCode,
    poolTimeline,
    poolTimelinesByPlant,
    pullUpRows = [],
    sendHomeRows = [],
    showExtraRows = true,
    suggestedSlotRows = []
}) {
    // Synthetic rows require a plant filter AND the toggle to be on — both
    // gates collapse into one effective flag for the rest of the component.
    const extrasActive = isPlantFiltered && showExtraRows
    /** Synthetic rows (help, send-home, truck returns, slot suggestions) are
     *  only meaningful in the context of a single plant — they clutter the
     *  table when every plant's rows are mixed together. Gate them on an
     *  active plant filter. When the dispatcher selects a specific plant
     *  (even one with no orders), prefer that explicit filter over the
     *  visible-orders set so help / send-home / slot rows still show. */
    const visiblePlantCodes = useMemo(() => {
        if (filteredPlantCode) return new Set([filteredPlantCode])
        const set = new Set()
        for (const order of orders) if (order.plantCode) set.add(order.plantCode)
        return set
    }, [orders, filteredPlantCode])
    const filteredHelpRows = useMemo(
        () =>
            extrasActive
                ? helpRows.filter(
                      (row) =>
                          visiblePlantCodes.has(row.fromPlant) ||
                          visiblePlantCodes.has(row.toPlant) ||
                          (row.returnPlant && visiblePlantCodes.has(row.returnPlant))
                  )
                : [],
        [helpRows, visiblePlantCodes, extrasActive]
    )
    const filteredSendHomeRows = useMemo(
        () => (extrasActive ? sendHomeRows.filter((row) => visiblePlantCodes.has(row.plantCode)) : []),
        [sendHomeRows, visiblePlantCodes, extrasActive]
    )
    // Open-slot suggestions are the dispatcher's "where could I book a new
    // order" nudge — they show whenever a plant is filtered, even if the
    // dispatcher toggled off the other synthetic rows. Free-slot visibility
    // is independent of `extrasActive`.
    const filteredSuggestedSlotRows = useMemo(
        () => (isPlantFiltered ? suggestedSlotRows.filter((row) => visiblePlantCodes.has(row.plantCode)) : []),
        [suggestedSlotRows, visiblePlantCodes, isPlantFiltered]
    )
    /** Pull-up recommendations follow the same gating as send-home / help —
     *  they're per-plant, only meaningful with an active plant filter and
     *  when the dispatcher has the extra-rows toggle on. */
    const filteredPullUpRows = useMemo(
        () => (extrasActive ? pullUpRows.filter((row) => visiblePlantCodes.has(row.plantCode)) : []),
        [pullUpRows, visiblePlantCodes, extrasActive]
    )

    /* ── Truck-coverage hover modal state ─────────────────────────────────
       Tracks which order's modal is open. `openHover(key)` shows the modal
       and cancels any pending close; `queueCloseHover` schedules a delayed
       close so the user has time to move their cursor from the cell onto
       the modal itself. Both the cell trigger and the modal get the same
       handlers, so hovering either keeps it open. */
    const [hoveredKey, setHoveredKey] = useState(null)
    const hoverCloseTimer = useRef(null)
    const cancelHoverClose = useCallback(() => {
        if (hoverCloseTimer.current) {
            clearTimeout(hoverCloseTimer.current)
            hoverCloseTimer.current = null
        }
    }, [])
    const openHover = useCallback(
        (key) => {
            cancelHoverClose()
            setHoveredKey(key)
        },
        [cancelHoverClose]
    )
    const queueCloseHover = useCallback(() => {
        cancelHoverClose()
        hoverCloseTimer.current = setTimeout(() => setHoveredKey(null), 400)
    }, [cancelHoverClose])
    useEffect(() => () => cancelHoverClose(), [cancelHoverClose])
    /**
     * Build a chronological list of real order rows interleaved with synthetic
     * "trucks returning" rows, one per order at that order's last-truck-back
     * timestamp. The return row styles differently (green tint, left accent)
     * so dispatchers see exactly when capacity frees up at each plant without
     * floating overlays.
     *
     * Return rows only interleave when the sort is time-based (default sort
     * plant→time, or explicit start-time). For yardage/trucks/customer sorts
     * returns are skipped because they'd break the chosen ordering.
     */
    const tableRows = useMemo(() => {
        const rows = []
        for (const order of orders) rows.push({ kind: 'order', order, time: timeToMinutes(order.startTime) })
        if (extrasActive) {
            // Roll per-truck returns up into 30-minute buckets — trucks
            // cycle individually, but showing one row per truck floods the
            // schedule. A row per half-hour batch reads like "7 trucks back
            // between 07:00 and 07:30" which is what a dispatcher actually
            // tracks. Pool count on the bucket uses the pool state right
            // after the last return in that bucket.
            const BUCKET_MIN = 30
            for (const order of orders) {
                const entry = poolTimeline?.[keyForOrder(order)]
                if (!entry || !Array.isArray(entry.returnEvents) || entry.returnEvents.length === 0) continue
                const buckets = new Map()
                entry.returnEvents.forEach((re) => {
                    if (!Number.isFinite(re.time)) return
                    const bucket = Math.floor(re.time / BUCKET_MIN) * BUCKET_MIN
                    const existing = buckets.get(bucket)
                    if (existing) {
                        existing.count += re.count
                        existing.lastTime = Math.max(existing.lastTime, re.time)
                        existing.poolAfter = re.poolAfter
                    } else {
                        buckets.set(bucket, {
                            count: re.count,
                            firstTime: re.time,
                            lastTime: re.time,
                            poolAfter: re.poolAfter
                        })
                    }
                })
                const bucketRows = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
                bucketRows.forEach(([bucketStart, agg], i) => {
                    rows.push({
                        count: agg.count,
                        kind: 'return',
                        order,
                        plantCode: order.plantCode,
                        poolAfterReturn: agg.poolAfter,
                        rangeEnd: agg.lastTime,
                        rangeStart: agg.firstTime,
                        returnIndex: i,
                        time: bucketStart,
                        totalReturns: bucketRows.length,
                        truckCount: entry.truckCount
                    })
                })
            }
        }
        for (const row of filteredHelpRows) {
            rows.push({
                count: row.count,
                direction: row.direction,
                forOrder: row.forOrder || null,
                fromPlant: row.fromPlant,
                helpKey: `${row.assignmentIndex}-${row.direction}-${row.time}`,
                kind: 'help',
                returnPlant: row.returnPlant,
                time: row.time,
                toPlant: row.toPlant
            })
        }
        // Combine a send-home row with any open-slot rows at the same plant
        // that fit the true spare capacity at that moment. "Surplus" here is
        // the cumulative min-future pool — trucks that will never be needed
        // for existing orders from this moment forward. Slots whose min-truck
        // floor fits that surplus merge into a single trade-off row.
        const slotConsumed = new Set()
        const sendHomeConsumed = new Set()
        filteredSendHomeRows.forEach((sh, shIdx) => {
            const available = Number.isFinite(sh.surplus) ? sh.surplus : sh.count
            const fittingIdxs = []
            filteredSuggestedSlotRows.forEach((slot, sIdx) => {
                if (slotConsumed.has(sIdx)) return
                if (slot.plantCode !== sh.plantCode) return
                if (slot.minTrucks > available) return
                fittingIdxs.push(sIdx)
            })
            if (fittingIdxs.length === 0) return
            sendHomeConsumed.add(shIdx)
            fittingIdxs.forEach((i) => slotConsumed.add(i))
            rows.push({
                count: sh.count,
                kind: 'tradeoff',
                plantCode: sh.plantCode,
                poolAfter: sh.poolAfter,
                slots: fittingIdxs.map((i) => filteredSuggestedSlotRows[i]),
                surplus: available,
                time: sh.time,
                tradeoffKey: `${sh.plantCode}-${sh.time}-${shIdx}`
            })
        })
        filteredSendHomeRows.forEach((row, i) => {
            if (sendHomeConsumed.has(i)) return
            rows.push({
                count: row.count,
                kind: 'sendHome',
                plantCode: row.plantCode,
                poolAfter: row.poolAfter,
                sendHomeKey: `${row.plantCode}-${row.time}-${i}`,
                time: row.time
            })
        })
        filteredSuggestedSlotRows.forEach((row, i) => {
            if (slotConsumed.has(i)) return
            rows.push({
                durationMin: row.durationMin,
                kind: 'slot',
                label: row.label,
                minTrucks: row.minTrucks,
                plantCode: row.plantCode,
                slotKey: `${row.key}-${row.plantCode}-${row.time}`,
                time: row.time,
                truckRange: row.truckRange
            })
        })
        filteredPullUpRows.forEach((row, i) => {
            rows.push({
                kind: 'pullUp',
                notifyByMin: row.notifyByMin,
                order: row.order,
                originalStartMin: row.originalStartMin,
                plantCode: row.plantCode,
                pourDurationMin: row.pourDurationMin,
                pullUpDeltaMin: row.pullUpDeltaMin,
                pullUpKey: `${row.plantCode}-${row.suggestedStartMin}-${i}`,
                suggestedStartMin: row.suggestedStartMin,
                time: row.time,
                truckCount: row.truckCount,
                yardage: row.yardage
            })
        })
        // Chronological sort runs whenever any synthetic row is in play —
        // they only make sense at their actual minute between orders. With
        // NO synthetic rows (pure order list), we preserve the Sort by
        // picker's ordering verbatim.
        const hasSyntheticRows = rows.some((r) => r.kind !== 'order')
        if (hasSyntheticRows) {
            rows.sort((a, b) => {
                const at = Number.isFinite(a.time) ? a.time : Infinity
                const bt = Number.isFinite(b.time) ? b.time : Infinity
                if (at !== bt) return at - bt
                // At the same minute: returns first (pool up), then help,
                // then send-home / trade-off, then slot suggestions, then
                // real orders.
                const order = { help: 1, order: 5, pullUp: 3, return: 0, sendHome: 2, slot: 4, tradeoff: 2 }
                return (order[a.kind] ?? 6) - (order[b.kind] ?? 6)
            })
        }
        return rows
    }, [
        orders,
        poolTimeline,
        keyForOrder,
        filteredHelpRows,
        filteredSendHomeRows,
        filteredSuggestedSlotRows,
        filteredPullUpRows,
        extrasActive
    ])

    return (
        <div
            className="rounded-xl overflow-auto"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                // Give the table its own scroll viewport so the header can
                // actually stick when the dispatcher scrolls through a long
                // schedule. Height is capped to "viewport minus surrounding
                // chrome" (page nav, title, KPIs, filters) so the sticky
                // header pins within the table, not within a container that
                // itself scrolls out of view.
                maxHeight: 'calc(100vh - 260px)'
            }}
        >
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
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
                            'Contact',
                            'Dispatcher'
                        ].map((h) => (
                            <th
                                key={h}
                                className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap"
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    borderBottom: '1px solid var(--border-light)',
                                    boxShadow: '0 1px 0 0 var(--border-light)',
                                    color: 'var(--text-secondary)',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 10
                                }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {tableRows.map((row, idx) => {
                        if (row.kind === 'return') {
                            const plantName = plantNameByCode?.[row.plantCode] || ''
                            const orderTag = row.order.orderNum
                                ? `#${row.order.orderNum}`
                                : row.order.startTime
                                  ? String(row.order.startTime).slice(0, 5)
                                  : 'order'
                            const truckWord = row.count === 1 ? 'truck' : 'trucks'
                            // Show the actual first/last return time inside the 30-min
                            // bucket so dispatchers see exactly when trucks trickled in.
                            const rangeLabel =
                                Number.isFinite(row.rangeStart) && Number.isFinite(row.rangeEnd)
                                    ? row.rangeStart === row.rangeEnd
                                        ? formatMinutesClock(row.rangeStart)
                                        : `${formatMinutesClock(row.rangeStart)}–${formatMinutesClock(row.rangeEnd)}`
                                    : null
                            return (
                                <SyntheticRow
                                    key={`return-${keyForOrder(row.order)}-${row.returnIndex ?? 0}`}
                                    accentColor="#16a34a"
                                    icon="fa-arrow-rotate-left"
                                    pillIcon="fa-truck-fast"
                                    pillLabel={`+${row.count} back`}
                                    plantCell={
                                        <PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />
                                    }
                                    primary={
                                        <>
                                            <b>{row.plantCode}</b> now has{' '}
                                            <b>{Number.isFinite(row.poolAfterReturn) ? row.poolAfterReturn : '—'}</b>{' '}
                                            operator
                                            {row.poolAfterReturn === 1 ? '' : 's'} available
                                        </>
                                    }
                                    secondary={
                                        <>
                                            {row.count} {truckWord} back from <b>{orderTag}</b>
                                            {row.order.customer ? ` · ${clean(row.order.customer)}` : ''}
                                            {rangeLabel && (
                                                <span style={{ color: 'var(--text-tertiary)' }}>
                                                    {' '}
                                                    · trickled in {rangeLabel}
                                                </span>
                                            )}
                                        </>
                                    }
                                    time={row.time}
                                    tint="rgba(22, 163, 74, 0.06)"
                                />
                            )
                        }
                        if (row.kind === 'tradeoff') {
                            const plantName = plantNameByCode?.[row.plantCode] || ''
                            const freeCount = Number.isFinite(row.surplus) ? row.surplus : row.count
                            return (
                                <SyntheticRow
                                    key={`tradeoff-${row.tradeoffKey}`}
                                    accentColor="#d97706"
                                    chips={
                                        <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                                            <span
                                                className="inline-flex items-center gap-1 font-semibold"
                                                style={{ color: '#0369a1' }}
                                            >
                                                <i className="fas fa-calendar-plus text-[9px]" />
                                                Book:
                                            </span>
                                            {row.slots.map((slot) => (
                                                <span
                                                    key={slot.key}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-[10.5px]"
                                                    style={{
                                                        background: 'rgba(14, 165, 233, 0.12)',
                                                        color: '#0369a1'
                                                    }}
                                                    title={`${slot.minTrucks}+ trucks idle for ~${Math.round((slot.durationMin / 60) * 10) / 10}h starting ${formatMinutesClock(slot.time)}`}
                                                >
                                                    {slot.label}
                                                </span>
                                            ))}
                                            <span style={{ color: 'var(--text-tertiary)' }}>or</span>
                                            <span
                                                className="inline-flex items-center gap-1 font-semibold"
                                                style={{ color: '#64748b' }}
                                            >
                                                <i className="fas fa-house-user text-[9px]" />
                                                Send {freeCount} home
                                            </span>
                                        </div>
                                    }
                                    icon="fa-scale-balanced"
                                    pillIcon="fa-scale-balanced"
                                    pillLabel={`Decision · ${freeCount} idle`}
                                    plantCell={
                                        <PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />
                                    }
                                    primary={
                                        <>
                                            <b>{row.plantCode}</b> has <b>{freeCount}</b> truck
                                            {freeCount === 1 ? '' : 's'} free — book new work, or send them home.
                                        </>
                                    }
                                    time={row.time}
                                    tint="rgba(217, 119, 6, 0.07)"
                                />
                            )
                        }
                        if (row.kind === 'slot') {
                            const plantName = plantNameByCode?.[row.plantCode] || ''
                            const hours = Math.round((row.durationMin / 60) * 10) / 10
                            return (
                                <SyntheticRow
                                    key={`slot-${row.slotKey}`}
                                    accentColor="#0ea5e9"
                                    icon="fa-calendar-plus"
                                    pillIcon="fa-calendar-plus"
                                    pillLabel={row.label}
                                    plantCell={
                                        <PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />
                                    }
                                    primary={
                                        <>
                                            <b>{row.plantCode}</b> could take a <b>{row.truckRange}-truck</b> pour
                                            starting here.
                                        </>
                                    }
                                    secondary={
                                        <>
                                            {row.minTrucks}+ trucks idle · ~{hours}h window from{' '}
                                            {formatMinutesClock(row.time)}
                                        </>
                                    }
                                    time={row.time}
                                    tint="rgba(14, 165, 233, 0.06)"
                                />
                            )
                        }
                        if (row.kind === 'pullUp') {
                            const plantName = plantNameByCode?.[row.plantCode] || ''
                            const customerName = clean(row.order?.customer)
                            const orderTag = row.order?.orderNum
                                ? `#${row.order.orderNum}`
                                : row.order?.startTime
                                  ? String(row.order.startTime).slice(0, 5)
                                  : 'order'
                            const deltaH = Math.floor(row.pullUpDeltaMin / 60)
                            const deltaM = row.pullUpDeltaMin % 60
                            const deltaLabel =
                                deltaH > 0 ? `${deltaH}h${deltaM > 0 ? ` ${deltaM}m` : ''}` : `${deltaM}m`
                            return (
                                <SyntheticRow
                                    key={`pull-up-${row.pullUpKey}`}
                                    accentColor="#0d9488"
                                    icon="fa-arrow-left-long"
                                    pillIcon="fa-clock-rotate-left"
                                    pillLabel={`Compact · ${deltaLabel} earlier`}
                                    plantCell={
                                        <PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />
                                    }
                                    primary={
                                        <>
                                            Try moving <b>{orderTag}</b>
                                            {customerName ? (
                                                <>
                                                    {' '}
                                                    · <b>{customerName}</b>
                                                </>
                                            ) : null}{' '}
                                            from <b>{formatMinutesClock(row.originalStartMin)}</b> to{' '}
                                            <b>{formatMinutesClock(row.suggestedStartMin)}</b>.
                                        </>
                                    }
                                    secondary={
                                        <>
                                            <b>{row.plantCode}</b> has <b>{row.truckCount}</b> truck
                                            {row.truckCount === 1 ? '' : 's'} idle here that{' '}
                                            {row.order?.yardage ? (
                                                <>
                                                    could pour this <b>{Math.round(row.yardage)} yd</b> job
                                                </>
                                            ) : (
                                                <>could absorb this pour</>
                                            )}{' '}
                                            instead of waiting until <b>{formatMinutesClock(row.originalStartMin)}</b>.
                                            Notify customer by <b>{formatMinutesClock(row.notifyByMin)}</b>.
                                            <span style={{ color: 'var(--text-tertiary)' }}>
                                                {' '}
                                                · When working the phones, start with the latest-scheduled customers
                                                first.
                                            </span>
                                        </>
                                    }
                                    time={row.time}
                                    tint="rgba(13, 148, 136, 0.06)"
                                />
                            )
                        }
                        if (row.kind === 'sendHome') {
                            const plantName = plantNameByCode?.[row.plantCode] || ''
                            return (
                                <SyntheticRow
                                    key={`send-home-${row.sendHomeKey}`}
                                    accentColor="#64748b"
                                    icon="fa-house-user"
                                    pillIcon="fa-door-open"
                                    pillLabel="Clock out"
                                    plantCell={
                                        <PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />
                                    }
                                    primary={
                                        <>
                                            Send <b>{row.count}</b> operator
                                            {row.count === 1 ? '' : 's'} home from <b>{row.plantCode}</b>.
                                        </>
                                    }
                                    secondary={`Pool stays covered for the rest of the day.`}
                                    time={row.time}
                                    tint="rgba(100, 116, 139, 0.07)"
                                />
                            )
                        }
                        if (row.kind === 'help') {
                            const isOutbound = row.direction === 'outbound'
                            const homePlant = row.returnPlant || row.fromPlant
                            const fromName = plantNameByCode?.[row.fromPlant] || ''
                            const toName = plantNameByCode?.[row.toPlant] || ''
                            const homeName = plantNameByCode?.[homePlant] || ''
                            const accent = isOutbound ? '#3b82f6' : '#8b5cf6'
                            const tint = isOutbound ? 'rgba(59, 130, 246, 0.06)' : 'rgba(139, 92, 246, 0.06)'
                            // On the return leg, the "plant cell" shows {toPlant} → {homePlant}
                            // since those are the actual ends of the movement.
                            const plantCell = isOutbound ? (
                                <div className="flex items-center gap-1.5">
                                    <PlantBadge code={row.fromPlant} fallback={accentColor} name={fromName} />
                                    <i
                                        className="fas fa-arrow-right text-[9px]"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    />
                                    <PlantBadge code={row.toPlant} fallback={accentColor} name={toName} />
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <PlantBadge code={row.toPlant} fallback={accentColor} name={toName} />
                                    <i
                                        className="fas fa-arrow-right text-[9px]"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    />
                                    <PlantBadge code={homePlant} fallback={accentColor} name={homeName} />
                                </div>
                            )
                            const forOrder = row.forOrder
                            const jobTag = forOrder
                                ? forOrder.orderNum
                                    ? `#${forOrder.orderNum}`
                                    : forOrder.startTime
                                      ? String(forOrder.startTime).slice(0, 5)
                                      : 'that job'
                                : null
                            const customerTag =
                                forOrder?.customer && clean(forOrder.customer) ? clean(forOrder.customer) : null
                            const returnsHome = homePlant === row.fromPlant
                            return (
                                <SyntheticRow
                                    key={`help-${row.helpKey}`}
                                    accentColor={accent}
                                    icon={isOutbound ? 'fa-paper-plane' : 'fa-rotate-left'}
                                    pillIcon={isOutbound ? 'fa-truck-fast' : 'fa-truck-ramp-box'}
                                    pillLabel={isOutbound ? 'Help sent' : 'Help returning'}
                                    plantCell={plantCell}
                                    primary={
                                        isOutbound ? (
                                            <>
                                                <b>{row.count}</b> truck{row.count === 1 ? '' : 's'} leaving{' '}
                                                <b>{row.fromPlant}</b>{' '}
                                                {forOrder ? (
                                                    <>
                                                        to load for <b>{jobTag}</b>
                                                        {customerTag ? ` · ${customerTag}` : ''} at <b>{row.toPlant}</b>
                                                        .
                                                    </>
                                                ) : (
                                                    <>
                                                        to back up <b>{row.toPlant}</b>.
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <b>{row.count}</b> help truck{row.count === 1 ? '' : 's'} heading{' '}
                                                {returnsHome ? 'home' : 'over'} to <b>{homePlant}</b>.
                                            </>
                                        )
                                    }
                                    secondary={
                                        isOutbound ? (
                                            <>
                                                {row.toPlant}&apos;s pool goes up by {row.count} until they return
                                                {returnsHome ? (
                                                    <>
                                                        {' '}
                                                        to <b>{row.fromPlant}</b>.
                                                    </>
                                                ) : (
                                                    <>
                                                        {' '}
                                                        — heading to <b>{homePlant}</b> afterward (not back to{' '}
                                                        {row.fromPlant}).
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            `${homePlant}'s pool goes up by ${row.count}.`
                                        )
                                    }
                                    time={row.time}
                                    tint={tint}
                                />
                            )
                        }
                        const o = row.order
                        const yardage = parseFloat(o.yardage) || 0
                        const trucks = parseFloat(o.truckCount) || 0
                        const loadSize = parseFloat(o.loadSize) || 0
                        const plantName = plantNameByCode?.[o.plantCode] || ''
                        const status = getOrderStatus(o.startTime)
                        const isCancelled = status?.kind === 'cancelled'
                        const isTest = status?.kind === 'test'
                        const isNonProduction = isCancelled || isTest
                        const rowKey = keyForOrder(o)
                        return (
                            <tr
                                key={`${o.plantCode}-${o.orderId || idx}`}
                                style={{
                                    borderTop: '1px solid var(--border-light)',
                                    background: isCancelled
                                        ? 'rgba(220, 38, 38, 0.05)'
                                        : isTest
                                          ? 'rgba(99, 102, 241, 0.05)'
                                          : undefined,
                                    opacity: isNonProduction ? 0.7 : 1
                                }}
                            >
                                <td
                                    className="px-3 py-2 font-mono font-bold whitespace-nowrap"
                                    style={{
                                        color: isCancelled ? 'var(--text-tertiary)' : 'var(--text-primary)',
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
                                        // Fallback: when dispatch didn't enter a city, borrow the
                                        // plant's city so the geocoder still lands in the right
                                        // area — and flag that it was inferred.
                                        const fallbackCity = city ? '' : plantCityByCode?.[o.plantCode] || ''
                                        const effectiveCity = city || fallbackCity
                                        const usingFallback = !city && !!fallbackCity
                                        const displayText = [address, effectiveCity]
                                            .filter(Boolean)
                                            .join(', ')
                                            .toUpperCase()
                                        const orderForMap = usingFallback ? { ...o, city: fallbackCity } : o
                                        const closerPlant = getCloserPlantForOrder?.(o)
                                        return (
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenLocation?.(orderForMap)}
                                                        className="text-left underline-offset-2 hover:underline cursor-pointer bg-transparent border-none p-0 truncate min-w-0 uppercase tracking-wide font-semibold"
                                                        style={{ color: 'var(--text-primary)', fontSize: 12 }}
                                                        title={`Open map for ${composeAddress(orderForMap)}`}
                                                    >
                                                        <i
                                                            className="fas fa-location-dot text-[10px] mr-1.5"
                                                            style={{ color: 'var(--text-tertiary)' }}
                                                        />
                                                        {displayText}
                                                    </button>
                                                    {usingFallback && (
                                                        <span
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
                                                            style={{
                                                                background: 'rgba(217, 119, 6, 0.15)',
                                                                color: '#b45309'
                                                            }}
                                                            title={`City wasn't entered by dispatch — we filled in "${fallbackCity}" from plant ${o.plantCode}. The actual delivery city could be different.`}
                                                        >
                                                            <i className="fas fa-circle-exclamation text-[9px]" />
                                                            City?
                                                        </span>
                                                    )}
                                                </div>
                                                {closerPlant && (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap self-start"
                                                        style={{
                                                            background: 'rgba(37, 99, 235, 0.12)',
                                                            color: '#1d4ed8'
                                                        }}
                                                        title={`Live drive time: ${closerPlant.minutes} min from plant ${closerPlant.plantCode}${closerPlant.plantName ? ` (${closerPlant.plantName})` : ''} vs ${closerPlant.assignedMinutes} min from assigned plant ${o.plantCode}. Saves ~${closerPlant.savings} min one-way.`}
                                                    >
                                                        <i className="fas fa-route text-[9px]" />
                                                        Closer to {closerPlant.plantCode} · −{closerPlant.savings}m
                                                    </span>
                                                )}
                                            </div>
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
                                {(() => {
                                    if (isNonProduction) {
                                        return (
                                            <td
                                                className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                —
                                            </td>
                                        )
                                    }
                                    const overrides = getTravelOverrides ? getTravelOverrides(o) : undefined
                                    const computed = getCalculatedTruckCount(o, overrides)
                                    const dispatchTrucks = parseFloat(o.truckCount) || 0
                                    const differsFromDispatch =
                                        computed != null && dispatchTrucks > 0 && computed !== dispatchTrucks
                                    const poolEntry = poolTimeline?.[rowKey]
                                    const poolAtStart = poolEntry?.poolAtDispatch
                                    const poolAfter = poolEntry?.poolAfterDispatch
                                    const poolAfterEffective = Number.isFinite(poolEntry?.poolAfterDispatchEffective)
                                        ? poolEntry.poolAfterDispatchEffective
                                        : poolAfter
                                    const helpInWindow = poolEntry?.inboundDuringPour || 0
                                    // Count help arriving during the pour window — it covers later
                                    // trips even if the first few are short.
                                    const overbooked = Number.isFinite(poolAfterEffective) && poolAfterEffective < 0
                                    // When an order is overbooked, recommend the earliest time the
                                    // plant will actually be able to cover the full pour — so the
                                    // dispatcher can pitch a specific "move to HH:MM" suggestion.
                                    let recommendedMoveTime = null
                                    if (overbooked && Number.isFinite(computed) && poolEntry) {
                                        const timeline = poolTimelinesByPlant?.[o.plantCode]
                                        const pourDuration = Math.max(
                                            0,
                                            (poolEntry.lastReturnMinutes ?? 0) - (poolEntry.dispatchMinutes ?? 0)
                                        )
                                        recommendedMoveTime = findNextViableStart(
                                            timeline,
                                            computed,
                                            (poolEntry.dispatchMinutes ?? 0) + 1,
                                            pourDuration
                                        )
                                    }
                                    const poolSource = poolSourceByCode?.[o.plantCode]
                                    // Estimate realistic timing for late orders — first truck
                                    // arrival, estimated completion, and delay in minutes.
                                    const timing =
                                        overbooked && poolEntry ? estimateOrderTiming(o, poolEntry, overrides) : null
                                    const isHovered = hoveredKey === rowKey
                                    return (
                                        <td
                                            className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                            style={{ color: 'var(--text-secondary)', position: 'relative' }}
                                            onMouseEnter={() => openHover(rowKey)}
                                            onMouseLeave={queueCloseHover}
                                        >
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span
                                                    className="inline-flex items-center gap-1 justify-end"
                                                    style={{
                                                        color: differsFromDispatch ? '#d97706' : 'var(--text-primary)',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {differsFromDispatch && (
                                                        <i className="fas fa-circle-info text-[10px]" />
                                                    )}
                                                    {computed != null ? computed : '—'}
                                                    {Number.isFinite(poolAfterEffective) &&
                                                        (() => {
                                                            // Three-color scale on the trailing pool value:
                                                            //   < 0   → red  (below demand, overbooked)
                                                            //   0–2   → amber (tight margin — 1–2 trucks left
                                                            //           is close to the edge, 0 is break-even)
                                                            //   ≥ 3   → green (comfortable headroom)
                                                            const pillColor =
                                                                poolAfterEffective < 0
                                                                    ? '#dc2626'
                                                                    : poolAfterEffective <= 2
                                                                      ? '#d97706'
                                                                      : '#16a34a'
                                                            return (
                                                                <span
                                                                    className="font-semibold"
                                                                    style={{ color: pillColor }}
                                                                    title={
                                                                        poolAfterEffective < 0
                                                                            ? `${-poolAfterEffective} truck${poolAfterEffective === -1 ? '' : 's'} short — pour runs below scheduled rate`
                                                                            : poolAfterEffective <= 2
                                                                              ? `Tight — only ${poolAfterEffective} truck${poolAfterEffective === 1 ? '' : 's'} left in the pool during this pour`
                                                                              : `${poolAfterEffective} trucks still free during this pour — comfortable margin`
                                                                    }
                                                                >
                                                                    /{poolAfterEffective}
                                                                </span>
                                                            )
                                                        })()}
                                                </span>
                                                {overbooked && (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                                                        style={{ background: '#d97706', color: '#fff' }}
                                                        title="Fewer trucks than needed to hold the scheduled pour rate — send help from another plant to pour on pace."
                                                    >
                                                        <i className="fas fa-handshake-angle text-[8px]" />
                                                        Needs Help
                                                    </span>
                                                )}
                                            </div>
                                            {isHovered && (
                                                <TruckCoverageHoverCard
                                                    accentColor={accentColor}
                                                    bigPour={isBigPourOrder(o)}
                                                    computed={computed}
                                                    customer={clean(o.customer)}
                                                    differsFromDispatch={differsFromDispatch}
                                                    dispatchTrucks={dispatchTrucks}
                                                    helpInWindow={helpInWindow}
                                                    liveTravel={!!overrides}
                                                    onMouseEnter={() => openHover(rowKey)}
                                                    onMouseLeave={queueCloseHover}
                                                    orderNum={o.orderNum}
                                                    overbooked={overbooked}
                                                    plantCode={o.plantCode}
                                                    poolAfter={poolAfter}
                                                    poolAfterEffective={poolAfterEffective}
                                                    poolAtStart={poolAtStart}
                                                    poolSource={poolSource}
                                                    recommendedMoveTime={recommendedMoveTime}
                                                    timing={timing}
                                                    yardage={yardage}
                                                />
                                            )}
                                        </td>
                                    )
                                })()}
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
                                    className="px-3 py-2 whitespace-nowrap font-mono"
                                    style={{ color: 'var(--text-secondary)' }}
                                    title={clean(o.phone) || undefined}
                                >
                                    {(() => {
                                        const phone = clean(o.phone)
                                        if (!phone) return '—'
                                        // Format 10-digit US phone as (XXX) XXX-XXXX for readability;
                                        // anything else falls back to the raw digits.
                                        const digits = phone.replace(/\D/g, '')
                                        if (digits.length === 10) {
                                            return (
                                                <a
                                                    href={`tel:${digits}`}
                                                    className="hover:underline"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    ({digits.slice(0, 3)}) {digits.slice(3, 6)}-{digits.slice(6)}
                                                </a>
                                            )
                                        }
                                        return phone
                                    })()}
                                </td>
                                <td
                                    className="px-3 py-2 whitespace-nowrap max-w-[180px] truncate"
                                    style={{ color: 'var(--text-secondary)' }}
                                    title={clean(o.contact) || undefined}
                                >
                                    {clean(o.contact) || '—'}
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
function PlanScheduleView({
    accentColor,
    adjacentProduction = {},
    assignments = [],
    isMobile = false,
    onSwitchToPlanner,
    planDate,
    plantAddressByCode,
    plantNameByCode,
    plantProduction,
    stats = []
}) {
    const poolDayMultiplier = getPoolDayMultiplier(planDate)
    const plantsClosed = isClosedDay(planDate)
    const isSaturday = poolDayMultiplier === 0.5
    /** Fallback city lookup: when an order's city is blank, we use the plant's
     *  city so the map/geocoder still lands near the right area. */
    const plantCityByCode = useMemo(() => {
        const out = {}
        Object.entries(plantAddressByCode || {}).forEach(([code, addr]) => {
            const city = extractCityFromFullAddress(addr)
            if (city) out[code] = city
        })
        return out
    }, [plantAddressByCode])

    const plantOptionsForMap = useMemo(() => {
        const codes = new Set([...Object.keys(plantAddressByCode || {}), ...Object.keys(plantNameByCode || {})])
        return Array.from(codes).map((code) => ({
            address: plantAddressByCode?.[code] || '',
            code,
            name: plantNameByCode?.[code] || ''
        }))
    }, [plantAddressByCode, plantNameByCode])

    const [query, setQuery] = useState('')
    const [plantFilter, setPlantFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [productFilter, setProductFilter] = useState('all')
    const [minYards, setMinYards] = useState('')
    const [sortKey, setSortKey] = useState('plantThenTime')
    /** When the schedule is filtered to a single plant we interleave synthetic
     *  rows (truck returns, help events, send-home recommendations, open-slot
     *  suggestions, trade-offs). Those rows only make sense chronologically,
     *  so turning them ON forces a time-based sort; turning them OFF lets the
     *  Sort by picker actually reorder the table. Default off so the sort
     *  controls work immediately — dispatchers opt-in to the extras. */
    const [showExtraRows, setShowExtraRows] = useState(false)
    // Mobile is always cards (the 12-column table needs hundreds of px to read).
    const [viewMode, setViewMode] = useState(isMobile ? 'cards' : 'table')
    const [mapOrder, setMapOrder] = useState(null)
    // Filter drawer is collapsed by default on mobile so the schedule fills the screen.
    const [filtersOpen, setFiltersOpen] = useState(!isMobile)
    /** Live Google travel times keyed by `plantCode::jobAddress`. Used to
     *  override the dispatch report's `toJobTime` when computing required
     *  trucks — the table reflects reality, not the report's estimate. */
    const [liveTravelByKey, setLiveTravelByKey] = useState({})

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

    /** Unique (plant → job) pairs that have addresses on both sides. Orders
     *  missing a city borrow the plant's city so the geocoder doesn't fail
     *  on an ambiguous street-only lookup.
     *
     *  Includes pairs for every plant in `plantOptionsForMap` so the address
     *  column can flag jobs that are closer to a non-assigned plant. The edge
     *  function caches by 15-min bucket, so the additional pairs hit the cache
     *  on every render after the first fetch wave. */
    const travelPairs = useMemo(() => {
        const seen = new Map()
        const candidatePlants = (plantOptionsForMap || []).filter((p) => p.address)
        for (const o of allOrders) {
            if (isLikelyBadAddress(clean(o.address))) continue
            const fallbackCity = clean(o.city) ? '' : plantCityByCode?.[o.plantCode] || ''
            const orderForGeocode = fallbackCity ? { ...o, city: fallbackCity } : o
            const jobAddr = composeAddress(orderForGeocode)
            if (!jobAddr) continue
            for (const p of candidatePlants) {
                const key = `${p.code}::${jobAddr}`
                if (!seen.has(key)) seen.set(key, { destination: jobAddr, key, origin: p.address })
            }
        }
        return Array.from(seen.values())
    }, [allOrders, plantCityByCode, plantOptionsForMap])

    /** Prefetch Google live travel for every unique pair. The edge function
     *  caches by 15-min departure bucket, so repeat calls hit the cache
     *  instead of the paid API. Runs in the background — helpers fall back
     *  to the dispatch report's travel estimate until results land. */
    useEffect(() => {
        if (!travelPairs.length) return undefined
        // Skip the whole prefetch once the service has latched unavailable —
        // otherwise the console fills with 503s every re-render.
        if (TrafficService.isUnavailable()) return undefined
        let cancelled = false
        // Only fetch keys we haven't tried yet (undefined). Keys that
        // previously failed are cached as `null`, so filter excludes them.
        const pending = travelPairs.filter((p) => liveTravelByKey[p.key] === undefined)
        if (!pending.length) return undefined
        Promise.allSettled(
            pending.map(async (pair) => {
                const result = await TrafficService.fetchDistance(pair.origin, pair.destination)
                if (cancelled) return { key: pair.key, minutes: null }
                if (!result || result.error) return { key: pair.key, minutes: null }
                const seconds = result.durationInTrafficSeconds ?? result.durationSeconds ?? null
                if (!Number.isFinite(seconds)) return { key: pair.key, minutes: null }
                return { key: pair.key, minutes: Math.max(1, Math.round(seconds / 60)) }
            })
        ).then((results) => {
            if (cancelled) return
            const next = {}
            for (const r of results) {
                if (r.status !== 'fulfilled' || !r.value) continue
                // Cache both successes and failures so we don't retry on
                // every re-render. `null` tells future renders "already
                // tried, no live data" and the UI falls back cleanly.
                next[r.value.key] = r.value.minutes
            }
            if (Object.keys(next).length > 0) {
                setLiveTravelByKey((prev) => ({ ...prev, ...next }))
            }
        })
        return () => {
            cancelled = true
        }
    }, [travelPairs, liveTravelByKey])

    /** Travel overrides for an order — pulls live Google minutes when we have
     *  them, otherwise falls back to letting the helper use the order's own
     *  `toJobTime` field from the dispatch report. */
    const getTravelOverrides = useCallback(
        (order) => {
            // Match the travel-pair key which uses the plant's city as a
            // fallback when dispatch didn't enter one on the order.
            const fallbackCity = clean(order.city) ? '' : plantCityByCode?.[order.plantCode] || ''
            const orderForKey = fallbackCity ? { ...order, city: fallbackCity } : order
            const key = `${order.plantCode}::${composeAddress(orderForKey)}`
            const mins = liveTravelByKey[key]
            if (!Number.isFinite(mins)) return undefined
            return { toJobMin: mins, toPlantMin: mins }
        },
        [liveTravelByKey, plantCityByCode]
    )

    /** Minimum savings (minutes) for a non-assigned plant to count as "closer"
     *  in the address column. Below this we don't surface it — the variance
     *  in live traffic estimates is enough that small savings aren't reliable. */
    const CLOSER_PLANT_MIN_SAVINGS = 5

    /** For each order, find a non-assigned plant whose live drive time to the
     *  job is shorter than the assigned plant's by at least
     *  `CLOSER_PLANT_MIN_SAVINGS`. Returns null when there's no such plant or
     *  we don't yet have enough live data to compare. Keyed by job address so
     *  every order at the same address shares the same lookup. */
    const closerPlantByJobAddr = useMemo(() => {
        const out = {}
        const byJob = new Map()
        for (const o of allOrders) {
            if (!o.plantCode) continue
            const fallbackCity = clean(o.city) ? '' : plantCityByCode?.[o.plantCode] || ''
            const orderForKey = fallbackCity ? { ...o, city: fallbackCity } : o
            const jobAddr = composeAddress(orderForKey)
            if (!jobAddr) continue
            if (!byJob.has(jobAddr)) byJob.set(jobAddr, new Set())
            byJob.get(jobAddr).add(o.plantCode)
        }
        for (const [jobAddr, assignedPlants] of byJob.entries()) {
            const candidatePlants = plantOptionsForMap || []
            let bestPlant = null
            let bestMinutes = Infinity
            for (const p of candidatePlants) {
                if (!p.address) continue
                const mins = liveTravelByKey[`${p.code}::${jobAddr}`]
                if (!Number.isFinite(mins)) continue
                if (mins < bestMinutes) {
                    bestMinutes = mins
                    bestPlant = p
                }
            }
            if (!bestPlant) continue
            // Compare against the best assigned plant for this job — if the
            // job is split between two assigned plants we don't want to flag
            // it as "closer to plant X" if X is already one of them.
            if (assignedPlants.has(bestPlant.code)) continue
            let assignedMin = Infinity
            for (const code of assignedPlants) {
                const mins = liveTravelByKey[`${code}::${jobAddr}`]
                if (Number.isFinite(mins) && mins < assignedMin) assignedMin = mins
            }
            if (!Number.isFinite(assignedMin)) continue
            const savings = assignedMin - bestMinutes
            if (savings < CLOSER_PLANT_MIN_SAVINGS) continue
            out[jobAddr] = {
                assignedMinutes: assignedMin,
                minutes: bestMinutes,
                plantCode: bestPlant.code,
                plantName: bestPlant.name,
                savings
            }
        }
        return out
    }, [allOrders, liveTravelByKey, plantCityByCode, plantOptionsForMap])

    const getCloserPlantForOrder = useCallback(
        (order) => {
            if (!order?.plantCode) return null
            const fallbackCity = clean(order.city) ? '' : plantCityByCode?.[order.plantCode] || ''
            const orderForKey = fallbackCity ? { ...order, city: fallbackCity } : order
            const jobAddr = composeAddress(orderForKey)
            if (!jobAddr) return null
            const closer = closerPlantByJobAddr[jobAddr]
            if (!closer) return null
            // Only flag for orders whose assigned plant is the slow one.
            if (closer.plantCode === order.plantCode) return null
            return closer
        },
        [closerPlantByJobAddr, plantCityByCode]
    )

    /** Canonical orderKey, mirroring what `computePlantPoolTimeline` builds. */
    const keyForOrder = useCallback((order) => {
        if (order.orderId) return order.orderId
        const mins = timeToMinutes(order?.startTime)
        return `${order.plantCode ?? 'unknown'}-${mins}-${order.orderNum ?? ''}`
    }, [])

    /** Per-plant pool breakdown — surfaced in the Trucks column tooltip so the
     *  dispatcher can see where a plant's starting number comes from.
     *  `starting` is still the effective count (base − send + recv) because
     *  that's what reads cleanly in the tooltip; actual pool timing is now
     *  driven by help-transfer events below. */
    const poolSourceByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const rawBase = Number.isFinite(s.base) ? s.base : 0
            const missing = getMissingOperators(plantProduction, s.code)
            const base = getEffectiveBase(rawBase, s.code, plantProduction, planDate)
            const send = Number.isFinite(s.send) ? s.send : 0
            const recv = Number.isFinite(s.recv) ? s.recv : 0
            out[s.code] = {
                base,
                missing,
                rawBase,
                recv,
                send,
                starting: base - send + recv
            }
        })
        return out
    }, [stats, plantProduction, planDate])

    /** Initial pool is the plant's base mixer count, adjusted for the plan
     *  date (Saturdays half crew, Sundays closed) AND any missing-operator
     *  shortfall the dispatcher has marked from the Planner plant overview.
     *  Planner help is applied as time-based events (below) so the pool
     *  still goes up/down at the actual transfer times. */
    const initialPoolByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const base = Number.isFinite(s.base) ? s.base : 0
            out[s.code] = getEffectiveBase(base, s.code, plantProduction, planDate)
        })
        return out
    }, [stats, plantProduction, planDate])

    /**
     * Time-based help transfers derived from Planner assignments.
     *  - `time` (arrival at destination): sender loses trucks, receiver gains.
     *  - `leaveTime` (trucks head back): receiver loses, sender regains.
     *
     * The pool must NOT be docked for help before it's sent or after it's
     * returned — so we only emit rows when arrival time is known, and only
     * pair a return when `leaveTime > arrivalTime` (otherwise the leave value
     * is nonsense and would deduct from the destination mid-work).
     */
    /** Per-driver help rows — grouped into 30-minute buckets per assignment +
     *  direction so a staggered crew arriving over an hour reads as two rows
     *  ("5 between 08:00–08:30, 5 between 08:30–09:00") rather than one row
     *  per driver. Return rows honor the assignment's `returnPlant` so trucks
     *  can be sent back to a different plant after pouring. */
    const helpRows = useMemo(() => {
        const HELP_BUCKET_MIN = 30
        const grouped = new Map()
        const bump = (key, seed, time) => {
            const existing = grouped.get(key)
            if (existing) {
                existing.count += 1
                existing.rangeEnd = Math.max(existing.rangeEnd, time)
                existing.rangeStart = Math.min(existing.rangeStart, time)
            } else {
                grouped.set(key, { ...seed, count: 1, rangeEnd: time, rangeStart: time })
            }
        }
        ;(assignments || []).forEach((a, idx) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const returnPlant = a.returnPlant || a.fromPlant
            // When the dispatcher tied this help to a specific destination
            // order, look it up so the row can read "loading for #610" +
            // customer instead of the generic "backing up 402".
            let forOrder = null
            if (a.forOrderId) {
                const destOrders = plantProduction?.[a.toPlant]?.orders || []
                forOrder = destOrders.find((o) => (o.orderId || o.orderNum) === a.forOrderId) || null
            }
            const driverTimes = buildAssignmentDriverTimes(a)
            driverTimes.forEach((dt) => {
                if (Number.isFinite(dt.arriveMin)) {
                    const bucket = Math.floor(dt.arriveMin / HELP_BUCKET_MIN) * HELP_BUCKET_MIN
                    bump(
                        `out-${idx}-${bucket}`,
                        {
                            assignmentIndex: idx,
                            direction: 'outbound',
                            forOrder,
                            forOrderId: a.forOrderId || '',
                            fromPlant: a.fromPlant,
                            returnPlant,
                            time: bucket,
                            toPlant: a.toPlant
                        },
                        dt.arriveMin
                    )
                }
                if (Number.isFinite(dt.leaveMin) && dt.leaveMin > dt.arriveMin) {
                    const bucket = Math.floor(dt.leaveMin / HELP_BUCKET_MIN) * HELP_BUCKET_MIN
                    bump(
                        `rt-${idx}-${bucket}`,
                        {
                            assignmentIndex: idx,
                            direction: 'return',
                            forOrder,
                            forOrderId: a.forOrderId || '',
                            fromPlant: a.fromPlant,
                            returnPlant,
                            time: bucket,
                            toPlant: a.toPlant
                        },
                        dt.leaveMin
                    )
                }
            })
        })
        return Array.from(grouped.values())
    }, [assignments, plantProduction])

    /** Help transfers in the format expected by `computePlantPoolTimeline`.
     *  Each driver's arrival subtracts from `fromPlant` and adds to `toPlant`;
     *  each driver's return subtracts from `toPlant` and adds to `returnPlant`
     *  (which defaults to `fromPlant` when not overridden). */
    const helpTransfers = useMemo(() => {
        const out = []
        helpRows.forEach((row) => {
            if (row.direction === 'outbound') {
                out.push({ delta: -row.count, plantCode: row.fromPlant, time: row.time })
                out.push({ delta: row.count, plantCode: row.toPlant, time: row.time })
            } else {
                const home = row.returnPlant || row.fromPlant
                out.push({ delta: -row.count, plantCode: row.toPlant, time: row.time })
                out.push({ delta: row.count, plantCode: home, time: row.time })
            }
        })
        return out
    }, [helpRows])

    /** Simulate the day — get poolAtDispatch + return times per order. */
    const poolTimeline = useMemo(
        () => computePlantPoolTimeline(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Per-plant pool timelines — used to recommend a better start time when
     *  an order is overbooked ("move this to 11:00 when the plant has trucks"). */
    const poolTimelinesByPlant = useMemo(
        () => computePlantPoolTimelines(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Moments throughout the day when operators can be sent home because the
     *  plant's pool has reached a level it never drops below again. Surfaced
     *  as dedicated "send home" rows in the schedule so the dispatcher knows
     *  exactly when to release operators. */
    const sendHomeRows = useMemo(
        () => computeSendHomeRows(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** One suggested slot per pour size (120+ / 50 / 10 yd) pointing the
     *  dispatcher to the earliest window where the plant has idle capacity
     *  for that job size — so they know where a new order would fit without
     *  disrupting the current plan. */
    const suggestedSlotRows = useMemo(
        () => computeSuggestedSlots(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Pull-up recommendations — later orders that could be moved earlier into
     *  surplus windows so the schedule compacts instead of trucks sitting idle. */
    const pullUpRows = useMemo(
        () => computePullUpRows(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Status counts (Scheduled / Same-day / Cancelled / Test) for the status filter. */
    const statusCounts = useMemo(() => {
        const out = { all: allOrders.length, cancelled: 0, sameDay: 0, scheduled: 0, test: 0 }
        allOrders.forEach((o) => {
            const kind = getOrderStatus(o.startTime)?.kind
            if (kind === 'cancelled') out.cancelled += 1
            else if (kind === 'sameDay') out.sameDay += 1
            else if (kind === 'test') out.test += 1
            else out.scheduled += 1
        })
        return out
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
                if (statusFilter !== 'all') {
                    const kind = getOrderStatus(o.startTime)?.kind || 'scheduled'
                    if (kind !== statusFilter) return false
                }
                if (productFilter !== 'all' && clean(o.productCode) !== productFilter) return false
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
    }, [allOrders, statusFilter, minYards, plantFilter, productFilter, query, sortKey])

    /* ── KPI numbers — non-production rows (cancelled at 17:00, test at 18:00)
       stay in the table for transparency but are excluded from yardage /
       truck totals. */
    const liveOrders = useMemo(
        () =>
            filtered.filter((o) => {
                const kind = getOrderStatus(o.startTime)?.kind
                return kind !== 'cancelled' && kind !== 'test'
            }),
        [filtered]
    )
    const totalYards = sumField(liveOrders, 'yardage')

    /** Sum real-pour yardage across a day's `plant_production` object,
     *  mirroring the liveOrders filter (excludes cancelled + test). */
    const sumDayYardage = (production) => {
        if (!production || typeof production !== 'object') return 0
        let sum = 0
        Object.entries(production).forEach(([code, prod]) => {
            if (code === PLAN_META_KEY) return
            const list = Array.isArray(prod?.orders) ? prod.orders : []
            list.forEach((o) => {
                if (isExcludedOrder(o)) return
                sum += parseFloat(o?.yardage) || 0
            })
        })
        return sum
    }

    /** Yesterday's yardage (for the day-over-day delta) + a rolling 7-day
     *  total (today + previous 6). Both fall back gracefully when the
     *  adjacent fetch hasn't hydrated yet. */
    const yesterdayYardage = useMemo(() => {
        if (!planDate) return 0
        const key = getOffsetDate(planDate, -1)
        return sumDayYardage(adjacentProduction?.[key])
    }, [adjacentProduction, planDate])

    const weekYardage = useMemo(() => {
        if (!planDate) return totalYards
        let sum = totalYards
        for (let i = 1; i <= 6; i++) {
            const key = getOffsetDate(planDate, -i)
            sum += sumDayYardage(adjacentProduction?.[key])
        }
        return sum
    }, [adjacentProduction, planDate, totalYards])

    /** Percent change vs yesterday. Null when yesterday has no data so the
     *  badge renders a neutral "—" instead of a misleading "+∞%". */
    const yardageDeltaPct = useMemo(() => {
        if (!(yesterdayYardage > 0)) return null
        const delta = totalYards - yesterdayYardage
        return Math.round((delta / yesterdayYardage) * 1000) / 10
    }, [totalYards, yesterdayYardage])
    // Sum our canonical per-order truck count (excludes cancelled). Falls back
    // to `truckCount` only when we can't compute — same rule as the table cell.
    const totalTrucks = liveOrders.reduce((sum, o) => {
        const n = getCalculatedTruckCount(o, getTravelOverrides ? getTravelOverrides(o) : undefined)
        return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
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

    const hasAnyOrders = allOrders.length > 0
    const hasActiveFilters =
        query ||
        plantFilter !== 'all' ||
        statusFilter !== 'all' ||
        productFilter !== 'all' ||
        (parseFloat(minYards) || 0) > 0

    const clearAllFilters = () => {
        setQuery('')
        setPlantFilter('all')
        setStatusFilter('all')
        setProductFilter('all')
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

    const activeFilterCount =
        (query ? 1 : 0) +
        (plantFilter !== 'all' ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (productFilter !== 'all' ? 1 : 0) +
        ((parseFloat(minYards) || 0) > 0 ? 1 : 0)

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-5 flex flex-col gap-3 sm:gap-4">
                {(plantsClosed || isSaturday) && (
                    <div
                        className="rounded-lg px-4 py-3 flex items-start gap-3"
                        style={{
                            background: plantsClosed ? 'rgba(220, 38, 38, 0.08)' : 'rgba(217, 119, 6, 0.08)',
                            border: `1px solid ${plantsClosed ? 'rgba(220, 38, 38, 0.35)' : 'rgba(217, 119, 6, 0.35)'}`
                        }}
                    >
                        <i
                            className={`fas ${plantsClosed ? 'fa-ban' : 'fa-calendar-day'} mt-0.5`}
                            style={{ color: plantsClosed ? '#dc2626' : '#d97706', fontSize: 14 }}
                        />
                        <div className="flex-1 min-w-0">
                            <div
                                className="text-[13px] font-bold"
                                style={{ color: plantsClosed ? '#991b1b' : '#92400e' }}
                            >
                                {plantsClosed ? 'Sunday — plants closed' : 'Saturday — half crew'}
                            </div>
                            <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                {plantsClosed
                                    ? 'All plants are assumed closed today. Truck-coverage math treats every plant pool as 0.'
                                    : 'Saturday crews run at half staffing. Every plant’s active mixer count is halved (rounded down) for the coverage math.'}
                            </div>
                        </div>
                    </div>
                )}
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                        <div
                            className="text-[18px] sm:text-[22px] font-bold leading-tight"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                        >
                            Schedule
                        </div>
                        <div className="text-[11.5px] sm:text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            {isMobile
                                ? `${filtered.length} of ${allOrders.length} orders`
                                : "Pulled from the Daily Order Listing import. Filter, sort, and scan every plant's orders on one page."}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isMobile && (
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
                        )}
                        {isMobile && hasAnyOrders && (
                            <button
                                type="button"
                                onClick={() => setFiltersOpen((v) => !v)}
                                className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                                style={{
                                    background:
                                        filtersOpen || activeFilterCount > 0 ? accentColor : 'var(--bg-secondary)',
                                    color: filtersOpen || activeFilterCount > 0 ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                <i className={`fas fa-filter text-[10px]`} />
                                Filters
                                {activeFilterCount > 0 && (
                                    <span
                                        className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                                        style={{
                                            background: 'rgba(255,255,255,0.3)',
                                            color: '#fff',
                                            minWidth: 18,
                                            height: 18,
                                            padding: '0 5px'
                                        }}
                                    >
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>
                        )}
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
                        {/* Stat strip — single condensed bar of inline metrics
                            separated by hairline dividers. Reads like a
                            newspaper masthead instead of a card grid: small
                            label, big number, optional inline badge / hint. */}
                        <div
                            className="rounded-xl flex flex-wrap"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-light)',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <Stat
                                first
                                hint={
                                    hasActiveFilters && filtered.length !== allOrders.length
                                        ? `of ${allOrders.length.toLocaleString()}`
                                        : 'on the day'
                                }
                                label="Orders"
                                value={filtered.length.toLocaleString()}
                            />
                            <Stat
                                hint={`${uniqueCustomers.toLocaleString()} customer${uniqueCustomers === 1 ? '' : 's'}`}
                                label="Plants"
                                value={uniquePlants.toLocaleString()}
                            />
                            <Stat
                                badge={
                                    yardageDeltaPct != null ? (
                                        <YardageDeltaBadge pct={yardageDeltaPct} yesterdayYardage={yesterdayYardage} />
                                    ) : null
                                }
                                hint={
                                    yardageDeltaPct != null
                                        ? `vs ${yesterdayYardage.toLocaleString()} yd yesterday`
                                        : 'cancelled excluded'
                                }
                                label="Yardage"
                                unit="yd"
                                value={totalYards.toLocaleString()}
                            />
                            <Stat hint="rolling 7 days" label="Week" unit="yd" value={weekYardage.toLocaleString()} />
                            <Stat hint="truck loads" label="Loads" value={totalTrucks.toLocaleString()} />
                            <Stat
                                hint={earliestTime && latestTime ? 'first → last start' : undefined}
                                label="Window"
                                value={earliestTime && latestTime ? `${earliestTime}–${latestTime}` : '—'}
                            />
                        </div>

                        {/* Filter bar — collapsible on mobile */}
                        {filtersOpen && (
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

                                <FilterField label="Status">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-light)',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        <option value="all">All · {statusCounts.all}</option>
                                        <option value="scheduled">Scheduled · {statusCounts.scheduled}</option>
                                        <option value="sameDay">Same-day · {statusCounts.sameDay}</option>
                                        <option value="cancelled">Cancelled · {statusCounts.cancelled}</option>
                                        <option value="test">Test · {statusCounts.test}</option>
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
                                    {plantFilter !== 'all' && (
                                        <label
                                            className="mt-1.5 flex items-center gap-2 text-[11.5px] cursor-pointer select-none"
                                            style={{ color: 'var(--text-secondary)' }}
                                            title="Toggle the return / help / send-home / open-slot rows that appear between order rows when a plant is selected."
                                        >
                                            <input
                                                type="checkbox"
                                                checked={showExtraRows}
                                                onChange={(e) => setShowExtraRows(e.target.checked)}
                                                className="cursor-pointer"
                                                style={{ accentColor }}
                                            />
                                            <span>
                                                Show extra rows{' '}
                                                <span style={{ color: 'var(--text-tertiary)' }}>
                                                    · returns, help, suggestions
                                                </span>
                                            </span>
                                        </label>
                                    )}
                                </FilterField>
                            </div>
                        )}

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
                        ) : viewMode === 'table' && !isMobile ? (
                            <ScheduleTable
                                accentColor={accentColor}
                                getCloserPlantForOrder={getCloserPlantForOrder}
                                getTravelOverrides={getTravelOverrides}
                                helpRows={helpRows}
                                filteredPlantCode={plantFilter !== 'all' ? plantFilter : null}
                                isPlantFiltered={plantFilter !== 'all'}
                                showExtraRows={showExtraRows}
                                keyForOrder={keyForOrder}
                                onOpenLocation={setMapOrder}
                                orders={filtered}
                                plantCityByCode={plantCityByCode}
                                plantNameByCode={plantNameByCode}
                                poolSourceByCode={poolSourceByCode}
                                poolTimeline={poolTimeline}
                                poolTimelinesByPlant={poolTimelinesByPlant}
                                pullUpRows={pullUpRows}
                                sendHomeRows={sendHomeRows}
                                suggestedSlotRows={suggestedSlotRows}
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {groupedByPlant.map(({ code, orders }) => (
                                    <div key={code} className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 px-1 text-[13px]">
                                            <button
                                                type="button"
                                                onClick={() => setPlantFilter((prev) => (prev === code ? 'all' : code))}
                                                className="border-none bg-transparent p-0 cursor-pointer"
                                                title={
                                                    plantFilter === code
                                                        ? 'Tap to clear plant filter'
                                                        : `Filter to plant ${code}`
                                                }
                                            >
                                                <PlantBadge
                                                    code={code}
                                                    fallback={accentColor}
                                                    name={plantNameByCode?.[code]}
                                                />
                                            </button>
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
                                                    closerPlant={getCloserPlantForOrder(o)}
                                                    onOpenLocation={setMapOrder}
                                                    onPickPlant={(c) =>
                                                        setPlantFilter((prev) => (prev === c ? 'all' : c))
                                                    }
                                                    onPickProduct={(p) =>
                                                        setProductFilter((prev) => (prev === p ? 'all' : p))
                                                    }
                                                    onPickStatus={(s) =>
                                                        setStatusFilter((prev) => (prev === s ? 'all' : s))
                                                    }
                                                    order={o}
                                                    plantCode={code}
                                                    plantName={plantNameByCode?.[code]}
                                                    travelOverrides={getTravelOverrides(o)}
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
                    plants={plantOptionsForMap}
                    travelMinutes={parseHhmmToMinutes(mapOrder?.toJobTime)}
                />
            )}
        </div>
    )
}

export default PlanScheduleView
