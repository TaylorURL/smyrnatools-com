/**
 * PlanStatisticsMetrics — schedule-side reduction + aggregation for the
 * Plan Statistics dashboard. Per-day `plant_production` is reduced into a
 * flat metrics object (`computeScheduleMetrics`), arrays of those objects
 * are folded into a single summary (`aggregateMetrics`), and the trend
 * chart's missing dates are padded (`padTrend`) so the line draws a
 * continuous Mon–Sat window without phantom drop-offs.
 */
import { parseIsoLocal } from './PlanStatisticsFormatUtility'
import {
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
    FLEET_MAX_LOAD_SIZE,
    getTodayDate,
    isExcludedOrder,
    parseDurationMinutes,
    PLAN_META_KEY,
    timeToMinutes
} from './PlanUtility'

import { isoDate } from './PlanStatisticsDates'

/** Snap floats to one decimal so summed values (yardage / loadSize, etc.)
 *  never bubble up as 208.39999999999998. */
export const snapTenth = (n) => Math.round(n * 10) / 10

/** Loads (truck deliveries) for an order = yardage / loadSize — NOT
 *  `truckCount`, which is the trucks-in-rotation count and is often smaller
 *  than the delivery count (one truck does multiple trips). When loadSize is
 *  missing from the parsed dispatch HTML, fall back to the fleet maximum
 *  (10 yd³) so the yards/load average can never exceed truck capacity. */
export const loadsForOrder = (order) => {
    const yards = parseFloat(order?.yardage) || 0
    if (yards <= 0) return 0
    const rawLoadSize = parseFloat(order?.loadSize)
    const loadSize =
        Number.isFinite(rawLoadSize) && rawLoadSize > 0
            ? Math.min(rawLoadSize, FLEET_MAX_LOAD_SIZE)
            : FLEET_MAX_LOAD_SIZE
    return yards / loadSize
}

/**
 * Reduce a single day's stored `plant_production` (the dispatch schedule
 * snapshot) into a flat metrics object the dashboard can sum / chart. This
 * is purely schedule-side data — order counts, yardage, loads, customers,
 * products, shift spans — with no dispatch-plan / help-route mixing.
 *
 * @param {Object} row - Plan row with `plan_date` + `plant_production`.
 * @param {string|null} [plantFilter] - When set to a plant code, scopes
 *  every aggregation (totals, perCustomer/perProduct, hourBuckets,
 *  bigPours, allLiveOrders) to orders from that plant only. perPlant is
 *  reduced to a single entry. Use null/undefined for an all-plants view.
 */
export const computeScheduleMetrics = (row, plantFilter = null) => {
    const production = row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
    const perPlant = {}
    const perCustomer = {}
    const perProduct = {}
    const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, loads: 0, yardage: 0 }))
    const bigPours = []
    // Dedup big pours by (orderNum / customer-yardage-time) so an order that
    // appears in more than one plant block in the parsed schedule isn't
    // double-counted in the day's total.
    const bigPourSeen = new Set()
    // Live orders for the day, captured here so we can later compute the
    // shared `computeCustomerSatisfaction` score against fetched detail-
    // order ticket data without re-walking the production blob.
    const allLiveOrders = []
    let totalYardage = 0
    let totalLoads = 0
    let totalOrders = 0
    let earliestStart = null
    let latestEnd = null
    let activePlants = 0

    Object.keys(production).forEach((plantCode) => {
        if (plantCode === PLAN_META_KEY) return
        if (plantFilter && plantCode !== plantFilter) return
        const block = production[plantCode] || {}
        const orders = Array.isArray(block.orders) ? block.orders : []
        const liveOrders = orders.filter((o) => !isExcludedOrder(o))
        liveOrders.forEach((o) => allLiveOrders.push(o))
        const orderYardage = liveOrders.reduce((sum, o) => sum + (parseFloat(o.yardage) || 0), 0)
        const fallbackYardage = parseFloat(block.totalYardage) || 0
        // Fall back to the parsed-summary yardage only when there are no
        // per-order rows to read from. We need to estimate loads for that
        // fallback yardage too — otherwise the day-level totalYardage
        // includes summary-only yardage while totalLoads stays at 0, and the
        // resulting yards-per-load ratio mathematically exceeds the truck
        // capacity (impossible for real pours).
        const usingFallback = liveOrders.length === 0 && orderYardage <= 0 && fallbackYardage > 0
        const yardage = usingFallback ? fallbackYardage : orderYardage
        const orderLoads = liveOrders.reduce((sum, o) => sum + loadsForOrder(o), 0)
        const loads = usingFallback ? fallbackYardage / FLEET_MAX_LOAD_SIZE : orderLoads
        const startMin = timeToMinutes(block.firstJobTime)
        const endMin = timeToMinutes(block.lastJobTime)
        if (yardage > 0 || loads > 0 || liveOrders.length > 0) activePlants += 1
        if (startMin != null && (earliestStart == null || startMin < earliestStart)) earliestStart = startMin
        if (endMin != null && (latestEnd == null || endMin > latestEnd)) latestEnd = endMin
        perPlant[plantCode] = {
            code: plantCode,
            loads,
            orderCount: liveOrders.length,
            yardage,
            yardsPerOrder: liveOrders.length > 0 ? Math.round((yardage / liveOrders.length) * 10) / 10 : null
        }
        totalYardage += yardage
        totalLoads += loads
        totalOrders += liveOrders.length

        liveOrders.forEach((o) => {
            const orderYards = parseFloat(o.yardage) || 0
            const orderLoadCount = loadsForOrder(o)
            const customer = (o.customer || 'Unknown').trim() || 'Unknown'
            if (!perCustomer[customer]) perCustomer[customer] = { customer, loads: 0, orders: 0, yardage: 0 }
            perCustomer[customer].yardage += orderYards
            perCustomer[customer].loads += orderLoadCount
            perCustomer[customer].orders += 1

            const product = (o.productCode || '—').trim() || '—'
            if (!perProduct[product]) perProduct[product] = { loads: 0, orders: 0, product, yardage: 0 }
            perProduct[product].yardage += orderYards
            perProduct[product].loads += orderLoadCount
            perProduct[product].orders += 1

            const startMins = timeToMinutes(o.startTime)
            if (startMins != null) {
                const hour = Math.max(0, Math.min(23, Math.floor(startMins / 60)))
                hourBuckets[hour].yardage += orderYards
                hourBuckets[hour].loads += orderLoadCount
            }

            // Big pour = yardage > 120 yd³ AND spacing < 10 min between
            // trucks (back-to-back loading). Anything that fails either
            // condition is a normal order — yardage alone isn't enough.
            // Dedup against the same order showing up under multiple plant
            // blocks so the count matches what's on the dispatch sheet.
            const orderSpacingMin = parseDurationMinutes(o.rate)
            const isBigPour =
                orderYards > BIG_POUR_YARDAGE_THRESHOLD &&
                orderSpacingMin != null &&
                orderSpacingMin < BIG_POUR_SPACING_THRESHOLD_MIN
            if (isBigPour) {
                const key = o.orderNum
                    ? `${row.plan_date}|${o.orderNum}`
                    : `${row.plan_date}|${plantCode}|${customer}|${orderYards}|${o.startTime || ''}`
                if (!bigPourSeen.has(key)) {
                    bigPourSeen.add(key)
                    bigPours.push({
                        customer,
                        loads: orderLoadCount,
                        orderNum: o.orderNum || '',
                        planDate: row.plan_date,
                        plantCode,
                        productCode: product,
                        startTime: o.startTime || '',
                        yardage: orderYards
                    })
                }
            }
        })
    })

    const shiftSpanHours =
        earliestStart != null && latestEnd != null && latestEnd > earliestStart
            ? Math.round(((latestEnd - earliestStart) / 60) * 10) / 10
            : null

    // Peak hour — the hour with the most loads (ties broken by yardage).
    let peakHour = null
    let peakHourLoads = 0
    hourBuckets.forEach((b) => {
        if (b.loads > peakHourLoads || (b.loads === peakHourLoads && b.yardage > (peakHour?.yardage || 0))) {
            peakHourLoads = b.loads
            peakHour = b
        }
    })

    // Snap per-day totals + bucket tallies to one decimal so summed floats
    // never bubble up as 208.39999999999998 in the UI or when re-aggregated
    // across multiple days.
    Object.values(perPlant).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
    })
    Object.values(perCustomer).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
    })
    Object.values(perProduct).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
    })
    hourBuckets.forEach((b) => {
        b.yardage = snapTenth(b.yardage)
        b.loads = snapTenth(b.loads)
    })

    return {
        activePlants,
        allLiveOrders,
        bigPours,
        firstJobMinutes: earliestStart,
        hourBuckets,
        lastJobMinutes: latestEnd,
        peakHour,
        perCustomer,
        perPlant,
        perProduct,
        planDate: row.plan_date,
        shiftSpanHours,
        totalLoads: snapTenth(totalLoads),
        totalOrders,
        totalYardage: snapTenth(totalYardage),
        yardagePerLoad: totalLoads > 0 ? Math.round((totalYardage / totalLoads) * 10) / 10 : null
    }
}

/** Aggregate an array of per-day schedule metrics into a single summary. */
export const aggregateMetrics = (days) => {
    const summary = {
        activePlantSet: new Set(),
        avgShiftSpanHours: null,
        avgYardagePerActiveDay: 0,
        bestDay: null,
        bigPours: [],
        dayCount: days.length,
        daysWithProduction: 0,
        hourBuckets: Array.from({ length: 24 }, (_, i) => ({ hour: i, loads: 0, yardage: 0 })),
        peakHour: null,
        perCustomer: {},
        perPlant: {},
        perProduct: {},
        topCustomerShare: null,
        topPlantShare: null,
        totalLoads: 0,
        totalOrders: 0,
        totalYardage: 0,
        worstDay: null
    }
    let shiftSpanSum = 0
    let shiftSpanCount = 0
    days.forEach((p) => {
        summary.totalLoads += p.totalLoads
        summary.totalOrders += p.totalOrders
        summary.totalYardage += p.totalYardage
        if (p.totalYardage > 0 || p.totalLoads > 0 || p.totalOrders > 0) summary.daysWithProduction += 1
        if (!summary.bestDay || p.totalYardage > summary.bestDay.totalYardage) summary.bestDay = p
        if (p.totalYardage > 0 && (!summary.worstDay || p.totalYardage < summary.worstDay.totalYardage)) {
            summary.worstDay = p
        }
        if (p.shiftSpanHours != null) {
            shiftSpanSum += p.shiftSpanHours
            shiftSpanCount += 1
        }
        if (Array.isArray(p.bigPours)) summary.bigPours.push(...p.bigPours)
        Object.values(p.perPlant).forEach((block) => {
            summary.activePlantSet.add(block.code)
            if (!summary.perPlant[block.code]) {
                summary.perPlant[block.code] = { activeDays: 0, code: block.code, loads: 0, orderCount: 0, yardage: 0 }
            }
            summary.perPlant[block.code].loads += block.loads
            summary.perPlant[block.code].orderCount += block.orderCount
            summary.perPlant[block.code].yardage += block.yardage
            if (block.yardage > 0 || block.loads > 0) summary.perPlant[block.code].activeDays += 1
        })
        Object.values(p.perCustomer).forEach((block) => {
            if (!summary.perCustomer[block.customer]) {
                summary.perCustomer[block.customer] = { customer: block.customer, loads: 0, orders: 0, yardage: 0 }
            }
            summary.perCustomer[block.customer].yardage += block.yardage
            summary.perCustomer[block.customer].loads += block.loads
            summary.perCustomer[block.customer].orders += block.orders
        })
        Object.values(p.perProduct).forEach((block) => {
            if (!summary.perProduct[block.product]) {
                summary.perProduct[block.product] = { loads: 0, orders: 0, product: block.product, yardage: 0 }
            }
            summary.perProduct[block.product].yardage += block.yardage
            summary.perProduct[block.product].loads += block.loads
            summary.perProduct[block.product].orders += block.orders
        })
        p.hourBuckets.forEach((b, i) => {
            summary.hourBuckets[i].loads += b.loads
            summary.hourBuckets[i].yardage += b.yardage
        })
    })
    // Snap accumulated totals to a single decimal place so float-summation
    // artifacts (e.g. 208.39999999999998) never reach the UI. Per-bucket
    // tallies are rounded too — they feed charts and scorecard tables.
    summary.totalYardage = snapTenth(summary.totalYardage)
    summary.totalLoads = snapTenth(summary.totalLoads)
    summary.totalOrders = snapTenth(summary.totalOrders)
    Object.values(summary.perPlant).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
        block.orderCount = snapTenth(block.orderCount)
    })
    Object.values(summary.perCustomer).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
        block.orders = snapTenth(block.orders)
    })
    Object.values(summary.perProduct).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
        block.orders = snapTenth(block.orders)
    })
    summary.hourBuckets.forEach((b) => {
        b.loads = snapTenth(b.loads)
        b.yardage = snapTenth(b.yardage)
    })
    summary.avgYardagePerActiveDay =
        summary.daysWithProduction > 0 ? Math.round(summary.totalYardage / summary.daysWithProduction) : 0
    summary.avgShiftSpanHours = shiftSpanCount > 0 ? Math.round((shiftSpanSum / shiftSpanCount) * 10) / 10 : null
    // Clamp the yards-per-load ratio at the fleet's physical truck capacity
    // (10 yd³). Real concrete trucks can't haul more, so any computed value
    // above that signals a yardage/loads mismatch upstream rather than a
    // real number. The clamp is a safety net — the per-plant fallback path
    // already keeps the inputs consistent.
    summary.yardagePerLoad =
        summary.totalLoads > 0
            ? Math.min(FLEET_MAX_LOAD_SIZE, Math.round((summary.totalYardage / summary.totalLoads) * 10) / 10)
            : null

    // Peak hour across the whole window.
    let peakLoads = 0
    summary.hourBuckets.forEach((b) => {
        if (b.loads > peakLoads || (b.loads === peakLoads && b.yardage > (summary.peakHour?.yardage || 0))) {
            peakLoads = b.loads
            summary.peakHour = b
        }
    })

    // Concentration — top customer / top plant share of yardage.
    const topCustomer = Object.values(summary.perCustomer).sort((a, b) => b.yardage - a.yardage)[0]
    if (topCustomer && summary.totalYardage > 0) {
        summary.topCustomerShare = {
            customer: topCustomer.customer,
            share: topCustomer.yardage / summary.totalYardage,
            yardage: topCustomer.yardage
        }
    }
    const topPlant = Object.values(summary.perPlant).sort((a, b) => b.yardage - a.yardage)[0]
    if (topPlant && summary.totalYardage > 0) {
        summary.topPlantShare = {
            code: topPlant.code,
            share: topPlant.yardage / summary.totalYardage,
            yardage: topPlant.yardage
        }
    }

    return summary
}

/**
 * Pad missing dates with zero-rows so the trend chart shows the full window.
 * Skips Sundays since plants are closed and we don't surface them anywhere
 * else on the page.
 *
 * Future dates are clamped to today — there's no schedule data past the
 * current day yet, so padding them as zero rows makes the chart look like
 * production fell off a cliff (and shows future days the user can't act
 * on). Clamping yields a chart that ends at "today" or, for past windows,
 * at the actual range end.
 */
export const padTrend = (start, end, sourceDays) => {
    const map = new Map(sourceDays.map((p) => [p.planDate, p]))
    const out = []
    const cursor = parseIsoLocal(start)
    const endDate = parseIsoLocal(end)
    if (!cursor || !endDate) return sourceDays
    /* "Today" anchored on Smyrna CST — keeps the chart from including
     * future days for a dispatcher whose local clock has already crossed
     * midnight while CST hasn't. */
    const today = parseIsoLocal(getTodayDate()) || new Date()
    today.setHours(0, 0, 0, 0)
    const effectiveEnd = endDate > today ? today : endDate
    if (cursor > effectiveEnd) return []
    while (cursor <= effectiveEnd) {
        if (cursor.getDay() !== 0) {
            const iso = isoDate(cursor)
            const row = map.get(iso)
            // Days without a saved plan render as null so the line chart
            // draws a gap there instead of dropping to 0 (which reads as
            // "we shut down that day"). Days that exist with zero yardage
            // still render as 0.
            out.push({
                planDate: iso,
                totalLoads: row ? row.totalLoads || 0 : null,
                totalYardage: row ? row.totalYardage || 0 : null
            })
        }
        cursor.setDate(cursor.getDate() + 1)
    }
    return out
}
