import { useEffect, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { DetailOrderBucketService } from '../../services/DetailOrderBucketService'

const SAFETY_REFRESH_MS = 5 * 60 * 1000
const REALTIME_DEBOUNCE_MS = 1500
// Cold-start retry ladder. When the page first mounts, the storage downloads
// can fire before Supabase auth/realtime is fully warm — failures bubble up
// silently as empty payloads, leaving the UI blank until the user manually
// refreshed. We retry on a fast-then-slowing cadence so cold-start heals in
// seconds rather than waiting for the 5-minute safety interval.
const INITIAL_RETRY_DELAYS_MS = [1500, 4000, 10_000, 30_000]
const BUCKET_NAME = 'dispatch-reports'

/**
 * Fetches DetailOrderAnalysis ticket data for a given date and keeps it fresh
 * via three independent triggers:
 *   1. Initial load on mount, with a fast retry ladder if the first fetch
 *      returns nothing (cold-start before realtime/auth is warm).
 *   2. Realtime `storage.objects` events on the dispatch-reports bucket —
 *      any insert/update of a `detail/YYYY-MM-DD_<plant>.html` file for the
 *      currently-viewed date debounces a re-fetch.
 *   3. A 5-minute safety interval as a last-resort fallback.
 *
 * Returns a map keyed by orderId — joinable against DailyOrder data already
 * on each plan order via `order.orderId`.
 */
export function useDetailOrders(dateStr) {
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

        // A successful load is one that returns at least one order. Empty
        // results are treated as "not yet ready" and trigger the retry ladder.
        const fetchAndStore = async () => {
            try {
                const data = await DetailOrderBucketService.fetchByDate(dateRef.current)
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
            // Schedule the retry ladder. Each timer self-clears once it fires.
            INITIAL_RETRY_DELAYS_MS.forEach((delay, idx) => {
                const timer = setTimeout(async () => {
                    if (cancelledRef.current) return
                    const success = await fetchAndStore()
                    if (success) {
                        // Clear any later retries — we're caught up.
                        retryTimersRef.current.slice(idx + 1).forEach(clearTimeout)
                    }
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

    // Realtime: any insert/update on `detail/YYYY-MM-DD_<plant>.html` for the
    // currently-viewed date triggers a debounced re-fetch. We also re-fetch
    // when the channel transitions to SUBSCRIBED — that event fires once
    // realtime auth is warm, which is also when storage downloads start
    // working reliably for cold-start sessions.
    useEffect(() => {
        if (!dateStr) return undefined
        const channelName = `dispatch-detail-${BUCKET_NAME}-${Date.now()}`
        const expectedPrefix = `detail/${dateStr}_`

        const refetch = async () => {
            try {
                const data = await DetailOrderBucketService.fetchByDate(dateRef.current)
                if (!cancelledRef.current) setDetailByOrderId(data || {})
            } catch {
                // Errors are surfaced by the safety interval / retry ladder.
            }
        }

        const handleStorageChange = (payload) => {
            const objectName = payload?.new?.name || payload?.old?.name || ''
            if (!objectName.startsWith(expectedPrefix)) return
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(refetch, REALTIME_DEBOUNCE_MS)
        }

        const channel = Database.channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    filter: `bucket_id=eq.${BUCKET_NAME}`,
                    schema: 'storage',
                    table: 'objects'
                },
                handleStorageChange
            )
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
