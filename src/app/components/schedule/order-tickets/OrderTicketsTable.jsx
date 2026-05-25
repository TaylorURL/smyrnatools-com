/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { timeToMinutes } from '../../../../utils/PlanUtility'

// Sequential 1-based position of each ticket in this order's load sequence —
// gives the dispatcher a quick way to talk about "load 12 was late" without
// needing to read the dispatch ticket number.
//
// "Gap" = minutes between this ticket's load time and the PREVIOUS ticket's
// load time. Surfaces pour spacing at a glance — bunched-up loads and
// oversized gaps both jump out without the dispatcher having to do mental
// math on every row. Blank for the first row (nothing to compare against).
const TICKET_COLUMNS = [
    { align: 'right', label: 'Load' },
    { align: 'left', label: 'Plant' },
    { align: 'left', label: 'Order #' },
    { align: 'left', label: 'Ticket #' },
    { align: 'left', label: 'Truck #' },
    { align: 'left', label: 'Operator' },
    { align: 'left', label: 'Ticket time' },
    { align: 'left', label: 'Load time' },
    { align: 'right', label: 'Gap' },
    { align: 'right', label: 'Yards' }
]

/** Empty-state shown when no tickets have been loaded for the order yet. */
function EmptyTicketsState() {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 gap-2 text-center text-text-tertiary">
            <i className="fas fa-truck-fast text-[28px]" />
            <div className="text-[13px] font-semibold text-text-secondary">No tickets loaded yet</div>
            <div className="text-[11.5px]">
                Trucks haven&apos;t started loading for this order, or the bridge hasn&apos;t synced new detail data
                yet.
            </div>
        </div>
    )
}

/**
 * Compute the effective gap (in minutes) between a ticket and the previous
 * ticket, optionally adjusted for cross-plant travel-time differences.
 *
 * Returns `{ gapMin, gapAdjustsForCrossPlant }` where `gapAdjustsForCrossPlant`
 * is true when the two tickets' loading plants differ AND travel data was
 * available for both — those rows display a number that is NOT just the raw
 * load-time delta.
 */
function computeJobArrivalGap({ currTicket, getJobTravelMin, idx, order, prevTicket }) {
    if (idx === 0 || !prevTicket) {
        return { gapAdjustsForCrossPlant: false, gapMin: null }
    }
    const currTravel = typeof getJobTravelMin === 'function' ? getJobTravelMin(order, currTicket.plantId) : null
    const prevTravel = typeof getJobTravelMin === 'function' ? getJobTravelMin(order, prevTicket.plantId) : null
    const haveBothTravels = Number.isFinite(currTravel) && Number.isFinite(prevTravel)
    const curr = timeToMinutes(currTicket.loadedTime)
    const prev = timeToMinutes(prevTicket.loadedTime)
    if (!Number.isFinite(curr) || !Number.isFinite(prev)) {
        return { gapAdjustsForCrossPlant: false, gapMin: null }
    }
    const gapMin = haveBothTravels ? curr + currTravel - (prev + prevTravel) : curr - prev
    const gapAdjustsForCrossPlant = Boolean(
        haveBothTravels && prevTicket.plantId && currTicket.plantId && prevTicket.plantId !== currTicket.plantId
    )
    return { gapAdjustsForCrossPlant, gapMin }
}

/** Single row in the tickets table. */
function TicketRow({
    accentColor,
    getJobTravelMin,
    homePlantCode,
    idx,
    normalizedHighlight,
    order,
    plantNameByCode,
    realized,
    resolveDriverName,
    ticket,
    tickets
}) {
    const plantCode = ticket.plantId
    const isHomePlant = plantCode === homePlantCode
    const plantName = plantNameByCode?.[plantCode] || ''
    const isKickerRow = !!realized?.kickerTicketIndices?.has(idx)
    const isFirstKickerRow = realized?.kickerStartIdx === idx
    const isHighlighted = normalizedHighlight !== '' && String(ticket.ticketNum || '').trim() === normalizedHighlight

    const prevTicket = idx > 0 ? tickets[idx - 1] : null
    const { gapAdjustsForCrossPlant, gapMin } = computeJobArrivalGap({
        currTicket: ticket,
        getJobTravelMin,
        idx,
        order,
        prevTicket
    })

    const driverName = resolveDriverName(ticket.driverName, ticket.driverNum)
    const yardsLabel =
        ticket.sourceReport === 'DetailDriver' && !ticket.quantity
            ? '—'
            : Number.isInteger(ticket.quantity)
              ? ticket.quantity
              : ticket.quantity.toFixed(2)

    return (
        <tr
            className="border-t border-border-light"
            style={{
                background: isHighlighted ? `${accentColor}26` : isKickerRow ? 'rgba(217, 119, 6, 0.06)' : undefined,
                borderLeft: isHighlighted ? `3px solid ${accentColor}` : undefined,
                borderTop: isFirstKickerRow ? '1px solid rgba(217, 119, 6, 0.4)' : undefined
            }}
        >
            <td
                className="px-3 py-2 font-mono font-semibold text-right whitespace-nowrap text-text-tertiary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {idx + 1}
                {isFirstKickerRow && (
                    <span
                        className="ml-1.5 inline-block text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-text-primary"
                        style={{ background: 'rgba(217, 119, 6, 0.15)' }}
                        title="First load after a gap — treated as a kicker (customer added yardage mid-pour). Excluded from pace calc."
                    >
                        Kicker
                    </span>
                )}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                <span className="font-mono font-semibold text-text-primary">{plantCode || '—'}</span>
                {plantName && <span className="ml-2 text-[11px] text-text-tertiary">{plantName}</span>}
                {!isHomePlant && plantCode && (
                    <span
                        className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-[rgba(217,_119,_6,_0.15)] text-text-primary"
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
            <td className="px-3 py-2 font-mono whitespace-nowrap text-text-primary">{ticket.ticketNum || '—'}</td>
            <td className="px-3 py-2 font-mono whitespace-nowrap text-text-primary">{ticket.truckNum || '—'}</td>
            <td className="px-3 py-2 whitespace-nowrap text-text-primary">{driverName || '—'}</td>
            <td
                className="px-3 py-2 font-mono whitespace-nowrap text-text-primary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {ticket.ticketTime || '—'}
            </td>
            <td
                className="px-3 py-2 font-mono whitespace-nowrap text-text-primary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {ticket.loadedTime || '—'}
            </td>
            <td
                className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-tertiary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                title={
                    gapMin == null
                        ? 'First load — no prior ticket to compare against'
                        : gapAdjustsForCrossPlant
                          ? `${gapMin} min effective gap at the job (load-time delta adjusted for plant-to-plant travel because at least one of these tickets loaded from a non-home plant)`
                          : `${gapMin} min since the previous load`
                }
            >
                {gapMin == null ? '—' : `${gapMin >= 0 ? '+' : ''}${gapMin}m${gapAdjustsForCrossPlant ? '*' : ''}`}
            </td>
            <td
                className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap text-text-primary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                title={
                    ticket.sourceReport === 'DetailDriver'
                        ? 'Yards not in DetailDriver report — cross-plant load'
                        : undefined
                }
            >
                {yardsLabel}
            </td>
        </tr>
    )
}

/** Sortable, scroll-aware tickets table. Renders the empty state when there are no rows. */
function OrderTicketsTable({
    accentColor,
    getJobTravelMin,
    homePlantCode,
    normalizedHighlight,
    order,
    plantNameByCode,
    realized,
    resolveDriverName,
    tickets
}) {
    if (tickets.length === 0) return <EmptyTicketsState />

    return (
        <table className="w-full text-[12.5px] border-collapse">
            <thead>
                <tr>
                    {TICKET_COLUMNS.map((h) => (
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
                {tickets.map((ticket, idx) => (
                    <TicketRow
                        accentColor={accentColor}
                        getJobTravelMin={getJobTravelMin}
                        homePlantCode={homePlantCode}
                        idx={idx}
                        key={ticket.ticketId || `${ticket.plantId}-${ticket.ticketNum || idx}-${idx}`}
                        normalizedHighlight={normalizedHighlight}
                        order={order}
                        plantNameByCode={plantNameByCode}
                        realized={realized}
                        resolveDriverName={resolveDriverName}
                        ticket={ticket}
                        tickets={tickets}
                    />
                ))}
            </tbody>
        </table>
    )
}

export default OrderTicketsTable
