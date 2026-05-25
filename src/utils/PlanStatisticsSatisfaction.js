/**
 * Satisfaction aggregators extracted from `PlanStatisticsAggregators`.
 * Per-day, per-plant, per-weekday, per-window, plus momentum +
 * scored-order list.
 *
 * Each function is a deterministic transformation of its inputs — no
 * React, no refs, no module-level state.
 */
import { parseIsoLocal } from './PlanStatisticsFormatUtility'
import { isoDate } from './PlanStatisticsUtility'
import { computeCustomerSatisfaction } from './PlanUtility'

const TRAJECTORY_DELTA_THRESHOLD = 2

const classifyTrajectory = (delta) => {
    if (delta == null) return 'stable'
    if (delta > TRAJECTORY_DELTA_THRESHOLD) return 'improving'
    if (delta < -TRAJECTORY_DELTA_THRESHOLD) return 'declining'
    return 'stable'
}

/** Per-day satisfaction. Walks each day's orders once and hits the
 *  shared detail map. Null entries mean we have no ticket data for
 *  that day. */
export function buildSatisfactionByDay(currentDays, detailByDay) {
    const out = {}
    currentDays.forEach((d) => {
        const detail = detailByDay[d.planDate]
        if (!detail) {
            out[d.planDate] = null
            return
        }
        out[d.planDate] = computeCustomerSatisfaction(d.allLiveOrders || [], detail)
    })
    return out
}

/** Period-aggregated satisfaction across all current days. */
export function buildSatisfactionAggregate(currentDays, mergedDetail) {
    if (!currentDays.length) return null
    const orders = []
    currentDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
    if (!orders.length) return null
    return computeCustomerSatisfaction(orders, mergedDetail)
}

/** Same as `buildSatisfactionAggregate` but for the comparison window. */
export function buildPreviousSatisfactionAggregate(previousDays, mergedDetail, comparison) {
    if (comparison === 'none' || !previousDays.length) return null
    const orders = []
    previousDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
    if (!orders.length) return null
    return computeCustomerSatisfaction(orders, mergedDetail)
}

/** Per-day satisfaction trend across the entire range, padded so
 *  missing days show as gaps. Each entry carries the raw score plus a
 *  trailing 7-working-day rolling good-rate. */
export function buildSatisfactionTrend(currentDays, detailByDay, range) {
    if (!currentDays.length) return []
    const cursor = parseIsoLocal(range.current.start)
    const endDate = parseIsoLocal(range.current.end)
    if (!cursor || !endDate) return []

    const dayByDate = new Map(currentDays.map((d) => [d.planDate, d]))

    const dailyStats = []
    let safety = 366 * 5
    while (cursor <= endDate && safety > 0) {
        if (cursor.getDay() !== 0) {
            const iso = isoDate(cursor)
            const day = dayByDate.get(iso) || null
            const detail = detailByDay[iso]
            const result = day && detail ? computeCustomerSatisfaction(day.allLiveOrders || [], detail) : null
            dailyStats.push({
                badService: result ? result.badService : 0,
                date: iso,
                goodService: result ? result.goodService : 0,
                samples: result ? result.samples : 0,
                score: result ? Math.round(result.score * 100) : null
            })
        }
        cursor.setDate(cursor.getDate() + 1)
        safety -= 1
    }

    return dailyStats.map((stat, idx) => {
        const sliceStart = Math.max(0, idx - 6)
        let rollingGood = 0
        let rollingSamples = 0
        for (let i = sliceStart; i <= idx; i += 1) {
            rollingGood += dailyStats[i].goodService
            rollingSamples += dailyStats[i].samples
        }
        return {
            ...stat,
            rollingSamples,
            rollingScore: rollingSamples > 0 ? Math.round((rollingGood / rollingSamples) * 100) : null
        }
    })
}

/** ISO date midway through the active window. */
export function computeWindowMidpointIso(range) {
    if (!range?.current?.start || !range?.current?.end) return null
    const start = new Date(`${range.current.start}T00:00:00`)
    const end = new Date(`${range.current.end}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return isoDate(new Date((start.getTime() + end.getTime()) / 2))
}

/** Per-plant satisfaction with first-half vs second-half trajectory. */
export function buildPerPlantSatisfaction(flatOrders, mergedDetail, windowMidpointIso) {
    if (!flatOrders.length) return []
    const byPlant = new Map()
    flatOrders.forEach(({ order, plantCode, planDate }) => {
        if (!byPlant.has(plantCode)) {
            byPlant.set(plantCode, { firstHalf: [], orders: [], secondHalf: [], yardage: 0 })
        }
        const bucket = byPlant.get(plantCode)
        bucket.orders.push(order)
        bucket.yardage += parseFloat(order?.yardage) || 0
        if (windowMidpointIso && planDate < windowMidpointIso) bucket.firstHalf.push(order)
        else bucket.secondHalf.push(order)
    })
    const out = []
    byPlant.forEach((entry, code) => {
        const aggregate = computeCustomerSatisfaction(entry.orders, mergedDetail)
        if (!aggregate) return
        const first = entry.firstHalf.length ? computeCustomerSatisfaction(entry.firstHalf, mergedDetail) : null
        const second = entry.secondHalf.length ? computeCustomerSatisfaction(entry.secondHalf, mergedDetail) : null
        const delta = first && second ? Math.round(second.score * 100) - Math.round(first.score * 100) : null
        out.push({
            badService: aggregate.badService,
            code,
            delta,
            goodService: aggregate.goodService,
            samples: aggregate.samples,
            score: Math.round(aggregate.score * 100),
            tierCounts: aggregate.tierCounts,
            trajectory: classifyTrajectory(delta),
            yardage: Math.round(entry.yardage)
        })
    })
    return out.sort((a, b) => a.score - b.score)
}

/** Day-of-week satisfaction breakdown — average score Mon–Sat across
 *  the active window. */
export function buildSatisfactionByWeekday(currentDays, detailByDay) {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const buckets = labels.map((label) => ({ count: 0, label, samples: 0, scoreSum: 0 }))
    currentDays.forEach((d) => {
        const detail = detailByDay[d.planDate]
        if (!detail) return
        const result = computeCustomerSatisfaction(d.allLiveOrders || [], detail)
        if (!result) return
        const date = d.planDate ? new Date(`${d.planDate}T00:00:00`) : null
        if (!date || Number.isNaN(date.getTime())) return
        const dow = date.getDay()
        if (dow === 0) return
        const bucket = buckets[dow - 1]
        bucket.scoreSum += result.score * 100
        bucket.count += 1
        bucket.samples += result.samples
    })
    return buckets.map((b) => ({
        label: b.label,
        samples: b.samples,
        score: b.count > 0 ? Math.round(b.scoreSum / b.count) : null
    }))
}

/** Per-order scored list — the hottest single pass on the page. */
export function buildScoredOrders(flatOrders, mergedDetail, selectedPlant) {
    if (!flatOrders.length) return []
    const out = []
    flatOrders.forEach(({ order, plantCode, planDate: orderDate }) => {
        if (selectedPlant && plantCode !== selectedPlant) return
        const detail = order?.orderId ? mergedDetail[order.orderId] : null
        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
        if (!tickets.length) return
        const result = computeCustomerSatisfaction([order], { [order.orderId]: detail })
        if (!result || result.samples === 0) return
        out.push({
            customer: (order.customer || '').trim() || 'Unknown',
            isBad: result.badService > 0,
            orderNum: order.orderNum || '',
            planDate: orderDate,
            plantCode,
            productCode: (order.productCode || '').trim() || '',
            score: Math.round(result.score * 100),
            yardage: parseFloat(order.yardage) || 0
        })
    })
    return out
}

/** Worst orders surfaced for follow-up — bad orders sorted by yardage
 *  desc, capped at 8. */
export function buildSatisfactionWorstOrders(scoredOrders) {
    return scoredOrders
        .filter((row) => row.isBad)
        .sort((a, b) => b.yardage - a.yardage)
        .slice(0, 8)
}

/** Customers with any bad service in the window, capped at 6. */
export function buildSatisfactionWorstCustomers(scoredOrders) {
    if (!scoredOrders.length) return []
    const byCustomer = new Map()
    scoredOrders.forEach((row) => {
        if (!byCustomer.has(row.customer)) {
            byCustomer.set(row.customer, {
                badOrders: 0,
                customer: row.customer,
                samples: 0,
                yardage: 0
            })
        }
        const bucket = byCustomer.get(row.customer)
        bucket.samples += 1
        if (row.isBad) {
            bucket.badOrders += 1
            bucket.yardage += row.yardage
        }
    })
    const out = []
    byCustomer.forEach((entry) => {
        if (entry.badOrders === 0) return
        out.push({
            badOrders: entry.badOrders,
            customer: entry.customer,
            samples: entry.samples,
            yardage: Math.round(entry.yardage)
        })
    })
    return out.sort((a, b) => b.badOrders - a.badOrders || b.yardage - a.yardage).slice(0, 6)
}

/** Momentum — last 7 working days inside the window vs the 7 before. */
export function buildSatisfactionMomentum(currentDays, mergedDetail) {
    if (!currentDays.length) return null
    const sorted = [...currentDays].sort((a, b) => (a.planDate || '').localeCompare(b.planDate || ''))
    if (sorted.length < 4) return null
    const recent = sorted.slice(-7)
    const prior = sorted.slice(-14, -7)
    const collectOrders = (days) => {
        const out = []
        days.forEach((d) => (d.allLiveOrders || []).forEach((o) => out.push(o)))
        return out
    }
    const recentResult = computeCustomerSatisfaction(collectOrders(recent), mergedDetail)
    const priorResult = computeCustomerSatisfaction(collectOrders(prior), mergedDetail)
    if (!recentResult && !priorResult) return null
    const recentScore = recentResult ? Math.round(recentResult.score * 100) : null
    const priorScore = priorResult ? Math.round(priorResult.score * 100) : null
    const delta = recentScore != null && priorScore != null ? recentScore - priorScore : null
    return {
        delta,
        prior: priorResult ? { samples: priorResult.samples, score: priorScore } : { samples: 0, score: null },
        recent: recentResult ? { samples: recentResult.samples, score: recentScore } : { samples: 0, score: null },
        trajectory: classifyTrajectory(delta)
    }
}
