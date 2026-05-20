import { useEffect, useMemo, useState } from 'react'

import { getNowCstMinutes } from '../../utils/PlanUtility'

const ONE_MINUTE_MS = 60_000

/**
 * Current minute-of-day (0–1439) on Smyrna's CST wall clock, refreshed
 * once a minute when `active` is true. Returns `null` otherwise so
 * callers can short-circuit "now"-based UI on past or future schedules.
 *
 * The CST anchor matters because OperationsView is dispatch-driven: a planner
 * in another timezone needs to see the same "now" a Houston dispatcher
 * does, otherwise the realtime tab and the same-day booking guard land
 * on a different day than the schedule itself.
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
        return getNowCstMinutes()
        // `tick` triggers re-evaluation each minute even though it's not read.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, tick])
}
