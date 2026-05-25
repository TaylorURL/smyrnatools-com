import { useEffect, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'

/**
 * Owns the per-day detail-order ticket fetch for `usePlanStatistics`.
 *
 * Walks every working day in `currentDays` + `previousDays`, fetches the
 * matching detail-order rows via `DispatchDataService.fetchDetailByDateRange`,
 * and caches them in a `{ planDate → orderId → ticketData }` map. Days that
 * already have data are skipped so flipping sub-pages doesn't re-fetch.
 *
 * Gated behind any of the sub-page enablement flags — if no consumer is
 * mounted, the hook stays idle.
 *
 * @param {Object} args
 * @param {Array<{planDate: string}>} args.currentDays
 * @param {Array<{planDate: string}>} args.previousDays
 * @param {Object} args.scheduleMetaByDate - Schedule yardage map passed to the
 *   service so cross-plant orders with null `scheduled_yardage` get the
 *   dispatcher's curated value backfilled at the allocator level.
 * @param {boolean} args.satisfactionEnabled
 * @param {boolean} args.operatorsEnabled
 * @param {boolean} args.helpCrossLoadingEnabled
 * @param {boolean} args.plantsEnabled
 * @param {boolean} args.serviceEnabled
 * @param {boolean} args.kickersEnabled
 * @param {boolean} args.ticketLookupEnabled
 * @returns {{ detailByDay: Object, satisfactionLoading: boolean }}
 */
export function usePlanStatisticsDetailByDay({
    currentDays,
    previousDays,
    scheduleMetaByDate,
    satisfactionEnabled,
    operatorsEnabled,
    helpCrossLoadingEnabled,
    plantsEnabled,
    serviceEnabled,
    kickersEnabled,
    ticketLookupEnabled
}) {
    const [detailByDay, setDetailByDay] = useState({})
    const [satisfactionLoading, setSatisfactionLoading] = useState(false)

    useEffect(() => {
        if (
            !satisfactionEnabled &&
            !operatorsEnabled &&
            !helpCrossLoadingEnabled &&
            !plantsEnabled &&
            !serviceEnabled &&
            !kickersEnabled &&
            !ticketLookupEnabled
        )
            return undefined
        const allDays = [...currentDays, ...previousDays]
        if (allDays.length === 0) return undefined
        let cancelled = false
        // Defensive filter: drop empty/falsy plan_dates so a malformed row
        // can't fan out to a request storm.
        const dates = [...new Set(allDays.map((d) => d.planDate).filter(Boolean))].filter((d) => !(d in detailByDay))
        if (dates.length === 0) return undefined
        setSatisfactionLoading(true)
        DispatchDataService.fetchDetailByDateRange(dates, scheduleMetaByDate)
            .then((rangeMap) => {
                if (cancelled) return
                setDetailByDay((prev) => {
                    const next = { ...prev }
                    dates.forEach((date) => {
                        next[date] = rangeMap?.[date] || {}
                    })
                    return next
                })
            })
            .catch((err) => {
                if (!cancelled) console.warn('[usePlanStatisticsDetailByDay] satisfaction range fetch failed', err)
            })
            .finally(() => {
                if (!cancelled) setSatisfactionLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [
        currentDays,
        previousDays,
        detailByDay,
        scheduleMetaByDate,
        satisfactionEnabled,
        operatorsEnabled,
        helpCrossLoadingEnabled,
        plantsEnabled,
        serviceEnabled,
        kickersEnabled,
        ticketLookupEnabled
    ])

    return { detailByDay, satisfactionLoading }
}

export default usePlanStatisticsDetailByDay
