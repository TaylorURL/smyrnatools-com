// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

// ============================================================================
// Session-validated read endpoints for the `dispatch_data` table. Replaces
// the previous frontend pattern of hitting the table directly with the anon
// key, which exposed every parsed dispatch row (orders, customers, tickets,
// drivers, yardage) to anyone who could read the JS bundle.
//
// All endpoints require a valid `users_sessions` row (passed as either body
// fields `__sessionUserId` / `__sessionId` or headers `X-User-Id` /
// `X-Session-Id`, matching the pattern used by `list-service` and friends).
// Once authenticated, queries are issued against the service role so RLS
// can be locked down to deny anon entirely.
// ============================================================================

const DISPATCH_TABLE = 'dispatch_data'
const PAGE_SIZE = 1000
const PAGE_SAFETY_LIMIT = 200

const SCHEDULE_COLUMNS =
    'order_id, order_num, home_plant_code, customer, customer_num, job_number, address, city, contact, phone, ' +
    'po_number, product_code, product_description, start_time, rate, scheduled_yardage, load_size, truck_count, ' +
    'truck_class, sched_to_job_time, sched_to_plant_time'

const SCHEDULE_RANGE_COLUMNS = 'order_date, ' + SCHEDULE_COLUMNS

const TICKET_COLUMNS =
    'order_id, order_num, ticket_id, ticket_num, customer, home_plant_code, loaded_plant_code, truck_num, ' +
    'driver_num, driver_name, ticket_time, loaded_time, quantity, source_reports'

const TICKET_RANGE_COLUMNS = 'order_date, ' + TICKET_COLUMNS

const ORDER_META_COLUMNS = 'order_id, scheduled_yardage, load_size'
const ORDER_META_RANGE_COLUMNS = 'order_date, ' + ORDER_META_COLUMNS

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function getAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
}

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

/** Filters out a list of date strings to ones matching `YYYY-MM-DD`. */
function validIsoDates(input: unknown): string[] {
    if (!Array.isArray(input)) return []
    return input.filter((d): d is string => typeof d === 'string' && ISO_DATE.test(d))
}

/** Pages through a PostgREST query until a partial page comes back. The
 *  default `max-rows` cap (1000) silently truncates large windows, so any
 *  range query that could exceed that has to paginate. */
async function paginate(buildQuery: (from: number, to: number) => any): Promise<any[]> {
    const out: any[] = []
    let from = 0
    let safety = PAGE_SAFETY_LIMIT
    while (safety > 0) {
        const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
        if (error) throw error
        if (!Array.isArray(data) || data.length === 0) break
        out.push(...data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
        safety -= 1
    }
    return out
}

async function handleFetchSchedule(admin: any, body: any, headers: any): Promise<Response> {
    const date = body?.date
    if (!date || !ISO_DATE.test(date)) return jsonResponse({ rows: [] }, headers)
    const { data, error } = await admin
        .from(DISPATCH_TABLE)
        .select(SCHEDULE_COLUMNS)
        .eq('order_date', date)
        .eq('ticket_num', '')
    if (error) return errorResponse(error.message || 'Query failed', headers, 500)
    return jsonResponse({ rows: data ?? [] }, headers)
}

async function handleFetchPlanRowsByDateRange(admin: any, body: any, headers: any): Promise<Response> {
    const dates = validIsoDates(body?.dates)
    if (!dates.length) return jsonResponse({ rows: [] }, headers)
    try {
        const rows = await paginate((from, to) =>
            admin
                .from(DISPATCH_TABLE)
                .select(SCHEDULE_RANGE_COLUMNS)
                .in('order_date', dates)
                .eq('ticket_num', '')
                .order('order_date', { ascending: true })
                .order('order_id', { ascending: true })
                .range(from, to)
        )
        return jsonResponse({ rows }, headers)
    } catch (err: any) {
        return errorResponse(err?.message || 'Query failed', headers, 500)
    }
}

async function handleFetchDetailByOrderId(admin: any, body: any, headers: any): Promise<Response> {
    const date = body?.date
    if (!date || !ISO_DATE.test(date)) return jsonResponse({ tickets: [], orders: [] }, headers)
    const [ticketsRes, ordersRes] = await Promise.all([
        admin.from(DISPATCH_TABLE).select(TICKET_COLUMNS).eq('order_date', date).neq('ticket_num', ''),
        admin.from(DISPATCH_TABLE).select(ORDER_META_COLUMNS).eq('order_date', date).eq('ticket_num', '')
    ])
    if (ticketsRes.error) return errorResponse(ticketsRes.error.message || 'Query failed', headers, 500)
    if (ordersRes.error) return errorResponse(ordersRes.error.message || 'Query failed', headers, 500)
    return jsonResponse({ tickets: ticketsRes.data ?? [], orders: ordersRes.data ?? [] }, headers)
}

async function handleFetchDetailByDateRange(admin: any, body: any, headers: any): Promise<Response> {
    const dates = validIsoDates(body?.dates)
    if (!dates.length) return jsonResponse({ tickets: [], orders: [] }, headers)
    try {
        const [tickets, orders] = await Promise.all([
            paginate((from, to) =>
                admin
                    .from(DISPATCH_TABLE)
                    .select(TICKET_RANGE_COLUMNS)
                    .in('order_date', dates)
                    .neq('ticket_num', '')
                    .order('order_date', { ascending: true })
                    .order('ticket_id', { ascending: true })
                    .range(from, to)
            ),
            paginate((from, to) =>
                admin
                    .from(DISPATCH_TABLE)
                    .select(ORDER_META_RANGE_COLUMNS)
                    .in('order_date', dates)
                    .eq('ticket_num', '')
                    .order('order_date', { ascending: true })
                    .order('order_id', { ascending: true })
                    .range(from, to)
            )
        ])
        return jsonResponse({ tickets, orders }, headers)
    } catch (err: any) {
        return errorResponse(err?.message || 'Query failed', headers, 500)
    }
}

/**
 * Service-improvement summary — single Postgres round-trip via the
 * `service_improvement_summary` RPC (see the SQL block delivered with
 * v2026.23.8 for the function body). All aggregation runs server-side
 * on `dispatch_orders` + `dispatch_tickets` so a full-history scan is
 * effectively free at the edge layer.
 *
 * An order is classified "bad" when its first loaded ticket landed more
 * than `bad_lateness_min` (default 30) minutes after the scheduled start —
 * mirroring `BAD_LATE_MIN` from `src/utils/plan/planCustomerSat.ts`. The
 * slow-pace dimension is intentionally excluded to keep the SQL tractable;
 * lateness is the dominant `isBad` driver in the per-order classifier.
 */
async function handleServiceImprovement(admin: any, body: any, headers: any): Promise<Response> {
    const cutoff =
        typeof body?.cutoff === 'string' && ISO_DATE.test(body.cutoff) ? body.cutoff : '2026-05-01'
    const badLatenessMin = Number.isFinite(body?.badLatenessMin)
        ? Math.max(0, Math.floor(body.badLatenessMin))
        : 30
    const { data, error } = await admin.rpc('service_improvement_summary', {
        cutoff_date: cutoff,
        bad_lateness_min: badLatenessMin
    })
    if (error) return errorResponse(error.message || 'Query failed', headers, 500)

    type Window = { totalOrders: number; badOrders: number }
    const before: Window = { badOrders: 0, totalOrders: 0 }
    const after: Window = { badOrders: 0, totalOrders: 0 }
    for (const row of data ?? []) {
        const total = Number(row?.total_orders) || 0
        const bad = Number(row?.bad_orders) || 0
        if (row?.bucket === 'before') {
            before.totalOrders = total
            before.badOrders = bad
        } else if (row?.bucket === 'after') {
            after.totalOrders = total
            after.badOrders = bad
        }
    }
    const score = (w: Window) => (w.totalOrders > 0 ? (w.totalOrders - w.badOrders) / w.totalOrders : null)
    return jsonResponse(
        {
            after: { badOrders: after.badOrders, score: score(after), totalOrders: after.totalOrders },
            badLatenessMin,
            before: { badOrders: before.badOrders, score: score(before), totalOrders: before.totalOrders },
            cutoff
        },
        headers
    )
}

async function handleFetchLastUpdatedAt(admin: any, body: any, headers: any): Promise<Response> {
    const date = body?.date
    if (!date || !ISO_DATE.test(date)) return jsonResponse({ updatedAt: null }, headers)
    const { data, error } = await admin
        .from(DISPATCH_TABLE)
        .select('updated_at')
        .eq('order_date', date)
        .order('updated_at', { ascending: false })
        .limit(1)
    if (error) return errorResponse(error.message || 'Query failed', headers, 500)
    return jsonResponse({ updatedAt: data?.[0]?.updated_at ?? null }, headers)
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    try {
        const body = await parseBody(req)
        const auth = await requireAuthenticated(null, req, headers, body)
        if (auth instanceof Response) return auth

        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()
        const admin = getAdminClient()

        switch (endpoint) {
            case 'fetch-schedule':
                return await handleFetchSchedule(admin, body, headers)
            case 'fetch-plan-rows-by-date-range':
                return await handleFetchPlanRowsByDateRange(admin, body, headers)
            case 'fetch-detail-by-order-id':
                return await handleFetchDetailByOrderId(admin, body, headers)
            case 'fetch-detail-by-date-range':
                return await handleFetchDetailByDateRange(admin, body, headers)
            case 'fetch-last-updated-at':
                return await handleFetchLastUpdatedAt(admin, body, headers)
            case 'service-improvement':
                return await handleServiceImprovement(admin, body, headers)
            default:
                return errorResponse('Unknown endpoint', headers, 404)
        }
    } catch (err: any) {
        return errorResponse(err?.message || 'Unexpected error', headers, 500)
    }
})
