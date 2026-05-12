import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AddressAutocomplete from '../../../app/components/common/AddressAutocomplete'
import { PlantBadge } from '../../../app/components/plan/PlanScheduleBadges'
import useAddressDistances from '../../../app/hooks/useAddressDistances'
import useAdjacentDayPlantProduction from '../../../app/hooks/useAdjacentDayPlantProduction'
import usePlantToPlantDistances from '../../../app/hooks/usePlantToPlantDistances'
import useYesterdayOperatorRestFloor from '../../../app/hooks/useYesterdayOperatorRestFloor'
import { BookOrderLogService } from '../../../services/BookOrderLogService'
import { formatOrderAddress } from '../../../utils/AddressUtility'
import {
    buildBookingRequest,
    computeBookingConflict,
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_TRUCK_SPACING_MIN,
    findRecommendedStartTime,
    POUR_METHOD_OPTIONS,
    rankPlantsForBooking,
    TRAVEL_MIN_HORIZON
} from '../../../utils/BookOrderUtility'
import DateUtility from '../../../utils/DateUtility'
import { clean, formatHhmm } from '../../../utils/PlanScheduleUtility'
import { getDayOfWeekForDate, getNowCstMinutes, getTodayDate, timeToMinutes } from '../../../utils/PlanUtility'

const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

const FIELD_LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wider mb-2'

/** "Tue, May 13" — used by the conflict panel when recommending a
 *  cross-day shift so the dispatcher reads the day at a glance. */
const formatFullDateLabel = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(`${dateStr}T00:00:00`)
    if (!Number.isFinite(date.getTime())) return dateStr
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })
}

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
        <div className="rounded-lg p-4 flex items-start gap-3 bg-[rgba(22,_163,_74,_0.08)] border border-[rgba(22,_163,_74,_0.35)]">
            <div
                className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 text-white"
                style={{ background: accentColor }}
            >
                <i className="fas fa-clock text-[16px]" />
            </div>
            <div className="min-w-0">
                <div className="text-[15px] font-bold text-text-primary">Book this at 15:00</div>
                <div className="text-[12px] mt-0.5 text-text-secondary">
                    Same-day bookings run at 15:00 — no plant analysis needed.
                </div>
            </div>
        </div>
    )
}

/**
 * Embedded Google Maps preview of the driving route from the
 * recommended plant to the job address. Reuses the same iframe URL
 * shape `JobMapModal` uses on the Schedule tab so the dispatcher gets
 * the familiar layout. Only renders once the job address has actually
 * geocoded and produced a real OSRM travel time (`travelMin` finite) —
 * that's our "address is correct and working" signal, so a typo or
 * unverified address never paints a map. `dirflg=d` pins the embed to
 * driving routes only — no transit / walking / cycling alternatives.
 */
function RoutePreview({ jobAddress, plantAddress, plantName, travelMin }) {
    const trimmedJob = (jobAddress || '').trim()
    const trimmedPlant = (plantAddress || '').trim()
    if (!trimmedJob || !trimmedPlant) return null
    if (!Number.isFinite(travelMin)) return null
    const plantQuery = encodeURIComponent(trimmedPlant)
    const jobQuery = encodeURIComponent(trimmedJob)
    /* `output=embed` is the documented embed-in-iframe form; saddr →
     * daddr asks Google Maps to render the route between the two.
     * `dirflg=d` forces driving directions — without it Google may
     * surface transit / walking tabs for the same OD pair. */
    const mapSrc = `https://www.google.com/maps?saddr=${plantQuery}&daddr=${jobQuery}&dirflg=d&output=embed`
    const externalUrl = `https://www.google.com/maps/dir/?api=1&origin=${plantQuery}&destination=${jobQuery}&travelmode=driving`
    return (
        <div className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border-light">
                <i className="fas fa-route text-[11px] text-text-tertiary" />
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Route from {plantName || 'plant'} to job
                </div>
                {Number.isFinite(travelMin) && (
                    <span className="text-[11px] font-mono tabular-nums text-text-secondary">· {travelMin} min</span>
                )}
                <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11px] hover:underline text-text-tertiary"
                    title="Open this route in Google Maps"
                >
                    Open in Maps
                    <i className="fas fa-arrow-up-right-from-square text-[9px]" />
                </a>
            </div>
            <iframe
                className="block h-[280px] w-full"
                src={mapSrc}
                title={`Route from ${plantName || 'plant'} to ${trimmedJob}`}
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
            />
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
        className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap bg-bg-tertiary border-b border-border-light text-text-secondary"
        style={{ boxShadow: '0 1px 0 0 var(--border-light)' }}
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
                                        className={`transition-all duration-700 ease-out ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'} border-t border-border-light`}
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
                            const address = formatOrderAddress(o, ', ')
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
                                    <td className="px-3 py-2 max-w-[220px] text-text-secondary" title={address}>
                                        <span className="truncate inline-block max-w-full align-middle text-[11.5px] uppercase tracking-wide">
                                            {address || '—'}
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
    /* Honest distance label — only call a plant "closest" when we
     *  actually have a drive-time number for it. Without one (job
     *  address didn't geocode, plant address didn't resolve), the
     *  recommendation is operating on a ZIP/heuristic guess and the
     *  dispatcher needs to know that before trusting it. */
    const distanceLabel = Number.isFinite(top.travelMin)
        ? `${top.travelMin} min from the job`
        : 'Drive time unavailable — verify the job address geocoded correctly'
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
                    className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 text-white"
                    style={{ background: accentColor }}
                >
                    <i className={`fas ${tone.icon} text-[16px]`} />
                </div>
                <div className="min-w-0">
                    <div className="text-[15px] font-bold text-text-primary">
                        Book at {top.plantName} at {recommendedTime}{' '}
                        <span className="text-[12px] font-normal text-text-tertiary">#{top.plantCode}</span>
                    </div>
                    <div className="text-[12px] mt-0.5 text-text-secondary">
                        {distanceLabel} · {freeLabel} at {recommendedTime}
                    </div>
                </div>
            </div>
            {isShifted ? (
                <div className="text-[13px] leading-snug text-text-primary">
                    The customer is requesting <strong>{requestedTime}</strong>, but <strong>{recommendedTime}</strong>{' '}
                    is recommended — {buildShiftReason({ recommendedSlot, request })} {top.plantName} can still cover
                    the {trucksNeededLabel} for this {request.yardage}-yd pour at the recommended slot.
                </div>
            ) : (
                <div className="text-[13px] leading-snug text-text-primary">
                    You&apos;re set. {top.plantName} is the closest plant and has the {trucksNeededLabel} this{' '}
                    {request.yardage}-yd pour needs at {recommendedTime}. Proceed with the booking.
                </div>
            )}
            {recommendedSlot?.tighterAlternative && (
                <div className="rounded-md p-3 flex items-start gap-2.5 text-[12.5px] leading-snug bg-[rgba(217,_119,_6,_0.08)] border border-[rgba(217,_119,_6,_0.30)] text-text-primary">
                    <i className="fas fa-circle-info text-[12px] mt-0.5 shrink-0 text-[#b45309]" />
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
 *  pulling help from nearby plants. Both are read-only suggestions;
 *  the dispatcher still books manually. */
function BookingConflictPanel({ accentColor, conflict, request }) {
    if (!conflict) return null
    const {
        alternateTimes,
        bestEffortSlot,
        helpAvailability,
        launchSlotFull,
        plantCode,
        plantName,
        sameSlotCount,
        shortBy
    } = conflict
    const requestedTime = request ? formatMinutesAsClock(request.startMin) : null

    /* Score each fix against the actual shortfall so we can lead with the
     * one that genuinely solves the problem instead of treating both as
     * equal. The numbers come from the same data the existing chips
     * already render — no extra fetches. */
    const helpFleetTotal = (helpAvailability || []).reduce((sum, h) => sum + (h?.free || 0), 0)
    const helpCovers = helpFleetTotal >= shortBy
    const fittingAlternates = (alternateTimes || []).filter((s) => s.fits)
    const hasFittingAlternate = fittingAlternates.length > 0

    /* Cascade — pick the simplest option that fully covers the pour.
     * 1. `shift` when the per-plant launch cap forces a different
     *    minute. 2. `best-effort` when it identifies a same-day slot
     *    that beats the typed time on packing — tighter cluster
     *    against existing pours, less help needed, etc. Even when
     *    help happens to cover at the typed time, a 00:00 start that
     *    leaves a 90-minute idle gap before the day's first existing
     *    pour is worse than a 01:30 start that lands trucks back at
     *    yard right as the next pour begins. 3. `help` when nearby
     *    plants cover the gap at the typed time. 4. `shift` when a
     *    same-day alternate slot fully fits on its own (incl. shifting
     *    INTO the preferred window). 5. `best-effort` — earliest day
     *    with own + per-slot help that fully covers. 6. `none` only
     *    when no day in the 10-day window has the trucks. */
    const hasBestEffort = !!bestEffortSlot
    const bestEffortFindsBetterSameDayTime =
        hasBestEffort && bestEffortSlot.isSameDay && bestEffortSlot.slot.startMin !== request.startMin
    let primary
    if (launchSlotFull) primary = 'shift'
    else if (bestEffortFindsBetterSameDayTime) primary = 'best-effort'
    else if (helpCovers) primary = 'help'
    else if (hasFittingAlternate) primary = 'shift'
    else if (hasBestEffort) primary = 'best-effort'
    else primary = 'none'

    /* Choose a clear action headline + subtitle the dispatcher can act on
     * directly — "Book at Baytown at 07:00 with help from 4 nearby plants"
     * reads better than "Baytown is short 16 trucks". The headline mirrors
     * the no-conflict `RecommendationAdvice` card so the visual hierarchy
     * is consistent: bold instruction up top, supporting detail below. */
    const fittingAlt = fittingAlternates[0]
    const helpPlantCount = (helpAvailability || []).length
    const requestedTimeLabel = requestedTime || 'the requested time'
    const shiftTarget = hasFittingAlternate ? fittingAlt : null
    const headlineCopy = (() => {
        if (launchSlotFull) {
            const launchSlot = shiftTarget
            if (launchSlot) {
                return {
                    subtitle: `${plantName} already has ${sameSlotCount} order${sameSlotCount === 1 ? '' : 's'} starting at ${requestedTimeLabel} — that's the per-plant launch cap, so a fourth truck can't load at the same minute. Booking at ${formatMinutesAsClock(launchSlot.startMin)} clears the constraint without expanding the day.`,
                    title: `Book the order at ${formatMinutesAsClock(launchSlot.startMin)} on ${plantName} — ${requestedTimeLabel} is already at the per-plant launch cap`
                }
            }
            return {
                subtitle: `${plantName} already has ${sameSlotCount} order${sameSlotCount === 1 ? '' : 's'} starting at ${requestedTimeLabel} — that's the per-plant launch cap. Pick a different start time on ${plantName} or try a nearby plant; pulling help can't fix a physical loading-bay constraint.`,
                title: `${plantName} is at the per-plant launch cap at ${requestedTimeLabel}`
            }
        }
        switch (primary) {
            case 'help':
                return {
                    subtitle: `Pull help from ${helpPlantCount} nearby plant${helpPlantCount === 1 ? '' : 's'} — they cover all ${shortBy} truck${shortBy === 1 ? '' : 's'} short. Keep the booking at ${requestedTimeLabel}.`,
                    title: `Book the order at ${requestedTimeLabel} on ${plantName} — pull help`
                }
            case 'shift':
                return {
                    subtitle: `${plantName} can pour cleanly here without help — ${shiftTarget.free} truck${shiftTarget.free === 1 ? '' : 's'} free at ${formatMinutesAsClock(shiftTarget.startMin)}.`,
                    title: `Book the order at ${formatMinutesAsClock(shiftTarget.startMin)} on ${plantName}`
                }
            case 'best-effort': {
                const { covered, dateStr, fitsCleanly, isSameDay, slot } = bestEffortSlot
                const timeLabel = formatMinutesAsClock(slot.startMin)
                const fullDateLabel = formatFullDateLabel(dateStr)
                const dateInTitle = isSameDay ? '' : ` on ${fullDateLabel}`
                const dateInSubtitle = isSameDay ? 'today' : fullDateLabel
                const ownFreeLabel = `${slot.free} truck${slot.free === 1 ? '' : 's'} free`
                if (fitsCleanly) {
                    return {
                        subtitle: `${plantName} has ${ownFreeLabel} at ${timeLabel}${isSameDay ? ' today' : ` on ${dateInSubtitle}`} — fully covers the pour on its own, no help needed. ${isSameDay ? 'Same-day' : 'Soonest day'} the plant can host it cleanly.`,
                        title: `Book the order at ${timeLabel}${dateInTitle} on ${plantName} — clean fit, no help needed`
                    }
                }
                if (covered) {
                    return {
                        subtitle: `${plantName} has ${ownFreeLabel} at ${timeLabel}${isSameDay ? ' today' : ` on ${dateInSubtitle}`} and the ${slot.helpFree} truck${slot.helpFree === 1 ? '' : 's'} of nearby help cover the remaining ${slot.shortBy} truck${slot.shortBy === 1 ? '' : 's'} cleanly. ${isSameDay ? 'Best same-day' : 'Soonest'} time the network can host the pour in full.`,
                        title: `Book the order at ${timeLabel}${dateInTitle} on ${plantName} — pull help to fully cover`
                    }
                }
                /* Partial-coverage same-day slot — pushing the dispatcher
                 * out 5 days for full coverage is worse than telling them
                 * the best the day can do and how many trucks they'll
                 * still need to find. They can split the booking, pull
                 * from beyond the 1-hour radius, or shrink the pour. */
                return {
                    subtitle: `${plantName} has ${ownFreeLabel} at ${timeLabel}${isSameDay ? ' today' : ` on ${dateInSubtitle}`} and ${slot.helpFree} truck${slot.helpFree === 1 ? '' : 's'} of nearby help. You'll still be ${slot.networkShortBy} truck${slot.networkShortBy === 1 ? '' : 's'} short — split the booking with another plant, pull from beyond the 1-hour radius, or shrink the pour. Best ${isSameDay ? 'same-day' : 'soonest-day'} option.`,
                    title: `Book the order at ${timeLabel}${dateInTitle} on ${plantName} — pull what help is available (still ${slot.networkShortBy} truck${slot.networkShortBy === 1 ? '' : 's'} short)`
                }
            }
            default:
                /* Should be functionally unreachable now that the scan
                 * floor allows the full 00:00–13:00 range and per-slot
                 * help is computed across all eligible lenders. If we
                 * still land here, fall back to recommending the typed
                 * time on the closest plant — the dispatcher can see
                 * the schedule preview and decide manually. Never
                 * dead-end them. */
                return {
                    subtitle: `${plantName} is the closest plant — book here at ${requestedTimeLabel} and pull help from nearby plants as needed. The schedule preview below shows what the day looks like with this booking added.`,
                    title: `Book the order at ${requestedTimeLabel} on ${plantName}`
                }
        }
    })()
    const headlineTitle = headlineCopy.title
    const headlineSubtitle = headlineCopy.subtitle
    /* Every recommendation is an actionable next step now — the
     * recommender always produces a "Book the order at X on Plant"
     * answer. Consistent confident-green icon across the board. */
    const headlineTone = { background: accentColor || '#1e3a5f', color: '#fff', icon: 'fa-thumbs-up' }

    /* Panel renders ONE message — the headline (title + subtitle). No
     * help table, no alternates chips, no shrink-target math. The
     * dispatcher gets a single concrete "book at HH:MM on Plant"
     * recommendation and acts on it. */
    return (
        <div className="rounded-lg p-4 flex flex-col gap-3 bg-bg-primary border border-border-light">
            <div className="flex items-start gap-3">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                    style={{ background: headlineTone.background, color: headlineTone.color }}
                >
                    <i className={`fas ${headlineTone.icon} text-[16px]`} />
                </div>
                <div className="min-w-0">
                    <div className="text-[15px] font-bold text-text-primary">
                        {headlineTitle}
                        {plantCode && (
                            <span className="text-[12px] font-normal ml-2 text-text-tertiary">#{plantCode}</span>
                        )}
                    </div>
                    <div className="text-[12px] mt-0.5 text-text-secondary">{headlineSubtitle}</div>
                </div>
            </div>
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
    const [pourMethod, setPourMethod] = useState('')
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
     * can reject the choice and the recommendation logic can short-
     * circuit. CST-anchored day-of-week so the answer doesn't drift if
     * the dispatcher (or a developer) is in another timezone. */
    const isSundayDate = (dateString) => getDayOfWeekForDate(dateString) === 0
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
    const nowMinutes = isBookingToday ? getNowCstMinutes() : null
    const startTimeMinutes = isValidMilitaryTime(startTime) ? timeToMinutes(startTime) : null
    const startTimeIsPast =
        isBookingToday && startTimeMinutes != null && nowMinutes != null && startTimeMinutes < nowMinutes
    const startTimeMalformed = startTime !== '' && !isValidMilitaryTime(startTime)

    const request = useMemo(() => {
        if (startTimeMalformed || startTimeIsPast || planDateIsSunday) return null
        return buildBookingRequest({ address, pourMethod, spacingMin, startTime, yardage })
    }, [address, planDateIsSunday, pourMethod, spacingMin, startTime, startTimeIsPast, startTimeMalformed, yardage])

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
        setPourMethod('')
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

    /* Plant-to-plant drive times from whichever plant ends up short on
     * trucks. Used by `findHelpAvailability` to exclude lender plants
     * that sit further than `MAX_HELP_TRAVEL_MIN_FROM_PLANT` (60 min) of
     * driving from the short plant — dispatching a truck across that
     * much road eats too much of the lender's shift to be realistic. */
    const shortPlantCode = ranked?.[0]?.plantCode || null
    const { minutesByPlantCode: travelMinFromShortPlantByPlantCode } = usePlantToPlantDistances({
        fromPlantCode: shortPlantCode,
        plants: submitted ? plants : null
    })

    /* Adjacent days' schedules. Powers the "soonest day that can host"
     * recommendation inside the conflict panel — when the requested
     * day genuinely can't fit the pour, we walk upcoming days and
     * surface the first one with a fitting slot. */
    const adjacentProduction = useAdjacentDayPlantProduction(planDate)

    /* Surface time-shift / help-available / cross-day suggestions only
     * when the closest plant (now always #1) genuinely can't cover the
     * requested window. travelMinByPlantCode lets the help section sort
     * lender plants by drive time from the job — a proxy for proximity to
     * the suggesting plant. */
    const conflict = useMemo(
        () =>
            computeBookingConflict({
                adjacentProduction,
                mixerCountsByPlant,
                planDate,
                plantProduction,
                plants,
                ranked,
                request,
                restFloorByPlant,
                travelMinByPlantCode,
                travelMinFromShortPlantByPlantCode
            }),
        [
            adjacentProduction,
            mixerCountsByPlant,
            planDate,
            plantProduction,
            plants,
            ranked,
            request,
            restFloorByPlant,
            travelMinByPlantCode,
            travelMinFromShortPlantByPlantCode
        ]
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
    /* Plant record for the conflict path (could differ from `topPlantRecord`
     * if ranking changes mid-session). Used to surface the plant address
     * for the route map preview. */
    const conflictPlantRecord = useMemo(() => {
        if (!conflict?.plantCode) return null
        return (plants || []).find((p) => (p?.plantCode || p?.plant_code) === conflict.plantCode) || null
    }, [conflict, plants])
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

    /* Audit log — exactly ONE row per form submission, written AFTER
     * the address/travel-time loaders have settled so the logged
     * recommendation reflects the final ranked state. Without the
     * "wait for distances" gate the recommender's intermediate
     * rankings (different plants while OSRM resolves) each fired a
     * separate log row, polluting the audit trail.
     *
     * `loggedFormKeyRef` keys on the form INPUTS only (not the
     * recommendation), so once a given form is logged we never re-log
     * it even if downstream state keeps shifting. Resubmitting the
     * form with any input change produces a new key → new log. */
    const loggedFormKeyRef = useRef(null)
    /* Form key currently being POSTed to the log endpoint. Blocks a
     * second concurrent POST for the same submission if the effect
     * re-fires while the network call is still in flight — without it,
     * two parallel renders could each call logSuggestion and produce
     * duplicate audit rows. Cleared in the .then() handler. */
    const logInFlightRef = useRef(null)
    /* Attempt counter per form key. A failed log leaves
     * `loggedFormKeyRef` unset so the next render can retry, but we
     * cap retries at MAX_LOG_ATTEMPTS to avoid hammering a broken
     * endpoint forever. */
    const logAttemptsRef = useRef({})
    /* Tracks whether we've ever observed `distancesLoading === true`
     * since the current submission started. Without this guard the
     * INITIAL render — where the hook hasn't run its effect yet so
     * `isLoading` is still its default `false` — slips past the
     * loading gate and we log the default plant ordering (alphabetical
     * by code → "Freeport" wins) instead of waiting for the real
     * travel-time ranking to settle. */
    const distancesObservedLoadingRef = useRef(false)
    /* Reset the dedupe key + settled-flag when the form is cleared /
     * new submission starts. `submitted` going from true → false
     * marks a fresh session, so the next ready-to-log state can write
     * a new row only after distances have re-loaded fully. */
    useEffect(() => {
        if (!submitted) {
            loggedFormKeyRef.current = null
            logInFlightRef.current = null
            logAttemptsRef.current = {}
            distancesObservedLoadingRef.current = false
        }
    }, [submitted])
    useEffect(() => {
        if (distancesLoading) distancesObservedLoadingRef.current = true
    }, [distancesLoading])
    useEffect(() => {
        if (!submitted || !request || !top) return
        if (distancesLoading) return
        /* If we've never seen `distancesLoading === true` since the
         * submission started, the loader's effect hasn't actually run
         * yet — the `false` we're observing is just the hook's
         * initial state. Don't log yet; wait for the loading cycle
         * to actually complete. */
        if (!distancesObservedLoadingRef.current) return
        const recommendationReady = !!(conflict || recommendedSlot)
        if (!recommendationReady) return
        const formKey = [
            planDate,
            request?.startMin,
            request?.yardage,
            request?.trucksNeeded,
            request?.spacingMin,
            request?.address,
            request?.pourMethod
        ].join('|')
        /* Three-stage dedupe to guarantee exactly one row per submission:
         *   loggedFormKeyRef — already succeeded → never re-log.
         *   logInFlightRef   — POST in progress → don't fire a second.
         *   logAttemptsRef   — failed too many times → stop retrying.
         * The success ref is set in the .then() handler after the POST
         * resolves, so transient failures (network blip, 5xx) leave it
         * unset and the next render naturally retries. */
        const MAX_LOG_ATTEMPTS = 3
        if (loggedFormKeyRef.current === formKey) return
        if (logInFlightRef.current === formKey) return
        if ((logAttemptsRef.current[formKey] || 0) >= MAX_LOG_ATTEMPTS) return
        /* Replicate the BookingConflictPanel cascade so the logged
         * recommendation matches the headline the dispatcher actually
         * saw. Without this, a 'shift' path (fitting alternate or
         * size-window shift) would silently fall through to
         * `request.startMin` — logging the typed time instead of the
         * time the panel said to book. */
        const recPlantCode = conflict?.plantCode || top?.plantCode || null
        const recDate = conflict?.bestEffortSlot?.dateStr || planDate || null
        let recKind = 'happy-path'
        let recStartMin = null
        if (!conflict) {
            recStartMin = recommendedSlot?.startMin ?? request?.startMin ?? null
        } else {
            const helpFleetTotal = (conflict.helpAvailability || []).reduce((sum, h) => sum + (h?.free || 0), 0)
            const helpCovers = helpFleetTotal >= (conflict.shortBy ?? 0)
            const fittingAlternate = (conflict.alternateTimes || []).find((s) => s?.fits) || null
            const hasFittingAlternate = !!fittingAlternate
            const hasBestEffort = !!conflict.bestEffortSlot
            const bestEffortStartMin = conflict.bestEffortSlot?.slot?.startMin
            const bestEffortFindsBetterSameDayTime =
                hasBestEffort &&
                conflict.bestEffortSlot.isSameDay &&
                Number.isFinite(bestEffortStartMin) &&
                bestEffortStartMin !== request?.startMin
            if (conflict.launchSlotFull) {
                recKind = 'launch-cap-shift'
                recStartMin = hasFittingAlternate ? fittingAlternate.startMin : (request?.startMin ?? null)
            } else if (bestEffortFindsBetterSameDayTime) {
                recKind = 'best-effort'
                recStartMin = bestEffortStartMin ?? null
            } else if (helpCovers) {
                recKind = 'help'
                recStartMin = request?.startMin ?? null
            } else if (hasFittingAlternate) {
                recKind = 'shift'
                recStartMin = fittingAlternate.startMin
            } else if (hasBestEffort) {
                recKind = 'best-effort'
                recStartMin = bestEffortStartMin ?? null
            } else {
                recKind = 'none'
                recStartMin = request?.startMin ?? null
            }
        }
        const payload = {
            context: {
                conflict: conflict || null,
                ranked: ranked || [],
                recommendedSlot: recommendedSlot || null,
                topPlantCode: top?.plantCode || null,
                yourPlantScope: null
            },
            form: {
                address: request?.address || '',
                planDate,
                pourMethod: request?.pourMethod || '',
                spacingMin: request?.spacingMin ?? null,
                startTime: formatMinutesAsClock(request?.startMin ?? 0),
                trucksNeeded: request?.trucksNeeded ?? null,
                windowEndMin: (request?.startMin ?? 0) + (request?.durationMin ?? 0),
                windowStartMin: request?.startMin ?? null,
                yardage: request?.yardage ?? null
            },
            recommendation: {
                dateStr: recDate,
                kind: recKind,
                plantCode: recPlantCode,
                plantName: conflict?.plantName || top?.plantName || null,
                startTime: Number.isFinite(recStartMin) ? formatMinutesAsClock(recStartMin) : null
            }
        }
        logInFlightRef.current = formKey
        logAttemptsRef.current[formKey] = (logAttemptsRef.current[formKey] || 0) + 1
        BookOrderLogService.logSuggestion(payload).then((result) => {
            if (logInFlightRef.current === formKey) logInFlightRef.current = null
            if (result) {
                loggedFormKeyRef.current = formKey
            }
            /* On failure: loggedFormKeyRef stays unset, so the next
             * render that satisfies all gates will retry — capped at
             * MAX_LOG_ATTEMPTS via logAttemptsRef. The viewable log
             * lives on the Plan → Admin tab. */
        })
    }, [submitted, request, top, conflict, recommendedSlot, ranked, planDate, distancesLoading])

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-4 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Form */}
                <section className="lg:col-span-4 rounded-lg flex flex-col bg-bg-primary border border-border-light">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-clipboard-list text-[16px]" />
                        </div>
                        <div>
                            <div className="text-[14px] font-semibold text-text-primary">Find a Spot</div>
                            <div className="text-[12px] mt-0.5 text-text-tertiary">
                                Booking-assist tool — surfaces the best plant + time for an order. It does not place the
                                booking; the dispatcher still books manually.
                                {planDateLabel && (
                                    <span className="block mt-1 text-text-secondary">Looking at {planDateLabel}</span>
                                )}
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
                            {dateError && <p className="mt-1.5 text-[11px] text-red-600">{dateError}</p>}
                            {!dateError && planDateIsSunday && (
                                <p className="mt-1.5 text-[11px] text-red-600">
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
                                    <p className="mt-1.5 text-[11px] text-red-600">
                                        Use 24-hour HH:MM (e.g. 09:00, 14:30, 23:15).
                                    </p>
                                )}
                                {!startTimeMalformed && startTimeIsPast && (
                                    <p className="mt-1.5 text-[11px] text-red-600">
                                        Start time has already passed today — pick a later time or change the date.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                How are they pouring?
                            </label>
                            <div className="relative">
                                <select
                                    value={pourMethod}
                                    onChange={(e) => setPourMethod(e.target.value)}
                                    className="w-full appearance-none rounded-lg px-3 py-2.5 pr-9 text-[14px] outline-none cursor-pointer"
                                    style={FIELD_STYLE}
                                >
                                    <option value="">Select a method (optional)</option>
                                    {POUR_METHOD_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-text-tertiary" />
                            </div>
                            <p className="mt-1.5 text-[11px] text-text-tertiary">
                                Helps the system determine how many trucks this pour will need.
                            </p>
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
                                    /* Anything under 10 min is unrealistic for real-world
                                     * loading-bay throughput — snap to 6 on blur so the
                                     * recommender never works off a fantasy spacing the
                                     * dispatcher typed in a hurry. */
                                    onBlur={() => {
                                        const num = parseFloat(spacingMin)
                                        if (Number.isFinite(num) && num > 0 && num < 10) setSpacingMin('6')
                                    }}
                                    placeholder={String(DEFAULT_TRUCK_SPACING_MIN)}
                                    required
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                                    style={FIELD_STYLE}
                                />
                                <p className="mt-1.5 text-[11px] text-text-tertiary">
                                    Minutes between truck arrivals on a multi-load pour. Anything under 10 min snaps to
                                    6 — that&apos;s the tightest spacing a loading bay can sustain.
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
                            <p className="mt-1.5 text-[11px] text-text-tertiary">
                                Start typing — pick a suggestion to verify the address. Drive time runs against the
                                verified location.
                            </p>
                        </div>

                        {request &&
                            (request.exceedsShiftLimit ? (
                                <div className="rounded-lg px-3 py-2.5 text-[12px] flex flex-col gap-1.5 bg-[rgba(220,_38,_38,_0.08)] border border-[rgba(220,_38,_38,_0.35)] text-red-700">
                                    <div className="flex items-center gap-1.5 font-semibold">
                                        <i className="fas fa-triangle-exclamation text-[11px]" />
                                        Pour exceeds the 14-hour shift limit
                                    </div>
                                    <div className="text-[11.5px] text-text-secondary">
                                        At {request.spacingMin}-min spacing, this {request.yardage}-yd pour runs about{' '}
                                        {(request.projectedShiftMin / 60).toFixed(1)}h from first load-out to back-at-
                                        yard — over the 14h driver-shift cap.
                                    </div>
                                    <div className="text-[11px] text-[#b45309]">
                                        Drop the spacing below it or shrink the yardage so the pour fits a single 14h
                                        shift.
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg px-3 py-2.5 text-[12px] flex flex-col gap-1 bg-bg-secondary border border-border-light">
                                    <div className="flex justify-between text-text-secondary">
                                        <span>Estimated trucks</span>
                                        <span className="font-semibold text-text-primary">{request.trucksNeeded}</span>
                                    </div>
                                    <div className="flex justify-between text-text-secondary">
                                        <span>Pour window</span>
                                        <span className="font-semibold tabular-nums text-text-primary">
                                            {formatMinutesAsClock(request.startMin)}–
                                            {formatMinutesAsClock(request.startMin + request.durationMin)}
                                        </span>
                                    </div>
                                    <div className="text-[10.5px] mt-1 text-text-tertiary">
                                        Assumes {DEFAULT_LOAD_SIZE_YARDS}-yd loads, {request.spacingMin}-min spacing.
                                    </div>
                                </div>
                            ))}

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={!request || !!request.exceedsShiftLimit}
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
                            {(yardage || startTime || spacingMin || address || pourMethod || submitted) && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider px-3.5 py-2.5 bg-bg-secondary border border-border-light text-text-secondary"
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
                         * can overlap during a state transition.
                         *
                         * `showExceedsShift` short-circuits every other
                         * branch — when the typed spacing/yardage produces
                         * a pour that can't fit a 14h shift, the right
                         * pane should reflect that immediately rather than
                         * compute recommendations against an impossible
                         * pour. */
                        const showExceedsShift = !!request?.exceedsShiftLimit
                        const showIdle = !submitted && !showExceedsShift
                        const showSunday = submitted && planDateIsSunday && !showExceedsShift
                        const showSameDay = submitted && !planDateIsSunday && isBookingToday && !showExceedsShift
                        const showLoading =
                            submitted && !planDateIsSunday && !isBookingToday && distancesLoading && !showExceedsShift
                        const showNoPlants =
                            submitted &&
                            !planDateIsSunday &&
                            !isBookingToday &&
                            !distancesLoading &&
                            ranked.length === 0 &&
                            !showExceedsShift
                        const showResult =
                            submitted && !planDateIsSunday && !isBookingToday && top && !conflict && !showExceedsShift
                        const showConflict =
                            submitted && !planDateIsSunday && !isBookingToday && !!conflict && !showExceedsShift
                        const showDecorative = (showIdle || showLoading || showNoPlants) && !showExceedsShift

                        return (
                            <>
                                <FadeIn show={showExceedsShift}>
                                    <div className="rounded-lg p-5 flex flex-col gap-3 bg-[rgba(220,_38,_38,_0.08)] border border-[rgba(220,_38,_38,_0.35)] text-text-primary">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-red-600 text-white">
                                                <i className="fas fa-triangle-exclamation text-[16px]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[15px] font-bold text-red-700">
                                                    Pour exceeds the 14-hour shift limit
                                                </div>
                                                <div className="text-[12.5px] mt-1 leading-snug text-text-secondary">
                                                    At {request?.spacingMin}-min spacing, this {request?.yardage}-yd
                                                    pour would run about{' '}
                                                    <strong>
                                                        {request?.projectedShiftMin
                                                            ? (request.projectedShiftMin / 60).toFixed(1)
                                                            : '?'}
                                                        h
                                                    </strong>{' '}
                                                    from first load-out to back-at-yard. Operators can&apos;t legally
                                                    stay on the clock past the 14h DOT cap, so no plant can host this
                                                    pour as configured.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="rounded-md p-3 text-[12px] bg-bg-primary border border-border-light text-text-secondary">
                                            <div className="text-[10.5px] font-bold uppercase tracking-wider mb-1.5 text-text-tertiary">
                                                Either of these brings the pour under 14 hours:
                                            </div>
                                            <ul className="list-disc pl-4 space-y-0.5">
                                                <li>
                                                    Tighten the truck spacing — currently{' '}
                                                    <strong>{request?.spacingMin} min</strong>. Each minute trimmed cuts
                                                    roughly {Math.max(1, Math.ceil((request?.yardage || 0) / 10) - 1)}{' '}
                                                    minutes off the total pour duration.
                                                </li>
                                                <li>
                                                    Shrink the yardage — currently{' '}
                                                    <strong>{request?.yardage} yd</strong>. Splitting the order across
                                                    two days or two plants is the standard play for pours this big.
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </FadeIn>

                                <FadeIn show={showIdle}>
                                    <div className="rounded-lg p-8 text-center flex flex-col items-center gap-2 bg-bg-primary border border-border-light text-text-tertiary">
                                        <i className="fas fa-route text-3xl mb-2" />
                                        <div className="text-[14px] font-semibold text-text-secondary">
                                            Fill the form to see a booking recommendation
                                        </div>
                                        <div className="text-[12px]">
                                            I&apos;ll suggest the best plant and time, and flag any conflicts with the
                                            existing schedule.
                                        </div>
                                    </div>
                                </FadeIn>

                                <FadeIn show={showSunday}>
                                    <div className="rounded-lg p-6 text-center bg-[rgba(220,_38,_38,_0.08)] border border-[rgba(220,_38,_38,_0.35)] text-red-700">
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
                                    <div className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-[12px] bg-bg-secondary border border-border-light text-text-secondary">
                                        <i className="fas fa-route fa-spin text-[11px]" />
                                        Calculating drive times — plants further than {TRAVEL_MIN_HORIZON} min will be
                                        hidden.
                                    </div>
                                </FadeIn>

                                <FadeIn show={showNoPlants}>
                                    <div className="rounded-lg p-6 text-center bg-[rgba(217,_119,_6,_0.1)] border border-[rgba(217,_119,_6,_0.35)] text-[#b45309]">
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
                                <FadeIn show={showResult} delayMs={170}>
                                    {top && !conflict && (
                                        <RoutePreview
                                            jobAddress={request?.address}
                                            plantAddress={
                                                topPlantRecord?.plantAddress || topPlantRecord?.plant_address || ''
                                            }
                                            plantName={top.plantName}
                                            travelMin={top.travelMin}
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
                                <FadeIn show={showConflict} delayMs={170}>
                                    {conflict && (
                                        <RoutePreview
                                            jobAddress={request?.address}
                                            plantAddress={
                                                conflictPlantRecord?.plantAddress ||
                                                conflictPlantRecord?.plant_address ||
                                                ''
                                            }
                                            plantName={conflict.plantName}
                                            travelMin={travelMinByPlantCode?.[conflict.plantCode]}
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
