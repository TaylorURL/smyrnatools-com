import { useEffect, useMemo, useRef, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { aggregateCustomerVerdicts } from '../../utils/CustomerServiceAggregation'
import { classifyServiceTier, scoreOrderExperience } from '../../utils/PlanUtility'

const ONE_DAY_MS = 86_400_000

/** Default lookback for the Call List customer detail. 120 days reaches
 *  back ~4 months, which covers the typical re-pour cadence for most
 *  customers without pulling a full year of dispatch data (the heavier
 *  fetch the Statistics tab does). */
const DEFAULT_LOOKBACK_DAYS = 120

const localIsoFromDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** Build the list of working-day ISO dates in `[start, end]` (inclusive),
 *  Sundays excluded. Same shape `usePlanStatistics` uses but inlined here
 *  so the Call List hook doesn't drag in that whole module. */
const workingDaysInRange = (startIso, endIso) => {
    const out = []
    if (!startIso || !endIso) return out
    const start = new Date(`${startIso}T00:00:00`)
    const end = new Date(`${endIso}T00:00:00`)
    const cursor = new Date(start)
    while (cursor <= end) {
        if (cursor.getDay() !== 0) out.push(localIsoFromDate(cursor))
        cursor.setDate(cursor.getDate() + 1)
    }
    return out
}

/** Same-day sentinel detection — the dispatch HTML uses a 15:00 start
 *  time on orders that were booked the day they ran. Surfacing it lets
 *  the Call List detail flag those rows just like the Statistics tab
 *  does. */
const SAME_DAY_SENTINEL = '15:00'

/**
 * Fetch + compute per-customer service-quality verdicts on demand. Built
 * for the Call List → customer detail surface where the dispatcher wants
 * the same context the Statistics → Customer Lookup detail shows, but
 * without paying the cost of the full multi-tab `usePlanStatistics`
 * pipeline. Scoped to ONE customer at a time and only fires when
 * `enabled` is true (the parent only enables when a customer is
 * actually selected).
 *
 * Returns:
 *   - `aggregate`: rollup the `CustomerServiceContext` card expects
 *     (`jobs`, `goodPct`, `lateJobs`, `slowJobs`, `tierCounts`, …).
 *     `null` when no measured orders exist in the lookback window.
 *   - `orders`: per-order verdict rows, newest first.
 *   - `isLoading`: true while the schedule + detail fetches are in
 *     flight.
 *   - `error`: optional error message when either fetch fails.
 *
 * @param {Object} args
 * @param {string} [args.customerName] - Customer display name from the
 *   Call List roster (`customer_name`). Matched against the dispatch
 *   import's order-level `customer` field case-insensitively after a
 *   trim — same key the Statistics page uses to bucket customers.
 * @param {string} [args.customerNum] - Optional secondary match. Only
 *   used when `customerName` is missing or returns no hits.
 * @param {boolean} [args.enabled=false] - Gate the fetch. Defaults off
 *   so the hook is a no-op until the parent flips it on.
 * @param {string} [args.lastPourDate] - ISO date (YYYY-MM-DD) of the
 *   customer's most recent pour. When supplied:
 *     1. If the last pour is older than `lookbackDays`, the fetch is
 *        skipped entirely — there can be no measured orders in the
 *        window. The hook returns immediately with `aggregate=null`.
 *     2. If the last pour is more recent than `lookbackDays`, the
 *        working-day list is narrowed to start at the last-pour date
 *        (minus a 3-day buffer) instead of scanning the full window.
 *        That typically slashes the schedule + ticket fetch by ~4x
 *        for a customer that poured two weeks ago.
 * @param {number} [args.lookbackDays=120] - How many calendar days back
 *   to look. Sundays excluded from the working-day list.
 */
export function useCustomerServiceLookup({
    customerName,
    customerNum,
    enabled = false,
    lastPourDate,
    lookbackDays = DEFAULT_LOOKBACK_DAYS
}) {
    const [state, setState] = useState({
        aggregate: null,
        error: null,
        isLoading: false,
        orders: []
    })
    const cancelledRef = useRef(false)
    /** Most-recent request signature so a stale fetch (the user moved on
     *  to a different customer before this resolved) can't write its
     *  result over a newer selection. */
    const requestKeyRef = useRef(0)

    const normalizedKey = useMemo(() => {
        const name = (customerName || '').trim().toUpperCase()
        if (name) return `name:${name}`
        const num = (customerNum || '').trim()
        return num ? `num:${num}` : ''
    }, [customerName, customerNum])

    useEffect(() => {
        cancelledRef.current = false
        return () => {
            cancelledRef.current = true
        }
    }, [])

    useEffect(() => {
        if (!enabled || !normalizedKey) {
            setState({ aggregate: null, error: null, isLoading: false, orders: [] })
            return undefined
        }

        const today = new Date()
        const lookbackStart = new Date(today.getTime() - lookbackDays * ONE_DAY_MS)
        const endIso = localIsoFromDate(today)

        // Short-circuit when the most recent pour is older than the lookback.
        // No measured orders can be inside the window, so we skip both the
        // schedule and ticket fetches entirely. Massive win on the Outreach
        // Queue where customers are 90+ days dormant by definition.
        if (lastPourDate && typeof lastPourDate === 'string') {
            const pourDay = new Date(`${lastPourDate}T00:00:00`)
            if (!Number.isNaN(pourDay.getTime()) && pourDay < lookbackStart) {
                setState({ aggregate: null, error: null, isLoading: false, orders: [] })
                return undefined
            }
        }

        const requestKey = requestKeyRef.current + 1
        requestKeyRef.current = requestKey
        setState((prev) => ({ ...prev, error: null, isLoading: true }))

        // Narrow the fetched window to the last-pour date (minus a small
        // buffer for orders booked just before the pour). Avoids paying
        // for 90+ working days of schedule + ticket fetches when the
        // customer hasn't poured in two months.
        let startIso = localIsoFromDate(lookbackStart)
        if (lastPourDate && typeof lastPourDate === 'string') {
            const pourDay = new Date(`${lastPourDate}T00:00:00`)
            if (!Number.isNaN(pourDay.getTime())) {
                const buffered = new Date(pourDay.getTime() - 3 * ONE_DAY_MS)
                if (buffered > lookbackStart) startIso = localIsoFromDate(buffered)
            }
        }
        const dates = workingDaysInRange(startIso, endIso)

        let aborted = false
        ;(async () => {
            try {
                const [scheduleRows, detailByDate] = await Promise.all([
                    DispatchDataService.fetchPlanRowsByDateRange(dates),
                    DispatchDataService.fetchDetailByDateRange(dates)
                ])
                if (aborted || cancelledRef.current || requestKeyRef.current !== requestKey) return

                /* Match the schedule's orders against the customer name /
                 * number. The dispatch HTML store can carry mixed case +
                 * trailing whitespace, so we normalize with `toUpperCase`
                 * + `trim` on both sides — same key the Statistics tab
                 * uses for its customer index. */
                const wantName = (customerName || '').trim().toUpperCase()
                const wantNum = (customerNum || '').trim()
                const matchOrder = (order) => {
                    const orderName = (order?.customer || '').trim().toUpperCase()
                    if (wantName && orderName === wantName) return true
                    if (wantNum && (order?.customerNum || '').trim() === wantNum) return true
                    return false
                }

                const measured = []
                for (const row of scheduleRows || []) {
                    const date = row?.plan_date
                    if (!date) continue
                    const production =
                        row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
                    const detailForDate = detailByDate?.[date] || {}
                    for (const [plantCode, block] of Object.entries(production)) {
                        if (!block || typeof block !== 'object') continue
                        const orders = Array.isArray(block.orders) ? block.orders : []
                        for (const order of orders) {
                            if (!matchOrder(order)) continue
                            const detail = order?.orderId ? detailForDate[order.orderId] : null
                            const verdict = scoreOrderExperience(order, detail)
                            if (!verdict.measured) continue
                            measured.push({
                                customer: order.customer || '',
                                customerKey: (order.customer || '').trim().toUpperCase(),
                                customerNum: order.customerNum || '',
                                date,
                                firstLoadTime: verdict.firstLoadTime,
                                hasKicker: verdict.hasKicker,
                                isBad: verdict.isBad,
                                isLate: verdict.isLate,
                                isSameDay: order?.startTime === SAME_DAY_SENTINEL,
                                isSlow: verdict.isSlow,
                                kickerLoads: verdict.kickerLoads,
                                kickerYards: verdict.kickerYards,
                                latenessMin: verdict.latenessMin,
                                orderId: order.orderId,
                                orderNum: order.orderNum || '',
                                paceScore: verdict.paceScore,
                                plantCode,
                                startMin: verdict.startMin,
                                startTime: verdict.startTime,
                                tier: verdict.tier || classifyServiceTier(verdict)
                            })
                        }
                    }
                }

                if (aborted || cancelledRef.current || requestKeyRef.current !== requestKey) return

                const aggregate = aggregateCustomerVerdicts(measured)
                setState({
                    aggregate,
                    error: null,
                    isLoading: false,
                    orders: measured
                })
            } catch (err) {
                if (aborted || cancelledRef.current || requestKeyRef.current !== requestKey) return
                setState({
                    aggregate: null,
                    error: err?.message || 'Failed to load customer service history',
                    isLoading: false,
                    orders: []
                })
            }
        })()

        return () => {
            aborted = true
        }
    }, [customerName, customerNum, enabled, lastPourDate, lookbackDays, normalizedKey])

    return state
}

export default useCustomerServiceLookup
