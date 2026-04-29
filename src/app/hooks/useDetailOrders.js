import { useEffect, useRef, useState } from 'react'

import { DetailOrderBucketService } from '../../services/DetailOrderBucketService'

const DEFAULT_REFRESH_MS = 60_000

/**
 * Fetches DetailOrderAnalysis ticket data for a given date and refreshes on a
 * fixed interval. Returns a map keyed by orderId — joinable against the
 * DailyOrder data already on each plan order via `order.orderId`.
 *
 * @param {string} dateStr - ISO date `YYYY-MM-DD`
 * @param {number} [refreshMs=60000] - polling interval
 * @returns {Object} { [orderId]: { orderId, orderNum, ticketCount, loadedYardage } }
 */
export function useDetailOrders(dateStr, refreshMs = DEFAULT_REFRESH_MS) {
    const [detailByOrderId, setDetailByOrderId] = useState({})
    const cancelledRef = useRef(false)

    useEffect(() => {
        cancelledRef.current = false
        if (!dateStr) {
            setDetailByOrderId({})
            return undefined
        }

        const load = async () => {
            const data = await DetailOrderBucketService.fetchByDate(dateStr)
            if (!cancelledRef.current) setDetailByOrderId(data || {})
        }

        load()
        const timer = setInterval(load, refreshMs)
        return () => {
            cancelledRef.current = true
            clearInterval(timer)
        }
    }, [dateStr, refreshMs])

    return detailByOrderId
}
