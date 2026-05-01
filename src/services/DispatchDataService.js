import { Database } from './DatabaseService'

/**
 * Reads dispatch report data from the `dispatch_data` table — populated by
 * the `dispatch-import` edge function from bucket HTML files.
 *
 * The shape returned by each method matches what the legacy bucket-parsing
 * hooks (useScheduleSync, useDetailOrders) returned, so existing PlanView
 * consumers don't need to change. The site never reads bucket HTML
 * directly anymore.
 */
/**
 * PostgREST / Supabase enforces a server-side `max-rows` cap (1000 by
 * default). `.range(0, 49999)` doesn't override that — the response is
 * silently truncated, and on the Statistics page that meant a Month-window
 * fetch returned only the first ~13 days of data while a Week-window fetch
 * returned everything (because the smaller window stayed under the cap).
 *
 * `paginate(buildQuery)` runs the query in `PAGE_SIZE`-row pages until a
 * partial page comes back, concatenates the data, and returns the whole
 * row set. The caller passes a builder that takes a (from, to) pair so we
 * can re-attach the same `.in / .eq / .order` filters on every page.
 *
 * Stable ordering is required for correct pagination — the second page's
 * "rows 1000–1999" must follow the first page's "rows 0–999" in the same
 * sort order, otherwise pages overlap or skip rows.
 */
const PAGE_SIZE = 1000
const paginate = async (buildQuery) => {
    const out = []
    let from = 0
    // Hard upper bound — guards against an infinite loop if the server ever
    // returns a full page repeatedly. 200 pages × 1000 rows = 200k rows,
    // well past anything Statistics needs.
    let safety = 200
    while (safety > 0) {
        const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
        if (error) {
            console.warn('[DispatchDataService.paginate]', error)
            break
        }
        if (!Array.isArray(data) || data.length === 0) break
        out.push(...data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
        safety -= 1
    }
    return out
}

class DispatchDataServiceImpl {
    /**
     * Returns the schedule for a date as `{ [plantCode]: { firstJobTime,
     * lastJobTime, orders[], totalYardage } }` — the same shape DailyOrderParser
     * used to produce.
     */
    async fetchSchedule(dateStr) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return {}
        const { data, error } = await Database.from('dispatch_data')
            .select(
                'order_id, order_num, home_plant_code, customer, customer_num, job_number, address, city, contact, phone, po_number, product_code, product_description, start_time, rate, scheduled_yardage, load_size, truck_count, truck_class, sched_to_job_time, sched_to_plant_time'
            )
            .eq('order_date', dateStr)
            .eq('ticket_num', '')
        if (error) {
            console.warn('[DispatchDataService.fetchSchedule]', error)
            return {}
        }

        const byPlant = {}
        for (const row of data || []) {
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
            byPlant[code].totalYardage += parseFloat(row.scheduled_yardage) || 0
        }

        for (const code of Object.keys(byPlant)) {
            const times = byPlant[code].orders
                .map((o) => o.startTime)
                .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
                .map((t) => t.padStart(5, '0'))
                .sort()
            byPlant[code].firstJobTime = times[0] || ''
            byPlant[code].lastJobTime = times[times.length - 1] || ''
            byPlant[code].totalYardage = byPlant[code].totalYardage > 0 ? String(byPlant[code].totalYardage) : ''
            byPlant[code].orders.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
        }
        return byPlant
    }

    /**
     * Range version of `fetchSchedule` shaped as plan rows for the Statistics
     * page. Returns `[{ plan_date, plant_production }]` with the same
     * `plant_production` shape `plans` rows carry — synthesized purely from
     * `dispatch_data` order-header rows so days the dispatcher never opened
     * in PlanView (and therefore never saved a `plans` row for) still
     * contribute to yardage / order / customer / product / plant charts.
     *
     * Date chunking matches `fetchDetailByDateRange` so a year window stays
     * under Postgres' IN-clause limit and Supabase's row cap.
     */
    async fetchPlanRowsByDateRange(dateStrs) {
        const validDates = (dateStrs || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        if (!validDates.length) return []
        const CHUNK = 30
        const chunks = []
        for (let i = 0; i < validDates.length; i += CHUNK) {
            chunks.push(validDates.slice(i, i + CHUNK))
        }
        const orderRows = []
        await Promise.all(
            chunks.map(async (chunk) => {
                // Paginate so a chunk with > 1000 orders (a full month
                // typically lands at 1500-3000 rows) actually returns all
                // of its rows instead of being silently capped at the
                // PostgREST max-rows default.
                const rows = await paginate((from, to) =>
                    Database.from('dispatch_data')
                        .select(
                            'order_date, order_id, order_num, home_plant_code, customer, customer_num, job_number, address, city, contact, phone, po_number, product_code, product_description, start_time, rate, scheduled_yardage, load_size, truck_count, truck_class, sched_to_job_time, sched_to_plant_time'
                        )
                        .in('order_date', chunk)
                        .eq('ticket_num', '')
                        .order('order_date', { ascending: true })
                        .order('order_id', { ascending: true })
                        .range(from, to)
                )
                orderRows.push(...rows)
            })
        )

        // Group by date → plant code → orders[], mirroring `fetchSchedule`.
        const byDate = new Map()
        for (const row of orderRows) {
            const date = row.order_date
            const plantCode = row.home_plant_code
            if (!date || !plantCode) continue
            if (!byDate.has(date)) byDate.set(date, {})
            const plantBlocks = byDate.get(date)
            if (!plantBlocks[plantCode]) {
                plantBlocks[plantCode] = { firstJobTime: '', lastJobTime: '', orders: [], totalYardage: 0 }
            }
            plantBlocks[plantCode].orders.push({
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
            plantBlocks[plantCode].totalYardage += parseFloat(row.scheduled_yardage) || 0
        }

        // Snap per-plant fields the same way `fetchSchedule` does so the
        // synthesized blocks behave identically downstream.
        for (const plantBlocks of byDate.values()) {
            for (const code of Object.keys(plantBlocks)) {
                const block = plantBlocks[code]
                const times = block.orders
                    .map((o) => o.startTime)
                    .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
                    .map((t) => t.padStart(5, '0'))
                    .sort()
                block.firstJobTime = times[0] || ''
                block.lastJobTime = times[times.length - 1] || ''
                block.totalYardage = block.totalYardage > 0 ? String(block.totalYardage) : ''
                block.orders.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
            }
        }

        return Array.from(byDate.entries())
            .map(([date, plantBlocks]) => ({ plan_date: date, plant_production: plantBlocks }))
            .sort((a, b) => a.plan_date.localeCompare(b.plan_date))
    }

    /**
     * Returns ticket-level data keyed by orderId, in the same shape useDetailOrders
     * has been returning: `{ [orderId]: { orderId, orderNum, byPlant, loadedYardage,
     * ticketCount, tickets[] } }`. Tickets are sorted by loadedTime.
     */
    async fetchDetailByOrderId(dateStr) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return {}
        const [ticketsRes, ordersRes] = await Promise.all([
            Database.from('dispatch_data')
                .select(
                    'order_id, order_num, ticket_id, ticket_num, customer, home_plant_code, loaded_plant_code, truck_num, driver_num, driver_name, ticket_time, loaded_time, quantity, source_reports'
                )
                .eq('order_date', dateStr)
                .neq('ticket_num', ''),
            Database.from('dispatch_data')
                .select('order_id, scheduled_yardage, load_size')
                .eq('order_date', dateStr)
                .eq('ticket_num', '')
        ])
        if (ticketsRes.error) {
            console.warn('[DispatchDataService.fetchDetailByOrderId]', ticketsRes.error)
            return {}
        }

        const orderMeta = new Map()
        for (const o of ordersRes.data || []) {
            if (!o.order_id) continue
            orderMeta.set(o.order_id, {
                loadSize: parseFloat(o.load_size) || 0,
                scheduledYardage: parseFloat(o.scheduled_yardage) || 0
            })
        }

        const byOrderId = {}
        for (const row of ticketsRes.data || []) {
            const orderId = row.order_id
            if (!orderId) continue
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

        // Apply per-order capping for DetailDriver-only tickets so estimated
        // yardage never pushes the order over its scheduled total. The last
        // estimate-only ticket absorbs whatever remainder is left, matching
        // dispatch reality where most loads are full and the final partial.
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

    /**
     * Range version of `fetchDetailByOrderId`: pulls every date in `dateStrs`
     * with chunked `.in('order_date', …)` queries instead of one round-trip
     * per date. Returns `{ [date]: { [orderId]: { tickets, byPlant, … } } }`.
     *
     * Reuses the per-order capping logic from `fetchDetailByOrderId` so the
     * shape is identical to that method's output, just keyed by date.
     *
     * Date chunking keeps each query well under Postgres' IN-clause limit
     * and Supabase's row cap. For a year-long window (~313 dates) this
     * produces ~11 queries instead of 313.
     */
    async fetchDetailByDateRange(dateStrs) {
        const validDates = (dateStrs || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        if (!validDates.length) return {}
        const CHUNK = 30
        const chunks = []
        for (let i = 0; i < validDates.length; i += CHUNK) {
            chunks.push(validDates.slice(i, i + CHUNK))
        }

        const ticketsRows = []
        const orderRows = []
        // Both subqueries paginate — a busy month easily exceeds the 1000-
        // row cap for either tickets or order headers, and we need every
        // row for satisfaction scoring + per-order ticket capping to
        // line up with the schedule view.
        const queries = chunks.map(async (chunk) => {
            const [tickets, orders] = await Promise.all([
                paginate((from, to) =>
                    Database.from('dispatch_data')
                        .select(
                            'order_date, order_id, order_num, ticket_id, ticket_num, customer, home_plant_code, loaded_plant_code, truck_num, driver_num, driver_name, ticket_time, loaded_time, quantity, source_reports'
                        )
                        .in('order_date', chunk)
                        .neq('ticket_num', '')
                        .order('order_date', { ascending: true })
                        .order('ticket_id', { ascending: true })
                        .range(from, to)
                ),
                paginate((from, to) =>
                    Database.from('dispatch_data')
                        .select('order_date, order_id, scheduled_yardage, load_size')
                        .in('order_date', chunk)
                        .eq('ticket_num', '')
                        .order('order_date', { ascending: true })
                        .order('order_id', { ascending: true })
                        .range(from, to)
                )
            ])
            ticketsRows.push(...tickets)
            orderRows.push(...orders)
        })
        await Promise.all(queries)

        // Group order metadata by (date, orderId) so the per-order cap
        // pass below knows the scheduled total + load size for each row.
        const orderMetaByKey = new Map()
        for (const o of orderRows) {
            if (!o.order_id || !o.order_date) continue
            orderMetaByKey.set(`${o.order_date}|${o.order_id}`, {
                loadSize: parseFloat(o.load_size) || 0,
                scheduledYardage: parseFloat(o.scheduled_yardage) || 0
            })
        }

        const out = {}
        for (const row of ticketsRows) {
            const date = row.order_date
            const orderId = row.order_id
            if (!date || !orderId) continue
            if (!out[date]) out[date] = {}
            let order = out[date][orderId]
            if (!order) {
                order = out[date][orderId] = {
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

        // Mirror fetchDetailByOrderId's per-order cap pass so consumers see
        // the same `quantity` semantics regardless of which fetch they used.
        for (const date of Object.keys(out)) {
            for (const order of Object.values(out[date])) {
                order.tickets.sort((a, b) => String(a.loadedTime || '').localeCompare(String(b.loadedTime || '')))
                const meta = orderMetaByKey.get(`${date}|${order.orderId}`) || { loadSize: 0, scheduledYardage: 0 }
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
                    order.ticketCount += 1
                    order.loadedYardage += t.quantity
                    if (t.plantId) {
                        const entry =
                            order.byPlant[t.plantId] ||
                            (order.byPlant[t.plantId] = { loadedYardage: 0, ticketCount: 0 })
                        entry.ticketCount += 1
                        entry.loadedYardage += t.quantity
                    }
                }
            }
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
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
        const { data, error } = await Database.from('dispatch_data')
            .select('updated_at')
            .eq('order_date', dateStr)
            .order('updated_at', { ascending: false })
            .limit(1)
        if (error || !data || !data[0]) return null
        return new Date(data[0].updated_at)
    }
}

export const DispatchDataService = new DispatchDataServiceImpl()
