import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { ScheduleSnapshotService } from '../../services/ScheduleSnapshotService'
import { diffScheduleAgainstSnapshot } from '../../utils/ScheduleDiffUtility'
import { splitTicketsAtKicker } from '../../utils/plan/planCustomerSat'
import { isExcludedOrder, parseDurationMinutes, PLAN_META_KEY, timeToMinutes } from '../../utils/PlanUtility'

const ONE_DAY_MS = 86_400_000
/** Trailing window driving the per-customer behaviour rollup. 60 working
 *  days covers ~2.5 months — long enough that occasional kickers /
 *  cancels don't dominate, short enough that recently-shifted patterns
 *  surface within a few weeks. */
const DEFAULT_LOOKBACK_DAYS = 60

/** Risk thresholds. A customer needs at least this many jobs in the
 *  window before either badge can fire — otherwise a single bad job
 *  would tag every new account. */
const MIN_JOBS_FOR_RISK = 3
/** Fraction of jobs where the customer added yardage mid-pour. ≥30%
 *  matches the "frequent kicker" tier used by the Kickers stats page. */
const KICKER_RISK_THRESHOLD = 0.3
/** Fraction of jobs that turned into a cancel-or-move after the 5:30 PM
 *  commit snapshot. ≥25% means roughly 1 in 4 orders shift after commit
 *  — a strong "this customer churns the schedule" signal. */
const CHURN_RISK_THRESHOLD = 0.25

const localIsoFromDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** Working days (Sundays excluded) between two ISO dates, inclusive. */
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

const normalizeCustomerKey = (name) => (typeof name === 'string' ? name.trim().toUpperCase() : '')

const toNumber = (raw) => {
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : 0
}

/**
 * Builds the per-customer behaviour rollup the Schedule tab uses to
 * decorate each order row with a "Likely to Kick" or "Likely to
 * Cancel/Move" badge. Folds two signals from the existing Statistics
 * pages (Kickers + Moves & Cancels) into a single lookup keyed by the
 * customer name so the row component only needs `Map.get(customerKey)`.
 *
 * Computes:
 *   - **Kicker risk** — share of measured jobs where extra yardage was
 *     called in mid-pour (detected via `splitTicketsAtKicker` against
 *     ticket detail). Same classifier the Kickers analysis page uses.
 *   - **Churn risk** — share of jobs that were cancelled or moved
 *     (time / plant) after the dispatcher's 5:30 PM commit snapshot,
 *     diffed via `diffScheduleAgainstSnapshot`. Same signal as Moves &
 *     Cancels.
 *
 * Only customers with at least `MIN_JOBS_FOR_RISK` jobs in the window
 * are flagged, and only when their rate clears the threshold — single
 * isolated kickers / cancels never trigger a badge.
 *
 * @param {Object} [args]
 * @param {boolean} [args.enabled=false] - Gate the fetch. Defaults off
 *   so callers can opt in only on surfaces that surface the badges
 *   (currently just the Schedule tab via `OperationsView`).
 * @param {number} [args.lookbackDays=60] - Trailing working-day window.
 */
export function useCustomerRiskIndex({ enabled = false, lookbackDays = DEFAULT_LOOKBACK_DAYS } = {}) {
    const [planRows, setPlanRows] = useState(null)
    const [detailByDate, setDetailByDate] = useState(null)
    const [snapshotsByDate, setSnapshotsByDate] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!enabled) {
            setPlanRows(null)
            setDetailByDate(null)
            setSnapshotsByDate(null)
            setIsLoading(false)
            return undefined
        }
        let cancelled = false
        setIsLoading(true)
        const endIso = localIsoFromDate(new Date())
        const startIso = localIsoFromDate(new Date(Date.now() - lookbackDays * ONE_DAY_MS))
        const dates = workingDaysInRange(startIso, endIso)
        ;(async () => {
            try {
                const [rows, detail, snapshotEntries] = await Promise.all([
                    DispatchDataService.fetchPlanRowsByDateRange(dates),
                    DispatchDataService.fetchDetailByDateRange(dates),
                    Promise.all(dates.map(async (date) => [date, await ScheduleSnapshotService.getSnapshot(date)]))
                ])
                if (cancelled) return
                const snapshots = {}
                for (const [date, snapshot] of snapshotEntries) snapshots[date] = snapshot
                setPlanRows(rows || [])
                setDetailByDate(detail || {})
                setSnapshotsByDate(snapshots)
            } catch {
                if (!cancelled) {
                    setPlanRows([])
                    setDetailByDate({})
                    setSnapshotsByDate({})
                }
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [enabled, lookbackDays])

    const riskByCustomer = useMemo(() => {
        const result = new Map()
        if (!enabled || !Array.isArray(planRows) || !detailByDate) return result

        for (const row of planRows) {
            const date = row?.plan_date
            if (!date) continue
            const production =
                row.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
            const detailForDate = detailByDate[date] || {}
            const snapshot = snapshotsByDate?.[date] || null
            const diff = snapshot ? diffScheduleAgainstSnapshot(snapshot, production) : null
            const churnedKeys = new Set()
            if (diff) {
                for (const entry of diff.removed) {
                    const key = normalizeCustomerKey(entry.snapshotOrder?.customer)
                    if (key) churnedKeys.add(`${entry.snapshotOrder?.orderId || ''}|cancel`)
                }
                for (const entry of diff.moved) {
                    const key = normalizeCustomerKey(entry.liveOrder?.customer || entry.snapshotOrder?.customer)
                    if (key) churnedKeys.add(`${entry.liveOrder?.orderId || entry.snapshotOrder?.orderId || ''}|move`)
                }
            }

            // Walk the live schedule once per day, attributing each order
            // to its customer bucket. Kicker detection uses the ticket
            // detail map; churn detection compares against the per-day
            // snapshot diff already computed above.
            for (const [plantCode, block] of Object.entries(production)) {
                if (plantCode === PLAN_META_KEY) continue
                const orders = Array.isArray(block?.orders) ? block.orders : []
                for (const order of orders) {
                    if (!order || isExcludedOrder(order)) continue
                    const key = normalizeCustomerKey(order.customer)
                    if (!key) continue
                    if (!result.has(key)) {
                        result.set(key, {
                            churnEvents: 0,
                            churnRate: 0,
                            displayName: (order.customer || '').trim(),
                            jobs: 0,
                            kickerJobs: 0,
                            kickerRate: 0
                        })
                    }
                    const bucket = result.get(key)
                    bucket.jobs += 1

                    const detail = order.orderId ? detailForDate[order.orderId] : null
                    const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
                    if (tickets.length) {
                        const parsed = tickets
                            .map((t) => ({ mins: timeToMinutes(t?.loadedTime), quantity: toNumber(t?.quantity) }))
                            .filter((t) => Number.isFinite(t.mins))
                            .sort((a, b) => a.mins - b.mins)
                        if (parsed.length) {
                            const spacing = parseDurationMinutes(order?.rate) ?? 5
                            const { kickerStartIndex } = splitTicketsAtKicker(
                                parsed.map((t) => t.mins),
                                spacing
                            )
                            if (kickerStartIndex >= 0) {
                                const kickerYards = parsed
                                    .slice(kickerStartIndex)
                                    .reduce((sum, t) => sum + t.quantity, 0)
                                if (kickerYards > 0) bucket.kickerJobs += 1
                            }
                        }
                    }
                }
            }

            // Churn events fold in from the snapshot diff. Attribute to
            // the snapshot's customer key (the live order may already be
            // gone for cancels). Edits-only diffs (yardage/contact changes)
            // don't count — only cancels + moves move the truck plan.
            if (diff) {
                for (const entry of diff.removed) {
                    const key = normalizeCustomerKey(entry.snapshotOrder?.customer)
                    if (!key) continue
                    if (!result.has(key)) {
                        result.set(key, {
                            churnEvents: 0,
                            churnRate: 0,
                            displayName: (entry.snapshotOrder?.customer || '').trim(),
                            jobs: 0,
                            kickerJobs: 0,
                            kickerRate: 0
                        })
                    }
                    result.get(key).churnEvents += 1
                }
                for (const entry of diff.moved) {
                    const customerSource = entry.liveOrder?.customer || entry.snapshotOrder?.customer
                    const key = normalizeCustomerKey(customerSource)
                    if (!key) continue
                    if (!result.has(key)) {
                        result.set(key, {
                            churnEvents: 0,
                            churnRate: 0,
                            displayName: (customerSource || '').trim(),
                            jobs: 0,
                            kickerJobs: 0,
                            kickerRate: 0
                        })
                    }
                    result.get(key).churnEvents += 1
                }
            }
        }

        // Finalize rates.
        for (const bucket of result.values()) {
            bucket.kickerRate = bucket.jobs > 0 ? bucket.kickerJobs / bucket.jobs : 0
            bucket.churnRate = bucket.jobs > 0 ? bucket.churnEvents / bucket.jobs : 0
        }
        return result
    }, [detailByDate, enabled, planRows, snapshotsByDate])

    return {
        isLoading,
        riskByCustomer
    }
}

/** Resolve risk badges for a single customer name from the index map.
 *  Returns `{ likelyToKick, likelyToChurn }` so the row component
 *  doesn't have to know the thresholds. */
export function resolveCustomerRiskBadges(riskByCustomer, customerName) {
    const key = normalizeCustomerKey(customerName)
    if (!key || !riskByCustomer || riskByCustomer.size === 0) {
        return { likelyToChurn: false, likelyToKick: false }
    }
    const record = riskByCustomer.get(key)
    if (!record || record.jobs < MIN_JOBS_FOR_RISK) {
        return { churnRate: 0, kickerRate: 0, likelyToChurn: false, likelyToKick: false, record: null }
    }
    return {
        churnRate: record.churnRate,
        kickerRate: record.kickerRate,
        likelyToChurn: record.churnRate >= CHURN_RISK_THRESHOLD,
        likelyToKick: record.kickerRate >= KICKER_RISK_THRESHOLD,
        record
    }
}

export default useCustomerRiskIndex
