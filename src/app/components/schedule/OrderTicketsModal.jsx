/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom'

import {
    computeRequestedYardsPerHour,
    parseDurationMinutes,
    splitTicketsAtKicker,
    timeToMinutes
} from '../../../utils/PlanUtility'
import { useOperatorNameLookup } from '../../hooks/useOperatorNameLookup'
import { clean } from './order-tickets/orderTicketHelpers'
import OrderTicketsHeader from './order-tickets/OrderTicketsHeader'
import OrderTicketsMetricsStrip from './order-tickets/OrderTicketsMetricsStrip'
import OrderTicketsTable from './order-tickets/OrderTicketsTable'

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
function OrderTicketsModal({
    accentColor = '#2563eb',
    detail,
    getJobTravelMin,
    highlightedTicketNum = null,
    inline = false,
    onClose,
    order,
    plantNameByCode
}) {
    const { resolve: resolveDriverName } = useOperatorNameLookup()

    useEffect(() => {
        if (inline) return undefined
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
    }, [inline, onClose])

    const normalizedHighlight = highlightedTicketNum != null ? String(highlightedTicketNum).trim() : ''

    const orderTotal = parseFloat(order?.yardage) || 0
    const orderLoadSize = parseFloat(order?.loadSize) || 0
    const orderNumLabel = order?.orderNum ? `#${order.orderNum}` : ''
    const customerLabel = clean(order?.customer)
    const homePlantCode = order?.plantCode || ''
    const homePlantName = plantNameByCode?.[homePlantCode] || ''

    /** Defensive client-side allocator. Mirrors the upstream
     *  `DispatchDataService.buildDetailByOrderId` allocation but runs at
     *  the modal layer too, so cross-plant DetailDriver-only tickets get
     *  estimated quantities even when the service-layer fallback chain
     *  happens to miss this order (e.g., `plantProduction` lands after
     *  the detail fetch resolved and the service's secondary refetch
     *  hasn't completed yet, or a stale `detailByOrderId` is sitting in
     *  state from before the `plans` table had the curated yardage).
     *
     *  Strategy per ticket:
     *   - confirmed (non-DetailDriver) tickets pass through untouched.
     *   - DetailDriver-only tickets with `quantity > 0` already from the
     *     service allocator also pass through (we never override the
     *     authoritative result).
     *   - DetailDriver-only tickets with `quantity === 0` get
     *     `min(loadSize, remaining)`, where `remaining =
     *     order.yardage − sum of confirmed ticket quantities`. */
    const tickets = useMemo(() => {
        const raw = Array.isArray(detail?.tickets) ? detail.tickets : []
        if (raw.length === 0 || orderTotal <= 0) return raw
        const confirmedTotal = raw.reduce(
            (sum, t) => (t?.sourceReport === 'DetailDriver' ? sum : sum + (parseFloat(t?.quantity) || 0)),
            0
        )
        // Also count any DetailDriver tickets that the upstream allocator
        // already filled in — we don't want to re-allocate yardage that
        // service-layer code already accounted for.
        const upstreamEstimateTotal = raw.reduce(
            (sum, t) => (t?.sourceReport === 'DetailDriver' ? sum + (parseFloat(t?.quantity) || 0) : sum),
            0
        )
        let remaining = Math.max(0, orderTotal - confirmedTotal - upstreamEstimateTotal)
        if (remaining <= 0) return raw
        let backfilled = false
        const next = raw.map((t) => {
            if (t?.sourceReport !== 'DetailDriver') return t
            const currentQty = parseFloat(t?.quantity) || 0
            if (currentQty > 0) return t
            if (remaining <= 0) return t
            const allocation = orderLoadSize > 0 ? Math.min(orderLoadSize, remaining) : remaining
            remaining -= allocation
            backfilled = true
            return { ...t, quantity: allocation }
        })
        return backfilled ? next : raw
    }, [detail, orderTotal, orderLoadSize])

    /** Recompute loaded total from the (possibly backfilled) ticket array
     *  so the LOADED header reflects the same numbers shown per row. */
    const totalLoaded = useMemo(() => {
        const raw = Array.isArray(detail?.tickets) ? detail.tickets : []
        if (tickets === raw) return detail?.loadedYardage || 0
        return tickets.reduce((sum, t) => sum + (parseFloat(t?.quantity) || 0), 0)
    }, [detail, tickets])

    /** Realized pour metrics. Pace (YPH) is computed against the ORIGINAL
     *  cohort only — load times after a kicker gap (customer adding yardage
     *  mid-pour) are excluded. The full ticket span is still surfaced via
     *  first/last time, so the dispatcher can see both the original pour
     *  pace AND the total elapsed window when a kicker landed.
     *
     *  Pace span uses the LARGER of the original cohort's actual load span
     *  and its planned span ((expected loads − 1) × spacing) so a small
     *  job loaded in a 10-min burst doesn't read as "218 yd/hr". */
    const realized = useMemo(() => {
        const parsed = tickets
            .map((t, idx) => ({
                idx,
                mins: timeToMinutes(t?.loadedTime),
                quantity: parseFloat(t?.quantity) || 0,
                time: t?.loadedTime
            }))
            .filter((entry) => Number.isFinite(entry.mins) && entry.time)
            .sort((a, b) => a.mins - b.mins)
        if (!parsed.length) return null

        const loadSize = parseFloat(order?.loadSize) || 0
        const spacing = parseDurationMinutes(order?.rate) ?? 5
        const { kickerStartIndex } = splitTicketsAtKicker(
            parsed.map((p) => p.mins),
            spacing
        )
        const hasKicker = kickerStartIndex >= 0
        const original = hasKicker ? parsed.slice(0, kickerStartIndex) : parsed
        const kicker = hasKicker ? parsed.slice(kickerStartIndex) : []
        // Map original/kicker membership back to the input ticket order so
        // the table can flag rows visually.
        const kickerTicketIndices = new Set(kicker.map((p) => p.idx))

        const originalYardage = original.reduce((sum, t) => sum + t.quantity, 0)
        const kickerYardage = kicker.reduce((sum, t) => sum + t.quantity, 0)

        const firstOriginal = original[0]
        const lastOriginal = original[original.length - 1]
        const originalSpan = Math.max(0, lastOriginal.mins - firstOriginal.mins)

        const paceYardage = originalYardage > 0 ? originalYardage : 0
        const expectedTrucks =
            loadSize > 0 && paceYardage > 0 ? Math.max(1, Math.ceil(paceYardage / loadSize)) : original.length
        const plannedSpan = expectedTrucks > 1 ? (expectedTrucks - 1) * spacing : 0
        const effectiveSpan = Math.max(originalSpan, plannedSpan)
        const yph = effectiveSpan > 0 && paceYardage > 0 ? (paceYardage / effectiveSpan) * 60 : null
        const targetYph = computeRequestedYardsPerHour(loadSize, spacing)

        return {
            actualSpan: originalSpan,
            effectiveSpan,
            firstTime: parsed[0].time,
            hasKicker,
            kickerStartIdx: hasKicker ? parsed[kickerStartIndex].idx : null,
            kickerTicketIndices,
            kickerYardage,
            lastTime: parsed[parsed.length - 1].time,
            originalYardage,
            plannedSpan,
            targetYph,
            ticketCount: parsed.length,
            yph
        }
    }, [order?.loadSize, order?.rate, tickets])

    const card = (
        <div
            onClick={inline ? undefined : (e) => e.stopPropagation()}
            /* Entrance: card "rises" into focus with a small translate +
             * fade over 0.3s. Paired with the backdrop's 0.2s fade below,
             * the staggering reads as layered depth (backdrop arrives
             * first, content settles on top) instead of both surfaces
             * popping in flat. `motion-reduce:animate-none` honors the
             * OS reduced-motion preference. Inline embed skips the
             * animation since it isn't a modal entrance in that mode. */
            className={`rounded-2xl flex flex-col w-full overflow-hidden bg-bg-primary border border-border-light ${
                inline ? '' : 'animate-dv-fade-in motion-reduce:animate-none'
            }`}
            style={
                inline
                    ? undefined
                    : {
                          boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                          maxHeight: '90vh',
                          maxWidth: 900
                      }
            }
        >
            <OrderTicketsHeader
                accentColor={accentColor}
                customerLabel={customerLabel}
                homePlantCode={homePlantCode}
                homePlantName={homePlantName}
                inline={inline}
                onClose={onClose}
                orderNumLabel={orderNumLabel}
                orderTotal={orderTotal}
                totalLoaded={totalLoaded}
            />

            {realized && <OrderTicketsMetricsStrip order={order} realized={realized} />}

            <div className="flex-1 overflow-auto">
                <OrderTicketsTable
                    accentColor={accentColor}
                    getJobTravelMin={getJobTravelMin}
                    homePlantCode={homePlantCode}
                    normalizedHighlight={normalizedHighlight}
                    order={order}
                    plantNameByCode={plantNameByCode}
                    realized={realized}
                    resolveDriverName={resolveDriverName}
                    tickets={tickets}
                />
            </div>
        </div>
    )

    if (inline) return card

    if (typeof document === 'undefined' || !document.body) return null

    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            /* Backdrop blur softens the page behind the modal so the
             * underlying table isn't a sharp distraction. Tuned the
             * opacity down from 0.55 → 0.45 because the blur already
             * does most of the focus-pulling work — keeping it darker
             * on top of the blur reads as heavy. */
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.45)] backdrop-blur-sm z-[2147483000] animate-fade-in-fast motion-reduce:animate-none"
        >
            {card}
        </div>,
        document.body
    )
}

export default OrderTicketsModal
