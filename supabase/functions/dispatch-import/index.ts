// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'
import { type DailyOrderRecord, parseDailyOrderHtml, parseDetailDriverHtml, parseDetailOrderHtml } from './parsers.ts'

// ============================================================================
// Pulls dispatch report HTML files from the `dispatch-reports` bucket, parses
// each with the same logic the site used to run client-side, and upserts
// into `dispatch_data`. The site reads from that table directly afterward —
// realtime postgres_changes events on the table fire as we upsert, so the
// schedule UI updates without manually polling.
//
// Trigger surface: POST with an optional JSON body. Defaults to today.
//   { date?: 'YYYY-MM-DD',
//     plants?: string[],          // limit to these plant codes (else all)
//     reports?: string[],         // ["DailyOrder","DetailOrderAnalysis","DetailDriver"]
//     reconcile?: boolean         // when true, ignore date/plants/reports.
//                                 // List every `<date>.html` in the bucket
//                                 // and DELETE all dispatch_data rows
//                                 // whose order_date isn't in that list.
//                                 // Handles whole dates removed from the
//                                 // bucket — per-date sync can't catch that.
//   }
// ============================================================================

const BUCKET = 'dispatch-reports'

// Same plant universe the bridge userscript uploads for. Loading-only
// plants (404, 409) are included because their detail/driver files contain
// cross-plant tickets we need.
const PLANT_IDS = ['401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '453', '455', '461', '468']

const numOrNull = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = parseFloat(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
}

const normalizeCustomer = (name: string): string =>
    String(name || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()

const todayIso = (): string => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// @ts-ignore Deno serve
Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    const headers = getCorsHeaders(origin)

    if (req.method === 'OPTIONS') return handleOptions(origin)
    if (req.method !== 'POST') return errorResponse('Method not allowed', headers, 405)

    let body: { date?: string; plants?: string[]; reports?: string[]; reconcile?: boolean } = {}
    try {
        body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    } catch {
        body = {}
    }

    const auth = await requireAuthenticated(null, req, headers, body)
    if (auth instanceof Response) return auth

    const date = body.date || todayIso()
    if (!body.reconcile && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return errorResponse('Invalid date — expected YYYY-MM-DD', headers, 400)
    }

    const plantFilter = Array.isArray(body.plants) && body.plants.length > 0 ? new Set(body.plants.map(String)) : null
    const enabled = new Set(body.reports || ['DailyOrder', 'DetailOrderAnalysis', 'DetailDriver'])

    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const downloadHtml = async (path: string): Promise<string | null> => {
        const { data, error } = await supabase.storage.from(BUCKET).download(path)
        if (error || !data) return null
        return await data.text()
    }

    // Reconcile mode — list every `<date>.html` at the root of the bucket
    // and prune any `dispatch_data` rows whose `order_date` isn't in that
    // list. Handles the case where a whole date was deleted from the
    // bucket; per-date sync (which only runs when `dispatch-import` is
    // called for that specific date) can never catch this on its own.
    //
    // Bucket list is paginated at 1000 entries per page so the call works
    // for any year-window of dates. Empty bucket aborts the reconcile —
    // the SQL function also rejects an empty `p_bucket_dates` so the DB
    // can't be wiped by a misfire on either side.
    if (body.reconcile) {
        const bucketDates: string[] = []
        let offset = 0
        // safety bound — 100k files is well past anything we'd have
        for (let safety = 0; safety < 100; safety++) {
            const { data, error } = await supabase.storage.from(BUCKET).list('', {
                limit: 1000,
                offset
            })
            if (error) {
                return errorResponse(`Reconcile: bucket list failed — ${error.message}`, headers, 500)
            }
            if (!data || data.length === 0) break
            for (const entry of data) {
                const m = (entry.name || '').match(/^(\d{4}-\d{2}-\d{2})\.html$/)
                if (m) bucketDates.push(m[1])
            }
            if (data.length < 1000) break
            offset += 1000
        }
        if (bucketDates.length === 0) {
            return errorResponse(
                'Reconcile aborted — bucket has no daily HTMLs. Refusing to wipe the table.',
                headers,
                400
            )
        }
        const { data: pruneRows, error: pruneError } = await supabase.rpc('dispatch_reconcile_with_bucket', {
            p_bucket_dates: bucketDates
        })
        if (pruneError) {
            return errorResponse(`Reconcile: prune failed — ${pruneError.message}`, headers, 500)
        }
        const orphans = (pruneRows || []) as { orphan_date: string; rows_deleted: number }[]
        const totalRowsDeleted = orphans.reduce((sum, r) => sum + (r.rows_deleted || 0), 0)
        return jsonResponse(
            {
                reconcile: true,
                bucketDateCount: bucketDates.length,
                orphanDates: orphans,
                totalRowsDeleted
            },
            headers,
            200
        )
    }

    // Hydrate the plants table once so the DailyOrder parser can resolve
    // dispatch HTML codes to DB plant codes via name fallback.
    const { data: plantRows } = await supabase.from('plants').select('plant_code, plant_name')
    const plants = (plantRows || []) as { plant_code: string; plant_name: string }[]

    const result = {
        date,
        dailyOrder: { fetched: false, orders: 0 },
        detailOrder: { plantsFetched: 0, ticketsParsed: 0 },
        detailDriver: { plantsFetched: 0, ticketsParsed: 0 },
        rowsUpserted: 0,
        rowsDeleted: 0,
        errors: [] as string[]
    }

    // Tracks every (order_id, ticket_num) tuple this run upserted. After the
    // last upsert, anything in `dispatch_data` for `date` that ISN'T in this
    // set gets deleted — that's how the table stays in lockstep with the
    // bucket when an order or ticket disappears from a re-export.
    const touchedKeys = new Set<string>()
    const trackUpsertedRows = (rows: Record<string, unknown>[]) => {
        for (const r of rows) {
            const orderId = (r.order_id as string) || ''
            if (!orderId) continue
            const ticketNum = (r.ticket_num as string) || ''
            touchedKeys.add(`${orderId}|${ticketNum}`)
        }
    }

    // Stage 1 — DailyOrder. Order header rows land in dispatch_data with
    // ticket_num='' (stub). The (orderNum + customer)→orderId map built
    // here is reused by the DetailDriver pass to attach cross-plant tickets.
    const orderById: Record<string, DailyOrderRecord> = {}
    const orderIdLookup = new Map<string, string>() // strict: orderNum||customer
    const orderIdLookupLoose = new Map<string, string>() // loose: orderNum

    if (enabled.has('DailyOrder')) {
        const html = await downloadHtml(`${date}.html`)
        if (html) {
            result.dailyOrder.fetched = true
            const orders = parseDailyOrderHtml(html, plants)
            result.dailyOrder.orders = orders.length

            const stubRows = orders.map((o) => {
                orderById[o.orderId] = o
                const cust = normalizeCustomer(o.customer)
                if (cust) orderIdLookup.set(`${o.orderNum}||${cust}`, o.orderId)
                if (o.orderNum && !orderIdLookupLoose.has(o.orderNum)) {
                    orderIdLookupLoose.set(o.orderNum, o.orderId)
                }
                return {
                    order_date: date,
                    order_id: o.orderId,
                    order_num: o.orderNum || null,
                    ticket_num: '',
                    home_plant_code: o.homePlantCode || null,
                    customer: o.customer || null,
                    customer_num: o.customerNum || null,
                    job_number: o.jobNumber || null,
                    address: o.address || null,
                    city: o.city || null,
                    contact: o.contact || null,
                    phone: o.phone || null,
                    po_number: o.poNumber || null,
                    product_code: o.productCode || null,
                    product_description: o.description || null,
                    start_time: o.startTime || null,
                    rate: o.rate || null,
                    scheduled_yardage: numOrNull(o.yardage),
                    load_size: numOrNull(o.loadSize),
                    truck_count: numOrNull(o.truckCount),
                    truck_class: o.truckClass || null,
                    sched_to_job_time: o.toJobTime || null,
                    sched_to_plant_time: o.toPlantTime || null,
                    source_reports: ['DailyOrder']
                }
            })

            if (stubRows.length) {
                const { error } = await supabase.rpc('dispatch_upsert_data', { rows: stubRows })
                if (error) {
                    result.errors.push(`DailyOrder upsert: ${error.message}`)
                } else {
                    result.rowsUpserted += stubRows.length
                    trackUpsertedRows(stubRows)
                }
            }
        }
    }

    // Helper: build the full row for a ticket, denormalizing the order
    // header fields so a single-row read carries the schedule context too.
    const buildTicketRow = (
        orderId: string,
        ticketNum: string,
        ticketFields: Record<string, unknown>,
        sourceReports: string[]
    ) => {
        const o = orderById[orderId]
        return {
            order_date: date,
            order_id: orderId,
            ticket_num: ticketNum,
            order_num: o?.orderNum || (ticketFields.order_num as string) || null,
            home_plant_code: o?.homePlantCode || null,
            customer: o?.customer || (ticketFields.customer as string) || null,
            customer_num: o?.customerNum || null,
            job_number: o?.jobNumber || null,
            address: o?.address || null,
            city: o?.city || null,
            contact: o?.contact || null,
            phone: o?.phone || null,
            po_number: o?.poNumber || null,
            product_code: o?.productCode || null,
            product_description: o?.description || null,
            start_time: o?.startTime || null,
            rate: o?.rate || null,
            scheduled_yardage: numOrNull(o?.yardage),
            load_size: numOrNull(o?.loadSize),
            truck_count: numOrNull(o?.truckCount),
            truck_class: o?.truckClass || null,
            sched_to_job_time: o?.toJobTime || null,
            sched_to_plant_time: o?.toPlantTime || null,
            ...ticketFields,
            source_reports: sourceReports
        }
    }

    const eligiblePlants = plantFilter ? PLANT_IDS.filter((p) => plantFilter!.has(p)) : PLANT_IDS

    // Stage 2 — DetailOrderAnalysis. Per-plant fan-out. Each ticket row
    // upserts into dispatch_data keyed by (date, orderId, ticketNum).
    if (enabled.has('DetailOrderAnalysis')) {
        const ticketRows: Record<string, unknown>[] = []
        for (const plantId of eligiblePlants) {
            const html = await downloadHtml(`detail/${date}_${plantId}.html`)
            if (!html) continue
            result.detailOrder.plantsFetched++
            const tickets = parseDetailOrderHtml(html)
            result.detailOrder.ticketsParsed += tickets.length
            for (const t of tickets) {
                if (!t.ticketNum) continue
                ticketRows.push(
                    buildTicketRow(
                        t.orderId,
                        t.ticketNum,
                        {
                            ticket_id: t.ticketId || null,
                            loaded_plant_code: t.loadedPlantCode || plantId,
                            truck_num: t.truckNum || null,
                            driver_num: t.driverNum || null,
                            ticket_time: t.ticketTime || null,
                            loaded_time: t.loadedTime || null,
                            quantity: numOrNull(t.quantity)
                        },
                        ['DetailOrderAnalysis']
                    )
                )
            }
        }
        if (ticketRows.length) {
            const { error } = await supabase.rpc('dispatch_upsert_data', { rows: ticketRows })
            if (error) {
                result.errors.push(`DetailOrderAnalysis upsert: ${error.message}`)
            } else {
                result.rowsUpserted += ticketRows.length
                trackUpsertedRows(ticketRows)
            }
        }
    }

    // If DetailDriver is in scope but DailyOrder wasn't re-parsed this
    // invocation, hydrate the orderId lookup from `dispatch_data` rows
    // already in the table for this date — otherwise every cross-plant
    // ticket fails to match and gets dropped on the floor.
    if (enabled.has('DetailDriver') && orderIdLookup.size === 0) {
        const { data: existingOrders } = await supabase
            .from('dispatch_data')
            .select(
                'order_id, order_num, customer, home_plant_code, customer_num, job_number, address, city, contact, phone, po_number, product_code, product_description, start_time, rate, scheduled_yardage, load_size, truck_count, truck_class, sched_to_job_time, sched_to_plant_time'
            )
            .eq('order_date', date)
            .eq('ticket_num', '')
        for (const row of (existingOrders || []) as Record<string, unknown>[]) {
            const orderId = row.order_id as string
            const orderNum = (row.order_num as string) || ''
            const cust = normalizeCustomer((row.customer as string) || '')
            if (cust && orderNum) orderIdLookup.set(`${orderNum}||${cust}`, orderId)
            if (orderNum && !orderIdLookupLoose.has(orderNum)) orderIdLookupLoose.set(orderNum, orderId)
            // Hydrate orderById so buildTicketRow() can still denormalize
            // the order header fields onto each ticket row we upsert.
            orderById[orderId] = {
                orderId,
                orderNum,
                homePlantCode: (row.home_plant_code as string) || '',
                customer: (row.customer as string) || '',
                customerNum: (row.customer_num as string) || '',
                jobNumber: (row.job_number as string) || '',
                address: (row.address as string) || '',
                city: (row.city as string) || '',
                contact: (row.contact as string) || '',
                phone: (row.phone as string) || '',
                poNumber: (row.po_number as string) || '',
                productCode: (row.product_code as string) || '',
                description: (row.product_description as string) || '',
                startTime: (row.start_time as string) || '',
                rate: (row.rate as string) || '',
                yardage: row.scheduled_yardage as number | null,
                loadSize: row.load_size as number | null,
                truckCount: row.truck_count as number | null,
                truckClass: (row.truck_class as string) || '',
                tktTime: '',
                toJobTime: (row.sched_to_job_time as string) || '',
                toPlantTime: (row.sched_to_plant_time as string) || ''
            }
        }
    }

    // Stage 3 — DetailDriver. Match each ticket to its home order via
    // (orderNum, customer) — that's how we capture cross-plant loads where
    // DetailOrderAnalysis missed them.
    //
    // Bucket reality check: the bridge userscript that uploads driver HTMLs
    // sometimes writes the SAME content to all 14 plant slots (per-date
    // eTags collapse to 1-3 unique blobs across the 14 files). Downloading
    // every slot was paying 14× for the same parse and OOM'ing the function
    // on dates whose driver report was 11+ MB. We list once, group plants
    // by content (eTag, with size as a fallback key), then download +
    // parse exactly once per unique content. Tickets carry their own plant
    // code via `parseDetailDriverHtml`'s section-header detection, so
    // dropping the per-plant download doesn't change attribution.
    if (enabled.has('DetailDriver')) {
        const ticketRows: Record<string, unknown>[] = []
        const { data: driverList } = await supabase.storage.from(BUCKET).list('driver', {
            limit: 1000,
            search: date
        })
        const filesByContent = new Map<string, { plants: string[]; sample: string }>()
        for (const plantId of eligiblePlants) {
            const fileName = `${date}_${plantId}.html`
            const item = (driverList || []).find((f: { name: string }) => f.name === fileName)
            if (!item) continue
            const meta = (item as { metadata?: { eTag?: string; size?: number } }).metadata || {}
            // Strip the surrounding quotes Supabase adds to eTag values so
            // the dedupe key is stable across list responses.
            const etag = (meta.eTag || '').replace(/"/g, '')
            const contentKey = etag || `size-${meta.size ?? '?'}-${plantId}`
            const group = filesByContent.get(contentKey)
            if (group) {
                group.plants.push(plantId)
            } else {
                filesByContent.set(contentKey, { plants: [plantId], sample: fileName })
            }
        }

        for (const group of filesByContent.values()) {
            const html = await downloadHtml(`driver/${group.sample}`)
            if (!html) continue
            result.detailDriver.plantsFetched += group.plants.length
            const { tickets } = parseDetailDriverHtml(html, group.plants[0])
            result.detailDriver.ticketsParsed += tickets.length
            for (const t of tickets) {
                if (!t.ticketNum) continue
                const cust = normalizeCustomer(t.customer)
                const orderId =
                    (cust && orderIdLookup.get(`${t.orderNum}||${cust}`)) ||
                    orderIdLookup.get(t.orderNum) ||
                    orderIdLookupLoose.get(t.orderNum)
                if (!orderId) continue
                // DetailDriver doesn't carry yardage. Estimate it from the
                // order's load_size (one truckload) so the ticket actually
                // contributes to the order total. When DetailOrderAnalysis
                // later imports the same ticket with a real quantity, the
                // upsert overwrites this estimate with the actual yards.
                const estimatedQty = numOrNull(orderById[orderId]?.loadSize)
                ticketRows.push(
                    buildTicketRow(
                        orderId,
                        t.ticketNum,
                        {
                            loaded_plant_code: t.plantCode || group.plants[0],
                            truck_num: t.truckNum || null,
                            driver_num: t.driverNum || null,
                            driver_name: t.driverName || null,
                            ticket_time: t.ticketTime || null,
                            loaded_time: t.loadedTime || null,
                            quantity: estimatedQty
                        },
                        ['DetailDriver']
                    )
                )
            }
        }
        if (ticketRows.length) {
            // Dedupe by (order_id, ticket_num) — when the same driver HTML
            // got uploaded for every plant (a known bridge bug we see in
            // the bucket: 14 plant-named files with identical content), the
            // per-plant fan-out above produces up to 14 copies of every
            // ticket. Postgres rejects ON CONFLICT batches that touch the
            // same row twice, so we collapse the duplicates here. Keep the
            // first occurrence — the ticket payload is identical across
            // duplicates, only the iterating plantId fallback may differ
            // and we don't want it to overwrite a real DetailOrderAnalysis
            // plant code from a previous pass.
            const dedupedMap = new Map<string, Record<string, unknown>>()
            for (const row of ticketRows) {
                const key = `${row.order_id}|${row.ticket_num}`
                if (!dedupedMap.has(key)) dedupedMap.set(key, row)
            }
            const dedupedRows = Array.from(dedupedMap.values())
            // Note: when both DetailOrderAnalysis AND DetailDriver have the
            // The dispatch_upsert_data RPC handles the conditional merge:
            // DetailDriver's load_size estimate fills in only when the
            // existing quantity is null, so a real DetailOrderAnalysis
            // value never gets clobbered by an estimate.
            const { error } = await supabase.rpc('dispatch_upsert_data', { rows: dedupedRows })
            if (error) {
                result.errors.push(`DetailDriver upsert: ${error.message}`)
            } else {
                result.rowsUpserted += dedupedRows.length
                trackUpsertedRows(dedupedRows)
            }
        }
    }

    // Sync step — drop any `dispatch_data` rows for this date that the just-
    // completed parse didn't produce. The RPC scopes deletion to rows whose
    // `source_reports` is a subset of `p_run_reports`, so a partial run
    // (e.g., DailyOrder + DetailOrderAnalysis without DetailDriver) only
    // touches rows owned by those two reports — DetailDriver-only tickets
    // survive even though we didn't re-parse them.
    //
    // Skipped on plant-filtered runs: per-plant dispatches don't see other
    // plants' data, so deleting their rows would silently wipe healthy
    // entries this invocation never had a chance to verify.
    if (!plantFilter && touchedKeys.size > 0) {
        const keysArray = Array.from(touchedKeys).map((k) => {
            const sep = k.indexOf('|')
            return { order_id: k.slice(0, sep), ticket_num: k.slice(sep + 1) }
        })
        const runReports = Array.from(enabled)
        let { data: deletedCount, error } = await supabase.rpc('dispatch_sync_delete_orphans', {
            p_date: date,
            p_keys: keysArray,
            p_run_reports: runReports
        })
        // Migration that adds `p_run_reports` may not be applied yet.
        // Fall back to the 2-arg signature, but only when re-parsing the
        // full default report set — otherwise the older function would
        // delete rows owned by reports we didn't run.
        if (error && (error as { code?: string }).code === 'PGRST202') {
            const isFullDefault =
                enabled.has('DailyOrder') && enabled.has('DetailOrderAnalysis') && enabled.has('DetailDriver')
            if (isFullDefault) {
                ;({ data: deletedCount, error } = await supabase.rpc('dispatch_sync_delete_orphans', {
                    p_date: date,
                    p_keys: keysArray
                }))
            }
        }
        if (error) result.errors.push(`Sync delete: ${error.message}`)
        else result.rowsDeleted = typeof deletedCount === 'number' ? deletedCount : 0
    }

    return jsonResponse(result, headers, 200)
})
