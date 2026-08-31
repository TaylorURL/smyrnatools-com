import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import {
    clearSession,
    getJwtExpiresAt,
    getSessionId,
    getSessionJwt,
    getSessionUserId,
    registerJwtRefresher,
    updateSession
} from '../../services/SessionService'
import APIUtility, { SESSION_INVALID_EVENT } from '../../utils/APIUtility'
import { getBrowserMetadata } from '../../utils/BrowserUtility'
import { SESSION_STORAGE_KEYS } from '../constants/authConstants'

const AUTH_FUNCTION = '/auth-service'

// Re-mint the session JWT once it has less than this many seconds of life
// left. Against auth-service's one-hour TTL that is roughly one silent
// refresh per active hour, and the ten-minute margin is wide enough that a
// tab waking from sleep almost always still holds a usable token.
const JWT_REFRESH_FLOOR_SECONDS = 600
const JWT_REFRESH_INTERVAL_MS = 60 * 1000
// Tab focus and visibility events fire dozens of times in a normal session,
// but one whoami probe per five minutes is enough to confirm the session is
// alive and to trigger the server-side cookie re-issue that keeps the
// sliding 30-day window fresh.
const VISIBILITY_PROBE_THROTTLE_MS = 5 * 60 * 1000

/**
 * Authentication context providing sign-in, sign-up, sign-out, session restoration,
 * credential updates, and profile management to the entire component tree.
 */
const AuthContext = createContext()
/** Hook to access the authentication context (user, loading, error, auth methods). */
export function useAuth() {
    return useContext(AuthContext)
}
function clearAllSessionData() {
    sessionStorage.removeItem(SESSION_STORAGE_KEYS.CACHED_PLANTS)
    sessionStorage.removeItem(SESSION_STORAGE_KEYS.USER_ROLE)
    clearSession()
}

/** Stores a freshly-minted JWT in memory and propagates it to the realtime channel. */
function applyJwt(jwt, expiresInSeconds) {
    if (!jwt) return
    const expiresAt = expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : 0
    updateSession({ expiresAt, jwt })
}

/**
 * Re-mints the session JWT against the current `users_sessions` row and
 * returns true on success.
 *
 * Which endpoint can do the minting depends on what this tab holds.
 * `refresh-token` reads the user and session ids out of the request body, so
 * it answers only while SessionService still has both in memory — the tab that
 * signed in, and the localhost-dev path where the cookie cannot cross origins.
 * A reloaded tab has neither: the session id lives in an HttpOnly cookie that
 * JavaScript cannot read, and nothing puts it back into memory. That tab mints
 * through `restore-session`, which authenticates off the cookie alone and
 * returns a JWT the same way it does on boot.
 *
 * The cookie-authenticated path is what keeps a reloaded tab usable past the
 * JWT's one-hour life: without it that tab can never replace the token it
 * booted with, and once the token dies every query comes back `PGRST301` and
 * the realtime socket drops its channels.
 *
 * A connection that is down is treated as a failed refresh without the
 * round-trip. The refresh runs on a one-minute tick against a ten-minute
 * floor, so the first tick after the connection returns still has minutes of
 * token life to spend, and the visibility probe re-mints ahead of a tab waking
 * from sleep.
 */
async function refreshJwtIfPossible() {
    const userId = getSessionUserId()
    if (!userId) return false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
    const sessionId = getSessionId()
    const path = sessionId ? `${AUTH_FUNCTION}/refresh-token` : `${AUTH_FUNCTION}/restore-session`
    try {
        const { json, res } = await APIUtility.post(path, sessionId ? { sessionId, userId } : { userId })
        if (!res.ok || !json?.jwt) return false
        applyJwt(json.jwt, json.expiresIn)
        return true
    } catch {
        return false
    }
}

/**
 * Asks the server who the cookie identifies. Returns the userId on success
 * or null. The server is the only thing that can answer this — the cookie is
 * HttpOnly, so the client can see that one exists but never what it holds.
 */
async function whoami() {
    const hasMemory = Boolean(getSessionUserId())
    const hasCookie =
        typeof document !== 'undefined' && document.cookie.split(';').some((p) => p.trim().startsWith('smyrna_auth=1'))
    if (!hasMemory && !hasCookie) return null
    try {
        const { json, res } = await APIUtility.post(`${AUTH_FUNCTION}/whoami`)
        if (!res.ok || !json?.userId) return null
        return json.userId
    } catch {
        return null
    }
}
/**
 * Authentication provider that wraps the app and supplies auth state and methods.
 *
 * Restores the session from the auth cookie on mount, keeps the session JWT
 * alive for as long as the tab lives, and lazy-loads the user profile a
 * couple of seconds after sign-in so the first render is not blocked on it.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const profileTimerRef = useRef(null)

    const restoreSession = useCallback(async () => {
        setLoading(true)
        setError(null)
        const userId = await whoami()
        if (!userId) {
            clearAllSessionData()
            setUser(null)
            setLoading(false)
            return false
        }
        updateSession({ userId })
        try {
            const { json } = await APIUtility.post(`${AUTH_FUNCTION}/restore-session`, { userId })
            if (json.success && json.user) {
                // This response is the same mint a later refresh calls back
                // for, so an absent JWT means none can be had: auth-service is
                // running without a signing secret configured.
                if (json.jwt) applyJwt(json.jwt, json.expiresIn)
                setUser(json.user)
                window.dispatchEvent(new CustomEvent('authSuccess', { detail: { userId } }))
                setLoading(false)
                return true
            }
            clearAllSessionData()
            setUser(null)
            setLoading(false)
            return false
        } catch {
            clearAllSessionData()
            setUser(null)
            setLoading(false)
            return false
        }
    }, [])

    useEffect(() => {
        setLoading(true)
        restoreSession().finally(() => setLoading(false))
        return () => clearTimeout(profileTimerRef.current)
    }, [restoreSession])

    // APIUtility fires this event when the server returns 401 or when no
    // client-side credential signal is present. Both mean the session is no
    // longer usable, so user state is dropped: the router falls back to the
    // login screen and background pollers (the dashboard refresh tick, the
    // presence heartbeat) stop hammering authenticated endpoints.
    useEffect(() => {
        const handleSessionInvalid = () => {
            clearAllSessionData()
            setUser(null)
            setLoading(false)
        }
        window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
        return () => window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
    }, [])

    // Lets SessionService re-mint an expired JWT on demand, which is what
    // covers the gap the interval below cannot: a hidden or sleeping tab stops
    // running timers altogether, so the first query after a long wake would
    // otherwise go out on a token that expired while nothing was ticking.
    useEffect(() => {
        registerJwtRefresher(refreshJwtIfPossible)
        return () => registerJwtRefresher(null)
    }, [])

    // Silent token refresh. auth-service only mints a JWT when its signing
    // secret is configured, so an absent JWT is a valid steady state rather
    // than an error — skipping the tick keeps that deployment from spamming
    // refresh-token once a minute forever.
    useEffect(() => {
        const tick = () => {
            const existingJwt = getSessionJwt()
            if (!existingJwt) return
            const secondsLeft = (getJwtExpiresAt() - Date.now()) / 1000
            if (secondsLeft > JWT_REFRESH_FLOOR_SECONDS) return
            refreshJwtIfPossible()
        }
        const interval = setInterval(tick, JWT_REFRESH_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [])

    // Visibility wake-up probe, covering two cases the JWT-refresh tick
    // cannot:
    //
    //   1. The tab was hidden or the laptop closed for hours or days. On
    //      return the session has to be verified before the user clicks
    //      something and lands in a half-broken UI.
    //   2. Sliding cookie refresh. Every successful whoami re-issues the
    //      session cookies with a fresh 30-day Max-Age, so a user who opens
    //      the app at least once a month never hits cookie expiry.
    //
    // A failed probe dispatches SESSION_INVALID_EVENT by hand: whoami sits in
    // APIUtility's PUBLIC_AUTH_PATHS allowlist, where the automatic dispatch
    // is suppressed so a stale whoami firing after sign-out cannot bounce the
    // login screen itself.
    useEffect(() => {
        let lastProbeAt = 0
        const probe = async () => {
            if (typeof document === 'undefined') return
            if (document.visibilityState !== 'visible') return
            const hasCookie = document.cookie.split(';').some((part) => part.trim().startsWith('smyrna_auth=1'))
            const hasMemory = Boolean(getSessionUserId())
            if (!hasCookie && !hasMemory) return
            if (Date.now() - lastProbeAt < VISIBILITY_PROBE_THROTTLE_MS) return
            lastProbeAt = Date.now()
            const userId = await whoami()
            if (!userId) {
                window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT, { detail: { reason: 'visibility-probe' } }))
                return
            }
            // The tab may have been asleep for longer than the JWT lives.
            // Re-minting it here means the views that reload on wake start
            // against a valid token instead of each retrying past a rejection.
            const secondsLeft = (getJwtExpiresAt() - Date.now()) / 1000
            if (getSessionJwt() && secondsLeft <= JWT_REFRESH_FLOOR_SECONDS) await refreshJwtIfPossible()
        }
        document.addEventListener('visibilitychange', probe)
        window.addEventListener('focus', probe)
        return () => {
            document.removeEventListener('visibilitychange', probe)
            window.removeEventListener('focus', probe)
        }
    }, [])

    const loadUserProfile = useCallback(async (userId) => {
        if (!userId) return
        try {
            const { json } = await APIUtility.post(`${AUTH_FUNCTION}/load-profile`, { userId })
            if (json.profile) {
                setUser((cu) => ({ ...cu, profile: json.profile }))
            }
        } catch {}
    }, [])

    /**
     * Records the just-signed-in user. Cookies were already set by the
     * server in the sign-in / sign-up response. The body also carries
     * `sessionId` so localhost-dev (where the cookie can't cross origins)
     * still has memory credentials to fall back on.
     */
    const acceptAuthResponse = useCallback((json) => {
        setUser(json)
        updateSession({ sessionId: json?.sessionId || null, userId: json?.id || null })
        if (json?.jwt) applyJwt(json.jwt, json.expiresIn)
    }, [])

    const signIn = useCallback(
        async (email, password) => {
            setError(null)
            setLoading(true)
            try {
                const { browser, os, device, userAgent } = getBrowserMetadata()
                const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/sign-in`, {
                    browser,
                    device,
                    email,
                    os,
                    password,
                    userAgent
                })
                if (!res.ok) {
                    const errorMsg = json?.error || json?.message || 'Invalid email or password'
                    setError(errorMsg)
                    setLoading(false)
                    throw new Error(errorMsg)
                }
                if (!json?.id) {
                    const errorMsg = 'Sign in failed - invalid response from server'
                    setError(errorMsg)
                    setLoading(false)
                    throw new Error(errorMsg)
                }
                acceptAuthResponse(json)
                setLoading(false)
                window.dispatchEvent(new CustomEvent('authSuccess', { detail: { userId: json.id } }))
                profileTimerRef.current = setTimeout(() => loadUserProfile(json.id).catch(() => {}), 2000)
                return json
            } catch (e) {
                const errorMsg = e.message || 'An unknown error occurred during sign in'
                setError(errorMsg)
                setLoading(false)
                throw new Error(errorMsg)
            }
        },
        [acceptAuthResponse, loadUserProfile]
    )
    const signUp = useCallback(
        async (email, password, firstName, lastName) => {
            setError(null)
            setLoading(true)
            try {
                const { browser, os, device, userAgent } = getBrowserMetadata()
                const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/sign-up`, {
                    browser,
                    device,
                    email,
                    firstName,
                    lastName,
                    os,
                    password,
                    userAgent
                })
                if (!res.ok) {
                    setError(json.error || 'Sign up failed')
                    setLoading(false)
                    throw new Error(json.error || 'Sign up failed')
                }
                acceptAuthResponse(json)
                setLoading(false)
                window.dispatchEvent(new CustomEvent('authSuccess', { detail: { userId: json.id } }))
                return json
            } catch (e) {
                setError(e.message)
                setLoading(false)
                throw e
            }
        },
        [acceptAuthResponse]
    )
    const signOut = useCallback(async () => {
        clearTimeout(profileTimerRef.current)
        // The sign-out endpoint clears the cookies server-side and deletes
        // the session row they identify. The body-side sessionId only
        // matters on the localhost-dev path, where the cookie cannot cross
        // origins and is the endpoint's sole way of naming the row.
        const sessionId = getSessionId()
        await APIUtility.post(`${AUTH_FUNCTION}/sign-out`, sessionId ? { sessionId } : undefined).catch(() => {})
        clearAllSessionData()
        setUser(null)
        window.dispatchEvent(new CustomEvent('authSignOut'))
        return true
    }, [])
    const updateProfile = useCallback(async (userId, firstName, lastName, plantCode) => {
        setError(null)
        setLoading(true)
        try {
            const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/update-profile`, {
                firstName,
                lastName,
                plantCode,
                userId
            })
            if (!res.ok || !json.success) {
                setError(json.error || 'Update profile failed')
                setLoading(false)
                throw new Error(json.error || 'Update profile failed')
            }
            setUser((cu) => ({ ...cu, profile: json.profile }))
            setLoading(false)
            return true
        } catch (e) {
            setError(e.message)
            setLoading(false)
            throw e
        }
    }, [])
    const updateEmail = useCallback(async (userId, newEmail) => {
        const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/update-email`, { email: newEmail, userId })
        if (!res.ok) throw new Error(json.error || 'Update email failed')
        setUser((cu) => ({ ...cu, email: newEmail.trim().toLowerCase() }))
        return true
    }, [])
    /** Sets a new password. The current one must be sent alongside it: the
     *  edge function re-verifies it so a stolen session cookie cannot lock
     *  the real owner out. */
    const updatePassword = useCallback(async (userId, newPassword, currentPassword) => {
        const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/update-password`, {
            currentPassword,
            password: newPassword,
            userId
        })
        if (!res.ok) throw new Error(json.error || 'Update password failed')
        return true
    }, [])
    /** Server-side current-password verification — keeps hashes off the client. */
    const verifyPassword = useCallback(async (userId, currentPassword) => {
        const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/verify-password`, { currentPassword, userId })
        if (!res.ok) throw new Error(json.error || 'Password verification failed')
        return true
    }, [])
    return (
        <AuthContext.Provider
            value={{
                error,
                isAuthenticated: !!user,
                loadUserProfile,
                loading,
                restoreSession,
                signIn,
                signOut,
                signUp,
                updateEmail,
                updatePassword,
                updateProfile,
                user,
                verifyPassword
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}
