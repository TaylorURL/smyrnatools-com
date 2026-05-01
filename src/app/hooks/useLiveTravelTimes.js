import { useCallback, useEffect, useRef, useState } from 'react'

import { TrafficService } from '../../services/TrafficService'

/**
 * Prefetches Google live travel for a list of `(origin, destination)` pairs
 * and returns a `{ minutesByKey, getMinutes }` lookup. The edge function
 * caches by 15-min departure bucket, so repeat calls hit the cache instead
 * of the paid API. Pairs whose lookup fails are cached as `null` so the
 * hook never retries them on every re-render.
 *
 * The pair shape is `{ key, origin, destination }`. `key` should uniquely
 * identify the pair (e.g. `${plantCode}::${jobAddress}`); callers reuse it
 * to look up the result via `getMinutes(key)`.
 *
 * Two anti-thrash safeguards:
 *
 *   1. **In-flight tracking via ref.** This hook used to depend on its own
 *      state in the effect's dependency array, which produced a runaway
 *      loop: every `setMinutesByKey` write re-ran the effect, and any pair
 *      whose Promise was still in flight (no state row yet) re-entered
 *      `pending` and fired a duplicate fetch. On a 350-pair prefetch that
 *      compounded to hundreds of thousands of in-flight fetches and OOMed
 *      the tab. The fix tracks in-flight keys in a ref so duplicates are
 *      filtered out without needing the effect to re-read its own state.
 *
 *   2. **Single-pair probe before the batch.** Firing 350 fetches in
 *      parallel against an unauthenticated / misconfigured edge function
 *      produces 350 console errors before any of them resolves and tells
 *      `TrafficService` to latch unavailable. We probe with the first pair
 *      first — if it latches the service, we skip the batch entirely.
 */
export default function useLiveTravelTimes(travelPairs) {
    const [minutesByKey, setMinutesByKey] = useState({})
    /** Keys we've already resolved (success or null fallback). Read by the
     *  effect without listing `minutesByKey` as a dep. */
    const knownKeysRef = useRef(new Set())
    /** Keys with a Promise still in flight. Prevents duplicate fetches
     *  when the effect re-runs because `travelPairs` changed before the
     *  previous batch finished resolving. */
    const inFlightRef = useRef(new Set())

    useEffect(() => {
        if (!travelPairs.length) return undefined
        // Skip the whole prefetch once the service has latched unavailable —
        // otherwise the console fills with 503s every re-render.
        if (TrafficService.isUnavailable()) return undefined

        // Filter out keys that already have a result OR have a Promise in
        // flight. Without the in-flight gate, every state commit re-fires
        // the same fetches before they've resolved.
        const pending = travelPairs.filter((p) => !knownKeysRef.current.has(p.key) && !inFlightRef.current.has(p.key))
        if (!pending.length) return undefined

        let cancelled = false

        /** Resolve a single pair and update the in-flight / known sets. */
        const resolvePair = async (pair) => {
            const result = await TrafficService.fetchDistance(pair.origin, pair.destination)
            inFlightRef.current.delete(pair.key)
            knownKeysRef.current.add(pair.key)
            if (!result || result.error) return { key: pair.key, minutes: null }
            const seconds = result.durationInTrafficSeconds ?? result.durationSeconds ?? null
            if (!Number.isFinite(seconds)) return { key: pair.key, minutes: null }
            return { key: pair.key, minutes: Math.max(1, Math.round(seconds / 60)) }
        }

        /** Apply a batch of resolved results to state. No-op when cancelled
         *  or when the batch produced nothing new. */
        const commit = (entries) => {
            if (cancelled) return
            const next = {}
            for (const entry of entries) {
                if (!entry) continue
                next[entry.key] = entry.minutes
            }
            if (Object.keys(next).length > 0) {
                setMinutesByKey((prev) => ({ ...prev, ...next }))
            }
        }

        const run = async () => {
            // Probe with the first pair. If `TrafficService` latches
            // unavailable (auth missing, API key missing, gateway rejecting)
            // we skip the rest of the batch and avoid spamming the console
            // with N−1 wasted 503 errors.
            const [probe, ...rest] = pending
            inFlightRef.current.add(probe.key)
            const probeResult = await resolvePair(probe)
            if (cancelled) return
            commit([probeResult])
            if (TrafficService.isUnavailable() || !rest.length) return

            rest.forEach((p) => inFlightRef.current.add(p.key))
            const restResults = await Promise.allSettled(rest.map(resolvePair))
            commit(restResults.map((r) => (r.status === 'fulfilled' ? r.value : null)))
        }

        run()

        return () => {
            cancelled = true
        }
    }, [travelPairs])

    const getMinutes = useCallback((key) => minutesByKey[key], [minutesByKey])
    return { getMinutes, minutesByKey }
}
