/**
 * In-memory store for the active user's session credentials and JWT.
 *
 * Credentials live only in module-scoped variables — never in
 * sessionStorage/localStorage — so they are discarded when the tab closes
 * and cannot be exfiltrated by a stored XSS payload that fires on a future
 * visit. A hard refresh therefore drops the user back to the login screen;
 * that is the deliberate trade-off for not persisting bearer tokens to a
 * JS-readable storage surface.
 *
 * Realtime auth is updated whenever the JWT changes — pulled in lazily to
 * avoid a hard import cycle with DatabaseService.
 */

let currentJwt = null
let currentJwtExpiresAt = 0
let currentSessionUserId = null
let currentSessionId = null

let realtimeAuthApplier = null

/** Registers the realtime-auth applier (DatabaseService wires this up at module load). */
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
 * Updates any subset of the in-memory session fields. Pass an explicit
 * `null`/`0` to clear an individual field.
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

/** Clears every in-memory session field and resets realtime auth. */
export const clearSession = () => {
    const hadJwt = currentJwt !== null
    currentJwt = null
    currentJwtExpiresAt = 0
    currentSessionUserId = null
    currentSessionId = null
    if (hadJwt) applyRealtimeAuth()
}

export const getSessionJwt = () => currentJwt
export const getJwtExpiresAt = () => currentJwtExpiresAt
export const getSessionUserId = () => currentSessionUserId
export const getSessionId = () => currentSessionId
export const hasActiveSession = () => Boolean(currentSessionUserId && currentSessionId)

/** Body fields recognised by `requireAuthenticated` on every edge function. */
export const getSessionCredentialFields = () => ({
    __sessionUserId: currentSessionUserId || undefined,
    __sessionId: currentSessionId || undefined
})
