import { useEffect, useMemo, useState } from 'react'

const ONE_MINUTE_MS = 60_000

/**
 * Returns the current minute-of-day (0–1439), refreshed once a minute, when
 * `active` is true. Returns `null` otherwise so callers can short-circuit
 * any "now"-based UI on past or future schedules.
 */
export default function useLiveMinuteOfDay(active) {
    const [tick, setTick] = useState(0)
    useEffect(() => {
        if (!active) return undefined
        const id = setInterval(() => setTick((t) => t + 1), ONE_MINUTE_MS)
        return () => clearInterval(id)
    }, [active])
    return useMemo(() => {
        if (!active) return null
        const now = new Date()
        return now.getHours() * 60 + now.getMinutes()
        // `tick` triggers re-evaluation each minute even though it's not read.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, tick])
}
