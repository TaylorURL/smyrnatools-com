import { isSundayIso } from './PlanStatisticsUtility'
import { isExcludedOrder, PLAN_META_KEY } from './PlanUtility'

/** Build a `{ [orderId]: order }` lookup across every plant block in a
 *  plant_production blob. Used by the order-level merger so we can
 *  reconcile the same order across plans + dispatch sources. */
export function indexOrdersByOrderId(production) {
    const out = new Map()
    if (!production || typeof production !== 'object') return out
    Object.values(production).forEach((block) => {
        if (!block || typeof block !== 'object') return
        const orders = Array.isArray(block.orders) ? block.orders : []
        orders.forEach((o) => {
            if (!o?.orderId) return
            const existing = out.get(o.orderId)
            // If two plant blocks claim the same order, keep the one whose
            // yardage is non-zero so the later max-merge picks the truthful
            // copy. Otherwise first one wins.
            if (!existing || (parseFloat(existing?.yardage) || 0) <= 0) {
                out.set(o.orderId, o)
            }
        })
    })
    return out
}

/**
 * Merges curated `plans` rows with imported `dispatch_data` rows at the
 * **order level** (not just the day level). For each `plan_date`:
 *   1. Start from the dispatch_data plant_production blob (covers every
 *      imported order, even ones the dispatcher never touched in plans).
 *   2. For each order present in the plans copy, overlay its yardage and
 *      loadSize when the plans value is higher than dispatch's — the
 *      dispatcher's curated yardage is the truthful source whenever
 *      dispatch_data's `scheduled_yardage` arrived null (typical for
 *      cross-plant order headers in the dispatch HTML import).
 *
 * Day-level fallback is preserved: if dispatch has no row for a date, the
 * plans row is used as-is; if plans has no row, dispatch is used as-is.
 *
 * The resulting array preserves the `{ plan_date, plant_production, … }`
 * shape every downstream consumer expects, sorted ascending by `plan_date`.
 */
export function mergePlanAndDispatchRows(plansRows, dispatchRows) {
    const plansByDate = new Map()
    ;(plansRows || []).forEach((row) => {
        if (row?.plan_date) plansByDate.set(row.plan_date, row)
    })
    const dispatchByDate = new Map()
    ;(dispatchRows || []).forEach((row) => {
        if (row?.plan_date) dispatchByDate.set(row.plan_date, row)
    })
    const allDates = new Set([...plansByDate.keys(), ...dispatchByDate.keys()])
    const out = []
    allDates.forEach((date) => {
        const planRow = plansByDate.get(date)
        const dispatchRow = dispatchByDate.get(date)
        const planProduction =
            planRow?.plant_production && typeof planRow.plant_production === 'object' ? planRow.plant_production : null
        const dispatchProduction =
            dispatchRow?.plant_production && typeof dispatchRow.plant_production === 'object'
                ? dispatchRow.plant_production
                : null
        if (!planProduction && !dispatchProduction) return
        if (!planProduction) {
            out.push(dispatchRow)
            return
        }
        if (!dispatchProduction) {
            out.push(planRow)
            return
        }
        const planIndex = indexOrdersByOrderId(planProduction)
        const merged = {}
        // Start with dispatch's per-plant blocks; preserve the imported
        // metadata (firstJobTime, lastJobTime, totalYardage, etc.).
        Object.entries(dispatchProduction).forEach(([code, block]) => {
            if (!block || typeof block !== 'object') return
            const baseOrders = Array.isArray(block.orders) ? block.orders : []
            const upgradedOrders = baseOrders.map((o) => {
                if (!o?.orderId) return o
                const planOrder = planIndex.get(o.orderId)
                if (!planOrder) return o
                const dispatchYards = parseFloat(o.yardage) || 0
                const planYards = parseFloat(planOrder.yardage) || 0
                const dispatchLoad = parseFloat(o.loadSize) || 0
                const planLoad = parseFloat(planOrder.loadSize) || 0
                if (planYards <= dispatchYards && planLoad <= dispatchLoad) return o
                return {
                    ...o,
                    loadSize: planLoad > dispatchLoad ? String(planLoad) : o.loadSize != null ? String(o.loadSize) : '',
                    yardage: planYards > dispatchYards ? String(planYards) : o.yardage != null ? String(o.yardage) : ''
                }
            })
            merged[code] = { ...block, orders: upgradedOrders }
        })
        // Add orders that plans knows about but dispatch doesn't (rare —
        // would mean the dispatcher booked something never imported).
        const dispatchOrderIds = new Set()
        Object.values(dispatchProduction).forEach((block) => {
            ;(block?.orders || []).forEach((o) => {
                if (o?.orderId) dispatchOrderIds.add(o.orderId)
            })
        })
        Object.entries(planProduction).forEach(([code, block]) => {
            if (!block || typeof block !== 'object') return
            const extras = (block.orders || []).filter((o) => o?.orderId && !dispatchOrderIds.has(o.orderId))
            if (extras.length === 0) return
            if (!merged[code]) {
                merged[code] = { ...block, orders: extras }
            } else {
                merged[code] = { ...merged[code], orders: [...merged[code].orders, ...extras] }
            }
        })
        // Take the plans row as the base envelope (keeps assignments / notes
        // for downstream consumers that need them), then swap in our merged
        // plant_production.
        out.push({ ...(planRow || dispatchRow), plan_date: date, plant_production: merged })
    })
    return out.sort((a, b) => String(a.plan_date).localeCompare(String(b.plan_date)))
}

/**
 * Walk every plan row once, emitting a flat `{ planDate, plantCode, order }`
 * record for each live order. Used to build per-plant order buckets without
 * re-running `computeScheduleMetrics` for every (row, plant) pair — the
 * old approach was O(days × plants × orders) and crashed the page on big
 * windows. This pass is O(days × orders).
 */
export function flattenLiveOrders(rows) {
    const out = []
    if (!Array.isArray(rows)) return out
    rows.forEach((row) => {
        const date = row?.plan_date
        if (!date || isSundayIso(date)) return
        const production = row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
        Object.entries(production).forEach(([plantCode, block]) => {
            if (plantCode === PLAN_META_KEY) return
            const orders = Array.isArray(block?.orders) ? block.orders : []
            orders.forEach((o) => {
                if (isExcludedOrder(o)) return
                out.push({ order: o, planDate: date, plantCode })
            })
        })
    })
    return out
}
