import { useEffect, useRef, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'

const SAFETY_REFRESH_MS = 60 * 1000
const UPDATE_CHECK_INTERVAL_MS = 10 * 1000
const INITIAL_RETRY_DELAYS_MS = [1500, 4000, 10_000, 30_000]

/**
 * Reads ticket-level dispatch data via `DispatchDataService` (which goes
 * through the session-validated `dispatch-data-service` edge function) and
 * stays live via three triggers:
 *   1. Initial load on mount, retry-laddered for cold-start.
 *   2. `fetchLastUpdatedAt` poll every 10s — re-fetches as soon as a newer
 *      timestamp shows up. Replaces the old realtime postgres_changes
 *      subscription, which can no longer reach the locked-down
 *      `dispatch_data` table from the anon role.
 *   3. 60s safety interval in case the timestamp probe misses.
 *
 * Returns `{ detailByOrderId, isLoading }`:
 *   - `detailByOrderId`: `{ [orderId]: { tickets, byPlant, loadedYardage, … } }`
 *   - `isLoading`: `true` until the very first fetch resolves (success OR
 *     failure). Lets the page-level skeleton hold until ticket data is
 *     actually in (or has been determined to be absent for the date) — we
 *     do NOT keep `isLoading` true through the retry ladder, because a
 *     date that genuinely has no tickets would otherwise block forever.
 */
export function useDetailOrders(dateStr /* , plantProduction (unused) */) {
    const [detailByOrderId, setDetailByOrderId] = useState({})
    const [isLoading, setIsLoading] = useState(true)
    const cancelledRef = useRef(false)
    const dateRef = useRef(dateStr)
    dateRef.current = dateStr
    const retryTimersRef = useRef([])
    const lastSeenUpdatedAtRef = useRef(null)

    useEffect(() => {
        cancelledRef.current = false
        retryTimersRef.current.forEach(clearTimeout)
        retryTimersRef.current = []
        lastSeenUpdatedAtRef.current = null
        setIsLoading(true)

        if (!dateStr) {
            setDetailByOrderId({})
            setIsLoading(false)
            return undefined
        }

        const fetchAndStore = async () => {
            try {
                const [data, updatedAt] = await Promise.all([
                    DispatchDataService.fetchDetailByOrderId(dateRef.current),
                    DispatchDataService.fetchLastUpdatedAt(dateRef.current)
                ])
                if (cancelledRef.current) return false
                if (updatedAt) lastSeenUpdatedAtRef.current = updatedAt.getTime()
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
            if (!cancelledRef.current) setIsLoading(false)
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
        const safetyInterval = setInterval(fetchAndStore, SAFETY_REFRESH_MS)
        const updateCheckInterval = setInterval(async () => {
            try {
                const updatedAt = await DispatchDataService.fetchLastUpdatedAt(dateRef.current)
                if (cancelledRef.current || !updatedAt) return
                const ts = updatedAt.getTime()
                if (lastSeenUpdatedAtRef.current == null || ts > lastSeenUpdatedAtRef.current) {
                    fetchAndStore()
                }
            } catch {
                // Network blips fall back to the next safety interval tick.
            }
        }, UPDATE_CHECK_INTERVAL_MS)

        return () => {
            cancelledRef.current = true
            retryTimersRef.current.forEach(clearTimeout)
            retryTimersRef.current = []
            clearInterval(safetyInterval)
            clearInterval(updateCheckInterval)
        }
    }, [dateStr])

    return { detailByOrderId, isLoading }
}
