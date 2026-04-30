import { useEffect, useMemo, useState } from 'react'

import { getTodayDate } from '../../utils/PlanUtility'

const DEFAULT_TICK_INTERVAL_MS = 30_000

/**
 * Live clock hook. Re-renders on a fixed interval (default 30s, enough
 * to keep the realtime view's "now" minute accurate without spamming
 * React). Returns a memoized snapshot with the now Date, label, minute
 * of day, and today's `yyyy-mm-dd` string.
 *
 * @param {number} intervalMs - tick interval in ms; defaults to 30s
 */
export function useLiveClock(intervalMs = DEFAULT_TICK_INTERVAL_MS) {
    const [tick, setTick] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setTick(Date.now()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])
    return useMemo(() => {
        const now = new Date(tick)
        return {
            nowDate: now,
            nowLabel: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            nowMin: now.getHours() * 60 + now.getMinutes(),
            todayStr: getTodayDate()
        }
    }, [tick])
}
