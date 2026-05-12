/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo } from 'react'

import { parseDurationMinutes, timeToMinutes } from '../../../utils/PlanUtility'

const clean = (value) => (value == null ? '' : String(value).trim())

/** One label-over-value tile in the modal's metrics strip. */
function MetricTile({ hint, label, value }) {
    return (
        <div className="rounded-lg px-3 py-2 flex flex-col gap-0.5 bg-bg-primary border border-border-light">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
            <span
                className="font-mono font-bold text-[15px] text-text-primary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {value}
            </span>
            {hint && <span className="text-[10.5px] text-text-tertiary">{hint}</span>}
        </div>
    )
}

/**
 * Modal listing every ticket loaded for a single dispatch order, sourced from
 * the per-plant DetailOrderAnalysis files. Opens from the schedule tab's
 * row-level right-click menu so dispatchers can drill in without leaving the
 * schedule view.
 *
 * Tickets are pre-sorted chronologically by `loadedTime` upstream in the
 * service merge. Each row also shows which plant loaded the truck — useful
 * for orders that pulled trucks from a sibling plant (Baytown 403/404,
 * Conroe 408/409).
 */
function OrderTicketsModal({ accentColor = '#2563eb', detail, onClose, order, plantNameByCode }) {
    useEffect(() => {
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
    }, [onClose])

    const tickets = useMemo(() => (Array.isArray(detail?.tickets) ? detail.tickets : []), [detail])
    const totalLoaded = detail?.loadedYardage || 0
    const orderTotal = parseFloat(order?.yardage) || 0
    const orderNumLabel = order?.orderNum ? `#${order.orderNum}` : ''
    const customerLabel = clean(order?.customer)
    const homePlantCode = order?.plantCode || ''
    const homePlantName = plantNameByCode?.[homePlantCode] || ''

    /** Realized pour metrics — first / last truck loaded (minute-of-day
     *  parsed from each ticket's `loadedTime`) plus a yards-per-hour pace.
     *
     *  Pace is computed against the LARGER of:
     *    a) the actual load span (last - first loadedTime), and
     *    b) the planned pour duration: (expected loads − 1) × spacing.
     *
     *  This avoids a meaningless "218 yd/hr on a 40 yd pour" reading for
     *  small orders where every truck was filled in a 10-min burst at the
     *  plant — the actual pour at the job site spans the planned window,
     *  not the loadout window. Same rule covers the single-load case
     *  (actual span is 0, so the planned window dominates). */
    const realized = useMemo(() => {
        const parsed = tickets
            .map((t) => ({ mins: timeToMinutes(t?.loadedTime), time: t?.loadedTime }))
            .filter((entry) => Number.isFinite(entry.mins) && entry.time)
            .sort((a, b) => a.mins - b.mins)
        if (!parsed.length) return null
        const first = parsed[0]
        const last = parsed[parsed.length - 1]
        const actualSpan = Math.max(0, last.mins - first.mins)

        const loadSize = parseFloat(order?.loadSize) || 0
        const expectedTrucks =
            loadSize > 0 && orderTotal > 0 ? Math.max(1, Math.ceil(orderTotal / loadSize)) : parsed.length
        const spacing = parseDurationMinutes(order?.rate) ?? 5
        const plannedSpan = expectedTrucks > 1 ? (expectedTrucks - 1) * spacing : 0

        const effectiveSpan = Math.max(actualSpan, plannedSpan)
        const yph = effectiveSpan > 0 && totalLoaded > 0 ? (totalLoaded / effectiveSpan) * 60 : null
        return {
            actualSpan,
            effectiveSpan,
            firstTime: first.time,
            lastTime: last.time,
            plannedSpan,
            ticketCount: parsed.length,
            yph
        }
    }, [order?.loadSize, order?.rate, orderTotal, tickets, totalLoaded])

    const formatYph = (yph) => (Number.isFinite(yph) ? `${yph.toFixed(1)} yd/hr` : '—')
    const formatDuration = (mins) => {
        if (!Number.isFinite(mins) || mins <= 0) return null
        if (mins < 60) return `${mins} min`
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return `${h}h ${m}m`
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.55)] z-[2147483000]"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl flex flex-col w-full overflow-hidden bg-bg-primary border border-border-light"
                style={{
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '90vh',
                    maxWidth: 900
                }}
            >
                <div className="flex items-start gap-3 px-5 py-3 border-b border-border-light">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}14`, color: accentColor }}
                    >
                        <i className="fas fa-ticket text-[14px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold leading-tight text-text-primary">
                            Tickets {orderNumLabel}
                        </div>
                        <div className="text-[12px] mt-0.5 truncate text-text-secondary" title={customerLabel}>
                            {customerLabel || '—'}
                            {homePlantCode && (
                                <span className="ml-2 text-text-tertiary">
                                    · home plant {homePlantCode}
                                    {homePlantName ? ` (${homePlantName})` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
                                Loaded
                            </div>
                            <div
                                className="font-mono font-bold text-[14px]"
                                style={{
                                    color:
                                        orderTotal > 0 && totalLoaded >= orderTotal ? '#16a34a' : 'var(--text-primary)',
                                    fontVariantNumeric: 'tabular-nums'
                                }}
                            >
                                {Number.isInteger(totalLoaded) ? totalLoaded : totalLoaded.toFixed(2)}
                                <span className="text-[12px] ml-1 text-text-tertiary">/ {orderTotal || '—'} yd</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer text-text-secondary"
                            aria-label="Close"
                            title="Close"
                        >
                            <i className="fas fa-xmark text-[14px]" />
                        </button>
                    </div>
                </div>

                {realized && (
                    <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b bg-bg-secondary border-border-light">
                        <MetricTile label="First truck loaded" value={realized.firstTime} />
                        <MetricTile
                            hint={
                                realized.ticketCount > 1
                                    ? `${realized.ticketCount} loads total`
                                    : 'only one load so far'
                            }
                            label="Last truck loaded"
                            value={realized.lastTime}
                        />
                        <MetricTile
                            hint={(() => {
                                if (realized.yph == null) return 'order has no yardage to pace'
                                const planned = realized.plannedSpan > 0 && realized.plannedSpan >= realized.actualSpan
                                const span = formatDuration(realized.effectiveSpan)
                                return planned ? `over planned ${span} pour` : `over actual ${span} pour`
                            })()}
                            label="Pour pace"
                            value={formatYph(realized.yph)}
                        />
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    {tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-6 gap-2 text-center text-text-tertiary">
                            <i className="fas fa-truck-fast text-[28px]" />
                            <div className="text-[13px] font-semibold text-text-secondary">No tickets loaded yet</div>
                            <div className="text-[11.5px]">
                                Trucks haven&apos;t started loading for this order, or the bridge hasn&apos;t synced new
                                detail data yet.
                            </div>
                        </div>
                    ) : (
                        <table className="w-full text-[12.5px] border-collapse">
                            <thead>
                                <tr>
                                    {[
                                        // Sequential 1-based position of each ticket in this
                                        // order's load sequence — gives the dispatcher a
                                        // quick way to talk about "load 12 was late" without
                                        // needing to read the dispatch ticket number.
                                        { align: 'right', label: 'Load' },
                                        { align: 'left', label: 'Plant' },
                                        { align: 'left', label: 'Order #' },
                                        { align: 'left', label: 'Ticket #' },
                                        { align: 'left', label: 'Truck #' },
                                        { align: 'left', label: 'Driver' },
                                        { align: 'left', label: 'Ticket time' },
                                        { align: 'left', label: 'Load time' },
                                        { align: 'right', label: 'Yards' }
                                    ].map((h) => (
                                        <th
                                            key={h.label}
                                            className="px-3 py-2 font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap bg-bg-tertiary border-b border-border-light text-text-secondary sticky z-[1]"
                                            style={{ textAlign: h.align, top: 0 }}
                                        >
                                            {h.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map((t, idx) => {
                                    const plantCode = t.plantId
                                    const isHomePlant = plantCode === homePlantCode
                                    const plantName = plantNameByCode?.[plantCode] || ''
                                    return (
                                        <tr
                                            className="border-t border-border-light"
                                            key={t.ticketId || `${plantCode}-${t.ticketNum || idx}-${idx}`}
                                        >
                                            <td
                                                className="px-3 py-2 font-mono font-semibold text-right whitespace-nowrap text-text-tertiary"
                                                style={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                                {idx + 1}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="font-mono font-semibold text-text-primary">
                                                    {plantCode || '—'}
                                                </span>
                                                {plantName && (
                                                    <span className="ml-2 text-[11px] text-text-tertiary">
                                                        {plantName}
                                                    </span>
                                                )}
                                                {!isHomePlant && plantCode && (
                                                    <span
                                                        className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-[rgba(217,_119,_6,_0.15)] text-[#b45309]"
                                                        title={`Loaded from ${plantCode} for an order whose home plant is ${homePlantCode}`}
                                                    >
                                                        <i className="fas fa-shuffle text-[9px]" />
                                                        Cross-plant
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-mono whitespace-nowrap text-text-primary">
                                                {order?.orderNum ? `#${order.orderNum}` : '—'}
                                            </td>
                                            <td className="px-3 py-2 font-mono whitespace-nowrap text-text-primary">
                                                {t.ticketNum || '—'}
                                            </td>
                                            <td className="px-3 py-2 font-mono whitespace-nowrap text-text-primary">
                                                {t.truckNum || '—'}
                                            </td>
                                            <td className="px-3 py-2 font-mono whitespace-nowrap text-text-secondary">
                                                {t.driverNum || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap text-text-primary"
                                                style={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                                {t.ticketTime || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap text-text-primary"
                                                style={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                                {t.loadedTime || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap text-text-primary"
                                                style={{ fontVariantNumeric: 'tabular-nums' }}
                                                title={
                                                    t.sourceReport === 'DetailDriver'
                                                        ? 'Yards not in DetailDriver report — cross-plant load'
                                                        : undefined
                                                }
                                            >
                                                {t.sourceReport === 'DetailDriver' && !t.quantity
                                                    ? '—'
                                                    : Number.isInteger(t.quantity)
                                                      ? t.quantity
                                                      : t.quantity.toFixed(2)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

export default OrderTicketsModal
