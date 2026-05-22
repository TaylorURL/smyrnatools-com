import { useMemo } from 'react'

import { scoreOrderExperience } from '../../utils/plan/planCustomerSat'
import { EMPTY_COLOCATION_MAP } from '../../utils/PlantColocationUtility'
import { isExcludedOrder } from '../../utils/PlanUtility'
import { BAD_SERVICE_LATE_THRESHOLD_MIN, SAME_DAY_ORDER_START } from '../constants/planConstants'

/* Outcome buckets covering every measured order. Mutually exclusive and
 * collectively exhaustive — the histogram column always sums to the
 * sample count. `lateAndSlow` is broken out so the worst-case overlap
 * doesn't disappear into a generic "bad" bucket; operations folks treat
 * "the truck was late AND the pour was slow" as a distinct failure
 * mode worth surfacing. */
const OUTCOME_BUCKETS = [
    { color: '#16a34a', key: 'good', label: 'Good service' },
    { color: '#f59e0b', key: 'lateOnly', label: 'Late only' },
    { color: '#ea580c', key: 'slowOnly', label: 'Slow only' },
    { color: '#b91c1c', key: 'lateAndSlow', label: 'Late + slow' }
]

/* Customer ranking excludes anyone with fewer than this many jobs so a
 * single bad delivery doesn't put a one-off customer at the top of
 * "most affected." */
const MIN_JOBS_FOR_CUSTOMER_RANKING = 2

/* Time-of-day bucket definitions. Each bucket spans `[startHour, endHour)`
 * on the wall clock; orders' scheduled `startTime` lands in exactly one.
 * Designed to feel like a working day for concrete operations — early
 * morning starts get their own row so chronic 6am loading issues are
 * visible at a glance. */
const HOUR_BUCKETS = [
    { endHour: 7, label: 'Before 7am', startHour: 0 },
    { endHour: 9, label: '7–9am', startHour: 7 },
    { endHour: 11, label: '9–11am', startHour: 9 },
    { endHour: 13, label: '11am–1pm', startHour: 11 },
    { endHour: 15, label: '1–3pm', startHour: 13 },
    { endHour: 17, label: '3–5pm', startHour: 15 },
    { endHour: 24, label: 'After 5pm', startHour: 17 }
]

const buildEmptyHourRow = (cfg) => ({
    avgLateMin: 0,
    badJobs: 0,
    goodPct: 0,
    jobs: 0,
    label: cfg.label,
    lateJobs: 0,
    slowJobs: 0
})

const EMPTY_RESULT = {
    byCustomer: [],
    byDay: [],
    byHour: HOUR_BUCKETS.map(buildEmptyHourRow),
    byPlant: [],
    customerIndex: [],
    kpi: {
        avgLatenessMin: 0,
        badJobs: 0,
        goodJobs: 0,
        goodPct: 0,
        lateAndSlow: 0,
        lateJobs: 0,
        slowJobs: 0,
        tierCounts: { bad: 0, good: 0, notGood: 0, veryBad: 0 },
        totalJobs: 0,
        worstLatenessMin: 0
    },
    orderVerdicts: [],
    outcomes: OUTCOME_BUCKETS.map((b) => ({ color: b.color, count: 0, key: b.key, label: b.label })),
    threshold: BAD_SERVICE_LATE_THRESHOLD_MIN,
    worstOrders: []
}

const classifyOutcome = (verdict) => {
    if (verdict.isLate && verdict.isSlow) return 'lateAndSlow'
    if (verdict.isLate) return 'lateOnly'
    if (verdict.isSlow) return 'slowOnly'
    return 'good'
}

/**
 * Derives the full "good vs. bad customer experience" picture for the
 * Statistics → Service sub-page — by plant, by customer, by time-of-day,
 * by day, plus a distribution of outcomes and a worst-orders list.
 *
 * Each order is scored via `scoreOrderExperience` (the same function
 * `computeCustomerSatisfaction` uses), so this page never disagrees
 * with the customer-satisfaction scorecard about whether a specific
 * order was good service. The two views are complementary: satisfaction
 * shows the rolled-up score, this page shows WHY it's good or bad.
 *
 * Attribution intentionally lands on the **plant** (who scheduled +
 * loaded + paced the pour) and the **scheduled hour** (when the
 * dispatcher committed to the customer). Drivers don't control either
 * lateness or pour pace in any meaningful way, so this page surfaces
 * neither a driver leaderboard nor driver names in any aggregation.
 * The worst-orders list also omits driver/truck — it's about which
 * orders went badly, not who happened to be behind the wheel.
 *
 * @param {Object} args
 * @param {boolean} args.enabled - Skip computation entirely when false.
 * @param {Object} args.detailByDay - `{ [planDate]: { [orderId]: { tickets: [...] } } }`
 * @param {Array}  args.flatOrders  - `[{ order, planDate, plantCode }]` —
 *   already filtered to live orders for the active range.
 * @param {string|null} args.selectedPlant - Plant filter. When set, only
 *   orders whose resolved home plant matches participate.
 * @param {Object} args.plantNameByCode - Authoritative roster. Seeds the
 *   plant scorecard so quiet plants render as "0 jobs" rows instead of
 *   disappearing.
 * @param {Object} [args.colocationMap] - Collapses sibling-site plant
 *   codes (e.g. 404 ↔ 401) onto one primary code before bucketing.
 *
 * @returns service-quality rollup; see `EMPTY_RESULT` for the shape.
 */
export function useServiceQualityStats({
    colocationMap = EMPTY_COLOCATION_MAP,
    detailByDay = {},
    enabled = false,
    flatOrders = [],
    plantNameByCode = {},
    selectedPlant = null
}) {
    return useMemo(() => {
        if (!enabled) return EMPTY_RESULT
        const resolvePrimary = colocationMap?.resolvePrimary || EMPTY_COLOCATION_MAP.resolvePrimary

        /* ── 1. Measure every order ──────────────────────────────────── */
        const measured = []
        for (const { order, planDate, plantCode } of flatOrders) {
            if (!order || isExcludedOrder(order)) continue
            const detail = detailByDay?.[planDate]?.[order.orderId]
            const verdict = scoreOrderExperience(order, detail)
            if (!verdict.measured) continue
            const customerRaw = (order.customer || '').trim()
            measured.push({
                customer: customerRaw,
                // Canonical key for grouping. Matches the customer-bucket
                // key (uppercase trim) so the Customer Lookup page can
                // filter `orderVerdicts` directly against a `customerIndex`
                // entry without re-normalizing.
                customerKey: customerRaw ? customerRaw.toUpperCase() : '',
                date: planDate,
                firstLoadTime: verdict.firstLoadTime,
                hasKicker: verdict.hasKicker,
                isBad: verdict.isBad,
                isLate: verdict.isLate,
                // Same-day orders carry the `15:00` start-time sentinel
                // — the dispatch HTML's signal that the customer called
                // in the pour the same day it ran. Surfacing this on the
                // Customer Lookup detail lets dispatch see at a glance
                // which entries on a customer's history were last-minute
                // bookings vs. planned pours.
                isSameDay: verdict.startTime === SAME_DAY_ORDER_START,
                isSlow: verdict.isSlow,
                kickerLoads: verdict.kickerLoads,
                kickerYards: verdict.kickerYards,
                latenessMin: verdict.latenessMin,
                orderId: order.orderId,
                orderNum: order.orderNum || '',
                outcome: classifyOutcome(verdict),
                paceScore: verdict.paceScore,
                plantCode: resolvePrimary(plantCode),
                startMin: verdict.startMin,
                startTime: verdict.startTime,
                /* Lateness severity tier — `good`/`notGood`/`bad`/`veryBad`
                 * from `classifyServiceTier`. Lets every consumer surface
                 * the same graded breakdown instead of the binary
                 * good/bad split. */
                tier: verdict.tier
            })
        }

        const filtered = selectedPlant
            ? measured.filter((m) => m.plantCode === resolvePrimary(selectedPlant))
            : measured

        if (filtered.length === 0) return EMPTY_RESULT

        /* ── 2. KPI rollup ──────────────────────────────────────────── */
        const totalJobs = filtered.length
        let lateJobs = 0
        let slowJobs = 0
        let lateAndSlow = 0
        let lateLatenessSum = 0
        let worstLatenessMin = 0
        const tierCounts = { bad: 0, good: 0, notGood: 0, veryBad: 0 }
        for (const m of filtered) {
            if (m.isLate) {
                lateJobs += 1
                lateLatenessSum += m.latenessMin
                if (m.latenessMin > worstLatenessMin) worstLatenessMin = m.latenessMin
            }
            if (m.isSlow) slowJobs += 1
            if (m.isLate && m.isSlow) lateAndSlow += 1
            tierCounts[m.tier] += 1
        }
        const badJobs = filtered.filter((m) => m.isBad).length
        const goodJobs = totalJobs - badJobs
        const goodPct = totalJobs > 0 ? goodJobs / totalJobs : 0
        const avgLatenessMin = lateJobs > 0 ? lateLatenessSum / lateJobs : 0

        /* ── 3. Plant scorecard ─────────────────────────────────────── */
        const plantBuckets = new Map()
        const ensurePlant = (code) => {
            if (!plantBuckets.has(code)) {
                plantBuckets.set(code, {
                    badJobs: 0,
                    code,
                    jobs: 0,
                    lateJobs: 0,
                    lateLatenessSum: 0,
                    slowJobs: 0,
                    tierCounts: { bad: 0, good: 0, notGood: 0, veryBad: 0 },
                    worstLateMin: 0
                })
            }
            return plantBuckets.get(code)
        }
        for (const m of filtered) {
            if (!m.plantCode) continue
            const bucket = ensurePlant(m.plantCode)
            bucket.jobs += 1
            if (m.isBad) bucket.badJobs += 1
            if (m.isLate) {
                bucket.lateJobs += 1
                bucket.lateLatenessSum += m.latenessMin
                if (m.latenessMin > bucket.worstLateMin) bucket.worstLateMin = m.latenessMin
            }
            if (m.isSlow) bucket.slowJobs += 1
            bucket.tierCounts[m.tier] += 1
        }
        for (const code of Object.keys(plantNameByCode || {})) {
            ensurePlant(resolvePrimary(code))
        }
        const byPlant = [...plantBuckets.values()]
            .map((b) => ({
                avgLateMin: b.lateJobs > 0 ? b.lateLatenessSum / b.lateJobs : 0,
                badJobs: b.badJobs,
                code: b.code,
                goodJobs: b.jobs - b.badJobs,
                goodPct: b.jobs > 0 ? (b.jobs - b.badJobs) / b.jobs : null,
                jobs: b.jobs,
                lateJobs: b.lateJobs,
                slowJobs: b.slowJobs,
                tierCounts: b.tierCounts,
                worstLateMin: b.worstLateMin
            }))
            .sort((a, b) => {
                if (a.goodPct == null && b.goodPct == null) return 0
                if (a.goodPct == null) return 1
                if (b.goodPct == null) return -1
                if (b.goodPct !== a.goodPct) return b.goodPct - a.goodPct
                return b.jobs - a.jobs
            })

        /* ── 4. Customer rollup ─────────────────────────────────────── */
        const customerBuckets = new Map()
        for (const m of filtered) {
            const raw = (m.customer || '').trim()
            if (!raw) continue
            const key = raw.toUpperCase()
            if (!customerBuckets.has(key)) {
                customerBuckets.set(key, {
                    badJobs: 0,
                    displayName: raw,
                    jobs: 0,
                    lastPourDate: '',
                    lateJobs: 0,
                    lateLatenessSum: 0,
                    slowJobs: 0,
                    tierCounts: { bad: 0, good: 0, notGood: 0, veryBad: 0 },
                    worstLateMin: 0
                })
            }
            const bucket = customerBuckets.get(key)
            bucket.jobs += 1
            // Track the most recent measured order so the lookup page can
            // show "Last pour <date>" next to the customer name. ISO dates
            // sort lexicographically, so a string-compare gets the max.
            if (m.date && m.date > bucket.lastPourDate) bucket.lastPourDate = m.date
            if (m.isBad) bucket.badJobs += 1
            if (m.isLate) {
                bucket.lateJobs += 1
                bucket.lateLatenessSum += m.latenessMin
                if (m.latenessMin > bucket.worstLateMin) bucket.worstLateMin = m.latenessMin
            }
            if (m.isSlow) bucket.slowJobs += 1
            bucket.tierCounts[m.tier] += 1
        }
        const customerRowsAll = [...customerBuckets.entries()].map(([key, b]) => ({
            avgLateMin: b.lateJobs > 0 ? b.lateLatenessSum / b.lateJobs : 0,
            badJobs: b.badJobs,
            goodJobs: b.jobs - b.badJobs,
            goodPct: b.jobs > 0 ? (b.jobs - b.badJobs) / b.jobs : 0,
            jobs: b.jobs,
            key,
            lastPourDate: b.lastPourDate,
            lateJobs: b.lateJobs,
            name: b.displayName,
            slowJobs: b.slowJobs,
            tierCounts: b.tierCounts,
            worstLateMin: b.worstLateMin
        }))
        // Top-12 worst slice for the Service page panel.
        const byCustomer = customerRowsAll
            .filter((r) => r.jobs >= MIN_JOBS_FOR_CUSTOMER_RANKING && r.badJobs > 0)
            .sort((a, b) => {
                if (b.badJobs !== a.badJobs) return b.badJobs - a.badJobs
                if (a.goodPct !== b.goodPct) return a.goodPct - b.goodPct
                return b.jobs - a.jobs
            })
            .slice(0, 12)
        // Full alphabetical index for the Customer Lookup page — every
        // customer that had at least one measured order in the window,
        // including those with 100% good service. The lookup UI does its
        // own filtering / sorting on top of this raw list.
        const customerIndex = [...customerRowsAll].sort((a, b) => a.name.localeCompare(b.name))

        /* ── 5. Hour-of-day rollup ─────────────────────────────────── */
        const hourBuckets = HOUR_BUCKETS.map((cfg) => ({
            ...cfg,
            badJobs: 0,
            jobs: 0,
            lateJobs: 0,
            lateLatenessSum: 0,
            slowJobs: 0
        }))
        const findHourBucket = (startMin) => {
            if (!Number.isFinite(startMin)) return hourBuckets[hourBuckets.length - 1]
            const hour = Math.floor(startMin / 60)
            return (
                hourBuckets.find((b) => hour >= b.startHour && hour < b.endHour) || hourBuckets[hourBuckets.length - 1]
            )
        }
        for (const m of filtered) {
            const bucket = findHourBucket(m.startMin)
            bucket.jobs += 1
            if (m.isBad) bucket.badJobs += 1
            if (m.isLate) {
                bucket.lateJobs += 1
                bucket.lateLatenessSum += m.latenessMin
            }
            if (m.isSlow) bucket.slowJobs += 1
        }
        const byHour = hourBuckets.map((b) => ({
            avgLateMin: b.lateJobs > 0 ? b.lateLatenessSum / b.lateJobs : 0,
            badJobs: b.badJobs,
            goodPct: b.jobs > 0 ? (b.jobs - b.badJobs) / b.jobs : 0,
            jobs: b.jobs,
            label: b.label,
            lateJobs: b.lateJobs,
            slowJobs: b.slowJobs
        }))

        /* ── 6. Day trend ──────────────────────────────────────────── */
        const dayBuckets = new Map()
        for (const m of filtered) {
            if (!dayBuckets.has(m.date)) {
                dayBuckets.set(m.date, { badJobs: 0, date: m.date, jobs: 0, lateJobs: 0, slowJobs: 0 })
            }
            const bucket = dayBuckets.get(m.date)
            bucket.jobs += 1
            if (m.isBad) bucket.badJobs += 1
            if (m.isLate) bucket.lateJobs += 1
            if (m.isSlow) bucket.slowJobs += 1
        }
        const byDay = [...dayBuckets.values()]
            .map((b) => ({
                badJobs: b.badJobs,
                date: b.date,
                goodJobs: b.jobs - b.badJobs,
                goodPct: b.jobs > 0 ? (b.jobs - b.badJobs) / b.jobs : 0,
                jobs: b.jobs,
                lateJobs: b.lateJobs,
                slowJobs: b.slowJobs
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

        /* ── 7. Outcome distribution ───────────────────────────────── */
        const outcomes = OUTCOME_BUCKETS.map((cfg) => {
            const count = filtered.filter((m) => m.outcome === cfg.key).length
            return { color: cfg.color, count, key: cfg.key, label: cfg.label }
        })

        /* ── 8. Worst orders ───────────────────────────────────────── */
        const worstOrders = filtered
            .filter((m) => m.isBad)
            .sort((a, b) => {
                // Sort bad jobs by "how bad" — primarily by lateness
                // minutes; ties broken by pace score (lower = worse).
                if (b.latenessMin !== a.latenessMin) return b.latenessMin - a.latenessMin
                const ap = a.paceScore == null ? 1 : a.paceScore
                const bp = b.paceScore == null ? 1 : b.paceScore
                return ap - bp
            })
            .slice(0, 20)

        return {
            byCustomer,
            byDay,
            byHour,
            byPlant,
            customerIndex,
            kpi: {
                avgLatenessMin,
                badJobs,
                goodJobs,
                goodPct,
                lateAndSlow,
                lateJobs,
                slowJobs,
                tierCounts,
                totalJobs,
                worstLatenessMin
            },
            // Every measured order in the window, keyed by a canonical
            // customer key (`UPPER(trim(customer))`). The Customer Lookup
            // page consumes this directly to drill into a single
            // customer's history without re-classifying.
            orderVerdicts: filtered,
            outcomes,
            threshold: BAD_SERVICE_LATE_THRESHOLD_MIN,
            worstOrders
        }
    }, [enabled, flatOrders, detailByDay, selectedPlant, plantNameByCode, colocationMap])
}
