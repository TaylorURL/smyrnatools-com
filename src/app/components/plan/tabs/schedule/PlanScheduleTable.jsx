/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { buildOrderCoveragePayload, getScheduleRowDelay } from '../../../../../utils/PlanScheduleUtility'
import { timeToMinutes } from '../../../../../utils/PlanUtility'
import OrderInfoModal from '../../../schedule/OrderInfoModal'
import OrderTicketsModal from '../../../schedule/OrderTicketsModal'
import PlanScheduleOrderRow from './PlanScheduleOrderRow'
import {
    ClockInRow,
    HelpRow,
    PlaceholderRow,
    PullUpRow,
    ReturnRow,
    SendHomeRow,
    TradeoffRow
} from './PlanScheduleSyntheticRows'

/** Canonical column metadata. Each entry pairs a stable `key` with the
 *  header label that's already in use. The `key` flows through into
 *  `visibleColumns` so callers (the Schedule split view in particular)
 *  can render a narrower set without touching the row renderer's `<td>`
 *  order or duplicating the source of truth for column count. */
export const SCHEDULE_COLUMN_DEFS = [
    { key: 'start', label: 'Start' },
    { key: 'plant', label: 'Plant' },
    { key: 'order', label: 'Order' },
    { key: 'customer', label: 'Customer' },
    { key: 'location', label: 'Location' },
    { key: 'product', label: 'Product' },
    { key: 'yards', label: 'Yards' },
    { key: 'loaded', label: 'Loaded' },
    { key: 'load', label: 'Load' },
    { key: 'trucks', label: 'Trucks' },
    { key: 'travel', label: 'Travel' },
    { key: 'spacing', label: 'Spacing' },
    { key: 'contact', label: 'Contact' }
]

export const SCHEDULE_ALL_COLUMN_KEYS = SCHEDULE_COLUMN_DEFS.map((c) => c.key)

/** Default narrow set used by the Schedule split view. Compare mode strips
 *  the cells that aren't useful at a side-by-side glance (per-truck pool
 *  margins, ticket counts, contact info) so the dispatcher can read the
 *  pair of schedules without scrolling sideways. The split view exposes
 *  a toggle to drop back to the full column set. */
export const SCHEDULE_COMPARE_DEFAULT_COLUMNS = ['start', 'plant', 'order', 'customer', 'location', 'yards', 'spacing']

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
    compareMode,
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
    for (const order of orders) {
        /* Compare-view placeholders flow through the `orders` list with
         * `__placeholder: 'added' | 'removed'`. Treat them as their own row
         * kind so the renderer can ghost them, and so synthetic-row helpers
         * (returns, clock-ins, etc.) never try to attach pool data to a row
         * that isn't a real order. */
        if (order?.__placeholder) {
            rows.push({
                kind: 'placeholder',
                order,
                placeholderKind: order.__placeholder,
                time: timeToMinutes(order.startTime)
            })
        } else {
            rows.push({ kind: 'order', order, time: timeToMinutes(order.startTime) })
        }
    }
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
            homePlant: row.homePlant ?? null,
            kind: 'help',
            poolAfterAtHome: Number.isFinite(row.poolAfterAtHome) ? row.poolAfterAtHome : null,
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
    // Standalone open-window slot rows used to render here. They've been
    // pulled per dispatcher feedback — the open-window content still surfaces
    // inline on the `tradeoff` row (when a matching send-home exists) so the
    // dispatcher sees the booking suggestion in context instead of as its
    // own noisy line item. `filteredSuggestedSlotRows` is still consumed
    // above for that merging, so the upstream computation stays put.
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
    //
    // Compare mode is a special case: the split-view caller has already
    // produced pair-aligned snapshot + live arrays where index `i` on one
    // side is paired with index `i` on the other. The internal re-sort
    // here would break that alignment — placeholders carry priority 7
    // while real orders carry priority 6, so two pairs sharing a minute
    // can sort to different positions on each side (the snap column has
    // a real order in slot A and a placeholder in slot B; the live
    // column has the placeholder in slot A and the real in slot B; the
    // re-sort then puts them in different sequences). Skip the re-sort
    // in compare mode and trust the upstream pair sequence.
    const hasSyntheticRows = rows.some((r) => r.kind !== 'order')
    if (hasSyntheticRows && !compareMode) {
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

/** Right-click context menu hook for order rows + the "View tickets" /
 *  "View order" modals it launches. Lives at the table level (not inside the
 *  row map) because the menu needs to render once at fixed screen coords
 *  and dismiss on outside click. */
function useRowContextMenu() {
    const [rowMenu, setRowMenu] = useState(null)
    const [ticketsOrder, setTicketsOrder] = useState(null)
    const [infoOrder, setInfoOrder] = useState(null)
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
    return { infoOrder, openRowMenu, rowMenu, setInfoOrder, setRowMenu, setTicketsOrder, ticketsOrder }
}

/**
 * Schedule table — flat, sticky-header table of every order, optionally
 * interleaved with synthetic rows (truck returns, help transfers, send-home,
 * pull-ups, slot suggestions, clock-ins) when a plant filter is active.
 */
export default function PlanScheduleTable({
    accentColor,
    clockInRows = [],
    /** Compare-view flag. Hides annotation badges (status / service /
     *  hours-limit / needs-help) so each row's height stays predictable
     *  and the snapshot / live tables read row-for-row at the same Y. */
    compareMode = false,
    detailByOrderId = {},
    filteredPlantCode = null,
    firstLoadOutByPlant = null,
    getCloserPlantForOrder,
    getJobTravelMin,
    getTravelOverrides,
    helpRows = [],
    isMaximized = false,
    isPastDay = false,
    isPlantFiltered = false,
    isToday = false,
    keyForOrder,
    nowMin = null,
    onOpenAudit,
    onOpenLocation,
    orders,
    plantCityByCode,
    plantNameByCode,
    poolSourceByCode,
    poolTimeline,
    poolTimelinesByPlant,
    pullUpRows = [],
    /** Optional ref to attach to the table's scroll viewport. The split
     *  view passes a ref into each side so it can mirror scrollTop /
     *  scrollLeft between the two tables — single-table consumers can
     *  omit it. */
    scrollContainerRef,
    sendHomeRows = [],
    showExtraRows = true,
    suggestedSlotRows = [],
    /** Subset of `SCHEDULE_ALL_COLUMN_KEYS` to render, in canonical order.
     *  `null` (the default) renders every column — used by the regular
     *  Schedule tab. The split view passes a narrower list so each side
     *  shows just the essentials. */
    visibleColumns = null
}) {
    const { infoOrder, openRowMenu, rowMenu, setInfoOrder, setRowMenu, setTicketsOrder, ticketsOrder } =
        useRowContextMenu()

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
                compareMode,
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
            extrasActive,
            compareMode
        ]
    )

    /** Resolved column visibility set + matching column definitions, used
     *  by the header, every row, and every synthetic-row colSpan. */
    const visibleColumnSet = useMemo(() => {
        if (!Array.isArray(visibleColumns) || visibleColumns.length === 0) {
            return new Set(SCHEDULE_ALL_COLUMN_KEYS)
        }
        return new Set(visibleColumns)
    }, [visibleColumns])
    const visibleColumnDefs = useMemo(
        () => SCHEDULE_COLUMN_DEFS.filter((c) => visibleColumnSet.has(c.key)),
        [visibleColumnSet]
    )
    /* Synthetic + placeholder rows render their primary cell with
     * colSpan so they fill every column to the right of "start" + "plant".
     * Recompute it from the visible-column count so the layout stays tight
     * when the split view drops cells from the table. Floors at 1 so a
     * pathological column subset still renders a non-empty cell. */
    const syntheticBodyColSpan = Math.max(1, visibleColumnDefs.length - 2)

    return (
        <div className="relative">
            <div
                ref={scrollContainerRef}
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
                <table className="w-full text-[12.5px] border-collapse">
                    <thead>
                        <tr>
                            {visibleColumnDefs.map((col) => (
                                <th
                                    key={col.key}
                                    className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap bg-bg-tertiary border-b border-border-light text-text-secondary sticky z-10"
                                    style={{ boxShadow: '0 1px 0 0 var(--border-light)', top: 0 }}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows.map((row, idx) => {
                            const animationDelayMs = getScheduleRowDelay(idx)
                            const sharedProps = {
                                accentColor,
                                animationDelayMs,
                                bodyColSpan: syntheticBodyColSpan,
                                plantNameByCode,
                                row
                            }
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
                                case 'pullUp':
                                    return <PullUpRow key={`pull-up-${row.pullUpKey}`} {...sharedProps} />
                                case 'clockIn':
                                    return <ClockInRow key={`clock-in-${row.clockInKey}`} {...sharedProps} />
                                case 'sendHome':
                                    return <SendHomeRow key={`send-home-${row.sendHomeKey}`} {...sharedProps} />
                                case 'help':
                                    return <HelpRow key={`help-${row.helpKey}`} {...sharedProps} />
                                case 'placeholder':
                                    return (
                                        <PlaceholderRow
                                            key={`placeholder-${row.placeholderKind}-${row.order?.orderId || idx}`}
                                            {...sharedProps}
                                        />
                                    )
                                default: {
                                    const o = row.order
                                    const rowKey = keyForOrder(o)
                                    /* Per-plant 14h anchor — THIS row's
                                     * plant, not the global earliest. */
                                    const rowFirstLoadOutMin = firstLoadOutByPlant?.get(o.plantCode) ?? null
                                    return (
                                        <PlanScheduleOrderRow
                                            key={`${o.plantCode}-${o.orderId || idx}`}
                                            accentColor={accentColor}
                                            compareMode={compareMode}
                                            animationDelayMs={animationDelayMs}
                                            detail={o.orderId ? detailByOrderId[o.orderId] : null}
                                            firstLoadOutMin={rowFirstLoadOutMin}
                                            getCloserPlantForOrder={getCloserPlantForOrder}
                                            isPastDay={isPastDay}
                                            isToday={isToday}
                                            nowMin={nowMin}
                                            onContextMenu={(e) => openRowMenu(e, o)}
                                            onOpenLocation={onOpenLocation}
                                            order={o}
                                            plantCityByCode={plantCityByCode}
                                            plantNameByCode={plantNameByCode}
                                            poolTimeline={poolTimeline}
                                            rowKey={rowKey}
                                            travelOverrides={getTravelOverrides ? getTravelOverrides(o) : undefined}
                                            visibleColumns={visibleColumnSet}
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
                            className="rounded-md py-1 min-w-[180px] bg-bg-primary border border-border-light fixed z-[9999]"
                            style={{
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
                                left: Math.min(rowMenu.x, window.innerWidth - 200),
                                top: Math.min(rowMenu.y, window.innerHeight - 80)
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setInfoOrder(rowMenu.order)
                                    setRowMenu(null)
                                }}
                                className="w-full text-left px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2 bg-transparent border-0 cursor-pointer hover:bg-[color:var(--bg-tertiary)] text-text-primary"
                            >
                                <i className="fas fa-clipboard-list text-[12px] text-text-tertiary" />
                                View order
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setTicketsOrder(rowMenu.order)
                                    setRowMenu(null)
                                }}
                                className="w-full text-left px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2 bg-transparent border-0 cursor-pointer hover:bg-[color:var(--bg-tertiary)] text-text-primary"
                            >
                                <i className="fas fa-ticket text-[12px] text-text-tertiary" />
                                View tickets
                            </button>
                            {onOpenAudit && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onOpenAudit(rowMenu.order)
                                        setRowMenu(null)
                                    }}
                                    className="w-full text-left px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2 bg-transparent border-0 cursor-pointer hover:bg-[color:var(--bg-tertiary)] text-text-primary"
                                >
                                    <i className="fas fa-clock-rotate-left text-[12px] text-text-tertiary" />
                                    Order audit
                                </button>
                            )}
                        </div>,
                        document.body
                    )}
                {ticketsOrder && (
                    <OrderTicketsModal
                        accentColor={accentColor}
                        detail={ticketsOrder.orderId ? detailByOrderId[ticketsOrder.orderId] : null}
                        getJobTravelMin={getJobTravelMin}
                        onClose={() => setTicketsOrder(null)}
                        order={ticketsOrder}
                        plantNameByCode={plantNameByCode}
                    />
                )}
                {infoOrder && (
                    <OrderInfoModal
                        accentColor={accentColor}
                        closerPlant={getCloserPlantForOrder ? getCloserPlantForOrder(infoOrder) : null}
                        coverage={buildOrderCoveragePayload(infoOrder, {
                            poolSourceByCode,
                            poolTimeline,
                            poolTimelinesByPlant,
                            rowKey: keyForOrder(infoOrder),
                            travelOverrides: getTravelOverrides ? getTravelOverrides(infoOrder) : undefined
                        })}
                        onClose={() => setInfoOrder(null)}
                        onOpenLocation={
                            onOpenLocation
                                ? (o) => {
                                      setInfoOrder(null)
                                      onOpenLocation(o)
                                  }
                                : undefined
                        }
                        onViewTickets={(o) => {
                            setInfoOrder(null)
                            setTicketsOrder(o)
                        }}
                        order={infoOrder}
                        plantName={plantNameByCode?.[infoOrder.plantCode] || ''}
                        ticketCount={
                            infoOrder.orderId ? (detailByOrderId?.[infoOrder.orderId]?.ticketCount ?? null) : null
                        }
                    />
                )}
            </div>
        </div>
    )
}
