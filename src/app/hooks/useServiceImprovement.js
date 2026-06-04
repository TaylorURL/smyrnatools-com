import { useEffect, useRef, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'

/**
 * Centralised data source for the "service improvement since X" stat shown
 * on Operations > Statistics > Overview and Operations > Statistics >
 * Service. One fetch per mount (the underlying aggregate covers all
 * historical dispatch_data and only updates as new tickets arrive, so a
 * fresh fetch per page open is plenty current). Cached across consumers
 * via module-level promise memoisation keyed on cutoff so opening both
 * pages back-to-back issues a single network call.
 *
 * Shape returned to consumers:
 *   { loading, error, data: {
 *       cutoff,
 *       badLatenessMin,
 *       before: { totalOrders, badOrders, score, firstDate, lastDate },
 *       after:  { totalOrders, badOrders, score, firstDate, lastDate },
 *       deltaPp,   // (afterScore - beforeScore) * 100, null if either window is empty
 *       improved   // afterScore > beforeScore (null if either is null)
 *   } }
 *
 * @param {string} [cutoff] Optional ISO cutoff override. Defaults server-side
 *   to `2026-05-01` — the milestone the dispatcher wants to measure against.
 */
const cache = new Map()

export function useServiceImprovement(cutoff) {
    const [state, setState] = useState({ data: null, error: null, loading: true })
    const cancelledRef = useRef(false)
    useEffect(() => {
        cancelledRef.current = false
        const key = cutoff || 'default'
        const existing = cache.get(key)
        const promise =
            existing ||
            DispatchDataService.fetchServiceImprovement(cutoff)
                .then((raw) => normalize(raw))
                .catch((err) => {
                    cache.delete(key)
                    throw err
                })
        if (!existing) cache.set(key, promise)
        promise
            .then((data) => {
                if (cancelledRef.current) return
                setState({ data, error: null, loading: false })
            })
            .catch((err) => {
                if (cancelledRef.current) return
                setState({ data: null, error: err?.message || 'Failed to load service improvement', loading: false })
            })
        return () => {
            cancelledRef.current = true
        }
    }, [cutoff])
    return state
}

/** Normalise the raw edge-function response into the shape consumers want. */
function normalize(raw) {
    const before = raw?.before || {}
    const after = raw?.after || {}
    const beforeScore = Number.isFinite(before.score) ? before.score : null
    const afterScore = Number.isFinite(after.score) ? after.score : null
    const deltaPp = beforeScore != null && afterScore != null ? (afterScore - beforeScore) * 100 : null
    const improved = deltaPp == null ? null : deltaPp > 0
    return {
        after: {
            badOrders: Number(after.badOrders) || 0,
            score: afterScore,
            totalOrders: Number(after.totalOrders) || 0
        },
        badLatenessMin: Number(raw?.badLatenessMin) || 30,
        before: {
            badOrders: Number(before.badOrders) || 0,
            score: beforeScore,
            totalOrders: Number(before.totalOrders) || 0
        },
        cutoff: raw?.cutoff || '2026-05-01',
        deltaPp,
        improved
    }
}
