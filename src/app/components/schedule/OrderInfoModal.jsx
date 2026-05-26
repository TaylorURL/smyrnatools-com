/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { formatOrderAddress } from '../../../utils/AddressUtility'
import { isBigPourOrder, isCancelledOrder, plantBadgeColor, SAME_DAY_ORDER_START } from '../../../utils/PlanUtility'
import OrderCoverageView, { buildOrderFlags } from './OrderCoverageView'

const clean = (value) => (value == null ? '' : String(value).trim())
const cleanOrDash = (value) => clean(value) || '—'

const isSameDayOrder = (order) => {
    const t = String(order?.startTime || '').trim()
    return t ? t.padStart(5, '0') === SAME_DAY_ORDER_START : false
}

/** Compact label + value row. Quiet, document-style — no card chrome.
 *  Accepts either a primitive (string / number) or a React element — primitives
 *  are trimmed and skipped when empty; elements are rendered as-is so callers
 *  can pass things like a `<a href="tel:…">` link without it being stringified
 *  to "[object Object]". */
function Row({ label, mono, value, wide }) {
    if (value == null) return null
    const isPrimitive = typeof value === 'string' || typeof value === 'number'
    const text = isPrimitive ? String(value).trim() : ''
    if (isPrimitive && !text) return null
    return (
        <div className={`flex items-baseline gap-3 py-1 ${wide ? 'sm:col-span-2' : ''}`}>
            <span className="shrink-0 w-[110px] text-[11px] uppercase tracking-wider text-text-tertiary">{label}</span>
            <span
                className={`flex-1 min-w-0 text-[13px] leading-snug ${mono ? 'font-mono tabular-nums' : ''} text-text-primary`}
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                title={isPrimitive ? text : undefined}
            >
                {isPrimitive ? text : value}
            </span>
        </div>
    )
}

/** Plain section heading — no card, no icon, just an underline. */
function Heading({ children }) {
    return (
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary pb-1 mb-2 border-b border-border-light">
            {children}
        </div>
    )
}

/** Numbered flag entry — plain text, no border, no icon. Just "1. Title" + body. */
function FlagItem({ body, index, title }) {
    return (
        <div className="py-2.5 border-b border-border-light last:border-b-0">
            <div className="flex items-baseline gap-2">
                <span className="text-[12px] font-mono tabular-nums text-text-tertiary shrink-0">{index}.</span>
                <span className="text-[13px] font-semibold text-text-primary leading-snug">{title}</span>
            </div>
            {body && (
                <div
                    className="text-[12px] mt-1 ml-5 text-text-secondary leading-snug"
                    style={{ overflowWrap: 'anywhere' }}
                >
                    {body}
                </div>
            )}
        </div>
    )
}

/** Empty-state for the Coverage and Suggestions tabs. */
function EmptyState({ hint, title }) {
    return (
        <div className="py-10 px-4 text-center">
            <div className="text-[13px] font-semibold text-text-secondary">{title}</div>
            {hint && <div className="text-[12px] mt-1 text-text-tertiary max-w-md mx-auto leading-snug">{hint}</div>}
        </div>
    )
}

const TABS = [
    { id: 'details', label: 'Details' },
    { id: 'coverage', label: 'Coverage' },
    { id: 'flags', label: 'Flags' }
]

/**
 * View-order modal opened from the Schedule tab's right-click menu.
 *
 * Three tabs:
 *   Details — order identification, customer, job site, product, and schedule
 *             as a flat label/value list (no card chrome).
 *   Coverage — truck-coverage panel from the schedule's hover side-panel.
 *   Flags — operational suggestions (overbooked, closer plant, big-pour
 *           shortfall, dispatch mismatch). Header shows a count badge.
 *
 * Pass `inline` to render the same body without the modal backdrop / fixed
 * overlay — used by the Ticket Lookup page in the Statistics tab so the
 * lookup result reads as part of the page instead of a popup.
 */
function OrderInfoModal({
    accentColor = '#2563eb',
    closerPlant,
    coverage,
    inline = false,
    onClose,
    onOpenLocation,
    onViewTickets,
    order,
    plantName,
    ticketCount = null
}) {
    const [tab, setTab] = useState('details')

    useEffect(() => {
        if (inline) return undefined
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [inline, onClose])

    const homePlantCode = order?.plantCode || ''
    const customerLabel = clean(order?.customer)
    const yardage = parseFloat(order?.yardage) || 0
    const truckCount = parseFloat(order?.truckCount) || 0
    const formattedAddress = useMemo(() => formatOrderAddress(order, ', '), [order])
    const stateZip = useMemo(() => [clean(order?.state), clean(order?.zip)].filter(Boolean).join(' '), [order])

    const flags = useMemo(() => {
        const out = []
        if (isCancelledOrder(order)) out.push({ accent: '#dc2626', label: 'Cancelled' })
        if (isSameDayOrder(order)) out.push({ accent: '#d97706', label: 'Same-day' })
        if (isBigPourOrder(order)) out.push({ accent: '#4f46e5', label: 'Big pour' })
        if (coverage?.overbooked) out.push({ accent: '#dc2626', label: 'Overbooked' })
        if (closerPlant && closerPlant.savings >= 5) {
            out.push({ accent: '#1d4ed8', label: `Closer plant: ${closerPlant.code}` })
        }
        return out
    }, [order, coverage, closerPlant])

    const suggestions = useMemo(() => buildOrderFlags({ closerPlant, coverage, order }), [closerPlant, coverage, order])

    const plantColor = plantBadgeColor(homePlantCode, accentColor)
    const summaryLine = useMemo(() => {
        const parts = []
        if (yardage > 0) parts.push(`${yardage} yd³`)
        if (truckCount > 0) parts.push(`${truckCount} truck${truckCount === 1 ? '' : 's'}`)
        const start = clean(order?.startTime)
        if (start) parts.push(`${start} start`)
        const rate = clean(order?.rate)
        if (rate) parts.push(`every ${rate}`)
        return parts.join(' · ')
    }, [order, truckCount, yardage])

    if (!order) return null

    const card = (
        <div
            onClick={inline ? undefined : (e) => e.stopPropagation()}
            className="rounded-lg flex flex-col w-full overflow-hidden bg-bg-primary border border-border-light"
            style={
                inline
                    ? undefined
                    : {
                          boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                          maxHeight: '88vh',
                          maxWidth: 760
                      }
            }
        >
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border-light bg-bg-primary">
                <div
                    className="shrink-0 rounded px-2 py-1 text-[12px] font-bold tabular-nums text-white"
                    style={{ background: plantColor, minWidth: 42, textAlign: 'center' }}
                    title={plantName ? `Plant ${homePlantCode} — ${plantName}` : `Plant ${homePlantCode}`}
                >
                    {homePlantCode || '—'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-[15px] font-semibold text-text-primary truncate font-heading">
                            Order #{cleanOrDash(order?.orderNum)}
                        </span>
                        <span className="text-[12px] text-text-tertiary truncate">{customerLabel || '—'}</span>
                    </div>
                    {summaryLine && (
                        <div className="text-[11.5px] font-mono tabular-nums text-text-secondary truncate mt-0.5">
                            {summaryLine}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {onOpenLocation && (
                        <button
                            type="button"
                            onClick={() => onOpenLocation(order)}
                            className="text-[12px] px-2.5 py-1.5 rounded border border-border-light bg-transparent cursor-pointer text-text-secondary hover:text-text-primary hover:bg-bg-tertiary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                            title="Open route map"
                            aria-label="Open route map"
                        >
                            Map
                        </button>
                    )}
                    {onViewTickets && (
                        <button
                            type="button"
                            onClick={() => onViewTickets(order)}
                            className="text-[12px] px-2.5 py-1.5 rounded border border-border-light bg-transparent cursor-pointer text-text-secondary hover:text-text-primary hover:bg-bg-tertiary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                            title="View loaded tickets"
                            aria-label="View loaded tickets"
                        >
                            Tickets{ticketCount != null && ticketCount > 0 ? ` (${ticketCount})` : ''}
                        </button>
                    )}
                    {!inline && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-7 h-7 ml-1 rounded flex items-center justify-center bg-transparent border-0 cursor-pointer text-text-tertiary hover:text-text-primary hover:bg-bg-hover active:scale-[0.92] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                            aria-label="Close"
                            title="Close (Esc)"
                        >
                            <i className="fas fa-xmark text-[14px]" />
                        </button>
                    )}
                </div>
            </div>

            {flags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-5 py-2 border-b border-border-light bg-bg-secondary">
                    {flags.map((f) => (
                        <span
                            key={f.label}
                            className="text-[10.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: `${f.accent}14`, color: f.accent }}
                        >
                            {f.label}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-4 px-5 border-b border-border-light bg-bg-primary">
                {TABS.map((t) => {
                    const active = tab === t.id
                    const badge = t.id === 'flags' && suggestions.length > 0 ? suggestions.length : null
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className="relative bg-transparent border-0 cursor-pointer py-2.5 text-[12.5px] font-medium active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                            style={{
                                borderBottom: active ? `2px solid ${accentColor}` : '2px solid transparent',
                                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                marginBottom: -1
                            }}
                        >
                            {t.label}
                            {badge != null && (
                                <span
                                    className="ml-1.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                                    style={{
                                        background: active ? `${accentColor}22` : 'var(--bg-tertiary)',
                                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 overflow-auto px-5 py-4 bg-bg-primary">
                {tab === 'details' && (
                    <div className="flex flex-col gap-5">
                        <div>
                            <Heading>Job site</Heading>
                            <Row label="Address" value={formattedAddress} wide />
                            <Row label="City" value={order.city} />
                            <Row label="State / ZIP" mono value={stateZip} />
                        </div>

                        <div>
                            <Heading>Schedule</Heading>
                            <Row label="Start" mono value={order.startTime} />
                            <Row label="Spacing" mono value={order.rate} />
                            <Row label="To job" mono value={order.toJobTime} />
                            <Row label="To plant" mono value={order.toPlantTime} />
                        </div>

                        <div>
                            <Heading>Product</Heading>
                            <Row label="Code" mono value={order.productCode} />
                            <Row label="Description" value={order.description} wide />
                            <Row label="Load size" mono value={order.loadSize ? `${order.loadSize} yd` : ''} />
                        </div>

                        <div>
                            <Heading>Customer</Heading>
                            <Row label="Name" value={order.customer} wide />
                            <Row label="Customer #" mono value={order.customerNum} />
                            <Row label="Contact" value={order.contact} />
                            <Row
                                label="Phone"
                                mono
                                value={
                                    order.phone ? (
                                        <a
                                            className="text-inherit hover:underline"
                                            href={`tel:${String(order.phone).replace(/\D/g, '')}`}
                                        >
                                            {order.phone}
                                        </a>
                                    ) : null
                                }
                            />
                        </div>

                        <div>
                            <Heading>Identifiers</Heading>
                            <Row label="Order #" mono value={order.orderNum} />
                            <Row label="Order ID" mono value={order.orderId} />
                            <Row label="PO #" mono value={order.poNumber} />
                            <Row label="Job #" mono value={order.jobNumber} />
                        </div>
                    </div>
                )}

                {tab === 'coverage' &&
                    (coverage ? (
                        <OrderCoverageView coverage={coverage} />
                    ) : (
                        <EmptyState
                            title="No coverage data"
                            hint="Truck-coverage math runs only when the schedule is filtered to this order's plant. Filter to the plant on the Schedule tab and reopen this order."
                        />
                    ))}

                {tab === 'flags' &&
                    (suggestions.length === 0 ? (
                        <EmptyState
                            title="Nothing flagged"
                            hint="The order is on track based on the current plan — no closer plant, no overbooking, no big-pour shortfall."
                        />
                    ) : (
                        <div>
                            {suggestions.map((s, i) => (
                                <FlagItem key={i} index={i + 1} title={s.title} body={s.body} />
                            ))}
                        </div>
                    ))}
            </div>
        </div>
    )

    if (inline) return card

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.55)] z-[2147483000]"
        >
            {card}
        </div>
    )
}

export default OrderInfoModal
