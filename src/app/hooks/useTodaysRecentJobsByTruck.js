import { useEffect, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { getTodayDate } from '../../utils/PlanUtility'

/** Walk every ticket on today's plan and keep the latest one per truck.
 *  Tickets are deduped on `truckNum` and the winner is the one with the
 *  greatest `loadedTime` (lex-sortable HH:MM:SS string), so a truck that
 *  ran multiple jobs surfaces its most recent. */
const buildLatestTicketByTruck = (detailByOrderId) => {
    const out = new Map()
    Object.values(detailByOrderId || {}).forEach((order) => {
        const tickets = Array.isArray(order?.tickets) ? order.tickets : []
        tickets.forEach((ticket) => {
            const truckNum = String(ticket?.truckNum || '').trim()
            if (!truckNum) return
            const loadedTime = ticket.loadedTime || ''
            const existing = out.get(truckNum)
            if (existing && existing.loadedTime >= loadedTime) return
            out.set(truckNum, {
                customer: ticket.customer || '',
                loadedTime,
                orderNum: order.orderNum || '',
                plantId: ticket.plantId || ''
            })
        })
    })
    return out
}

/** How often to re-pull today's tickets so trucks loaded after the page
 *  opens still surface in the column. */
const RECENT_JOBS_REFRESH_MS = 60_000

/**
 * Latest concrete-load per truck for today, keyed by truck number string
 * exactly as it appears on dispatch tickets. Returns an empty map until
 * the first fetch resolves and re-fetches every minute thereafter so new
 * tickets show up without a manual refresh.
 *
 * @param {{ enabled?: boolean }} options - Set `enabled: false` to skip
 *   the fetch entirely (e.g. for asset views that don't show a recent-job
 *   column).
 */
export default function useTodaysRecentJobsByTruck({ enabled = true } = {}) {
    const [byTruck, setByTruck] = useState(() => new Map())

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        const refresh = () => {
            DispatchDataService.fetchDetailByOrderId(getTodayDate())
                .then((detailByOrderId) => {
                    if (cancelled) return
                    setByTruck(buildLatestTicketByTruck(detailByOrderId))
                })
                .catch(() => {})
        }
        refresh()
        const intervalId = setInterval(refresh, RECENT_JOBS_REFRESH_MS)
        return () => {
            cancelled = true
            clearInterval(intervalId)
        }
    }, [enabled])

    return byTruck
}
