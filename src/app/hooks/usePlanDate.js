import { useEffect, useRef, useState } from 'react'

import { PlanService } from '../../services/PlanService'
import { getTodayDate, getTomorrowDate, skipSundayDate } from '../../utils/PlanUtility'

const REALTIME_SNAP_INTERVAL_MS = 60_000

/**
 * Plan-date state with all the rules of this view bundled in one place:
 *
 *  - Defaults to tomorrow (Sunday-skipped to Monday).
 *  - On mount, fetches the most recently saved plan date from the database
 *    and jumps the user there (also Sunday-skipped). This way the planner
 *    opens where work was last happening instead of always showing tomorrow.
 *    The DB jump only fires once — any subsequent user navigation wins.
 *  - When `effectiveViewMode === 'realtime'` the date is forced to "today"
 *    (Sunday-skipped) and re-checked once a minute so the live tab snaps
 *    forward at midnight without requiring a manual reload.
 *
 * @param {string} effectiveViewMode - The currently active tab id.
 * @returns {{ planDate: string, setPlanDate: Function }}
 */
export function usePlanDate(effectiveViewMode) {
    const [planDate, setPlanDate] = useState(() => skipSundayDate(getTomorrowDate(), 1))
    const hasInitializedDateRef = useRef(false)

    /* On first mount, jump to the most recently saved plan so the user
     * lands on actual work-in-progress instead of an empty tomorrow page. */
    useEffect(() => {
        if (hasInitializedDateRef.current) return undefined
        let cancelled = false
        PlanService.fetchLatestPlanDate()
            .then((latest) => {
                if (cancelled || hasInitializedDateRef.current) return
                hasInitializedDateRef.current = true
                if (latest) setPlanDate(skipSundayDate(latest, 1))
            })
            .catch(() => {
                hasInitializedDateRef.current = true
            })
        return () => {
            cancelled = true
        }
    }, [])

    /* Realtime tab: snap to today on entry and keep snapping every minute
     * so the date crosses midnight on its own. Sundays roll forward to
     * Monday — there's no live data to anchor to on a closed-plant day. */
    useEffect(() => {
        if (effectiveViewMode !== 'realtime') return undefined
        const snap = () => {
            const target = skipSundayDate(getTodayDate(), 1)
            setPlanDate((prev) => (prev === target ? prev : target))
        }
        snap()
        const id = setInterval(snap, REALTIME_SNAP_INTERVAL_MS)
        return () => clearInterval(id)
    }, [effectiveViewMode])

    return { planDate, setPlanDate }
}
