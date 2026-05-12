import { useEffect, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { getOffsetDate } from '../../utils/PlanUtility'

/* Offsets ahead of `planDate` we fetch schedules for. Ten calendar days
 * comfortably yields seven or more non-Sunday options once we filter,
 * which is the reach the conflict panel needs to recommend the soonest
 * day that can host a pour the requested day genuinely can't. */
const DEFAULT_OFFSETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const isSundayDate = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(`${dateStr}T00:00:00`)
    return Number.isFinite(d.getTime()) && d.getDay() === 0
}

/**
 * Fetches schedule data for upcoming days so the Find-a-Spot conflict
 * panel can suggest the soonest day that can actually host the pour
 * when the requested day can't. Sundays are skipped — plants are
 * closed, so suggesting one would just waste a row.
 *
 * Returns `{ [dateStr]: plantProduction }` (same shape as
 * `DispatchDataService.fetchSchedule`). Empty object until the fetches
 * resolve so callers can safely treat it as "no data yet".
 */
export default function useAdjacentDayPlantProduction(planDate) {
    const [byDate, setByDate] = useState({})

    useEffect(() => {
        if (!planDate) {
            setByDate({})
            return undefined
        }
        let cancelled = false
        const dates = DEFAULT_OFFSETS.map((off) => getOffsetDate(planDate, off)).filter((d) => d && !isSundayDate(d))
        if (dates.length === 0) {
            setByDate({})
            return undefined
        }
        Promise.all(dates.map((d) => DispatchDataService.fetchSchedule(d).catch(() => ({}))))
            .then((results) => {
                if (cancelled) return
                const out = {}
                dates.forEach((d, i) => {
                    out[d] = results[i] || {}
                })
                setByDate(out)
            })
            .catch(() => {
                if (!cancelled) setByDate({})
            })
        return () => {
            cancelled = true
        }
    }, [planDate])

    return byDate
}
