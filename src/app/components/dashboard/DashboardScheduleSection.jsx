import React, { useMemo, useState } from 'react'

import { getCalculatedTruckCount, isBigPourOrder, plantBadgeColor } from '../../../utils/PlanUtility'
import { summarizeSchedule } from '../../hooks/useDashboardSchedule'
import JobMapModal from '../schedule/JobMapModal'
import TruckCoverageHoverCard from '../schedule/TruckCoverageHoverCard'
import { DashboardCard, SectionTitle } from '../ui/DashboardCards'

const clean = (value) => (value == null ? '' : String(value).trim())

/** Normalize dispatch start time into `HH:MM` form. */
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

const composeAddress = (order) =>
    [order?.address, order?.city]
        .map((s) => (s == null ? '' : String(s).trim()))
        .filter(Boolean)
        .join(', ')

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
    if (value.length < 5) return true
    if (!/\d/.test(value) && value.length < 12) return true
    return false
}

const ORDER_STATUS_BY_START = {
    '15:00': { color: '#d97706', icon: 'fa-bolt', kind: 'sameDay', label: 'Same-day' },
    '17:00': { color: '#dc2626', icon: 'fa-ban', kind: 'cancelled', label: 'Cancelled' },
    '18:00': { color: '#6366f1', icon: 'fa-flask', kind: 'test', label: 'Test' }
}
const getOrderStatus = (startTime) => {
    const v = clean(startTime)
    if (!v) return null
    return ORDER_STATUS_BY_START[v.padStart(5, '0')] || null
}

const formatClock12 = (hhmm) => {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return '--'
    const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
    const period = h >= 12 ? 'PM' : 'AM'
    const hr = h % 12 || 12
    return `${hr}:${String(m).padStart(2, '0')} ${period}`
}

const formatYards = (n) => {
    const val = Math.round(n || 0)
    if (val >= 10000) return `${(val / 1000).toFixed(1)}k`
    return val.toLocaleString()
}

const formatDateLabel = (dateStr) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10))
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', weekday: 'short' })
}

/** Compact stat block used in the schedule summary header. */
function ScheduleStat({ label, value, icon, tint }) {
    return (
        <div className="flex items-center gap-2.5 flex-1 min-w-[120px]">
            <div
                className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                style={{ background: `${tint}14`, color: tint }}
            >
                <i className={`fas ${icon} text-sm`} />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</div>
                <div className="text-lg font-bold text-text-primary leading-tight tabular-nums">{value}</div>
            </div>
        </div>
    )
}

/** Status pill matching PlanScheduleView's OrderStatusBadge. */
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

/** Plant badge matching PlanScheduleView's PlantBadge exactly. */
function PlantBadge({ code, fallback, name }) {
    const bg = plantBadgeColor(code, fallback)
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

const TABLE_HEADERS = [
    { key: 'start', label: 'Start' },
    { key: 'plant', label: 'Plant' },
    { key: 'order', label: 'Order' },
    { key: 'customer', label: 'Customer' },
    { key: 'location', label: 'Location' },
    { key: 'product', label: 'Product' },
    { key: 'yards', align: 'right', label: 'Yards' },
    { key: 'load', align: 'right', label: 'Load' },
    { key: 'trucks', align: 'right', label: 'Trucks' },
    { key: 'contact', label: 'Contact' },
    { key: 'dispatcher', label: 'Dispatcher' }
]

/**
 * Dashboard schedule table — mirrors the desktop table design from the
 * PlanView schedule tab (same columns, same cell treatments, same sticky
 * header). Travel / Spacing columns are omitted because they require the
 * full planner's pool-timeline math, which isn't available in a dashboard
 * preview context.
 */
function ScheduleTable({ orders, accentColor, plantNameByCode, plantCityByCode, plantAddressByCode, onOpenLocation }) {
    return (
        <div
            className="rounded-xl overflow-auto"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                maxHeight: 'calc(100vh - 320px)'
            }}
        >
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {TABLE_HEADERS.map((h) => (
                            <th
                                key={h.key}
                                className={`px-3 py-2 font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap ${
                                    h.align === 'right' ? 'text-right' : 'text-left'
                                }`}
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
                                {h.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {orders.map((o, idx) => (
                        <ScheduleTableRow
                            key={o.orderId || `${o.plantCode}-${idx}`}
                            accentColor={accentColor}
                            order={o}
                            plantName={plantNameByCode.get(o.plantCode) || ''}
                            plantCity={plantCityByCode?.[o.plantCode] || ''}
                            plantAddress={plantAddressByCode?.[o.plantCode] || ''}
                            onOpenLocation={onOpenLocation}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/** Parse an `HH:MM` duration string (dispatch report) into minutes. */
const parseHhmmToMinutes = (value) => {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hours = parseInt(m[1], 10)
    const mins = parseInt(m[2], 10)
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
    return hours * 60 + mins
}

function ScheduleTableRow({ order: o, accentColor, plantName, plantCity, plantAddress, onOpenLocation }) {
    const status = getOrderStatus(o.startTime)
    const isCancelled = status?.kind === 'cancelled'
    const isTest = status?.kind === 'test'
    const isNonProduction = isCancelled || isTest
    const yardage = parseFloat(o.yardage) || 0
    const loadSize = parseFloat(o.loadSize) || 0
    const dispatchTrucks = parseFloat(o.truckCount) || 0
    const computedTrucks = isNonProduction ? null : getCalculatedTruckCount(o)
    const differsFromDispatch = computedTrucks != null && dispatchTrucks > 0 && computedTrucks !== dispatchTrucks
    const address = clean(o.address)
    const city = clean(o.city)
    const [truckHoverOpen, setTruckHoverOpen] = useState(false)

    return (
        <tr
            className="transition-colors hover:brightness-[0.97]"
            style={{
                background: isCancelled ? 'rgba(220, 38, 38, 0.05)' : isTest ? 'rgba(99, 102, 241, 0.05)' : undefined,
                borderBottom: '1px solid var(--border-light)',
                opacity: isNonProduction ? 0.7 : 1
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
            <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: 'var(--text-primary)' }}>
                {o.orderNum ? `#${o.orderNum}` : '—'}
            </td>
            <td className="px-3 py-2 max-w-[260px]" style={{ color: 'var(--text-primary)' }} title={clean(o.customer)}>
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className="font-semibold truncate"
                        style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}
                    >
                        {clean(o.customer) || '—'}
                    </span>
                    {status && <OrderStatusBadge status={status} />}
                </div>
            </td>
            <td className="px-3 py-2 max-w-[280px]">
                {!address && !city ? (
                    <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                ) : isLikelyBadAddress(address) ? (
                    <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ background: '#dc2626', color: '#fff' }}
                        title={`Address looks invalid — original value: "${address}"${city ? ` · City: ${city}` : ''}`}
                    >
                        <i className="fas fa-triangle-exclamation text-[9px]" />
                        Bad Address
                    </span>
                ) : (
                    (() => {
                        const fallbackCity = city ? '' : plantCity || ''
                        const effectiveCity = city || fallbackCity
                        const usingFallback = !city && !!fallbackCity
                        const displayText = [address, effectiveCity].filter(Boolean).join(', ').toUpperCase()
                        return (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => onOpenLocation?.(usingFallback ? { ...o, city: fallbackCity } : o)}
                                    className="truncate min-w-0 uppercase tracking-wide font-semibold text-left underline-offset-2 hover:underline cursor-pointer bg-transparent border-none p-0"
                                    style={{ color: accentColor, fontSize: 12 }}
                                    title={`Open map for ${composeAddress(o) || displayText}`}
                                >
                                    <i className="fas fa-location-dot text-[10px] mr-1.5 opacity-70" />
                                    {displayText}
                                </button>
                                {usingFallback && (
                                    <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
                                        style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#b45309' }}
                                        title={`City wasn't entered by dispatch — we filled in "${fallbackCity}" from plant ${o.plantCode}.`}
                                    >
                                        <i className="fas fa-circle-exclamation text-[9px]" />
                                        City?
                                    </span>
                                )}
                            </div>
                        )
                    })()
                )}
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
            <td className="px-3 py-2 font-mono text-right whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {loadSize > 0 ? loadSize : '—'}
            </td>
            <td
                className="px-3 py-2 font-mono text-right whitespace-nowrap"
                style={{ color: 'var(--text-secondary)', position: 'relative' }}
                onMouseEnter={() => !isNonProduction && setTruckHoverOpen(true)}
                onMouseLeave={() => setTruckHoverOpen(false)}
            >
                <span
                    className="inline-flex items-center gap-1 justify-end"
                    style={{
                        color: isNonProduction
                            ? 'var(--text-tertiary)'
                            : differsFromDispatch
                              ? '#d97706'
                              : 'var(--text-primary)',
                        fontWeight: 600
                    }}
                >
                    {differsFromDispatch && <i className="fas fa-circle-info text-[10px]" />}
                    {isNonProduction ? '—' : computedTrucks != null ? computedTrucks : '—'}
                </span>
                {truckHoverOpen && !isNonProduction && (
                    <TruckCoverageHoverCard
                        accentColor={accentColor}
                        bigPour={isBigPourOrder(o)}
                        computed={computedTrucks}
                        customer={clean(o.customer)}
                        differsFromDispatch={differsFromDispatch}
                        dispatchTrucks={dispatchTrucks}
                        helpInWindow={0}
                        liveTravel={false}
                        onMouseEnter={() => setTruckHoverOpen(true)}
                        onMouseLeave={() => setTruckHoverOpen(false)}
                        orderNum={o.orderNum}
                        overbooked={false}
                        plantCode={o.plantCode}
                        poolAfter={undefined}
                        poolAfterEffective={undefined}
                        poolAtStart={undefined}
                        poolSource={undefined}
                        recommendedMoveTime={null}
                        timing={null}
                        yardage={yardage}
                    />
                )}
            </td>
            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {clean(o.phone) || '—'}
            </td>
            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {clean(o.contact) || '—'}
            </td>
        </tr>
    )
}

/**
 * Today's dispatch schedule preview — table layout matching the schedule
 * tab on PlanView. Scopes automatically by the active plant/region filter.
 */
export default function DashboardScheduleSection({
    production,
    isSyncing,
    lastSyncedAt,
    hasSchedule,
    scheduleDate,
    dashboardPlant,
    regionPlants,
    allPlants,
    isPlantMode,
    accentColor
}) {
    const plantCodes = useMemo(() => {
        if (isPlantMode && dashboardPlant) return new Set([dashboardPlant])
        if (regionPlants?.length) return new Set(regionPlants.map((p) => p.plantCode))
        return null
    }, [dashboardPlant, isPlantMode, regionPlants])

    const plantNameByCode = useMemo(() => {
        const map = new Map()
        ;(allPlants || []).forEach((p) => map.set(p.plantCode, p.plantName || ''))
        ;(regionPlants || []).forEach((p) => map.set(p.plantCode, p.plantName || map.get(p.plantCode) || ''))
        return map
    }, [allPlants, regionPlants])

    const plantCityByCode = useMemo(() => {
        const map = {}
        ;(allPlants || []).forEach((p) => {
            const parts = String(p.plantAddress || '')
                .split(',')
                .map((s) => s.trim())
            if (parts.length >= 2)
                map[p.plantCode] = parts[1].replace(/\s+[A-Za-z]{2}(\s+\d{5}(-\d{4})?)?\s*$/i, '').trim()
        })
        return map
    }, [allPlants])

    const plantAddressByCode = useMemo(() => {
        const map = {}
        ;(allPlants || []).forEach((p) => {
            if (p.plantAddress) map[p.plantCode] = p.plantAddress
        })
        return map
    }, [allPlants])

    const [mapOrder, setMapOrder] = useState(null)

    const summary = useMemo(() => summarizeSchedule(production, plantCodes), [production, plantCodes])

    // Sort by plant then start time — same default as PlanScheduleView.
    const sortedOrders = useMemo(() => {
        const arr = [...summary.orders]
        arr.sort((a, b) => {
            const plantCmp = String(a.plantCode || '').localeCompare(String(b.plantCode || ''))
            if (plantCmp !== 0) return plantCmp
            return String(a.startTime || '').localeCompare(String(b.startTime || ''))
        })
        return arr
    }, [summary.orders])

    const modeLabel = isPlantMode
        ? `Plant ${dashboardPlant}`
        : regionPlants?.length
          ? `${summary.plantsWithOrders}/${regionPlants.length} plants running`
          : `${summary.plantsWithOrders} plants running`

    const subtitle = `${formatDateLabel(scheduleDate)} · ${modeLabel}`

    const action = (
        <div className="flex items-center gap-2">
            {isSyncing ? (
                <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full px-2.5 py-1 border"
                    style={{
                        background: `${accentColor}14`,
                        borderColor: `${accentColor}30`,
                        color: accentColor
                    }}
                >
                    <i className="fas fa-sync-alt fa-spin text-[9px]" />
                    Syncing
                </span>
            ) : (
                hasSchedule && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full px-2.5 py-1 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <i className="fas fa-circle text-[6px]" />
                        Live
                    </span>
                )
            )}
        </div>
    )

    return (
        <DashboardCard accent={accentColor} className="flex flex-col">
            <SectionTitle icon="fa-calendar-day" accentColor={accentColor} subtitle={subtitle} action={action}>
                Today&apos;s Schedule
            </SectionTitle>

            {!hasSchedule ? (
                <ScheduleEmptyState isSyncing={isSyncing} />
            ) : summary.totalOrders === 0 ? (
                <ScheduleEmptyState isSyncing={isSyncing} message="No orders scheduled for today in this scope." />
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 rounded-xl bg-bg-tertiary border border-border-light">
                        <ScheduleStat
                            icon="fa-cube"
                            label="Total Yards"
                            tint={accentColor}
                            value={formatYards(summary.totalYards)}
                        />
                        <ScheduleStat
                            icon="fa-clipboard-list"
                            label="Orders"
                            tint="#0ea5e9"
                            value={summary.totalOrders}
                        />
                        <ScheduleStat
                            icon="fa-sun"
                            label="First Ticket"
                            tint="#f59e0b"
                            value={formatClock12(summary.firstTicket)}
                        />
                        <ScheduleStat
                            icon="fa-moon"
                            label="Last Ticket"
                            tint="#6366f1"
                            value={formatClock12(summary.lastTicket)}
                        />
                    </div>

                    <ScheduleTable
                        orders={sortedOrders}
                        accentColor={accentColor}
                        plantNameByCode={plantNameByCode}
                        plantCityByCode={plantCityByCode}
                        plantAddressByCode={plantAddressByCode}
                        onOpenLocation={setMapOrder}
                    />

                    {lastSyncedAt && (
                        <div className="mt-3 text-[10px] text-text-secondary text-right">
                            Last synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </>
            )}
            {mapOrder && (
                <JobMapModal
                    accentColor={accentColor}
                    onClose={() => setMapOrder(null)}
                    order={mapOrder}
                    plantAddress={plantAddressByCode?.[mapOrder?.plantCode] || ''}
                    plantCode={mapOrder?.plantCode}
                    plantName={plantNameByCode?.get(mapOrder?.plantCode) || ''}
                    travelMinutes={parseHhmmToMinutes(mapOrder?.toJobTime)}
                />
            )}
        </DashboardCard>
    )
}

function ScheduleEmptyState({ isSyncing, message }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl bg-bg-tertiary border border-dashed border-border-light">
            <i
                className={`fas ${isSyncing ? 'fa-sync-alt fa-spin' : 'fa-calendar-xmark'} text-2xl text-text-secondary mb-3`}
            />
            <p className="text-sm font-semibold text-text-primary m-0 mb-1">
                {isSyncing ? 'Loading schedule…' : 'No schedule uploaded yet'}
            </p>
            <p className="text-xs text-text-secondary m-0 max-w-[340px]">
                {message ||
                    "The dispatch bucket hasn't received today's Daily Order Listing. It will appear here automatically."}
            </p>
        </div>
    )
}
