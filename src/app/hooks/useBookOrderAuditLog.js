import { useEffect, useRef } from 'react'

import { BookOrderLogService } from '../../services/BookOrderLogService'
import { formatMinutesAsClock } from '../constants/bookOrderConstants'

/**
 * Logs exactly one row per submitted booking form, *after* the address /
 * travel-time loaders have settled — otherwise the recommender's
 * intermediate rankings (different plants while OSRM resolves) would each
 * fire a separate audit row, polluting the trail.
 *
 * Dedupe is three-stage so a transient network failure can retry without
 * spamming duplicates:
 *   - loggedFormKeyRef — already succeeded → never re-log.
 *   - logInFlightRef   — POST in progress → don't fire a second.
 *   - logAttemptsRef   — failed too many times → stop retrying.
 *
 * The viewable log lives on the Plan → Admin tab.
 */
export function useBookOrderAuditLog({
    conflict,
    distancesLoading,
    planDate,
    ranked,
    recommendedSlot,
    request,
    submitted,
    top
}) {
    const loggedFormKeyRef = useRef(null)
    const logInFlightRef = useRef(null)
    const logAttemptsRef = useRef({})
    /* Without this guard the INITIAL render — where the hook hasn't run
     * its effect yet so `isLoading` is still its default `false` — slips
     * past the loading gate and we log the default plant ordering
     * (alphabetical by code → "Freeport" wins) instead of waiting for
     * the real travel-time ranking to settle. */
    const distancesObservedLoadingRef = useRef(false)

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
        const MAX_LOG_ATTEMPTS = 3
        if (loggedFormKeyRef.current === formKey) return
        if (logInFlightRef.current === formKey) return
        if ((logAttemptsRef.current[formKey] || 0) >= MAX_LOG_ATTEMPTS) return

        /* Replicate the BookingConflictPanel cascade so the logged
         * recommendation matches the headline the dispatcher actually
         * saw. Without this, a 'shift' path would silently fall through
         * to `request.startMin` — logging the typed time instead of the
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
            if (result) loggedFormKeyRef.current = formKey
            /* On failure: loggedFormKeyRef stays unset, so the next render
             * that satisfies all gates will retry — capped via
             * logAttemptsRef. */
        })
    }, [submitted, request, top, conflict, recommendedSlot, ranked, planDate, distancesLoading])
}
