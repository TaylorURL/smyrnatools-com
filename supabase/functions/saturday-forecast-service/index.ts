// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

/**
 * Saturday Operator Forecast edge function.
 *
 * Routes (POST body `{ action, ...args }`):
 *   - fetch-pending-for-user — plants this manager owns that still owe a forecast
 *   - fetch-for-week         — every forecast for a Saturday (optionally scoped)
 *   - submit-forecast        — UPSERT one forecast (manager-of-plant only)
 *   - submit-bulk            — UPSERT many forecasts (manager-of-every-plant only)
 *
 * The "upcoming Saturday" is computed in Chicago time so this matches dispatch.
 */

const FORECASTS_TABLE = 'saturday_operator_forecasts'
const PLANTS_TABLE = 'plants'
const REGIONS_PLANTS_TABLE = 'regions_plants'
const REGIONS_TABLE = 'regions'
const PROFILES_TABLE = 'users_profiles'
const USERS_TABLE = 'users'

const MIN_OPERATOR_COUNT = 0
const MAX_OPERATOR_COUNT = 200
const CHICAGO_TZ = 'America/Chicago'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function getAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

/**
 * Returns the Chicago-time wall-clock date for `instant` as a YYYY-MM-DD
 * string plus its day-of-week (0=Sun..6=Sat). Uses Intl, not raw offsets,
 * so DST is handled correctly.
 */
function chicagoDateParts(instant: Date): { ymd: string; dow: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: CHICAGO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    })
    const parts = formatter.formatToParts(instant)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    const ymd = `${get('year')}-${get('month')}-${get('day')}`
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const dow = weekdayMap[get('weekday')] ?? 0
    return { ymd, dow }
}

/** YYYY-MM-DD of the upcoming Saturday in Chicago time. Today, if today IS Saturday. */
function upcomingSaturdayChicago(now: Date = new Date()): string {
    const { ymd, dow } = chicagoDateParts(now)
    const daysToAdd = dow === 6 ? 0 : 6 - dow
    if (daysToAdd === 0) return ymd
    const [y, m, d] = ymd.split('-').map(Number)
    const base = new Date(Date.UTC(y, m - 1, d))
    base.setUTCDate(base.getUTCDate() + daysToAdd)
    const year = base.getUTCFullYear()
    const month = String(base.getUTCMonth() + 1).padStart(2, '0')
    const day = String(base.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/** ISO week label (e.g. "2026-W22") for the given YYYY-MM-DD. */
function isoWeekLabel(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dow = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dow)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** True when `ymd` matches YYYY-MM-DD AND represents a real Saturday in UTC. */
function isValidSaturday(ymd: string): boolean {
    if (typeof ymd !== 'string' || !DATE_RE.test(ymd)) return false
    const [y, m, d] = ymd.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    if (Number.isNaN(date.getTime())) return false
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false
    return date.getUTCDay() === 6
}

function normalizeOperatorCount(value: unknown): number | null {
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return null
    if (!Number.isInteger(num)) return null
    if (num < MIN_OPERATOR_COUNT || num > MAX_OPERATOR_COUNT) return null
    return num
}

function trimString(val: unknown): string {
    return typeof val === 'string' ? val.trim() : ''
}

/** Maps each plant_code to `{ regionCode, regionName }` (first region wins). */
async function loadRegionsForPlants(
    supabase: any,
    plantCodes: string[]
): Promise<Map<string, { regionCode: string | null; regionName: string | null }>> {
    const out = new Map<string, { regionCode: string | null; regionName: string | null }>()
    if (!plantCodes.length) return out
    const { data: links } = await supabase
        .from(REGIONS_PLANTS_TABLE)
        .select('plant_code, region_id')
        .in('plant_code', plantCodes)
    if (!links?.length) return out
    const regionIds = Array.from(new Set(links.map((l: any) => l.region_id).filter(Boolean)))
    if (!regionIds.length) return out
    const { data: regions } = await supabase
        .from(REGIONS_TABLE)
        .select('id, region_code, region_name')
        .in('id', regionIds)
    const regionById = new Map<string, { region_code: string; region_name: string }>(
        (regions ?? []).map((r: any) => [r.id, { region_code: r.region_code, region_name: r.region_name }])
    )
    for (const link of links) {
        if (out.has(link.plant_code)) continue
        const region = regionById.get(link.region_id)
        if (!region) continue
        out.set(link.plant_code, { regionCode: region.region_code, regionName: region.region_name })
    }
    return out
}

/** Maps userId → display name (full name from profile, then users.name, then email local-part). */
async function loadUserNames(supabase: any, userIds: string[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>()
    if (!userIds.length) return out
    const unique = Array.from(new Set(userIds.filter(Boolean)))
    const { data: profiles } = await supabase
        .from(PROFILES_TABLE)
        .select('id, first_name, last_name')
        .in('id', unique)
    for (const profile of profiles ?? []) {
        const full = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        if (full) out.set(profile.id, full)
    }
    const missing = unique.filter((id) => !out.has(id))
    if (!missing.length) return out
    const { data: users } = await supabase.from(USERS_TABLE).select('id, name, email').in('id', missing)
    for (const user of users ?? []) {
        if (user.name) {
            out.set(user.id, user.name)
            continue
        }
        if (user.email) {
            out.set(user.id, user.email.split('@')[0])
            continue
        }
        out.set(user.id, null)
    }
    return out
}

/** Returns the plants the user manages. Filtered to plants with non-null plant_code. */
async function loadManagedPlants(
    supabase: any,
    userId: string
): Promise<Array<{ plant_code: string; plant_name: string }>> {
    const { data } = await supabase
        .from(PLANTS_TABLE)
        .select('plant_code, plant_name')
        .contains('manager_user_ids', [userId])
        .order('plant_code')
    return (data ?? []).filter((p: any) => p?.plant_code) as Array<{ plant_code: string; plant_name: string }>
}

async function handleFetchPendingForUser(supabase: any, userId: string, headers: any): Promise<Response> {
    const saturdayDate = upcomingSaturdayChicago()
    const weekIso = isoWeekLabel(saturdayDate)
    const managed = await loadManagedPlants(supabase, userId)
    if (!managed.length) {
        return jsonResponse({ pendingPlants: [], saturdayDate, submittedPlants: [], success: true, weekIso }, headers)
    }
    const codes = managed.map((p) => p.plant_code)
    const [{ data: existing }, regionByPlant] = await Promise.all([
        supabase
            .from(FORECASTS_TABLE)
            .select('plant_code, operator_count, submitted_at')
            .eq('saturday_date', saturdayDate)
            .in('plant_code', codes),
        loadRegionsForPlants(supabase, codes)
    ])
    const submittedMap = new Map<string, { operator_count: number; submitted_at: string }>(
        (existing ?? []).map((row: any) => [row.plant_code, { operator_count: row.operator_count, submitted_at: row.submitted_at }])
    )
    const pendingPlants: Array<{ plantCode: string; plantName: string; regionCode: string | null; regionName: string | null }> = []
    const submittedPlants: Array<{ plantCode: string; plantName: string; operatorCount: number; submittedAt: string }> = []
    for (const plant of managed) {
        const submitted = submittedMap.get(plant.plant_code)
        if (submitted) {
            submittedPlants.push({
                operatorCount: submitted.operator_count,
                plantCode: plant.plant_code,
                plantName: plant.plant_name,
                submittedAt: submitted.submitted_at
            })
            continue
        }
        const region = regionByPlant.get(plant.plant_code)
        pendingPlants.push({
            plantCode: plant.plant_code,
            plantName: plant.plant_name,
            regionCode: region?.regionCode ?? null,
            regionName: region?.regionName ?? null
        })
    }
    return jsonResponse({ pendingPlants, saturdayDate, submittedPlants, success: true, weekIso }, headers)
}

async function handleFetchForWeek(supabase: any, body: any, headers: any): Promise<Response> {
    const saturdayDate = trimString(body?.saturdayDate)
    if (!isValidSaturday(saturdayDate)) {
        return errorResponse('saturdayDate must be a YYYY-MM-DD Saturday', headers, 400)
    }
    const rawCodes = Array.isArray(body?.plantCodes) ? body.plantCodes : null
    const plantCodes = rawCodes
        ? Array.from(new Set(rawCodes.map((c: unknown) => trimString(c)).filter((c: string) => c.length > 0)))
        : null
    let query = supabase
        .from(FORECASTS_TABLE)
        .select('plant_code, operator_count, submitted_at, submitted_by_user_id')
        .eq('saturday_date', saturdayDate)
    if (plantCodes) {
        if (!plantCodes.length) return jsonResponse({ forecastsByPlant: {}, success: true }, headers)
        query = query.in('plant_code', plantCodes)
    }
    const { data, error } = await query
    if (error) return errorResponse('Operation failed', headers, 400)
    const rows = data ?? []
    const nameByUserId = await loadUserNames(supabase, rows.map((r: any) => r.submitted_by_user_id))
    const forecastsByPlant: Record<string, { operatorCount: number; submittedAt: string; submittedByUserId: string; submittedByName: string | null }> = {}
    for (const row of rows) {
        forecastsByPlant[row.plant_code] = {
            operatorCount: row.operator_count,
            submittedAt: row.submitted_at,
            submittedByName: nameByUserId.get(row.submitted_by_user_id) ?? null,
            submittedByUserId: row.submitted_by_user_id
        }
    }
    return jsonResponse({ forecastsByPlant, success: true }, headers)
}

/**
 * Confirms the caller is in `plants.manager_user_ids` for `plantCode` and
 * returns the snapshot regionCode for that plant. Errors are surfaced as a
 * Response so callers `return` directly.
 */
async function authorizeManagerAndSnapshotRegion(
    supabase: any,
    userId: string,
    plantCode: string,
    headers: any
): Promise<Response | { regionCode: string | null }> {
    const { data: plant, error } = await supabase
        .from(PLANTS_TABLE)
        .select('plant_code, manager_user_ids')
        .eq('plant_code', plantCode)
        .maybeSingle()
    if (error) return errorResponse('Operation failed', headers, 400)
    if (!plant) return errorResponse(`Unknown plant code: ${plantCode}`, headers, 404)
    const managers: string[] = Array.isArray(plant.manager_user_ids) ? plant.manager_user_ids : []
    if (!managers.includes(userId)) {
        return errorResponse('Forbidden: not a manager of this plant', headers, 403, { plantCode })
    }
    const regionMap = await loadRegionsForPlants(supabase, [plantCode])
    return { regionCode: regionMap.get(plantCode)?.regionCode ?? null }
}

async function handleSubmitForecast(
    supabase: any,
    userId: string,
    body: any,
    headers: any
): Promise<Response> {
    const plantCode = trimString(body?.plantCode)
    const saturdayDate = trimString(body?.saturdayDate)
    const operatorCount = normalizeOperatorCount(body?.operatorCount)
    if (!plantCode) return errorResponse('plantCode is required', headers, 400)
    if (!isValidSaturday(saturdayDate)) return errorResponse('saturdayDate must be a YYYY-MM-DD Saturday', headers, 400)
    if (operatorCount === null) {
        return errorResponse(`operatorCount must be an integer between ${MIN_OPERATOR_COUNT} and ${MAX_OPERATOR_COUNT}`, headers, 400)
    }
    const authz = await authorizeManagerAndSnapshotRegion(supabase, userId, plantCode, headers)
    if (authz instanceof Response) return authz

    const now = new Date().toISOString()
    const { error } = await supabase.from(FORECASTS_TABLE).upsert(
        {
            operator_count: operatorCount,
            plant_code: plantCode,
            region_code: authz.regionCode,
            saturday_date: saturdayDate,
            submitted_at: now,
            submitted_by_user_id: userId,
            updated_at: now
        },
        { onConflict: 'plant_code,saturday_date' }
    )
    if (error) {
        return errorResponse(error.message || 'Operation failed', headers, 400, {
            code: (error as { code?: string }).code ?? null,
            details: (error as { details?: string }).details ?? null,
            hint: (error as { hint?: string }).hint ?? null
        })
    }
    return jsonResponse(
        {
            forecast: { operatorCount, plantCode, saturdayDate, submittedAt: now },
            success: true
        },
        headers
    )
}

async function handleSubmitBulk(supabase: any, userId: string, body: any, headers: any): Promise<Response> {
    const saturdayDate = trimString(body?.saturdayDate)
    if (!isValidSaturday(saturdayDate)) return errorResponse('saturdayDate must be a YYYY-MM-DD Saturday', headers, 400)
    const rawEntries = Array.isArray(body?.entries) ? body.entries : null
    if (!rawEntries?.length) return errorResponse('entries must be a non-empty array', headers, 400)

    const validated: Array<{ plantCode: string; operatorCount: number }> = []
    for (const entry of rawEntries) {
        const plantCode = trimString(entry?.plantCode)
        const operatorCount = normalizeOperatorCount(entry?.operatorCount)
        if (!plantCode) return errorResponse('Each entry needs a plantCode', headers, 400)
        if (operatorCount === null) {
            return errorResponse(
                `operatorCount must be an integer between ${MIN_OPERATOR_COUNT} and ${MAX_OPERATOR_COUNT}`,
                headers,
                400,
                { plantCode }
            )
        }
        validated.push({ operatorCount, plantCode })
    }

    const uniqueCodes = Array.from(new Set(validated.map((e) => e.plantCode)))
    const { data: plantRows, error: plantsErr } = await supabase
        .from(PLANTS_TABLE)
        .select('plant_code, manager_user_ids')
        .in('plant_code', uniqueCodes)
    if (plantsErr) return errorResponse('Operation failed', headers, 400)

    const managerMap = new Map<string, string[]>(
        (plantRows ?? []).map((row: any) => [
            row.plant_code,
            Array.isArray(row.manager_user_ids) ? row.manager_user_ids : []
        ])
    )
    for (const code of uniqueCodes) {
        const managers = managerMap.get(code)
        if (!managers) return errorResponse(`Unknown plant code: ${code}`, headers, 404, { plantCode: code })
        if (!managers.includes(userId)) {
            return errorResponse('Forbidden: not a manager of one or more plants', headers, 403, { plantCode: code })
        }
    }

    const regionMap = await loadRegionsForPlants(supabase, uniqueCodes)
    const now = new Date().toISOString()
    const rows = validated.map((entry) => ({
        operator_count: entry.operatorCount,
        plant_code: entry.plantCode,
        region_code: regionMap.get(entry.plantCode)?.regionCode ?? null,
        saturday_date: saturdayDate,
        submitted_at: now,
        submitted_by_user_id: userId,
        updated_at: now
    }))
    const { error } = await supabase.from(FORECASTS_TABLE).upsert(rows, { onConflict: 'plant_code,saturday_date' })
    if (error) {
        return errorResponse(error.message || 'Operation failed', headers, 400, {
            code: (error as { code?: string }).code ?? null,
            details: (error as { details?: string }).details ?? null,
            hint: (error as { hint?: string }).hint ?? null
        })
    }
    return jsonResponse({ savedCount: rows.length, success: true }, headers)
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    try {
        const supabase = getAdminClient()
        const body = await parseBody(req)
        const auth = await requireAuthenticated(supabase, req, headers, body)
        if (auth instanceof Response) return auth
        const userId = auth as string

        const url = new URL(req.url)
        const action = url.pathname.split('/').filter(Boolean).pop() || body?.action || ''

        switch (action) {
            case 'fetch-pending-for-user':
                return await handleFetchPendingForUser(supabase, userId, headers)
            case 'fetch-for-week':
                return await handleFetchForWeek(supabase, body, headers)
            case 'submit-forecast':
                return await handleSubmitForecast(supabase, userId, body, headers)
            case 'submit-bulk':
                return await handleSubmitBulk(supabase, userId, body, headers)
            default:
                return errorResponse(`Unknown action: ${action}`, headers, 400)
        }
    } catch (err: any) {
        return errorResponse(err?.message || 'Internal error', headers, 500)
    }
})
