import { useCallback, useEffect, useState } from 'react'

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
 */
export default function useLiveTravelTimes(travelPairs) {
    const [minutesByKey, setMinutesByKey] = useState({})

    useEffect(() => {
        if (!travelPairs.length) return undefined
        // Skip the whole prefetch once the service has latched unavailable —
        // otherwise the console fills with 503s every re-render.
        if (TrafficService.isUnavailable()) return undefined
        let cancelled = false
        // Only fetch keys we haven't tried yet (undefined). Keys that
        // previously failed are cached as `null`, so the filter excludes them.
        const pending = travelPairs.filter((p) => minutesByKey[p.key] === undefined)
        if (!pending.length) return undefined
        Promise.allSettled(
            pending.map(async (pair) => {
                const result = await TrafficService.fetchDistance(pair.origin, pair.destination)
                if (cancelled) return { key: pair.key, minutes: null }
                if (!result || result.error) return { key: pair.key, minutes: null }
                const seconds = result.durationInTrafficSeconds ?? result.durationSeconds ?? null
                if (!Number.isFinite(seconds)) return { key: pair.key, minutes: null }
                return { key: pair.key, minutes: Math.max(1, Math.round(seconds / 60)) }
            })
        ).then((results) => {
            if (cancelled) return
            const next = {}
            for (const r of results) {
                if (r.status !== 'fulfilled' || !r.value) continue
                // Cache both successes and failures so we don't retry on every
                // re-render. `null` tells future renders "already tried, no
                // live data" and the UI falls back cleanly.
                next[r.value.key] = r.value.minutes
            }
            if (Object.keys(next).length > 0) {
                setMinutesByKey((prev) => ({ ...prev, ...next }))
            }
        })
        return () => {
            cancelled = true
        }
    }, [travelPairs, minutesByKey])

    const getMinutes = useCallback((key) => minutesByKey[key], [minutesByKey])
    return { getMinutes, minutesByKey }
}
