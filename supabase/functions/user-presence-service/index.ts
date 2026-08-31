// @ts-ignore
import { createClient } from '@supabase/supabase-js'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated, requireSameUser } from '../_shared/requireSession.ts'

const PRESENCE_TABLE = 'users_presence'
/** Rows whose last_seen is older than this are marked offline by `cleanup`. */
const STALE_THRESHOLD_MS = 2 * 60 * 1000

function createSupabaseClient() {
    return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
        auth: { autoRefreshToken: false, persistSession: false }
    })
}

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

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()

        const sessionAuth = await requireAuthenticated(null, req, headers)
        if (sessionAuth instanceof Response) return sessionAuth

        const supabase = createSupabaseClient()

        switch (endpoint) {
            case 'set-online':
            case 'set-offline':
            case 'heartbeat':
            case 'update-activity': {
                const body = await parseBody(req)
                const mismatch = requireSameUser(body?.userId, sessionAuth, headers)
                if (mismatch) return mismatch
                const userId = sessionAuth
                const now = nowISO()
                const updateMap: Record<string, any> = {
                    'set-online': { is_online: true, last_seen: now, last_activity: now, updated_at: now },
                    'set-offline': { is_online: false, last_seen: now, updated_at: now },
                    heartbeat: { last_seen: now, updated_at: now },
                    'update-activity': { last_activity: now, last_seen: now, updated_at: now }
                }
                // Only set-online creates the presence row; the other endpoints
                // update in place, so a heartbeat for a user who never went
                // online is a no-op rather than a resurrection.
                const isUpsert = endpoint === 'set-online'
                const { error } = isUpsert
                    ? await supabase
                          .from(PRESENCE_TABLE)
                          .upsert({ user_id: userId, ...updateMap[endpoint] }, { onConflict: 'user_id' })
                    : await supabase.from(PRESENCE_TABLE).update(updateMap[endpoint]).eq('user_id', userId)
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'cleanup': {
                const staleTime = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()
                const { error } = await supabase
                    .from(PRESENCE_TABLE)
                    .update({ is_online: false, updated_at: nowISO() })
                    .eq('is_online', true)
                    .lt('last_seen', staleTime)
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'merge-device': {
                const body = await parseBody(req)
                const mismatch = requireSameUser(body?.userId, sessionAuth, headers)
                if (mismatch) return mismatch
                const userId = sessionAuth
                const device = body?.device
                if (!device) return errorResponse('Device is required', headers, 400)
                const now = nowISO()
                const { data } = await supabase
                    .from(PRESENCE_TABLE)
                    .select('active_devices')
                    .eq('user_id', userId)
                    .maybeSingle()
                const devices =
                    data?.active_devices && typeof data.active_devices === 'object' ? { ...data.active_devices } : {}
                devices[device] = now
                const { error } = await supabase
                    .from(PRESENCE_TABLE)
                    .update({ active_devices: devices })
                    .eq('user_id', userId)
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'update-last-login': {
                const body = await parseBody(req)
                const mismatch = requireSameUser(body?.userId, sessionAuth, headers)
                if (mismatch) return mismatch
                const userId = sessionAuth
                const loginDate = body?.date || nowISO().split('T')[0]
                const { error } = await supabase.from('users').update({ last_login_at: loginDate }).eq('id', userId)
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ success: true }, headers)
            }
            case 'fetch-online-users': {
                const { data, error } = await supabase
                    .from(PRESENCE_TABLE)
                    .select('user_id, last_seen, last_activity')
                    .eq('is_online', true)
                    .order('last_activity', { ascending: false })
                if (error) return errorResponse('Operation failed', headers, 400)
                return jsonResponse({ data: data ?? [] }, headers)
            }
            default:
                return errorResponse('Invalid endpoint', headers, 404, { path: url.pathname })
        }
    } catch (error) {
        return errorResponse('Internal server error', headers, 500)
    }
})
