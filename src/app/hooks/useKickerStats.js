import { useMemo } from 'react'

import { splitTicketsAtKicker } from '../../utils/plan/planCustomerSat'
import { parseDurationMinutes, timeToMinutes } from '../../utils/plan/planTime'
import { EMPTY_COLOCATION_MAP } from '../../utils/PlantColocationUtility'
import { isExcludedOrder } from '../../utils/PlanUtility'

/* Customers ranked in the Kicker leaderboard must have at least this
 * many measured orders so a one-off kicker on a single small job doesn't
 * land at the top of the "biggest average kicker" leaderboard. */
const MIN_JOBS_FOR_RANKING = 1

const EMPTY_RESULT = {
    customerIndex: [],
    kpi: {
        avgKickerYards: 0,
        customers: 0,
        kickerJobs: 0,
        kickerRate: 0,
        scheduledYards: 0,
        totalJobs: 0,
        totalKickerYards: 0
    },
    orderKickers: []
}

/** Cheap finite-number coercion for ticket / order numeric fields. Returns
 *  zero on anything non-finite so accumulators never inherit a NaN. */
const toNumber = (value) => {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
}

/**
 * Derives per-customer kicker statistics for the Statistics → Kickers
 * sub-page. A "kicker" is the cohort of tickets that loaded after a
 * customer paused the pour and called in additional yardage mid-flow —
 * detected by the same `splitTicketsAtKicker` helper that the View
 * Tickets popup and the slow-pace scorer use, so the three surfaces
 * never disagree about whether an order had a kicker.
 *
 * Returned per-customer rows include:
 *   - `avgKickerYards` — average yardage added when this customer kicks
 *     (only counts the jobs that actually had a kicker)
 *   - `avgKickPerJob`  — same total averaged across EVERY measured job
 *     (kickers + non-kickers) so dispatch can see the kicker tax across
 *     their book of business
 *   - `kickerRate`     — fraction of measured jobs that ended in a kicker
 *   - `maxKickerYards` — single worst kicker for context
 *   - `totalKickerYards` — book-wide total for ranking by absolute impact
 *
 * Attribution intentionally lands on the **customer** — kickers are a
 * customer-side behaviour (they're the ones calling in extra yardage),
 * not a plant / driver failure.
 */
export function useKickerStats({
    colocationMap = EMPTY_COLOCATION_MAP,
    detailByDay = {},
    enabled = false,
    flatOrders = [],
    selectedPlant = null
}) {
    return useMemo(() => {
        if (!enabled) return EMPTY_RESULT
        const resolvePrimary = colocationMap?.resolvePrimary || EMPTY_COLOCATION_MAP.resolvePrimary

        const orderKickers = []
        for (const { order, planDate, plantCode } of flatOrders) {
            if (!order || isExcludedOrder(order)) continue
            const detail = detailByDay?.[planDate]?.[order.orderId]
            const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
            if (!tickets.length) continue

            const parsed = tickets
                .map((t) => ({ mins: timeToMinutes(t?.loadedTime), quantity: toNumber(t?.quantity) }))
                .filter((entry) => Number.isFinite(entry.mins))
                .sort((a, b) => a.mins - b.mins)
            if (!parsed.length) continue

            const spacing = parseDurationMinutes(order?.rate) ?? 5
            const { kickerStartIndex } = splitTicketsAtKicker(
                parsed.map((t) => t.mins),
                spacing
            )
            const hasKicker = kickerStartIndex >= 0
            const kickerTickets = hasKicker ? parsed.slice(kickerStartIndex) : []
            const kickerYards = kickerTickets.reduce((sum, t) => sum + t.quantity, 0)
            // Tickets with missing quantities still indicate a kicker
            // happened — count the load even if its yardage is unknown.
            const kickerLoads = kickerTickets.length

            const customerRaw = (order.customer || '').trim()
            if (!customerRaw) continue

            orderKickers.push({
                customer: customerRaw,
                customerKey: customerRaw.toUpperCase(),
                date: planDate,
                hasKicker: hasKicker && kickerYards > 0,
                kickerLoads,
                kickerYards,
                orderId: order.orderId,
                orderNum: order.orderNum || '',
                plantCode: resolvePrimary(plantCode),
                scheduledYards: toNumber(order?.yardage),
                startTime: order.startTime || ''
            })
        }

        const filtered = selectedPlant
            ? orderKickers.filter((entry) => entry.plantCode === resolvePrimary(selectedPlant))
            : orderKickers

        if (filtered.length === 0) return EMPTY_RESULT

        const customerBuckets = new Map()
        for (const entry of filtered) {
            const key = entry.customerKey
            if (!customerBuckets.has(key)) {
                customerBuckets.set(key, {
                    displayName: entry.customer,
                    jobs: 0,
                    kickerJobs: 0,
                    kickerLoads: 0,
                    kickerYards: 0,
                    lastKickerDate: '',
                    maxKickerYards: 0,
                    scheduledYards: 0
                })
            }
            const bucket = customerBuckets.get(key)
            bucket.jobs += 1
            bucket.scheduledYards += entry.scheduledYards
            if (entry.hasKicker) {
                bucket.kickerJobs += 1
                bucket.kickerYards += entry.kickerYards
                bucket.kickerLoads += entry.kickerLoads
                if (entry.date > bucket.lastKickerDate) bucket.lastKickerDate = entry.date
                if (entry.kickerYards > bucket.maxKickerYards) bucket.maxKickerYards = entry.kickerYards
            }
        }

        const customerIndex = [...customerBuckets.entries()]
            // Customers who never kicked aren't useful on this page —
            // exclude them so the leaderboard is exactly "people who add
            // yardage mid-pour". Service quality already shows the
            // never-kick crowd from a different angle.
            .filter(([, b]) => b.kickerJobs > 0 && b.jobs >= MIN_JOBS_FOR_RANKING)
            .map(([key, b]) => ({
                avgKickPerJob: b.jobs > 0 ? b.kickerYards / b.jobs : 0,
                avgKickerYards: b.kickerJobs > 0 ? b.kickerYards / b.kickerJobs : 0,
                jobs: b.jobs,
                key,
                kickerJobs: b.kickerJobs,
                kickerLoads: b.kickerLoads,
                kickerRate: b.jobs > 0 ? b.kickerJobs / b.jobs : 0,
                kickerYards: b.kickerYards,
                lastKickerDate: b.lastKickerDate,
                maxKickerYards: b.maxKickerYards,
                name: b.displayName,
                scheduledYards: b.scheduledYards
            }))
            .sort((a, b) => b.avgKickerYards - a.avgKickerYards || a.name.localeCompare(b.name))

        const totalKickerYards = customerIndex.reduce((sum, c) => sum + c.kickerYards, 0)
        const kickerJobs = customerIndex.reduce((sum, c) => sum + c.kickerJobs, 0)
        const totalJobs = filtered.length
        const scheduledYards = filtered.reduce((sum, o) => sum + o.scheduledYards, 0)

        return {
            customerIndex,
            kpi: {
                avgKickerYards: kickerJobs > 0 ? totalKickerYards / kickerJobs : 0,
                customers: customerIndex.length,
                kickerJobs,
                kickerRate: totalJobs > 0 ? kickerJobs / totalJobs : 0,
                scheduledYards,
                totalJobs,
                totalKickerYards
            },
            // Every measured order that ended in a kicker. Drill-down in
            // the page consumes this directly to build the per-customer
            // history table — no re-classifying / re-detecting required.
            orderKickers: filtered.filter((entry) => entry.hasKicker)
        }
    }, [enabled, flatOrders, detailByDay, selectedPlant, colocationMap])
}
