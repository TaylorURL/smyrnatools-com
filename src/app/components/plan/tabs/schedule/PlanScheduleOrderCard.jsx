/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { formatOrderAddress } from '../../../../../utils/AddressUtility'
import {
    clean,
    evaluateHoursLimit,
    formatHhmm,
    getOrderStatus,
    isLikelyBadAddress
} from '../../../../../utils/PlanScheduleUtility'
import { getCalculatedTruckCount } from '../../../../../utils/PlanUtility'
import Badge from '../../../common/Badge'
import PhoneLink from '../../../common/PhoneLink'
import { BigPourBadge, HoursLimitBadge, KeyValue, OrderStatusBadge, ServiceBadge } from './PlanScheduleBadges'

const composeAddress = (order) => formatOrderAddress(order, ', ')

/* State accent colors driving the left stripe + the compact mobile status
 * line. Resolved from the order's `service` verdict (the same
 * `evaluateOrderService` output the table view uses) and the start-time
 * sentinel status. The stripe is the dispatcher's at-a-glance signal for
 * "is this job done, in-progress, late, or upcoming" — without it, on
 * mobile you had to read multiple small badges to figure that out. */
const STATE_ACCENTS = {
    cancelled: { bg: 'rgba(220, 38, 38, 0.10)', icon: 'fa-ban', label: 'Cancelled', stripe: '#dc2626' },
    completed: { bg: 'rgba(22, 163, 74, 0.10)', icon: 'fa-circle-check', label: 'Completed', stripe: '#16a34a' },
    issues: { bg: 'rgba(220, 38, 38, 0.10)', icon: 'fa-circle-exclamation', label: 'Completed · issues', stripe: '#dc2626' },
    idle: { bg: null, icon: null, label: null, stripe: 'transparent' },
    late: { bg: 'rgba(220, 38, 38, 0.10)', icon: 'fa-triangle-exclamation', label: 'Late', stripe: '#dc2626' },
    ongoing: { bg: 'rgba(2, 132, 199, 0.10)', icon: 'fa-truck-fast', label: 'Pouring', stripe: '#0284c7' },
    pending: { bg: 'rgba(217, 119, 6, 0.10)', icon: 'fa-hourglass-half', label: 'Awaiting truck', stripe: '#d97706' },
    test: { bg: 'rgba(99, 102, 241, 0.10)', icon: 'fa-flask', label: 'Test', stripe: '#6366f1' }
}

/** Resolve the dominant state for a card from its dispatch status + service
 *  verdict. Cancelled/test win over service state (the order isn't really
 *  running), then completion wins over in-progress wins over upcoming. */
function resolveCardState(status, service) {
    if (status?.kind === 'cancelled') return 'cancelled'
    if (status?.kind === 'test') return 'test'
    const svc = service?.status
    if (svc === 'good') return 'completed'
    if (svc === 'bad') return 'issues'
    if (svc === 'ongoing') return 'ongoing'
    if (svc === 'pending') return service.isLate ? 'late' : 'pending'
    return 'idle'
}

/** Compact, color-coded status line shown on mobile only — replaces the
 *  badge swarm at the top of the card with a single dispatcher-friendly
 *  "done / in-progress / late / upcoming" pill. */
function MobileStatusLine({ accent, label, status, service }) {
    if (!accent.label && !status) return null
    const detail = (() => {
        if (status?.kind === 'cancelled' || status?.kind === 'test') return null
        if (service?.status === 'good' || service?.status === 'bad') {
            if (service.ticketsLoaded != null && service.expectedTrucks) {
                return `${service.ticketsLoaded}/${service.expectedTrucks} loaded`
            }
            return null
        }
        if (service?.status === 'ongoing') {
            return service.ticketsLoaded != null && service.expectedTrucks
                ? `${service.ticketsLoaded}/${service.expectedTrucks} loaded`
                : null
        }
        if (service?.status === 'pending') {
            if (service.isLate && Number.isFinite(service.startLateness)) return `${service.startLateness}m late`
            return null
        }
        return null
    })()
    return (
        <div
            className="md:hidden -mx-2.5 mt-1.5 rounded-md px-2.5 py-1.5 flex items-center gap-2"
            style={{ background: accent.bg || 'transparent' }}
        >
            <i className={`fas ${accent.icon} text-[11px]`} style={{ color: accent.stripe }} aria-hidden="true" />
            <span className="text-[12px] font-bold" style={{ color: accent.stripe }}>
                {label}
            </span>
            {detail && (
                <span className="text-[11.5px] font-semibold text-text-secondary truncate">
                    · {detail}
                </span>
            )}
        </div>
    )
}

/**
 * Card-mode rendering for a single dispatch order. Replaces the table row when
 * the dispatcher selects "Cards" view (always on mobile). Shares its tooltip
 * + badge primitives with the table view so the two surfaces stay aligned.
 *
 * Mobile (below md): a tight 4-row layout — start+customer+yardage on one
 * line, plant/order/product meta on the next, a prominent color-coded
 * completion status line, and a compact action row. Detail fields (PO,
 * Job, Contact, Dispatcher, etc.) are not shown on mobile — tapping the
 * card opens the full detail modal. Desktop keeps the original rich card.
 */
export default function PlanScheduleOrderCard({
    accentColor,
    closerPlant,
    firstLoadOutMin,
    isToday = false,
    onOpenLocation,
    onPickPlant,
    onPickProduct,
    onPickStatus,
    onViewOrder,
    onViewTickets,
    order,
    plantCode,
    plantName,
    service,
    travelOverrides
}) {
    const yardage = parseFloat(order.yardage) || 0
    const loadSize = parseFloat(order.loadSize) || 0
    const start = formatHhmm(order.startTime)
    const status = getOrderStatus(order.startTime, { isToday })
    const isCancelled = status?.kind === 'cancelled'
    const isTest = status?.kind === 'test'
    const isSameDay = status?.kind === 'sameDay'
    // Test + cancelled orders are not real pours — suppress truck count and
    // style the card so the dispatcher knows not to act on it.
    const isNonProduction = isCancelled || isTest
    // Same-day, cancelled, and test orders all suppress secondary chips
    // (service quality, hours limit, big pour) — the OrderStatusBadge
    // already conveys the order's nature and the per-order metrics aren't
    // meaningful for these.
    const suppressSecondaryBadges = isNonProduction || isSameDay
    const hoursLimit = !suppressSecondaryBadges ? evaluateHoursLimit(order, firstLoadOutMin) : null
    const computedTrucks = isNonProduction ? null : getCalculatedTruckCount(order, travelOverrides)
    const trucks = computedTrucks ?? 0
    const addressBad = isLikelyBadAddress(clean(order.address))
    const hasAddress = !!(clean(order.address) || clean(order.city))
    // The whole card opens the order detail; nested filter chips below call
    // stopPropagation so a chip tap filters instead of opening the modal.
    const interactive = typeof onViewOrder === 'function'
    const openOrder = () => onViewOrder?.(order)
    // Resolve the card's dominant state once — drives both the left stripe
    // and the mobile status line. Independent of the start-time block's
    // own color (which conveys sameDay / cancelled / test).
    const cardState = resolveCardState(status, service)
    const accent = STATE_ACCENTS[cardState]
    return (
        <div
            className={`rounded-xl flex overflow-hidden${interactive ? ' cursor-pointer transition-transform duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none' : ''}`}
            onClick={interactive ? openOrder : undefined}
            onKeyDown={
                interactive
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openOrder()
                          }
                      }
                    : undefined
            }
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `View order details for ${clean(order.customer) || 'this order'}` : undefined}
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
            {/* Left state stripe — at-a-glance "done / in-progress / late /
                cancelled / upcoming" signal. Idle (upcoming, no signal yet)
                renders transparent so the card reads neutral. */}
            <div className="w-1 shrink-0" style={{ background: accent.stripe }} aria-hidden="true" />

            <div className="flex-1 min-w-0 p-2.5 md:p-3 flex flex-col gap-1.5 md:gap-2">
                {/* ── Mobile compact header (below md) ───────────────────── */}
                <div className="md:hidden">
                    {/* Row 1: start time · customer · yardage on one line */}
                    <div className="flex items-baseline gap-2 min-w-0">
                        <span
                            className="font-mono font-bold text-[14.5px] tabular-nums leading-none shrink-0"
                            style={{
                                color: status ? status.color : 'var(--text-primary)',
                                textDecoration: isCancelled ? 'line-through' : 'none'
                            }}
                        >
                            {start || '—'}
                        </span>
                        <span
                            className="flex-1 min-w-0 truncate text-[13.5px] font-bold leading-tight text-text-primary font-heading"
                            title={clean(order.customer)}
                            style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}
                        >
                            {clean(order.customer) || 'Unknown customer'}
                        </span>
                        <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-text-primary leading-none">
                            {yardage > 0 ? yardage : '—'}
                            <span className="ml-0.5 text-[10px] font-semibold text-text-tertiary">yd</span>
                        </span>
                    </div>
                    {/* Row 2: plant chip · order# · trucks · product */}
                    <div className="mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[11px] text-text-secondary leading-tight">
                        {plantCode &&
                            (onPickPlant ? (
                                <button type="button"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPickPlant(plantCode)
                                    }}
                                    className="font-semibold underline-offset-2 hover:underline border-none bg-transparent p-0 cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    style={{ color: 'var(--text-primary)' }}
                                    title={`Filter to plant ${plantCode}`}
                                >
                                    {plantCode}
                                    {plantName ? ` · ${plantName}` : ''}
                                </button>
                            ) : (
                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {plantCode}
                                    {plantName ? ` · ${plantName}` : ''}
                                </span>
                            ))}
                        {order.orderNum && <span className="font-mono">#{order.orderNum}</span>}
                        {trucks > 0 && (
                            <span>
                                {trucks} truck{trucks === 1 ? '' : 's'}
                            </span>
                        )}
                        {order.productCode &&
                            (onPickProduct ? (
                                <button type="button"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPickProduct(clean(order.productCode))
                                    }}
                                    className="font-mono font-semibold underline-offset-2 hover:underline border-none bg-transparent p-0 cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    style={{ color: 'var(--text-primary)' }}
                                    title={`Filter to product ${clean(order.productCode)}`}
                                >
                                    {clean(order.productCode)}
                                </button>
                            ) : (
                                <span className="font-mono font-semibold text-text-primary">
                                    {clean(order.productCode)}
                                </span>
                            ))}
                    </div>
                    {/* Row 3: prominent completion status — color-coded */}
                    <MobileStatusLine
                        accent={accent}
                        label={
                            cardState === 'cancelled'
                                ? 'Cancelled'
                                : cardState === 'test'
                                  ? 'Test order'
                                  : cardState === 'completed'
                                    ? 'Completed'
                                    : cardState === 'issues'
                                      ? 'Completed · issues'
                                      : cardState === 'ongoing'
                                        ? 'Pouring'
                                        : cardState === 'late'
                                          ? 'Late'
                                          : cardState === 'pending'
                                            ? 'Awaiting truck'
                                            : null
                        }
                        service={service}
                        status={status}
                    />
                    {/* Row 4: actions — Tickets button + Details hint */}
                    <div className="mt-1.5 flex items-center gap-2">
                        {onViewTickets && (
                            <button type="button"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onViewTickets(order)
                                }}
                                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-border-light bg-bg-secondary px-3 text-[12.5px] font-semibold text-text-primary cursor-pointer hover:bg-bg-tertiary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                            >
                                <i className="fas fa-ticket text-[11px] text-text-tertiary" />
                                Tickets
                            </button>
                        )}
                        {hasAddress && !addressBad && onOpenLocation && (
                            <button type="button"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onOpenLocation(order)
                                }}
                                aria-label="Open route map"
                                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-border-light bg-bg-secondary text-text-secondary cursor-pointer hover:bg-bg-tertiary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                                title="Open route map"
                            >
                                <i className="fas fa-location-dot text-[12px]" />
                            </button>
                        )}
                        {addressBad && (
                            <Badge tone="danger" size="sm" shape="pill" icon="triangle-exclamation">
                                Bad address
                            </Badge>
                        )}
                        {interactive && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">
                                Details
                                <i className="fas fa-chevron-right text-[9px]" />
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Desktop rich card (md and up) ───────────────────────── */}
                <div className="hidden md:flex flex-col gap-2">
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
                        className="font-bold text-[18px] leading-none font-mono font-heading"
                        style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}
                    >
                        {start || '—'}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    {/* Customer name takes its own row on small phones (basis-full)
                     * so the badges underneath can breathe; on >=sm the original
                     * single-line layout reappears with the name truncating. */}
                    <div className="flex items-start gap-2 flex-wrap min-w-0">
                        <div
                            className="text-[15px] font-bold leading-tight text-text-primary font-heading basis-full sm:basis-0 sm:flex-1 min-w-0 truncate"
                            style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}
                            title={clean(order.customer)}
                        >
                            {clean(order.customer) || 'Unknown customer'}
                        </div>
                        {status &&
                            (onPickStatus ? (
                                <button type="button"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPickStatus(status.kind)
                                    }}
                                    className="border-none bg-transparent p-0 cursor-pointer shrink-0 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    title={`Filter to ${status.label.toLowerCase()} orders`}
                                >
                                    <OrderStatusBadge status={status} />
                                </button>
                            ) : (
                                <OrderStatusBadge status={status} />
                            ))}
                        {!suppressSecondaryBadges && <BigPourBadge order={order} travelOverrides={travelOverrides} />}
                        {!suppressSecondaryBadges && <ServiceBadge service={service} />}
                        {!suppressSecondaryBadges && <HoursLimitBadge limit={hoursLimit} />}
                    </div>
                    <div className="text-[11.5px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-text-secondary">
                        {plantCode &&
                            (onPickPlant ? (
                                <button type="button"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPickPlant(plantCode)
                                    }}
                                    className="font-semibold underline-offset-2 hover:underline border-none bg-transparent p-0 cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    style={{ color: 'var(--text-primary)' }}
                                    title={`Filter to plant ${plantCode}`}
                                >
                                    {plantCode}
                                    {plantName ? ` · ${plantName}` : ''}
                                </button>
                            ) : (
                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
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
                            <Badge
                                tone="danger"
                                size="sm"
                                shape="pill"
                                icon="triangle-exclamation"
                                className="mt-1"
                                title={`Address looks invalid — original value: "${clean(order.address)}"`}
                            >
                                Bad Address
                            </Badge>
                        ) : onOpenLocation ? (
                            <div className="mt-1 flex flex-col gap-1">
                                <button type="button"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOpenLocation(order)
                                    }}
                                    className="text-[12px] flex items-center gap-1.5 border-none bg-transparent p-0 cursor-pointer underline-offset-2 hover:underline w-full text-left active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    style={{ color: 'var(--text-primary)' }}
                                    title="Open route map"
                                >
                                    <i className="fas fa-location-dot text-[10px] opacity-80" />
                                    <span className="truncate uppercase tracking-wide font-semibold">
                                        {composeAddress(order).toUpperCase()}
                                    </span>
                                </button>
                                {closerPlant && (
                                    <Badge
                                        tone="info"
                                        size="xs"
                                        shape="pill"
                                        icon="route"
                                        className="self-start"
                                        title={`Live drive time: ${closerPlant.minutes} min from plant ${closerPlant.plantCode}${closerPlant.plantName ? ` (${closerPlant.plantName})` : ''} vs ${closerPlant.assignedMinutes} min from assigned plant ${plantCode}. Saves ~${closerPlant.savings} min one-way.`}
                                    >
                                        Closer to {closerPlant.plantCode} · −{closerPlant.savings}m
                                    </Badge>
                                )}
                            </div>
                        ) : (
                            <div className="text-[12px] mt-1 flex items-center gap-1.5 text-text-secondary">
                                <i className="fas fa-location-dot text-[10px] opacity-70" />
                                <span className="truncate uppercase tracking-wide">
                                    {formatOrderAddress(order, ' · ')}
                                </span>
                            </div>
                        ))}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-[18px] font-bold leading-none text-text-primary font-heading">
                        {yardage > 0 ? yardage : '—'}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-text-secondary">yards</div>
                </div>
            </div>
            {(order.productCode || order.description) &&
                (onPickProduct && order.productCode ? (
                    <button type="button"
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onPickProduct(clean(order.productCode))
                        }}
                        className="rounded-md px-2.5 py-1.5 flex items-center gap-2 border cursor-pointer text-left bg-bg-secondary border-border-light active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        title={`Filter to product ${clean(order.productCode)}`}
                    >
                        <i className="fas fa-cube text-[10px]" style={{ color: 'var(--text-primary)' }} />
                        <span className="text-[12px] font-mono font-semibold text-text-primary">
                            {clean(order.productCode)}
                        </span>
                        {order.description && (
                            <span className="text-[12px] truncate text-text-secondary">{clean(order.description)}</span>
                        )}
                    </button>
                ) : (
                    <div className="rounded-md px-2.5 py-1.5 flex items-center gap-2 bg-bg-secondary border border-border-light">
                        <i className="fas fa-cube text-[10px]" style={{ color: 'var(--text-primary)' }} />
                        <span className="text-[12px] font-mono font-semibold text-text-primary">
                            {clean(order.productCode)}
                        </span>
                        {order.description && (
                            <span className="text-[12px] truncate text-text-secondary">{clean(order.description)}</span>
                        )}
                    </div>
                ))}
            <div className="flex flex-wrap gap-1.5 text-[11.5px] text-text-secondary">
                {order.tktTime && <KeyValue label="Tkt" value={formatHhmm(order.tktTime)} />}
                {order.rate && <KeyValue label="Rate" value={clean(order.rate)} />}
                {order.toJobTime && <KeyValue label="To Job" value={clean(order.toJobTime)} />}
                {order.toPlantTime && <KeyValue label="To Plant" value={clean(order.toPlantTime)} />}
                {trucks > 0 && <KeyValue label="Trucks" value={trucks} />}
                {loadSize > 0 && <KeyValue label="Load" value={`${loadSize} yd`} />}
                {order.poNumber && <KeyValue label="PO" value={clean(order.poNumber)} />}
                {order.jobNumber && <KeyValue label="Job" value={clean(order.jobNumber)} />}
                {order.phone && (
                    <KeyValue
                        label="Contact"
                        value={
                            <span onClick={(e) => e.stopPropagation()}>
                                <PhoneLink phone={clean(order.phone)} />
                            </span>
                        }
                    />
                )}
                {order.contact && <KeyValue label="Dispatcher" value={clean(order.contact)} />}
            </div>
            {onViewTickets && (
                <div className="flex items-center gap-2 pt-0.5">
                    <button type="button"
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onViewTickets(order)
                        }}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border-light bg-bg-secondary px-4 text-[13px] font-semibold text-text-primary cursor-pointer hover:bg-bg-tertiary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                    >
                        <i className="fas fa-ticket text-[11px] text-text-tertiary" />
                        Tickets
                    </button>
                    {interactive && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">
                            Details
                            <i className="fas fa-chevron-right text-[9px]" />
                        </span>
                    )}
                </div>
            )}
                </div>
            </div>
        </div>
    )
}
