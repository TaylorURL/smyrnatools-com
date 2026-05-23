/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtDate, fmtInt, fmtScorePct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel, formatColocatedPlantLabel } from '../../../../../utils/PlantColocationUtility'

const HEAVY = '#dc2626'
const SOFT = '#f59e0b'
const NEUTRAL = '#64748b'

/** Inline KPI tile mirroring the one on the parent page so the per-customer
 *  drawer reads with the same vocabulary as the top-of-page strip. */
function StatTile({ accent, icon, label, sub, value }) {
    return (
        <div className="flex items-start gap-3">
            {icon && (
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${accent || NEUTRAL}1a`, color: accent || NEUTRAL }}
                >
                    <i className={`fas ${icon} text-[14px]`} />
                </div>
            )}
            <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</div>
                <div
                    className="text-[22px] font-semibold tabular-nums leading-tight"
                    style={{ color: accent || 'var(--text-primary)' }}
                >
                    {value}
                </div>
                {sub && <div className="text-[10.5px] text-text-tertiary leading-tight">{sub}</div>}
            </div>
        </div>
    )
}

function EventBadge({ event }) {
    if (event.kind === 'cancel') {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full text-[10.5px] font-semibold px-2 py-0.5"
                style={{ background: 'rgba(220, 38, 38, 0.12)', color: HEAVY }}
            >
                <i className="fas fa-circle-minus text-[9px]" />
                Cancel
            </span>
        )
    }
    if (event.kind === 'move') {
        const arrow =
            event.timeDirection === 'earlier'
                ? 'fa-arrow-left-long'
                : event.timeDirection === 'later'
                  ? 'fa-arrow-right-long'
                  : 'fa-shuffle'
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full text-[10.5px] font-semibold px-2 py-0.5"
                style={{ background: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }}
            >
                <i className={`fas ${arrow} text-[9px]`} />
                Move
            </span>
        )
    }
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full text-[10.5px] font-semibold px-2 py-0.5"
            style={{ background: 'var(--bg-tertiary)', color: NEUTRAL }}
        >
            <i className="fas fa-pen-to-square text-[9px]" />
            Edit
        </span>
    )
}

function EventChangeList({ event }) {
    if (event.kind === 'cancel') {
        const time = event.snapshotTime || '—'
        return (
            <div className="text-[11.5px] text-text-secondary">
                Was scheduled for <span className="font-mono tabular-nums">{time}</span>; dropped before the truck
                rolled.
            </div>
        )
    }
    const changes = [...(event.moves || []), ...(event.edits || [])]
    if (!changes.length) return null
    return (
        <ul className="m-0 pl-4 text-[11.5px] text-text-secondary leading-snug">
            {changes.map((change) => (
                <li key={`${event.orderId}-${change.field}`} className="list-disc">
                    <span className="font-semibold">{change.label}</span>
                    <span className="text-text-tertiary">: </span>
                    <span className="font-mono tabular-nums">{change.before || '—'}</span>
                    <span className="text-text-tertiary mx-1.5">→</span>
                    <span className="font-mono tabular-nums">{change.after || '—'}</span>
                </li>
            ))}
        </ul>
    )
}

/** Per-customer drill-down drawer — KPIs on top, chronological event
 *  timeline below. Mounted by the parent page when a row is selected. */
export default function PlanStatisticsMovesCancelsDetail({ colocationMap, customer, onClose, plantNameByCode }) {
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold m-0 truncate text-text-primary" title={customer.name}>
                        {customer.name || '(unnamed)'}
                    </h3>
                    <div className="text-[11.5px] text-text-tertiary tabular-nums mt-0.5">
                        {fmtInt(customer.cancelCount)} cancel{customer.cancelCount === 1 ? '' : 's'} ·{' '}
                        {fmtInt(customer.moveCount)} move{customer.moveCount === 1 ? '' : 's'} ·{' '}
                        {fmtInt(customer.editCount)} edit{customer.editCount === 1 ? '' : 's'} ·{' '}
                        {fmtInt(customer.orderCount)} total order{customer.orderCount === 1 ? '' : 's'}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[11.5px] text-text-secondary cursor-pointer bg-transparent border-none p-1"
                    title="Clear selection"
                >
                    Close
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5 pb-4 border-b border-border-light">
                <StatTile
                    accent={HEAVY}
                    icon="fa-circle-minus"
                    label="Cancel rate"
                    sub="of total orders"
                    value={fmtScorePct(customer.cancelRate)}
                />
                <StatTile
                    accent={SOFT}
                    icon="fa-shuffle"
                    label="Move rate"
                    sub="of total orders"
                    value={fmtScorePct(customer.moveRate)}
                />
                <StatTile
                    icon="fa-layer-group"
                    label="Churn events"
                    sub="cancels + moves"
                    value={fmtInt(customer.churnEvents)}
                />
                <StatTile
                    accent={customer.churnRate >= 0.5 ? HEAVY : undefined}
                    icon="fa-gauge-high"
                    label="Churn %"
                    sub="combined rate"
                    value={fmtScorePct(customer.churnRate)}
                />
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                Event timeline ({fmtInt(customer.events.length)})
            </div>
            {customer.events.length === 0 ? (
                <div className="text-[12px] py-4 text-text-tertiary">
                    No moves or cancels recorded for this customer in the window.
                </div>
            ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                    {customer.events.map((event, index) => (
                        <li
                            key={`${event.orderId}-${event.date}-${event.kind}-${index}`}
                            className="rounded-md border border-border-light bg-bg-secondary px-3 py-2.5 flex flex-col gap-1.5"
                        >
                            <div className="flex items-center gap-2 flex-wrap">
                                <EventBadge event={event} />
                                <span className="text-[11.5px] text-text-secondary tabular-nums">
                                    {fmtDate(event.date)}
                                </span>
                                {event.orderNum && (
                                    <span className="text-[11px] text-text-tertiary">#{event.orderNum}</span>
                                )}
                                <span className="text-[11px] text-text-tertiary">
                                    <span className="font-mono tabular-nums mr-1">
                                        {formatColocatedCodeLabel(event.plantCode, colocationMap)}
                                    </span>
                                    {formatColocatedPlantLabel(event.plantCode, plantNameByCode, colocationMap)}
                                </span>
                                {Number.isFinite(event.yardage) && event.yardage > 0 && (
                                    <span className="text-[11px] text-text-tertiary tabular-nums">
                                        {fmtInt(event.yardage)} yd
                                    </span>
                                )}
                            </div>
                            <EventChangeList event={event} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
