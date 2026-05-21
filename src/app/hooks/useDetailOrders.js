import { useEffect, useMemo, useRef, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { enrichDetailEntryWithSchedule } from '../../utils/PlanDetailEnrichment'
import { PLAN_META_KEY } from '../../utils/PlanUtility'

const SAFETY_REFRESH_MS = 60 * 1000
const UPDATE_CHECK_INTERVAL_MS = 10 * 1000
const INITIAL_RETRY_DELAYS_MS = [1500, 4000, 10_000, 30_000]

/**
 * Builds the `Map<orderId, { scheduledYardage, loadSize }>` fallback the
 * service-layer detail allocator consults when `dispatch_data`'s order_meta
 * rows arrive with null `scheduled_yardage` (typical for cross-plant order
 * headers in the dispatch HTML import). The source here is the
 * dispatcher's curated `plant_production` blob — same data the live
 * schedule UI shows — so DetailDriver-only tickets get accurate yardage
 * estimates instead of the per-ticket "—" placeholder. */
const buildOrderMetaFallbackFromPlantProduction = (plantProduction) => {
    const map = new Map()
    if (!plantProduction || typeof plantProduction !== 'object') return map
    Object.entries(plantProduction).forEach(([code, block]) => {
        if (code === PLAN_META_KEY || !block || typeof block !== 'object') return
        const orders = Array.isArray(block.orders) ? block.orders : []
        orders.forEach((o) => {
            if (!o?.orderId) return
            const scheduledYardage = parseFloat(o?.yardage) || 0
            const loadSize = parseFloat(o?.loadSize) || 0
            if (scheduledYardage <= 0 && loadSize <= 0) return
            const existing = map.get(o.orderId)
            if (!existing) {
                map.set(o.orderId, { loadSize, scheduledYardage })
            } else {
                map.set(o.orderId, {
                    loadSize: Math.max(existing.loadSize, loadSize),
                    scheduledYardage: Math.max(existing.scheduledYardage, scheduledYardage)
                })
            }
        })
    })
    return map
}

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
 *
 * @param {string} dateStr - ISO `YYYY-MM-DD`.
 * @param {Object} [plantProduction] - The curated `plant_production` blob
 *   for `dateStr` (from `usePlanData` → `plans` table). Passed through to
 *   the service as an external schedule-meta fallback so the allocator can
 *   fill in DetailDriver-only ticket quantities even when `dispatch_data`'s
 *   header row arrived with null yardage.
 */
export function useDetailOrders(dateStr, plantProduction) {
    const [rawDetailByOrderId, setRawDetailByOrderId] = useState({})
    const [isLoading, setIsLoading] = useState(true)
    const cancelledRef = useRef(false)
    const dateRef = useRef(dateStr)
    dateRef.current = dateStr
    const orderMetaFallback = useMemo(
        () => buildOrderMetaFallbackFromPlantProduction(plantProduction),
        [plantProduction]
    )
    const orderMetaFallbackRef = useRef(orderMetaFallback)
    orderMetaFallbackRef.current = orderMetaFallback
    const retryTimersRef = useRef([])
    const lastSeenUpdatedAtRef = useRef(null)
    /** Exposed via ref so the secondary "react to plantProduction changes"
     *  effect can trigger a one-off refetch without resetting the main
     *  effect's retry ladder + intervals. */
    const fetchAndStoreRef = useRef(null)
    /** Tracks the fallback signature the last detail fetch was issued
     *  with — lets the secondary effect dedupe noop refetches when
     *  `plantProduction` re-renders without a material change. Declared
     *  here (before the main effect) so the main effect can reset it
     *  whenever `dateStr` changes. */
    const lastFetchedSignatureRef = useRef(null)

    useEffect(() => {
        cancelledRef.current = false
        retryTimersRef.current.forEach(clearTimeout)
        retryTimersRef.current = []
        lastSeenUpdatedAtRef.current = null
        lastFetchedSignatureRef.current = null
        setIsLoading(true)

        if (!dateStr) {
            setRawDetailByOrderId({})
            setIsLoading(false)
            fetchAndStoreRef.current = null
            return undefined
        }

        const fetchAndStore = async () => {
            try {
                const [data, updatedAt] = await Promise.all([
                    DispatchDataService.fetchDetailByOrderId(dateRef.current, orderMetaFallbackRef.current),
                    DispatchDataService.fetchLastUpdatedAt(dateRef.current)
                ])
                if (cancelledRef.current) return false
                if (updatedAt) lastSeenUpdatedAtRef.current = updatedAt.getTime()
                const hasData = data && Object.keys(data).length > 0
                if (hasData) setRawDetailByOrderId(data)
                return hasData
            } catch (err) {
                console.warn('[useDetailOrders] fetch failed:', err)
                return false
            }
        }
        fetchAndStoreRef.current = fetchAndStore

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
            fetchAndStoreRef.current = null
        }
    }, [dateStr])

    /** Build a stable signature from the fallback Map so this effect only
     *  fires when the dispatcher's curated order list materially changes —
     *  not on every plantProduction reference flicker. The signature is the
     *  sorted list of `orderId:scheduledYardage:loadSize` triples; if it
     *  matches the previous render we skip the refetch. */
    const fallbackSignature = useMemo(() => {
        if (orderMetaFallback.size === 0) return ''
        const entries = []
        orderMetaFallback.forEach((value, orderId) => {
            entries.push(`${orderId}:${value.scheduledYardage}:${value.loadSize}`)
        })
        return entries.sort().join('|')
    }, [orderMetaFallback])

    /** Apply the curated schedule yardage as a final-pass enrichment over
     *  the raw detail map fetched from the service. This is a
     *  belt-and-suspenders layer on top of the service-side allocator —
     *  if the service fetch landed before `plantProduction` was available
     *  to feed the schedule fallback (very common on cold load: the
     *  detail edge function returns before the plans table fetch), the
     *  raw entries will have cross-plant DetailDriver-only ticket
     *  quantities at zero. Re-running the allocator here at the hook
     *  level guarantees the popup modal, the Schedule's Loaded column,
     *  and every downstream consumer of `detailByOrderId` see the same
     *  corrected numbers without waiting for a refetch round-trip. */
    const detailByOrderId = useMemo(() => {
        if (!rawDetailByOrderId || typeof rawDetailByOrderId !== 'object') return rawDetailByOrderId
        if (orderMetaFallback.size === 0) return rawDetailByOrderId
        const out = {}
        let changed = false
        Object.entries(rawDetailByOrderId).forEach(([orderId, entry]) => {
            const enriched = enrichDetailEntryWithSchedule(entry, orderMetaFallback.get(orderId))
            if (enriched !== entry) changed = true
            out[orderId] = enriched
        })
        return changed ? out : rawDetailByOrderId
    }, [rawDetailByOrderId, orderMetaFallback])

    /** Secondary refetch trigger: any time the curated schedule yardage
     *  changes the allocator's inputs (new signature), re-run the detail
     *  fetch so the popup modal + Statistics + Schedule's Loaded column
     *  pick up the new numbers. Tracks the last-fetched signature via
     *  `lastFetchedSignatureRef` to dedupe — late-arriving
     *  `plantProduction` (the common case: detail fetch resolves before
     *  plan fetch on cold load) produces a follow-up fetch that backfills
     *  cross-plant ticket quantities. */
    useEffect(() => {
        if (!fallbackSignature) return
        if (lastFetchedSignatureRef.current === fallbackSignature) return
        lastFetchedSignatureRef.current = fallbackSignature
        const fn = fetchAndStoreRef.current
        if (typeof fn === 'function') fn()
    }, [fallbackSignature])

    return { detailByOrderId, isLoading }
}
