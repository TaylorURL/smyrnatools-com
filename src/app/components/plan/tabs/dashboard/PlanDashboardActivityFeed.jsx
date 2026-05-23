/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { PLAN_META_KEY, plantBadgeColor } from '../../../../../utils/PlanUtility'

const MAX_FEED_EVENTS = 30

/** Schedule-tab vocabulary so the feed reads as a vertical compaction of the
 *  schedule rows: monospace time anchor on the left, uppercase status pill
 *  next to it, PlantBadge inline, subtle row tint per event kind. */
const EVENT_TONE = {
    complete: {
        accent: '#15803d',
        bg: 'rgba(22, 163, 74, 0.14)',
        icon: 'fa-circle-check',
        label: 'Complete',
        rowTint: 'rgba(22, 163, 74, 0.05)'
    },
    load: {
        accent: '#1d4ed8',
        bg: 'rgba(37, 99, 235, 0.12)',
        icon: 'fa-truck-fast',
        label: 'Loaded',
        rowTint: 'rgba(37, 99, 235, 0.04)'
    }
}

const trim = (value) => (value == null ? '' : String(value).trim())

const formatLoadedTime = (raw) => {
    if (!raw) return ''
    const cleaned = String(raw).trim()
    // `loadedTime` from the dispatch service is "HH:MM:SS" — strip seconds to
    // match the schedule row's compact "HH:MM" formatting.
    const match = cleaned.match(/^(\d{1,2}):(\d{2})/)
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : cleaned
}

const formatYardage = (value) => {
    if (!Number.isFinite(value) || value <= 0) return ''
    return Math.round(value) === value ? `${value} yd` : `${value.toFixed(1)} yd`
}

/** Flat `orderId → { customer, plantCode, scheduledYardage, orderNum }` lookup
 *  so events can decorate themselves with order-level context that
 *  `detailByOrderId` itself doesn't carry. */
const buildOrderMeta = (plantProduction) => {
    const map = new Map()
    Object.entries(plantProduction || {}).forEach(([code, data]) => {
        if (code === PLAN_META_KEY) return
        if (!Array.isArray(data?.orders)) return
        data.orders.forEach((order) => {
            if (!order?.orderId) return
            map.set(order.orderId, {
                customer: trim(order.customer),
                orderNum: trim(order.orderNum),
                plantCode: code,
                scheduledYardage: parseFloat(order.yardage) || 0
            })
        })
    })
    return map
}

const buildEvents = (detailByOrderId, orderMetaByOrderId, plantNameByCode) => {
    const events = []
    Object.entries(detailByOrderId || {}).forEach(([orderId, detail]) => {
        const meta = orderMetaByOrderId.get(orderId)
        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
        const orderPlantCode = meta?.plantCode || ''
        tickets.forEach((ticket, idx) => {
            const ts = trim(ticket?.loadedTime)
            if (!ts) return
            const ticketKey = trim(ticket?.ticketId) || `${orderId}-${idx}`
            // "From" plant = where the truck physically loaded (ticket's loaded
            // plant). "For" plant = the order's assigned home plant. They
            // diverge whenever one plant covers another's order; both are
            // surfaced inline so the dispatcher sees cross-loading at a glance.
            const loadedPlantCode = trim(ticket?.plantId) || orderPlantCode
            events.push({
                customer: trim(ticket?.customer) || meta?.customer || '',
                driverName: trim(ticket?.driverName),
                forPlantCode: orderPlantCode,
                forPlantName: plantNameByCode?.[orderPlantCode] || '',
                fromPlantCode: loadedPlantCode,
                fromPlantName: plantNameByCode?.[loadedPlantCode] || '',
                key: `load-${ticketKey}`,
                kind: 'load',
                orderNum: meta?.orderNum || '',
                quantity: parseFloat(ticket?.quantity) || 0,
                truckNum: trim(ticket?.truckNum),
                ts
            })
        })
        const scheduled = meta?.scheduledYardage || 0
        const loaded = detail?.loadedYardage || 0
        if (scheduled > 0 && loaded >= scheduled && tickets.length > 0) {
            const lastTs = trim(tickets[tickets.length - 1]?.loadedTime)
            if (lastTs) {
                events.push({
                    customer: meta?.customer || '',
                    forPlantCode: orderPlantCode,
                    forPlantName: plantNameByCode?.[orderPlantCode] || '',
                    key: `done-${orderId}`,
                    kind: 'complete',
                    orderNum: meta?.orderNum || '',
                    // Suffix the timestamp so the completion event sorts above
                    // the matching final-load event in the descending feed.
                    ts: `${lastTs}z`,
                    yardage: scheduled
                })
            }
        }
    })
    events.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    return events.slice(0, MAX_FEED_EVENTS)
}

/** Compact variant of the Schedule tab's `PlantBadge`. Same colored pill +
 *  embedded code bubble vocabulary, dialled down for the 260px sidebar so the
 *  full plant name still has room to render without truncating aggressively.
 *
 *  Background is the saturated per-plant color from `plantBadgeColor`, so
 *  the text needs to stay WHITE in every theme — black-on-saturated would
 *  disappear in light mode. Uses the `force-white-text` opt-out class to
 *  beat the site-wide theme-aware badge rule. */
function PlantChip({ code, fallback = '#64748b', name }) {
    if (!code) return null
    const bg = plantBadgeColor(code, fallback)
    return (
        <span
            className="force-white-text inline-flex items-center gap-1 rounded-full pl-0.5 pr-1.5 py-0 font-semibold whitespace-nowrap min-w-0"
            style={{ background: bg }}
            title={name ? `${code} · ${name}` : code}
        >
            <span
                className="inline-flex items-center justify-center rounded-full font-bold bg-[rgba(255,255,255,0.22)] h-[16px] px-1"
                style={{ fontSize: 9.5, minWidth: 28 }}
            >
                {code}
            </span>
            {name && <span className="text-[10.5px] truncate">{name}</span>}
        </span>
    )
}

/** Status pill — same template as the Schedule row's `OrderStatusBadge` /
 *  `ServiceBadge`: `px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
 *  tracking-wider` with a tinted background + saturated foreground. */
function StatusPill({ tone, label, icon }) {
    return (
        <span
            className="force-white-text inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ background: tone.accent }}
        >
            <i className={`fas ${icon} text-[8px]`} />
            {label}
        </span>
    )
}

/**
 * One feed entry — vertical compaction of a Schedule row.
 *
 * Header row mirrors the schedule's leftmost columns: monospace time anchor +
 * uppercase status pill. Customer name reads as the primary content directly
 * below. Footer row carries the `PlantBadge` (with a cross-load arrow when the
 * "from" and "for" plants diverge) and a right-aligned yardage. Driver name
 * tucks under as tertiary text. `animate-slide-in-row` matches the schedule
 * table's per-row entry animation so new events feel like the schedule cells
 * they describe.
 */
function ActivityEvent({ event }) {
    const isComplete = event.kind === 'complete'
    const tone = isComplete ? EVENT_TONE.complete : EVENT_TONE.load
    const showFromFor =
        !isComplete && event.fromPlantCode && event.forPlantCode && event.fromPlantCode !== event.forPlantCode
    const yardageLabel = isComplete ? formatYardage(event.yardage) : formatYardage(event.quantity)
    const statusLabel = isComplete ? tone.label : event.truckNum ? `Truck ${event.truckNum}` : tone.label
    return (
        <li
            className="px-3 py-2 border-t border-border-light animate-slide-in-row first:border-t-0"
            style={{ background: tone.rowTint }}
        >
            <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold whitespace-nowrap shrink-0 text-text-primary">
                    {formatLoadedTime(event.ts)}
                </span>
                <StatusPill tone={tone} label={statusLabel} icon={tone.icon} />
            </div>
            <div className="mt-1 text-[12px] font-semibold truncate text-text-primary" title={event.customer}>
                {event.customer || '—'}
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {showFromFor ? (
                    <>
                        <PlantChip code={event.fromPlantCode} name={event.fromPlantName} />
                        <i className="fas fa-arrow-right text-[8px] text-text-tertiary" />
                        <PlantChip code={event.forPlantCode} name={event.forPlantName} />
                    </>
                ) : (
                    <PlantChip
                        code={event.forPlantCode || event.fromPlantCode}
                        name={event.forPlantName || event.fromPlantName}
                    />
                )}
                {yardageLabel && (
                    <span className="ml-auto text-[10.5px] font-mono font-bold tabular-nums whitespace-nowrap text-text-primary">
                        {yardageLabel}
                    </span>
                )}
            </div>
            {!isComplete && event.driverName && (
                <div className="mt-1 text-[10px] truncate text-text-tertiary" title={event.driverName}>
                    <i className="fas fa-user text-[8px] mr-1" />
                    {event.driverName}
                </div>
            )}
        </li>
    )
}

/**
 * Realtime activity feed for the Plan dashboard. Replaces the old static
 * scrollspy nav with a chronological stream of "truck loaded" + "job complete"
 * events derived from `detailByOrderId` (refreshed by `useDetailOrders` on
 * every dispatch update). Visual language is borrowed from the Schedule tab's
 * order rows so a dispatcher who recognises one surface immediately reads the
 * other — monospace time anchor, uppercase status pills, the same `PlantBadge`
 * coloring, subtle row tint per event kind, and the schedule's
 * `animate-slide-in-row` entry animation.
 */
export default function PlanDashboardActivityFeed({ detailByOrderId, plantNameByCode, plantProduction }) {
    const orderMetaByOrderId = useMemo(() => buildOrderMeta(plantProduction), [plantProduction])
    const events = useMemo(
        () => buildEvents(detailByOrderId, orderMetaByOrderId, plantNameByCode),
        [detailByOrderId, orderMetaByOrderId, plantNameByCode]
    )

    return (
        <aside
            className="hidden lg:flex flex-col sticky top-0 self-start py-5 pr-3 w-[260px]"
            style={{ maxHeight: '100vh' }}
        >
            <div className="flex items-center gap-2 mb-2 px-1">
                <i className="fas fa-bolt text-[11px] text-text-secondary" />
                <h3 className="text-[12px] font-bold uppercase tracking-wider m-0 text-text-primary">
                    Latest Activity
                </h3>
                <span className="ml-auto inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-text-primary">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-600" />
                    Live
                </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto rounded bg-bg-primary border border-border-light">
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center gap-2 px-3 py-8 text-text-tertiary">
                        <i className="fas fa-truck-fast text-[20px]" />
                        <div className="text-[11px]">
                            Waiting on the day’s first ticket — feed updates as trucks load and jobs complete.
                        </div>
                    </div>
                ) : (
                    <ul className="flex flex-col m-0 p-0 list-none">
                        {events.map((event) => (
                            <ActivityEvent key={event.key} event={event} />
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    )
}
