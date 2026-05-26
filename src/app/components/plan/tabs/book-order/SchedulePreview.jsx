import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { formatOrderAddress } from '../../../../../utils/AddressUtility'
import { clean, formatHhmm } from '../../../../../utils/PlanScheduleUtility'
import { timeToMinutes } from '../../../../../utils/PlanUtility'
import { formatMinutesAsClock, poolPillColor, SCHEDULE_PREVIEW_HEADERS } from '../../../../constants/bookOrderConstants'
import { PlantBadge } from '../schedule/PlanScheduleBadges'

/** Match the Schedule-tab table header — sticky `bg-tertiary` strip with an
 *  uppercase 10.5px label, divider via `borderBottom + boxShadow` so it reads
 *  the same on either side of the seam. */
function SchedulePreviewHeaderCell({ label }) {
    return (
        <th
            className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap bg-bg-tertiary border-b border-border-light text-text-secondary"
            style={{ boxShadow: '0 1px 0 0 var(--border-light)' }}
        >
            {label}
        </th>
    )
}

/** Crude per-row pour-window estimate, mirroring the math in
 *  BookOrderUtility's `orderTimeWindow` so the schedule preview's pool
 *  bookkeeping stays roughly in sync with the recommender. Travel-back
 *  is rolled into the tail. */
const previewOrderWindow = (order) => {
    const startMin = timeToMinutes(order?.startTime)
    if (!Number.isFinite(startMin)) return null
    const yards = parseFloat(order?.yardage) || 0
    const load = parseFloat(order?.loadSize) || 10
    const trips = yards > 0 ? Math.max(1, Math.ceil(yards / load)) : 1
    // Match BookOrderUtility constants without re-importing them.
    const duration = (trips - 1) * 5 + 25 + 30
    const trucksFromOrder = parseFloat(order?.truckCount)
    const trucks = Number.isFinite(trucksFromOrder) && trucksFromOrder > 0 ? trucksFromOrder : trips
    return { endMin: startMin + duration, startMin, trucks }
}

/**
 * Schedule-tab-styled preview of the recommended plant's day with the
 * proposed booking inserted in chronological position. The new row fades +
 * slides in on mount (and again whenever the proposed time / yardage
 * change), so the dispatcher visually sees where the booking will sit
 * relative to existing pours.
 */
export default function SchedulePreview({ accentColor, existingOrders, newOrder, plantCode, plantName, poolForPlant }) {
    const sortedRows = useMemo(() => {
        const existing = (existingOrders || [])
            .map((order) => {
                const startMin = timeToMinutes(order?.startTime)
                if (!Number.isFinite(startMin)) return null
                return { isNew: false, order, startMin }
            })
            .filter(Boolean)
        const newRow = Number.isFinite(newOrder?.startMin)
            ? [{ isNew: true, order: newOrder, startMin: newOrder.startMin }]
            : []
        return [...existing, ...newRow].sort((a, b) => a.startMin - b.startMin)
    }, [existingOrders, newOrder])

    /* Build a unified [{ startMin, endMin, trucks }] window list across
     * every row — existing orders + the proposed new booking — so each
     * row can compute "concurrent trucks engaged at THIS row's start
     * minute" and derive pool_after. Mirrors the schedule tab's
     * `poolAfterDispatch` column without needing the full pool-timeline
     * machinery the live tab uses. */
    const rowWindows = useMemo(() => {
        const out = []
        ;(existingOrders || []).forEach((order) => {
            const w = previewOrderWindow(order)
            if (w) out.push(w)
        })
        if (newOrder && Number.isFinite(newOrder.startMin)) {
            const trucks = Number.isFinite(newOrder.trucksNeeded) ? newOrder.trucksNeeded : 0
            const duration = Number.isFinite(newOrder.durationMin) ? newOrder.durationMin : 60
            out.push({ endMin: newOrder.startMin + duration, startMin: newOrder.startMin, trucks })
        }
        return out
    }, [existingOrders, newOrder])

    const concurrentBusyAt = useCallback(
        (atMin) => {
            let busy = 0
            for (const w of rowWindows) {
                if (w.startMin <= atMin && w.endMin > atMin) busy += w.trucks
            }
            return busy
        },
        [rowWindows]
    )

    const [animated, setAnimated] = useState(false)
    useEffect(() => {
        setAnimated(false)
        const handle = setTimeout(() => setAnimated(true), 80)
        return () => clearTimeout(handle)
    }, [newOrder?.startMin, newOrder?.yardage, newOrder?.trucksNeeded])

    return (
        <div className="rounded-xl overflow-hidden bg-bg-primary border border-border-light">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border-light">
                <i className="fas fa-table-list text-[11px] text-text-tertiary" />
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                    {plantName} — schedule preview
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse">
                    <thead>
                        <tr>
                            {SCHEDULE_PREVIEW_HEADERS.map((label) => (
                                <SchedulePreviewHeaderCell key={label} label={label} />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={SCHEDULE_PREVIEW_HEADERS.length}
                                    className="px-3 py-3 text-center italic text-text-tertiary"
                                >
                                    No existing orders today
                                </td>
                            </tr>
                        )}
                        {sortedRows.map((row, idx) => {
                            if (row.isNew) {
                                return (
                                    <tr
                                        key="__new"
                                        className={`transition-all duration-[250ms] ease-out ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'} border-t border-border-light`}
                                        style={{
                                            background: `${accentColor}1f`,
                                            boxShadow: `inset 3px 0 0 0 ${accentColor}`
                                        }}
                                    >
                                        <td className="px-3 py-2 font-mono font-bold whitespace-nowrap text-text-primary">
                                            {formatMinutesAsClock(row.startMin)}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <PlantBadge code={plantCode} fallback={accentColor} name={plantName} />
                                        </td>
                                        <td
                                            className="px-3 py-2 whitespace-nowrap font-semibold"
                                            style={{ color: accentColor }}
                                        >
                                            NEW
                                        </td>
                                        <td
                                            className="px-3 py-2 max-w-[220px] font-semibold"
                                            style={{ color: accentColor }}
                                        >
                                            New booking
                                        </td>
                                        <td className="px-3 py-2 max-w-[220px] text-text-tertiary">—</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-text-tertiary">—</td>
                                        <td className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap text-text-primary">
                                            {row.order.yardage}
                                        </td>
                                        <td className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap text-text-primary">
                                            {(() => {
                                                const trucks = row.order.trucksNeeded
                                                if (!Number.isFinite(poolForPlant) || poolForPlant <= 0) return trucks
                                                const poolAfter = poolForPlant - concurrentBusyAt(row.startMin)
                                                return (
                                                    <span className="inline-flex items-center justify-end gap-1">
                                                        <span>{trucks}</span>
                                                        <span
                                                            style={{ color: poolPillColor(poolAfter) }}
                                                            title={
                                                                poolAfter < 0
                                                                    ? `${-poolAfter} truck${poolAfter === -1 ? '' : 's'} short — overbooked at ${formatMinutesAsClock(row.startMin)}`
                                                                    : poolAfter <= 2
                                                                      ? `Tight margin — only ${poolAfter} truck${poolAfter === 1 ? '' : 's'} left in the pool during this pour`
                                                                      : `${poolAfter} trucks still free during this pour`
                                                            }
                                                        >
                                                            /{poolAfter}
                                                        </span>
                                                    </span>
                                                )
                                            })()}
                                        </td>
                                    </tr>
                                )
                            }
                            const o = row.order
                            const customer = clean(o.customer) || '—'
                            const orderAddress = formatOrderAddress(o, ', ')
                            const productCode = clean(o.productCode)
                            const description = clean(o.description)
                            const yards = parseFloat(o.yardage)
                            return (
                                <tr
                                    key={o.orderId || `${o.orderNum}-${row.startMin}`}
                                    className="animate-slide-in-row border-t border-border-light"
                                    style={{ animationDelay: `${idx * 35}ms` }}
                                >
                                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap text-text-primary">
                                        {formatHhmm(o.startTime) || '—'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <PlantBadge
                                            code={o.plantCode || plantCode}
                                            fallback={accentColor}
                                            name={plantName}
                                        />
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-text-primary">
                                        {o.orderNum ? `#${o.orderNum}` : '—'}
                                    </td>
                                    <td className="px-3 py-2 max-w-[220px] text-text-primary" title={customer}>
                                        <span className="font-semibold truncate inline-block max-w-full align-middle">
                                            {customer}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 max-w-[220px] text-text-secondary" title={orderAddress}>
                                        <span className="truncate inline-block max-w-full align-middle text-[11.5px] uppercase tracking-wide">
                                            {orderAddress || '—'}
                                        </span>
                                    </td>
                                    <td
                                        className="px-3 py-2 whitespace-nowrap text-text-primary"
                                        title={description || undefined}
                                    >
                                        <span className="font-mono font-semibold">{productCode || '—'}</span>
                                        {description && (
                                            <span className="ml-1 max-w-[160px] truncate inline-block align-middle text-text-tertiary">
                                                {description}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap text-text-primary">
                                        {Number.isFinite(yards) && yards > 0 ? yards : '—'}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-secondary">
                                        {(() => {
                                            const trucks = parseFloat(o.truckCount)
                                            if (!Number.isFinite(trucks) || trucks <= 0) return '—'
                                            if (!Number.isFinite(poolForPlant) || poolForPlant <= 0) return trucks
                                            const poolAfter = poolForPlant - concurrentBusyAt(row.startMin)
                                            return (
                                                <span className="inline-flex items-center justify-end gap-1">
                                                    <span>{trucks}</span>
                                                    <span
                                                        style={{ color: poolPillColor(poolAfter) }}
                                                        title={
                                                            poolAfter < 0
                                                                ? `${-poolAfter} truck${poolAfter === -1 ? '' : 's'} short — overbooked at ${formatHhmm(o.startTime) || ''}`
                                                                : poolAfter <= 2
                                                                  ? `Tight margin — only ${poolAfter} truck${poolAfter === 1 ? '' : 's'} left in the pool during this pour`
                                                                  : `${poolAfter} trucks still free during this pour`
                                                        }
                                                    >
                                                        /{poolAfter}
                                                    </span>
                                                </span>
                                            )
                                        })()}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
