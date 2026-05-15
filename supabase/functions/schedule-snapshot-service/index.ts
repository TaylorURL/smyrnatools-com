// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { isInternalServiceCall } from '../_shared/internalAuth.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

// ============================================================================
// Daily schedule snapshot service.
//
// `capture` is fired by pg_cron twice a day (22:30 + 23:30 UTC); whichever
// hits 17:30 Chicago wins, the other is a no-op. Captures tomorrow's
// schedule into `plan_schedule_snapshots` so the next day the Schedule tab
// can diff live data against the 5:30 PM baseline (added orders, moved
// times, changed spacing / address, etc.).
//
// `get-by-date` is the frontend reader — returns the snapshot for a single
// schedule date or null when none was taken (e.g., the Sunday skip).
// ============================================================================

const SNAPSHOT_TABLE = 'plan_schedule_snapshots'
const DISPATCH_TABLE = 'dispatch_data'
const PLAN_TIME_ZONE = 'America/Chicago'
const SNAPSHOT_HOUR_CT = 17

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

/** Returns the wall-clock `{ year, month, day, hour, weekday }` in the given
 *  IANA time zone. Weekday matches `Date.getDay()` semantics (Sun = 0). */
function chicagoNow(): { year: number; month: number; day: number; hour: number; weekday: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: PLAN_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        weekday: 'short'
    })
    const parts = formatter.formatToParts(new Date()).reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value
        return acc
    }, {})
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return {
        day: parseInt(parts.day, 10),
        hour: parts.hour === '24' ? 0 : parseInt(parts.hour, 10),
        month: parseInt(parts.month, 10),
        weekday: weekdayMap[parts.weekday] ?? 0,
        year: parseInt(parts.year, 10)
    }
}

/** Returns `tomorrow` in Chicago wall-clock days, formatted as `YYYY-MM-DD`. */
function chicagoTomorrowDate(now = chicagoNow()): string {
    // Use UTC date math against the Chicago wall-clock date — anchoring to
    // noon UTC sidesteps any DST hour-shift weirdness across the boundary.
    const base = new Date(Date.UTC(now.year, now.month - 1, now.day, 12, 0, 0))
    base.setUTCDate(base.getUTCDate() + 1)
    const yyyy = base.getUTCFullYear()
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(base.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

/** Returns the day-of-week (0 = Sun) for a `YYYY-MM-DD` date string, in the
 *  Chicago time zone. */
function chicagoWeekdayForDate(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return -1
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: PLAN_TIME_ZONE, weekday: 'short' })
    const value = formatter.format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)))
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return weekdayMap[value] ?? -1
}

/** Mirrors `groupOrderRowsByPlant` from `src/services/DispatchDataService.js`
 *  so the snapshot blob has the EXACT same shape the frontend already
 *  consumes — diffing logic on the client side can compare snapshot orders
 *  against live orders without any field-name translation. */
function buildPlantProduction(rows: any[]): Record<string, any> {
    const byPlant: Record<string, any> = {}
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
            toJobTime: row.sched_to_job_time || '',
            toPlantTime: row.sched_to_plant_time || '',
            truckClass: row.truck_class || '',
            truckCount: row.truck_count != null ? String(row.truck_count) : '',
            yardage: row.scheduled_yardage != null ? String(row.scheduled_yardage) : ''
        })
    }
    for (const code of Object.keys(byPlant)) {
        const block = byPlant[code]
        const yardages = block.orders.map((o: any) => parseFloat(o.yardage) || 0)
        block.totalYardage = yardages.reduce((s: number, n: number) => s + n, 0)
        const times = block.orders
            .map((o: any) => o.startTime)
            .filter((t: string) => /^\d{1,2}:\d{2}$/.test(t))
            .map((t: string) => t.padStart(5, '0'))
            .sort()
        block.firstJobTime = times[0] || ''
        block.lastJobTime = times[times.length - 1] || ''
        block.orders.sort((a: any, b: any) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
    }
    return byPlant
}

const SCHEDULE_COLUMNS =
    'order_id, order_num, home_plant_code, customer, customer_num, job_number, address, city, contact, phone, ' +
    'po_number, product_code, product_description, start_time, rate, scheduled_yardage, load_size, truck_count, ' +
    'truck_class, sched_to_job_time, sched_to_plant_time'

async function fetchPlantProductionForDate(admin: any, dateStr: string): Promise<Record<string, any>> {
    const { data, error } = await admin
        .from(DISPATCH_TABLE)
        .select(SCHEDULE_COLUMNS)
        .eq('order_date', dateStr)
        .eq('ticket_num', '')
    if (error) throw error
    return buildPlantProduction(data ?? [])
}

async function handleCapture(req: Request, headers: any): Promise<Response> {
    // Cron is the only legitimate caller. Reject anything without the
    // internal token so an authenticated user can't trigger an off-hour
    // snapshot by hitting this endpoint directly.
    if (!isInternalServiceCall(req)) {
        return errorResponse('Forbidden', headers, 403)
    }
    const body = await parseBody(req)
    const forceDate = typeof body?.scheduleDate === 'string' && ISO_DATE.test(body.scheduleDate)
        ? body.scheduleDate
        : null

    const now = chicagoNow()
    // pg_cron schedules at both 22:30 and 23:30 UTC; only one of them lands
    // on 17:30 Chicago at any given time of year (CDT vs CST). The other
    // call gets short-circuited here. `scheduleDate` override skips the
    // gate so an operator can manually backfill / test if needed.
    if (!forceDate && now.hour !== SNAPSHOT_HOUR_CT) {
        return jsonResponse(
            {
                skipped: true,
                reason: 'outside-capture-window',
                chicagoHour: now.hour
            },
            headers
        )
    }

    const scheduleDate = forceDate || chicagoTomorrowDate(now)
    const weekday = chicagoWeekdayForDate(scheduleDate)
    if (weekday === 0) {
        // Sundays are non-production days; skipping per project rules.
        return jsonResponse({ scheduleDate, skipped: true, reason: 'sunday' }, headers)
    }

    const admin = getAdminClient()
    let plantProduction: Record<string, any>
    try {
        plantProduction = await fetchPlantProductionForDate(admin, scheduleDate)
    } catch (err: any) {
        return errorResponse(err?.message || 'Failed to fetch schedule', headers, 500)
    }

    // Skip empty days outright — keeps the snapshot table clean instead of
    // accumulating "no data yet" rows for future dates the bridge hasn't
    // synced.
    let orderCount = 0
    let totalYardage = 0
    for (const code of Object.keys(plantProduction)) {
        const block = plantProduction[code]
        orderCount += Array.isArray(block?.orders) ? block.orders.length : 0
        totalYardage += Number(block?.totalYardage) || 0
    }
    if (orderCount === 0) {
        return jsonResponse({ scheduleDate, skipped: true, reason: 'no-orders' }, headers)
    }

    // Snapshot is per-date: ON CONFLICT DO NOTHING so we never overwrite
    // the original 5:30 PM capture if a later run hits the same date.
    const { error } = await admin
        .from(SNAPSHOT_TABLE)
        .insert({
            captured_by: body?.source === 'pg_cron' ? 'cron' : 'manual',
            order_count: orderCount,
            plant_production: plantProduction,
            schedule_date: scheduleDate,
            total_yardage: totalYardage
        })
        .select('id')
        .maybeSingle()
    if (error) {
        // The unique constraint on schedule_date will raise 23505 if a
        // snapshot already exists for this date — that's the expected dedupe
        // path, not a failure mode.
        if ((error as { code?: string }).code === '23505') {
            return jsonResponse({ scheduleDate, skipped: true, reason: 'already-captured' }, headers)
        }
        return errorResponse(error.message || 'Insert failed', headers, 500)
    }

    return jsonResponse({ orderCount, scheduleDate, success: true, totalYardage }, headers)
}

async function handleGetByDate(req: Request, headers: any): Promise<Response> {
    // Frontend reader. Service-role-authenticated callers (internal token)
    // are also allowed so other edge functions can fetch snapshots without
    // an end-user session.
    if (!isInternalServiceCall(req)) {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )
        const auth = await requireAuthenticated(supabase, req, headers)
        if (auth instanceof Response) return auth
    }
    const body = await parseBody(req)
    const scheduleDate = typeof body?.scheduleDate === 'string' ? body.scheduleDate : ''
    if (!ISO_DATE.test(scheduleDate)) {
        return errorResponse('scheduleDate (YYYY-MM-DD) is required', headers, 400)
    }
    const admin = getAdminClient()
    const { data, error } = await admin
        .from(SNAPSHOT_TABLE)
        .select('id, schedule_date, captured_at, captured_by, plant_production, order_count, total_yardage')
        .eq('schedule_date', scheduleDate)
        .maybeSingle()
    if (error) return errorResponse(error.message || 'Query failed', headers, 500)
    return jsonResponse({ snapshot: data ?? null }, headers)
}

async function handleBootstrap(req: Request, headers: any): Promise<Response> {
    // Internal-token-only. Writes the cron's config row using the function's
    // own SUPABASE_URL + EDGE_INTERNAL_TOKEN env vars. Run once per project
    // after deploying / rotating secrets so pg_cron has the URL + token it
    // needs to invoke this function. Idempotent — re-running just upserts
    // the latest values.
    if (!isInternalServiceCall(req)) {
        return errorResponse('Forbidden', headers, 403)
    }
    const body = await parseBody(req)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const internalToken = Deno.env.get('EDGE_INTERNAL_TOKEN') ?? ''
    if (!supabaseUrl || !internalToken) {
        return errorResponse('SUPABASE_URL or EDGE_INTERNAL_TOKEN missing', headers, 500)
    }
    const edgeUrl = typeof body?.edgeUrl === 'string' && body.edgeUrl.trim()
        ? body.edgeUrl.trim().replace(/\/$/, '')
        : `${supabaseUrl.replace(/\/$/, '')}/functions/v1`
    const admin = getAdminClient()
    const { error } = await admin
        .from('plan_schedule_snapshot_config')
        .upsert({
            edge_internal_token: internalToken,
            edge_url: edgeUrl,
            id: 1,
            updated_at: new Date().toISOString()
        })
    if (error) return errorResponse(error.message || 'Bootstrap failed', headers, 500)
    return jsonResponse({ edgeUrl, success: true }, headers)
}

async function handleListRecent(req: Request, headers: any): Promise<Response> {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const auth = await requireAuthenticated(supabase, req, headers)
    if (auth instanceof Response) return auth
    const body = await parseBody(req)
    const requested = parseInt(String(body?.limit ?? ''), 10)
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 90) : 30
    const admin = getAdminClient()
    const { data, error } = await admin
        .from(SNAPSHOT_TABLE)
        .select('schedule_date, captured_at, captured_by, order_count, total_yardage')
        .order('schedule_date', { ascending: false })
        .limit(limit)
    if (error) return errorResponse(error.message || 'Query failed', headers, 500)
    return jsonResponse({ snapshots: data ?? [] }, headers)
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    if (req.method !== 'POST') return errorResponse('Method not allowed', headers, 405)
    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop() ?? ''
        switch (endpoint) {
            case 'capture':
                return await handleCapture(req, headers)
            case 'get-by-date':
                return await handleGetByDate(req, headers)
            case 'list-recent':
                return await handleListRecent(req, headers)
            case 'bootstrap':
                return await handleBootstrap(req, headers)
            default:
                return errorResponse(`Unknown endpoint: ${endpoint}`, headers, 404)
        }
    } catch (err: any) {
        return errorResponse(err?.message || 'Unexpected error', headers, 500)
    }
})
