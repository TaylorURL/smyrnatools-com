/**
 * In-memory store for the active user's session credentials and JWT.
 *
 * Session authentication primarily rides on HttpOnly cookies set by
 * auth-service. The browser sends them automatically on every request to
 * `db.smyrnatools.com` (via `credentials: 'include'`), so the session id
 * never enters JavaScript. The only thing JS has is a non-HttpOnly
 * `smyrna_auth=1` flag cookie used as a fast "probably-logged-in" hint.
 *
 * Memory-held `userId` is still useful for read-only display (Sentry user
 * scoping, "createdBy" stamps, etc.). It is populated by AuthContext on
 * boot via `/auth-service/whoami` and cleared on sign-out — NOT persisted.
 * If the tab is reloaded, AuthContext re-derives it from the cookie.
 *
 * The header/body credential surface (`__sessionUserId` / `__sessionId`,
 * `X-User-Id` / `X-Session-Id`) serves the localhost-dev path, where the
 * cookie can't cross origins. It only gets populated when sign-in explicitly
 * returns a sessionId in the body and the caller asks SessionService to
 * remember it.
 */

// Cookies are the only session store, and nothing here writes localStorage.
// Clearing these keys at module load discards any value sitting in the
// browser that a "has-credentials" check would read as a live session.
try {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem('smyrnaSessionUserId')
        window.localStorage.removeItem('smyrnaSessionId')
    }
} catch {}

let currentJwt = null
let currentJwtExpiresAt = 0
let currentSessionUserId = null
let currentSessionId = null

let realtimeAuthApplier = null
let jwtRefresher = null
let pendingJwtRefresh = null
let lastRejectedJwt = null
let refreshRetryBlockedUntil = 0

// A token this close to its expiry is treated as already dead. Without the
// margin a JWT that passes the check can still expire between the check and
// the moment PostgREST evaluates it.
const JWT_EXPIRY_MARGIN_MS = 30 * 1000

// How long a mint that never reached the server holds off the next attempt on
// the same refused token. The alternative to a wait is a mint started by every
// query the page makes for as long as the connection is down.
const JWT_REFRESH_RETRY_COOLDOWN_MS = 5 * 1000

/**
 * Registers the callback that pushes the JWT into the realtime websocket, so
 * this module can drive realtime auth without importing the database client
 * and creating a cycle. DatabaseService registers itself at module load.
 *
 * The applier is invoked immediately with the current JWT, since registration
 * can happen after a session is already in memory.
 */
export const registerRealtimeAuthApplier = (applier) => {
    realtimeAuthApplier = typeof applier === 'function' ? applier : null
    if (realtimeAuthApplier) realtimeAuthApplier(currentJwt)
}

const applyRealtimeAuth = () => {
    if (realtimeAuthApplier) {
        try {
            realtimeAuthApplier(currentJwt)
        } catch {}
    }
}

/**
 * Updates any subset of the session fields. An omitted key leaves its field
 * alone; an explicit falsy value clears it. No values are persisted — the
 * cookie is the source of truth across reloads.
 *
 * Realtime auth is only re-applied when the JWT itself changes, so repeated
 * calls that touch the other fields do not churn the websocket.
 */
export const updateSession = ({ jwt, expiresAt, userId, sessionId } = {}) => {
    let jwtChanged = false
    if (jwt !== undefined) {
        const next = jwt || null
        if (next !== currentJwt) {
            currentJwt = next
            jwtChanged = true
        }
    }
    if (expiresAt !== undefined) currentJwtExpiresAt = expiresAt || 0
    if (userId !== undefined) currentSessionUserId = userId || null
    if (sessionId !== undefined) currentSessionId = sessionId || null
    if (jwtChanged) applyRealtimeAuth()
}

/** Clears every session field, dropping realtime back to anon auth. */
export const clearSession = () => {
    const hadJwt = currentJwt !== null
    currentJwt = null
    currentJwtExpiresAt = 0
    currentSessionUserId = null
    currentSessionId = null
    lastRejectedJwt = null
    refreshRetryBlockedUntil = 0
    if (hadJwt) applyRealtimeAuth()
}

/**
 * Registers the callback that re-mints the session JWT, so this module can
 * refresh an expired token without importing AuthContext and creating a
 * cycle. AuthContext registers itself on mount.
 *
 * The callback resolves `{ refreshed, reachedServer }`: whether a new JWT was
 * applied via `updateSession`, and whether the mint request reached the server
 * at all. The second field is what separates the server refusing this session
 * from the request never arriving, and only the first is the server's word on
 * the token.
 */
export const registerJwtRefresher = (refresher) => {
    jwtRefresher = typeof refresher === 'function' ? refresher : null
}

/** True when a JWT is held but has reached (or is about to reach) its expiry. */
const isSessionJwtExpired = () =>
    Boolean(currentJwt) && currentJwtExpiresAt > 0 && Date.now() >= currentJwtExpiresAt - JWT_EXPIRY_MARGIN_MS

/** Reads a refresher's answer into the two flags this module acts on. A
 *  refresher that throws, or answers with nothing, is read as a mint that never
 *  reached the server, which is the reading that keeps the token retryable. */
const readRefreshResult = (result) => {
    if (result === true) return { reachedServer: true, refreshed: true }
    return { reachedServer: Boolean(result?.reachedServer), refreshed: Boolean(result?.refreshed) }
}

/** Runs the registered refresher, or joins the run already under way. A burst
 *  of queries on wake would otherwise each mint their own token. Resolves the
 *  refresher's answer, so a caller can tell a refusal from an unreachable
 *  server. */
const startJwtRefresh = () => {
    if (!pendingJwtRefresh) {
        pendingJwtRefresh = Promise.resolve()
            .then(() => jwtRefresher())
            .then(readRefreshResult)
            .catch(() => readRefreshResult(null))
            .finally(() => {
                pendingJwtRefresh = null
            })
    }
    return pendingJwtRefresh
}

/**
 * Returns the session JWT, re-minting it first when it has expired.
 *
 * Timers stop in a hidden tab and freeze outright while the machine sleeps, so
 * the periodic refresh in AuthContext cannot be relied on to have run: a tab
 * left open overnight wakes holding a token that died hours ago. Requests read
 * the JWT through here so an expired one is replaced before it goes out rather
 * than coming back as a PostgREST `PGRST301`.
 */
export const ensureFreshJwt = async () => {
    if (!currentJwt || !jwtRefresher || !isSessionJwtExpired()) return currentJwt
    await startJwtRefresh()
    return currentJwt
}

/**
 * Replaces a JWT the server has just refused, and returns whatever token the
 * session holds afterwards.
 *
 * `ensureFreshJwt` asks the clock, and the clock can be wrong: the expiry it
 * compares against is `Date.now()` plus the lifetime the mint reported, so a
 * machine running fast believes a token is alive for as long as its clock is
 * ahead of the server's. A refresh that quietly failed leaves the same gap.
 * Either way the token goes out, PostgREST answers `PGRST301`, and nothing
 * client-side is any the wiser. The server's refusal is the one authority on
 * this, so it is what drives the replacement.
 *
 * The realtime socket carries the same token and has no 401 to read, so a
 * refused channel join comes here too — it is the same refusal in a different
 * protocol.
 *
 * At most one mint is spent per refused token. A caller holding a token that
 * has already been replaced gets the replacement without a round-trip, and a
 * token the server has refused a mint for is not retried — otherwise a session
 * the server has dropped for good would mint once per query for as long as the
 * page stayed open.
 *
 * A mint that never reached the server does not retire the token, and that is
 * the whole of the difference between a page that recovers and one that does
 * not. This path exists for the token the clock still believes is alive, which
 * is exactly the token the periodic refresh leaves alone, so it is the only
 * chance that token gets. Retiring it on a request that was cancelled or
 * dropped on the way out left the page holding a credential PostgREST refuses
 * and nothing willing to replace it: every query answered `PGRST301` and every
 * realtime channel went on rejoining against the dead token until the page was
 * reloaded. An unreachable mint is therefore retried, behind a cooldown so a
 * connection that is simply down cannot turn each query into a mint.
 */
export const refreshRejectedJwt = async (rejectedJwt) => {
    if (!currentJwt || !jwtRefresher) return currentJwt
    if (rejectedJwt !== currentJwt || lastRejectedJwt === rejectedJwt) return currentJwt
    if (Date.now() < refreshRetryBlockedUntil) return currentJwt
    const { reachedServer } = await startJwtRefresh()
    if (reachedServer) {
        lastRejectedJwt = rejectedJwt
        refreshRetryBlockedUntil = 0
    } else {
        refreshRetryBlockedUntil = Date.now() + JWT_REFRESH_RETRY_COOLDOWN_MS
    }
    return currentJwt
}

export const getSessionJwt = () => currentJwt
export const getJwtExpiresAt = () => currentJwtExpiresAt
export const getSessionUserId = () => currentSessionUserId
export const getSessionId = () => currentSessionId

/**
 * Credential fields the edge functions read off the request body. Both values
 * are undefined when running off cookies, which is the normal path; only the
 * cross-origin dev setup populates them.
 */
export const getSessionCredentialFields = () => ({
    __sessionId: currentSessionId || undefined,
    __sessionUserId: currentSessionUserId || undefined
})
