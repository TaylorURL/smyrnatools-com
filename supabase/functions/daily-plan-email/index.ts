// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
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
 *               roster: [{ index, clockIn, destinationPlant, flag, isLeaveOff, isOutbound }],
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

/* Always-CC list — appended to every plant's resolved CC after the role-based
 * lookup (District Managers + Dispatchers / Dispatch Managers). These are
 * stakeholders outside the role table who still need a copy of every daily
 * plan email. Dedup against the role-resolved CCs is handled in
 * resolvePlantRecipients, so a user holding one of the CC roles AND appearing
 * here will appear exactly once. */
const STATIC_CC_RECIPIENTS: Recipient[] = [
    { email: 'jeremy.bey@hollingsheadcement.com' },
    { email: 'nicolas.delacruz@smyrnareadymix.com' }
]

/* Cron schedule windows. pg_cron fires at both 21:00 UTC (CDT) and 22:00
 * UTC (CST) for the weekday 4 PM run, plus 16:00 UTC (CDT) and 17:00 UTC
 * (CST) for the Saturday 11 AM run. The edge function self-checks Chicago
 * wall-clock against the per-day expected hour so off-DST and off-day
 * triggers are cheap no-ops.
 *
 * Day-of-week (Sunday = 0 … Saturday = 6):
 *   • Mon–Fri (1–5): send at 16:00 Chicago, target tomorrow's plan
 *   • Sat        (6): send at 11:00 Chicago, target Monday's plan (we
 *                     don't operate Sundays)
 *   • Sun        (0): skipped — no plan to ship
 */
const PLAN_TIME_ZONE = 'America/Chicago'
const CRON_HOUR_WEEKDAY_CT = 16
const CRON_HOUR_SATURDAY_CT = 11

/* Corrections cron — fires one hour after the 4 PM email (or 11 AM Saturday)
 * to diff live dispatch_data against the email_baseline snapshot taken
 * alongside the original send. Per-plant changes ship as an [UPDATED] email
 * to the same recipient set as the original. */
const CRON_HOUR_CORRECTIONS_WEEKDAY_CT = 17
const CRON_HOUR_CORRECTIONS_SATURDAY_CT = 12

/** The Chicago hour at which the cron send is allowed for a given weekday.
 *  Returns null on Sundays — the rest of the pipeline doesn't run Sunday. */
function expectedCronHourForWeekday(weekday: number): number | null {
    if (weekday === 0) return null
    if (weekday === 6) return CRON_HOUR_SATURDAY_CT
    return CRON_HOUR_WEEKDAY_CT
}

/** Mirror of `expectedCronHourForWeekday` for the corrections pass. */
function expectedCorrectionsHourForWeekday(weekday: number): number | null {
    if (weekday === 0) return null
    if (weekday === 6) return CRON_HOUR_CORRECTIONS_SATURDAY_CT
    return CRON_HOUR_CORRECTIONS_WEEKDAY_CT
}

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
    /* When present, the renderer prefixes the subject with [UPDATED] and
     * injects a "What changed since 4 PM" callout above the orders table. */
    corrections?: PlantCorrections
}

/* Per-plant diff payload built by `handleCronSendCorrections`. The renderer
 * treats each section as optional — at least one of added / removed /
 * changed is non-empty when the field is set, but any individual list may
 * be empty. */
interface OrderDiffSummary {
    orderNum: string
    customer: string
    startTime: string
    yardage: string
}

interface ChangedOrderDiff {
    orderNum: string
    customer: string
    startTime: string
    fields: Array<{ field: string; label: string; before: string; after: string }>
}

interface PlantCorrections {
    added: OrderDiffSummary[]
    removed: OrderDiffSummary[]
    changed: ChangedOrderDiff[]
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
    regionIds?: string[]
    regionPlantCodes?: string[]
    dispatcherUserIds?: string[]
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
 * Independent sources keep classifications from tangling:
 *
 *   • **TO (Plant Manager)** — `plants.manager_user_ids` for the plant,
 *     a flat array set via the Plants admin → Managers picker. Whoever
 *     the dispatcher attaches lands in TO.
 *   • **CC (District Manager)** — every user with a "District Manager"
 *     role whose home plant (`users_profiles.plant_code`) shares at
 *     least one district with the target plant. Districts live on
 *     `regions_plants.districts` (jsonb[]).
 *   • **CC (Dispatcher / Dispatch Manager)** — same lookup, scoped by
 *     `regions_plants.region_id` instead of districts.
 *
 * If a user shows up in both lists (rare — a DM also attached as a
 * named manager) the CC classification wins so they're CC'd rather
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
        dmUserIds: [],
        regionIds: [],
        regionPlantCodes: [],
        dispatcherUserIds: []
    }

    /* 2. Pull the regions_plants table once. We use it twice below:
     *    once for the district-overlap join that drives DM CCs, once for
     *    the region-membership join that drives Dispatcher / Dispatch
     *    Manager CCs. One table, two indexed lookups in memory beats
     *    two separate round-trips. */
    const { data: rpRows, error: rpErr } = await supabase
        .from('regions_plants')
        .select('plant_code, region_id, districts')
    if (rpErr) {
        debug.assignErr = `${debug.assignErr || ''} | regions_plants: ${rpErr.message}`.trim()
    }
    const normalizeDistricts = (value: unknown): string[] => {
        if (!Array.isArray(value)) return []
        return value
            .map((entry) =>
                typeof entry === 'string'
                    ? entry
                    : entry && typeof entry === 'object'
                      ? (entry as { name?: string }).name || ''
                      : ''
            )
            .map((s) => String(s || '').trim())
            .filter((s) => s.length > 0)
    }
    const districtsByPlant = new Map<string, string[]>()
    const regionIdsByPlant = new Map<string, Set<string>>()
    ;(rpRows || []).forEach((row: { plant_code?: string; region_id?: string; districts?: unknown }) => {
        if (!row?.plant_code) return
        const list = normalizeDistricts(row.districts)
        if (list.length > 0) {
            const existing = districtsByPlant.get(row.plant_code) || []
            districtsByPlant.set(row.plant_code, Array.from(new Set([...existing, ...list])))
        }
        if (row?.region_id) {
            const set = regionIdsByPlant.get(row.plant_code) || new Set<string>()
            set.add(row.region_id)
            regionIdsByPlant.set(row.plant_code, set)
        }
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

    /* Region-membership coverage for dispatchers / dispatch managers.
     * The target plant can belong to more than one region row (rare but
     * the schema allows it), so we union the region_ids and then collect
     * every plant_code that lives under any of those regions. */
    const targetRegionIds = Array.from(regionIdsByPlant.get(queriedAs) || [])
    debug.regionIds = targetRegionIds
    let regionPlantCodes: string[] = []
    if (targetRegionIds.length > 0) {
        const regionSet = new Set(targetRegionIds)
        const coverage = new Set<string>()
        regionIdsByPlant.forEach((ids, code) => {
            ids.forEach((id) => {
                if (regionSet.has(id)) coverage.add(code)
            })
        })
        regionPlantCodes = Array.from(coverage)
        debug.regionPlantCodes = regionPlantCodes
    }

    /* 3. Look up DM + Dispatcher / Dispatch Manager candidates in a single
     *    roles fetch, then narrow each set with the correct plant scope.
     *    DMs scope to the district coverage set; dispatchers scope to the
     *    region coverage set. */
    let dmUserIds: string[] = []
    let dispatcherUserIds: string[] = []
    const needsDmLookup = dmPlantCodes.length > 0
    const needsRegionLookup = regionPlantCodes.length > 0
    if (needsDmLookup || needsRegionLookup) {
        const { data: roleRows } = await supabase.from('users_roles').select('id, name')
        const dmRoleIds: string[] = []
        const dispatcherRoleIds: string[] = []
        ;(roleRows || []).forEach((r: { id: string; name?: string }) => {
            const name = (r?.name || '').trim()
            if (/district manager/i.test(name)) {
                dmRoleIds.push(r.id)
                return
            }
            /* "Dispatcher" and "Dispatch Manager" both qualify per the
             * dispatcher's spec. The role-name match has to admit either
             * exact label without leaking other "dispatch"-prefixed
             * roles (none exist today but the regex keeps that boundary
             * tight). */
            if (/^dispatch(er|\s*manager)\s*$/i.test(name)) {
                dispatcherRoleIds.push(r.id)
            }
        })

        const allRoleIds = Array.from(new Set([...dmRoleIds, ...dispatcherRoleIds]))
        if (allRoleIds.length > 0) {
            const { data: perms } = await supabase
                .from('users_permissions')
                .select('user_id, role_id')
                .in('role_id', allRoleIds)
            const dmRoleSet = new Set(dmRoleIds)
            const dispatcherRoleSet = new Set(dispatcherRoleIds)
            const dmCandidateSet = new Set<string>()
            const dispatcherCandidateSet = new Set<string>()
            ;(perms || []).forEach((p: { user_id: string; role_id: string }) => {
                if (dmRoleSet.has(p.role_id)) dmCandidateSet.add(p.user_id)
                if (dispatcherRoleSet.has(p.role_id)) dispatcherCandidateSet.add(p.user_id)
            })
            const allCandidateIds = Array.from(new Set([...dmCandidateSet, ...dispatcherCandidateSet]))
            if (allCandidateIds.length > 0) {
                const { data: profilesScoped } = await supabase
                    .from('users_profiles')
                    .select('id, plant_code')
                    .in('id', allCandidateIds)
                const dmCoverage = new Set(dmPlantCodes)
                const regionCoverage = new Set(regionPlantCodes)
                ;(profilesScoped || []).forEach((p: { id: string; plant_code?: string }) => {
                    if (!p?.id || !p.plant_code) return
                    if (needsDmLookup && dmCandidateSet.has(p.id) && dmCoverage.has(p.plant_code)) {
                        dmUserIds.push(p.id)
                    }
                    if (needsRegionLookup && regionCoverage.has(p.plant_code)) {
                        if (dispatcherCandidateSet.has(p.id)) dispatcherUserIds.push(p.id)
                    }
                })
            }
        }
        dmUserIds = Array.from(new Set(dmUserIds))
        dispatcherUserIds = Array.from(new Set(dispatcherUserIds))
        debug.dmUserIds = dmUserIds
        debug.dispatcherUserIds = dispatcherUserIds
    }

    /* 4. Fetch profile + email rows for every recipient candidate (PMs
     *    via manager_user_ids, DMs via the district join, dispatchers /
     *    dispatch managers via the region join), then split into TO and
     *    CC. Both coverage roles land in CC; PMs land in TO unless the
     *    same user also has a CC classification, in which case CC wins. */
    const ccCandidateIds = Array.from(new Set([...dmUserIds, ...dispatcherUserIds]))
    const allIds = Array.from(new Set([...managerIds, ...ccCandidateIds]))
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
    const ccSet = new Set(ccCandidateIds)
    const toBuild = (id: string): Recipient | null => {
        const email = emailById.get(id)
        if (!email) return null
        const profile = profileById.get(id)
        const name = profile
            ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined
            : undefined
        return { email, name }
    }

    /* CC order: district managers first, then dispatchers / dispatch
     * managers — keeps the most senior coverage layer at the top of the
     * recipient list when the dispatcher reviews who's on it. Email
     * clients usually preserve this order. Dedup is via the ccEmails set
     * so a user holding more than one classification appears exactly once. */
    const cc: Recipient[] = []
    const ccEmails = new Set<string>()
    const pushCc = (id: string) => {
        const r = toBuild(id)
        if (!r) return
        if (ccEmails.has(r.email)) return
        ccEmails.add(r.email)
        cc.push(r)
    }
    dmUserIds.forEach(pushCc)
    dispatcherUserIds.forEach(pushCc)

    const to: Recipient[] = []
    managerIds
        .filter((id) => !ccSet.has(id))
        .forEach((id) => {
            const r = toBuild(id)
            if (r) to.push(r)
        })

    /* Append the always-CC list last so the role-based recipients keep their
     * priority ordering at the top of the CC line. Dedup against the
     * role-resolved CC emails AND the TO list so a static recipient who also
     * happens to hold a CC role — or who's listed as a plant manager —
     * appears exactly once. */
    const toEmails = new Set(to.map((r) => r.email))
    STATIC_CC_RECIPIENTS.forEach((r) => {
        if (!r.email || ccEmails.has(r.email) || toEmails.has(r.email)) return
        ccEmails.add(r.email)
        cc.push(r)
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
async function resolveAllPlants(supabase: any, planDate: string, plants: PlantInput[]): Promise<ResolvedPlant[]> {
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
            corrections: input?.corrections || null,
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

/** Returns `tomorrow` in Chicago wall-clock days as `YYYY-MM-DD`. Anchored
 *  at noon UTC so DST hour-shifts can't bump the date off by one. */
function chicagoTomorrowDate(now = chicagoNow()): string {
    const base = new Date(Date.UTC(now.year, now.month - 1, now.day, 12, 0, 0))
    base.setUTCDate(base.getUTCDate() + 1)
    const yyyy = base.getUTCFullYear()
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(base.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

/** Returns the next working date that should receive the email. On Saturday
 *  this jumps to Monday because the plant doesn't operate Sundays; every
 *  other day it's tomorrow. Anchored at noon UTC like the other helpers so
 *  DST shifts can't slip the date by a day. */
function chicagoNextWorkingDate(now = chicagoNow()): string {
    const base = new Date(Date.UTC(now.year, now.month - 1, now.day, 12, 0, 0))
    const skipSunday = now.weekday === 6 ? 2 : 1
    base.setUTCDate(base.getUTCDate() + skipSunday)
    const yyyy = base.getUTCFullYear()
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(base.getUTCDate()).padStart(2, '0')
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

/* Sentinel start times the dispatcher uses to flag non-production orders.
 * MUST match `src/app/constants/planConstants.js`:
 *   CANCELLED_ORDER_START = '17:00'  → cancelled at the customer
 *   TEST_ORDER_START      = '18:00'  → dispatcher test entry
 * Earlier versions of this file used '00:00'/'99:99' which silently let
 * every cancelled (17:00) order through onto the cron email's schedule
 * AND into the clock-in pool simulation. */
const CANCELLED_START = '17:00'
const TEST_START = '18:00'

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

/* ── Clock-in pipeline (port of Plan Dashboard logic) ────────────────
 *
 * The dashboard's clock-in roster comes from three pieces, all ported
 * here so the cron renders the same numbers without depending on the
 * React hook chain that drives `usePlanScheduleData` / the dashboard
 * board:
 *
 *   1. `computeClockInRowsInternal` — per-plant local clock-ins. For each
 *      order at a plant, simulate the pool right before its dispatch,
 *      compute how many fresh operators need to clock in to cover the
 *      shortfall, and back-time their clock-in to (start − cycle to job
 *      − prep). Mirrors `src/utils/plan/planPool.ts:computeClockInRows`.
 *   2. `buildOutboundClockInRowsInternal` — clock-ins for operators
 *      leaving a plant to help another. Each outbound assignment
 *      contributes one row per driver, with timing dependent on whether
 *      the driver is deadheading or pulling a load from the source
 *      plant. Mirrors `PlanDashboardClockInBoard.buildOutboundClockInRows`.
 *   3. `buildPlantRosterInternal` — combines local + outbound rows into
 *      slot-numbered roster rows that the email template renders. Slots
 *      beyond the day's needed count read as "leave off" so the manager
 *      sees who not to bring in.
 *
 * Cron-time travel times: we don't run live Google traffic on the cron,
 * so the lookup falls back to the order's own `toJobTime` from the
 * dispatch report (same fallback the dashboard uses by passing
 * `undefined` for `getTravelOverrides`). For outbound clock-ins we use
 * the static `plant_travel_times` table; rows without an entry are
 * skipped (no travel time → can't compute clock-in offset → can't
 * render the slot reliably). */

const PLAN_META_KEY_INTERNAL = '_meta'
const PRE_TRIP_MIN = 15
const LOAD_MIN = 10
const SLUMP_MIN = 5
const EARLY_ARRIVAL_MIN = 5
const TRUCK_ON_SITE_MIN = 30

function snapToFiveMin(value: number | null | undefined): number | null {
    if (!Number.isFinite(value as number)) return null
    return Math.round((value as number) / 5) * 5
}

function getDayOfWeekForDateStr(dateStr: string | null | undefined): number | null {
    if (!dateStr || typeof dateStr !== 'string') return null
    const parts = dateStr.split('-')
    if (parts.length !== 3) return null
    const [y, m, d] = parts.map((n) => parseInt(n, 10))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function getPoolDayMultiplier(planDate: string | null | undefined): number {
    const dow = getDayOfWeekForDateStr(planDate)
    if (dow == null) return 1
    if (dow === 0) return 0
    if (dow === 6) return 0.5
    return 1
}

function isSaturdayDate(planDate: string | null | undefined): boolean {
    return getPoolDayMultiplier(planDate) === 0.5
}

function adjustPoolForDate(base: number, planDate: string | null | undefined): number {
    const multiplier = getPoolDayMultiplier(planDate)
    if (multiplier >= 1) return Number.isFinite(base) ? base : 0
    if (multiplier <= 0) return 0
    return Math.floor((Number.isFinite(base) ? base : 0) * multiplier)
}

function getMissingOperators(plantProduction: Record<string, any>, plantCode: string): number {
    const raw = plantProduction?.[PLAN_META_KEY_INTERNAL]?.missingByPlant?.[plantCode]
    const value = parseInt(raw, 10)
    return Number.isFinite(value) && value > 0 ? value : 0
}

function getSaturdayOverride(plantProduction: Record<string, any>, plantCode: string): number | null {
    const raw = plantProduction?.[PLAN_META_KEY_INTERNAL]?.saturdayOverrideByPlant?.[plantCode]
    if (raw == null || raw === '') return null
    const value = parseInt(raw, 10)
    return Number.isFinite(value) && value >= 0 ? value : null
}

function getEffectiveBaseForPlant(
    rawBase: number,
    plantCode: string,
    plantProduction: Record<string, any>,
    planDate: string
): number {
    if (isSaturdayDate(planDate)) {
        const override = getSaturdayOverride(plantProduction, plantCode)
        if (override != null) return Math.max(0, override)
    }
    const adjusted = adjustPoolForDate(rawBase, planDate)
    const missing = getMissingOperators(plantProduction, plantCode)
    return Math.max(0, adjusted - missing)
}

interface ClockInRow {
    count: number
    plantCode: string
    time: number
}

interface OutboundClockInRow {
    isLoadedFromPlant: boolean
    plantCode: string
    time: number | null
    toPlant: string
}

interface RosterRow {
    clockIn: string
    destinationPlant: string
    flag: string
    index: number
    isLeaveOff: boolean
    isOutbound: boolean
    operatorHours?: number | null
    operatorName?: string
    operatorUnmatched?: boolean
}

function computeClockInRowsInternal(orders: any[], baseByPlant: Record<string, number>): ClockInRow[] {
    const rows: ClockInRow[] = []
    const byPlant = new Map<string, any[]>()
    for (const order of orders || []) {
        if (isExcludedOrder(order)) continue
        if (timeToMin(order?.startTime) == null) continue
        if (!order?.plantCode) continue
        const list = byPlant.get(order.plantCode) || []
        list.push(order)
        byPlant.set(order.plantCode, list)
    }
    byPlant.forEach((plantOrders, code) => {
        const base = baseByPlant?.[code] ?? 0
        if (base <= 0) return
        plantOrders.sort((a, b) => (timeToMin(a.startTime) ?? 0) - (timeToMin(b.startTime) ?? 0))
        const events: Array<{ count: number; time: number; type: 'dispatch' | 'return' }> = []
        let clockedIn = 0
        for (const order of plantOrders) {
            const startMin = timeToMin(order.startTime)
            if (startMin == null) continue
            const truckCount = getCalculatedTruckCount(order)
            if (!truckCount) continue
            const spacing = parseDurationMin(order?.rate) ?? 5
            const toJobMin = parseDurationMin(order?.toJobTime) ?? 20
            const toPlantMin = parseDurationMin(order?.toPlantTime) ?? toJobMin
            const cycleMin = toJobMin + TRUCK_ON_SITE_MIN + toPlantMin
            const loadSize = parseFloat(order?.loadSize) || 0
            const yardage = parseFloat(order?.yardage) || 0
            const tripsTotal = loadSize > 0 && yardage > 0 ? Math.max(1, Math.ceil(yardage / loadSize)) : truckCount
            let pool = clockedIn
            for (const ev of events) {
                if (ev.time > startMin) continue
                pool += ev.type === 'return' ? ev.count : -ev.count
            }
            const shortfall = Math.max(0, truckCount - pool)
            const toClockIn = Math.min(shortfall, base - clockedIn)
            const arrivalPrepMin = PRE_TRIP_MIN + LOAD_MIN + SLUMP_MIN + EARLY_ARRIVAL_MIN
            const clockInOffset = toJobMin + arrivalPrepMin
            const poolBase = Math.max(0, pool)
            for (let i = 0; i < toClockIn; i++) {
                const dispatchIdx = poolBase + i
                const slot = startMin + dispatchIdx * spacing
                const raw = Math.max(0, slot - clockInOffset)
                const t = Math.round(raw / 5) * 5
                rows.push({ count: 1, plantCode: code, time: t })
            }
            clockedIn += toClockIn
            events.push({ count: truckCount, time: startMin, type: 'dispatch' })
            for (let i = 0; i < truckCount; i++) {
                const j = tripsTotal - 1 - i
                if (j < 0) continue
                const lastTripIdx = Math.floor(j / truckCount) * truckCount + i
                const returnTime = startMin + lastTripIdx * spacing + cycleMin
                events.push({ count: 1, time: returnTime, type: 'return' })
            }
        }
    })
    return rows
}

function buildOutboundClockInRowsInternal(
    assignments: any[],
    plantProduction: Record<string, any>,
    travelMinutesByPair: Map<string, number>
): OutboundClockInRow[] {
    const rows: OutboundClockInRow[] = []
    for (const a of assignments || []) {
        if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) continue
        const travelKey = `${a.fromPlant}->${a.toPlant}`
        const travelMinutes = travelMinutesByPair.get(travelKey)
        if (!Number.isFinite(travelMinutes)) continue
        const isLoadedFromPlant = !!a.loadFromPlant
        let destinationOrder: any = null
        if (a.forOrderId) {
            const destOrders = plantProduction?.[a.toPlant]?.orders || []
            destinationOrder = destOrders.find((o: any) => (o.orderId || o.orderNum) === a.forOrderId) || null
        }
        const toJobMinutes = parseDurationMin(destinationOrder?.toJobTime)
        const loadedTravelToJob =
            (travelMinutes as number) + (Number.isFinite(toJobMinutes) ? (toJobMinutes as number) : 0)
        const clockInOffset = isLoadedFromPlant
            ? PRE_TRIP_MIN + LOAD_MIN + loadedTravelToJob
            : PRE_TRIP_MIN + (travelMinutes as number)
        const driverTimes = buildAssignmentDriverTimes(a)
        for (const driver of driverTimes) {
            if (!Number.isFinite(driver.arriveMin)) continue
            const rawClockIn = Math.max(0, (driver.arriveMin as number) - clockInOffset)
            rows.push({
                isLoadedFromPlant,
                plantCode: a.fromPlant,
                time: snapToFiveMin(rawClockIn),
                toPlant: a.toPlant
            })
        }
    }
    return rows
}

function buildPlantRosterInternal(
    plantCode: string,
    base: number,
    localRows: ClockInRow[],
    outboundRows: OutboundClockInRow[]
): RosterRow[] {
    const local = localRows
        .filter((r) => r.plantCode === plantCode)
        .map((r) => ({ outbound: null as OutboundClockInRow | null, time: snapToFiveMin(r.time) }))
    const outbound = outboundRows
        .filter((r) => r.plantCode === plantCode)
        .map((r) => ({ outbound: r, time: snapToFiveMin(r.time) }))
    const combined = [...local, ...outbound]
        .filter((entry) => entry.time != null)
        .sort((a, b) => (a.time as number) - (b.time as number))
    const slotCount = Math.max(base, combined.length)
    if (slotCount === 0) return []
    const slots: RosterRow[] = []
    for (let i = 0; i < slotCount; i++) {
        const entry = combined[i]
        if (!entry) {
            slots.push({
                clockIn: '',
                destinationPlant: '',
                flag: 'Leave off',
                index: i + 1,
                isLeaveOff: true,
                isOutbound: false
            })
            continue
        }
        const time = entry.time as number
        const hh = String(Math.floor(time / 60)).padStart(2, '0')
        const mm = String(time % 60).padStart(2, '0')
        slots.push({
            clockIn: `${hh}:${mm}`,
            destinationPlant: entry.outbound ? entry.outbound.toPlant : '',
            flag: entry.outbound ? (entry.outbound.isLoadedFromPlant ? 'Loaded out' : 'Outbound') : '',
            index: i + 1,
            isLeaveOff: false,
            isOutbound: !!entry.outbound
        })
    }
    return slots
}

function composeAddress(order: any): string {
    const parts = [order?.address, order?.city, order?.state]
        .map((p) => (p == null ? '' : String(p).trim()))
        .filter(Boolean)
    return parts.join(', ')
}

/**
 * Build every per-plant payload from a saved `plans` row. Mirrors
 * `DailyPlanEmailService.buildAllPlantEmailPayloads`, now including the
 * operator clock-in roster computed via the ported Plan-Dashboard logic
 * (`computeClockInRowsInternal` + `buildOutboundClockInRowsInternal` +
 * `buildPlantRosterInternal`). `needsHelp` remains false on every order
 * — the pool-simulation that drives that flag still lives in the
 * client-only hook chain.
 */
function buildServerPayloads(
    planRow: { plant_production?: Record<string, any>; assignments?: any[]; notes?: string },
    plantNameByCode: Record<string, string>,
    planDate: string,
    activeMixerBaseByPlant: Record<string, number>,
    travelMinutesByPair: Map<string, number>,
    mixerOperatorsByPlant: Record<string, MixerOperator[]> = {},
    workedHoursByOperatorId: Record<string, number> = {},
    matchedOperatorIds: Set<string> = new Set()
): PlantInput[] {
    const production = planRow?.plant_production || {}
    const assignments = Array.isArray(planRow?.assignments) ? planRow.assignments : []
    const notes = typeof planRow?.notes === 'string' ? planRow.notes : ''
    const out: PlantInput[] = []

    /* Outbound clock-in rows and the day-adjusted base both apply
     * across every plant in this plan, so compute them once outside
     * the per-plant loop. The roster builder splices the plant-local
     * slice in below. */
    const outboundRows = buildOutboundClockInRowsInternal(assignments, production, travelMinutesByPair)
    const outboundCountByPlant = new Map<string, number>()
    outboundRows.forEach((row) => {
        outboundCountByPlant.set(row.plantCode, (outboundCountByPlant.get(row.plantCode) || 0) + 1)
    })

    const codes = Object.keys(production).filter((c) => c && c !== '_meta')
    for (const plantCode of codes) {
        const block = production[plantCode] || {}
        const rawOrders = Array.isArray(block.orders) ? block.orders : []
        /* Cancelled (start = `17:00`) and dispatcher-test (`18:00`)
         * orders are excluded from every per-plant section the email
         * surfaces — KPI counts, orders table, and the clock-in roster
         * (the dashboard's `computeClockInRows` does its own filter,
         * but filtering at the source keeps the orders array we feed
         * in consistent across paths). */
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

        const customerSet = new Set(
            orders
                .map((o: any) =>
                    String(o.customer || '')
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        )
        const yardage = orders.reduce((sum: number, o: any) => sum + (o.yardage || 0), 0)
        const loadCount = orders.reduce((sum: number, o: any) => sum + (o.truckCount || 0), 0)
        const startMinutes = orders
            .map((o: any) => timeToMin(o.startTime))
            .filter((m: number | null) => Number.isFinite(m)) as number[]
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
                    Number.isFinite(dt.arriveMin) &&
                    Number.isFinite(dt.leaveMin) &&
                    (dt.leaveMin as number) > (dt.arriveMin as number)
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
        const byArrive = (a: any, b: any) =>
            (timeToMin(a.arriveTime) ?? Infinity) - (timeToMin(b.arriveTime) ?? Infinity)
        helpIn.sort(byArrive)
        helpOut.sort(byArrive)

        /* Previously this `continue` skipped any plant whose schedule was
         * empty. The daily plan email is now expected to ship every weekday
         * (and Saturday) regardless of whether dispatch data has populated
         * for the target date, so even a plant with no orders + no help
         * still emits a payload — the email template renders an "No orders
         * scheduled for this plant today." block in that case and the plant
         * manager at least knows the system reached them at the usual time. */

        /* Clock-in roster — port of `PlanDashboardClockInBoard`. Effective
         * base = active mixer operator count, day-adjusted (half on
         * Saturdays unless overridden, zero on Sundays) and reduced by
         * any operators the dispatcher marked missing on this plan.
         * Local base = effective base − outbound commitments, mirroring
         * the dashboard's pre-clock-in subtraction so local rows don't
         * double-count operators already leaving for help. The roster
         * itself is slot-numbered for the email template, with
         * leave-off slots emitted at the tail when base exceeds need. */
        const rawBase = activeMixerBaseByPlant[plantCode] || 0
        const effectiveBase = getEffectiveBaseForPlant(rawBase, plantCode, production, planDate)
        const outboundReserved = outboundCountByPlant.get(plantCode) || 0
        const localBase = Math.max(0, effectiveBase - outboundReserved)
        const localBaseByPlant: Record<string, number> = { [plantCode]: localBase }
        /* Tag every order with the production-map key as its plant —
         * matches `PlanDashboardClockInBoard.flattenOrders`, which
         * ALWAYS overrides any `order.plantCode` field with the key
         * the order lives under. Preserving an existing `plantCode`
         * here would let stale field data desync the clock-in math
         * from the dashboard. */
        const flattenedOrders = liveOrders.map((o: any) => ({ ...o, plantCode }))
        const localRows = computeClockInRowsInternal(flattenedOrders, localBaseByPlant)
        const roster = buildPlantRosterInternal(plantCode, effectiveBase, localRows, outboundRows)

        /* Roster slots are numbered only — the Dayforce-backed name + weekly
         * hours ranking was retired with the dashboard board change. Each slot
         * carries only its index, clock-in time, outbound destination, and
         * leave-off flag; the email template renders them as "Operator 1",
         * "Operator 2", etc. The fetched `mixerOperatorsByPlant` /
         * `workedHoursByOperatorId` / `matchedOperatorIds` are intentionally
         * unused here so a future re-introduction of named slots can plug
         * back into the same pipeline without re-fetching Dayforce data. */

        out.push({
            code: plantCode,
            helpIn,
            helpOut,
            kpi,
            name: plantNameByCode[plantCode] || '',
            notes,
            orders,
            roster
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

interface MixerOperator {
    badge: string
    employeeId: string
    name: string
    plantCode: string
}

/** Token-sorted canonical name key — verbatim port of `canonicalNameKey`
 *  in `OperatorNameLookupUtility.ts` so server-side Dayforce↔operator
 *  matching produces the same keys the client uses. Inlined (not imported)
 *  to keep the edge bundle self-contained across the src/ boundary. */
function canonicalNameKey(name?: string | null): string | null {
    if (!name) return null
    const stripped = String(name)
        .toLowerCase()
        .replace(/\s+\d+\s*$/, '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const tokens = stripped.split(' ').filter(Boolean)
    if (tokens.length === 0) return null
    return tokens.sort().join(' ')
}

/** Monday (ISO week start) of `dateStr`, computed in UTC so a plain
 *  YYYY-MM-DD never drifts a day. Returns YYYY-MM-DD. */
function isoWeekStartStr(dateStr: string): string {
    const date = new Date(`${dateStr}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return ''
    const isoDay = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() - (isoDay - 1))
    return date.toISOString().slice(0, 10)
}

/** `dateStr` shifted by `deltaDays`, UTC-safe, as YYYY-MM-DD. */
function shiftDateStr(dateStr: string, deltaDays: number): string {
    const date = new Date(`${dateStr}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return ''
    date.setUTCDate(date.getUTCDate() + deltaDays)
    return date.toISOString().slice(0, 10)
}

/** Active mixer operators with the fields needed to name and rank them on
 *  the clock-in roster. Mixer Operators only — the clock-in board staffs
 *  concrete pours, so tractor (haul-side) operators never appear. */
async function fetchActiveMixerOperators(supabase: any): Promise<MixerOperator[]> {
    const { data, error } = await supabase
        .from('operators')
        .select('employee_id, name, smyrna_id, plant_code')
        .eq('status', 'Active')
        .eq('position', 'Mixer Operator')
    if (error) {
        console.warn('[daily-plan-email] fetchActiveMixerOperators failed:', error.message)
        return []
    }
    return (data || []).map((row: any) => ({
        badge: row.smyrna_id ? String(row.smyrna_id) : '',
        employeeId: row.employee_id,
        name: (row.name || '').trim(),
        plantCode: row.plant_code || ''
    }))
}

/** Each mixer operator's hours worked so far this pay week (ISO Monday
 *  through the day before `planDate`), keyed by operator id. Sums Dayforce
 *  `actual_hours` for the window and maps each Dayforce employee to an
 *  operator via the same name-canonical / badge match the client uses, so
 *  the email's "current hours" agrees with the dashboard. The window is a
 *  few days (well under PostgREST's 1000-row cap), so no pagination. */
async function fetchWorkedHoursByOperator(
    supabase: any,
    planDate: string,
    mixerOperators: MixerOperator[]
): Promise<{ matchedOperatorIds: Set<string>; workedHoursByOperatorId: Record<string, number> }> {
    const weekStart = isoWeekStartStr(planDate)
    const workedEnd = shiftDateStr(planDate, -1)
    if (!weekStart || !workedEnd || workedEnd < weekStart) {
        return { matchedOperatorIds: new Set(), workedHoursByOperatorId: {} }
    }

    const operatorByName = new Map<string, string>()
    const operatorByBadge = new Map<string, string>()
    for (const operator of mixerOperators) {
        const key = canonicalNameKey(operator.name)
        if (key && !operatorByName.has(key)) operatorByName.set(key, operator.employeeId)
        if (operator.badge && !operatorByBadge.has(operator.badge))
            operatorByBadge.set(operator.badge, operator.employeeId)
    }

    const { data: employees, error: empErr } = await supabase
        .from('dayforce_employees')
        .select('dayforce_employee_id, display_name, first_name, last_name, employee_badge')
    if (empErr) {
        console.warn('[daily-plan-email] dayforce_employees fetch failed:', empErr.message)
        return { matchedOperatorIds: new Set(), workedHoursByOperatorId: {} }
    }
    const operatorIdByEmployeeId = new Map<string, string>()
    for (const employee of employees || []) {
        const nameKey =
            canonicalNameKey(employee.display_name) ||
            canonicalNameKey([employee.first_name, employee.last_name].filter(Boolean).join(' '))
        let operatorId: string | undefined
        if (nameKey && operatorByName.has(nameKey)) operatorId = operatorByName.get(nameKey)
        if (!operatorId && employee.employee_badge && operatorByBadge.has(String(employee.employee_badge))) {
            operatorId = operatorByBadge.get(String(employee.employee_badge))
        }
        if (operatorId) operatorIdByEmployeeId.set(employee.dayforce_employee_id, operatorId)
    }

    const { data: shifts, error: shiftErr } = await supabase
        .from('dayforce_shifts')
        .select('dayforce_employee_id, actual_hours, shift_date')
        .gte('shift_date', weekStart)
        .lte('shift_date', workedEnd)
    if (shiftErr) {
        console.warn('[daily-plan-email] dayforce_shifts fetch failed:', shiftErr.message)
        return { matchedOperatorIds: new Set(operatorIdByEmployeeId.values()), workedHoursByOperatorId: {} }
    }
    const workedHoursByOperatorId: Record<string, number> = {}
    for (const shift of shifts || []) {
        const operatorId = operatorIdByEmployeeId.get(shift.dayforce_employee_id)
        if (!operatorId) continue
        workedHoursByOperatorId[operatorId] =
            (workedHoursByOperatorId[operatorId] || 0) + (Number(shift.actual_hours) || 0)
    }
    return { matchedOperatorIds: new Set(operatorIdByEmployeeId.values()), workedHoursByOperatorId }
}

/** Bundles the two roster-naming inputs: each plant's active mixer operators
 *  and every operator's hours-worked-this-week. Used by both the 4 PM send
 *  and the 5 PM corrections pass so they name and rank operators identically. */
async function fetchOperatorScheduleData(
    supabase: any,
    planDate: string
): Promise<{
    matchedOperatorIds: Set<string>
    mixerOperatorsByPlant: Record<string, MixerOperator[]>
    workedHoursByOperatorId: Record<string, number>
}> {
    const mixerOperators = await fetchActiveMixerOperators(supabase)
    const { matchedOperatorIds, workedHoursByOperatorId } = await fetchWorkedHoursByOperator(
        supabase,
        planDate,
        mixerOperators
    )
    const mixerOperatorsByPlant: Record<string, MixerOperator[]> = {}
    for (const operator of mixerOperators) {
        if (!operator.plantCode) continue
        if (!mixerOperatorsByPlant[operator.plantCode]) mixerOperatorsByPlant[operator.plantCode] = []
        mixerOperatorsByPlant[operator.plantCode].push(operator)
    }
    return { matchedOperatorIds, mixerOperatorsByPlant, workedHoursByOperatorId }
}

/** Active mixer-operator headcount per plant — the canonical "base"
 *  number the Plan Dashboard uses before day-of-week multipliers and
 *  the dispatcher's missing / Saturday-override edits apply. Mirrors
 *  `ReportService.fetchActiveMixerCountsByPlant`: count `operators`
 *  rows where status='Active' AND position='Mixer Operator' grouped
 *  by plant_code. */
async function fetchActiveMixerBaseByPlant(supabase: any): Promise<Record<string, number>> {
    const { data, error } = await supabase
        .from('operators')
        .select('plant_code')
        .eq('status', 'Active')
        .eq('position', 'Mixer Operator')
    if (error) {
        console.warn('[daily-plan-email] fetchActiveMixerBaseByPlant failed:', error.message)
        return {}
    }
    const counts: Record<string, number> = {}
    ;(data || []).forEach((row: { plant_code?: string }) => {
        if (!row?.plant_code) return
        counts[row.plant_code] = (counts[row.plant_code] || 0) + 1
    })
    return counts
}

/** Static plant-to-plant drive minutes used by the outbound clock-in
 *  math. The Plan Dashboard's live dashboard uses Google traffic on
 *  the client; the cron has no UI session and can't run that path, so
 *  we fall back to the dispatcher-maintained `plant_travel_times`
 *  table. Outbound clock-in rows for a plant pair with no row in this
 *  table will be skipped (same behavior the dashboard exhibits when
 *  the live lookup latches unavailable). */
async function fetchTravelMinutesByPair(supabase: any): Promise<Map<string, number>> {
    const { data, error } = await supabase
        .from('plant_travel_times')
        .select('from_plant_code, to_plant_code, travel_minutes')
    const map = new Map<string, number>()
    if (error) {
        console.warn('[daily-plan-email] fetchTravelMinutesByPair failed:', error.message)
        return map
    }
    ;(data || []).forEach((row: { from_plant_code?: string; to_plant_code?: string; travel_minutes?: number }) => {
        if (!row?.from_plant_code || !row?.to_plant_code) return
        if (!Number.isFinite(row.travel_minutes)) return
        map.set(`${row.from_plant_code}->${row.to_plant_code}`, row.travel_minutes as number)
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
    const expectedHour = expectedCronHourForWeekday(now.weekday)
    if (!force && expectedHour == null) {
        /* Sunday — every downstream surface assumes plants don't run that
         * day. Bail without touching plans. */
        return jsonResponse({ reason: 'sunday', skipped: true }, headers)
    }
    if (!force && now.hour !== expectedHour) {
        return jsonResponse(
            {
                chicagoHour: now.hour,
                expectedHour,
                reason: 'outside-send-window',
                skipped: true,
                weekday: now.weekday
            },
            headers
        )
    }

    /* On Saturday the cron targets Monday's plan because Sunday is closed —
     * `chicagoNextWorkingDate` skips Sundays automatically. Other days
     * still ship tomorrow's plan. Callers can override via body.planDate
     * (used by the SQL dry-run smoke test). */
    const planDate = isFiniteString(body?.planDate) ? body.planDate.trim() : chicagoNextWorkingDate(now)
    const supabase = createAdminClient()

    const { data: planRow, error: planErr } = await supabase
        .from('plans')
        .select('plan_date, plant_production, assignments, notes')
        .eq('plan_date', planDate)
        .maybeSingle()
    if (planErr) return errorResponse(planErr.message || 'Plan lookup failed', headers, 500)

    /* If no dispatcher has touched tomorrow's plan yet, fall back to the live
     * dispatch_data for the target date so the email still has the latest
     * schedule. If that's empty too, synthesize an empty plan — the cron
     * always ships at its window; an empty schedule produces "no orders
     * scheduled" emails rather than silently skipping the daily send. */
    let baseProduction: Record<string, any> = planRow?.plant_production || {}
    const baseProductionPlantCount = Object.keys(baseProduction).filter((c) => c && c !== PLAN_META_KEY_INTERNAL).length
    if (!planRow || baseProductionPlantCount === 0) {
        try {
            const live = await fetchLivePlantProduction(supabase, planDate)
            if (live && Object.keys(live).length > 0) baseProduction = live
        } catch {
            /* Live dispatch fetch is best-effort here — if it fails we still
             * proceed with whatever baseProduction we have (possibly empty)
             * and the configured-plants fallback below catches the email so
             * nothing is silently dropped. */
        }
    }
    const effectivePlanRow = {
        assignments: Array.isArray(planRow?.assignments) ? planRow.assignments : [],
        notes: typeof planRow?.notes === 'string' ? planRow.notes : '',
        plant_production: baseProduction
    }

    const [plantNameByCode, activeMixerBaseByPlant, travelMinutesByPair] = await Promise.all([
        fetchPlantNameMap(supabase),
        fetchActiveMixerBaseByPlant(supabase),
        fetchTravelMinutesByPair(supabase)
    ])
    /* Operator-roster naming + weekly-hours ranking was retired in v2026.23.8 —
     * the email template just renders "Operator 1", "Operator 2", etc. The
     * Dayforce fetch chain (`fetchOperatorScheduleData` → `dayforce_shifts`
     * + `dayforce_employees`) is no longer called here, both because its
     * output isn't used and because a failure mode on empty-schedule days
     * (e.g. dayforce_shifts empty for that date) used to take the whole cron
     * down with a 500 response — silently skipping the 4 PM send. */
    let plants = buildServerPayloads(
        effectivePlanRow,
        plantNameByCode,
        planDate,
        activeMixerBaseByPlant,
        travelMinutesByPair
    )
    /* Final safety net — if the plan row was missing, dispatch_data was
     * empty, AND there were no plants to iterate at all, fall back to every
     * configured plant so each one still gets an empty-schedule email at the
     * usual send time. resolveAllPlants below skips any plant without a
     * resolved plant manager via `plant.skip`, so non-operational plants
     * don't generate stray emails. */
    if (plants.length === 0) {
        plants = Object.keys(plantNameByCode)
            .filter((code) => code && code !== PLAN_META_KEY_INTERNAL)
            .sort()
            .map((code) => ({
                code,
                helpIn: [],
                helpOut: [],
                kpi: { customerCount: 0, firstStart: '', lastStart: '', loadCount: 0, orderCount: 0, yardage: 0 },
                name: plantNameByCode[code] || '',
                notes: '',
                orders: [],
                roster: []
            }))
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

/* ============================================================================
 * Corrections cron — diffs the 4 PM email_baseline snapshot against live
 * dispatch_data one hour later and ships an [UPDATED] email to every plant
 * whose schedule shifted in that window. Recipients match the original 4 PM
 * send (plant manager TO; DMs / dispatchers / GMs CC) so the entire chain
 * sees the same correction the manager does. Saturday mirrors the weekday
 * logic shifted one hour earlier: baseline at 11 AM, corrections at 12 PM.
 * ============================================================================ */

const DISPATCH_TABLE = 'dispatch_data'
const SNAPSHOT_TABLE = 'plan_schedule_snapshots'

const DISPATCH_SCHEDULE_COLUMNS =
    'order_id, order_num, home_plant_code, customer, customer_num, job_number, address, city, contact, phone, ' +
    'po_number, product_code, product_description, start_time, rate, scheduled_yardage, load_size, truck_count, ' +
    'truck_class, sched_to_job_time, sched_to_plant_time'

/* Field labels for the corrections callout. Order matters — the email
 * renderer walks this list to produce a stable column order. Anything
 * outside the list isn't surfaced in the diff. */
const DIFF_FIELD_LABELS: Array<{ field: string; label: string }> = [
    { field: 'startTime', label: 'Start time' },
    { field: 'yardage', label: 'Yardage' },
    { field: 'loadSize', label: 'Load size' },
    { field: 'truckCount', label: 'Truck count' },
    { field: 'rate', label: 'Spacing' },
    { field: 'customer', label: 'Customer' },
    { field: 'customerNum', label: 'Customer #' },
    { field: 'jobNumber', label: 'Job #' },
    { field: 'poNumber', label: 'PO #' },
    { field: 'productCode', label: 'Product code' },
    { field: 'description', label: 'Description' },
    { field: 'address', label: 'Address' },
    { field: 'city', label: 'City' },
    { field: 'contact', label: 'Contact' },
    { field: 'phone', label: 'Phone' },
    { field: 'truckClass', label: 'Truck class' },
    { field: 'toJobTime', label: 'To-job time' },
    { field: 'toPlantTime', label: 'To-plant time' }
]

/** Mirrors `groupOrderRowsByPlant` from the snapshot service so the live
 *  fetch produces a blob with the exact same shape the baseline snapshot
 *  stored — letting the diff compare order objects field-for-field without
 *  any per-source translation. */
function buildPlantProductionFromDispatch(rows: any[]): Record<string, any> {
    const byPlant: Record<string, any> = {}
    for (const row of rows || []) {
        const code = row?.home_plant_code
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

async function fetchLivePlantProduction(supabase: any, dateStr: string): Promise<Record<string, any>> {
    const { data, error } = await supabase
        .from(DISPATCH_TABLE)
        .select(DISPATCH_SCHEDULE_COLUMNS)
        .eq('order_date', dateStr)
        .eq('ticket_num', '')
    if (error) throw error
    return buildPlantProductionFromDispatch(data ?? [])
}

/** Match key for diffing — orderId is the canonical stable identifier from
 *  the dispatch bridge; orderNum is the fallback for the rare row missing
 *  an id. Empty string keys are filtered out before matching. */
function diffMatchKey(order: any): string {
    return String(order?.orderId ?? '') || String(order?.orderNum ?? '')
}

function orderSummary(order: any): OrderDiffSummary {
    return {
        customer: String(order?.customer || '').trim() || 'Unknown customer',
        orderNum: String(order?.orderNum || '').trim(),
        startTime: String(order?.startTime || '').trim(),
        yardage: String(order?.yardage || '').trim()
    }
}

/** Compare two order arrays and return the added / removed / changed sets.
 *  "Changed" iterates the labeled field list so unlabeled fields (e.g.
 *  internal flags) never trigger a correction email on their own. */
function diffPlantOrders(baselineOrders: any[], liveOrders: any[]): PlantCorrections {
    const baselineByKey = new Map<string, any>()
    const liveByKey = new Map<string, any>()
    for (const order of baselineOrders || []) {
        const key = diffMatchKey(order)
        if (key) baselineByKey.set(key, order)
    }
    for (const order of liveOrders || []) {
        const key = diffMatchKey(order)
        if (key) liveByKey.set(key, order)
    }

    const added: OrderDiffSummary[] = []
    const removed: OrderDiffSummary[] = []
    const changed: ChangedOrderDiff[] = []

    for (const [key, liveOrder] of liveByKey) {
        const baselineOrder = baselineByKey.get(key)
        if (!baselineOrder) {
            added.push(orderSummary(liveOrder))
            continue
        }
        const fieldDiffs: ChangedOrderDiff['fields'] = []
        for (const { field, label } of DIFF_FIELD_LABELS) {
            const before = String(baselineOrder?.[field] ?? '').trim()
            const after = String(liveOrder?.[field] ?? '').trim()
            if (before !== after) fieldDiffs.push({ after, before, field, label })
        }
        if (fieldDiffs.length > 0) {
            const sum = orderSummary(liveOrder)
            changed.push({
                customer: sum.customer,
                fields: fieldDiffs,
                orderNum: sum.orderNum,
                startTime: sum.startTime
            })
        }
    }
    for (const [key, baselineOrder] of baselineByKey) {
        if (!liveByKey.has(key)) removed.push(orderSummary(baselineOrder))
    }

    const byStart = (a: { startTime: string }, b: { startTime: string }) =>
        String(a.startTime || '').localeCompare(String(b.startTime || ''))
    added.sort(byStart)
    removed.sort(byStart)
    changed.sort(byStart)

    return { added, changed, removed }
}

async function handleCronSendCorrections(req: Request, headers: any): Promise<Response> {
    if (!isInternalServiceCall(req)) {
        return errorResponse('Forbidden', headers, 403)
    }
    const body = await parseBody(req)
    const force = body?.force === true
    const dryRun = body?.dryRun === true
    const now = chicagoNow()
    const expectedHour = expectedCorrectionsHourForWeekday(now.weekday)
    if (!force && expectedHour == null) {
        return jsonResponse({ reason: 'sunday', skipped: true }, headers)
    }
    if (!force && now.hour !== expectedHour) {
        return jsonResponse(
            {
                chicagoHour: now.hour,
                expectedHour,
                reason: 'outside-send-window',
                skipped: true,
                weekday: now.weekday
            },
            headers
        )
    }

    const planDate = isFiniteString(body?.planDate) ? body.planDate.trim() : chicagoNextWorkingDate(now)
    const supabase = createAdminClient()

    /* 1. Baseline — the 4 PM (or 11 AM Sat) snapshot taken in lockstep with
     *    the original email send. Missing baseline = no corrections to send
     *    (likely the email never went out for this date). */
    const { data: baselineRow, error: baselineErr } = await supabase
        .from(SNAPSHOT_TABLE)
        .select('plant_production, captured_at')
        .eq('schedule_date', planDate)
        .eq('snapshot_type', 'email_baseline')
        .maybeSingle()
    if (baselineErr) return errorResponse(baselineErr.message || 'Baseline lookup failed', headers, 500)
    if (!baselineRow) {
        return jsonResponse({ planDate, reason: 'no-baseline', skipped: true }, headers)
    }
    const baselineProduction = (baselineRow.plant_production || {}) as Record<string, any>

    /* 2. Live — the current dispatch_data state for the same date, built
     *    into the same shape as the snapshot. */
    let liveProduction: Record<string, any>
    try {
        liveProduction = await fetchLivePlantProduction(supabase, planDate)
    } catch (err: any) {
        return errorResponse(err?.message || 'Failed to fetch live dispatch_data', headers, 500)
    }

    /* 3. Per-plant diff. Plants present in either side get evaluated;
     *    empty diffs are dropped. */
    const correctionsByPlant: Record<string, PlantCorrections> = {}
    const allCodes = new Set<string>()
    Object.keys(baselineProduction).forEach((c) => {
        if (c && c !== PLAN_META_KEY_INTERNAL) allCodes.add(c)
    })
    Object.keys(liveProduction).forEach((c) => {
        if (c && c !== PLAN_META_KEY_INTERNAL) allCodes.add(c)
    })
    for (const code of allCodes) {
        const baselineOrders = Array.isArray(baselineProduction[code]?.orders) ? baselineProduction[code].orders : []
        const liveOrders = Array.isArray(liveProduction[code]?.orders) ? liveProduction[code].orders : []
        const diff = diffPlantOrders(baselineOrders, liveOrders)
        if (diff.added.length || diff.removed.length || diff.changed.length) {
            correctionsByPlant[code] = diff
        }
    }
    if (Object.keys(correctionsByPlant).length === 0) {
        return jsonResponse({ planDate, reason: 'no-changes', skipped: true }, headers)
    }

    /* 4. Plan row — assignments + notes drive help in/out + roster, _meta
     *    carries the Saturday overrides and missing-operator marks. The
     *    corrections email shows the FULL current schedule (built from
     *    live dispatch_data, not the dispatcher's saved plant_production)
     *    so the manager sees the authoritative state. */
    const { data: planRow } = await supabase
        .from('plans')
        .select('plant_production, assignments, notes')
        .eq('plan_date', planDate)
        .maybeSingle()

    const synthesizedProduction: Record<string, any> = { ...liveProduction }
    const planMeta = planRow?.plant_production?.[PLAN_META_KEY_INTERNAL]
    if (planMeta && typeof planMeta === 'object') {
        synthesizedProduction[PLAN_META_KEY_INTERNAL] = planMeta
    }
    const synthesizedPlanRow = {
        assignments: Array.isArray(planRow?.assignments) ? planRow.assignments : [],
        notes: typeof planRow?.notes === 'string' ? planRow.notes : '',
        plant_production: synthesizedProduction
    }

    const [plantNameByCode, activeMixerBaseByPlant, travelMinutesByPair] = await Promise.all([
        fetchPlantNameMap(supabase),
        fetchActiveMixerBaseByPlant(supabase),
        fetchTravelMinutesByPair(supabase)
    ])

    /* Dayforce roster fetch was dropped along with the named-slot ranking —
     * see the matching block in `handleCronSend`. */
    const allPayloads = buildServerPayloads(
        synthesizedPlanRow,
        plantNameByCode,
        planDate,
        activeMixerBaseByPlant,
        travelMinutesByPair
    )

    const payloadsWithCorrections: PlantInput[] = allPayloads
        .filter((p) => correctionsByPlant[p.code])
        .map((p) => ({ ...p, corrections: correctionsByPlant[p.code] }))

    /* A plant that had every order removed (live state = 0 orders) gets
     * filtered out by buildServerPayloads — no orders, no help, nothing to
     * render except the callout. Synthesize a minimal payload so the
     * manager still hears "all orders cancelled". */
    for (const code of Object.keys(correctionsByPlant)) {
        if (payloadsWithCorrections.find((p) => p.code === code)) continue
        payloadsWithCorrections.push({
            code,
            corrections: correctionsByPlant[code],
            helpIn: [],
            helpOut: [],
            kpi: { customerCount: 0, firstStart: '', lastStart: '', loadCount: 0, orderCount: 0, yardage: 0 },
            name: plantNameByCode[code] || '',
            notes: synthesizedPlanRow.notes,
            orders: [],
            roster: []
        })
    }

    const resolved = await resolveAllPlants(supabase, planDate, payloadsWithCorrections)

    if (dryRun) {
        return jsonResponse(
            {
                dryRun: true,
                planDate,
                plants: resolved.map((p) => ({
                    cc: p.cc,
                    code: p.code,
                    corrections: correctionsByPlant[p.code],
                    name: p.name,
                    sendCc: p.sendCc,
                    sendTo: p.sendTo,
                    subject: p.subject,
                    to: p.to
                })),
                source: 'cron-corrections',
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
            source: 'cron-corrections',
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
    const { error } = await admin.from(CRON_CONFIG_TABLE).upsert({
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
            case 'cron-send-corrections':
                return await handleCronSendCorrections(req, headers)
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
