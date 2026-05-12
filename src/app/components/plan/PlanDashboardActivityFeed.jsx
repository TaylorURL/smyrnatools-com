import React, { useMemo } from 'react'

import { PLAN_META_KEY } from '../../../utils/PlanUtility'

const MAX_FEED_EVENTS = 30

const trim = (v) => (v == null ? '' : String(v).trim())

const formatLoadedTime = (raw) => {
    if (!raw) return ''
    const cleaned = String(raw).trim()
    // `loadedTime` from the dispatch service is "HH:MM:SS" — strip seconds
    // for the at-a-glance feed; the ticket modal still shows full precision.
    const match = cleaned.match(/^(\d{1,2}):(\d{2})/)
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : cleaned
}

/** Build a flat `orderId → { customer, plantCode, scheduledYardage, orderNum }`
 *  lookup so the feed can attach customer / plant / scheduled-yardage context
 *  to each ticket — `detailByOrderId` itself only carries ticket rows. */
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
            // plant). "For" plant = the order's assigned home plant from the
            // schedule. They diverge when one plant covers another's order, so
            // we surface both whenever they differ.
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
                    // Suffix the timestamp so the completion event sorts ABOVE
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

/** Plant code chip — compact monospace label that mirrors the rest of the
 *  Plan tab's plant-code styling. The optional `tag` slot prefixes a tiny
 *  uppercase qualifier ("from" / "for") so the dispatcher can see at a
 *  glance which plant loaded the truck and which order's plant it serves. */
function PlantChip({ code, name, tag, tone }) {
    if (!code) return null
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap"
            style={{
                background: `${tone}1f`,
                boxShadow: `inset 0 0 0 1px ${tone}55`,
                color: tone
            }}
            title={name ? `${code} · ${name}` : code}
        >
            {tag && <span className="uppercase tracking-wider opacity-70 text-[8.5px]">{tag}</span>}
            <span className="font-mono tabular-nums">{code}</span>
        </span>
    )
}

/** Single feed entry. `animate-fade-slide-in` runs once on mount, so newly
 *  appearing tickets fade-in from above while existing rows stay still
 *  (React reuses their DOM via stable `key`). */
function ActivityEvent({ event }) {
    const isComplete = event.kind === 'complete'
    const tone = isComplete ? '#16a34a' : '#2563eb'
    const icon = isComplete ? 'fa-circle-check' : 'fa-truck-fast'
    const headline = isComplete ? 'Job complete' : event.truckNum ? `Truck ${event.truckNum} loaded` : 'Truck loaded'
    // Plant attribution: completion events only have a "for" plant. Load
    // events show "from" + "for" when they diverge (a plant covering another
    // plant's order); when they match we only render the single chip to
    // avoid noise.
    const showFromFor =
        !isComplete && event.fromPlantCode && event.forPlantCode && event.fromPlantCode !== event.forPlantCode
    return (
        <li className="px-3 py-2 flex items-start gap-2 animate-fade-slide-in border-b border-border-light">
            <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{
                    background: `${tone}1f`,
                    boxShadow: `inset 0 0 0 1px ${tone}55`,
                    color: tone
                }}
            >
                <i className={`fas ${icon} text-[10px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-semibold truncate text-text-primary">{headline}</div>
                {event.customer && <div className="text-[10.5px] truncate text-text-secondary">{event.customer}</div>}
                <div className="mt-1 flex items-center flex-wrap gap-1">
                    {showFromFor ? (
                        <>
                            <PlantChip code={event.fromPlantCode} name={event.fromPlantName} tag="from" tone={tone} />
                            <i className="fas fa-arrow-right text-[8px] text-text-tertiary" />
                            <PlantChip code={event.forPlantCode} name={event.forPlantName} tag="for" tone="#64748b" />
                        </>
                    ) : (
                        <PlantChip
                            code={event.forPlantCode || event.fromPlantCode}
                            name={event.forPlantName || event.fromPlantName}
                            tone={tone}
                        />
                    )}
                </div>
                <div className="text-[10px] mt-1 flex items-center gap-1.5 text-text-tertiary">
                    {isComplete && event.yardage > 0 && <span>{event.yardage.toLocaleString()} yd</span>}
                    {!isComplete && event.quantity > 0 && <span>{event.quantity.toFixed(1)} yd</span>}
                    {!isComplete && event.driverName && <span className="truncate">· {event.driverName}</span>}
                </div>
            </div>
            <span className="text-[10px] font-mono shrink-0 mt-0.5 text-text-tertiary">
                {formatLoadedTime(event.ts)}
            </span>
        </li>
    )
}

/**
 * Realtime activity feed for the Plan dashboard. Replaces the static
 * scrollspy nav with a chronological stream of "truck loaded" + "job
 * complete" events derived from `detailByOrderId` (which `useDetailOrders`
 * polls and refreshes on dispatch updates). New events fade-slide in on
 * mount so the feed feels live without re-animating older rows.
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
                <span className="ml-auto inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-green-600">
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
