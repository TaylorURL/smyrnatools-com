import APIUtility from '../utils/APIUtility'
import { isExcludedOrder } from '../utils/PlanUtility'

const SERVICE_PREFIX = 'dispatch-data-service'

/**
 * Reads dispatch report data via the `dispatch-data-service` edge function.
 * The frontend never queries the `dispatch_data` table directly — anon RLS
 * is locked down so only the service role (used inside the edge function)
 * can read it. The HTML files in the `dispatch-reports` bucket are also
 * service-role-only; the `dispatch-import` edge function parses them and
 * upserts into `dispatch_data`.
 *
 * The shape returned by each method matches what the legacy bucket-parsing
 * hooks (useScheduleSync, useDetailOrders) returned, so existing OperationsView
 * consumers don't need to change.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Heuristic for "this ticket was voided in the dispatch system."
 *
 *  The dispatch report doesn't expose a `voided` flag we can read directly,
 *  so we infer it from the ticket's load lifecycle: the ticket was issued
 *  (a `ticket_time` was stamped when the row was generated) but no truck
 *  ever loaded against it (`loaded_time` is empty / null). Rows that match
 *  this pattern are dropped at the service layer so no consumer ever sees
 *  them. */
const isVoidedRow = (row) => {
    const ticketTime = (row?.ticket_time || '').trim()
    const loadedTime = (row?.loaded_time || '').trim()
    return ticketTime !== '' && loadedTime === ''
}

/** Posts to the dispatch-data-service edge function and returns its parsed
 *  JSON. Logs and returns `fallback` on any error so callers can keep their
 *  existing "empty result" behavior. */
const post = async (endpoint, payload, fallback) => {
    const { json, res } = await APIUtility.post(`/${SERVICE_PREFIX}/${endpoint}`, payload)
    if (!res.ok || json?.error) {
        console.warn(`[DispatchDataService.${endpoint}]`, json?.error || `status ${res.status}`)
        return fallback
    }
    return json
}

/** Builds the `{ [plantCode]: { firstJobTime, lastJobTime, orders, totalYardage } }`
 *  map shared by `fetchSchedule` and the per-date entries of `fetchPlanRowsByDateRange`.
 *
 *  `totalYardage` and `firstJobTime` are derived from REAL production rows
 *  only — cancelled (17:00) and test (18:00) sentinel orders stay in the
 *  `orders` array (the schedule UI still renders them) but never inflate
 *  the per-plant totals or anchor the day's first job. */
const groupOrderRowsByPlant = (rows) => {
    const byPlant = {}
    for (const row of rows || []) {
        const code = row.home_plant_code
        if (!code) continue
        if (!byPlant[code]) {
            byPlant[code] = { firstJobTime: '', lastJobTime: '', orders: [], totalYardage: 0 }
        }
        byPlant[code].orders.push({
            address: row.address || '',
            city: row.city || '',
            contact: row.contact || '',
            customer: row.customer || '',
            customerNum: row.customer_num || '',
            description: row.product_description || '',
            jobNumber: row.job_number || '',
            loadSize: row.load_size != null ? String(row.load_size) : '',
            orderId: row.order_id,
            orderNum: row.order_num || '',
            phone: row.phone || '',
            poNumber: row.po_number || '',
            productCode: row.product_code || '',
            rate: row.rate || '',
            startTime: row.start_time || '',
            tktTime: '',
            toJobTime: row.sched_to_job_time || '',
            toPlantTime: row.sched_to_plant_time || '',
            truckClass: row.truck_class || '',
            truckCount: row.truck_count != null ? String(row.truck_count) : '',
            yardage: row.scheduled_yardage != null ? String(row.scheduled_yardage) : ''
        })
    }

    for (const code of Object.keys(byPlant)) {
        const block = byPlant[code]
        const realOrders = block.orders.filter((o) => !isExcludedOrder(o))
        const totalYardage = realOrders.reduce((sum, o) => sum + (parseFloat(o.yardage) || 0), 0)
        const times = realOrders
            .map((o) => o.startTime)
            .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
            .map((t) => t.padStart(5, '0'))
            .sort()
        block.firstJobTime = times[0] || ''
        block.lastJobTime = times[times.length - 1] || ''
        block.totalYardage = totalYardage > 0 ? String(totalYardage) : ''
        block.orders.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
    }
    return byPlant
}

/** Build a `{ [orderId]: { scheduledYardage, loadSize } }` map keyed by the
 *  largest meaningful numeric value seen for each order. The dispatch HTML
 *  imports a per-plant-view row per order, so the same `order_id` shows up
 *  multiple times under different `home_plant_code`s — for cross-plant
 *  orders the loaded-plant variant often has `scheduled_yardage` / `load_size`
 *  null while the home-plant variant carries the real numbers. Without this
 *  max-merge, whichever row PostgREST returns last wins and we lose the
 *  scheduled yardage entirely. */
const collapseOrderMetaRows = (rows) => {
    const map = new Map()
    for (const o of rows || []) {
        if (!o?.order_id) continue
        const incoming = {
            loadSize: parseFloat(o.load_size) || 0,
            scheduledYardage: parseFloat(o.scheduled_yardage) || 0
        }
        const existing = map.get(o.order_id)
        if (!existing) {
            map.set(o.order_id, incoming)
            continue
        }
        map.set(o.order_id, {
            loadSize: Math.max(existing.loadSize, incoming.loadSize),
            scheduledYardage: Math.max(existing.scheduledYardage, incoming.scheduledYardage)
        })
    }
    return map
}

/** Max-merge two `Map<orderId, {scheduledYardage, loadSize}>` fallback
 *  maps into a single Map. Used by `fetchDetail…` to combine the
 *  dispatch_data-derived fallback (from `fetch-schedule` / `fetch-plan-rows-by-date-range`)
 *  with caller-supplied data (typically the curated `plans.plant_production`
 *  blob from `PlanService`). Either input may be `undefined`. */
const mergeScheduleFallbacks = (primary, secondary) => {
    const out = new Map(primary || [])
    if (secondary instanceof Map) {
        secondary.forEach((value, orderId) => {
            const existing = out.get(orderId)
            out.set(orderId, {
                loadSize: Math.max(existing?.loadSize || 0, value?.loadSize || 0),
                scheduledYardage: Math.max(existing?.scheduledYardage || 0, value?.scheduledYardage || 0)
            })
        })
    }
    return out
}

/** Folds raw ticket / order-meta rows into the
 *  `{ [orderId]: { tickets, byPlant, loadedYardage, ticketCount, … } }`
 *  shape both detail fetchers return. Applies the per-order DetailDriver
 *  estimate cap and the final per-ticket trim so per-row sums always match
 *  scheduled yardage.
 *
 *  When the database's `order_meta` row for an order is missing or has
 *  a null `scheduled_yardage` (typical for cross-plant orders whose home
 *  plant variant never made it into the meta query, OR whose dispatch HTML
 *  was parsed without a scheduled-yardage value), the optional
 *  `scheduleFallback` map (orderId → { scheduledYardage, loadSize }) is
 *  consulted before falling back to zero. This keeps the cross-plant
 *  DetailDriver-only allocator from collapsing every estimate ticket to
 *  `quantity = 0`, which would otherwise zero out the Schedule's Loaded
 *  column, the Statistics Plants page cross-load attribution, and any
 *  other downstream view that sums ticket quantities. */
const buildDetailByOrderId = (ticketRows, orderRows, scheduleFallback) => {
    const orderMeta = collapseOrderMetaRows(orderRows)
    const fallback = scheduleFallback instanceof Map ? scheduleFallback : null
    if (fallback) {
        fallback.forEach((value, orderId) => {
            const existing = orderMeta.get(orderId)
            const next = {
                loadSize: Math.max(existing?.loadSize || 0, value?.loadSize || 0),
                scheduledYardage: Math.max(existing?.scheduledYardage || 0, value?.scheduledYardage || 0)
            }
            if (next.scheduledYardage > 0 || next.loadSize > 0) {
                orderMeta.set(orderId, next)
            }
        })
    }

    const byOrderId = {}
    for (const row of ticketRows || []) {
        const orderId = row.order_id
        if (!orderId) continue
        if (isVoidedRow(row)) continue
        let order = byOrderId[orderId]
        if (!order) {
            order = byOrderId[orderId] = {
                byPlant: {},
                loadedYardage: 0,
                orderId,
                orderNum: row.order_num || '',
                ticketCount: 0,
                tickets: []
            }
        }
        const sourceList = Array.isArray(row.source_reports) ? row.source_reports : []
        const isEstimateOnly = sourceList.includes('DetailDriver') && !sourceList.includes('DetailOrderAnalysis')
        const plantId = row.loaded_plant_code || ''
        order.tickets.push({
            _confirmedQuantity: isEstimateOnly ? 0 : parseFloat(row.quantity) || 0,
            _isEstimateOnly: isEstimateOnly,
            customer: row.customer || '',
            driverName: row.driver_name || '',
            driverNum: row.driver_num || '',
            loadedTime: row.loaded_time || '',
            plantId,
            quantity: 0,
            sourceFilePlantId: plantId,
            sourceReport: isEstimateOnly ? 'DetailDriver' : sourceList[0] || '',
            ticketId: row.ticket_id || '',
            ticketNum: row.ticket_num,
            ticketTime: row.ticket_time || '',
            truckNum: row.truck_num || ''
        })
    }

    for (const order of Object.values(byOrderId)) {
        order.tickets.sort((a, b) => String(a.loadedTime || '').localeCompare(String(b.loadedTime || '')))
        const meta = orderMeta.get(order.orderId) || { loadSize: 0, scheduledYardage: 0 }
        const confirmedTotal = order.tickets.reduce((sum, t) => sum + t._confirmedQuantity, 0)
        let remaining = Math.max(0, meta.scheduledYardage - confirmedTotal)
        const estimateTickets = order.tickets.filter((t) => t._isEstimateOnly)

        // Cross-plant (DetailDriver-only) tickets don't carry a confirmed
        // quantity, so we estimate each at the order's `loadSize`. The
        // previous version stuffed the entire remaining order yardage into
        // the LAST estimate ticket to force the displayed total to equal
        // `scheduledYardage` — which broke ongoing pours: a 150 yd order
        // with 6 cross-plant trucks reported so far ended up with the
        // last truck showing 70 yd (impossible — trucks max out at
        // ~10 yd). For an in-flight order, missing yardage just means
        // missing trucks; we shouldn't fabricate over-capacity loads to
        // balance the sum.
        const perTruckCap = meta.loadSize > 0 ? meta.loadSize : null
        estimateTickets.forEach((t) => {
            if (remaining <= 0) {
                t.quantity = 0
                return
            }
            const allocation = perTruckCap != null ? Math.min(perTruckCap, remaining) : remaining
            t.quantity = allocation
            remaining -= allocation
        })

        for (const t of order.tickets) {
            if (!t._isEstimateOnly) t.quantity = t._confirmedQuantity
            delete t._confirmedQuantity
            delete t._isEstimateOnly
        }

        // Final-cap pass — trims per-ticket quantities from the last load
        // backward when the source HTML over-reports (e.g., 4 × 10 yd = 40
        // on a 36 yd order) so the displayed header total and per-row sum
        // always match scheduled.
        if (meta.scheduledYardage > 0) {
            const totalAfterFill = order.tickets.reduce((sum, t) => sum + (t.quantity || 0), 0)
            let excess = totalAfterFill - meta.scheduledYardage
            for (let i = order.tickets.length - 1; i >= 0 && excess > 0; i--) {
                const t = order.tickets[i]
                const reduce = Math.min(excess, t.quantity || 0)
                t.quantity = (t.quantity || 0) - reduce
                excess -= reduce
            }
        }

        for (const t of order.tickets) {
            order.ticketCount += 1
            order.loadedYardage += t.quantity
            if (t.plantId) {
                const entry =
                    order.byPlant[t.plantId] || (order.byPlant[t.plantId] = { loadedYardage: 0, ticketCount: 0 })
                entry.ticketCount += 1
                entry.loadedYardage += t.quantity
            }
        }
    }
    return byOrderId
}

class DispatchDataServiceImpl {
    /**
     * Returns the schedule for a date as `{ [plantCode]: { firstJobTime,
     * lastJobTime, orders[], totalYardage } }` — the same shape DailyOrderParser
     * used to produce.
     */
    async fetchSchedule(dateStr) {
        if (!dateStr || !ISO_DATE.test(dateStr)) return {}
        const { rows } = await post('fetch-schedule', { date: dateStr }, { rows: [] })
        return groupOrderRowsByPlant(rows)
    }

    /**
     * Range version of `fetchSchedule` shaped as plan rows for the Statistics
     * page. Returns `[{ plan_date, plant_production }]` with the same
     * `plant_production` shape `plans` rows carry — synthesized purely from
     * `dispatch_data` order-header rows so days the dispatcher never opened
     * in OperationsView (and therefore never saved a `plans` row for) still
     * contribute to yardage / order / customer / product / plant charts.
     */
    async fetchPlanRowsByDateRange(dateStrs) {
        const validDates = (dateStrs || []).filter((d) => ISO_DATE.test(d))
        if (!validDates.length) return []
        const { rows } = await post('fetch-plan-rows-by-date-range', { dates: validDates }, { rows: [] })

        const byDate = new Map()
        for (const row of rows || []) {
            const date = row.order_date
            if (!date) continue
            if (!byDate.has(date)) byDate.set(date, [])
            byDate.get(date).push(row)
        }

        return Array.from(byDate.entries())
            .map(([date, dateRows]) => ({ plan_date: date, plant_production: groupOrderRowsByPlant(dateRows) }))
            .sort((a, b) => a.plan_date.localeCompare(b.plan_date))
    }

    /**
     * Returns ticket-level data keyed by orderId, in the same shape useDetailOrders
     * has been returning: `{ [orderId]: { orderId, orderNum, byPlant, loadedYardage,
     * ticketCount, tickets[] } }`. Tickets are sorted by loadedTime.
     *
     * The schedule is fetched in parallel and folded in as a fallback for
     * the per-order allocator — cross-plant orders whose `dispatch_data`
     * order-meta row carries a null `scheduled_yardage` would otherwise
     * leave every DetailDriver-only ticket at `quantity = 0`.
     *
     * @param {string} dateStr - ISO `YYYY-MM-DD`.
     * @param {Map<string, {scheduledYardage:number, loadSize:number}>} [externalScheduleFallback]
     *   Optional map of orderId → schedule meta sourced from outside
     *   `dispatch_data` (typically the curated `plans.plant_production`
     *   blob). When provided, it's max-merged into the dispatch_data-derived
     *   fallback before the allocator runs — covers the case where BOTH
     *   the order-meta query AND the schedule query return null yardage.
     */
    async fetchDetailByOrderId(dateStr, externalScheduleFallback) {
        if (!dateStr || !ISO_DATE.test(dateStr)) return {}
        const [detail, scheduleRows] = await Promise.all([
            post('fetch-detail-by-order-id', { date: dateStr }, { orders: [], tickets: [] }),
            post('fetch-schedule', { date: dateStr }, { rows: [] }).then((res) => res?.rows || [])
        ])
        const fallback = mergeScheduleFallbacks(collapseOrderMetaRows(scheduleRows), externalScheduleFallback)
        return buildDetailByOrderId(detail?.tickets || [], detail?.orders || [], fallback)
    }

    /**
     * Range version of `fetchDetailByOrderId`: pulls every date in `dateStrs`
     * in one server-side paginated call. Returns
     * `{ [date]: { [orderId]: { tickets, byPlant, … } } }`. Schedule rows are
     * fetched in parallel (per the same fallback rationale as the single-date
     * variant) and split by `order_date` before the per-day fold.
     *
     * @param {string[]} dateStrs
     * @param {Map<string, Map<string, {scheduledYardage:number, loadSize:number}>>} [externalScheduleFallbackByDate]
     *   Optional map of date → (orderId → schedule meta), sourced from
     *   outside `dispatch_data`. The Statistics page passes the curated
     *   `plans.plant_production` data here so cross-plant orders with null
     *   `scheduled_yardage` in dispatch_data still get accurate ticket
     *   quantities.
     */
    async fetchDetailByDateRange(dateStrs, externalScheduleFallbackByDate) {
        const validDates = (dateStrs || []).filter((d) => ISO_DATE.test(d))
        if (!validDates.length) return {}
        const [detail, scheduleRowsByDate] = await Promise.all([
            post('fetch-detail-by-date-range', { dates: validDates }, { orders: [], tickets: [] }),
            post('fetch-plan-rows-by-date-range', { dates: validDates }, { rows: [] }).then((res) => res?.rows || [])
        ])
        const { tickets, orders } = detail || { orders: [], tickets: [] }

        const ticketsByDate = new Map()
        for (const row of tickets || []) {
            if (!row.order_date) continue
            if (!ticketsByDate.has(row.order_date)) ticketsByDate.set(row.order_date, [])
            ticketsByDate.get(row.order_date).push(row)
        }
        const ordersByDate = new Map()
        for (const row of orders || []) {
            if (!row.order_date) continue
            if (!ordersByDate.has(row.order_date)) ordersByDate.set(row.order_date, [])
            ordersByDate.get(row.order_date).push(row)
        }
        const scheduleByDate = new Map()
        for (const row of scheduleRowsByDate || []) {
            if (!row?.order_date) continue
            if (!scheduleByDate.has(row.order_date)) scheduleByDate.set(row.order_date, [])
            scheduleByDate.get(row.order_date).push(row)
        }

        const out = {}
        const seen = new Set([...ticketsByDate.keys(), ...ordersByDate.keys()])
        for (const date of seen) {
            const dispatchFallback = collapseOrderMetaRows(scheduleByDate.get(date) || [])
            const external = externalScheduleFallbackByDate?.get?.(date)
            out[date] = buildDetailByOrderId(
                ticketsByDate.get(date) || [],
                ordersByDate.get(date) || [],
                mergeScheduleFallbacks(dispatchFallback, external)
            )
        }

        // Ensure every requested date has a (possibly empty) entry so
        // callers can cache "nothing here" instead of re-fetching.
        for (const d of validDates) {
            if (!(d in out)) out[d] = {}
        }
        return out
    }

    /** Last-modified timestamp of any row for the date (max of updated_at). */
    async fetchLastUpdatedAt(dateStr) {
        if (!dateStr || !ISO_DATE.test(dateStr)) return null
        const { updatedAt } = await post('fetch-last-updated-at', { date: dateStr }, { updatedAt: null })
        return updatedAt ? new Date(updatedAt) : null
    }

    /**
     * Pre-vs-post-cutoff service-quality aggregate covering every order +
     * ticket in `dispatch_data`. Server-side does the iteration and returns
     * `{ before: {totalOrders, badOrders, score, firstDate, lastDate},
     *   after: {...}, cutoff, badLatenessMin }`. `score` is null when the
     * window has no scoreable orders. Used by `useServiceImprovement` on
     * the Statistics > Overview and Statistics > Service pages.
     *
     * @param {string} [cutoff] ISO date (`YYYY-MM-DD`) — orders on or after
     *   this date land in the `after` bucket. Defaults server-side to
     *   `2026-05-01`.
     */
    async fetchServiceImprovement(cutoff) {
        const body = cutoff && ISO_DATE.test(cutoff) ? { cutoff } : {}
        return post('service-improvement', body, {
            after: { badOrders: 0, score: null, totalOrders: 0 },
            badLatenessMin: 30,
            before: { badOrders: 0, score: null, totalOrders: 0 },
            cutoff: '2026-05-01'
        })
    }
}

export const DispatchDataService = new DispatchDataServiceImpl()
