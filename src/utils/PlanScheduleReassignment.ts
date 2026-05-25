// Plan Schedule — loading-plant reassignment + plant-production flatten +
// schedule headline-stat snapshotter. All operate on the `plantProduction`
// blob shape produced by the planner.

import { clean, sumField } from './PlanScheduleFormat'
import { getOrderStatus } from './PlanScheduleOrder'
import {
    formatMinutesClock,
    getCalculatedTruckCount,
    isExcludedOrder,
    PLAN_META_KEY,
    timeToMinutes
} from './PlanUtility'

/** Plant codes that never inherit a reassigned order — these are special
 *  yards (404 lab/QC, 409 satellite) where loading from them doesn't imply
 *  the job actually belongs to them. */
const REASSIGNMENT_EXCLUDED_PLANTS = new Set(['404', '409'])
/** Floating-point slack when comparing loaded vs scheduled yardage. */
const REASSIGNMENT_YARDAGE_TOLERANCE = 0.01

/** Recompute the per-plant header values (`firstJobTime`, `lastJobTime`,
 *  `totalYardage`) after the order list changes. Mirrors the math in
 *  `groupOrderRowsByPlant` so reassigned blocks stay consistent. */
const recomputePlantBlockTotals = (orders) => {
    const realOrders = orders.filter((o) => !isExcludedOrder(o))
    const totalYardage = realOrders.reduce((sum, o) => sum + (parseFloat(o.yardage) || 0), 0)
    const times = realOrders
        .map((o) => o.startTime)
        .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
        .map((t) => t.padStart(5, '0'))
        .sort()
    return {
        firstJobTime: times[0] || '',
        lastJobTime: times[times.length - 1] || '',
        totalYardage: totalYardage > 0 ? String(totalYardage) : ''
    }
}

/** When an order is fully loaded by a single plant other than its assigned
 *  one (and that plant isn't on the excluded list), return that plant code.
 *  Otherwise null. */
const computeReassignmentTarget = (order, currentPlant, detailByOrderId) => {
    const orderId = order?.orderId
    if (!orderId) return null
    const detail = detailByOrderId[orderId]
    if (!detail) return null
    const scheduled = parseFloat(order.yardage) || 0
    if (scheduled <= 0) return null
    if ((detail.loadedYardage || 0) + REASSIGNMENT_YARDAGE_TOLERANCE < scheduled) return null

    const loadingPlants = Object.keys(detail.byPlant || {}).filter(
        (plant) => (detail.byPlant[plant]?.ticketCount || 0) > 0
    )
    if (loadingPlants.length !== 1) return null
    const target = loadingPlants[0]
    if (!target || target === currentPlant) return null
    if (REASSIGNMENT_EXCLUDED_PLANTS.has(target)) return null
    return target
}

/**
 * Move fully-loaded orders to the plant that actually loaded them. Only
 * fires when every ticket came from a single non-excluded plant other than
 * the order's currently-assigned plant — the schedule then visually
 * attributes the order to the plant doing the work.
 *
 * Returns the same `plantProduction` reference when nothing qualifies, so
 * downstream memos keep their referential equality.
 *
 * @param {Object} plantProduction - Original `{ [plantCode]: { orders, … } }`.
 * @param {Object} detailByOrderId - Ticket detail by order id (provides `byPlant`
 *   and `loadedYardage`).
 * @returns {Object} Reassigned `plantProduction`, or the original when no-op.
 */
export const applyLoadingPlantReassignment = (plantProduction, detailByOrderId) => {
    if (!plantProduction || !detailByOrderId) return plantProduction

    const moves = []
    Object.entries(plantProduction).forEach(([code, data]) => {
        if (code === PLAN_META_KEY) return
        if (!Array.isArray(data?.orders)) return
        data.orders.forEach((order) => {
            const target = computeReassignmentTarget(order, code, detailByOrderId)
            if (target) moves.push({ fromPlant: code, order, toPlant: target })
        })
    })
    if (moves.length === 0) return plantProduction

    const changeByPlant = new Map()
    const ensureChange = (plant) => {
        if (!changeByPlant.has(plant)) changeByPlant.set(plant, { add: [], remove: new Set() })
        return changeByPlant.get(plant)
    }
    moves.forEach(({ fromPlant, order, toPlant }) => {
        ensureChange(fromPlant).remove.add(order.orderId)
        ensureChange(toPlant).add.push(order)
    })

    const next = { ...plantProduction }
    changeByPlant.forEach((change, plant) => {
        const existing = next[plant] || { firstJobTime: '', lastJobTime: '', orders: [], totalYardage: '' }
        const orders = (existing.orders || [])
            .filter((o) => !change.remove.has(o.orderId))
            .concat(change.add)
            .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
        next[plant] = { ...existing, orders, ...recomputePlantBlockTotals(orders) }
    })
    return next
}

/* ── Schedule headline-stat snapshotter ────────────────────────────
 * Mirrors the aggregates surfaced by `usePlanScheduleData` (orders,
 * plants, customers, yardage, trucks, window) but runs against any
 * `plant_production` blob — used by the schedule snapshot compare flow
 * to derive baseline numbers for the 5:30 PM snapshot so the stat strip
 * can render delta % against the live values. Filters honored match
 * `usePlanScheduleData.filtered` exactly so the comparison is
 * apples-to-apples.
 */
const flattenPlantProductionOrders = (plantProduction) => {
    if (!plantProduction || typeof plantProduction !== 'object') return []
    const out = []
    Object.entries(plantProduction).forEach(([code, data]) => {
        if (code === PLAN_META_KEY) return
        if (!Array.isArray(data?.orders)) return
        data.orders.forEach((order) => out.push({ ...order, plantCode: order?.plantCode || code }))
    })
    return out
}

export const computeScheduleHeadlineMetrics = (plantProduction, filters = {}, isViewingToday = false) => {
    const {
        minYards = 0,
        plantFilterSet,
        productFilter = 'all',
        query = '',
        showCancelled = false,
        showTest = false,
        statusFilter = 'all'
    } = filters
    const q = String(query || '')
        .trim()
        .toLowerCase()
    const minYd = parseFloat(minYards) || 0
    const all = flattenPlantProductionOrders(plantProduction)
    const filtered = all.filter((o) => {
        if (plantFilterSet?.size > 0 && !plantFilterSet.has(o.plantCode)) return false
        const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind || 'scheduled'
        if (kind === 'cancelled' && !showCancelled) return false
        if (kind === 'test' && !showTest) return false
        if (statusFilter && statusFilter !== 'all' && kind !== statusFilter) return false
        if (productFilter && productFilter !== 'all' && clean(o.productCode) !== productFilter) return false
        if (minYd > 0 && (parseFloat(o.yardage) || 0) < minYd) return false
        if (q) {
            const haystack = [
                o.orderNum,
                o.customer,
                o.customerNum,
                o.address,
                o.city,
                o.productCode,
                o.description,
                o.contact,
                o.phone,
                o.poNumber,
                o.jobNumber,
                o.plantCode
            ]
                .filter(Boolean)
                .map((v) => String(v).toLowerCase())
                .join(' | ')
            if (!haystack.includes(q)) return false
        }
        return true
    })
    /* "live orders" mirror — same filter the stat strip uses (cancelled
     * + test sentinel orders are excluded from the totals even though
     * the schedule still renders them when those toggles are on). */
    const liveOrders = filtered.filter((o) => {
        const kind = getOrderStatus(o.startTime)?.kind
        return kind !== 'cancelled' && kind !== 'test'
    })
    const yardage = sumField(liveOrders, 'yardage')
    const trucks = liveOrders.reduce((sum, o) => {
        const n = getCalculatedTruckCount(o)
        return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
    const plants = new Set(liveOrders.map((o) => o.plantCode)).size
    const customers = new Set(liveOrders.map((o) => (clean(o.customer) || '').toLowerCase()).filter(Boolean)).size
    const startMinutes = liveOrders.map((o) => timeToMinutes(o.startTime)).filter((t) => t != null)
    const earliest = startMinutes.length ? Math.min(...startMinutes) : null
    const latest = startMinutes.length ? Math.max(...startMinutes) : null
    return {
        customers,
        earliestTime: earliest != null ? formatMinutesClock(earliest) : null,
        latestTime: latest != null ? formatMinutesClock(latest) : null,
        orders: liveOrders.length,
        plants,
        trucks,
        yardage
    }
}
