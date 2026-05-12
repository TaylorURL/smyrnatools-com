import React from 'react'

import { formatOrderAddress } from '../../../utils/AddressUtility'
import {
    clean,
    evaluateHoursLimit,
    formatHhmm,
    getOrderStatus,
    isLikelyBadAddress
} from '../../../utils/PlanScheduleUtility'
import { getCalculatedTruckCount } from '../../../utils/PlanUtility'
import PhoneLink from '../common/PhoneLink'
import { BigPourBadge, HoursLimitBadge, KeyValue, OrderStatusBadge, ServiceBadge } from './PlanScheduleBadges'

const composeAddress = (order) => formatOrderAddress(order, ', ')

/**
 * Card-mode rendering for a single dispatch order. Replaces the table row when
 * the dispatcher selects "Cards" view (always on mobile). Shares its tooltip
 * + badge primitives with the table view so the two surfaces stay aligned.
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
    // Test + cancelled orders are not real pours — suppress truck count and
    // style the card so the dispatcher knows not to act on it.
    const isNonProduction = isCancelled || isTest
    const hoursLimit = !isNonProduction ? evaluateHoursLimit(order, firstLoadOutMin) : null
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
                        className="font-bold text-[18px] leading-none font-mono font-heading"
                        style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}
                    >
                        {start || '—'}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div
                            className="text-[15px] font-bold leading-tight text-text-primary font-heading"
                            style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}
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
                        {!isNonProduction && <ServiceBadge service={service} />}
                        {!isNonProduction && <HoursLimitBadge limit={hoursLimit} />}
                    </div>
                    <div className="text-[11.5px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-text-secondary">
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
                                className="status-badge-danger mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider"
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
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap self-start bg-[rgba(37,_99,_235,_0.12)] text-blue-700"
                                        title={`Live drive time: ${closerPlant.minutes} min from plant ${closerPlant.plantCode}${closerPlant.plantName ? ` (${closerPlant.plantName})` : ''} vs ${closerPlant.assignedMinutes} min from assigned plant ${plantCode}. Saves ~${closerPlant.savings} min one-way.`}
                                    >
                                        <i className="fas fa-route text-[9px]" />
                                        Closer to {closerPlant.plantCode} · −{closerPlant.savings}m
                                    </span>
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
                    <button
                        type="button"
                        onClick={() => onPickProduct(clean(order.productCode))}
                        className="rounded-md px-2.5 py-1.5 flex items-center gap-2 border cursor-pointer text-left bg-bg-secondary border-border-light"
                        title={`Filter to product ${clean(order.productCode)}`}
                    >
                        <i className="fas fa-cube text-[10px]" style={{ color: accentColor }} />
                        <span className="text-[12px] font-mono font-semibold text-text-primary">
                            {clean(order.productCode)}
                        </span>
                        {order.description && (
                            <span className="text-[12px] truncate text-text-secondary">{clean(order.description)}</span>
                        )}
                    </button>
                ) : (
                    <div className="rounded-md px-2.5 py-1.5 flex items-center gap-2 bg-bg-secondary border border-border-light">
                        <i className="fas fa-cube text-[10px]" style={{ color: accentColor }} />
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
                {order.phone && <KeyValue label="Contact" value={<PhoneLink phone={clean(order.phone)} />} />}
                {order.contact && <KeyValue label="Dispatcher" value={clean(order.contact)} />}
            </div>
        </div>
    )
}
