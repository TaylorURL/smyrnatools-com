// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { isInternalServiceCall } from '../_shared/internalAuth.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'
// @ts-ignore
import { buildDailyPlanEmail } from '../../../scripts/emails/daily-plan-email.js'

/**
 * Daily Plan email edge function — two endpoints:
 *
 *   POST /preview — resolves recipients per plant + renders the HTML email
 *                   so the Review modal can show each plant manager's
 *                   message tab without sending anything.
 *   POST /send    — same resolution + render, then ships each plant email
 *                   through the email-service. While we're testing the
 *                   pipeline TEST_MODE is true and every TO / CC is
 *                   collapsed to TEST_REDIRECT_EMAIL — the rendered
 *                   banner above the message body shows the intended
 *                   recipients the routing logic would have hit so the
 *                   dispatcher can verify the lookup before we flip the
 *                   redirect off.
 *
 * Body shape (both endpoints):
 *   {
 *       planDate: 'YYYY-MM-DD',
 *       plants: [
 *           {
 *               code: '403',
 *               name: 'Baytown',
 *               kpi: { orderCount, customerCount, yardage, loadCount, firstStart, lastStart },
 *               orders: [{ startTime, orderNum, customer, address, productCode, yardage, truckCount, needsHelp }],
 *               helpIn: [{ heading, detail }],
 *               helpOut: [{ heading, detail }],
 *               roster: [{ name, clockIn, truck, flag? }],
 *               notes: '...'
 *           },
 *           ...
 *       ]
 *   }
 *
 * The client owns the per-plant data assembly for now — the cron-mode
 * variant we'll build later will replay the same plan record server-
 * side, but routing through the client first lets us iterate on the
 * email shape without re-deploying the function on every tweak.
 */

/* Test-mode controls. While true every email is redirected to the single
 * test inbox below regardless of the resolved plant manager / DM, and the
 * subject is prefixed with `[TEST]`. Production routing is enabled. */
const TEST_MODE = false
const TEST_REDIRECT_EMAIL = 'tbtaylor@smyrnareadymix.com'

/* Cron schedule windows. pg_cron fires at both 21:00 UTC (CDT) and 22:00
 * UTC (CST); the edge function self-checks Chicago wall-clock against
 * `CRON_HOUR_CT = 16` so only the run that matches 4:00 PM Chicago does
 * any work. Sundays are skipped to match the rest of the plan pipeline. */
const PLAN_TIME_ZONE = 'America/Chicago'
const CRON_HOUR_CT = 16

const DEFAULT_FRONTEND_URL = 'https://smyrnatools.com'

interface Recipient {
    email: string
    name?: string
}

interface PlantInput {
    code: string
    name?: string
    kpi?: Record<string, unknown>
    orders?: unknown[]
    helpIn?: unknown[]
    helpOut?: unknown[]
    roster?: unknown[]
    notes?: string
}

interface ResolvedPlant {
    code: string
    name: string
    to: Recipient[]
    cc: Recipient[]
    subject: string
    html: string
    text?: string
    sendTo: Recipient[]
    sendCc: Recipient[]
    skip?: { reason: string }
    dmDebug?: DmDebug
}

interface DmDebug {
    plantCode: string
    queriedAs: string
    assignmentCount: number
    assignments: Array<{ user_id: string; plant_code: string }>
    sampleRows?: Array<{ user_id: string; plant_code: string }>
    profilesFound?: number
    usersFound?: number
    missingProfileUserIds?: string[]
    missingEmailUserIds?: string[]
    assignErr?: string | null
    profErr?: string | null
    userErr?: string | null
    plantDistricts?: string[]
    dmPlantCodes?: string[]
    dmUserIds?: string[]
}

function createAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    )
}

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return null
    }
}

function isFiniteString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

/**
 * Resolve TO + CC recipients for a single plant.
 *
 * Two independent sources keep PMs and DMs from getting tangled:
 *
 *   • **TO (Plant Manager)** — `plants.manager_user_ids` for the plant,
 *     a flat array set via the Plants admin → Managers picker. Whoever
 *     the dispatcher attaches lands in TO.
 *   • **CC (District Manager)** — every user with a "District Manager"
 *     role whose home plant (`users_profiles.plant_code`) shares at
 *     least one district with the target plant. Districts live on
 *     `plants.districts` (text[]) and are managed in the RegionsDetail
 *     admin view. A DM "covers" every plant in their district family.
 *
 * If a user shows up in both lists (rare — a DM also attached as a
 * named manager) the DM classification wins so they're CC'd rather
 * than addressed directly.
 */
async function resolvePlantRecipients(
    supabase: any,
    plantCode: string
): Promise<{ to: Recipient[]; cc: Recipient[]; debug: DmDebug }> {
    const queriedAs = plantCode

    /* 1. Target plant's named managers (direct TO list) live on
     *    `plants.manager_user_ids` — set via the Plants admin →
     *    Managers picker. */
    const { data: plantRow, error: plantErr } = await supabase
        .from('plants')
        .select('plant_code, manager_user_ids')
        .eq('plant_code', queriedAs)
        .maybeSingle()
    const managerIds: string[] = Array.isArray(plantRow?.manager_user_ids) ? plantRow.manager_user_ids : []

    const debug: DmDebug = {
        plantCode,
        queriedAs,
        assignmentCount: managerIds.length,
        assignments: managerIds.map((id) => ({ user_id: id, plant_code: queriedAs })),
        assignErr: plantErr?.message ?? null,
        plantDistricts: [],
        sampleRows: [],
        dmPlantCodes: [],
        dmUserIds: []
    }

    /* 2. District coverage — `regions_plants.districts` is a `jsonb[]`
     *    of district names. PostgREST overlap operators on `jsonb[]`
     *    are awkward, so we pull the full table once and join in
     *    memory: cheap (rows == plant count) and dead-simple to reason
     *    about. */
    const { data: rpRows, error: rpErr } = await supabase
        .from('regions_plants')
        .select('plant_code, districts')
    if (rpErr) {
        debug.assignErr = `${debug.assignErr || ''} | regions_plants: ${rpErr.message}`.trim()
    }
    const normalizeDistricts = (value: unknown): string[] => {
        if (!Array.isArray(value)) return []
        return value
            .map((entry) => (typeof entry === 'string' ? entry : entry && typeof entry === 'object' ? (entry as { name?: string }).name || '' : ''))
            .map((s) => String(s || '').trim())
            .filter((s) => s.length > 0)
    }
    const districtsByPlant = new Map<string, string[]>()
    ;(rpRows || []).forEach((row: { plant_code?: string; districts?: unknown }) => {
        if (!row?.plant_code) return
        const list = normalizeDistricts(row.districts)
        if (list.length === 0) return
        const existing = districtsByPlant.get(row.plant_code) || []
        districtsByPlant.set(row.plant_code, Array.from(new Set([...existing, ...list])))
    })
    const plantDistricts = districtsByPlant.get(queriedAs) || []
    debug.plantDistricts = plantDistricts

    let dmPlantCodes: string[] = []
    if (plantDistricts.length > 0) {
        const target = new Set(plantDistricts)
        const coverage = new Set<string>()
        districtsByPlant.forEach((list, code) => {
            if (list.some((d) => target.has(d))) coverage.add(code)
        })
        dmPlantCodes = Array.from(coverage)
        debug.dmPlantCodes = dmPlantCodes
    }

    /* 3. Look up DMs by role name → permission → profile.plant_code
     *    membership in the coverage set. */
    let dmUserIds: string[] = []
    if (dmPlantCodes.length > 0) {
        const { data: dmRoles } = await supabase.from('users_roles').select('id, name')
        const dmRoleIds = (dmRoles || [])
            .filter((r: { name?: string }) => /district manager/i.test(r?.name || ''))
            .map((r: { id: string }) => r.id)
        if (dmRoleIds.length > 0) {
            const { data: dmPerms } = await supabase
                .from('users_permissions')
                .select('user_id')
                .in('role_id', dmRoleIds)
            const candidateIds = Array.from(new Set((dmPerms || []).map((p: { user_id: string }) => p.user_id)))
            if (candidateIds.length > 0) {
                const { data: dmProfilesScoped } = await supabase
                    .from('users_profiles')
                    .select('id, plant_code')
                    .in('id', candidateIds)
                    .in('plant_code', dmPlantCodes)
                dmUserIds = (dmProfilesScoped || []).map((p: { id: string }) => p.id)
            }
        }
        debug.dmUserIds = dmUserIds
    }

    /* 4. Fetch profile + email rows for every recipient candidate (PMs
     *    via manager_user_ids and DMs via the district join), then split
     *    into TO and CC with DM precedence. */
    const allIds = Array.from(new Set([...managerIds, ...dmUserIds]))
    if (allIds.length === 0) return { to: [], cc: [], debug }

    const [{ data: profiles, error: profErr }, { data: users, error: userErr }] = await Promise.all([
        supabase.from('users_profiles').select('id, first_name, last_name').in('id', allIds),
        supabase.from('users').select('id, email').in('id', allIds)
    ])
    debug.profilesFound = profiles?.length ?? 0
    debug.usersFound = users?.length ?? 0
    debug.profErr = profErr?.message ?? null
    debug.userErr = userErr?.message ?? null
    const profileIds = new Set((profiles || []).map((p: { id: string }) => p.id))
    const userRowIds = new Set((users || []).map((u: { id: string }) => u.id))
    debug.missingProfileUserIds = allIds.filter((id) => !profileIds.has(id))
    debug.missingEmailUserIds = allIds.filter((id) => !userRowIds.has(id))

    const emailById = new Map((users || []).map((u: { id: string; email: string }) => [u.id, u.email]))
    const profileById = new Map(
        (profiles || []).map((p: { id: string; first_name?: string; last_name?: string }) => [p.id, p])
    )
    const dmSet = new Set(dmUserIds)
    const toBuild = (id: string): Recipient | null => {
        const email = emailById.get(id)
        if (!email) return null
        const profile = profileById.get(id)
        const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined : undefined
        return { email, name }
    }

    const cc: Recipient[] = []
    dmUserIds.forEach((id) => {
        const r = toBuild(id)
        if (r) cc.push(r)
    })
    const to: Recipient[] = []
    managerIds
        .filter((id) => !dmSet.has(id))
        .forEach((id) => {
            const r = toBuild(id)
            if (r) to.push(r)
        })

    return { to, cc, debug }
}

async function resolvePlantName(supabase: any, plantCode: string, fallback?: string): Promise<string> {
    if (fallback) return fallback
    const { data } = await supabase.from('plants').select('plant_name').eq('plant_code', plantCode).maybeSingle()
    return data?.plant_name || ''
}

/**
 * Assembles every plant payload into a fully-resolved render-ready record:
 * intended recipients (TO / CC), subject, HTML body, plus the redirected
 * send-time recipients with TEST_REDIRECT_EMAIL baked in.
 */
async function resolveAllPlants(
    supabase: any,
    planDate: string,
    plants: PlantInput[]
): Promise<ResolvedPlant[]> {
    const out: ResolvedPlant[] = []
    for (const input of plants) {
        const code = isFiniteString(input?.code) ? input.code.trim() : ''
        if (!code) continue
        const name = await resolvePlantName(supabase, code, input?.name)
        const { to, cc, debug: dmDebug } = await resolvePlantRecipients(supabase, code)

        const { subject, html, text } = buildDailyPlanEmail({
            plant: { code, name },
            planDate,
            kpi: input?.kpi || {},
            orders: input?.orders || [],
            helpIn: input?.helpIn || [],
            helpOut: input?.helpOut || [],
            roster: input?.roster || [],
            notes: input?.notes || '',
            intendedTo: to,
            intendedCc: cc,
            testMode: TEST_MODE,
            testRedirectEmail: TEST_REDIRECT_EMAIL,
            frontendUrl: Deno.env.get('FRONTEND_URL') || DEFAULT_FRONTEND_URL,
            logoUrl: ''
        })

        const sendTo: Recipient[] = TEST_MODE ? [{ email: TEST_REDIRECT_EMAIL }] : to
        const sendCc: Recipient[] = TEST_MODE ? [] : cc

        out.push({
            code,
            name,
            to,
            cc,
            subject,
            html,
            text,
            sendTo,
            sendCc,
            skip: !TEST_MODE && to.length === 0 ? { reason: 'No plant manager resolved' } : undefined,
            dmDebug
        })
    }
    return out
}

/**
 * Fire one email through the email-service edge function. Service-to-
 * service hop carries the caller's session so the request authenticates
 * cleanly; the email-service does its own MailerSend handoff.
 */
async function sendOnePlant(req: Request, plant: ResolvedPlant): Promise<{ success: boolean; error?: string }> {
    if (plant.skip) return { success: false, error: plant.skip.reason }
    if (plant.sendTo.length === 0) return { success: false, error: 'No recipients after redirect' }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) return { success: false, error: 'Email service not configured' }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
    }
    // Forward the caller's session credentials so email-service's
    // requireAuthenticated gate accepts the inter-function hop.
    const userId = req.headers.get('x-user-id')
    const sessionId = req.headers.get('x-session-id')
    if (userId) headers['X-User-Id'] = userId
    if (sessionId) headers['X-Session-Id'] = sessionId
    const cookie = req.headers.get('cookie')
    if (cookie) headers['Cookie'] = cookie

    const payload: Record<string, unknown> = {
        subject: plant.subject,
        html: plant.html,
        to: plant.sendTo,
        ...(plant.sendCc.length ? { cc: plant.sendCc } : {}),
        ...(plant.text ? { text: plant.text } : {}),
        debug: false
    }

    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/email-service/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
            return { success: false, error: body?.error || `email-service responded ${response.status}` }
        }
        return { success: true }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
    }
}

/* ============================================================================
 * Cron pipeline
 *
 * `/cron-send` is the only legitimate caller of the unattended send path —
 * pg_cron fires it at 21:00 + 22:00 UTC; whichever lands on 16:00 Chicago
 * (4:00 PM local) actually does work, the other is a no-op. The cron reads
 * the saved plan for today, derives the same per-plant payloads the manual
 * Review modal sends, then routes each plant's email through `/send`'s
 * downstream helper. `/bootstrap` populates the pg_cron config row with
 * this function's edge URL + internal token (same pattern as
 * `schedule-snapshot-service/bootstrap`).
 *
 * The payload extraction here intentionally mirrors `DailyPlanEmailService`
 * on the client so the email body reads the same whether a dispatcher
 * pressed the Review & Send button or the cron fired automatically. The
 * `needsHelp` flag and the operator clock-in roster are the two pieces
 * that require the client-side pool simulation; the cron version omits
 * them rather than risk a desync, since the warning banner already tells
 * the manager the plan may be updated before 5:00 PM.
 * ============================================================================ */

const CRON_CONFIG_TABLE = 'daily_plan_email_config'

function chicagoNow(): { year: number; month: number; day: number; hour: number; weekday: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        month: '2-digit',
        timeZone: PLAN_TIME_ZONE,
        weekday: 'short',
        year: 'numeric'
    })
    const parts = formatter.formatToParts(new Date()).reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value
        return acc
    }, {})
    const weekdayMap: Record<string, number> = { Fri: 5, Mon: 1, Sat: 6, Sun: 0, Thu: 4, Tue: 2, Wed: 3 }
    return {
        day: parseInt(parts.day, 10),
        hour: parts.hour === '24' ? 0 : parseInt(parts.hour, 10),
        month: parseInt(parts.month, 10),
        weekday: weekdayMap[parts.weekday] ?? 0,
        year: parseInt(parts.year, 10)
    }
}

function chicagoTodayDate(now = chicagoNow()): string {
    const yyyy = String(now.year)
    const mm = String(now.month).padStart(2, '0')
    const dd = String(now.day).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

/* -- Small pure helpers ported from `src/utils/plan/*` ----------------------
 * Kept inline so this edge function has no transitive dep on the React
 * source tree. They match the originals one-for-one; if any of these
 * formulas changes upstream, update both sides. */

function parseDurationMin(value: unknown): number | null {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    return total > 0 ? total : null
}

function timeToMin(value: unknown): number | null {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    return Number.isFinite(total) ? total : null
}

function formatMin(min: number | null | undefined): string {
    if (!Number.isFinite(min as number)) return ''
    const wrapped = ((((min as number) % 1440) + 1440) % 1440) | 0
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const CANCELLED_START = '00:00'
const TEST_START = '99:99'

function isExcludedOrder(order: any): boolean {
    const t = String(order?.startTime || '').trim()
    if (!t) return false
    const padded = t.padStart(5, '0')
    return padded === CANCELLED_START || padded === TEST_START
}

function getCalculatedTruckCount(order: any): number {
    const raw = parseFloat(order?.truckCount)
    if (Number.isFinite(raw) && raw > 0) return raw
    const yardage = parseFloat(order?.yardage) || 0
    const loadSize = parseFloat(order?.loadSize) || 0
    if (yardage > 0 && loadSize > 0) return Math.ceil(yardage / loadSize)
    return 0
}

interface DriverTimes {
    arriveMin: number | null
    leaveMin: number | null
    driverIndex: number
}

function buildAssignmentDriverTimes(assignment: any): DriverTimes[] {
    const count = parseInt(assignment?.driverCount, 10) || 0
    if (count <= 0) return []
    const stagger = parseInt(assignment?.staggerMinutes, 10) || 0
    const isCustom = assignment?.timeMode === 'custom' && Array.isArray(assignment?.customTimes)
    const baseArrive = timeToMin(assignment?.time)
    const baseLeave = timeToMin(assignment?.leaveTime)
    const out: DriverTimes[] = []
    for (let i = 0; i < count; i++) {
        let arriveMin: number | null = null
        let leaveMin: number | null = null
        if (isCustom) {
            const ct = assignment.customTimes[i] || {}
            arriveMin = timeToMin(ct.time)
            leaveMin = timeToMin(ct.leaveTime)
        } else {
            if (Number.isFinite(baseArrive)) arriveMin = (baseArrive as number) + i * stagger
            leaveMin = baseLeave
        }
        out.push({
            arriveMin: Number.isFinite(arriveMin) ? arriveMin : null,
            driverIndex: i,
            leaveMin: Number.isFinite(leaveMin) ? leaveMin : null
        })
    }
    return out
}

function composeAddress(order: any): string {
    const parts = [order?.address, order?.city, order?.state]
        .map((p) => (p == null ? '' : String(p).trim()))
        .filter(Boolean)
    return parts.join(', ')
}

/**
 * Build every per-plant payload from a saved `plans` row. Mirrors
 * `DailyPlanEmailService.buildAllPlantEmailPayloads` minus the two pool-sim
 * dependent fields (needsHelp + roster) — those stay in the manual button
 * path so the cron version can ship without porting the full client hook.
 */
function buildServerPayloads(
    planRow: { plant_production?: Record<string, any>; assignments?: any[]; notes?: string },
    plantNameByCode: Record<string, string>
): PlantInput[] {
    const production = planRow?.plant_production || {}
    const assignments = Array.isArray(planRow?.assignments) ? planRow.assignments : []
    const notes = typeof planRow?.notes === 'string' ? planRow.notes : ''
    const out: PlantInput[] = []

    const codes = Object.keys(production).filter((c) => c && c !== '_meta')
    for (const plantCode of codes) {
        const block = production[plantCode] || {}
        const rawOrders = Array.isArray(block.orders) ? block.orders : []
        const liveOrders = rawOrders.filter((o: any) => !isExcludedOrder(o))

        const orders = liveOrders
            .map((order: any) => {
                const truckCount = getCalculatedTruckCount(order) || parseFloat(order?.truckCount) || 0
                const spacingMin = parseDurationMin(order?.rate)
                return {
                    address: composeAddress(order),
                    customer: (order.customer || '').trim() || 'Unknown customer',
                    needsHelp: false,
                    orderNum: order.orderNum || '',
                    productCode: order.productCode || order.description || '',
                    spacingMin: Number.isFinite(spacingMin) ? spacingMin : null,
                    startTime: order.startTime || '',
                    truckCount,
                    yardage: parseFloat(order.yardage) || 0
                }
            })
            .sort((a: any, b: any) => {
                const am = timeToMin(a.startTime) ?? Infinity
                const bm = timeToMin(b.startTime) ?? Infinity
                return am - bm
            })

        const customerSet = new Set(orders.map((o: any) => String(o.customer || '').trim().toUpperCase()).filter(Boolean))
        const yardage = orders.reduce((sum: number, o: any) => sum + (o.yardage || 0), 0)
        const loadCount = orders.reduce((sum: number, o: any) => sum + (o.truckCount || 0), 0)
        const startMinutes = orders.map((o: any) => timeToMin(o.startTime)).filter((m: number | null) => Number.isFinite(m)) as number[]
        const firstStart = startMinutes.length ? formatMin(Math.min(...startMinutes)) : ''
        const lastStart = startMinutes.length ? formatMin(Math.max(...startMinutes)) : ''
        const kpi = {
            customerCount: customerSet.size,
            firstStart,
            lastStart,
            loadCount,
            orderCount: orders.length,
            yardage
        }

        const helpIn: any[] = []
        const helpOut: any[] = []
        const buildForOrderSummary = (assignment: any, destPlantCode: string) => {
            if (!assignment?.forOrderId) return null
            const destOrders = production?.[destPlantCode]?.orders || []
            const match = destOrders.find((o: any) => (o.orderId || o.orderNum) === assignment.forOrderId)
            if (!match) return null
            return {
                customer: (match.customer || '').trim() || 'Unknown customer',
                orderNum: match.orderNum || '',
                productCode: match.productCode || match.description || '',
                startTime: match.startTime || ''
            }
        }
        for (const a of assignments) {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) continue
            const driverCount = parseInt(a.driverCount, 10) || 0
            if (driverCount <= 0) continue
            const driverTimes = buildAssignmentDriverTimes(a)
            const returnPlant = a.returnPlant || a.fromPlant
            const forOrder = buildForOrderSummary(a, a.toPlant)
            driverTimes.forEach((dt, idx) => {
                const driverLabel = driverCount === 1 ? 'Driver' : `Driver ${idx + 1} of ${driverCount}`
                const arriveTime = Number.isFinite(dt.arriveMin) ? formatMin(dt.arriveMin) : ''
                const leaveTime = Number.isFinite(dt.leaveMin) ? formatMin(dt.leaveMin) : ''
                const durationLabel =
                    Number.isFinite(dt.arriveMin) && Number.isFinite(dt.leaveMin) && (dt.leaveMin as number) > (dt.arriveMin as number)
                        ? `${arriveTime} – ${leaveTime}`
                        : ''
                const base = {
                    arriveTime,
                    counterPlantCode: '',
                    counterPlantName: '',
                    driverLabel,
                    durationLabel,
                    forOrder,
                    leaveTime,
                    returnPlantCode: returnPlant,
                    returnPlantName: plantNameByCode?.[returnPlant] || ''
                }
                if (a.toPlant === plantCode) {
                    helpIn.push({
                        ...base,
                        counterPlantCode: a.fromPlant,
                        counterPlantName: plantNameByCode?.[a.fromPlant] || ''
                    })
                }
                if (a.fromPlant === plantCode) {
                    helpOut.push({
                        ...base,
                        counterPlantCode: a.toPlant,
                        counterPlantName: plantNameByCode?.[a.toPlant] || ''
                    })
                }
            })
        }
        const byArrive = (a: any, b: any) => (timeToMin(a.arriveTime) ?? Infinity) - (timeToMin(b.arriveTime) ?? Infinity)
        helpIn.sort(byArrive)
        helpOut.sort(byArrive)

        if (orders.length === 0 && helpIn.length === 0 && helpOut.length === 0) continue

        out.push({
            code: plantCode,
            helpIn,
            helpOut,
            kpi,
            name: plantNameByCode[plantCode] || '',
            notes,
            orders,
            roster: []
        })
    }
    out.sort((a, b) => String(a.code).localeCompare(String(b.code)))
    return out
}

async function fetchPlantNameMap(supabase: any): Promise<Record<string, string>> {
    const { data } = await supabase.from('plants').select('plant_code, plant_name')
    const map: Record<string, string> = {}
    ;(data || []).forEach((row: { plant_code?: string; plant_name?: string }) => {
        if (row?.plant_code) map[row.plant_code] = row.plant_name || ''
    })
    return map
}

async function sendOnePayload(payload: ResolvedPlant): Promise<{ success: boolean; error?: string }> {
    if (payload.skip) return { success: false, error: payload.skip.reason }
    if (payload.sendTo.length === 0) return { success: false, error: 'No recipients resolved' }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const internalToken = Deno.env.get('EDGE_INTERNAL_TOKEN') ?? ''
    if (!supabaseUrl || !anonKey) return { success: false, error: 'Email service not configured' }

    const requestHeaders: Record<string, string> = {
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
    }
    if (internalToken) requestHeaders['X-Internal-Token'] = internalToken

    const body: Record<string, unknown> = {
        debug: false,
        html: payload.html,
        subject: payload.subject,
        to: payload.sendTo,
        ...(payload.sendCc.length ? { cc: payload.sendCc } : {}),
        ...(payload.text ? { text: payload.text } : {})
    }

    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/email-service/send`, {
            body: JSON.stringify(body),
            headers: requestHeaders,
            method: 'POST'
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) return { success: false, error: json?.error || `email-service responded ${response.status}` }
        return { success: true }
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
}

async function handleCronSend(req: Request, headers: any): Promise<Response> {
    if (!isInternalServiceCall(req)) {
        return errorResponse('Forbidden', headers, 403)
    }
    const body = await parseBody(req)
    const force = body?.force === true
    const dryRun = body?.dryRun === true
    const now = chicagoNow()
    if (!force && now.hour !== CRON_HOUR_CT) {
        return jsonResponse({ chicagoHour: now.hour, reason: 'outside-send-window', skipped: true }, headers)
    }
    if (!force && now.weekday === 0) {
        return jsonResponse({ reason: 'sunday', skipped: true }, headers)
    }

    const planDate = isFiniteString(body?.planDate) ? body.planDate.trim() : chicagoTodayDate(now)
    const supabase = createAdminClient()

    const { data: planRow, error: planErr } = await supabase
        .from('plans')
        .select('plan_date, plant_production, assignments, notes')
        .eq('plan_date', planDate)
        .maybeSingle()
    if (planErr) return errorResponse(planErr.message || 'Plan lookup failed', headers, 500)
    if (!planRow) return jsonResponse({ dryRun, planDate, reason: 'no-plan', skipped: true }, headers)

    const plantNameByCode = await fetchPlantNameMap(supabase)
    const plants = buildServerPayloads(planRow, plantNameByCode)
    if (plants.length === 0) {
        return jsonResponse({ dryRun, planDate, reason: 'no-plants-with-content', skipped: true }, headers)
    }

    const resolved = await resolveAllPlants(supabase, planDate, plants)

    /* `dryRun` short-circuits the actual email-service call but still
     * returns the full resolved payload (intended TO + CC + subject) so
     * the caller can verify routing without sending anything. Used by
     * the SQL smoke-test before flipping the live cron on. */
    if (dryRun) {
        return jsonResponse(
            {
                dryRun: true,
                planDate,
                plants: resolved.map((p) => ({
                    cc: p.cc,
                    code: p.code,
                    name: p.name,
                    sendCc: p.sendCc,
                    sendTo: p.sendTo,
                    subject: p.subject,
                    to: p.to
                })),
                source: 'cron',
                testMode: TEST_MODE,
                total: resolved.length
            },
            headers
        )
    }

    const results: Array<{ code: string; name: string; success: boolean; error?: string }> = []
    for (const plant of resolved) {
        const result = await sendOnePayload(plant)
        results.push({ code: plant.code, error: result.error, name: plant.name, success: result.success })
    }
    const sent = results.filter((r) => r.success).length
    return jsonResponse(
        {
            planDate,
            results,
            sent,
            source: 'cron',
            testMode: TEST_MODE,
            total: results.length
        },
        headers
    )
}

async function handleBootstrap(req: Request, headers: any): Promise<Response> {
    if (!isInternalServiceCall(req)) {
        return errorResponse('Forbidden', headers, 403)
    }
    const body = await parseBody(req)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const internalToken = Deno.env.get('EDGE_INTERNAL_TOKEN') ?? ''
    if (!supabaseUrl || !internalToken) {
        return errorResponse('SUPABASE_URL or EDGE_INTERNAL_TOKEN missing', headers, 500)
    }
    const edgeUrl =
        typeof body?.edgeUrl === 'string' && body.edgeUrl.trim()
            ? body.edgeUrl.trim().replace(/\/$/, '')
            : `${supabaseUrl.replace(/\/$/, '')}/functions/v1`
    const admin = createAdminClient()
    const { error } = await admin
        .from(CRON_CONFIG_TABLE)
        .upsert({
            edge_internal_token: internalToken,
            edge_url: edgeUrl,
            id: 1,
            updated_at: new Date().toISOString()
        })
    if (error) return errorResponse(error.message || 'Bootstrap failed', headers, 500)
    return jsonResponse({ edgeUrl, success: true }, headers)
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)

    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()
        const supabase = createAdminClient()

        switch (endpoint) {
            case 'preview': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(supabase, req, headers, body)
                if (auth instanceof Response) return auth
                if (!body || !Array.isArray(body.plants)) {
                    return errorResponse('plants array is required', headers, 400)
                }
                if (!isFiniteString(body.planDate)) {
                    return errorResponse('planDate is required', headers, 400)
                }
                const resolved = await resolveAllPlants(supabase, body.planDate.trim(), body.plants as PlantInput[])
                return jsonResponse(
                    {
                        planDate: body.planDate,
                        testMode: TEST_MODE,
                        testRedirectEmail: TEST_REDIRECT_EMAIL,
                        plants: resolved
                    },
                    headers
                )
            }
            case 'send': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(supabase, req, headers, body)
                if (auth instanceof Response) return auth
                if (!body || !Array.isArray(body.plants)) {
                    return errorResponse('plants array is required', headers, 400)
                }
                if (!isFiniteString(body.planDate)) {
                    return errorResponse('planDate is required', headers, 400)
                }
                const resolved = await resolveAllPlants(supabase, body.planDate.trim(), body.plants as PlantInput[])
                const results: Array<{ code: string; name: string; success: boolean; error?: string }> = []
                for (const plant of resolved) {
                    const result = await sendOnePlant(req, plant)
                    results.push({ code: plant.code, name: plant.name, ...result })
                }
                const sent = results.filter((r) => r.success).length
                return jsonResponse(
                    {
                        planDate: body.planDate,
                        testMode: TEST_MODE,
                        testRedirectEmail: TEST_REDIRECT_EMAIL,
                        sent,
                        total: results.length,
                        results
                    },
                    headers
                )
            }
            case 'cron-send':
                return await handleCronSend(req, headers)
            case 'bootstrap':
                return await handleBootstrap(req, headers)
            default:
                return errorResponse('Invalid endpoint', headers, 404)
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[daily-plan-email] handler failed:', message)
        return errorResponse('Internal server error', headers, 500)
    }
})
