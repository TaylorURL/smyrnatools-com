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
 * IMPORTANT — this hook used to depend on its own state in the effect's
 * dependency array, which produced a runaway loop: every `setMinutesByKey`
 * write re-ran the effect, and any pair whose Promise was still in flight
 * (no state row yet) would re-enter `pending` and fire a duplicate fetch.
 * On a 350-pair prefetch that compounds to hundreds of thousands of
 * in-flight fetches and OOMs the browser tab. The fix tracks in-flight
 * keys in a ref so duplicate fetches are filtered out without needing the
 * effect to re-read its own state.
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

        pending.forEach((p) => inFlightRef.current.add(p.key))

        let cancelled = false

        Promise.allSettled(
            pending.map(async (pair) => {
                const result = await TrafficService.fetchDistance(pair.origin, pair.destination)
                if (!result || result.error) return { key: pair.key, minutes: null }
                const seconds = result.durationInTrafficSeconds ?? result.durationSeconds ?? null
                if (!Number.isFinite(seconds)) return { key: pair.key, minutes: null }
                return { key: pair.key, minutes: Math.max(1, Math.round(seconds / 60)) }
            })
        ).then((results) => {
            // Always release in-flight slots so a remount can retry the
            // same key — even if the batch was cancelled and we skip the
            // state write, the keys must come off the in-flight set.
            const next = {}
            for (const r of results) {
                if (r.status !== 'fulfilled' || !r.value) continue
                inFlightRef.current.delete(r.value.key)
                knownKeysRef.current.add(r.value.key)
                next[r.value.key] = r.value.minutes
            }
            if (cancelled) return
            if (Object.keys(next).length > 0) {
                setMinutesByKey((prev) => ({ ...prev, ...next }))
            }
        })

        return () => {
            cancelled = true
        }
    }, [travelPairs])

    const getMinutes = useCallback((key) => minutesByKey[key], [minutesByKey])
    return { getMinutes, minutesByKey }
}
