/**
 * Canonical session-validation gate for every edge function.
 *
 * Validates the caller's session against the `users_sessions` table and
 * returns the authenticated userId on success, or a 401 Response on failure.
 * Every non-public edge function MUST call this before processing a request.
 */

// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse } from './cors.ts'
// @ts-ignore
import { readSessionCookies } from './cookies.ts'

const SESSIONS_TABLE = 'users_sessions'
/**
 * How stale the `last_active` stamp is allowed to get before a request
 * rewrites it. The window it feeds is measured in days, so a stamp good to
 * the last few minutes answers the only question the column is read for.
 * Refreshing it on every authenticated call instead put 4.2M row updates
 * against 1,934 rows, which is write and vacuum work the session check does
 * not need.
 */
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000
/**
 * Rolling inactivity window. A session stays valid as long as it has been
 * touched (any authenticated edge function call updates `last_active`) within
 * this many days. Wide enough that someone who opens the app once or twice a
 * month is not forced to re-authenticate from scratch.
 */
export const SESSION_EXPIRY_DAYS = 30

/** Session validation reads a table the caller has no rights to, so it goes
 *  through the service role rather than the request's own credentials. The
 *  anon fallback is there for environments where the role key is unset; every
 *  lookup below then fails closed against RLS. */
function getAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
}

/**
 * Extracts session credentials. Precedence:
 *   1. HttpOnly session cookies (production path)
 *   2. X-User-Id / X-Session-Id headers
 *   3. __sessionUserId / __sessionId body fields
 *
 * The header/body fallbacks cover clients the cookies cannot reach —
 * localhost dev runs on a different registrable domain from the API, so
 * the browser never sends the session cookies there.
 */
function extractSessionCredentials(req: Request, body?: any): { userId: string | null; sessionId: string | null } {
    const fromCookies = readSessionCookies(req)
    if (fromCookies.userId && fromCookies.sessionId) return fromCookies
    const userId = fromCookies.userId || req.headers.get('x-user-id') || body?.__sessionUserId || null
    const sessionId = fromCookies.sessionId || req.headers.get('x-session-id') || body?.__sessionId || null
    return { userId, sessionId }
}

/**
 * Rejects a request whose body names a user other than the one the session
 * proves. A `userId` field in a request body is a claim, not a credential:
 * handlers write under the id returned by `requireAuthenticated`, and this
 * gate turns a body field that disagrees with it into a 403 instead of
 * letting it stand in for the caller. An absent or empty field passes, since
 * the handler supplies the authenticated id itself.
 *
 * @returns null when the claim is consistent with the session, else a 403 Response.
 */
export function requireSameUser(
    claimedUserId: unknown,
    authenticatedUserId: string,
    headers: Record<string, string>
): Response | null {
    if (claimedUserId === undefined || claimedUserId === null || claimedUserId === '') return null
    if (claimedUserId === authenticatedUserId) return null
    return errorResponse('Forbidden: cannot act on behalf of another user', headers, 403)
}

/**
 * Validates the caller's session against the users_sessions table.
 *
 * @returns The authenticated userId (string) on success, or a 401 Response on failure.
 */
export async function requireAuthenticated(
    _supabase: any,
    req: Request,
    headers: any,
    body?: any
): Promise<string | Response> {
    let { userId, sessionId } = extractSessionCredentials(req, body)
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
    const now = Date.now()
    let lastActiveMs: number | null = null
    if (data.last_active) {
        const lastActive = new Date(data.last_active)
        lastActiveMs = lastActive.getTime()
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() - SESSION_EXPIRY_DAYS)
        if (lastActive < expiryDate) return errorResponse('Session expired', headers, 401)
    }
    // Touch last_active without awaiting — the rolling window slides on any
    // authenticated call, and a failed touch must never fail the request.
    // Skipped while the stamp is already inside the touch interval, so a burst
    // of calls from one page rewrites the row once rather than once each.
    if (lastActiveMs === null || now - lastActiveMs >= SESSION_TOUCH_INTERVAL_MS) {
        admin
            .from(SESSIONS_TABLE)
            .update({ last_active: new Date(now).toISOString() })
            .eq('id', sessionId)
            .then(() => {})
            .catch(() => {})
    }
    return userId
}
