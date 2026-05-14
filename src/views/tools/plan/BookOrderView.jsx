import React, { useMemo, useState } from 'react'

import BookOrderForm, { formatPlanDateLabel } from '../../../app/components/plan/tabs/book-order/BookOrderForm'
import BookOrderResultsPane from '../../../app/components/plan/tabs/book-order/BookOrderResultsPane'
import { isValidMilitaryTime } from '../../../app/constants/bookOrderConstants'
import useAddressDistances from '../../../app/hooks/useAddressDistances'
import useAdjacentDayPlantProduction from '../../../app/hooks/useAdjacentDayPlantProduction'
import { useBookOrderAuditLog } from '../../../app/hooks/useBookOrderAuditLog'
import usePlantToPlantDistances from '../../../app/hooks/usePlantToPlantDistances'
import useYesterdayOperatorRestFloor from '../../../app/hooks/useYesterdayOperatorRestFloor'
import {
    buildBookingRequest,
    computeBookingConflict,
    DEFAULT_LOAD_SIZE_YARDS,
    findRecommendedStartTime,
    rankPlantsForBooking
} from '../../../utils/BookOrderUtility'
import { getDayOfWeekForDate, getNowCstMinutes, getTodayDate, timeToMinutes } from '../../../utils/PlanUtility'

/**
 * Booking-assist tool. Surfaces the best plant + time for a new pour given
 * yardage, requested start, pour method, and the job address. Does not place
 * the booking; the dispatcher still books manually elsewhere.
 *
 * Architecture: this orchestrator owns form state + every memoized
 * cross-input derivation (request, ranked plants, conflict, recommended
 * slot). The form column, the results pane, and the audit-log writer all
 * live in their own files — this file is the "wiring diagram".
 */
function BookOrderView({ accentColor, mixerCountsByPlant, onChangePlanDate, planDate, plantProduction, plants }) {
    const [yardage, setYardage] = useState('')
    const [startTime, setStartTime] = useState('')
    const [spacingMin, setSpacingMin] = useState('')
    const [address, setAddress] = useState('')
    const [pourMethod, setPourMethod] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [dateError, setDateError] = useState('')

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
     * up against an empty pool. CST-anchored day-of-week so the answer
     * doesn't drift if the dispatcher (or a developer) is in another timezone. */
    const isSundayDate = (dateString) => getDayOfWeekForDate(dateString) === 0
    const planDateIsSunday = isSundayDate(planDate)

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

    const top = ranked[0]
    const planDateLabel = formatPlanDateLabel(planDate)

    /* Per-plant earliest legal first-load-out for the booking date,
     * derived from yesterday's actual ticket times + the 10-hour DOT rest
     * window. Drives the move / alternate-time / recommended-time scanners
     * so suggestions never propose dispatching an operator who's still
     * inside their mandatory rest window. */
    const restFloorByPlant = useYesterdayOperatorRestFloor(planDate)

    /* Plant-to-plant drive times from whichever plant ends up short on
     * trucks. Used by `findHelpAvailability` to exclude lender plants that
     * sit further than `MAX_HELP_TRAVEL_MIN_FROM_PLANT` (60 min) of driving
     * from the short plant — dispatching a truck across that much road eats
     * too much of the lender's shift to be realistic. */
    const shortPlantCode = ranked?.[0]?.plantCode || null
    const { minutesByPlantCode: travelMinFromShortPlantByPlantCode } = usePlantToPlantDistances({
        fromPlantCode: shortPlantCode,
        plants: submitted ? plants : null
    })

    /* Adjacent days' schedules. Powers the "soonest day that can host"
     * recommendation inside the conflict panel — when the requested day
     * genuinely can't fit the pour, we walk upcoming days and surface the
     * first one with a fitting slot. */
    const adjacentProduction = useAdjacentDayPlantProduction(planDate)

    /* Surface time-shift / help-available / cross-day suggestions only when
     * the closest plant (now always #1) genuinely can't cover the requested
     * window. travelMinByPlantCode lets the help section sort lender plants
     * by drive time from the job — a proxy for proximity to the suggesting
     * plant. */
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

    /* Write exactly one audit-log row per submission once distances settle. */
    useBookOrderAuditLog({
        conflict,
        distancesLoading,
        planDate,
        ranked,
        recommendedSlot,
        request,
        submitted,
        top
    })

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

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-4 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <BookOrderForm
                    accentColor={accentColor}
                    address={address}
                    dateError={dateError}
                    handleDateChange={handleDateChange}
                    handleReset={handleReset}
                    handleSubmit={handleSubmit}
                    onAddressChange={setAddress}
                    onPourMethodChange={setPourMethod}
                    onSpacingMinChange={setSpacingMin}
                    onStartTimeChange={setStartTime}
                    onYardageChange={setYardage}
                    planDate={planDate}
                    planDateIsSunday={planDateIsSunday}
                    planDateLabel={planDateLabel}
                    pourMethod={pourMethod}
                    request={request}
                    requiresSpacing={requiresSpacing}
                    spacingMin={spacingMin}
                    startTime={startTime}
                    startTimeIsPast={startTimeIsPast}
                    startTimeMalformed={startTimeMalformed}
                    submitted={submitted}
                    todayDate={todayDate}
                    yardage={yardage}
                />

                <BookOrderResultsPane
                    accentColor={accentColor}
                    conflict={conflict}
                    conflictPlantRecord={conflictPlantRecord}
                    distancesLoading={distancesLoading}
                    isBookingToday={isBookingToday}
                    mixerCountsByPlant={mixerCountsByPlant}
                    planDateIsSunday={planDateIsSunday}
                    plantProduction={plantProduction}
                    plants={plants}
                    ranked={ranked}
                    recommendedSlot={recommendedSlot}
                    request={request}
                    submitted={submitted}
                    top={top}
                    topPlantRecord={topPlantRecord}
                    travelMinByPlantCode={travelMinByPlantCode}
                />
            </div>
        </div>
    )
}

export default BookOrderView
