import { useEffect, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { DispatchDataService } from '../../services/DispatchDataService'

const SAFETY_REFRESH_MS = 5 * 60 * 1000
const REALTIME_DEBOUNCE_MS = 750
const INITIAL_RETRY_DELAYS_MS = [1500, 4000, 10_000, 30_000]

/**
 * Reads ticket-level dispatch data from `dispatch_data` (populated by the
 * `dispatch-import` edge function) and stays live via three triggers:
 *   1. Initial load on mount, retry-laddered for cold-start.
 *   2. Realtime postgres_changes on dispatch_data (debounced).
 *   3. 5-minute safety interval.
 *
 * Returns the same `{ [orderId]: { tickets, byPlant, loadedYardage, … } }`
 * shape useDetailOrders has always returned, so existing callers don't
 * need to change.
 *
 * NOTE: `plantProduction` is no longer needed for the join — the importer
 * does the (orderNum, customer) → orderId resolution server-side and
 * stores the result. The arg is kept for backwards compatibility but
 * ignored.
 */
export function useDetailOrders(dateStr /* , plantProduction (unused) */) {
    const [detailByOrderId, setDetailByOrderId] = useState({})
    const cancelledRef = useRef(false)
    const dateRef = useRef(dateStr)
    dateRef.current = dateStr
    const debounceRef = useRef(null)
    const retryTimersRef = useRef([])

    useEffect(() => {
        cancelledRef.current = false
        retryTimersRef.current.forEach(clearTimeout)
        retryTimersRef.current = []

        if (!dateStr) {
            setDetailByOrderId({})
            return undefined
        }

        const fetchAndStore = async () => {
            try {
                const data = await DispatchDataService.fetchDetailByOrderId(dateRef.current)
                if (cancelledRef.current) return false
                const hasData = data && Object.keys(data).length > 0
                if (hasData) setDetailByOrderId(data)
                return hasData
            } catch (err) {
                console.warn('[useDetailOrders] fetch failed:', err)
                return false
            }
        }

        const runWithRetries = async () => {
            const ok = await fetchAndStore()
            if (ok || cancelledRef.current) return
            INITIAL_RETRY_DELAYS_MS.forEach((delay, idx) => {
                const timer = setTimeout(async () => {
                    if (cancelledRef.current) return
                    const success = await fetchAndStore()
                    if (success) retryTimersRef.current.slice(idx + 1).forEach(clearTimeout)
                }, delay)
                retryTimersRef.current.push(timer)
            })
        }

        runWithRetries()
        const interval = setInterval(fetchAndStore, SAFETY_REFRESH_MS)
        return () => {
            cancelledRef.current = true
            retryTimersRef.current.forEach(clearTimeout)
            retryTimersRef.current = []
            clearInterval(interval)
        }
    }, [dateStr])

    // Realtime: any change on a dispatch_data row for the current date
    // debounces a re-fetch. We re-fetch the whole map rather than
    // patching one row — the merge logic in DispatchDataService handles
    // tickets-per-order aggregation that's awkward to do incrementally.
    useEffect(() => {
        if (!dateStr) return undefined
        const channelName = `dispatch-data-detail-${dateStr}-${Date.now()}`

        const refetch = async () => {
            try {
                const data = await DispatchDataService.fetchDetailByOrderId(dateRef.current)
                if (!cancelledRef.current) setDetailByOrderId(data || {})
            } catch {
                // Errors surface via the safety interval / retry ladder.
            }
        }

        const onChange = (payload) => {
            const row = payload?.new || payload?.old
            if (row?.order_date !== dateRef.current) return
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(refetch, REALTIME_DEBOUNCE_MS)
        }

        const channel = Database.channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_data' }, onChange)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') refetch()
            })

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            Database.removeChannel(channel)
        }
    }, [dateStr])

    return detailByOrderId
}
