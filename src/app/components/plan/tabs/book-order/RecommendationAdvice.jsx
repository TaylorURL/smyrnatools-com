import React from 'react'

import {
    AFTER_HOURS_CUTOFF_MIN,
    formatMinutesAsClock,
    IDLE_GAP_THRESHOLD_MIN
} from '../../../../constants/bookOrderConstants'

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
export default function RecommendationAdvice({ accentColor, recommendedSlot, request, top }) {
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
                    <i className="fas fa-circle-info text-[12px] mt-0.5 shrink-0 text-text-primary" />
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
