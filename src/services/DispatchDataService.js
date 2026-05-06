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
 * hooks (useScheduleSync, useDetailOrders) returned, so existing PlanView
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

/** Folds raw ticket / order-meta rows into the
 *  `{ [orderId]: { tickets, byPlant, loadedYardage, ticketCount, … } }`
 *  shape both detail fetchers return. Applies the per-order DetailDriver
 *  estimate cap and the final per-ticket trim so per-row sums always match
 *  scheduled yardage. */
const buildDetailByOrderId = (ticketRows, orderRows) => {
    const orderMeta = new Map()
    for (const o of orderRows || []) {
        if (!o.order_id) continue
        orderMeta.set(o.order_id, {
            loadSize: parseFloat(o.load_size) || 0,
            scheduledYardage: parseFloat(o.scheduled_yardage) || 0
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
        const lastIdx = estimateTickets.length - 1

        estimateTickets.forEach((t, i) => {
            if (remaining <= 0) {
                t.quantity = 0
            } else if (i === lastIdx) {
                t.quantity = remaining
                remaining = 0
            } else if (meta.loadSize > 0 && remaining >= meta.loadSize) {
                t.quantity = meta.loadSize
                remaining -= meta.loadSize
            } else {
                t.quantity = remaining
                remaining = 0
            }
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
     * in PlanView (and therefore never saved a `plans` row for) still
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
     */
    async fetchDetailByOrderId(dateStr) {
        if (!dateStr || !ISO_DATE.test(dateStr)) return {}
        const { tickets, orders } = await post(
            'fetch-detail-by-order-id',
            { date: dateStr },
            { tickets: [], orders: [] }
        )
        return buildDetailByOrderId(tickets, orders)
    }

    /**
     * Range version of `fetchDetailByOrderId`: pulls every date in `dateStrs`
     * in one server-side paginated call. Returns
     * `{ [date]: { [orderId]: { tickets, byPlant, … } } }`.
     */
    async fetchDetailByDateRange(dateStrs) {
        const validDates = (dateStrs || []).filter((d) => ISO_DATE.test(d))
        if (!validDates.length) return {}
        const { tickets, orders } = await post(
            'fetch-detail-by-date-range',
            { dates: validDates },
            { tickets: [], orders: [] }
        )

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

        const out = {}
        const seen = new Set([...ticketsByDate.keys(), ...ordersByDate.keys()])
        for (const date of seen) {
            out[date] = buildDetailByOrderId(ticketsByDate.get(date) || [], ordersByDate.get(date) || [])
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
}

export const DispatchDataService = new DispatchDataServiceImpl()
