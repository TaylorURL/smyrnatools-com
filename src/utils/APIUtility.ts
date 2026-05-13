// @ts-ignore
import { getSessionCredentialFields } from '../services/SessionService'

// @ts-ignore
const EDGE_FUNCTIONS_URL = import.meta.env.REACT_APP_EDGE_FUNCTIONS_URL
// @ts-ignore
const SUPABASE_ANON_KEY = import.meta.env.REACT_APP_SUPABASE_ANON_KEY
const REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 1_000
const SESSION_INVALID_EVENT = 'auth:session-invalid'

/* Auth-service endpoints that legitimately run without an established session
 * (sign-in/up, the session bootstrap calls themselves, password recovery).
 * Every other path needs credentials in sessionStorage before we attempt the
 * network round-trip — calling them without creds just guarantees a 401 and
 * floods the console. */
const PUBLIC_AUTH_PATHS = new Set([
    '/auth-service/sign-in',
    '/auth-service/sign-up',
    '/auth-service/sign-out',
    '/auth-service/create-session',
    '/auth-service/validate-session',
    '/auth-service/restore-session',
    '/auth-service/refresh-token',
    '/auth-service/delete-session',
    '/auth-service/forgot-password',
    '/auth-service/reset-password',
    '/auth-service/load-profile'
])

interface SessionCredentials {
    __sessionUserId?: string
    __sessionId?: string
}

interface APIResponse {
    json: Record<string, unknown>
    res: { ok: boolean; status: number }
}

interface PostOptions {
    headers?: Record<string, string>
    keepalive?: boolean
    maxRetries?: number
    retryDelay?: number
    timeout?: number
}

/** Reads in-memory session credentials for edge function authentication. */
const getSessionCredentials = (): SessionCredentials => getSessionCredentialFields()

/** Notifies the app that the current session is no longer accepted by the
 *  server. AuthContext listens for this and tears down user state so the
 *  next render bounces the user back to the login screen. */
const dispatchSessionInvalid = (reason: string): void => {
    try {
        window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT, { detail: { reason } }))
    } catch {}
}

/**
 * Builds a plain error response in the same shape as a successful response,
 * so callers never need to handle two different return shapes.
 */
const errorResponse = (message: string, status = 0): APIResponse => ({
    json: { error: message },
    res: { ok: false, status }
})

/**
 * Authenticated HTTP client for edge functions.
 *
 * Sends the anon key for database access and custom session credentials
 * (X-User-Id / X-Session-Id headers + body fields) for user auth. Requests
 * are aborted after REQUEST_TIMEOUT_MS. Failed attempts are retried with
 * linear backoff up to DEFAULT_MAX_RETRIES times.
 *
 * On 401 responses or missing client credentials, broadcasts an
 * `auth:session-invalid` event so the AuthContext can clear user state
 * instead of letting every poller hammer the endpoint forever.
 */
const APIUtility = {
    async post(path: string, data?: Record<string, unknown>, options: PostOptions = {}): Promise<APIResponse> {
        const url = `${EDGE_FUNCTIONS_URL}${path}`
        const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
        const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY_MS

        /* Send session credentials BOTH in the body and as headers. The edge
         * `requireAuthenticated` helper checks the body first, then falls
         * back to headers — duplicating into both surfaces sidesteps a
         * subtle bug where some handlers `await req.json()` before calling
         * the helper, consuming the body and making the helper's
         * `req.clone().json()` fallback fail silently. Headers don't have
         * that consumption problem. */
        const credentials = getSessionCredentials()
        const hasCredentials = Boolean(credentials.__sessionUserId && credentials.__sessionId)

        /* Bail before the network call when the caller already lacks
         * credentials AND the endpoint isn't one of the auth bootstrap
         * paths. Otherwise stale pollers (PlanView's 10s schedule probe,
         * presence heartbeats, etc.) flood the console with predictable
         * 401s after sessionStorage is cleared. */
        if (!hasCredentials && !PUBLIC_AUTH_PATHS.has(path)) {
            dispatchSessionInvalid('missing-credentials')
            return errorResponse('Unauthorized', 401)
        }

        const credentialHeaders: Record<string, string> = {}
        if (credentials.__sessionUserId) credentialHeaders['X-User-Id'] = credentials.__sessionUserId
        if (credentials.__sessionId) credentialHeaders['X-Session-Id'] = credentials.__sessionId

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const isLastAttempt = attempt === maxRetries
            const controller = new AbortController()
            const timeoutMs = options.timeout ?? REQUEST_TIMEOUT_MS
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
            try {
                const res = await fetch(url, {
                    body: JSON.stringify({ ...data, ...credentials }),
                    headers: {
                        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        ...credentialHeaders,
                        ...(options.headers || {})
                    },
                    keepalive: Boolean(options.keepalive),
                    method: 'POST',
                    signal: controller.signal
                })
                clearTimeout(timeoutId)
                const json = await res.json().catch((error: Error) => {
                    console.error('Failed to parse JSON response body:', error)
                    return {}
                })
                /* A 401 from any non-auth endpoint means the server no
                 * longer accepts this session (row deleted, expired beyond
                 * the 7-day window, or never created). Stop retrying and
                 * tell the app to sign the user out. */
                if (res.status === 401 && !PUBLIC_AUTH_PATHS.has(path)) {
                    dispatchSessionInvalid('server-rejected')
                    return { json, res }
                }
                return { json, res }
            } catch (error) {
                clearTimeout(timeoutId)
                if (isLastAttempt) {
                    const err = error as Error & { name: string }
                    const message =
                        err.name === 'AbortError'
                            ? 'Request timed out. Please check your connection and try again.'
                            : err.message || 'Network request failed. Please check your connection.'
                    return errorResponse(message)
                }
                await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)))
            }
        }
        return errorResponse('Network request failed after multiple attempts.')
    }
}
export default APIUtility
export { APIUtility, SESSION_INVALID_EVENT }
export type { APIResponse, PostOptions }
