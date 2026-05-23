import React from 'react'

import { TRAVEL_MIN_HORIZON } from '../../../../../utils/BookOrderUtility'
import FadeIn from '../../../common/FadeIn'
import BookingConflictPanel from './BookingConflictPanel'
import DecorativeSchedulePreview from './DecorativeSchedulePreview'
import RecommendationAdvice from './RecommendationAdvice'
import RoutePreview from './RoutePreview'
import SameDayAdvice from './SameDayAdvice'
import SchedulePreview from './SchedulePreview'

/** Right-hand pane — branches between idle, sunday-closed, same-day shortcut,
 *  loading, no-plants, result, and conflict states. Every branch is wrapped
 *  in a `FadeIn` so swapping states never just snaps. */
export default function BookOrderResultsPane({
    accentColor,
    conflict,
    conflictPlantRecord,
    distancesLoading,
    isBookingToday,
    mixerCountsByPlant,
    planDateIsSunday,
    plantProduction,
    plants,
    ranked,
    recommendedSlot,
    request,
    submitted,
    top,
    topPlantRecord,
    travelMinByPlantCode
}) {
    /* Roll up the branch conditions once so each FadeIn gets the same boolean
     * it'd have in an if/else tree, but the markup stays flat and animations
     * can overlap during a state transition. */
    const showExceedsShift = !!request?.exceedsShiftLimit
    const showIdle = !submitted && !showExceedsShift
    const showSunday = submitted && planDateIsSunday && !showExceedsShift
    const showSameDay = submitted && !planDateIsSunday && isBookingToday && !showExceedsShift
    const showLoading = submitted && !planDateIsSunday && !isBookingToday && distancesLoading && !showExceedsShift
    const showNoPlants =
        submitted &&
        !planDateIsSunday &&
        !isBookingToday &&
        !distancesLoading &&
        ranked.length === 0 &&
        !showExceedsShift
    const showResult = submitted && !planDateIsSunday && !isBookingToday && top && !conflict && !showExceedsShift
    const showConflict = submitted && !planDateIsSunday && !isBookingToday && !!conflict && !showExceedsShift
    const showDecorative = (showIdle || showLoading || showNoPlants) && !showExceedsShift

    return (
        <section className="lg:col-span-8 flex flex-col gap-3">
            <FadeIn show={showExceedsShift}>
                <div className="rounded-lg p-5 flex flex-col gap-3 bg-[rgba(220,_38,_38,_0.08)] border border-[rgba(220,_38,_38,_0.35)] text-text-primary">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-red-600 text-white">
                            <i className="fas fa-triangle-exclamation text-[16px]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[15px] font-bold text-text-primary">
                                Pour exceeds the 14-hour shift limit
                            </div>
                            <div className="text-[12.5px] mt-1 leading-snug text-text-secondary">
                                At {request?.spacingMin}-min spacing, this {request?.yardage}-yd pour would run about{' '}
                                <strong>
                                    {request?.projectedShiftMin ? (request.projectedShiftMin / 60).toFixed(1) : '?'}h
                                </strong>{' '}
                                from first load-out to back-at-yard. Operators can&apos;t legally stay on the clock past
                                the 14h DOT cap, so no plant can host this pour as configured.
                            </div>
                        </div>
                    </div>
                    <div className="rounded-md p-3 text-[12px] bg-bg-primary border border-border-light text-text-secondary">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider mb-1.5 text-text-tertiary">
                            Either of these brings the pour under 14 hours:
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5">
                            <li>
                                Tighten the truck spacing — currently <strong>{request?.spacingMin} min</strong>. Each
                                minute trimmed cuts roughly {Math.max(1, Math.ceil((request?.yardage || 0) / 10) - 1)}{' '}
                                minutes off the total pour duration.
                            </li>
                            <li>
                                Shrink the yardage — currently <strong>{request?.yardage} yd</strong>. Splitting the
                                order across two days or two plants is the standard play for pours this big.
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
                        I&apos;ll suggest the best plant and time, and flag any conflicts with the existing schedule.
                    </div>
                </div>
            </FadeIn>

            <FadeIn show={showSunday}>
                <div className="rounded-lg p-6 text-center bg-[rgba(220,_38,_38,_0.08)] border border-[rgba(220,_38,_38,_0.35)] text-text-primary">
                    <i className="fas fa-ban text-2xl mb-2" />
                    <div className="text-[14px] font-semibold">Plants are closed on Sundays.</div>
                    <div className="text-[12px] mt-1">Pick a weekday or Saturday to see a recommendation.</div>
                </div>
            </FadeIn>

            <FadeIn show={showSameDay}>
                <SameDayAdvice accentColor={accentColor} />
            </FadeIn>

            <FadeIn show={showLoading}>
                <div className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-[12px] bg-bg-secondary border border-border-light text-text-secondary">
                    <i className="fas fa-route fa-spin text-[11px]" />
                    Calculating drive times — plants further than {TRAVEL_MIN_HORIZON} min will be hidden.
                </div>
            </FadeIn>

            <FadeIn show={showNoPlants}>
                <div className="rounded-lg p-6 text-center bg-[rgba(217,_119,_6,_0.1)] border border-[rgba(217,_119,_6,_0.35)] text-text-primary">
                    <i className="fas fa-triangle-exclamation text-2xl mb-2" />
                    <div className="text-[14px] font-semibold">No plants within {TRAVEL_MIN_HORIZON} minutes.</div>
                    <div className="text-[12px] mt-1">
                        Every plant is more than {TRAVEL_MIN_HORIZON} min from the job, closed for the day, or missing
                        driver-pool data. Try a different address or date.
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
                        plantAddress={topPlantRecord?.plantAddress || topPlantRecord?.plant_address || ''}
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
                {conflict && <BookingConflictPanel accentColor={accentColor} conflict={conflict} request={request} />}
            </FadeIn>
            <FadeIn show={showConflict} delayMs={170}>
                {conflict && (
                    <RoutePreview
                        jobAddress={request?.address}
                        plantAddress={conflictPlantRecord?.plantAddress || conflictPlantRecord?.plant_address || ''}
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
                        /* Render the new booking row at the EFFECTIVE start (the recommended shift target if one
                         * applies), not the typed time — otherwise the headline says "shift to 04:00" while the
                         * table shows it at 07:00. */
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
        </section>
    )
}
