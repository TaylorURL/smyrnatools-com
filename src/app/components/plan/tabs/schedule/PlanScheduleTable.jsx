/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { buildOrderCoveragePayload, getScheduleRowDelay } from '../../../../../utils/PlanScheduleUtility'
import { usePlanScheduleRowContextMenu } from '../../../../hooks/usePlanScheduleRowContextMenu'
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
import PlanScheduleRowContextMenu from './table/PlanScheduleRowContextMenu'
import { buildTableRows, groupClockInRows } from './table/PlanScheduleTableRows'

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
    /** Optional `Map<customerKey, RiskRecord>` from `useCustomerRiskIndex`.
     *  Forwarded straight into each row so the customer cell can render
     *  the "Likely to Kick" / "Likely to Cancel/Move" badges without each
     *  row re-running the aggregation. */
    customerRiskIndex,
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
        usePlanScheduleRowContextMenu()

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
                                            customerRiskIndex={customerRiskIndex}
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
                <PlanScheduleRowContextMenu
                    onOpenAudit={
                        onOpenAudit
                            ? () => {
                                  onOpenAudit(rowMenu.order)
                                  setRowMenu(null)
                              }
                            : null
                    }
                    onViewOrder={() => {
                        setInfoOrder(rowMenu.order)
                        setRowMenu(null)
                    }}
                    onViewTickets={() => {
                        setTicketsOrder(rowMenu.order)
                        setRowMenu(null)
                    }}
                    rowMenu={rowMenu}
                />
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
