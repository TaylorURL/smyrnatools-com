import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AddressAutocomplete from '../../../app/components/common/AddressAutocomplete'
import { PlantBadge } from '../../../app/components/plan/PlanScheduleBadges'
import useAddressDistances from '../../../app/hooks/useAddressDistances'
import useAdjacentDayPlantProduction from '../../../app/hooks/useAdjacentDayPlantProduction'
import useYesterdayOperatorRestFloor from '../../../app/hooks/useYesterdayOperatorRestFloor'
import { formatOrderAddress } from '../../../utils/AddressUtility'
import {
    buildBookingRequest,
    computeBookingConflict,
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_TRUCK_SPACING_MIN,
    findAlternateStartTimes,
    findCrossDaySuggestions,
    findRecommendedStartTime,
    rankPlantsForBooking,
    TRAVEL_MIN_HORIZON
} from '../../../utils/BookOrderUtility'
import DateUtility from '../../../utils/DateUtility'
import { clean, formatHhmm } from '../../../utils/PlanScheduleUtility'
import { getTodayDate, timeToMinutes } from '../../../utils/PlanUtility'

const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

const FIELD_LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wider mb-2'

const formatMinutesAsClock = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % 1440) + 1440) % 1440
    const h = Math.floor(wrapped / 60)
    const m = Math.floor(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Same-day shortcut — Smyrna's standing rule is that any pour booked for
 *  today goes out at 15:00 regardless of plant analysis. We bypass the
 *  geocoder, plant ranking, and conflict resolution entirely so the
 *  dispatcher gets a single direct instruction instead of computed
 *  suggestions that don't apply. */
function SameDayAdvice({ accentColor }) {
    return (
        <div
            className="rounded-lg p-4 flex items-start gap-3"
            style={{
                background: 'rgba(22, 163, 74, 0.08)',
                border: '1px solid rgba(22, 163, 74, 0.35)'
            }}
        >
            <div
                className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                style={{ background: accentColor, color: '#fff' }}
            >
                <i className="fas fa-clock text-[16px]" />
            </div>
            <div className="min-w-0">
                <div className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    Book this at 15:00
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Same-day bookings run at 15:00 — no plant analysis needed.
                </div>
            </div>
        </div>
    )
}

/** Wraps a result block so it fades + slides in on mount and fades out
 *  before unmounting. Drives the entrance/exit animation for every panel
 *  in the right-hand recommendations column so swapping between idle /
 *  loading / advice / conflict states never just snaps. The last live
 *  children are stashed in a ref so a state flip that simultaneously
 *  hides this branch AND nullifies its inner data (e.g. `top` going null
 *  on reset) still has something to fade out instead of vanishing. */
function FadeIn({ children, delayMs = 0, show }) {
    const [mounted, setMounted] = useState(show)
    const [visible, setVisible] = useState(false)
    const lastChildrenRef = useRef(children)
    if (show && children) lastChildrenRef.current = children

    useEffect(() => {
        let timer
        if (show) {
            setMounted(true)
            timer = setTimeout(() => setVisible(true), delayMs + 20)
        } else {
            setVisible(false)
            timer = setTimeout(() => setMounted(false), 400)
        }
        return () => clearTimeout(timer)
    }, [show, delayMs])

    if (!mounted) return null

    return (
        <div
            className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
        >
            {show ? children : lastChildrenRef.current}
        </div>
    )
}

const DECORATIVE_CYCLE_MS = 5000

/** Idle-state filler — rotates through every plant with at least one
 *  scheduled order on the selected date, swapping the schedule preview
 *  every few seconds so the right-hand pane has motion / depth even
 *  before the dispatcher submits. The `key` on the inner preview forces
 *  a remount on each cycle so the row-level slide-in animations re-fire
 *  and each plant arrives with the same visual rhythm a real result
 *  does. */
function DecorativeSchedulePreview({ accentColor, mixerCountsByPlant, plantProduction, plants }) {
    const eligiblePlants = useMemo(() => {
        return (plants || []).filter((p) => {
            const code = p?.plantCode || p?.plant_code
            const orders = plantProduction?.[code]?.orders
            return Array.isArray(orders) && orders.length > 0
        })
    }, [plants, plantProduction])

    const [index, setIndex] = useState(0)

    useEffect(() => {
        if (eligiblePlants.length <= 1) return undefined
        const id = setInterval(() => {
            setIndex((i) => (i + 1) % eligiblePlants.length)
        }, DECORATIVE_CYCLE_MS)
        return () => clearInterval(id)
    }, [eligiblePlants.length])

    if (eligiblePlants.length === 0) return null

    const plant = eligiblePlants[index % eligiblePlants.length]
    const plantCode = plant?.plantCode || plant?.plant_code
    const plantName = plant?.plantName || plant?.plant_name || plantCode

    return (
        <SchedulePreview
            key={plantCode}
            accentColor={accentColor}
            existingOrders={plantProduction?.[plantCode]?.orders || []}
            newOrder={null}
            plantCode={plantCode}
            plantName={plantName}
            poolForPlant={mixerCountsByPlant?.[plantCode] || 0}
        />
    )
}

const SCHEDULE_PREVIEW_HEADERS = ['Start', 'Plant', 'Order', 'Customer', 'Location', 'Product', 'Yards', 'Trucks']

/** Match the Schedule-tab table header — sticky `bg-tertiary` strip with an
 *  uppercase 10.5px label, divider via `borderBottom + boxShadow` so it reads
 *  the same on either side of the seam. */
const SchedulePreviewHeaderCell = ({ label }) => (
    <th
        className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap"
        style={{
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-light)',
            boxShadow: '0 1px 0 0 var(--border-light)',
            color: 'var(--text-secondary)'
        }}
    >
        {label}
    </th>
)

/**
 * Schedule-tab-styled preview of the recommended plant's day with the
 * proposed booking inserted in chronological position. The new row fades +
 * slides in on mount (and again whenever the proposed time / yardage
 * change), so the dispatcher visually sees where the booking will sit
 * relative to existing pours.
 */
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

/** "Pool tone" pill color, mirroring the schedule tab — < 0 = red
 *  (overbooked), 0–2 = amber (tight margin), ≥ 3 = green (comfortable
 *  headroom). */
const poolPillColor = (poolAfter) => {
    if (!Number.isFinite(poolAfter)) return 'var(--text-tertiary)'
    if (poolAfter < 0) return '#dc2626'
    if (poolAfter <= 2) return '#d97706'
    return '#16a34a'
}

function SchedulePreview({ accentColor, existingOrders, newOrder, plantCode, plantName, poolForPlant }) {
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
        <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: '1px solid var(--border-light)' }}
            >
                <i className="fas fa-table-list text-[11px]" style={{ color: 'var(--text-tertiary)' }} />
                <div
                    className="text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    {plantName} — schedule preview
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
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
                                    className="px-3 py-3 text-center italic"
                                    style={{ color: 'var(--text-tertiary)' }}
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
                                        className={`transition-all duration-700 ease-out ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
                                        style={{
                                            background: `${accentColor}1f`,
                                            borderTop: '1px solid var(--border-light)',
                                            boxShadow: `inset 3px 0 0 0 ${accentColor}`
                                        }}
                                    >
                                        <td
                                            className="px-3 py-2 font-mono font-bold whitespace-nowrap"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
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
                                        <td
                                            className="px-3 py-2 max-w-[220px]"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            —
                                        </td>
                                        <td
                                            className="px-3 py-2 whitespace-nowrap"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            —
                                        </td>
                                        <td
                                            className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {row.order.yardage}
                                        </td>
                                        <td
                                            className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
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
                            const address = formatOrderAddress(o, ', ')
                            const productCode = clean(o.productCode)
                            const description = clean(o.description)
                            const yards = parseFloat(o.yardage)
                            return (
                                <tr
                                    key={o.orderId || `${o.orderNum}-${row.startMin}`}
                                    className="animate-slide-in-row"
                                    style={{
                                        animationDelay: `${idx * 35}ms`,
                                        borderTop: '1px solid var(--border-light)'
                                    }}
                                >
                                    <td
                                        className="px-3 py-2 font-mono font-bold whitespace-nowrap"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {formatHhmm(o.startTime) || '—'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <PlantBadge
                                            code={o.plantCode || plantCode}
                                            fallback={accentColor}
                                            name={plantName}
                                        />
                                    </td>
                                    <td
                                        className="px-3 py-2 whitespace-nowrap font-semibold"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {o.orderNum ? `#${o.orderNum}` : '—'}
                                    </td>
                                    <td
                                        className="px-3 py-2 max-w-[220px]"
                                        style={{ color: 'var(--text-primary)' }}
                                        title={customer}
                                    >
                                        <span className="font-semibold truncate inline-block max-w-full align-middle">
                                            {customer}
                                        </span>
                                    </td>
                                    <td
                                        className="px-3 py-2 max-w-[220px]"
                                        style={{ color: 'var(--text-secondary)' }}
                                        title={address}
                                    >
                                        <span className="truncate inline-block max-w-full align-middle text-[11.5px] uppercase tracking-wide">
                                            {address || '—'}
                                        </span>
                                    </td>
                                    <td
                                        className="px-3 py-2 whitespace-nowrap"
                                        style={{ color: 'var(--text-primary)' }}
                                        title={description || undefined}
                                    >
                                        <span className="font-mono font-semibold">{productCode || '—'}</span>
                                        {description && (
                                            <span
                                                className="ml-1 max-w-[160px] truncate inline-block align-middle"
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                {description}
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {Number.isFinite(yards) && yards > 0 ? yards : '—'}
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
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

/* Reasons the system overrides the dispatcher's typed time. Mirrors the
 * priority used by `findRecommendedStartTime` so the explanation matches
 * which constraint actually flipped the suggestion. */
const AFTER_HOURS_CUTOFF_MIN = 13 * 60
const IDLE_GAP_THRESHOLD_MIN = 90

const buildShiftReason = ({ recommendedSlot, request }) => {
    if (request.startMin >= AFTER_HOURS_CUTOFF_MIN) {
        return 'Smyrna books every pour to start by 1:00 PM so trucks are back before end-of-shift.'
    }
    if (
        Number.isFinite(recommendedSlot.isolationMin) &&
        recommendedSlot.isolationMin <= IDLE_GAP_THRESHOLD_MIN &&
        recommendedSlot.preferred
    ) {
        return 'This slot keeps the new pour next to existing activity instead of stranding trucks idle for hours.'
    }
    if (recommendedSlot.preferred) {
        return 'This slot fits the size-appropriate window for the pour.'
    }
    return 'This slot keeps the day clustered and avoids idle gaps.'
}

/** Format an ISO date as "Wed, May 8" — used by the cross-day rows of
 *  the viable-slots panel so the dispatcher can read the date at a
 *  glance without parsing yyyy-mm-dd. */
const formatDayLabel = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(`${dateStr}T00:00:00`)
    if (!Number.isFinite(date.getTime())) return dateStr
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })
}

/**
 * "At least 3 viable options" panel — surfaces fitting start times for
 * the recommended plant on the requested day, then fills any shortfall
 * with the next non-Sunday days where the same plant can host the pour
 * cleanly. Each row is annotated so the dispatcher can tell at a glance
 * which slot the system picked first ("recommended") and which are
 * alternatives. When even the cross-day fallback can't muster three
 * fitting slots, the panel calls that out explicitly so the dispatcher
 * knows to revisit the request rather than chase an option that doesn't
 * exist.
 */
function ViableSlotsPanel({ accentColor, crossDaySuggestions, plantName, recommendedStartMin, sameDaySlots }) {
    const TARGET = 3
    const sameDayRows = sameDaySlots.slice(0, TARGET).map((slot) => ({
        dateLabel: null,
        free: slot.free,
        isRecommended: slot.startMin === recommendedStartMin,
        startMin: slot.startMin
    }))
    const remaining = Math.max(0, TARGET - sameDayRows.length)
    const crossDayRows = []
    if (remaining > 0) {
        for (const day of crossDaySuggestions) {
            for (const slot of day.slots) {
                crossDayRows.push({
                    dateLabel: formatDayLabel(day.dateStr),
                    free: slot.free,
                    isRecommended: false,
                    startMin: slot.startMin
                })
                if (crossDayRows.length >= remaining) break
            }
            if (crossDayRows.length >= remaining) break
        }
    }
    const allRows = [...sameDayRows, ...crossDayRows]
    const fellShort = allRows.length < TARGET

    return (
        <div
            className="rounded-lg p-4 flex flex-col gap-2"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="text-[10.5px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
            >
                Viable start times on {plantName}
            </div>
            {allRows.length > 0 ? (
                <div className="flex flex-col gap-1">
                    {allRows.map((row, idx) => (
                        <div
                            key={`${row.dateLabel || 'today'}-${row.startMin}-${idx}`}
                            className="flex items-center gap-2 text-[12px]"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            <i
                                className="fas fa-clock text-[10px]"
                                style={{ color: row.isRecommended ? accentColor : '#16a34a' }}
                            />
                            {row.dateLabel ? (
                                <span
                                    className="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
                                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                                >
                                    {row.dateLabel}
                                </span>
                            ) : (
                                <span
                                    className="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
                                    style={{
                                        background: row.isRecommended ? `${accentColor}1f` : 'var(--bg-secondary)',
                                        color: row.isRecommended ? accentColor : 'var(--text-tertiary)'
                                    }}
                                >
                                    {row.isRecommended ? 'Recommended' : 'Today'}
                                </span>
                            )}
                            <span className="font-mono tabular-nums font-semibold">
                                {formatMinutesAsClock(row.startMin)}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>· {row.free} trucks free</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    No viable slots on {plantName} for the requested day.
                </div>
            )}
            {fellShort && (
                <div
                    className="text-[11px] flex items-start gap-1.5 mt-1 pt-2"
                    style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-tertiary)' }}
                >
                    <i className="fas fa-circle-info text-[10px] mt-0.5" />
                    <span>
                        Couldn&apos;t find {TARGET} viable times — pick a different day on the form for more open
                        windows, or try a smaller / shorter pour.
                    </span>
                </div>
            )}
        </div>
    )
}

/** Single, action-oriented recommendation. Always shows the SYSTEM's best
 *  time for this booking on the closest plant — when the dispatcher's
 *  typed time matches, we just confirm it; when it doesn't (e.g. they
 *  typed 17:00 but every existing pour ends by 12:30), we override with
 *  the recommended slot and explain why. */
function RecommendationAdvice({ accentColor, recommendedSlot, request, top }) {
    const requestedTime = formatMinutesAsClock(request.startMin)
    const recommendedTime = recommendedSlot ? formatMinutesAsClock(recommendedSlot.startMin) : requestedTime
    const isShifted = recommendedSlot && recommendedSlot.startMin !== request.startMin
    const trucksNeededLabel = `${request.trucksNeeded} truck${request.trucksNeeded === 1 ? '' : 's'}`
    const distanceLabel = Number.isFinite(top.travelMin)
        ? `${top.travelMin} min from the job`
        : 'Closest plant to the job'
    const tone = isShifted
        ? {
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              icon: 'fa-arrow-rotate-left'
          }
        : { background: 'rgba(22, 163, 74, 0.08)', border: '1px solid rgba(22, 163, 74, 0.35)', icon: 'fa-thumbs-up' }
    const freeAtRecommended = recommendedSlot ? recommendedSlot.free : top.free
    const freeLabel = `${freeAtRecommended} truck${freeAtRecommended === 1 ? '' : 's'} free`
    return (
        <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: tone.background, border: tone.border }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                    style={{ background: accentColor, color: '#fff' }}
                >
                    <i className={`fas ${tone.icon} text-[16px]`} />
                </div>
                <div className="min-w-0">
                    <div className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        Book at {top.plantName} at {recommendedTime}{' '}
                        <span className="text-[12px] font-normal" style={{ color: 'var(--text-tertiary)' }}>
                            #{top.plantCode}
                        </span>
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {distanceLabel} · {freeLabel} at {recommendedTime}
                    </div>
                </div>
            </div>
            {isShifted ? (
                <div className="text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
                    The customer is requesting <strong>{requestedTime}</strong>, but <strong>{recommendedTime}</strong>{' '}
                    is recommended — {buildShiftReason({ recommendedSlot, request })} {top.plantName} can still cover
                    the {trucksNeededLabel} for this {request.yardage}-yd pour at the recommended slot.
                </div>
            ) : (
                <div className="text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
                    You&apos;re set. {top.plantName} is the closest plant and has the {trucksNeededLabel} this{' '}
                    {request.yardage}-yd pour needs at {recommendedTime}. Proceed with the booking.
                </div>
            )}
            {recommendedSlot?.tighterAlternative && (
                <div
                    className="rounded-md p-3 flex items-start gap-2.5 text-[12.5px] leading-snug"
                    style={{
                        background: 'rgba(217, 119, 6, 0.08)',
                        border: '1px solid rgba(217, 119, 6, 0.30)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <i className="fas fa-circle-info text-[12px] mt-0.5 shrink-0" style={{ color: '#b45309' }} />
                    <div>
                        <strong>Heads up:</strong> {recommendedTime} starts the day{' '}
                        {Math.round(
                            ((recommendedSlot.tighterAlternative.startMin - recommendedSlot.startMin) / 60) * 10
                        ) / 10}
                        h earlier than {top.plantName}&apos;s existing schedule (first existing pour is at{' '}
                        <strong>{formatMinutesAsClock(recommendedSlot.tighterAlternative.startMin)}</strong>). Booking
                        at {formatMinutesAsClock(recommendedSlot.tighterAlternative.startMin)} instead packs the day
                        tighter without expanding the shift envelope — {recommendedSlot.tighterAlternative.free} truck
                        {recommendedSlot.tighterAlternative.free === 1 ? '' : 's'} would still be free at that time.
                    </div>
                </div>
            )}
        </div>
    )
}

/** Conflict-resolution panel — only renders when the closest plant
 *  (forced to position #1) doesn't have enough free trucks. Suggests
 *  shifting the new order to a different time on the same plant, OR
 *  moving an existing overlapping order somewhere else. Both are
 *  read-only suggestions; the dispatcher still books manually. */
function BookingConflictPanel({ accentColor, conflict, request }) {
    if (!conflict) return null
    const { alternateTimes, helpAvailability, moveCandidates, plantCode, plantName, shortBy, sizeWindowAdvice } =
        conflict
    const requestedTime = request ? formatMinutesAsClock(request.startMin) : null

    /* Score each fix against the actual shortfall so we can lead with the
     * one that genuinely solves the problem instead of treating all three
     * as equal. The numbers come from the same data the existing chips
     * already render — no extra fetches. */
    const helpFleetTotal = (helpAvailability || []).reduce((sum, h) => sum + (h?.free || 0), 0)
    const helpCovers = helpFleetTotal >= shortBy
    const moveFleetTotal = (moveCandidates || []).reduce((sum, c) => sum + (c?.trucks || 0), 0)
    const movesCover = moveFleetTotal >= shortBy
    const fittingAlternates = (alternateTimes || []).filter((s) => s.fits)
    const hasFittingAlternate = fittingAlternates.length > 0

    /* Pick which option leads — the one most likely to actually fix the
     * shortage. Special case first: when the typed time is in the wrong
     * window for the pour size (big pour outside graveyard, small pour
     * outside business hours), prefer shifting to the size-appropriate
     * window over pulling help — even if help could cover the typed
     * time, running a 1000-yd pour through the day blocks every smaller
     * order. Then the standard cascade: help, then clean time shift,
     * then reschedule, then partial help, then no-fix. */
    let primary
    if (sizeWindowAdvice && sizeWindowAdvice.suggestedSlot) primary = 'shift'
    else if (helpCovers) primary = 'help'
    else if (hasFittingAlternate) primary = 'shift'
    else if (movesCover) primary = 'reschedule'
    else if (helpFleetTotal > 0) primary = 'help'
    else primary = 'none'

    /* Choose a clear action headline + subtitle the dispatcher can act on
     * directly — "Book at Baytown at 07:00 with help from 4 nearby plants"
     * reads better than "Baytown is short 16 trucks". The headline mirrors
     * the no-conflict `RecommendationAdvice` card so the visual hierarchy
     * is consistent: bold instruction up top, supporting detail below. */
    const fittingAlt = fittingAlternates[0]
    const helpPlantCount = (helpAvailability || []).length
    const requestedTimeLabel = requestedTime || 'the requested time'
    /* The size-window suggested slot wins when it exists, so the shift
     * branch can lead with the graveyard / business-hours target instead
     * of whatever happened to be the first fitting alternate. */
    const shiftTarget = sizeWindowAdvice?.suggestedSlot || (hasFittingAlternate ? fittingAlt : null)
    const yardageLabel = request?.yardage ? `${request.yardage}-yd` : ''
    const headlineCopy = (() => {
        if (primary === 'shift' && sizeWindowAdvice?.suggestedSlot) {
            const slot = sizeWindowAdvice.suggestedSlot
            const sizeKind = sizeWindowAdvice.isBigPour ? 'big' : 'small / medium'
            const stillShort = !slot.fits
            const titleSuffix = stillShort ? ' (will still need help to cover trucks)' : ''
            const subtitleTail = stillShort
                ? `${plantName} still needs ${slot.shortBy} more truck${slot.shortBy === 1 ? '' : 's'} at ${formatMinutesAsClock(slot.startMin)} — pull help in addition to shifting.`
                : `${plantName} has ${slot.free} truck${slot.free === 1 ? '' : 's'} free at ${formatMinutesAsClock(slot.startMin)}, no help needed.`
            return {
                subtitle: `${yardageLabel} pours belong in the ${sizeWindowAdvice.preferredWindowLabel} window — ${sizeKind} pours that run outside it tie up the day's pool. ${subtitleTail}`,
                title: `Shift to ${formatMinutesAsClock(slot.startMin)} on ${plantName} — ${sizeWindowAdvice.preferredWindowLabel} is the right window for a ${yardageLabel} pour${titleSuffix}`
            }
        }
        switch (primary) {
            case 'help':
                return helpCovers
                    ? {
                          subtitle: `Pull help from ${helpPlantCount} nearby plant${helpPlantCount === 1 ? '' : 's'} — they cover all ${shortBy} truck${shortBy === 1 ? '' : 's'} short. Keep the booking at ${requestedTimeLabel}.`,
                          title: `Book at ${plantName} at ${requestedTimeLabel} — pull help`
                      }
                    : {
                          subtitle: `Nearby plants cover ${helpFleetTotal} of the ${shortBy} trucks short. Book at ${requestedTimeLabel}, pull what you can, and split the remaining ${shortBy - helpFleetTotal} across another plant or shrink the order.`,
                          title: `Book at ${plantName} at ${requestedTimeLabel} — pull help (partial coverage)`
                      }
            case 'shift':
                return {
                    subtitle: `${plantName} can pour cleanly here without help — ${shiftTarget.free} truck${shiftTarget.free === 1 ? '' : 's'} free at ${formatMinutesAsClock(shiftTarget.startMin)}.`,
                    title: `Shift to ${formatMinutesAsClock(shiftTarget.startMin)} on ${plantName}`
                }
            case 'reschedule':
                return {
                    subtitle: `Move one or two of ${plantName}'s overlapping orders to clear ${shortBy} truck${shortBy === 1 ? '' : 's'} for this booking.`,
                    title: `Book at ${plantName} at ${requestedTimeLabel} — reschedule existing orders`
                }
            default:
                return {
                    subtitle: `${plantName} can't cover this on its own and no nearby plant can lend trucks. Split the booking, push the date out, or shrink the pour.`,
                    title: `${plantName} can't host this booking`
                }
        }
    })()
    const headlineTitle = headlineCopy.title
    const headlineSubtitle = headlineCopy.subtitle
    /* Help / shift recommendations get a confident green icon — they're a
     * clear next action. The "no fix" case keeps the warning amber. */
    const headlineTone =
        primary === 'none'
            ? { background: 'rgba(217, 119, 6, 0.18)', color: '#b45309', icon: 'fa-triangle-exclamation' }
            : { background: accentColor || '#1e3a5f', color: '#fff', icon: 'fa-thumbs-up' }

    /* Hide secondary sections that wouldn't actually help. Help is shown
     * whenever a nearby plant has any free trucks (might pair with a
     * size-window shift when the graveyard slot still needs help on
     * trucks); alternate-time chips only when at least one window fits
     * cleanly AND we're not already recommending a size-window shift
     * (which makes the alternates redundant); reschedule rows only when
     * help can't fully cover AND we're not shifting — once the new pour
     * moves out of business hours, the existing-order overlap goes away
     * and the move list no longer applies. */
    const isSizeShift = primary === 'shift' && !!sizeWindowAdvice?.suggestedSlot
    const showHelpSection = (helpAvailability || []).length > 0
    const showAlternatesSection = hasFittingAlternate && !isSizeShift
    const showMoveSection = (moveCandidates || []).length > 0 && !helpCovers && !isSizeShift

    /* Trim + annotate the help section so a 2-truck shortage doesn't
     * read as "9 plants × 14 free trucks each". Walks plants in
     * proximity order, splits the running gap across them ("lend 2",
     * "lend 3" for a 5-short), then surfaces one extra plant as a
     * "backup" option. When help can't fully cover, every plant shows
     * with its full free count so the dispatcher sees the partial
     * picture. */
    const helpRowsForDisplay = (() => {
        if (!helpAvailability?.length) return []
        if (!helpCovers) {
            return helpAvailability.map((h) => ({ ...h, isBackup: false, lendCount: h.free }))
        }
        let remaining = shortBy
        const out = []
        for (const h of helpAvailability) {
            if (remaining <= 0) {
                out.push({ ...h, isBackup: true, lendCount: 0 })
                break
            }
            const lend = Math.min(h.free, remaining)
            out.push({ ...h, isBackup: false, lendCount: lend })
            remaining -= lend
        }
        return out
    })()

    const sections = [
        showHelpSection && 'help',
        showAlternatesSection && 'shift',
        showMoveSection && 'reschedule'
    ].filter(Boolean)
    /* Lead with the primary fix — Array.sort is stable in modern engines
     * so the remaining sections keep their declaration order. */
    sections.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : 0))

    /* Frame the panel in amber only when we genuinely have no fix; when
     * there's an actionable next step (help / shift / reschedule) the
     * panel reads as guidance rather than a warning. */
    const panelTone =
        primary === 'none'
            ? { background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.35)' }
            : { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }

    return (
        <div className="rounded-lg p-4 flex flex-col gap-3" style={panelTone}>
            <div className="flex items-start gap-3">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                    style={{ background: headlineTone.background, color: headlineTone.color }}
                >
                    <i className={`fas ${headlineTone.icon} text-[16px]`} />
                </div>
                <div className="min-w-0">
                    <div className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {headlineTitle}
                        {plantCode && (
                            <span className="text-[12px] font-normal ml-2" style={{ color: 'var(--text-tertiary)' }}>
                                #{plantCode}
                            </span>
                        )}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {headlineSubtitle}
                    </div>
                </div>
            </div>

            {sections.map((section) => {
                if (section === 'help') {
                    const isPrimary = primary === 'help'
                    return (
                        <div key="help" className="flex flex-col gap-1.5">
                            <div
                                className="text-[10.5px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                                style={{ color: isPrimary ? '#15803d' : 'var(--text-tertiary)' }}
                            >
                                {isPrimary && <i className="fas fa-circle-check text-[10px]" />}
                                {isPrimary ? 'Recommended · pull help' : 'Help from nearby plants'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {helpRowsForDisplay.map((help) => {
                                    const tooltip = help.isBackup
                                        ? `${help.plantName} — backup option, ${help.free} free if you need more than the closer plants can spare`
                                        : `${help.plantName} could lend ${help.lendCount} of the ${shortBy} trucks needed (${help.free} total free)`
                                    return (
                                        <span
                                            key={help.plantCode}
                                            className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]"
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-light)',
                                                color: 'var(--text-primary)',
                                                opacity: help.isBackup ? 0.65 : 1
                                            }}
                                            title={tooltip}
                                        >
                                            <i
                                                className="fas fa-truck-arrow-right text-[10px]"
                                                style={{ color: help.isBackup ? 'var(--text-tertiary)' : '#16a34a' }}
                                            />
                                            <span className="font-semibold">{help.plantName}</span>
                                            <span style={{ color: 'var(--text-tertiary)' }}>
                                                {help.isBackup ? ' · backup' : ` · lend ${help.lendCount}`}
                                                {Number.isFinite(help.travelMinFromJob)
                                                    ? ` · ${help.travelMinFromJob} min`
                                                    : ''}
                                            </span>
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )
                }

                if (section === 'shift') {
                    const isPrimary = primary === 'shift'
                    return (
                        <div key="shift" className="flex flex-col gap-1.5">
                            <div
                                className="text-[10.5px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                                style={{ color: isPrimary ? '#15803d' : 'var(--text-tertiary)' }}
                            >
                                {isPrimary && <i className="fas fa-circle-check text-[10px]" />}
                                {isPrimary
                                    ? `Recommended · shift to a different time on ${plantName}`
                                    : `Or try a different time on ${plantName}`}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(hasFittingAlternate ? fittingAlternates : alternateTimes).map((slot) => {
                                    const fits = slot.fits
                                    const tone = fits ? '#16a34a' : '#b45309'
                                    const trailing = fits
                                        ? `${slot.free} trucks free`
                                        : 'will still need help to pour on pace'
                                    const tooltip = fits
                                        ? `${plantName} can cover this booking at ${formatMinutesAsClock(slot.startMin)} with no help or rescheduling.`
                                        : `${formatMinutesAsClock(slot.startMin)} is the best window ${plantName} can offer — ${slot.free} of ${slot.free + slot.shortBy} trucks free here, so you'll still need help from another plant to keep the pour on pace.`
                                    return (
                                        <span
                                            key={slot.startMin}
                                            className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]"
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-light)',
                                                color: 'var(--text-primary)'
                                            }}
                                            title={tooltip}
                                        >
                                            <i
                                                className={`fas ${fits ? 'fa-clock' : 'fa-circle-exclamation'} text-[10px]`}
                                                style={{ color: tone }}
                                            />
                                            <span className="font-mono tabular-nums font-semibold">
                                                {formatMinutesAsClock(slot.startMin)}
                                            </span>
                                            <span style={{ color: 'var(--text-tertiary)' }}>· {trailing}</span>
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )
                }

                if (section === 'reschedule') {
                    const isPrimary = primary === 'reschedule'
                    return (
                        <div key="reschedule" className="flex flex-col gap-1.5">
                            <div
                                className="text-[10.5px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                                style={{ color: isPrimary ? '#15803d' : 'var(--text-tertiary)' }}
                            >
                                {isPrimary && <i className="fas fa-circle-check text-[10px]" />}
                                {isPrimary
                                    ? `Recommended · reschedule one of ${plantName}'s orders`
                                    : `Or reschedule one of ${plantName}'s orders`}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {moveCandidates.map((cand) => (
                                    <MoveCandidateRow
                                        key={cand.order?.orderId || cand.order?.orderNum}
                                        candidate={cand}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                }
                return null
            })}

            {primary === 'none' && (
                <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    No automatic resolution available on {plantName} — try a plant further from the job, split the
                    booking across plants, or push the date out.
                </div>
            )}
        </div>
    )
}

/** Compact "5h later" / "30m earlier" label for a move target relative to
 *  the order's current start time. Used inside the move-candidate rows so
 *  the dispatcher can see at a glance how far the suggestion shifts the
 *  pour without doing the math themselves. */
const formatMoveDelta = (deltaMin) => {
    if (!Number.isFinite(deltaMin) || deltaMin === 0) return 'same time'
    const abs = Math.abs(deltaMin)
    const h = Math.floor(abs / 60)
    const m = abs % 60
    const span = [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : ''].filter(Boolean).join(' ') || '0m'
    return deltaMin > 0 ? `${span} later` : `${span} earlier`
}

function MoveCandidateRow({ candidate }) {
    const { alternateTimes, order, trucks, window } = candidate
    const customer = order?.customer || 'Order'
    const yards = parseFloat(order?.yardage) || 0
    const orderLabel = order?.orderNum ? `#${order.orderNum}` : ''
    /* Sort the displayed moves chronologically so dispatchers read them
     * left-to-right by time, but keep the picker's "best first" intent by
     * tagging the top result. The scanner already returns at most two
     * options, so the labeling stays simple: Best + Backup. */
    const slotsByPreference = alternateTimes
    const slotsChronological = [...alternateTimes].sort((a, b) => a.startMin - b.startMin)
    return (
        <div
            className="rounded-md px-3 py-2 flex flex-col gap-1"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-2 min-w-0">
                    <i className="fas fa-arrows-up-down-left-right text-[10px]" style={{ color: '#b45309' }} />
                    <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {customer} {orderLabel}
                    </span>
                </div>
                <span className="text-[11.5px] font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    Currently {formatMinutesAsClock(window.startMin)} · {yards} yd · {trucks} truck
                    {trucks === 1 ? '' : 's'}
                </span>
            </div>
            {slotsByPreference.length > 0 ? (
                <div className="flex flex-col gap-0.5 pl-1">
                    {slotsChronological.map((slot) => {
                        const isBest = slot === slotsByPreference[0]
                        const time = formatMinutesAsClock(slot.startMin)
                        const delta = formatMoveDelta(slot.startMin - window.startMin)
                        return (
                            <span
                                key={slot.startMin}
                                className="text-[11.5px] inline-flex items-center gap-2"
                                style={{ color: isBest ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                            >
                                <i
                                    className="fas fa-arrow-right text-[9px]"
                                    style={{ color: 'var(--text-tertiary)' }}
                                />
                                <span
                                    className="text-[9.5px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
                                    style={{
                                        background: isBest ? 'rgba(22, 163, 74, 0.14)' : 'var(--bg-secondary)',
                                        color: isBest ? '#15803d' : 'var(--text-tertiary)'
                                    }}
                                >
                                    {isBest ? 'Best' : 'Backup'}
                                </span>
                                <span className="font-mono tabular-nums font-semibold">{time}</span>
                                <span className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                                    ({delta})
                                </span>
                            </span>
                        )
                    })}
                </div>
            ) : (
                <span className="text-[11px] pl-1" style={{ color: 'var(--text-tertiary)' }}>
                    No clear reschedule slot today.
                </span>
            )}
        </div>
    )
}

/* Strict 24-hour clock pattern: HH:MM with HH = 00-23 and MM = 00-59. The
 * regex is mirrored on the input's `pattern` attribute so the browser blocks
 * non-conforming submits, AND used in JS to gate `buildBookingRequest`. */
const MILITARY_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const isValidMilitaryTime = (value) => MILITARY_TIME_RE.test(String(value || '').trim())

/** Auto-format shortcuts → canonical HH:MM. Lets the dispatcher type fast:
 *    "9"    → "09:00"     "16"   → "16:00"
 *    "930"  → "09:30"     "1630" → "16:30"
 *    "0900" → "09:00"     "9:3"  → unchanged (let the user finish typing)
 *  Returns the original string when the digits don't fit a sensible
 *  HH/HHMM/HMM shape so the inline pattern-mismatch error still fires. */
const normalizeMilitaryTime = (raw) => {
    const trimmed = String(raw || '').trim()
    if (!trimmed || isValidMilitaryTime(trimmed)) return trimmed
    if (trimmed.includes(':')) return trimmed
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length < 1 || digits.length > 4 || digits.length !== trimmed.length) return trimmed
    let hours
    let minutes
    if (digits.length <= 2) {
        hours = digits.padStart(2, '0')
        minutes = '00'
    } else {
        const split = digits.length - 2
        hours = digits.slice(0, split).padStart(2, '0')
        minutes = digits.slice(split)
    }
    const formatted = `${hours}:${minutes}`
    return isValidMilitaryTime(formatted) ? formatted : trimmed
}

function BookOrderView({ accentColor, mixerCountsByPlant, onChangePlanDate, planDate, plantProduction, plants }) {
    const [yardage, setYardage] = useState('')
    const [startTime, setStartTime] = useState('')
    const [spacingMin, setSpacingMin] = useState('')
    const [address, setAddress] = useState('')
    const [submitted, setSubmitted] = useState(false)

    /* Spacing is only meaningful for multi-load pours — a single-truck job
     * doesn't have a spacing decision to make. Tied directly to yardage so
     * the field appears the moment the dispatcher types past one load. */
    const requiresSpacing = (parseFloat(yardage) || 0) > DEFAULT_LOAD_SIZE_YARDS

    /* Past-time guard: if the dispatcher is booking for today, the start
     * time must be later than the current wall-clock minute. Past dates are
     * blocked at the date input via the `min` attribute below; future dates
     * accept any time. Recomputed every render so the guard tracks the
     * actual current minute as time passes (no stale closure). */
    const todayDate = getTodayDate()
    const isBookingToday = planDate === todayDate
    /* All Smyrna plants are closed Sundays — booking one would just stack
     * up against an empty pool. Track + flag the case so the date input
     * can reject the choice and the recommendation logic can short-circuit. */
    const isSundayDate = (dateString) => {
        if (!dateString) return false
        const date = new Date(`${dateString}T00:00:00`)
        return Number.isFinite(date.getTime()) && date.getDay() === 0
    }
    const planDateIsSunday = isSundayDate(planDate)
    const [dateError, setDateError] = useState('')

    const handleDateChange = (nextDate) => {
        if (isSundayDate(nextDate)) {
            setDateError('Plants are closed on Sundays — pick a weekday or Saturday.')
            return
        }
        setDateError('')
        onChangePlanDate?.(nextDate)
    }
    const nowMinutes = isBookingToday ? new Date().getHours() * 60 + new Date().getMinutes() : null
    const startTimeMinutes = isValidMilitaryTime(startTime) ? timeToMinutes(startTime) : null
    const startTimeIsPast =
        isBookingToday && startTimeMinutes != null && nowMinutes != null && startTimeMinutes < nowMinutes
    const startTimeMalformed = startTime !== '' && !isValidMilitaryTime(startTime)

    const request = useMemo(() => {
        if (startTimeMalformed || startTimeIsPast || planDateIsSunday) return null
        return buildBookingRequest({ address, spacingMin, startTime, yardage })
    }, [address, planDateIsSunday, spacingMin, startTime, startTimeIsPast, startTimeMalformed, yardage])

    /* Real distance signal for the recommender — geocodes via Nominatim and
     * derives one-way drive-time minutes per plant. Plants further than the
     * TRAVEL_MIN_HORIZON cutoff are filtered out by `rankPlantsForBooking`.
     * Geocode results are cached in localStorage so each address only hits
     * the network once; the dispatcher's first booking warms the cache. */
    const distanceJobAddress = submitted ? request?.address || '' : ''
    const distancePlants = submitted ? plants : null
    const { isLoading: distancesLoading, minutesByPlantCode: travelMinByPlantCode } = useAddressDistances({
        jobAddress: distanceJobAddress,
        plants: distancePlants
    })

    /* Re-rank only after the dispatcher commits via Submit. Live-ranking on
     * every keystroke felt jumpy and made it hard to read the breakdown for
     * a partially-typed address. */
    const ranked = useMemo(() => {
        if (!submitted || !request) return []
        return rankPlantsForBooking({
            mixerCountsByPlant,
            planDate,
            plantProduction,
            plants,
            request,
            travelMinByPlantCode
        })
    }, [submitted, request, plants, plantProduction, mixerCountsByPlant, planDate, travelMinByPlantCode])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!request) return
        setSubmitted(true)
    }

    const handleReset = () => {
        setYardage('')
        setStartTime('')
        setSpacingMin('')
        setAddress('')
        setSubmitted(false)
    }

    const top = ranked[0]
    const planDateLabel = DateUtility.formatDate(planDate)

    /* Per-plant earliest legal first-load-out for the booking date,
     * derived from yesterday's actual ticket times + the 10-hour DOT rest
     * window. Drives the move / alternate-time / recommended-time
     * scanners so suggestions never propose dispatching an operator who's
     * still inside their mandatory rest window. */
    const restFloorByPlant = useYesterdayOperatorRestFloor(planDate)

    /* Surface time-shift / order-move / help-available suggestions only
     * when the closest plant (now always #1) genuinely can't cover the
     * requested window. travelMinByPlantCode lets the help section sort
     * lender plants by drive time from the job — a proxy for proximity to
     * the suggesting plant. */
    const conflict = useMemo(
        () =>
            computeBookingConflict({
                mixerCountsByPlant,
                planDate,
                plantProduction,
                plants,
                ranked,
                request,
                restFloorByPlant,
                travelMinByPlantCode
            }),
        [mixerCountsByPlant, planDate, plantProduction, plants, ranked, request, restFloorByPlant, travelMinByPlantCode]
    )

    /* The system's preferred start time for this booking on the closest
     * plant — independent of what the dispatcher typed. When this differs
     * from `request.startMin`, the advice card overrides the typed time
     * with this one and the schedule preview animates the row into the
     * recommended slot. Only relevant when there's no truck shortage; the
     * conflict panel handles its own time suggestions. */
    const topPlantRecord = useMemo(() => {
        if (!ranked[0]) return null
        return (plants || []).find((p) => (p?.plantCode || p?.plant_code) === ranked[0].plantCode) || null
    }, [ranked, plants])
    const recommendedSlot = useMemo(() => {
        if (!topPlantRecord || !request || conflict) return null
        const plantCode = topPlantRecord?.plantCode || topPlantRecord?.plant_code
        return findRecommendedStartTime({
            mixerCountsByPlant,
            planDate,
            plant: topPlantRecord,
            plantProduction,
            request,
            restFloorMin: restFloorByPlant?.[plantCode]
        })
    }, [topPlantRecord, request, conflict, mixerCountsByPlant, planDate, plantProduction, restFloorByPlant])

    /* "At least 3 viable options" rule. Pulls a longer alternates list
     * for the top plant so the no-conflict path can offer the dispatcher
     * choices beyond the single highlighted recommendation. The same
     * data feeds the cross-day fallback when the requested day is too
     * tight. */
    const topPlantViableSlots = useMemo(() => {
        if (!topPlantRecord || !request) return []
        const plantCode = topPlantRecord?.plantCode || topPlantRecord?.plant_code
        return findAlternateStartTimes({
            count: 6,
            mixerCountsByPlant,
            planDate,
            plant: topPlantRecord,
            plantProduction,
            request,
            restFloorMin: restFloorByPlant?.[plantCode]
        }).filter((s) => s.fits)
    }, [topPlantRecord, request, mixerCountsByPlant, planDate, plantProduction, restFloorByPlant])

    /* Adjacent days' schedules (next 2–4 non-Sunday dates). Used to fill
     * out the viable-options panel when the requested day can't supply 3
     * fitting slots on its own. */
    const adjacentProduction = useAdjacentDayPlantProduction(planDate)
    const crossDaySuggestions = useMemo(() => {
        if (!topPlantRecord || !request) return []
        return findCrossDaySuggestions({
            adjacentProduction,
            maxDays: 2,
            mixerCountsByPlant,
            plant: topPlantRecord,
            request
        })
    }, [topPlantRecord, request, adjacentProduction, mixerCountsByPlant])

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-4 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Form */}
                <section
                    className="lg:col-span-4 rounded-lg flex flex-col"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    <div
                        className="flex items-center gap-3 px-5 py-4"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-clipboard-list text-[16px]" />
                        </div>
                        <div>
                            <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Booking Request
                            </div>
                            <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                {planDateLabel ? `Scheduling for ${planDateLabel}` : 'Enter the order details'}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-4">
                        <div>
                            <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Date
                            </label>
                            <input
                                type="date"
                                value={planDate || ''}
                                min={todayDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                required
                                aria-invalid={dateError ? true : undefined}
                                className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                                style={FIELD_STYLE}
                            />
                            {dateError && (
                                <p className="mt-1.5 text-[11px]" style={{ color: '#dc2626' }}>
                                    {dateError}
                                </p>
                            )}
                            {!dateError && planDateIsSunday && (
                                <p className="mt-1.5 text-[11px]" style={{ color: '#dc2626' }}>
                                    Plants are closed on Sundays — pick a weekday or Saturday.
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                    Yardage
                                </label>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.5"
                                    value={yardage}
                                    onChange={(e) => setYardage(e.target.value)}
                                    placeholder="50"
                                    required
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                                    style={FIELD_STYLE}
                                />
                            </div>
                            <div>
                                <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                    Time (24-hour)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    onBlur={(e) => setStartTime(normalizeMilitaryTime(e.target.value))}
                                    placeholder="14:30"
                                    pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
                                    maxLength={5}
                                    required
                                    aria-invalid={startTimeMalformed || startTimeIsPast || undefined}
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none font-mono tabular-nums"
                                    style={FIELD_STYLE}
                                />
                                {startTimeMalformed && (
                                    <p className="mt-1.5 text-[11px]" style={{ color: '#dc2626' }}>
                                        Use 24-hour HH:MM (e.g. 09:00, 14:30, 23:15).
                                    </p>
                                )}
                                {!startTimeMalformed && startTimeIsPast && (
                                    <p className="mt-1.5 text-[11px]" style={{ color: '#dc2626' }}>
                                        Start time has already passed today — pick a later time or change the date.
                                    </p>
                                )}
                            </div>
                        </div>

                        {requiresSpacing && (
                            <div>
                                <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                    Truck Spacing (min)
                                </label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    step="1"
                                    value={spacingMin}
                                    onChange={(e) => setSpacingMin(e.target.value)}
                                    placeholder={String(DEFAULT_TRUCK_SPACING_MIN)}
                                    required
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                                    style={FIELD_STYLE}
                                />
                                <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                    Minutes between truck arrivals on a multi-load pour. Tighter spacing pours faster
                                    but needs more concurrent trucks.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Job Address
                            </label>
                            <AddressAutocomplete
                                value={address}
                                onChange={setAddress}
                                placeholder="Street, City, State ZIP"
                                required
                                fieldStyle={FIELD_STYLE}
                            />
                            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                Start typing — pick a suggestion to verify the address. Drive time runs against the
                                verified location.
                            </p>
                        </div>

                        {request && (
                            <div
                                className="rounded-lg px-3 py-2.5 text-[12px] flex flex-col gap-1"
                                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                            >
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Estimated trucks</span>
                                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {request.trucksNeeded}
                                    </span>
                                </div>
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Pour window</span>
                                    <span
                                        className="font-semibold tabular-nums"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {formatMinutesAsClock(request.startMin)}–
                                        {formatMinutesAsClock(request.startMin + request.durationMin)}
                                    </span>
                                </div>
                                <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                    Assumes {DEFAULT_LOAD_SIZE_YARDS}-yd loads, {request.spacingMin}-min spacing.
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={!request}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider text-white px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: accentColor }}
                            >
                                <i className="fas fa-magnifying-glass-chart text-[12px]" />
                                Find Best Plant
                            </button>
                            {/* Same handler as the post-submit Reset button — flushes
                             * yardage / start time / spacing / address and drops the
                             * `submitted` flag so the right pane returns to its idle
                             * state. Hidden when every field is already empty so the
                             * button doesn't add noise on a fresh form. */}
                            {(yardage || startTime || spacingMin || address || submitted) && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider px-3.5 py-2.5"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-secondary)'
                                    }}
                                    title="Clear every field on the form"
                                >
                                    <i className="fas fa-eraser text-[12px]" />
                                    Clear
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                {/* Recommendations */}
                <section className="lg:col-span-8 flex flex-col gap-3">
                    {(() => {
                        /* Roll up the branch conditions once so each FadeIn
                         * gets the same boolean it'd have in an `if/else`
                         * tree, but the markup stays flat and animations
                         * can overlap during a state transition. */
                        const showIdle = !submitted
                        const showSunday = submitted && planDateIsSunday
                        const showSameDay = submitted && !planDateIsSunday && isBookingToday
                        const showLoading = submitted && !planDateIsSunday && !isBookingToday && distancesLoading
                        const showNoPlants =
                            submitted &&
                            !planDateIsSunday &&
                            !isBookingToday &&
                            !distancesLoading &&
                            ranked.length === 0
                        const showResult = submitted && !planDateIsSunday && !isBookingToday && top && !conflict
                        const showConflict = submitted && !planDateIsSunday && !isBookingToday && !!conflict
                        const showDecorative = showIdle || showLoading || showNoPlants

                        return (
                            <>
                                <FadeIn show={showIdle}>
                                    <div
                                        className="rounded-lg p-8 text-center flex flex-col items-center gap-2"
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: '1px dashed var(--border-light)',
                                            color: 'var(--text-tertiary)'
                                        }}
                                    >
                                        <i className="fas fa-route text-3xl mb-2" />
                                        <div
                                            className="text-[14px] font-semibold"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Fill the form to see a booking recommendation
                                        </div>
                                        <div className="text-[12px]">
                                            I&apos;ll suggest the best plant and time, and flag any conflicts with the
                                            existing schedule.
                                        </div>
                                    </div>
                                </FadeIn>

                                <FadeIn show={showSunday}>
                                    <div
                                        className="rounded-lg p-6 text-center"
                                        style={{
                                            background: 'rgba(220, 38, 38, 0.08)',
                                            border: '1px solid rgba(220, 38, 38, 0.35)',
                                            color: '#b91c1c'
                                        }}
                                    >
                                        <i className="fas fa-ban text-2xl mb-2" />
                                        <div className="text-[14px] font-semibold">Plants are closed on Sundays.</div>
                                        <div className="text-[12px] mt-1">
                                            Pick a weekday or Saturday to see a recommendation.
                                        </div>
                                    </div>
                                </FadeIn>

                                <FadeIn show={showSameDay}>
                                    <SameDayAdvice accentColor={accentColor} />
                                </FadeIn>

                                <FadeIn show={showLoading}>
                                    <div
                                        className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-[12px]"
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        <i className="fas fa-route fa-spin text-[11px]" />
                                        Calculating drive times — plants further than {TRAVEL_MIN_HORIZON} min will be
                                        hidden.
                                    </div>
                                </FadeIn>

                                <FadeIn show={showNoPlants}>
                                    <div
                                        className="rounded-lg p-6 text-center"
                                        style={{
                                            background: 'rgba(217, 119, 6, 0.1)',
                                            border: '1px solid rgba(217, 119, 6, 0.35)',
                                            color: '#b45309'
                                        }}
                                    >
                                        <i className="fas fa-triangle-exclamation text-2xl mb-2" />
                                        <div className="text-[14px] font-semibold">
                                            No plants within {TRAVEL_MIN_HORIZON} minutes.
                                        </div>
                                        <div className="text-[12px] mt-1">
                                            Every plant is more than {TRAVEL_MIN_HORIZON} min from the job, closed for
                                            the day, or missing driver-pool data. Try a different address or date.
                                        </div>
                                    </div>
                                </FadeIn>

                                <FadeIn show={showResult} delayMs={80}>
                                    {top && !conflict && (
                                        <RecommendationAdvice
                                            accentColor={accentColor}
                                            recommendedSlot={recommendedSlot}
                                            request={request}
                                            top={top}
                                        />
                                    )}
                                </FadeIn>
                                <FadeIn show={showResult} delayMs={140}>
                                    {top && !conflict && (
                                        <ViableSlotsPanel
                                            accentColor={accentColor}
                                            crossDaySuggestions={crossDaySuggestions}
                                            plantName={top.plantName}
                                            recommendedStartMin={
                                                recommendedSlot ? recommendedSlot.startMin : request.startMin
                                            }
                                            sameDaySlots={topPlantViableSlots}
                                        />
                                    )}
                                </FadeIn>
                                <FadeIn show={showResult} delayMs={200}>
                                    {top && !conflict && (
                                        <SchedulePreview
                                            accentColor={accentColor}
                                            existingOrders={plantProduction?.[top.plantCode]?.orders || []}
                                            newOrder={
                                                recommendedSlot && recommendedSlot.startMin !== request.startMin
                                                    ? { ...request, startMin: recommendedSlot.startMin }
                                                    : request
                                            }
                                            plantCode={top.plantCode}
                                            plantName={top.plantName}
                                            poolForPlant={mixerCountsByPlant?.[top.plantCode] || 0}
                                        />
                                    )}
                                </FadeIn>

                                <FadeIn show={showConflict} delayMs={80}>
                                    {conflict && (
                                        <BookingConflictPanel
                                            accentColor={accentColor}
                                            conflict={conflict}
                                            request={request}
                                        />
                                    )}
                                </FadeIn>
                                {/* Suppress the "more viable times" panel when the conflict
                                 * resolution is a size-window shift — the headline already
                                 * names the recommended slot, and listing it again as
                                 * "no viable slots / try another day" reads as a contradiction. */}
                                <FadeIn show={showConflict && !conflict?.sizeWindowAdvice?.suggestedSlot} delayMs={140}>
                                    {conflict && !conflict.sizeWindowAdvice?.suggestedSlot && (
                                        <ViableSlotsPanel
                                            accentColor={accentColor}
                                            crossDaySuggestions={crossDaySuggestions}
                                            plantName={conflict.plantName}
                                            recommendedStartMin={null}
                                            sameDaySlots={topPlantViableSlots}
                                        />
                                    )}
                                </FadeIn>
                                <FadeIn show={showConflict} delayMs={200}>
                                    {conflict && (
                                        <SchedulePreview
                                            accentColor={accentColor}
                                            existingOrders={plantProduction?.[conflict.plantCode]?.orders || []}
                                            /* Render the new booking row at the EFFECTIVE start
                                             * (the recommended shift target if one applies),
                                             * not the typed time — otherwise the headline says
                                             * "shift to 04:00" while the table shows it at 07:00. */
                                            newOrder={
                                                Number.isFinite(conflict.effectiveStartMin) &&
                                                conflict.effectiveStartMin !== request.startMin
                                                    ? { ...request, startMin: conflict.effectiveStartMin }
                                                    : request
                                            }
                                            plantCode={conflict.plantCode}
                                            plantName={conflict.plantName}
                                            poolForPlant={mixerCountsByPlant?.[conflict.plantCode] || 0}
                                        />
                                    )}
                                </FadeIn>

                                <FadeIn show={showDecorative} delayMs={120}>
                                    <DecorativeSchedulePreview
                                        accentColor={accentColor}
                                        mixerCountsByPlant={mixerCountsByPlant}
                                        plantProduction={plantProduction}
                                        plants={plants}
                                    />
                                </FadeIn>
                            </>
                        )
                    })()}
                </section>
            </div>
        </div>
    )
}

export default BookOrderView
