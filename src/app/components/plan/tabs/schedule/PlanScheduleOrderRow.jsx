/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { formatAddressSegment, formatOrderAddress } from '../../../../../utils/AddressUtility'
import {
    clean,
    evaluateHoursLimit,
    evaluateOrderService,
    formatHhmm,
    getOrderStatus,
    isLikelyBadAddress
} from '../../../../../utils/PlanScheduleUtility'
import { getCalculatedTruckCount } from '../../../../../utils/PlanUtility'
import { HoursLimitBadge, OrderStatusBadge, PlantBadge, ServiceBadge } from './PlanScheduleBadges'
import PlanScheduleLoadedCell from './PlanScheduleLoadedCell'

const composeAddress = (order) => formatOrderAddress(order, ', ')

/** Format a 10-digit US phone number as `(XXX) XXX-XXXX`; pass through anything
 *  else verbatim. */
function PhoneCell({ phone }) {
    if (!phone) return <>—</>
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) {
        return (
            <a href={`tel:${digits}`} className="hover:underline text-text-primary">
                ({digits.slice(0, 3)}) {digits.slice(3, 6)}-{digits.slice(6)}
            </a>
        )
    }
    return <>{phone}</>
}

/** Address cell — renders the bad-address chip, the city-fallback annotation,
 *  the location-map button, and the "closer plant" hint. Read order matters:
 *  bad addresses short-circuit before we attempt any geocoding fallback. */
function AddressCell({ getCloserPlantForOrder, onOpenLocation, order, plantCityByCode }) {
    const rawAddress = clean(order.address)
    const rawCity = clean(order.city)
    if (!rawAddress && !rawCity) {
        return <span className="text-text-tertiary">—</span>
    }
    if (isLikelyBadAddress(rawAddress)) {
        return (
            <span
                className="status-badge-danger inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap"
                title={`Address looks invalid — original value: "${rawAddress}"${rawCity ? ` · City: ${rawCity}` : ''}`}
            >
                <i className="fas fa-triangle-exclamation text-[9px]" />
                Bad Address
            </span>
        )
    }
    // Fallback: when dispatch didn't enter a city, borrow the plant's city so
    // the geocoder still lands in the right area — and flag that it was inferred.
    const fallbackCity = rawCity ? '' : plantCityByCode?.[order.plantCode] || ''
    const effectiveCityRaw = rawCity || fallbackCity
    const usingFallback = !rawCity && !!fallbackCity
    const address = formatAddressSegment(rawAddress)
    const effectiveCity = formatAddressSegment(effectiveCityRaw)
    const displayText = [address, effectiveCity].filter(Boolean).join(', ')
    const orderForMap = usingFallback ? { ...order, city: fallbackCity } : order
    const closerPlant = getCloserPlantForOrder?.(order)
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
                <button
                    type="button"
                    onClick={() => onOpenLocation?.(orderForMap)}
                    className="text-left underline-offset-2 hover:underline cursor-pointer bg-transparent border-none p-0 truncate min-w-0 font-semibold uppercase tracking-wide text-text-primary"
                    style={{ fontSize: 12 }}
                    title={`Open map for ${composeAddress(orderForMap)}`}
                >
                    <i className="fas fa-location-dot text-[10px] mr-1.5 text-text-tertiary" />
                    {displayText}
                </button>
                {usingFallback && (
                    <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 bg-[rgba(217,_119,_6,_0.15)] text-[#b45309]"
                        title={`City wasn't entered by dispatch — we filled in "${fallbackCity}" from plant ${order.plantCode}. The actual delivery city could be different.`}
                    >
                        <i className="fas fa-circle-exclamation text-[9px]" />
                        City?
                    </span>
                )}
            </div>
            {closerPlant && (
                <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap self-start bg-[rgba(37,_99,_235,_0.12)] text-blue-700"
                    title={`Live drive time: ${closerPlant.minutes} min from plant ${closerPlant.plantCode}${closerPlant.plantName ? ` (${closerPlant.plantName})` : ''} vs ${closerPlant.assignedMinutes} min from assigned plant ${order.plantCode}. Saves ~${closerPlant.savings} min one-way.`}
                >
                    <i className="fas fa-route text-[9px]" />
                    Closer to {closerPlant.plantCode} · −{closerPlant.savings}m
                </span>
            )}
        </div>
    )
}

/** Trucks cell — shows the canonical computed truck count, the trailing pool
 *  pill colored by margin, and the "Needs Help" warning. Full coverage detail
 *  lives in the View Order modal (right-click → View order → Plan tab).
 *
 *  The "Needs Help" badge is suppressed for past days and for orders the
 *  service evaluator already considers completed (`good`/`bad`) — once a pour
 *  is finished, calling for help is moot and the badge is just noise. */
function TrucksCell({ isNonProduction, isPastDay, order, poolTimeline, rowKey, service, travelOverrides }) {
    if (isNonProduction) {
        return <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-tertiary">—</td>
    }
    const computed = getCalculatedTruckCount(order, travelOverrides)
    const dispatchTrucks = parseFloat(order.truckCount) || 0
    const differsFromDispatch = computed != null && dispatchTrucks > 0 && computed !== dispatchTrucks
    const poolEntry = poolTimeline?.[rowKey]
    const poolAfter = poolEntry?.poolAfterDispatch
    const poolAfterEffective = Number.isFinite(poolEntry?.poolAfterDispatchEffective)
        ? poolEntry.poolAfterDispatchEffective
        : poolAfter
    const isCompleted = service?.status === 'good' || service?.status === 'bad'
    const overbooked = Number.isFinite(poolAfterEffective) && poolAfterEffective < 0 && !isPastDay && !isCompleted
    return (
        <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-secondary">
            <div className="flex flex-col items-end gap-0.5">
                <span
                    className="inline-flex items-center gap-1 justify-end font-semibold"
                    style={{ color: differsFromDispatch ? '#d97706' : 'var(--text-primary)' }}
                >
                    {differsFromDispatch && <i className="fas fa-circle-info text-[10px]" />}
                    {computed != null ? computed : '—'}
                    {Number.isFinite(poolAfterEffective) &&
                        (() => {
                            // Three-color scale on the trailing pool value:
                            //   < 0   → red  (below demand, overbooked)
                            //   0–2   → amber (tight margin — 1–2 trucks left
                            //           is close to the edge, 0 is break-even)
                            //   ≥ 3   → green (comfortable headroom)
                            const pillColor =
                                poolAfterEffective < 0 ? '#dc2626' : poolAfterEffective <= 2 ? '#d97706' : '#16a34a'
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
                        className="status-badge-warning inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                        title="Fewer trucks than needed to hold the scheduled pour rate — send help from another plant to pour on pace."
                    >
                        <i className="fas fa-handshake-angle text-[8px]" />
                        Needs Help
                    </span>
                )}
            </div>
        </td>
    )
}

/**
 * Single `<tr>` rendering one dispatch order in the schedule table. Owns the
 * customer + status, address, product, yards, trucks-with-coverage, and
 * contact columns.
 */
export default function PlanScheduleOrderRow({
    accentColor,
    animationDelayMs,
    detail,
    firstLoadOutMin,
    getCloserPlantForOrder,
    isPastDay,
    isToday,
    nowMin,
    onContextMenu,
    onOpenLocation,
    order,
    plantCityByCode,
    plantNameByCode,
    poolTimeline,
    rowKey,
    travelOverrides
}) {
    const yardage = parseFloat(order.yardage) || 0
    const loadSize = parseFloat(order.loadSize) || 0
    const plantName = plantNameByCode?.[order.plantCode] || ''
    const status = getOrderStatus(order.startTime, { isToday })
    const isCancelled = status?.kind === 'cancelled'
    const isTest = status?.kind === 'test'
    const isNonProduction = isCancelled || isTest
    const service = !isNonProduction ? evaluateOrderService(order, detail, nowMin) : null
    const hoursLimit = !isNonProduction ? evaluateHoursLimit(order, firstLoadOutMin) : null
    return (
        <tr
            className="animate-slide-in-row border-t border-border-light"
            onContextMenu={onContextMenu}
            style={{
                animationDelay: `${animationDelayMs}ms`,
                background: isCancelled ? 'rgba(220, 38, 38, 0.05)' : isTest ? 'rgba(99, 102, 241, 0.05)' : undefined,
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
                {formatHhmm(order.startTime) || '—'}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                <PlantBadge code={order.plantCode} fallback={accentColor} name={plantName} />
            </td>
            <td className="px-3 py-2 whitespace-nowrap font-semibold text-text-primary">
                {order.orderNum ? `#${order.orderNum}` : '—'}
            </td>
            <td className="px-3 py-2 max-w-[260px] text-text-primary" title={clean(order.customer)}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span
                        className="font-semibold truncate"
                        style={{
                            textDecoration: isCancelled ? 'line-through' : 'none'
                        }}
                    >
                        {clean(order.customer) || '—'}
                    </span>
                    {status && <OrderStatusBadge status={status} />}
                    {!isCancelled && !isTest && <ServiceBadge service={service} />}
                    {!isCancelled && !isTest && <HoursLimitBadge limit={hoursLimit} />}
                </div>
            </td>
            <td className="px-3 py-2 max-w-[280px]">
                <AddressCell
                    getCloserPlantForOrder={getCloserPlantForOrder}
                    onOpenLocation={onOpenLocation}
                    order={order}
                    plantCityByCode={plantCityByCode}
                />
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-text-primary" title={clean(order.description)}>
                <span className="font-mono font-semibold">{clean(order.productCode) || '—'}</span>
                {order.description && (
                    <span className="ml-1 max-w-[180px] truncate inline-block align-middle text-text-tertiary">
                        {clean(order.description)}
                    </span>
                )}
            </td>
            <td className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap text-text-primary">
                {yardage > 0 ? yardage : '—'}
            </td>
            <PlanScheduleLoadedCell detail={detail} homePlantCode={order.plantCode} total={yardage} />
            <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-secondary">
                {loadSize > 0 ? loadSize : '—'}
            </td>
            <TrucksCell
                isNonProduction={isNonProduction}
                isPastDay={isPastDay}
                order={order}
                poolTimeline={poolTimeline}
                rowKey={rowKey}
                service={service}
                travelOverrides={travelOverrides}
            />
            <td
                className="px-3 py-2 font-mono whitespace-nowrap text-text-secondary"
                title={
                    order.toJobTime || order.toPlantTime
                        ? `To job ${clean(order.toJobTime) || '—'} · To plant ${clean(order.toPlantTime) || '—'}`
                        : undefined
                }
            >
                {clean(order.toJobTime) || '—'}
            </td>
            <td
                className="px-3 py-2 font-mono whitespace-nowrap text-text-secondary"
                title="Spacing between loads (rate)"
            >
                {clean(order.rate) || '—'}
            </td>
            <td
                className="px-3 py-2 whitespace-nowrap font-mono text-text-secondary"
                title={clean(order.phone) || undefined}
            >
                <PhoneCell phone={clean(order.phone)} />
            </td>
        </tr>
    )
}
