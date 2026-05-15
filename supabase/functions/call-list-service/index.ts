// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4' // @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

const CALL_LOG_TABLE = 'customer_call_log'
const USERS_TABLE = 'users'
const VALID_OUTCOMES = new Set(['no_answer', 'booked', 'not_interested', 'will_book_again', 'note'])

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

function getAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
}

async function lookupUserDisplayName(admin: any, userId: string): Promise<string | null> {
    const { data, error } = await admin
        .from(USERS_TABLE)
        .select('first_name, last_name, name, email')
        .eq('id', userId)
        .maybeSingle()
    if (error || !data) return null
    const first = typeof data.first_name === 'string' ? data.first_name.trim() : ''
    const last = typeof data.last_name === 'string' ? data.last_name.trim() : ''
    const combined = [first, last].filter(Boolean).join(' ').trim()
    if (combined) return combined
    if (typeof data.name === 'string' && data.name.trim()) return data.name.trim()
    if (typeof data.email === 'string' && data.email.trim()) return data.email.trim()
    return null
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } })

        switch (endpoint) {
            case 'roster': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const admin = getAdminClient()
                const { data, error } = await admin.rpc('get_call_list_roster')
                if (error) return errorResponse('Failed to load call list', headers, 400, { detail: error.message })
                return jsonResponse({ data: data ?? [] }, headers)
            }
            case 'history': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const customerNum = typeof body?.customerNum === 'string' ? body.customerNum.trim() : ''
                if (!customerNum) return errorResponse('customerNum is required', headers, 400)
                const limit = Number.isInteger(body?.limit) && body.limit > 0 ? Math.min(body.limit, 200) : 50
                const admin = getAdminClient()
                const { data, error } = await admin
                    .from(CALL_LOG_TABLE)
                    .select('*')
                    .eq('customer_num', customerNum)
                    .order('created_at', { ascending: false })
                    .limit(limit)
                if (error) return errorResponse('Failed to load history', headers, 400)
                return jsonResponse({ data: data ?? [] }, headers)
            }
            case 'log-call': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const userId = auth as string
                const customerNum = typeof body?.customerNum === 'string' ? body.customerNum.trim() : ''
                const outcome = typeof body?.outcome === 'string' ? body.outcome.trim() : ''
                if (!customerNum) return errorResponse('customerNum is required', headers, 400)
                if (!VALID_OUTCOMES.has(outcome)) return errorResponse('Invalid outcome', headers, 400)
                const comment = typeof body?.comment === 'string' && body.comment.trim() ? body.comment.trim() : null
                const customerName = typeof body?.customerName === 'string' ? body.customerName.trim() : null
                const contactName = typeof body?.contactName === 'string' ? body.contactName.trim() : null
                const phone = typeof body?.phone === 'string' ? body.phone.trim() : null
                const admin = getAdminClient()
                const createdByName = await lookupUserDisplayName(admin, userId)
                const { data, error } = await admin
                    .from(CALL_LOG_TABLE)
                    .insert({
                        customer_num: customerNum,
                        customer_name: customerName,
                        contact_name: contactName,
                        phone,
                        outcome,
                        comment,
                        created_by: userId,
                        created_by_name: createdByName
                    })
                    .select('*')
                    .single()
                if (error) return errorResponse('Failed to log call', headers, 400, { detail: error.message })
                return jsonResponse({ data }, headers)
            }
            case 'delete-log': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const logId = typeof body?.logId === 'string' ? body.logId.trim() : ''
                if (!logId) return errorResponse('logId is required', headers, 400)
                const admin = getAdminClient()
                const { data, error } = await admin
                    .from(CALL_LOG_TABLE)
                    .delete()
                    .eq('id', logId)
                    .eq('created_by', auth)
                    .select('id')
                if (error) return errorResponse('Failed to delete', headers, 400)
                if (!data?.length) return errorResponse('Entry not found or not yours to delete', headers, 404)
                return jsonResponse({ success: true }, headers)
            }
            default:
                return errorResponse('Invalid endpoint', headers, 404, { path: url.pathname })
        }
    } catch {
        return errorResponse('Internal server error', headers, 500)
    }
})
