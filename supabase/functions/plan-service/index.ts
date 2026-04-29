// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4' // @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'

const TRAVEL_TIMES_TABLE = 'plant_travel_times'
const PLANS_TABLE = 'plans'
const TEMPLATES_TABLE = 'plan_templates'

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

function nowISO(): string {
    return new Date().toISOString()
}

const SESSIONS_TABLE = 'users_sessions'
const SESSION_EXPIRY_DAYS = 7

function getAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
}

async function requireAuthenticated(
    _supabase: any,
    req: Request,
    headers: any,
    body?: any
): Promise<string | Response> {
    let userId = body?.__sessionUserId || req.headers.get('x-user-id') || null
    let sessionId = body?.__sessionId || req.headers.get('x-session-id') || null
    if (!userId || !sessionId) {
        try {
            const b = await req.clone().json()
            userId = userId || b?.__sessionUserId
            sessionId = sessionId || b?.__sessionId
        } catch {}
    }
    if (!userId || !sessionId) return errorResponse('Unauthorized', headers, 401)
    const admin = getAdminClient()
    const { data, error } = await admin
        .from(SESSIONS_TABLE)
        .select('id, last_active')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle()
    if (error || !data) return errorResponse('Unauthorized', headers, 401)
    if (data.last_active) {
        const lastActive = new Date(data.last_active)
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() - SESSION_EXPIRY_DAYS)
        if (lastActive < expiryDate) return errorResponse('Session expired', headers, 401)
    }
    admin
        .from(SESSIONS_TABLE)
        .update({ last_active: new Date().toISOString() })
        .eq('id', sessionId)
        .then(() => {})
        .catch(() => {})
    return userId
}

const PERMISSIONS_TABLE = 'users_permissions'
const ROLES_SELECT = 'role_id, users_roles(weight)'

async function getUserWeight(_supabase: any, userId: string): Promise<number> {
    const admin = getAdminClient()
    const { data } = await admin.from(PERMISSIONS_TABLE).select(ROLES_SELECT).eq('user_id', userId)
    if (!data?.length) return 0
    return Math.max(...data.map((d: any) => d.users_roles?.weight ?? 0))
}

async function requireOwnerOrHigherRole(
    supabase: any,
    callerId: string,
    ownerId: string | null,
    headers: any
): Promise<Response | null> {
    if (!ownerId || callerId === ownerId) return null
    const callerWeight = await getUserWeight(supabase, callerId)
    const ownerWeight = await getUserWeight(supabase, ownerId)
    if (callerWeight > ownerWeight) return null
    return errorResponse("Forbidden: insufficient privileges to modify another user's record", headers, 403)
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
            global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
        })

        switch (endpoint) {
            case 'fetch-travel-times': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const { data, error } = await supabase.from(TRAVEL_TIMES_TABLE).select('*').order('from_plant_code')
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ data: data ?? [] }, headers)
            }
            case 'upsert-travel-time': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const body = await parseBody(req)
                const { fromPlantCode, toPlantCode, travelMinutes } = body
                if (!fromPlantCode || !toPlantCode || typeof travelMinutes !== 'number') {
                    return errorResponse('fromPlantCode, toPlantCode, and travelMinutes are required', headers, 400)
                }
                const { error } = await supabase.from(TRAVEL_TIMES_TABLE).upsert(
                    {
                        from_plant_code: fromPlantCode,
                        to_plant_code: toPlantCode,
                        travel_minutes: travelMinutes,
                        updated_at: nowISO()
                    },
                    { onConflict: 'from_plant_code,to_plant_code' }
                )
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'delete-travel-time': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const body = await parseBody(req)
                const { fromPlantCode, toPlantCode } = body
                if (!fromPlantCode || !toPlantCode)
                    return errorResponse('fromPlantCode and toPlantCode are required', headers, 400)
                const { error } = await supabase
                    .from(TRAVEL_TIMES_TABLE)
                    .delete()
                    .eq('from_plant_code', fromPlantCode)
                    .eq('to_plant_code', toPlantCode)
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'fetch-plan': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const body = await parseBody(req)
                const { planDate } = body
                if (!planDate) return errorResponse('planDate is required', headers, 400)
                const { data, error } = await supabase.from(PLANS_TABLE).select('*').eq('plan_date', planDate).single()
                if (error && error.code !== 'PGRST116') return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ data: data ?? null }, headers)
            }
            case 'fetch-plans-range': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const body = await parseBody(req)
                const { startDate, endDate } = body
                if (!startDate || !endDate) return errorResponse('startDate and endDate are required', headers, 400)
                const { data, error } = await supabase
                    .from(PLANS_TABLE)
                    .select('plan_date, assignments, plant_production, notes, updated_at')
                    .gte('plan_date', startDate)
                    .lte('plan_date', endDate)
                    .order('plan_date', { ascending: true })
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ data: data ?? [] }, headers)
            }
            case 'fetch-latest-plan-date': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                // Return the plan-date with real content whose calendar date
                // is closest to today. Ties break toward the future so users
                // landing mid-week see the next planned day, not yesterday.
                const today = new Date()
                const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
                const windowDays = 60
                const lower = new Date(todayMs - windowDays * 86400000).toISOString().slice(0, 10)
                const upper = new Date(todayMs + windowDays * 86400000).toISOString().slice(0, 10)
                const { data, error } = await supabase
                    .from(PLANS_TABLE)
                    .select('plan_date, assignments, plant_production, notes')
                    .gte('plan_date', lower)
                    .lte('plan_date', upper)
                if (error) return errorResponse('Operation failed', headers, 400)
                const hasContent = (row: any) => {
                    const assignments = Array.isArray(row?.assignments) ? row.assignments : []
                    const hasRealRoutes = assignments.some(
                        (a: any) =>
                            a &&
                            (a.fromPlant ||
                                a.toPlant ||
                                a.time ||
                                (Array.isArray(a.customTimes) && a.customTimes.length))
                    )
                    if (hasRealRoutes) return true
                    const production = row?.plant_production || {}
                    const productionKeys = Object.keys(production).filter((k) => k !== '_meta')
                    if (productionKeys.length > 0) return true
                    if (row?.notes && String(row.notes).trim().length > 0) return true
                    return false
                }
                const candidates = (data ?? []).filter(hasContent)
                if (!candidates.length) return jsonResponse({ planDate: null }, headers)
                const scored = candidates
                    .map((row: any) => {
                        const [y, m, d] = String(row.plan_date)
                            .split('-')
                            .map((n) => parseInt(n, 10))
                        const planMs = Date.UTC(y, (m || 1) - 1, d || 1)
                        return { row, delta: Math.abs(planMs - todayMs), forward: planMs >= todayMs }
                    })
                    .sort((a, b) => {
                        if (a.delta !== b.delta) return a.delta - b.delta
                        if (a.forward !== b.forward) return a.forward ? -1 : 1
                        return String(b.row.plan_date).localeCompare(String(a.row.plan_date))
                    })
                return jsonResponse({ planDate: scored[0].row.plan_date }, headers)
            }
            case 'save-plan': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const body = await parseBody(req)
                const { planDate, assignments, notes, plantProduction } = body
                if (!planDate) return errorResponse('planDate is required', headers, 400)
                const { error } = await supabase.from(PLANS_TABLE).upsert(
                    {
                        plan_date: planDate,
                        assignments: assignments ?? [],
                        notes: notes ?? '',
                        plant_production: plantProduction ?? {},
                        updated_at: nowISO()
                    },
                    { onConflict: 'plan_date' }
                )
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'fetch-templates': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const { data, error } = await supabase
                    .from(TEMPLATES_TABLE)
                    .select('*')
                    .eq('user_id', auth)
                    .order('created_at', { ascending: false })
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ data: data ?? [] }, headers)
            }
            case 'save-template': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const body = await parseBody(req)
                const { name, assignments, notes } = body
                if (!name) return errorResponse('name is required', headers, 400)
                const { error } = await supabase.from(TEMPLATES_TABLE).insert({
                    user_id: auth,
                    name,
                    assignments: assignments ?? [],
                    notes: notes ?? '',
                    created_at: nowISO()
                })
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'delete-template': {
                const auth = await requireAuthenticated(supabase, req, headers)
                if (auth instanceof Response) return auth
                const body = await parseBody(req)
                const { templateId } = body
                if (!templateId) return errorResponse('templateId is required', headers, 400)
                const { data: template } = await supabase
                    .from(TEMPLATES_TABLE)
                    .select('user_id')
                    .eq('id', templateId)
                    .maybeSingle()
                if (!template) return errorResponse('Template not found', headers, 404)
                const ownerErr = await requireOwnerOrHigherRole(supabase, auth, template.user_id, headers)
                if (ownerErr) return ownerErr
                const { error } = await supabase.from(TEMPLATES_TABLE).delete().eq('id', templateId)
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            default:
                return errorResponse('Unknown endpoint', headers, 404)
        }
    } catch (error) {
        return errorResponse('Internal server error', headers, 500)
    }
})
