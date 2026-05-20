/* eslint-disable max-lines */
import React from 'react'

import { clean, SLOT_ROW_ACCENT, SLOT_ROW_TINT } from '../../../../../utils/PlanScheduleUtility'
import { formatMinutesClock } from '../../../../../utils/PlanUtility'
import PourSizeBadge from '../../../common/PourSizeBadge'
import { PlantBadge } from './PlanScheduleBadges'
import PlanScheduleSyntheticRow from './PlanScheduleSyntheticRow'

/* ── Synthetic rows (non-order rows interleaved with the schedule) ──────
 * Each renderer here produces a single `<tr>` via `PlanScheduleSyntheticRow`.
 * They share a tight visual rhythm so order rows stay primary while these
 * read as quiet annotations between them. Row data shapes are produced by
 * the helpers in `PlanUtility` (computeClockInRows, computePullUpRows, …).
 */

const orderTagFromRow = (order, fallback = 'order') =>
    order?.orderNum ? `#${order.orderNum}` : order?.startTime ? String(order.startTime).slice(0, 5) : fallback

/**
 * Ghost / placeholder row used only by the Schedule compare view to keep
 * the snapshot and live tables aligned row-for-row. When an order exists
 * on ONE side but not the other, that side renders the real order and
 * the OPPOSITE side renders this placeholder at the same slot:
 *
 *   `placeholderKind: 'removed'` — order was on the 5:30 PM snapshot
 *     but is gone from the live schedule. Rendered on the LIVE side.
 *   `placeholderKind: 'added'`   — order is on the live schedule but
 *     wasn't on the snapshot. Rendered on the SNAPSHOT side.
 *
 *  The reference order (the one on the OTHER side) is shown faintly so
 *  the dispatcher can read what's missing / new at that row position.
 */
export function PlaceholderRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const isRemoved = row.placeholderKind === 'removed'
    const refOrder = row.order || {}
    const plantName = plantNameByCode?.[refOrder.plantCode] || ''
    const orderTag = orderTagFromRow(refOrder)
    const customerTag = clean(refOrder.customer)
    const accent = isRemoved ? '#dc2626' : '#16a34a'
    const tint = isRemoved ? 'rgba(220, 38, 38, 0.06)' : 'rgba(22, 163, 74, 0.06)'
    const icon = isRemoved ? 'fa-circle-minus' : 'fa-circle-plus'
    const pillLabel = isRemoved ? 'Removed from live' : 'Added since snapshot'
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor={accent}
            icon={icon}
            pillIcon={icon}
            pillLabel={pillLabel}
            plantCell={
                refOrder.plantCode ? <PlantBadge code={refOrder.plantCode} fallback={accent} name={plantName} /> : null
            }
            primary={
                <span className="text-text-secondary">
                    {orderTag !== 'order' && <b className="text-text-primary">{orderTag}</b>}
                    {customerTag ? (
                        <>
                            {orderTag !== 'order' ? ' · ' : ''}
                            <span className="text-text-primary">{customerTag}</span>
                        </>
                    ) : null}
                </span>
            }
            secondary={
                isRemoved
                    ? 'This order was on the 5:30 PM snapshot but is no longer on the live schedule.'
                    : 'This order is on the live schedule but wasn’t on the 5:30 PM snapshot.'
            }
            time={row.time}
            tint={tint}
        />
    )
}

export function ReturnRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const plantName = plantNameByCode?.[row.plantCode] || ''
    const orderTag = orderTagFromRow(row.order)
    const truckWord = row.count === 1 ? 'truck' : 'trucks'
    // Show the actual first/last return time inside the 30-min bucket so
    // dispatchers see exactly when trucks trickled in.
    const rangeLabel =
        Number.isFinite(row.rangeStart) && Number.isFinite(row.rangeEnd)
            ? row.rangeStart === row.rangeEnd
                ? formatMinutesClock(row.rangeStart)
                : `${formatMinutesClock(row.rangeStart)}–${formatMinutesClock(row.rangeEnd)}`
            : null
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor="#16a34a"
            icon="fa-arrow-rotate-left"
            pillIcon="fa-truck-fast"
            pillLabel={`+${row.count} back`}
            plantCell={<PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />}
            primary={
                <>
                    <b>{row.plantCode}</b> now has{' '}
                    <b>{Number.isFinite(row.poolAfterReturn) ? row.poolAfterReturn : '—'}</b> operator
                    {row.poolAfterReturn === 1 ? '' : 's'} available
                </>
            }
            secondary={
                <>
                    {row.count} {truckWord} back from <b>{orderTag}</b>
                    {row.order.customer ? ` · ${clean(row.order.customer)}` : ''}
                    {rangeLabel && <span className="text-text-tertiary"> · trickled in {rangeLabel}</span>}
                </>
            }
            time={row.time}
            tint="rgba(22, 163, 74, 0.06)"
        />
    )
}

export function TradeoffRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const plantName = plantNameByCode?.[row.plantCode] || ''
    const freeCount = Number.isFinite(row.surplus) ? row.surplus : row.count
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor="#d97706"
            chips={
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#0369a1]">
                        <i className="fas fa-calendar-plus text-[9px]" />
                        Book:
                    </span>
                    {row.slots.map((slot) => (
                        <span
                            key={slot.key}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-[10.5px] bg-[rgba(14,_165,_233,_0.12)] text-[#0369a1]"
                            title={`${slot.minTrucks}+ trucks idle for ~${Math.round((slot.durationMin / 60) * 10) / 10}h starting ${formatMinutesClock(slot.time)}`}
                        >
                            {slot.label}
                        </span>
                    ))}
                    <span className="text-text-tertiary">or</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                        <i className="fas fa-house-user text-[9px]" />
                        Send {freeCount} home
                    </span>
                </div>
            }
            icon="fa-scale-balanced"
            pillIcon="fa-scale-balanced"
            pillLabel={`Decision · ${freeCount} idle`}
            plantCell={<PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />}
            primary={
                <>
                    <b>{row.plantCode}</b> has <b>{freeCount}</b> truck{freeCount === 1 ? '' : 's'} free — book new
                    work, or send them home.
                </>
            }
            time={row.time}
            tint="rgba(217, 119, 6, 0.07)"
        />
    )
}

export function SlotRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const plantName = plantNameByCode?.[row.plantCode] || ''
    const hours = Math.round((row.durationMin / 60) * 10) / 10
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor={SLOT_ROW_ACCENT}
            icon="fa-calendar-plus"
            pillIcon="fa-calendar-plus"
            pillLabel="Open window"
            plantCell={<PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />}
            primary={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                    <PourSizeBadge size={row.sizeKey} truckRange={row.truckRange} />
                    <span>
                        <b>{row.plantCode}</b> could take a <b>{row.truckRange}-truck</b> pour starting here.
                    </span>
                </span>
            }
            secondary={
                <>
                    {row.minTrucks}+ trucks idle · ~{hours}h window from {formatMinutesClock(row.time)}
                </>
            }
            time={row.time}
            tint={SLOT_ROW_TINT}
        />
    )
}

export function PullUpRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const plantName = plantNameByCode?.[row.plantCode] || ''
    const customerName = clean(row.order?.customer)
    const orderTag = orderTagFromRow(row.order)
    const deltaH = Math.floor(row.pullUpDeltaMin / 60)
    const deltaM = row.pullUpDeltaMin % 60
    const deltaLabel = deltaH > 0 ? `${deltaH}h${deltaM > 0 ? ` ${deltaM}m` : ''}` : `${deltaM}m`
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor="#0d9488"
            icon="fa-arrow-left-long"
            pillIcon="fa-clock-rotate-left"
            pillLabel={`Compact · ${deltaLabel} earlier`}
            plantCell={<PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />}
            primary={
                <>
                    Try moving <b>{orderTag}</b>
                    {customerName ? (
                        <>
                            {' '}
                            · <b>{customerName}</b>
                        </>
                    ) : null}{' '}
                    from <b>{formatMinutesClock(row.originalStartMin)}</b> to{' '}
                    <b>{formatMinutesClock(row.suggestedStartMin)}</b>.
                </>
            }
            secondary={
                <>
                    <b>{row.plantCode}</b> has <b>{row.truckCount}</b> truck{row.truckCount === 1 ? '' : 's'} idle here
                    that{' '}
                    {row.order?.yardage ? (
                        <>
                            could pour this <b>{Math.round(row.yardage)} yd</b> job
                        </>
                    ) : (
                        <>could absorb this pour</>
                    )}{' '}
                    instead of waiting until <b>{formatMinutesClock(row.originalStartMin)}</b>. Notify customer by{' '}
                    <b>{formatMinutesClock(row.notifyByMin)}</b>.
                    <span className="text-text-tertiary">
                        {' '}
                        · When working the phones, start with the latest-scheduled customers first.
                    </span>
                </>
            }
            time={row.time}
            tint="rgba(13, 148, 136, 0.06)"
        />
    )
}

export function ClockInRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const plantName = plantNameByCode?.[row.plantCode] || ''
    const orderTag = row.forOrder?.orderNum
        ? `#${row.forOrder.orderNum}`
        : row.forOrder?.startTime
          ? String(row.forOrder.startTime).slice(0, 5)
          : null
    const customerTag = row.forOrder?.customer ? clean(row.forOrder.customer) : null
    const staggerLabel =
        row.firstTime === row.lastTime
            ? formatMinutesClock(row.firstTime)
            : `${formatMinutesClock(row.firstTime)}–${formatMinutesClock(row.lastTime)}`
    // Average gap between consecutive clock-ins, rounded to the nearest 5 min
    // so the dispatcher gets a clean cadence (e.g. "every 15 min").
    const stagger5 =
        row.count > 1 && row.lastTime > row.firstTime
            ? Math.max(5, Math.round((row.lastTime - row.firstTime) / (row.count - 1) / 5) * 5)
            : null
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor="#16a34a"
            icon="fa-user-clock"
            pillIcon="fa-right-to-bracket"
            pillLabel="Clock in"
            plantCell={<PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />}
            primary={
                <>
                    <b>{row.count}</b> operator{row.count === 1 ? '' : 's'} clock in at <b>{row.plantCode}</b>
                    {orderTag ? (
                        <>
                            {' '}
                            for <b>{orderTag}</b>
                            {customerTag ? ` · ${customerTag}` : ''}
                        </>
                    ) : null}
                    .
                </>
            }
            secondary={
                row.count > 1
                    ? `Staggered ${staggerLabel}${stagger5 ? ` · about every ${stagger5} min` : ''} — early enough to pre-trip, load, slump, drive, and arrive ~5 min before pour.`
                    : `Clocks in early enough to pre-trip, load, slump, drive, and arrive ~5 min before pour.`
            }
            time={row.time}
            tint="rgba(22, 163, 74, 0.07)"
        />
    )
}

export function SendHomeRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const plantName = plantNameByCode?.[row.plantCode] || ''
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor="#64748b"
            icon="fa-house-user"
            pillIcon="fa-door-open"
            pillLabel="Clock out"
            plantCell={<PlantBadge code={row.plantCode} fallback={accentColor} name={plantName} />}
            primary={
                <>
                    Send <b>{row.count}</b> operator{row.count === 1 ? '' : 's'} home from <b>{row.plantCode}</b>.
                </>
            }
            secondary={`Pool stays covered for the rest of the day.`}
            time={row.time}
            tint="rgba(100, 116, 139, 0.07)"
        />
    )
}

export function HelpRow({ accentColor, animationDelayMs, bodyColSpan, plantNameByCode, row }) {
    const isOutbound = row.direction === 'outbound'
    const homePlant = row.returnPlant || row.fromPlant
    const fromName = plantNameByCode?.[row.fromPlant] || ''
    const toName = plantNameByCode?.[row.toPlant] || ''
    const homeName = plantNameByCode?.[homePlant] || ''
    const accent = isOutbound ? '#3b82f6' : '#8b5cf6'
    const tint = isOutbound ? 'rgba(59, 130, 246, 0.06)' : 'rgba(139, 92, 246, 0.06)'
    // On the return leg, the "plant cell" shows {toPlant} → {homePlant}
    // since those are the actual ends of the movement.
    const plantCell = isOutbound ? (
        <div className="flex items-center gap-1.5">
            <PlantBadge code={row.fromPlant} fallback={accentColor} name={fromName} />
            <i className="fas fa-arrow-right text-[9px] text-text-tertiary" />
            <PlantBadge code={row.toPlant} fallback={accentColor} name={toName} />
        </div>
    ) : (
        <div className="flex items-center gap-1.5">
            <PlantBadge code={row.toPlant} fallback={accentColor} name={toName} />
            <i className="fas fa-arrow-right text-[9px] text-text-tertiary" />
            <PlantBadge code={homePlant} fallback={accentColor} name={homeName} />
        </div>
    )
    const forOrder = row.forOrder
    const jobTag = forOrder
        ? forOrder.orderNum
            ? `#${forOrder.orderNum}`
            : forOrder.startTime
              ? String(forOrder.startTime).slice(0, 5)
              : 'that job'
        : null
    const customerTag = forOrder?.customer && clean(forOrder.customer) ? clean(forOrder.customer) : null
    const returnsHome = homePlant === row.fromPlant
    return (
        <PlanScheduleSyntheticRow
            animationDelayMs={animationDelayMs}
            bodyColSpan={bodyColSpan}
            accentColor={accent}
            icon={isOutbound ? 'fa-paper-plane' : 'fa-rotate-left'}
            pillIcon={isOutbound ? 'fa-truck-fast' : 'fa-truck-ramp-box'}
            pillLabel={isOutbound ? 'Help sent' : 'Help returning'}
            plantCell={plantCell}
            primary={
                isOutbound ? (
                    <>
                        <b>{row.count}</b> truck{row.count === 1 ? '' : 's'} leaving <b>{row.fromPlant}</b>{' '}
                        {forOrder ? (
                            <>
                                to load for <b>{jobTag}</b>
                                {customerTag ? ` · ${customerTag}` : ''} at <b>{row.toPlant}</b>.
                            </>
                        ) : (
                            <>
                                to back up <b>{row.toPlant}</b>.
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <b>{homePlant}</b>{' '}
                        {Number.isFinite(row.poolAfterAtHome) ? (
                            <>
                                now has <b>{row.poolAfterAtHome}</b> operator{row.poolAfterAtHome === 1 ? '' : 's'}{' '}
                                available
                            </>
                        ) : (
                            <>
                                gets <b>{row.count}</b> operator{row.count === 1 ? '' : 's'} back
                            </>
                        )}
                    </>
                )
            }
            secondary={
                isOutbound ? (
                    <>
                        {row.toPlant}&apos;s pool goes up by {row.count} until they return
                        {returnsHome ? (
                            <>
                                {' '}
                                to <b>{row.fromPlant}</b>.
                            </>
                        ) : (
                            <>
                                {' '}
                                — heading to <b>{homePlant}</b> afterward (not back to {row.fromPlant}).
                            </>
                        )}
                        {Number.isFinite(row.clockInRangeStart) && (
                            <>
                                {' · '}
                                <b>{row.count}</b> operator{row.count === 1 ? '' : 's'} clock in at{' '}
                                <b>{row.fromPlant}</b>{' '}
                                <b>
                                    {row.clockInRangeStart === row.clockInRangeEnd
                                        ? formatMinutesClock(row.clockInRangeStart)
                                        : `${formatMinutesClock(row.clockInRangeStart)}–${formatMinutesClock(row.clockInRangeEnd)}`}
                                </b>{' '}
                                (pre-trip + drive to <b>{row.toPlant}</b>).
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <b>{row.count}</b> help truck{row.count === 1 ? '' : 's'} home from <b>{row.toPlant}</b>
                        {!returnsHome && <> (not back to {row.fromPlant})</>}
                        {' · '}pool credits the <b>{row.count}</b> operator{row.count === 1 ? '' : 's'} the moment they
                        land at <b>{homePlant}</b>.
                    </>
                )
            }
            time={row.time}
            tint={tint}
        />
    )
}
