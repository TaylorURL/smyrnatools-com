import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { getScheduleRowDelay } from '../../../utils/PlanScheduleUtility'
import { timeToMinutes } from '../../../utils/PlanUtility'
import OrderTicketsModal from '../schedule/OrderTicketsModal'
import TruckCoverageHoverCard from '../schedule/TruckCoverageHoverCard'
import PlanScheduleOrderRow from './PlanScheduleOrderRow'
import {
    ClockInRow,
    HelpRow,
    PullUpRow,
    ReturnRow,
    SendHomeRow,
    SlotRow,
    TradeoffRow
} from './PlanScheduleSyntheticRows'

const TABLE_HEADERS = [
    'Start',
    'Plant',
    'Order',
    'Customer',
    'Location',
    'Product',
    'Yards',
    'Loaded',
    'Load',
    'Trucks',
    'Travel',
    'Spacing',
    'Contact',
    'Dispatcher'
]

/* Order in which synthetic rows resolve when they share a minute. Returns
 * and clock-ins move first (pool grows), then help, then send-home / trade-
 * off, then slot suggestions, then real orders. */
const SAME_MINUTE_PRIORITY = {
    clockIn: 0,
    help: 2,
    order: 6,
    pullUp: 4,
    return: 0,
    sendHome: 3,
    slot: 5,
    tradeoff: 3
}

/** 30-minute bucket size for the "trucks returning" annotation. Trucks cycle
 *  individually but a row per truck would flood the table — a row per half-
 *  hour batch reads like "7 trucks back between 07:00 and 07:30" which is
 *  what dispatchers actually track. */
const TRUCK_RETURN_BUCKET_MIN = 30

/**
 * Build a chronological list of real order rows interleaved with synthetic
 * "trucks returning" rows, one per order at that order's last-truck-back
 * timestamp. The return row styles differently (green tint, left accent)
 * so dispatchers see exactly when capacity frees up at each plant without
 * floating overlays.
 *
 * Return rows only interleave when the sort is time-based (default sort
 * plant→time, or explicit start-time). For yardage/trucks/customer sorts
 * returns are skipped because they'd break the chosen ordering.
 */
function buildTableRows({
    extrasActive,
    filteredClockInRows,
    filteredHelpRows,
    filteredPullUpRows,
    filteredSendHomeRows,
    filteredSuggestedSlotRows,
    keyForOrder,
    orders,
    poolTimeline
}) {
    const rows = []
    for (const order of orders) rows.push({ kind: 'order', order, time: timeToMinutes(order.startTime) })
    if (extrasActive) {
        // Pool count on each bucket uses the pool state right after the last
        // return in that bucket.
        for (const order of orders) {
            const entry = poolTimeline?.[keyForOrder(order)]
            if (!entry || !Array.isArray(entry.returnEvents) || entry.returnEvents.length === 0) continue
            const buckets = new Map()
            entry.returnEvents.forEach((re) => {
                if (!Number.isFinite(re.time)) return
                const bucket = Math.floor(re.time / TRUCK_RETURN_BUCKET_MIN) * TRUCK_RETURN_BUCKET_MIN
                const existing = buckets.get(bucket)
                if (existing) {
                    existing.count += re.count
                    existing.lastTime = Math.max(existing.lastTime, re.time)
                    existing.poolAfter = re.poolAfter
                } else {
                    buckets.set(bucket, {
                        count: re.count,
                        firstTime: re.time,
                        lastTime: re.time,
                        poolAfter: re.poolAfter
                    })
                }
            })
            const bucketRows = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
            bucketRows.forEach(([bucketStart, agg], i) => {
                rows.push({
                    count: agg.count,
                    kind: 'return',
                    order,
                    plantCode: order.plantCode,
                    poolAfterReturn: agg.poolAfter,
                    rangeEnd: agg.lastTime,
                    rangeStart: agg.firstTime,
                    returnIndex: i,
                    time: bucketStart,
                    totalReturns: bucketRows.length,
                    truckCount: entry.truckCount
                })
            })
        }
    }
    for (const row of filteredHelpRows) {
        rows.push({
            clockInRangeEnd: row.clockInRangeEnd ?? null,
            clockInRangeStart: row.clockInRangeStart ?? null,
            count: row.count,
            direction: row.direction,
            forOrder: row.forOrder || null,
            fromPlant: row.fromPlant,
            helpKey: `${row.assignmentIndex}-${row.direction}-${row.time}`,
            kind: 'help',
            returnPlant: row.returnPlant,
            time: row.time,
            toPlant: row.toPlant
        })
    }
    // Combine a send-home row with any open-slot rows at the same plant that
    // fit the true spare capacity at that moment. "Surplus" here is the
    // cumulative min-future pool — trucks that will never be needed for
    // existing orders from this moment forward. Slots whose min-truck floor
    // fits that surplus merge into a single trade-off row.
    const slotConsumed = new Set()
    const sendHomeConsumed = new Set()
    filteredSendHomeRows.forEach((sh, shIdx) => {
        const available = Number.isFinite(sh.surplus) ? sh.surplus : sh.count
        const fittingIdxs = []
        filteredSuggestedSlotRows.forEach((slot, sIdx) => {
            if (slotConsumed.has(sIdx)) return
            if (slot.plantCode !== sh.plantCode) return
            if (slot.minTrucks > available) return
            fittingIdxs.push(sIdx)
        })
        if (fittingIdxs.length === 0) return
        sendHomeConsumed.add(shIdx)
        fittingIdxs.forEach((i) => slotConsumed.add(i))
        rows.push({
            count: sh.count,
            kind: 'tradeoff',
            plantCode: sh.plantCode,
            poolAfter: sh.poolAfter,
            slots: fittingIdxs.map((i) => filteredSuggestedSlotRows[i]),
            surplus: available,
            time: sh.time,
            tradeoffKey: `${sh.plantCode}-${sh.time}-${shIdx}`
        })
    })
    filteredSendHomeRows.forEach((row, i) => {
        if (sendHomeConsumed.has(i)) return
        rows.push({
            count: row.count,
            kind: 'sendHome',
            plantCode: row.plantCode,
            poolAfter: row.poolAfter,
            sendHomeKey: `${row.plantCode}-${row.time}-${i}`,
            time: row.time
        })
    })
    filteredSuggestedSlotRows.forEach((row, i) => {
        if (slotConsumed.has(i)) return
        rows.push({
            durationMin: row.durationMin,
            kind: 'slot',
            label: row.label,
            minTrucks: row.minTrucks,
            plantCode: row.plantCode,
            sizeKey: row.key,
            slotKey: `${row.key}-${row.plantCode}-${row.time}`,
            time: row.time,
            truckRange: row.truckRange
        })
    })
    filteredPullUpRows.forEach((row, i) => {
        rows.push({
            kind: 'pullUp',
            notifyByMin: row.notifyByMin,
            order: row.order,
            originalStartMin: row.originalStartMin,
            plantCode: row.plantCode,
            pourDurationMin: row.pourDurationMin,
            pullUpDeltaMin: row.pullUpDeltaMin,
            pullUpKey: `${row.plantCode}-${row.suggestedStartMin}-${i}`,
            suggestedStartMin: row.suggestedStartMin,
            time: row.time,
            truckCount: row.truckCount,
            yardage: row.yardage
        })
    })
    filteredClockInRows.forEach((row) => {
        rows.push({
            clockInKey: row.groupKey,
            count: row.count,
            firstTime: row.firstTime,
            forOrder: row.forOrder,
            forOrderId: row.forOrderId,
            kind: 'clockIn',
            lastTime: row.lastTime,
            plantCode: row.plantCode,
            time: row.firstTime
        })
    })
    // Chronological sort runs whenever any synthetic row is in play — they
    // only make sense at their actual minute between orders. With NO synthetic
    // rows (pure order list), we preserve the Sort by picker's ordering.
    const hasSyntheticRows = rows.some((r) => r.kind !== 'order')
    if (hasSyntheticRows) {
        rows.sort((a, b) => {
            const at = Number.isFinite(a.time) ? a.time : Infinity
            const bt = Number.isFinite(b.time) ? b.time : Infinity
            if (at !== bt) return at - bt
            return (SAME_MINUTE_PRIORITY[a.kind] ?? 7) - (SAME_MINUTE_PRIORITY[b.kind] ?? 7)
        })
    }
    return rows
}

/** Group raw clock-in rows by `(plant, dispatch order)` so a job needing
 *  three operators reads as a single row ("3 operators clock in for #461,
 *  staggered 07:50 → 08:00") rather than three near-duplicate rows. */
function groupClockInRows(clockInRows, visiblePlantCodes) {
    const grouped = new Map()
    clockInRows.forEach((row) => {
        if (!visiblePlantCodes.has(row.plantCode)) return
        const orderKey = row.forOrderId || row.forOrder?.orderId || row.forOrder?.orderNum || null
        const groupKey = `${row.plantCode}::${orderKey ?? 'unknown'}`
        const existing = grouped.get(groupKey)
        if (existing) {
            existing.count += row.count
            existing.firstTime = Math.min(existing.firstTime, row.time)
            existing.lastTime = Math.max(existing.lastTime, row.time)
        } else {
            grouped.set(groupKey, {
                count: row.count,
                firstTime: row.time,
                forOrder: row.forOrder,
                forOrderId: row.forOrderId,
                groupKey,
                lastTime: row.time,
                plantCode: row.plantCode
            })
        }
    })
    return Array.from(grouped.values())
}

/* Hover-card timing — the truck-coverage modal lingers briefly when the
 * cursor leaves so the user can move from the cell onto the modal itself
 * without the modal disappearing mid-transit. */
const HOVER_CLOSE_DELAY_MS = 400

/** Right-click context menu hook for order rows + the "View tickets" modal
 *  it launches. Lives at the table level (not inside the row map) because
 *  the menu needs to render once at fixed screen coords and dismiss on
 *  outside click. */
function useRowContextMenu() {
    const [rowMenu, setRowMenu] = useState(null)
    const [ticketsOrder, setTicketsOrder] = useState(null)
    useEffect(() => {
        if (!rowMenu) return undefined
        const dismiss = () => setRowMenu(null)
        window.addEventListener('click', dismiss)
        window.addEventListener('scroll', dismiss, true)
        window.addEventListener('resize', dismiss)
        const onKey = (e) => {
            if (e.key === 'Escape') dismiss()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('click', dismiss)
            window.removeEventListener('scroll', dismiss, true)
            window.removeEventListener('resize', dismiss)
            window.removeEventListener('keydown', onKey)
        }
    }, [rowMenu])
    const openRowMenu = useCallback((event, order) => {
        event.preventDefault()
        setRowMenu({ order, x: event.clientX, y: event.clientY })
    }, [])
    return { openRowMenu, rowMenu, setRowMenu, setTicketsOrder, ticketsOrder }
}

/** Hover state for the truck-coverage side panel — tracks both the hovered
 *  row key and the row's full payload so the panel can render outside the
 *  row's stacking context. Close is queued (not immediate) so cursor can
 *  move from the cell into the panel without flicker. */
function useHoverModal() {
    const [hoveredPayload, setHoveredPayload] = useState(null)
    const hoverCloseTimer = useRef(null)
    const cancelHoverClose = useCallback(() => {
        if (hoverCloseTimer.current) {
            clearTimeout(hoverCloseTimer.current)
            hoverCloseTimer.current = null
        }
    }, [])
    const openHover = useCallback(
        (payload) => {
            cancelHoverClose()
            if (payload) setHoveredPayload(payload)
        },
        [cancelHoverClose]
    )
    const queueCloseHover = useCallback(() => {
        cancelHoverClose()
        hoverCloseTimer.current = setTimeout(() => setHoveredPayload(null), HOVER_CLOSE_DELAY_MS)
    }, [cancelHoverClose])
    useEffect(() => () => cancelHoverClose(), [cancelHoverClose])
    return { hoveredPayload, openHover, queueCloseHover }
}

/**
 * Schedule table — flat, sticky-header table of every order, optionally
 * interleaved with synthetic rows (truck returns, help transfers, send-home,
 * pull-ups, slot suggestions, clock-ins) when a plant filter is active.
 */
export default function PlanScheduleTable({
    accentColor,
    clockInRows = [],
    detailByOrderId = {},
    filteredPlantCode = null,
    getCloserPlantForOrder,
    getTravelOverrides,
    helpRows = [],
    isMaximized = false,
    isPlantFiltered = false,
    isToday = false,
    keyForOrder,
    nowMin = null,
    onOpenLocation,
    orders,
    plantCityByCode,
    plantNameByCode,
    poolSourceByCode,
    poolTimeline,
    poolTimelinesByPlant,
    pullUpRows = [],
    sendHomeRows = [],
    showExtraRows = true,
    suggestedSlotRows = []
}) {
    const { openRowMenu, rowMenu, setRowMenu, setTicketsOrder, ticketsOrder } = useRowContextMenu()
    const { hoveredPayload, openHover, queueCloseHover } = useHoverModal()

    // Synthetic rows require a plant filter AND the toggle to be on — both
    // gates collapse into one effective flag for the rest of the component.
    const extrasActive = isPlantFiltered && showExtraRows
    /** Synthetic rows are only meaningful in the context of a single plant —
     *  they clutter the table when every plant's rows are mixed together.
     *  When the dispatcher selects a specific plant (even one with no orders),
     *  prefer that explicit filter over the visible-orders set so help /
     *  send-home / slot rows still show. */
    const visiblePlantCodes = useMemo(() => {
        if (filteredPlantCode) return new Set([filteredPlantCode])
        const set = new Set()
        for (const order of orders) if (order.plantCode) set.add(order.plantCode)
        return set
    }, [orders, filteredPlantCode])
    const filteredHelpRows = useMemo(
        () =>
            extrasActive
                ? helpRows.filter(
                      (row) =>
                          visiblePlantCodes.has(row.fromPlant) ||
                          visiblePlantCodes.has(row.toPlant) ||
                          (row.returnPlant && visiblePlantCodes.has(row.returnPlant))
                  )
                : [],
        [helpRows, visiblePlantCodes, extrasActive]
    )
    const filteredSendHomeRows = useMemo(
        () => (extrasActive ? sendHomeRows.filter((row) => visiblePlantCodes.has(row.plantCode)) : []),
        [sendHomeRows, visiblePlantCodes, extrasActive]
    )
    // Open-slot suggestions are the dispatcher's "where could I book a new
    // order" nudge — they show whenever a plant is filtered, even if the
    // dispatcher toggled off the other synthetic rows.
    const filteredSuggestedSlotRows = useMemo(
        () => (isPlantFiltered ? suggestedSlotRows.filter((row) => visiblePlantCodes.has(row.plantCode)) : []),
        [suggestedSlotRows, visiblePlantCodes, isPlantFiltered]
    )
    const filteredPullUpRows = useMemo(
        () => (extrasActive ? pullUpRows.filter((row) => visiblePlantCodes.has(row.plantCode)) : []),
        [pullUpRows, visiblePlantCodes, extrasActive]
    )
    const filteredClockInRows = useMemo(
        () => (extrasActive ? groupClockInRows(clockInRows, visiblePlantCodes) : []),
        [clockInRows, visiblePlantCodes, extrasActive]
    )

    const tableRows = useMemo(
        () =>
            buildTableRows({
                extrasActive,
                filteredClockInRows,
                filteredHelpRows,
                filteredPullUpRows,
                filteredSendHomeRows,
                filteredSuggestedSlotRows,
                keyForOrder,
                orders,
                poolTimeline
            }),
        [
            orders,
            poolTimeline,
            keyForOrder,
            filteredHelpRows,
            filteredSendHomeRows,
            filteredSuggestedSlotRows,
            filteredPullUpRows,
            filteredClockInRows,
            extrasActive
        ]
    )

    return (
        <div className="relative">
            <div
                className="rounded-xl overflow-auto"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    // Give the table its own scroll viewport so the header can
                    // actually stick when the dispatcher scrolls through a long
                    // schedule. Height is capped to "viewport minus surrounding
                    // chrome" (page nav, title, KPIs, filters) so the sticky
                    // header pins within the table, not within a container that
                    // itself scrolls out of view. Maximized mode hides most of
                    // that chrome, so the budget shrinks accordingly.
                    maxHeight: `calc(100vh - ${isMaximized ? 150 : 260}px)`
                }}
            >
                <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {TABLE_HEADERS.map((h) => (
                                <th
                                    key={h}
                                    className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap"
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
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows.map((row, idx) => {
                            const animationDelayMs = getScheduleRowDelay(idx)
                            const sharedProps = { accentColor, animationDelayMs, plantNameByCode, row }
                            switch (row.kind) {
                                case 'return':
                                    return (
                                        <ReturnRow
                                            key={`return-${keyForOrder(row.order)}-${row.returnIndex ?? 0}`}
                                            {...sharedProps}
                                        />
                                    )
                                case 'tradeoff':
                                    return <TradeoffRow key={`tradeoff-${row.tradeoffKey}`} {...sharedProps} />
                                case 'slot':
                                    return <SlotRow key={`slot-${row.slotKey}`} {...sharedProps} />
                                case 'pullUp':
                                    return <PullUpRow key={`pull-up-${row.pullUpKey}`} {...sharedProps} />
                                case 'clockIn':
                                    return <ClockInRow key={`clock-in-${row.clockInKey}`} {...sharedProps} />
                                case 'sendHome':
                                    return <SendHomeRow key={`send-home-${row.sendHomeKey}`} {...sharedProps} />
                                case 'help':
                                    return <HelpRow key={`help-${row.helpKey}`} {...sharedProps} />
                                default: {
                                    const o = row.order
                                    const rowKey = keyForOrder(o)
                                    return (
                                        <PlanScheduleOrderRow
                                            key={`${o.plantCode}-${o.orderId || idx}`}
                                            accentColor={accentColor}
                                            animationDelayMs={animationDelayMs}
                                            detail={o.orderId ? detailByOrderId[o.orderId] : null}
                                            getCloserPlantForOrder={getCloserPlantForOrder}
                                            isToday={isToday}
                                            nowMin={nowMin}
                                            onContextMenu={(e) => openRowMenu(e, o)}
                                            onHoverEnter={openHover}
                                            onHoverLeave={queueCloseHover}
                                            onOpenLocation={onOpenLocation}
                                            order={o}
                                            plantCityByCode={plantCityByCode}
                                            plantNameByCode={plantNameByCode}
                                            poolSourceByCode={poolSourceByCode}
                                            poolTimeline={poolTimeline}
                                            poolTimelinesByPlant={poolTimelinesByPlant}
                                            rowKey={rowKey}
                                            travelOverrides={getTravelOverrides ? getTravelOverrides(o) : undefined}
                                        />
                                    )
                                }
                            }
                        })}
                    </tbody>
                </table>
                {rowMenu &&
                    createPortal(
                        <div
                            // The menu lives inside a portal at fixed coords so it
                            // can't be clipped by the schedule's scroll container,
                            // and clicking outside the menu (the global click
                            // listener registered above) dismisses it.
                            // stopPropagation on the menu itself keeps clicks
                            // INSIDE from dismissing.
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.preventDefault()}
                            className="rounded-md py-1 min-w-[180px]"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-light)',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
                                left: Math.min(rowMenu.x, window.innerWidth - 200),
                                position: 'fixed',
                                top: Math.min(rowMenu.y, window.innerHeight - 80),
                                zIndex: 9999
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setTicketsOrder(rowMenu.order)
                                    setRowMenu(null)
                                }}
                                className="w-full text-left px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2 bg-transparent border-0 cursor-pointer hover:bg-[color:var(--bg-tertiary)]"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                <i className="fas fa-ticket text-[12px]" style={{ color: 'var(--text-tertiary)' }} />
                                View tickets
                            </button>
                        </div>,
                        document.body
                    )}
                {ticketsOrder && (
                    <OrderTicketsModal
                        accentColor={accentColor}
                        detail={ticketsOrder.orderId ? detailByOrderId[ticketsOrder.orderId] : null}
                        onClose={() => setTicketsOrder(null)}
                        order={ticketsOrder}
                        plantNameByCode={plantNameByCode}
                    />
                )}
            </div>
            <TruckCoverageHoverCard
                accentColor={accentColor}
                isOpen={!!hoveredPayload}
                onMouseEnter={() => openHover(hoveredPayload)}
                onMouseLeave={queueCloseHover}
                payload={hoveredPayload}
            />
        </div>
    )
}
