import React, { useEffect, useMemo, useState } from 'react'

import AddressAutocomplete from '../../../app/components/common/AddressAutocomplete'
import useAddressDistances from '../../../app/hooks/useAddressDistances'
import {
    buildBookingRequest,
    computeBookingConflict,
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_TRUCK_SPACING_MIN,
    findRecommendedStartTime,
    rankPlantsForBooking,
    TRAVEL_MIN_HORIZON
} from '../../../utils/BookOrderUtility'
import DateUtility from '../../../utils/DateUtility'
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

/** Compact table preview of the recommended plant's day with the proposed
 *  booking inserted in chronological position. The new row fades + slides
 *  in on mount (and again whenever the proposed time / yardage change), so
 *  the dispatcher visually sees where the booking will sit relative to
 *  existing pours — same column layout as the Schedule tab. */
function SchedulePreview({ accentColor, existingOrders, newOrder, plantName }) {
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

    const [animated, setAnimated] = useState(false)
    useEffect(() => {
        setAnimated(false)
        const handle = setTimeout(() => setAnimated(true), 80)
        return () => clearTimeout(handle)
    }, [newOrder?.startMin, newOrder?.yardage, newOrder?.trucksNeeded])

    return (
        <div
            className="rounded-lg overflow-hidden"
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
                <table className="w-full text-[12px]">
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            {['Start', 'Customer', 'Yards', 'Trucks'].map((header) => (
                                <th
                                    key={header}
                                    className="px-3 py-2 text-left font-semibold uppercase text-[10.5px] tracking-wider"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-3 py-3 text-center italic"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    No existing orders today
                                </td>
                            </tr>
                        )}
                        {sortedRows.map((row) => {
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
                                            className="px-3 py-2 font-mono tabular-nums font-bold"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {formatMinutesAsClock(row.startMin)}
                                        </td>
                                        <td className="px-3 py-2 font-semibold" style={{ color: accentColor }}>
                                            New booking
                                        </td>
                                        <td
                                            className="px-3 py-2 font-mono tabular-nums"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {row.order.yardage}
                                        </td>
                                        <td
                                            className="px-3 py-2 font-mono tabular-nums"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {row.order.trucksNeeded}
                                        </td>
                                    </tr>
                                )
                            }
                            const o = row.order
                            return (
                                <tr
                                    key={o.orderId || `${o.orderNum}-${row.startMin}`}
                                    style={{ borderTop: '1px solid var(--border-light)' }}
                                >
                                    <td
                                        className="px-3 py-2 font-mono tabular-nums"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {o.startTime || '—'}
                                    </td>
                                    <td className="px-3 py-2 truncate" style={{ color: 'var(--text-secondary)' }}>
                                        {o.customer || '—'}
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono tabular-nums"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {o.yardage || '—'}
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono tabular-nums"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {o.truckCount || '—'}
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
        </div>
    )
}

/** Conflict-resolution panel — only renders when the closest plant
 *  (forced to position #1) doesn't have enough free trucks. Suggests
 *  shifting the new order to a different time on the same plant, OR
 *  moving an existing overlapping order somewhere else. Both are
 *  read-only suggestions; the dispatcher still books manually. */
function BookingConflictPanel({ conflict }) {
    if (!conflict) return null
    const { alternateTimes, helpAvailability, moveCandidates, plantName, shortBy } = conflict
    const hasHelp = helpAvailability && helpAvailability.length > 0
    return (
        <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{
                background: 'rgba(217, 119, 6, 0.08)',
                border: '1px solid rgba(217, 119, 6, 0.35)'
            }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                    style={{ background: 'rgba(217, 119, 6, 0.18)', color: '#b45309' }}
                >
                    <i className="fas fa-triangle-exclamation text-[14px]" />
                </div>
                <div className="min-w-0">
                    <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {plantName} is short {shortBy} truck{shortBy === 1 ? '' : 's'} at this time
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Pick another start time, reschedule one of {plantName}&apos;s overlapping orders, or pull help
                        from a nearby plant.
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <div
                    className="text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    Help from nearby plants
                </div>
                {hasHelp ? (
                    <div className="flex flex-wrap gap-2">
                        {helpAvailability.map((help) => {
                            const fullyCovers = help.free >= shortBy
                            return (
                                <span
                                    key={help.plantCode}
                                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)'
                                    }}
                                    title={
                                        fullyCovers
                                            ? `${help.plantName} could lend all ${shortBy} trucks needed`
                                            : `${help.plantName} could lend ${help.free} of the ${shortBy} trucks needed`
                                    }
                                >
                                    <i
                                        className="fas fa-truck-arrow-right text-[10px]"
                                        style={{ color: fullyCovers ? '#16a34a' : '#b45309' }}
                                    />
                                    <span className="font-semibold">{help.plantName}</span>
                                    <span style={{ color: 'var(--text-tertiary)' }}>
                                        · {help.free} free
                                        {Number.isFinite(help.travelMinFromJob)
                                            ? ` · ${help.travelMinFromJob} min`
                                            : ''}
                                    </span>
                                </span>
                            )
                        })}
                    </div>
                ) : (
                    <div
                        className="text-[12px] rounded-md px-3 py-2"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        No nearby plant has spare trucks at this time — help is not available.
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <div
                    className="text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    Try a different time on {plantName}
                </div>
                {alternateTimes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {alternateTimes.map((slot) => {
                            const fits = slot.fits
                            const tone = fits ? '#16a34a' : '#b45309'
                            const trailing = fits
                                ? `${slot.free} trucks free`
                                : `still short ${slot.shortBy} truck${slot.shortBy === 1 ? '' : 's'}`
                            const tooltip = fits
                                ? `${plantName} can cover this booking at ${formatMinutesAsClock(slot.startMin)} with no help or rescheduling.`
                                : `${plantName}'s closest match — ${slot.free} of ${slot.free + slot.shortBy} trucks free at ${formatMinutesAsClock(slot.startMin)}.`
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
                ) : (
                    <div
                        className="text-[12px] rounded-md px-3 py-2"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        No window today fits without help or rescheduling — {plantName}&apos;s pool is committed across
                        the operating day.
                    </div>
                )}
            </div>

            {moveCandidates.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div
                        className="text-[10.5px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        Or reschedule one of {plantName}&apos;s orders
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {moveCandidates.map((cand) => (
                            <MoveCandidateRow key={cand.order?.orderId || cand.order?.orderNum} candidate={cand} />
                        ))}
                    </div>
                </div>
            )}

            {moveCandidates.length === 0 && !hasHelp && alternateTimes.length === 0 && (
                <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    No automatic resolution available — try a plant further from the job, or split the booking.
                </div>
            )}
        </div>
    )
}

function MoveCandidateRow({ candidate }) {
    const { alternateTimes, order, trucks, window } = candidate
    const customer = order?.customer || 'Order'
    const yards = parseFloat(order?.yardage) || 0
    const orderLabel = order?.orderNum ? `#${order.orderNum}` : ''
    return (
        <div
            className="rounded-md px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div className="flex items-center gap-2 min-w-0">
                <i className="fas fa-arrows-up-down-left-right text-[10px]" style={{ color: '#b45309' }} />
                <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {customer} {orderLabel}
                </span>
            </div>
            <span className="text-[11.5px] font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {formatMinutesAsClock(window.startMin)} · {yards} yd · {trucks} truck{trucks === 1 ? '' : 's'}
            </span>
            {alternateTimes.length > 0 ? (
                <span className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    <i className="fas fa-arrow-right text-[9px]" />
                    move to {alternateTimes.map((slot) => formatMinutesAsClock(slot.startMin)).join(' · ')}
                </span>
            ) : (
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    no clear reschedule slot today
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
                travelMinByPlantCode
            }),
        [mixerCountsByPlant, planDate, plantProduction, plants, ranked, request, travelMinByPlantCode]
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
        return findRecommendedStartTime({
            mixerCountsByPlant,
            planDate,
            plant: topPlantRecord,
            plantProduction,
            request
        })
    }, [topPlantRecord, request, conflict, mixerCountsByPlant, planDate, plantProduction])

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
                            {submitted && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider px-3.5 py-2.5"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    <i className="fas fa-rotate-left text-[12px]" />
                                    Reset
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                {/* Recommendations */}
                <section className="lg:col-span-8 flex flex-col gap-3">
                    {!submitted && (
                        <div
                            className="rounded-lg p-8 text-center flex flex-col items-center gap-2"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px dashed var(--border-light)',
                                color: 'var(--text-tertiary)'
                            }}
                        >
                            <i className="fas fa-route text-3xl mb-2" />
                            <div className="text-[14px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                Fill the form to see a booking recommendation
                            </div>
                            <div className="text-[12px]">
                                I&apos;ll suggest the best plant and time, and flag any conflicts with the existing
                                schedule.
                            </div>
                        </div>
                    )}

                    {submitted && planDateIsSunday && (
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
                            <div className="text-[12px] mt-1">Pick a weekday or Saturday to see a recommendation.</div>
                        </div>
                    )}

                    {submitted && !planDateIsSunday && isBookingToday && <SameDayAdvice accentColor={accentColor} />}

                    {submitted && !planDateIsSunday && !isBookingToday && distancesLoading && (
                        <div
                            className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-[12px]"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            <i className="fas fa-route fa-spin text-[11px]" />
                            Calculating drive times — plants further than {TRAVEL_MIN_HORIZON} min will be hidden.
                        </div>
                    )}

                    {submitted && !planDateIsSunday && !isBookingToday && !distancesLoading && ranked.length === 0 && (
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
                                Every plant is more than {TRAVEL_MIN_HORIZON} min from the job, closed for the day, or
                                missing driver-pool data. Try a different address or date.
                            </div>
                        </div>
                    )}

                    {submitted && !planDateIsSunday && !isBookingToday && top && !conflict && (
                        <>
                            <RecommendationAdvice
                                accentColor={accentColor}
                                recommendedSlot={recommendedSlot}
                                request={request}
                                top={top}
                            />
                            <SchedulePreview
                                accentColor={accentColor}
                                existingOrders={plantProduction?.[top.plantCode]?.orders || []}
                                newOrder={
                                    recommendedSlot && recommendedSlot.startMin !== request.startMin
                                        ? { ...request, startMin: recommendedSlot.startMin }
                                        : request
                                }
                                plantName={top.plantName}
                            />
                        </>
                    )}

                    {submitted && !planDateIsSunday && !isBookingToday && conflict && (
                        <>
                            <BookingConflictPanel conflict={conflict} />
                            <SchedulePreview
                                accentColor={accentColor}
                                existingOrders={plantProduction?.[conflict.plantCode]?.orders || []}
                                newOrder={request}
                                plantName={conflict.plantName}
                            />
                        </>
                    )}
                </section>
            </div>
        </div>
    )
}

export default BookOrderView
