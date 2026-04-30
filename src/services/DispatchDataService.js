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
