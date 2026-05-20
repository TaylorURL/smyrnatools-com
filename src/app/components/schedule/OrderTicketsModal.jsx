/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo } from 'react'

import { parseDurationMinutes, splitTicketsAtKicker, timeToMinutes } from '../../../utils/PlanUtility'
import { useOperatorNameLookup } from '../../hooks/useOperatorNameLookup'

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
function OrderTicketsModal({ accentColor = '#2563eb', detail, getJobTravelMin, onClose, order, plantNameByCode }) {
    const { resolve: resolveDriverName } = useOperatorNameLookup()
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
            ticketCount: parsed.length,
            yph
        }
    }, [order?.loadSize, order?.rate, tickets])

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
                    <div
                        className={`px-5 py-3 grid grid-cols-1 sm:grid-cols-${realized.hasKicker ? 4 : 3} gap-3 border-b bg-bg-secondary border-border-light`}
                    >
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
                                if (realized.yph == null) return 'no original yardage to pace'
                                const planned = realized.plannedSpan > 0 && realized.plannedSpan >= realized.actualSpan
                                const span = formatDuration(realized.effectiveSpan)
                                const base = planned ? `over planned ${span} pour` : `over actual ${span} pour`
                                return realized.hasKicker ? `${base} · excludes kicker` : base
                            })()}
                            label={realized.hasKicker ? 'Original pour pace' : 'Pour pace'}
                            value={formatYph(realized.yph)}
                        />
                        {realized.hasKicker && (
                            <MetricTile
                                hint={`${
                                    Number.isInteger(realized.originalYardage)
                                        ? realized.originalYardage
                                        : realized.originalYardage.toFixed(1)
                                } yd original + ${
                                    Number.isInteger(realized.kickerYardage)
                                        ? realized.kickerYardage
                                        : realized.kickerYardage.toFixed(1)
                                } yd kicker`}
                                label="Kicker added"
                                value={`+${
                                    Number.isInteger(realized.kickerYardage)
                                        ? realized.kickerYardage
                                        : realized.kickerYardage.toFixed(1)
                                } yd`}
                            />
                        )}
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
                                        // Minutes between this ticket's load time and the
                                        // PREVIOUS ticket's load time. Surfaces pour spacing
                                        // at a glance — bunched-up loads and oversized gaps
                                        // both jump out without the dispatcher having to do
                                        // mental math on every row. Blank for the first row
                                        // (nothing to compare against).
                                        { align: 'right', label: 'Gap' },
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
                                    const isKickerRow = !!realized?.kickerTicketIndices?.has(idx)
                                    const isFirstKickerRow = realized?.kickerStartIdx === idx
                                    /** Minutes between this ticket's effective arrival
                                     *  at the JOB site and the previous ticket's. Built
                                     *  from each ticket's own loading-plant-to-job
                                     *  travel time (via `getJobTravelMin`), so a truck
                                     *  loaded at a yard that's CLOSER to the job arrives
                                     *  sooner and a truck loaded FARTHER away arrives
                                     *  later — the gap reads as "how staggered are the
                                     *  trucks landing at the pour" not "how spaced are
                                     *  the loadouts at their respective plants". When
                                     *  the live travel table doesn't have a measurement
                                     *  for either plant against this job, we silently
                                     *  fall back to the raw load-time delta so the
                                     *  number is never blank just because traffic data
                                     *  is still warming up. */
                                    const prevTicket = idx > 0 ? tickets[idx - 1] : null
                                    const currTravel =
                                        typeof getJobTravelMin === 'function' ? getJobTravelMin(order, t.plantId) : null
                                    const prevTravel =
                                        prevTicket && typeof getJobTravelMin === 'function'
                                            ? getJobTravelMin(order, prevTicket.plantId)
                                            : null
                                    const haveBothTravels = Number.isFinite(currTravel) && Number.isFinite(prevTravel)
                                    const gapMin = (() => {
                                        if (idx === 0) return null
                                        const curr = timeToMinutes(t.loadedTime)
                                        const prev = timeToMinutes(prevTicket?.loadedTime)
                                        if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null
                                        if (!haveBothTravels) return curr - prev
                                        return curr + currTravel - (prev + prevTravel)
                                    })()
                                    /** Did the cross-plant geography actually shift the
                                     *  number this row shows? True when the two tickets'
                                     *  loading plants differ AND we had travel data for
                                     *  both — those are the rows where the displayed
                                     *  gap is NOT just the raw load-time delta. */
                                    const gapAdjustsForCrossPlant =
                                        gapMin != null &&
                                        haveBothTravels &&
                                        prevTicket?.plantId &&
                                        t.plantId &&
                                        prevTicket.plantId !== t.plantId
                                    return (
                                        <tr
                                            className="border-t border-border-light"
                                            key={t.ticketId || `${plantCode}-${t.ticketNum || idx}-${idx}`}
                                            style={{
                                                background: isKickerRow ? 'rgba(217, 119, 6, 0.06)' : undefined,
                                                borderTop: isFirstKickerRow
                                                    ? '1px solid rgba(217, 119, 6, 0.4)'
                                                    : undefined
                                            }}
                                        >
                                            <td
                                                className="px-3 py-2 font-mono font-semibold text-right whitespace-nowrap text-text-tertiary"
                                                style={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                                {idx + 1}
                                                {isFirstKickerRow && (
                                                    <span
                                                        className="ml-1.5 inline-block text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                        style={{
                                                            background: 'rgba(217, 119, 6, 0.15)',
                                                            color: '#b45309'
                                                        }}
                                                        title="First load after a gap — treated as a kicker (customer added yardage mid-pour). Excluded from pace calc."
                                                    >
                                                        Kicker
                                                    </span>
                                                )}
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
                                            <td className="px-3 py-2 whitespace-nowrap text-text-primary">
                                                {(() => {
                                                    const name = resolveDriverName(t.driverName, t.driverNum)
                                                    return name || '—'
                                                })()}
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
                                                {gapMin == null
                                                    ? '—'
                                                    : `${gapMin >= 0 ? '+' : ''}${gapMin}m${gapAdjustsForCrossPlant ? '*' : ''}`}
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
