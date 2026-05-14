import React from 'react'

import { formatFullDateLabel, formatMinutesAsClock } from '../../../../constants/bookOrderConstants'

/** Conflict-resolution panel — only renders when the closest plant
 *  (forced to position #1) doesn't have enough free trucks. Suggests
 *  shifting the new order to a different time on the same plant, OR
 *  pulling help from nearby plants. Both are read-only suggestions;
 *  the dispatcher still books manually. */
export default function BookingConflictPanel({ accentColor, conflict, request }) {
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
