import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import {
    clearSession,
    getJwtExpiresAt,
    getSessionId,
    getSessionJwt,
    getSessionUserId,
    updateSession
} from '../../services/SessionService'
import APIUtility, { SESSION_INVALID_EVENT } from '../../utils/APIUtility'
import { getBrowserMetadata } from '../../utils/BrowserUtility'
import { SESSION_STORAGE_KEYS } from '../constants/authConstants'

const AUTH_FUNCTION = '/auth-service'
const SESSION_EXPIRY_DAYS = 2

/* Re-mint the session JWT when it has less than this many seconds of life
 * left. With a 1h server-side TTL and a 10-minute floor we get ~5 silent
 * refreshes per active hour, well under the rate the auth-service can
 * handle and small enough that a tab waking from sleep almost always still
 * holds a usable token. */
const JWT_REFRESH_FLOOR_SECONDS = 600
const JWT_REFRESH_INTERVAL_MS = 60 * 1000

/**
 * Authentication context providing sign-in, sign-up, sign-out, session restoration,
 * credential updates, and profile management to the entire component tree.
 */
const AuthContext = createContext()
/** Hook to access the authentication context (user, loading, error, auth methods). */
export function useAuth() {
    return useContext(AuthContext)
}
// ── Private session helpers ───────────────────────────────────────────
function generateSessionId() {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
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

/** Re-mints the session JWT against the current users_sessions row. Returns
 *  true on success. Used both by the periodic timer and by the initial
 *  bootstrap when restore-session can't deliver one. */
async function refreshJwtIfPossible() {
    const userId = getSessionUserId()
    const sessionId = getSessionId()
    if (!userId || !sessionId) return false
    try {
        const { json, res } = await APIUtility.post(`${AUTH_FUNCTION}/refresh-token`, { sessionId, userId })
        if (!res.ok || !json?.jwt) return false
        applyJwt(json.jwt, json.expiresIn)
        return true
    } catch {
        return false
    }
}

/** Creates a database-tracked session record with browser metadata via auth-service. */
async function createDbSession(userId) {
    const sessionId = generateSessionId()
    const { browser, os, device, userAgent } = getBrowserMetadata()
    updateSession({ sessionId, userId })
    try {
        const { json } = await APIUtility.post(`${AUTH_FUNCTION}/create-session`, {
            browser,
            device,
            os,
            sessionId,
            userAgent,
            userId
        })
        if (json?.jwt) applyJwt(json.jwt, json.expiresIn)
    } catch {}
}
/**
 * Validates the current session via auth-service.
 * Expires sessions older than the configured threshold.
 */
async function validateDbSession() {
    const userId = getSessionUserId()
    const sessionId = getSessionId()
    if (!userId || !sessionId) return { userId: null, valid: false }
    try {
        const { json } = await APIUtility.post(`${AUTH_FUNCTION}/validate-session`, { sessionId, userId })
        if (!json?.valid) {
            const lastActive = json?.lastActive ? new Date(json.lastActive) : null
            const expiryThreshold = new Date()
            expiryThreshold.setDate(expiryThreshold.getDate() - SESSION_EXPIRY_DAYS)
            if (lastActive && lastActive < expiryThreshold) clearAllSessionData()
            return { userId: null, valid: false }
        }
        return { userId, valid: true }
    } catch {
        return { userId: null, valid: false }
    }
}
// ── Provider ──────────────────────────────────────────────────────────
/**
 * Authentication provider that wraps the app and supplies auth state and methods.
 * Restores sessions on mount, manages DB session records, and lazy-loads user profiles after sign-in.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const profileTimerRef = useRef(null)

    const restoreSession = useCallback(async () => {
        setLoading(true)
        setError(null)
        const { valid, userId } = await validateDbSession()
        if (!valid || !userId) {
            clearAllSessionData()
            setUser(null)
            setLoading(false)
            return false
        }
        try {
            const sessionId = getSessionId()
            const { json } = await APIUtility.post(`${AUTH_FUNCTION}/restore-session`, { sessionId, userId })
            if (json.success && json.user) {
                if (json.jwt) applyJwt(json.jwt, json.expiresIn)
                else await refreshJwtIfPossible()
                setUser(json.user)
                updateSession({ userId })
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

    /* The edge-function client (APIUtility) fires this event when the
     * server returns 401 or when client-side credentials are missing. Both
     * mean the current session is no longer usable — drop user state so the
     * router falls back to the login screen and pollers (PlanView schedule
     * probe, presence heartbeat, etc.) stop hammering authenticated
     * endpoints. clearAllSessionData wipes the stale credentials so the
     * next render starts from a clean slate. */
    useEffect(() => {
        const handleSessionInvalid = () => {
            clearAllSessionData()
            setUser(null)
            setLoading(false)
        }
        window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
        return () => window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
    }, [])

    /* Silent token refresh — only runs when a JWT was actually minted at
     * login (which requires SUPABASE_JWT_SECRET on the edge function side).
     * If no JWT is present we skip entirely; the app falls through to the
     * anon key like it always has, and we don't spam refresh-token. */
    useEffect(() => {
        const tick = () => {
            const userId = getSessionUserId()
            const sessionId = getSessionId()
            const existingJwt = getSessionJwt()
            if (!userId || !sessionId || !existingJwt) return
            const secondsLeft = (getJwtExpiresAt() - Date.now()) / 1000
            if (secondsLeft > JWT_REFRESH_FLOOR_SECONDS) return
            refreshJwtIfPossible()
        }
        const interval = setInterval(tick, JWT_REFRESH_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [])

    const loadUserProfile = useCallback(async (userId) => {
        if (!userId) return
        try {
            const sessionId = getSessionId()
            const { json } = await APIUtility.post(`${AUTH_FUNCTION}/load-profile`, { sessionId, userId })
            if (json.profile) {
                setUser((cu) => ({ ...cu, profile: json.profile }))
            }
        } catch {}
    }, [])
    const signIn = useCallback(
        async (email, password) => {
            setError(null)
            setLoading(true)
            try {
                const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/sign-in`, { email, password })
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
                setUser(json)
                await createDbSession(json.id)
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
        [loadUserProfile]
    )
    const signUp = useCallback(async (email, password, firstName, lastName) => {
        setError(null)
        setLoading(true)
        try {
            const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/sign-up`, {
                email,
                firstName,
                lastName,
                password
            })
            if (!res.ok) {
                setError(json.error || 'Sign up failed')
                setLoading(false)
                throw new Error(json.error || 'Sign up failed')
            }
            setUser(json)
            await createDbSession(json.id)
            setLoading(false)
            window.dispatchEvent(new CustomEvent('authSuccess', { detail: { userId: json.id } }))
            return json
        } catch (e) {
            setError(e.message)
            setLoading(false)
            throw e
        }
    }, [])
    const signOut = useCallback(async () => {
        clearTimeout(profileTimerRef.current)
        const sessionId = getSessionId()
        if (sessionId) {
            await APIUtility.post(`${AUTH_FUNCTION}/delete-session`, { sessionId }).catch(() => {})
        }
        await APIUtility.post(`${AUTH_FUNCTION}/sign-out`).catch(() => {})
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
    const updatePassword = useCallback(async (userId, newPassword) => {
        const { res, json } = await APIUtility.post(`${AUTH_FUNCTION}/update-password`, {
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
