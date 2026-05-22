// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4' // @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

const CALL_LOG_TABLE = 'customer_call_log'
const CONTACTS_TABLE = 'customer_contacts'
const PROFILES_TABLE = 'users_profiles'
const VALID_OUTCOMES = new Set(['no_answer', 'booked', 'not_interested', 'will_book_again', 'note'])

/** Normalize a phone string to digits only and strip the US `1` country
 *  code from 11-digit numbers so this key matches `parsePhoneNumbers().key`
 *  on the frontend. That parity is what lets a manually-saved contact
 *  overlay onto the parsed dispatch entry it represents. */
function normalizePhoneDigits(input: unknown): string {
    if (typeof input !== 'string') return ''
    const digits = input.replace(/\D+/g, '')
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
    return digits
}

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
    // Display names live on `users_profiles`, not the bare `users` table.
    // The old select against `users.first_name` silently errored and
    // returned null for every call entry — leaving `created_by_name`
    // empty in the DB and Team Monitor falling back to "Unknown user".
    const { data, error } = await admin
        .from(PROFILES_TABLE)
        .select('first_name, last_name')
        .eq('id', userId)
        .maybeSingle()
    if (error || !data) return null
    const first = typeof data.first_name === 'string' ? data.first_name.trim() : ''
    const last = typeof data.last_name === 'string' ? data.last_name.trim() : ''
    const combined = [first, last].filter(Boolean).join(' ').trim()
    return combined || null
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
                const includeActive = body?.includeActive === true
                const { data, error } = await admin.rpc('get_call_list_roster', { include_active: includeActive })
                if (error) return errorResponse('Failed to load call list', headers, 400, { detail: error.message })
                return jsonResponse({ data: data ?? [] }, headers)
            }
            case 'contacts': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const customerNum = typeof body?.customerNum === 'string' ? body.customerNum.trim() : ''
                if (!customerNum) return errorResponse('customerNum is required', headers, 400)
                const admin = getAdminClient()
                const { data, error } = await admin
                    .from(CONTACTS_TABLE)
                    .select('*')
                    .eq('customer_num', customerNum)
                    .order('is_primary', { ascending: false })
                    .order('updated_at', { ascending: false })
                if (error) return errorResponse('Failed to load contacts', headers, 400, { detail: error.message })
                return jsonResponse({ data: data ?? [] }, headers)
            }
            case 'save-contact': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const userId = auth as string
                const customerNum = typeof body?.customerNum === 'string' ? body.customerNum.trim() : ''
                const rawDisplay = typeof body?.phoneDisplay === 'string' ? body.phoneDisplay.trim() : ''
                const digits = normalizePhoneDigits(body?.phoneDigits ?? body?.phoneDisplay ?? '')
                if (!customerNum) return errorResponse('customerNum is required', headers, 400)
                if (!digits) return errorResponse('A valid phone number is required', headers, 400)
                const phoneDisplay = rawDisplay || digits
                const label = typeof body?.label === 'string' && body.label.trim() ? body.label.trim() : null
                const contactName =
                    typeof body?.contactName === 'string' && body.contactName.trim() ? body.contactName.trim() : null
                const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
                const isPrimary = body?.isPrimary === true
                const isHidden = body?.isHidden === true
                const source = body?.source === 'dispatch' ? 'dispatch' : 'manual'
                const admin = getAdminClient()
                // Enforce a single visible primary per customer — clear the
                // flag on any other rows before upserting this one as primary.
                if (isPrimary && !isHidden) {
                    const { error: clearError } = await admin
                        .from(CONTACTS_TABLE)
                        .update({ is_primary: false, updated_by: userId })
                        .eq('customer_num', customerNum)
                        .neq('phone_digits', digits)
                    if (clearError) {
                        return errorResponse('Failed to update primary', headers, 400, { detail: clearError.message })
                    }
                }
                const { data, error } = await admin
                    .from(CONTACTS_TABLE)
                    .upsert(
                        {
                            customer_num: customerNum,
                            phone_digits: digits,
                            phone_display: phoneDisplay,
                            label,
                            contact_name: contactName,
                            is_primary: isPrimary,
                            is_hidden: isHidden,
                            source,
                            notes,
                            created_by: userId,
                            updated_by: userId
                        },
                        { onConflict: 'customer_num,phone_digits' }
                    )
                    .select('*')
                    .single()
                if (error) return errorResponse('Failed to save contact', headers, 400, { detail: error.message })
                return jsonResponse({ data }, headers)
            }
            case 'delete-contact': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const userId = auth as string
                const customerNum = typeof body?.customerNum === 'string' ? body.customerNum.trim() : ''
                const digits = normalizePhoneDigits(body?.phoneDigits ?? body?.phoneDisplay ?? '')
                if (!customerNum) return errorResponse('customerNum is required', headers, 400)
                if (!digits) return errorResponse('phoneDigits is required', headers, 400)
                const admin = getAdminClient()
                // If the row was seeded from dispatch we soft-hide so the
                // dispatch HTML doesn't keep re-surfacing it. Manual rows
                // get a hard delete.
                const { data: existing } = await admin
                    .from(CONTACTS_TABLE)
                    .select('id, source')
                    .eq('customer_num', customerNum)
                    .eq('phone_digits', digits)
                    .maybeSingle()
                if (existing?.source === 'dispatch') {
                    const { data, error } = await admin
                        .from(CONTACTS_TABLE)
                        .update({ is_hidden: true, is_primary: false, updated_by: userId })
                        .eq('id', existing.id)
                        .select('*')
                        .single()
                    if (error) return errorResponse('Failed to hide contact', headers, 400, { detail: error.message })
                    return jsonResponse({ data, action: 'hidden' }, headers)
                }
                if (existing?.id) {
                    const { error } = await admin.from(CONTACTS_TABLE).delete().eq('id', existing.id)
                    if (error) return errorResponse('Failed to delete contact', headers, 400, { detail: error.message })
                    return jsonResponse({ success: true, action: 'deleted' }, headers)
                }
                // No row yet — caller is hiding an auto-populated dispatch
                // entry that's never been persisted. Insert a hidden stub.
                const phoneDisplay =
                    typeof body?.phoneDisplay === 'string' && body.phoneDisplay.trim() ? body.phoneDisplay.trim() : digits
                const { data, error } = await admin
                    .from(CONTACTS_TABLE)
                    .insert({
                        customer_num: customerNum,
                        phone_digits: digits,
                        phone_display: phoneDisplay,
                        is_hidden: true,
                        source: 'dispatch',
                        created_by: userId,
                        updated_by: userId
                    })
                    .select('*')
                    .single()
                if (error) return errorResponse('Failed to hide contact', headers, 400, { detail: error.message })
                return jsonResponse({ data, action: 'hidden' }, headers)
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
            case 'leaderboard': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const daysWindow =
                    Number.isInteger(body?.daysWindow) && body.daysWindow > 0
                        ? Math.min(body.daysWindow, 365)
                        : 30
                const admin = getAdminClient()
                const { data, error } = await admin.rpc('get_call_list_leaderboard', {
                    days_window: daysWindow
                })
                if (error) return errorResponse('Failed to load leaderboard', headers, 400, { detail: error.message })
                return jsonResponse({ data: data ?? [], daysWindow }, headers)
            }
            case 'recent-activity': {
                const body = await parseBody(req)
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const limit = Number.isInteger(body?.limit) && body.limit > 0 ? Math.min(body.limit, 500) : 200
                const admin = getAdminClient()
                const { data, error } = await admin
                    .from(CALL_LOG_TABLE)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(limit)
                if (error) return errorResponse('Failed to load activity', headers, 400)
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
