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

// Auth-service endpoints that legitimately run without an established session:
// sign-in/up, the session bootstrap and teardown calls themselves, password
// recovery, and the profile/identity probes the app runs while restoring a
// session. Every other path is skipped entirely when no credential signal is
// present, since calling it without one only produces a 401.
const PUBLIC_AUTH_PATHS = new Set([
    '/auth-service/sign-in',
    '/auth-service/sign-up',
    '/auth-service/sign-out',
    '/auth-service/validate-session',
    '/auth-service/restore-session',
    '/auth-service/refresh-token',
    '/auth-service/delete-session',
    '/auth-service/forgot-password',
    '/auth-service/reset-password',
    '/auth-service/load-profile',
    '/auth-service/whoami'
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

/**
 * Reads the non-HttpOnly companion `smyrna_auth=1` flag cookie that the auth
 * service sets alongside the HttpOnly session cookies. The flag carries no
 * secret — it is only a client-readable indicator that the browser believes it
 * holds a valid session, which lets the pre-flight bail below work without
 * exposing the session id to JS.
 */
const hasAuthFlagCookie = (): boolean => {
    if (typeof document === 'undefined') return false
    return document.cookie.split(';').some((part) => part.trim().startsWith('smyrna_auth=1'))
}

/** Announces that the current session is not accepted by the server.
 *  AuthContext and useAuth listen for this and tear down user state so the
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
 * Sends the anon key for database access and, where in-memory credentials
 * exist, session identity (X-User-Id / X-Session-Id headers plus the matching
 * body fields). Requests are aborted after `options.timeout`, defaulting to
 * REQUEST_TIMEOUT_MS, and transport failures are retried with linear backoff up
 * to `options.maxRetries` (default DEFAULT_MAX_RETRIES) additional attempts.
 *
 * Never rejects: transport errors and pre-flight bails come back as an
 * `APIResponse` with `res.ok === false`, so callers only handle one shape.
 *
 * On a 401 from a non-public path, or when no credential signal is available at
 * all, broadcasts SESSION_INVALID_EVENT so auth state is cleared once instead of
 * every poller retrying against a dead session.
 */
const APIUtility = {
    /**
     * Hands the browser a write to deliver, and reports whether it took it.
     *
     * For a write issued as the page goes away — the last one a session makes —
     * this is the transport, not `post`. The browser owns a beacon from the
     * moment it is queued, so the document being torn down cannot cancel it,
     * and a `text/plain` body with no custom headers keeps the POST inside the
     * CORS-safelist, which means it goes straight out instead of waiting on a
     * preflight the dying document may not survive long enough to complete.
     *
     * The trade is that nothing comes back: no status, no body, no way to
     * retry. Session identity therefore rides on the cookies the browser
     * attaches by itself, with the in-memory credential fields in the body for
     * the dev path where the cookie cannot cross origins.
     */
    beacon(path: string, data?: Record<string, unknown>): boolean {
        if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false
        const credentials = getSessionCredentials()
        const hasMemoryCredentials = Boolean(credentials.__sessionUserId && credentials.__sessionId)
        if (!hasMemoryCredentials && !hasAuthFlagCookie()) return false
        try {
            const body = JSON.stringify(hasMemoryCredentials ? { ...data, ...credentials } : (data ?? {}))
            const payload = new Blob([body], { type: 'text/plain;charset=UTF-8' })
            return navigator.sendBeacon(`${EDGE_FUNCTIONS_URL}${path}`, payload)
        } catch (error) {
            console.error('Failed to queue beacon:', error)
            return false
        }
    },
    async post(path: string, data?: Record<string, unknown>, options: PostOptions = {}): Promise<APIResponse> {
        const url = `${EDGE_FUNCTIONS_URL}${path}`
        const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
        const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY_MS

        // Primary auth is the HttpOnly session cookie carried by
        // `credentials: 'include'`. The header/body fallbacks are populated only
        // when SessionService holds in-memory credentials, which happens on the
        // localhost-dev path where cookies cannot cross origins. In production
        // the cookie alone authenticates every call.
        const credentials = getSessionCredentials()
        const hasMemoryCredentials = Boolean(credentials.__sessionUserId && credentials.__sessionId)
        const hasSessionSignal = hasMemoryCredentials || hasAuthFlagCookie()

        // Skip the round-trip entirely when nothing indicates a session and the
        // endpoint needs one; after sign-out, background pollers would otherwise
        // keep producing predictable 401s.
        if (!hasSessionSignal && !PUBLIC_AUTH_PATHS.has(path)) {
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
                    body: JSON.stringify(hasMemoryCredentials ? { ...data, ...credentials } : (data ?? {})),
                    credentials: 'include',
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
                // A 401 from a non-public path means the server rejects this
                // session — the row is gone, inactive past the expiry window, or
                // was never created. Return it without retrying and tell the app
                // to sign the user out.
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
