import { useEffect, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { computeRestFloorByPlant } from '../../utils/BookOrderUtility'
import { getOffsetDate } from '../../utils/PlanUtility'

/**
 * Per-plant earliest legal first-load-out for the booking date, derived
 * from the prior day's actual dispatch tickets + scheduled travel times
 * (last load-out + travel cycle = back-at-yard, plus the 10-hour DOT rest
 * window). Consumed by the slot scanners in `BookOrderUtility` so move /
 * alternate-time / recommended-time suggestions never propose dispatching
 * an operator who's still inside their mandatory rest window.
 *
 * Returns an empty object until the fetch resolves, so callers can read
 * `restFloorByPlant[plantCode]` and pass `undefined` (which the scanners
 * treat as "no rest constraint, fall back to schedule-derived floor").
 */
export default function useYesterdayOperatorRestFloor(planDate) {
    const [restFloorByPlant, setRestFloorByPlant] = useState({})

    useEffect(() => {
        if (!planDate) {
            setRestFloorByPlant({})
            return undefined
        }
        let cancelled = false
        const yesterday = getOffsetDate(planDate, -1)
        Promise.all([DispatchDataService.fetchDetailByOrderId(yesterday), DispatchDataService.fetchSchedule(yesterday)])
            .then(([detail, production]) => {
                if (cancelled) return
                setRestFloorByPlant(computeRestFloorByPlant(detail, production))
            })
            .catch(() => {
                if (!cancelled) setRestFloorByPlant({})
            })
        return () => {
            cancelled = true
        }
    }, [planDate])

    return restFloorByPlant
}
