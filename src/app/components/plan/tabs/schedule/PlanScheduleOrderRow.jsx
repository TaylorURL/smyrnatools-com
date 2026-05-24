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
import { resolveCustomerRiskBadges } from '../../../../hooks/useCustomerRiskIndex'
import {
    HoursLimitBadge,
    LikelyChurnBadge,
    LikelyKickerBadge,
    OrderStatusBadge,
    PlantBadge,
    ServiceBadge
} from './PlanScheduleBadges'
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
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 bg-[rgba(217,_119,_6,_0.15)] text-text-primary"
                        title={`City wasn't entered by dispatch — we filled in "${fallbackCity}" from plant ${order.plantCode}. The actual delivery city could be different.`}
                    >
                        <i className="fas fa-circle-exclamation text-[9px]" />
                        City?
                    </span>
                )}
            </div>
            {closerPlant && (
                <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap self-start bg-[rgba(37,_99,_235,_0.12)] text-text-primary"
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
function TrucksCell({
    compareMode = false,
    isNonProduction,
    isPastDay,
    order,
    poolTimeline,
    rowKey,
    service,
    travelOverrides
}) {
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
    // Three-color scale on the trailing pool value, surfaced as the badge
    // background behind the `/N` pool segment so the dispatcher sees pool
    // health at a glance without reading the tooltip:
    //   < 0   → danger (red)    — below demand, overbooked
    //   0–2   → warning (amber) — tight margin (0 = break-even, 1–2 close to edge)
    //   ≥ 3   → success (green) — comfortable headroom
    const poolBadgeClass = Number.isFinite(poolAfterEffective)
        ? poolAfterEffective < 0
            ? 'status-badge-danger'
            : poolAfterEffective <= 2
              ? 'status-badge-warning'
              : 'status-badge-success'
        : ''
    const poolBadgeTitle = Number.isFinite(poolAfterEffective)
        ? poolAfterEffective < 0
            ? `${-poolAfterEffective} truck${poolAfterEffective === -1 ? '' : 's'} short — pour runs below scheduled rate`
            : poolAfterEffective <= 2
              ? `Tight — only ${poolAfterEffective} truck${poolAfterEffective === 1 ? '' : 's'} left in the pool during this pour`
              : `${poolAfterEffective} trucks still free during this pour — comfortable margin`
        : ''
    return (
        <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-secondary">
            <div className="flex flex-col items-end gap-0.5">
                <span className="inline-flex items-center gap-1 justify-end font-semibold text-text-primary">
                    {differsFromDispatch && <i className="fas fa-circle-info text-[10px]" />}
                    {computed != null ? computed : '—'}
                    {Number.isFinite(poolAfterEffective) && (
                        <span
                            className={`${poolBadgeClass} inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] font-bold tabular-nums`}
                            title={poolBadgeTitle}
                        >
                            /{poolAfterEffective}
                        </span>
                    )}
                </span>
                {overbooked && !compareMode && (
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
    /** Compact comparison-view mode. When true, every "annotation" badge
     *  (order status, service good/bad, hours-limit warning, needs-help
     *  pill) is suppressed and the row renders with only the column-level
     *  data. Used by the Schedule split view so each pair of left/right
     *  rows reads as the same height — annotation badges wrap and would
     *  otherwise desync the row heights between snapshot and live. */
    compareMode = false,
    /** Per-customer behaviour index produced by `useCustomerRiskIndex`.
     *  When provided, the customer cell renders a "Likely to Kick" or
     *  "Likely to Cancel/Move" pill for any customer whose trailing
     *  60-day history clears the risk thresholds. */
    customerRiskIndex,
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
    travelOverrides,
    /** Optional Set<string> of column keys to render. `null` / undefined
     *  renders the full set (the normal Schedule tab). The split view
     *  passes a narrower set for its compact side-by-side layout. */
    visibleColumns = null
}) {
    const showColumn = (key) => !visibleColumns || visibleColumns.has(key)
    const yardage = parseFloat(order.yardage) || 0
    const loadSize = parseFloat(order.loadSize) || 0
    const plantName = plantNameByCode?.[order.plantCode] || ''
    const status = getOrderStatus(order.startTime, { isToday })
    const isCancelled = status?.kind === 'cancelled'
    const isTest = status?.kind === 'test'
    const isSameDay = status?.kind === 'sameDay'
    const isNonProduction = isCancelled || isTest
    // Same-day, cancelled, and test orders all suppress the service-quality
    // and hours-limit chips — the OrderStatusBadge already tells the story
    // and the per-order metrics aren't meaningful for these.
    const suppressSecondaryBadges = isNonProduction || isSameDay
    const service = !suppressSecondaryBadges ? evaluateOrderService(order, detail, nowMin) : null
    const hoursLimit = !suppressSecondaryBadges ? evaluateHoursLimit(order, firstLoadOutMin) : null
    /* Risk badges run on every live row (including future / today) — the
     * signal is "what does this customer typically do?" which applies as
     * soon as the order is booked. Suppressed for cancelled / test /
     * same-day orders since those already have their own primary badge. */
    const riskBadges =
        !suppressSecondaryBadges && customerRiskIndex
            ? resolveCustomerRiskBadges(customerRiskIndex, order.customer)
            : null
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
            {showColumn('start') && (
                <td
                    className="px-3 py-2 font-mono font-bold whitespace-nowrap"
                    style={{
                        color: isCancelled ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        textDecoration: isCancelled ? 'line-through' : 'none'
                    }}
                >
                    {formatHhmm(order.startTime) || '—'}
                </td>
            )}
            {showColumn('plant') && (
                <td className="px-3 py-2 whitespace-nowrap">
                    <PlantBadge code={order.plantCode} fallback={accentColor} name={plantName} />
                </td>
            )}
            {showColumn('order') && (
                <td className="px-3 py-2 whitespace-nowrap font-semibold text-text-primary">
                    {order.orderNum ? `#${order.orderNum}` : '—'}
                </td>
            )}
            {showColumn('customer') && (
                <td className="px-3 py-2 max-w-[260px] text-text-primary" title={clean(order.customer)}>
                    <div className="flex items-center gap-2 min-w-0 flex-nowrap">
                        {/* Risk indicators sit as compact icon-only chips
                            leading the customer name. They're fixed-width
                            (~20px each) and `shrink-0`, so the customer
                            name still gets `flex-1 min-w-0` and truncates
                            the same as before — the icons can't crowd it
                            out the way full-text badges did. */}
                        {!compareMode && riskBadges?.likelyToKick && <LikelyKickerBadge rate={riskBadges.kickerRate} />}
                        {!compareMode && riskBadges?.likelyToChurn && <LikelyChurnBadge rate={riskBadges.churnRate} />}
                        <span
                            className="font-semibold truncate flex-1 min-w-0"
                            style={{
                                textDecoration: isCancelled ? 'line-through' : 'none'
                            }}
                        >
                            {clean(order.customer) || '—'}
                        </span>
                        {!compareMode && status && <OrderStatusBadge status={status} />}
                        {!compareMode && !suppressSecondaryBadges && <ServiceBadge service={service} />}
                        {!compareMode && !suppressSecondaryBadges && <HoursLimitBadge limit={hoursLimit} />}
                    </div>
                </td>
            )}
            {showColumn('location') && (
                <td className="px-3 py-2 max-w-[280px]">
                    <AddressCell
                        getCloserPlantForOrder={getCloserPlantForOrder}
                        onOpenLocation={onOpenLocation}
                        order={order}
                        plantCityByCode={plantCityByCode}
                    />
                </td>
            )}
            {showColumn('product') && (
                <td className="px-3 py-2 whitespace-nowrap text-text-primary" title={clean(order.description)}>
                    <span className="font-mono font-semibold">{clean(order.productCode) || '—'}</span>
                    {order.description && (
                        <span className="ml-1 max-w-[180px] truncate inline-block align-middle text-text-tertiary">
                            {clean(order.description)}
                        </span>
                    )}
                </td>
            )}
            {showColumn('yards') && (
                <td className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap text-text-primary">
                    {yardage > 0 ? yardage : '—'}
                </td>
            )}
            {showColumn('loaded') && (
                <PlanScheduleLoadedCell detail={detail} homePlantCode={order.plantCode} total={yardage} />
            )}
            {showColumn('load') && (
                <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-secondary">
                    {loadSize > 0 ? loadSize : '—'}
                </td>
            )}
            {showColumn('trucks') && (
                <TrucksCell
                    compareMode={compareMode}
                    isNonProduction={isNonProduction}
                    isPastDay={isPastDay}
                    order={order}
                    poolTimeline={poolTimeline}
                    rowKey={rowKey}
                    service={service}
                    travelOverrides={travelOverrides}
                />
            )}
            {showColumn('travel') && (
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
            )}
            {showColumn('spacing') && (
                <td
                    className="px-3 py-2 font-mono whitespace-nowrap text-text-secondary"
                    title="Spacing between loads (rate)"
                >
                    {clean(order.rate) || '—'}
                </td>
            )}
            {showColumn('contact') && (
                <td
                    className="px-3 py-2 whitespace-nowrap font-mono text-text-secondary"
                    title={clean(order.phone) || undefined}
                >
                    <PhoneCell phone={clean(order.phone)} />
                </td>
            )}
        </tr>
    )
}
