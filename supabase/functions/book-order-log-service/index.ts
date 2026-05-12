// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'

// ============================================================================
// Audit log endpoints for the "Find a Spot" booking-assist tool. Writes one
// row per (form submission, recommendation) pair to `plan_book_order_logs`
// and exposes a read endpoint so the same dispatcher can review their own
// recent activity inside the tab.
//
// Auth: `users_sessions` check on every endpoint (no anon access).
// ============================================================================

const TABLE = 'plan_book_order_logs'
const PROFILES_TABLE = 'users_profiles'
const SESSIONS_TABLE = 'users_sessions'
const SESSION_EXPIRY_DAYS = 7
const MAX_LIST_LIMIT = 50
const DEFAULT_LIST_LIMIT = 20

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

async function requireAuthenticated(req: Request, headers: any, body?: any): Promise<string | Response> {
    const userId = body?.__sessionUserId || req.headers.get('x-user-id') || null
    const sessionId = body?.__sessionId || req.headers.get('x-session-id') || null
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
        const expiry = new Date()
        expiry.setDate(expiry.getDate() - SESSION_EXPIRY_DAYS)
        if (lastActive < expiry) return errorResponse('Session expired', headers, 401)
    }
    admin
        .from(SESSIONS_TABLE)
        .update({ last_active: new Date().toISOString() })
        .eq('id', sessionId)
        .then(() => {})
        .catch(() => {})
    return userId
}

/** Coerce a numeric value defensively — accepts numbers and numeric
 *  strings, returns null when anything else (Find-a-Spot fields can
 *  arrive as empty strings before the form is fully filled). */
function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
}

function toIntOrNull(value: unknown): number | null {
    const num = toNumberOrNull(value)
    return num === null ? null : Math.trunc(num)
}

function toTextOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const str = String(value).trim()
    return str.length === 0 ? null : str
}

function toDateOrNull(value: unknown): string | null {
    const str = toTextOrNull(value)
    if (!str) return null
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null
}

async function handleLogSuggestion(admin: any, userId: string, body: any, headers: any): Promise<Response> {
    const form = body?.form || {}
    const recommendation = body?.recommendation || {}
    const context = body?.context && typeof body.context === 'object' ? body.context : {}
    const planDate = toDateOrNull(form?.planDate)
    if (!planDate) return errorResponse('Missing or invalid form.planDate', headers, 400)
    const row = {
        user_id: userId,
        plan_date: planDate,
        yardage: toNumberOrNull(form?.yardage),
        requested_start_time: toTextOrNull(form?.startTime),
        pour_method: toTextOrNull(form?.pourMethod),
        truck_spacing_min: toIntOrNull(form?.spacingMin),
        job_address: toTextOrNull(form?.address),
        estimated_trucks: toIntOrNull(form?.trucksNeeded),
        estimated_pour_window_start_min: toIntOrNull(form?.windowStartMin),
        estimated_pour_window_end_min: toIntOrNull(form?.windowEndMin),
        recommendation_title: toTextOrNull(recommendation?.title),
        recommendation_subtitle: toTextOrNull(recommendation?.subtitle),
        recommendation_kind: toTextOrNull(recommendation?.kind),
        recommended_plant_code: toTextOrNull(recommendation?.plantCode),
        recommended_plant_name: toTextOrNull(recommendation?.plantName),
        recommended_start_time: toTextOrNull(recommendation?.startTime),
        recommended_date: toDateOrNull(recommendation?.dateStr),
        decision_context: context
    }
    const { data, error } = await admin.from(TABLE).insert(row).select('id').maybeSingle()
    if (error) return errorResponse(`Insert failed: ${error.message}`, headers, 500)
    return jsonResponse({ id: data?.id ?? null, ok: true }, headers)
}

async function handleListRecent(admin: any, _userId: string, body: any, headers: any): Promise<Response> {
    const requestedLimit = toIntOrNull(body?.limit) ?? DEFAULT_LIST_LIMIT
    const limit = Math.max(1, Math.min(MAX_LIST_LIMIT, requestedLimit))
    /* Returns logs from ALL users so the dispatcher team can audit
     * each other's recommendations — every entry is paired with the
     * submitter's name via a `users_profiles` lookup. */
    const { data: logs, error } = await admin
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) return errorResponse(`Query failed: ${error.message}`, headers, 500)
    const rows = Array.isArray(logs) ? logs : []
    const userIds = Array.from(new Set(rows.map((row: any) => row?.user_id).filter(Boolean)))
    let profilesByUserId: Record<string, { firstName: string; lastName: string }> = {}
    if (userIds.length > 0) {
        const { data: profiles } = await admin
            .from(PROFILES_TABLE)
            .select('id, first_name, last_name')
            .in('id', userIds)
        if (Array.isArray(profiles)) {
            profilesByUserId = profiles.reduce((acc: any, profile: any) => {
                const id = profile?.id
                if (!id) return acc
                acc[id] = {
                    firstName: profile?.first_name || '',
                    lastName: profile?.last_name || ''
                }
                return acc
            }, {})
        }
    }
    const annotated = rows.map((row: any) => {
        const profile = profilesByUserId[row?.user_id] || null
        const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''
        return {
            ...row,
            submitter_first_name: profile?.firstName || null,
            submitter_last_name: profile?.lastName || null,
            submitter_name: name || null
        }
    })
    return jsonResponse({ logs: annotated }, headers)
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    if (req.method !== 'POST') return errorResponse('Method not allowed', headers, 405)
    try {
        const body = await parseBody(req)
        const auth = await requireAuthenticated(req, headers, body)
        if (auth instanceof Response) return auth
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop() || ''
        const admin = getAdminClient()
        switch (endpoint) {
            case 'log-suggestion':
                return await handleLogSuggestion(admin, auth, body, headers)
            case 'list-recent':
                return await handleListRecent(admin, auth, body, headers)
            default:
                return errorResponse(`Unknown endpoint: ${endpoint}`, headers, 404)
        }
    } catch (err: any) {
        return errorResponse(err?.message || 'Unexpected error', headers, 500)
    }
})
