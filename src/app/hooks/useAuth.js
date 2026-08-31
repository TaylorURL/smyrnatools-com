import { useEffect } from 'react'

import { getSessionUserId } from '../../services/SessionService'
import { SESSION_INVALID_EVENT } from '../../utils/APIUtility'
import { SESSION_STORAGE_KEYS } from '../constants/authConstants'

const safeSessionStorageRemove = (key) => {
    try {
        sessionStorage.removeItem(key)
    } catch {}
}

const safeSessionStorageSet = (key, value) => {
    try {
        sessionStorage.setItem(key, value)
    } catch {}
}

/**
 * Mirrors every authentication transition into App.jsx's local session state.
 *
 * Three window events drive it:
 *   - `authSuccess`           — a sign-in or a restored session; adopt the user id
 *   - `authSignOut`           — the user chose to leave; clear state quietly
 *   - `SESSION_INVALID_EVENT` — the session stopped being accepted mid-use, which
 *                               APIUtility raises on a 401 from any non-public
 *                               endpoint and on its missing-credential pre-flight
 *
 * The last one is what keeps a dead session from lingering: AuthContext already
 * drops its own user, but App.jsx holds a separate `userId` that gates the
 * router. Left stale, the view tree keeps rendering and keeps calling
 * authenticated endpoints that can only 401, and a hard refresh is the only way
 * out.
 *
 * The two clearing paths differ in one respect: an invalidated session sets the
 * one-shot expired-session flag so the login screen explains the redirect, while
 * an explicit sign-out clears it so the user is not told a session expired that
 * they closed themselves.
 *
 * @param {Function} setSessionChecked - Called with `true` once the initial session restore attempt finishes.
 */
export function useAuthSession(setUserId, setIsGuestOnly, setRolesLoaded, setSelectedView, setSessionChecked) {
    useEffect(() => {
        const initSession = () => {
            const userId = getSessionUserId()
            if (userId) {
                setUserId(userId)
                safeSessionStorageRemove(SESSION_STORAGE_KEYS.SESSION_EXPIRED_BANNER)
            }
            setSessionChecked(true)
        }
        const handleAuthSuccess = (event) => {
            const userId = event.detail?.userId || getSessionUserId()
            if (userId) {
                setUserId(userId)
                safeSessionStorageRemove(SESSION_STORAGE_KEYS.SESSION_EXPIRED_BANNER)
            }
        }
        const handleSignOut = () => {
            safeSessionStorageRemove(SESSION_STORAGE_KEYS.SESSION_EXPIRED_BANNER)
            setUserId(null)
            setSelectedView({ initialStatusFilter: null, view: 'Dashboard' })
            setIsGuestOnly(false)
            setRolesLoaded(false)
        }
        const handleSessionInvalid = () => {
            // The flag has to be in place before user state clears, because
            // clearing it is what mounts the login screen that reads it.
            safeSessionStorageSet(SESSION_STORAGE_KEYS.SESSION_EXPIRED_BANNER, '1')
            setUserId(null)
            setSelectedView({ initialStatusFilter: null, view: 'Dashboard' })
            setIsGuestOnly(false)
            setRolesLoaded(false)
            // An invalidation can land before the initial restore resolves.
            // Marking the check done sends App.jsx straight to the login
            // screen rather than leaving it on its blank pre-check state.
            setSessionChecked(true)
        }
        initSession()
        window.addEventListener('authSuccess', handleAuthSuccess)
        window.addEventListener('authSignOut', handleSignOut)
        window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
        return () => {
            window.removeEventListener('authSuccess', handleAuthSuccess)
            window.removeEventListener('authSignOut', handleSignOut)
            window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
        }
    }, [setUserId, setIsGuestOnly, setRolesLoaded, setSelectedView, setSessionChecked])
}
