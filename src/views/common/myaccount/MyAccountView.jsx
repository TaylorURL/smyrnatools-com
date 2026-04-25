import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'

import VersionPopup from '../../../app/components/common/VersionPopup'
const ChangelogView = lazy(() => import('../login/ChangelogView'))
import { useAuth } from '../../../app/context/AuthContext'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useTutorial } from '../../../app/context/TutorialContext'
import { useThemeMode } from '../../../app/hooks/useThemeMode'
import { useVersion } from '../../../app/hooks/useVersion'
import { getBrowserName, getDeviceType, getOSName } from '../../../app/utils/BrowserDetection'
import { Database } from '../../../services/DatabaseService'
import { UserService } from '../../../services/UserService'
import APIUtility from '../../../utils/APIUtility'
const AUTH_FUNCTION = '/auth-service'
import { CacheUtility } from '../../../utils/CacheUtility'
import DashboardUtility from '../../../utils/DashboardUtility'

const MAX_BRIGHTNESS_HEX = '#D6D6D6'
const MAX_BRIGHTNESS_VALUE = 214

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const FIELD_LABEL_CLASS = 'block text-[10px] font-semibold uppercase tracking-wider mb-1.5'

/** Parses a 6-digit hex color string into its {r, g, b} components. */
const getRgbFromHex = (hex) => {
    const cleanHex = hex.replace('#', '')
    return {
        b: parseInt(cleanHex.substring(4, 6), 16),
        g: parseInt(cleanHex.substring(2, 4), 16),
        r: parseInt(cleanHex.substring(0, 2), 16)
    }
}

/** Darkens a color if its average brightness exceeds the threshold, ensuring sufficient contrast on white backgrounds. */
const clampColorToMaxBrightness = (hex) => {
    const { b, g, r } = getRgbFromHex(hex)
    const currentBrightness = (r + g + b) / 3
    if (currentBrightness <= MAX_BRIGHTNESS_VALUE) return hex
    const scale = MAX_BRIGHTNESS_VALUE / currentBrightness
    const clampedR = Math.round(r * scale)
    const clampedG = Math.round(g * scale)
    const clampedB = Math.round(b * scale)
    return `#${clampedR.toString(16).padStart(2, '0')}${clampedG.toString(16).padStart(2, '0')}${clampedB.toString(16).padStart(2, '0')}`
}

const START_PAGE_OPTIONS = [
    { icon: 'fa-chart-pie', id: 'Dashboard' },
    { icon: 'fa-truck-moving', id: 'Mixers' },
    { icon: 'fa-truck', id: 'Tractors' },
    { icon: 'fa-trailer', id: 'Trailers' },
    { icon: 'fa-hard-hat', id: 'Operators' },
    { icon: 'fa-list-check', id: 'List' },
    { icon: 'fa-file-lines', id: 'Reports' },
    { icon: 'fa-calendar-days', id: 'Plan' },
    { icon: 'fa-trophy', id: 'Leaderboards' },
    { icon: 'fa-cogs', id: 'Heavy Equipment' },
    { icon: 'fa-truck-pickup', id: 'Pickup Trucks' },
    { icon: 'fa-calculator', id: 'Calculators' }
]

/* ── Plan-tab styled atoms ─────────────────────────────────────────────── */

const FieldStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

function Card({ children, className = '' }) {
    return (
        <div
            className={`rounded ${className}`}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            {children}
        </div>
    )
}

function CardHeader({ icon, title, description, accentColor }) {
    return (
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div
                className="flex h-7 w-7 items-center justify-center rounded shrink-0"
                style={{ background: 'var(--bg-tertiary)', color: accentColor }}
            >
                <i className={`fas ${icon} text-[12px]`} />
            </div>
            <div className="min-w-0">
                <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    {title}
                </div>
                {description && (
                    <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {description}
                    </div>
                )}
            </div>
        </div>
    )
}

function PrimaryButton({ accentColor, children, disabled, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accentColor }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
    )
}

function SubtleButton({ children, danger = false, disabled = false, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-95"
            style={{
                background: danger ? '#fee2e2' : 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                color: danger ? '#b91c1c' : 'var(--text-secondary)'
            }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
    )
}

function Toggle({ accentColor, checked, onChange, ariaLabel }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={onChange}
            className="relative inline-flex shrink-0 rounded transition-colors"
            style={{
                background: checked ? accentColor : 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                height: 18,
                width: 32
            }}
        >
            <span
                className="absolute top-1/2 -translate-y-1/2 rounded transition-all bg-white"
                style={{
                    boxShadow: '0 1px 1px rgba(0,0,0,0.15)',
                    height: 12,
                    left: checked ? 16 : 2,
                    width: 12
                }}
            />
        </button>
    )
}

/** Custom styled dropdown for selecting the default start page. */
function StartPageDropdown({ value, accentColor, onChange }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const selected = START_PAGE_OPTIONS.find((o) => o.id === value) || START_PAGE_OPTIONS[0]

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left transition-colors"
                style={FieldStyle}
            >
                <span className="flex items-center gap-2">
                    <span
                        className="flex h-6 w-6 items-center justify-center rounded"
                        style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                    >
                        <i className={`fas ${selected.icon} text-[10px]`} />
                    </span>
                    <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {selected.id}
                    </span>
                </span>
                <i
                    className={`fas fa-chevron-down text-[9px] transition-transform ${open ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-tertiary)' }}
                />
            </button>
            {open && (
                <div
                    className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded py-1"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    {START_PAGE_OPTIONS.map(({ icon, id }) => {
                        const isActive = id === value
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => {
                                    onChange(id)
                                    setOpen(false)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-tertiary"
                                style={{
                                    background: isActive ? `${accentColor}14` : 'transparent',
                                    color: isActive ? accentColor : 'var(--text-primary)',
                                    fontWeight: isActive ? 600 : 500
                                }}
                            >
                                <span
                                    className="flex h-5 w-5 items-center justify-center rounded"
                                    style={{
                                        background: isActive ? `${accentColor}20` : 'var(--bg-tertiary)',
                                        color: accentColor
                                    }}
                                >
                                    <i className={`fas ${icon} text-[10px]`} />
                                </span>
                                {id}
                                {isActive && <i className="fas fa-check ml-auto text-[10px]" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function MyAccountView({ userId }) {
    const { preferences, updatePreferences } = usePreferences()
    const { isMobile, resetAllTutorials, triggerTutorial } = useTutorial()
    const { signOut: authSignOut, verifyPassword, updatePassword: authUpdatePassword } = useAuth()
    const { themeMode } = useThemeMode()
    const version = useVersion()
    const accentColor = preferences.accentColor || '#2A3163'

    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [userRole, setUserRole] = useState('')
    const [plantCode, setPlantCode] = useState('')
    const [additionalPlants, setAdditionalPlants] = useState([])
    const [_regionName, setRegionName] = useState('')
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [, setIsAuthenticated] = useState(false)
    const [, setUser] = useState(null)
    const [activeTab, setActiveTab] = useState('profile')
    const [permittedRegions, setPermittedRegions] = useState([])
    const [regionsLoaded, setRegionsLoaded] = useState(false)
    const [sessions, setSessions] = useState([])
    const [currentSessionId, setCurrentSessionId] = useState('')
    const [showChangelog, setShowChangelog] = useState(false)
    const [cacheClearing, setCacheClearing] = useState(false)

    const formatSessionTime = (timestamp) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)
        if (diffMins < 5) return 'Active now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return `${diffDays}d ago`
    }

    /** Deletes a remote session record. Refuses to revoke the current session — user must sign out instead. */
    const handleRevokeSession = async (sessionId) => {
        if (sessionId === currentSessionId) {
            setMessage('Cannot revoke current session. Please sign out instead.')
            setTimeout(() => setMessage(''), 3000)
            return
        }
        try {
            await APIUtility.post(`${AUTH_FUNCTION}/delete-session`, { sessionId })
            setSessions(sessions.filter((s) => s.id !== sessionId))
            setMessage('Session revoked successfully')
            setTimeout(() => setMessage(''), 3000)
        } catch (error) {
            setMessage(`Error revoking session: ${error.message}`)
            setTimeout(() => setMessage(''), 3000)
        }
    }

    useEffect(() => {
        triggerTutorial('preferences-tab-hint', 500)
    }, [triggerTutorial])

    // Loads profile, roles, permitted regions, and active sessions.
    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                const { data } = await Database.auth.getSession()
                const session = data?.session
                const uid = userId || session?.user?.id || sessionStorage.getItem('userId')
                if (!uid) {
                    setIsAuthenticated(false)
                    throw new Error('No active session or user ID')
                }
                setIsAuthenticated(true)
                const [profileData, userData, highestRole, regionsList] = await Promise.all([
                    Database.from('users_profiles')
                        .select('*')
                        .eq('id', uid)
                        .single()
                        .then((r) => r.data)
                        .catch(() => null),
                    Database.from('users')
                        .select('email')
                        .eq('id', uid)
                        .single()
                        .then((r) => r.data)
                        .catch(() => null),
                    UserService.getHighestRole(uid).catch(() => null),
                    UserService.getPermittedRegions(uid).catch(() => [])
                ])
                const userEmail = session?.user?.email || userData?.email || ''
                if (userEmail) setEmail(userEmail)
                if (cancelled) return
                if (highestRole?.name) setUserRole(highestRole.name)
                if (profileData) {
                    setUser({ ...profileData })
                    if (profileData.first_name) setFirstName(profileData.first_name)
                    if (profileData.last_name) setLastName(profileData.last_name)
                    if (profileData.plant_code) setPlantCode(profileData.plant_code)
                    if (Array.isArray(profileData.additional_assigned_plants))
                        setAdditionalPlants(profileData.additional_assigned_plants)
                }
                if (regionsList && regionsList.length) {
                    setPermittedRegions(regionsList)
                    const currentSelCode = preferences.selectedRegion?.code
                    let chosen = regionsList.find((r) => (r.regionCode || r.region_code) === currentSelCode)
                    if (!chosen) chosen = regionsList[0]
                    const sel = {
                        code: chosen.regionCode || chosen.region_code || '',
                        name: chosen.regionName || chosen.region_name || '',
                        type: chosen.type || chosen.region_type || ''
                    }
                    updatePreferences('selectedRegion', sel)
                    setRegionName(sel.name)
                } else {
                    setPermittedRegions([])
                    updatePreferences('selectedRegion', { code: '', name: '', type: '' })
                    setRegionName('')
                }
                if (uid) {
                    const userAgent = navigator.userAgent
                    const currentBrowser = getBrowserName(userAgent)
                    const currentOS = getOSName(userAgent)
                    const currentDevice = getDeviceType(userAgent)
                    const { data: existingSessions } = await Database.from('users_sessions')
                        .select('*')
                        .eq('user_id', uid)
                        .gte('last_active', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                        .order('last_active', { ascending: false })
                    let matchingSession = null
                    const duplicates = []
                    if (existingSessions && existingSessions.length > 0) {
                        const sessionsByDevice = {}
                        for (const session of existingSessions) {
                            const key = `${session.browser}_${session.os}_${session.device}`
                            if (
                                session.browser === currentBrowser &&
                                session.os === currentOS &&
                                session.device === currentDevice
                            ) {
                                if (!matchingSession) {
                                    matchingSession = session
                                } else {
                                    duplicates.push(session.id)
                                }
                            }
                            if (sessionsByDevice[key]) {
                                duplicates.push(session.id)
                            } else {
                                sessionsByDevice[key] = session
                            }
                        }
                        if (duplicates.length > 0) {
                            for (const dupId of duplicates) {
                                await APIUtility.post(`${AUTH_FUNCTION}/delete-session`, { sessionId: dupId }).catch(
                                    () => {}
                                )
                            }
                        }
                    }
                    let currentSessId
                    if (matchingSession) {
                        currentSessId = matchingSession.id
                        sessionStorage.setItem('sessionId', currentSessId)
                        await APIUtility.post(`${AUTH_FUNCTION}/validate-session`, {
                            sessionId: currentSessId,
                            userId: uid
                        }).catch(() => {})
                    } else {
                        currentSessId = `${uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                        sessionStorage.setItem('sessionId', currentSessId)
                        await APIUtility.post(`${AUTH_FUNCTION}/create-session`, {
                            browser: currentBrowser,
                            device: currentDevice,
                            os: currentOS,
                            sessionId: currentSessId,
                            userAgent,
                            userId: uid
                        }).catch(() => {})
                    }
                    setCurrentSessionId(currentSessId)
                    const { data: userSessions } = await Database.from('users_sessions')
                        .select('*')
                        .eq('user_id', uid)
                        .gte('last_active', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                        .order('last_active', { ascending: false })
                        .limit(10)
                    if (userSessions && userSessions.length > 0) {
                        const sessionsList = userSessions.map((s) => ({
                            browser: s.browser,
                            createdAt: s.created_at,
                            device: s.device,
                            id: s.id,
                            isCurrent: s.id === currentSessId,
                            lastActive: s.last_active,
                            os: s.os
                        }))
                        setSessions(sessionsList)
                    }
                }
            } catch (e) {
                if (!cancelled) setMessage(`Error: ${e.message}`)
            } finally {
                if (!cancelled) {
                    setRegionsLoaded(true)
                    setLoading(false)
                }
            }
        }
        load()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    const updateProfile = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        try {
            const uid = userId || sessionStorage.getItem('userId')
            if (!uid) {
                const {
                    data: { session },
                    error: sessionError
                } = await Database.auth.getSession()
                if (sessionError || !session) throw new Error('No active session or user ID')
                const { error: pe } = await Database.from('users_profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', session.user.id)
                if (pe) throw pe
            } else {
                const { error: pe } = await Database.from('users_profiles')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', uid)
                if (pe) throw pe
            }
            setMessage('Profile updated successfully!')
        } catch (err) {
            setMessage(`Error: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    /** Verifies the current password server-side, updates to the new one, then forces sign-out so the user re-authenticates. */
    const updatePassword = async (e) => {
        e.preventDefault()
        setLoading(true)
        setPasswordError('')
        setMessage('')
        try {
            if (!currentPassword) throw new Error('Current password is required')
            if (newPassword !== confirmPassword) throw new Error('New passwords do not match')
            if (newPassword.length < 8) throw new Error('Password must be at least 8 characters')
            const uid = userId || sessionStorage.getItem('userId')
            if (!uid) throw new Error('No active session')
            await verifyPassword(uid, currentPassword)
            await authUpdatePassword(uid, newPassword)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setShowPasswordModal(false)
            await authSignOut()
            window.location.href = '/login'
        } catch (err) {
            setPasswordError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSignOut = async () => {
        setLoading(true)
        try {
            await authSignOut()
            window.location.href = '/'
        } catch (err) {
            setMessage(`Error signing out: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleChangeRegion = (e) => {
        const code = e.target.value
        if (!code) {
            updatePreferences('selectedRegion', { code: '', name: '', type: '' })
            setRegionName('')
            return
        }
        const r = permittedRegions.find((x) => (x.regionCode || x.region_code) === code)
        if (!r) return
        const name = r.regionName || r.region_name || ''
        const type = r.type || r.region_type || ''
        updatePreferences('selectedRegion', { code, name, type })
        setRegionName(name)
    }

    const getInitials = () => {
        if (firstName && lastName) return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
        return null
    }

    const handleClearCache = () => {
        setCacheClearing(true)
        try {
            CacheUtility.clear()
            UserService.clearCache()
            DashboardUtility.clearAISummaryCache()
            sessionStorage.removeItem('dashboard_assets_cache_v1')
            localStorage.removeItem('srm_history_ai_summaries')
            localStorage.removeItem('cachedOperators')
            localStorage.removeItem('cachedOperatorsDate')
            localStorage.removeItem('cachedManagers')
            localStorage.removeItem('cachedManagersDate')
            const keysToRemove = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key.endsWith('_last_view_mode') || key.startsWith('maintenance_draft_')) {
                    keysToRemove.push(key)
                }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key))
            localStorage.removeItem('detailview-sidebar-collapsed')
            setMessage('All caches cleared successfully!')
            setTimeout(() => setMessage(''), 3000)
        } catch {
            setMessage('Error: Failed to clear some caches')
            setTimeout(() => setMessage(''), 3000)
        } finally {
            setCacheClearing(false)
        }
    }

    if (loading) {
        return <AccountSkeleton />
    }

    if (showChangelog) {
        return (
            <Suspense
                fallback={
                    <div className="flex h-screen items-center justify-center">
                        <i className="fas fa-spinner fa-spin text-2xl" style={{ color: accentColor }} />
                    </div>
                }
            >
                <ChangelogView onBack={() => setShowChangelog(false)} />
            </Suspense>
        )
    }

    const TABS = [
        { id: 'profile', icon: 'fa-user', label: 'Profile' },
        { id: 'security', icon: 'fa-shield-alt', label: 'Security' },
        { id: 'preferences', icon: 'fa-cog', label: 'Preferences' },
        { id: 'notifications', icon: 'fa-bell', label: 'Notifications' }
    ]

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
            {/* Page header */}
            <div
                className="sticky top-0 z-30"
                style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
            >
                <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 py-2">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-user-cog text-[11px]" />
                        </div>
                        <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Account Settings
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            · profile, security, preferences
                        </span>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 py-4">
                {message && (
                    <div
                        className="mb-3 flex items-center gap-2 rounded px-3 py-2"
                        style={{
                            background: message.includes('Error') ? '#fee2e2' : '#dcfce7',
                            border: `1px solid ${message.includes('Error') ? '#fca5a5' : '#86efac'}`,
                            color: message.includes('Error') ? '#b91c1c' : '#166534'
                        }}
                    >
                        <i
                            className={`fas ${message.includes('Error') ? 'fa-exclamation-circle' : 'fa-check-circle'} text-[12px]`}
                        />
                        <span className="flex-1 text-[12px] font-medium">{message}</span>
                        <button
                            onClick={() => setMessage('')}
                            className="opacity-60 hover:opacity-100"
                            aria-label="Dismiss"
                        >
                            <i className="fas fa-times text-[11px]" />
                        </button>
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="lg:sticky lg:top-16 flex flex-col gap-3">
                            {/* Profile card */}
                            <Card>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded text-[14px] font-bold text-white"
                                        style={{ background: accentColor }}
                                    >
                                        {getInitials() || <i className="fas fa-user text-[14px]" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div
                                            className="text-[13px] font-semibold truncate"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {firstName || lastName
                                                ? `${firstName || ''} ${lastName || ''}`.trim()
                                                : 'My Account'}
                                        </div>
                                        <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                                            {email || 'No email'}
                                        </div>
                                        {userRole && (
                                            <span
                                                className="mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider"
                                                style={{ background: `${accentColor}14`, color: accentColor }}
                                            >
                                                {userRole}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Card>

                            {/* Tab nav */}
                            <Card>
                                <nav className="flex flex-col">
                                    {TABS.map(({ id, icon, label }, idx) => {
                                        const isActive = activeTab === id
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => setActiveTab(id)}
                                                data-tutorial-target={id === 'preferences' ? 'preferences-tab' : null}
                                                className="flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-bg-tertiary"
                                                style={{
                                                    background: isActive ? `${accentColor}14` : 'transparent',
                                                    borderBottom:
                                                        idx < TABS.length - 1
                                                            ? '1px solid var(--border-light)'
                                                            : 'none',
                                                    borderLeft: isActive
                                                        ? `2px solid ${accentColor}`
                                                        : '2px solid transparent',
                                                    color: isActive ? accentColor : 'var(--text-secondary)'
                                                }}
                                            >
                                                <i className={`fas ${icon} text-[12px] w-4 text-center`} />
                                                <span className="text-[12px] font-semibold">{label}</span>
                                            </button>
                                        )
                                    })}
                                </nav>
                            </Card>

                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 px-3 py-2 rounded text-[10.5px] font-semibold uppercase tracking-wider transition-colors hover:brightness-95"
                                style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    color: '#b91c1c'
                                }}
                            >
                                <i className="fas fa-sign-out-alt text-[10px]" />
                                Sign Out
                            </button>
                        </div>
                    </div>

                    {/* Main column */}
                    <div className="flex flex-col gap-3 lg:col-span-2">
                        {activeTab === 'profile' && (
                            <ProfileTab
                                accentColor={accentColor}
                                additionalPlants={additionalPlants}
                                email={email}
                                firstName={firstName}
                                lastName={lastName}
                                loading={loading}
                                onChangeRegion={handleChangeRegion}
                                onSubmit={updateProfile}
                                permittedRegions={permittedRegions}
                                plantCode={plantCode}
                                preferences={preferences}
                                regionsLoaded={regionsLoaded}
                                setFirstName={setFirstName}
                                setLastName={setLastName}
                                userRole={userRole}
                            />
                        )}
                        {activeTab === 'security' && (
                            <SecurityTab
                                accentColor={accentColor}
                                formatSessionTime={formatSessionTime}
                                onOpenPasswordModal={() => setShowPasswordModal(true)}
                                onRevokeSession={handleRevokeSession}
                                onSignOut={handleSignOut}
                                sessions={sessions}
                            />
                        )}
                        {activeTab === 'preferences' && (
                            <PreferencesTab
                                accentColor={accentColor}
                                cacheClearing={cacheClearing}
                                isMobile={isMobile}
                                onClearCache={handleClearCache}
                                onResetTutorials={async () => {
                                    await resetAllTutorials()
                                    setMessage('Tutorials reset! Refresh the page to see them again.')
                                    setTimeout(() => setMessage(''), 3000)
                                }}
                                preferences={preferences}
                                themeMode={themeMode}
                                updatePreferences={updatePreferences}
                            />
                        )}
                        {activeTab === 'notifications' && (
                            <NotificationsTab
                                accentColor={accentColor}
                                preferences={preferences}
                                updatePreferences={updatePreferences}
                            />
                        )}
                    </div>
                </div>
            </div>

            <VersionPopup version={version} onClick={() => setShowChangelog(true)} />

            {showPasswordModal && (
                <PasswordModal
                    accentColor={accentColor}
                    confirmPassword={confirmPassword}
                    currentPassword={currentPassword}
                    loading={loading}
                    newPassword={newPassword}
                    onClose={() => setShowPasswordModal(false)}
                    onSubmit={updatePassword}
                    passwordError={passwordError}
                    setConfirmPassword={setConfirmPassword}
                    setCurrentPassword={setCurrentPassword}
                    setNewPassword={setNewPassword}
                />
            )}
        </div>
    )
}

/* ── Tab content components ───────────────────────────────────────────── */

function ProfileTab({
    accentColor,
    additionalPlants,
    email,
    firstName,
    lastName,
    loading,
    onChangeRegion,
    onSubmit,
    permittedRegions,
    plantCode,
    preferences,
    regionsLoaded,
    setFirstName,
    setLastName,
    userRole
}) {
    return (
        <>
            <Card>
                <CardHeader
                    accentColor={accentColor}
                    icon="fa-id-card"
                    title="Personal Information"
                    description="Update your name and contact details"
                />
                <form onSubmit={onSubmit} className="px-4 py-3 flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                First Name
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Enter first name"
                                required
                                className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                                style={FieldStyle}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Last Name
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Enter last name"
                                required
                                className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                                style={FieldStyle}
                            />
                        </div>
                    </div>
                    <PrimaryButton accentColor={accentColor} disabled={loading} icon="fa-save" type="submit">
                        Save Changes
                    </PrimaryButton>
                </form>
            </Card>

            <Card>
                <CardHeader
                    accentColor={accentColor}
                    icon="fa-info-circle"
                    title="Account Details"
                    description="View your account information"
                />
                <div className="px-4">
                    <DetailRow icon="fa-envelope" label="Email" value={email || 'Not set'} />
                    {userRole && <DetailRow icon="fa-user-tag" label="Role" value={userRole} />}
                    <div
                        className="flex items-center justify-between py-2.5"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div className="flex items-center gap-2.5">
                            <i
                                className="fas fa-globe text-[11px] w-4 text-center"
                                style={{ color: 'var(--text-tertiary)' }}
                            />
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                Region
                            </span>
                        </div>
                        <div className="relative">
                            <select
                                value={preferences.selectedRegion?.code || ''}
                                onChange={onChangeRegion}
                                disabled={!regionsLoaded}
                                className="appearance-none rounded py-1 pl-2.5 pr-7 text-[12px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                style={FieldStyle}
                            >
                                {permittedRegions.map((r) => (
                                    <option key={r.regionCode || r.region_code} value={r.regionCode || r.region_code}>
                                        {r.regionName || r.region_name || ''}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <i
                                    className="fas fa-chevron-down text-[9px]"
                                    style={{ color: 'var(--text-tertiary)' }}
                                />
                            </div>
                        </div>
                    </div>
                    {plantCode && <DetailRow icon="fa-building" label="Plant Code" value={plantCode} mono />}
                    {additionalPlants.length > 0 && (
                        <div className="py-2.5">
                            <div className="flex items-center gap-2.5 mb-1.5">
                                <i
                                    className="fas fa-building text-[11px] w-4 text-center"
                                    style={{ color: 'var(--text-tertiary)' }}
                                />
                                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                    Additional Plants
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ml-7">
                                {additionalPlants.map((code) => (
                                    <span
                                        key={code}
                                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider font-mono tabular-nums"
                                        style={{
                                            background: `${accentColor}14`,
                                            color: accentColor
                                        }}
                                    >
                                        {code}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </>
    )
}

function DetailRow({ icon, label, mono, value }) {
    return (
        <div
            className="flex items-center justify-between py-2.5"
            style={{ borderBottom: '1px solid var(--border-light)' }}
        >
            <div className="flex items-center gap-2.5">
                <i className={`fas ${icon} text-[11px] w-4 text-center`} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </span>
            </div>
            <span
                className={`text-[12px] font-semibold ${mono ? 'font-mono tabular-nums' : ''}`}
                style={{ color: 'var(--text-primary)' }}
            >
                {value}
            </span>
        </div>
    )
}

function SecurityTab({ accentColor, formatSessionTime, onOpenPasswordModal, onRevokeSession, onSignOut, sessions }) {
    return (
        <>
            <Card>
                <CardHeader
                    accentColor={accentColor}
                    icon="fa-key"
                    title="Password"
                    description="Keep your account secure with a strong password"
                />
                <div className="px-4 py-3">
                    <PrimaryButton accentColor={accentColor} icon="fa-lock" onClick={onOpenPasswordModal}>
                        Change Password
                    </PrimaryButton>
                </div>
            </Card>

            <Card>
                <div
                    className="flex items-center gap-2.5 px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                    <div
                        className="flex h-7 w-7 items-center justify-center rounded shrink-0"
                        style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                    >
                        <i className="fas fa-laptop text-[12px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Active Sessions
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            Manage your login sessions
                        </div>
                    </div>
                    <span
                        className="font-mono tabular-nums rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                    >
                        {sessions.length}
                    </span>
                </div>
                <div>
                    {sessions.length > 0 ? (
                        sessions.map((session, idx) => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between gap-3 px-4 py-2.5"
                                style={{
                                    background: session.isCurrent ? '#dcfce780' : 'transparent',
                                    borderBottom: idx < sessions.length - 1 ? '1px solid var(--border-light)' : 'none'
                                }}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className="flex h-7 w-7 items-center justify-center rounded shrink-0"
                                        style={{
                                            background: session.isCurrent ? '#dcfce7' : 'var(--bg-tertiary)',
                                            color: session.isCurrent ? '#166534' : 'var(--text-secondary)'
                                        }}
                                    >
                                        <i
                                            className={`fas ${session.device === 'Mobile' ? 'fa-mobile-alt' : session.device === 'Tablet' ? 'fa-tablet-alt' : 'fa-desktop'} text-[11px]`}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="text-[12px] font-semibold truncate"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {session.browser}
                                            </span>
                                            {session.isCurrent && (
                                                <span
                                                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                                    style={{ background: '#dcfce7', color: '#166534' }}
                                                >
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className="text-[10.5px] font-mono tabular-nums"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            {session.os} · {session.device} · {formatSessionTime(session.lastActive)}
                                        </div>
                                    </div>
                                </div>
                                {!session.isCurrent && (
                                    <SubtleButton danger onClick={() => onRevokeSession(session.id)}>
                                        Revoke
                                    </SubtleButton>
                                )}
                            </div>
                        ))
                    ) : (
                        <div
                            className="flex flex-col items-center justify-center py-8"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <i className="fas fa-laptop text-2xl mb-2" />
                            <span className="text-[12px]">No active sessions found</span>
                        </div>
                    )}
                </div>
            </Card>

            <div
                className="rounded flex items-center justify-between gap-3 px-4 py-3"
                style={{ background: '#fee2e280', border: '1px solid #fca5a580' }}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className="flex h-7 w-7 items-center justify-center rounded shrink-0"
                        style={{ background: '#fee2e2', color: '#b91c1c' }}
                    >
                        <i className="fas fa-sign-out-alt text-[12px]" />
                    </div>
                    <div className="min-w-0">
                        <div className={SECTION_LABEL_CLASS} style={{ color: '#b91c1c' }}>
                            Sign Out
                        </div>
                        <div className="text-[11px]" style={{ color: '#b91c1c', opacity: 0.85 }}>
                            End your current session
                        </div>
                    </div>
                </div>
                <button
                    onClick={onSignOut}
                    className="rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5"
                    style={{ background: '#dc2626' }}
                >
                    Sign Out
                </button>
            </div>
        </>
    )
}

function PreferencesTab({
    accentColor,
    cacheClearing,
    isMobile,
    onClearCache,
    onResetTutorials,
    preferences,
    themeMode,
    updatePreferences
}) {
    const ACCENT_PRESETS = [
        { color: '#2A3163', name: 'Navy' },
        { color: '#7f1d1d', name: 'Red' },
        { color: '#374151', name: 'Gray' },
        { color: '#0a0a0a', name: 'Black' }
    ]
    return (
        <>
            <Card>
                <CardHeader
                    accentColor={accentColor}
                    icon="fa-rocket"
                    title="Start Page"
                    description="Choose which page loads when you open the app"
                />
                <div className="px-4 py-3">
                    <StartPageDropdown
                        value={preferences.startPage || 'Dashboard'}
                        accentColor={accentColor}
                        onChange={(id) => updatePreferences('startPage', id)}
                    />
                </div>
            </Card>

            <Card>
                <CardHeader
                    accentColor={accentColor}
                    icon="fa-palette"
                    title="Appearance"
                    description="Customize the look of the application"
                />
                <div className="px-4 py-3 flex flex-col gap-4">
                    {/* Accent color */}
                    <div>
                        <div className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Accent Color
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {ACCENT_PRESETS.map(({ color, name }) => {
                                const isActive = (preferences.accentColor || '#2A3163') === color
                                return (
                                    <button
                                        key={color}
                                        onClick={() => updatePreferences('accentColor', color)}
                                        className="relative h-8 w-8 rounded transition-transform hover:scale-105"
                                        style={{
                                            background: color,
                                            boxShadow: isActive
                                                ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${color}`
                                                : 'none'
                                        }}
                                        title={name}
                                        aria-label={`Set accent color to ${name}`}
                                    >
                                        {isActive && (
                                            <i className="fas fa-check text-white text-[11px] absolute inset-0 flex items-center justify-center" />
                                        )}
                                    </button>
                                )
                            })}
                            <div className="relative">
                                <input
                                    type="color"
                                    value={preferences.accentColor || '#2A3163'}
                                    onChange={(e) => {
                                        const clampedColor = clampColorToMaxBrightness(e.target.value)
                                        updatePreferences('accentColor', clampedColor)
                                    }}
                                    className="absolute inset-0 h-8 w-8 cursor-pointer opacity-0"
                                    aria-label="Custom accent color"
                                />
                                <div
                                    className="flex h-8 w-8 items-center justify-center rounded"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px dashed var(--border-light)',
                                        color: 'var(--text-tertiary)'
                                    }}
                                >
                                    <i className="fas fa-eyedropper text-[11px]" />
                                </div>
                            </div>
                        </div>
                        <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            Very light colors will be clamped for readability (max {MAX_BRIGHTNESS_HEX})
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2.5 rounded px-2.5 py-1.5" style={FieldStyle}>
                                <div className="h-5 w-5 rounded" style={{ background: accentColor }} />
                                <div>
                                    <div
                                        className="text-[9.5px] font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        Current
                                    </div>
                                    <div
                                        className="font-mono text-[12px] font-semibold tabular-nums"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {(preferences.accentColor || '#2A3163').toUpperCase()}
                                    </div>
                                </div>
                            </div>
                            {preferences.accentColor && preferences.accentColor !== '#2A3163' && (
                                <SubtleButton
                                    icon="fa-undo"
                                    onClick={() => updatePreferences('accentColor', '#2A3163')}
                                >
                                    Reset
                                </SubtleButton>
                            )}
                        </div>
                    </div>

                    {/* Theme */}
                    <div>
                        <div className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Theme
                        </div>
                        <SegmentedControl
                            accentColor={accentColor}
                            options={[
                                { icon: 'fa-sun', label: 'Light', value: 'light' },
                                { icon: 'fa-moon', label: 'Dark', value: 'dark' }
                            ]}
                            value={themeMode}
                            onChange={(v) => updatePreferences('themeMode', v)}
                        />
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader
                    accentColor={accentColor}
                    icon="fa-bars"
                    title="Navigation Style"
                    description="Choose your preferred navigation layout"
                />
                <div className="px-4 py-3">
                    <SegmentedControl
                        accentColor={accentColor}
                        options={[
                            { icon: 'fa-bars', label: 'Top Bar', value: 'top_bar_basic' },
                            { icon: 'fa-layer-group', label: 'Two-Level Tabs', value: 'two_level_tabs' }
                        ]}
                        value={preferences.navStyle || 'top_bar_basic'}
                        onChange={(v) => updatePreferences('navStyle', v)}
                    />
                </div>
            </Card>

            {!isMobile && (
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-graduation-cap"
                        title="Tutorials"
                        description="Manage tutorial hints and guides"
                    />
                    <div className="px-4 py-3 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-3 rounded px-3 py-2" style={FieldStyle}>
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    Enable Tutorials
                                </div>
                                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                    Show helpful tips and guides throughout the app
                                </div>
                            </div>
                            <Toggle
                                accentColor={accentColor}
                                ariaLabel="Toggle tutorials"
                                checked={!!preferences.tutorials}
                                onChange={() => updatePreferences('tutorials', !preferences.tutorials)}
                            />
                        </div>
                        <SubtleButton icon="fa-redo" onClick={onResetTutorials}>
                            Reset All Tutorials
                        </SubtleButton>
                    </div>
                </Card>
            )}

            <Card>
                <CardHeader
                    accentColor={accentColor}
                    icon="fa-database"
                    title="Cache"
                    description="Clear cached data to free up space and fix stale content"
                />
                <div className="px-4 py-3">
                    <SubtleButton
                        disabled={cacheClearing}
                        icon={cacheClearing ? 'fa-spinner fa-spin' : 'fa-broom'}
                        onClick={onClearCache}
                    >
                        {cacheClearing ? 'Clearing…' : 'Clear All Caches'}
                    </SubtleButton>
                </div>
            </Card>
        </>
    )
}

function SegmentedControl({ accentColor, options, value, onChange }) {
    return (
        <div
            className="inline-flex items-center rounded p-0.5 gap-0.5"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
        >
            {options.map((opt) => {
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1 transition-colors flex items-center gap-1.5"
                        style={{
                            background: active ? accentColor : 'transparent',
                            color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        {opt.icon && <i className={`fas ${opt.icon} text-[10px]`} />}
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

function NotificationsTab({ accentColor, preferences, updatePreferences }) {
    return (
        <Card>
            <CardHeader
                accentColor={accentColor}
                icon="fa-bell"
                title="Email Notifications"
                description="Control which email notifications you receive"
            />
            <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 rounded px-3 py-2.5" style={FieldStyle}>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <i className="fas fa-comment-dots text-[11px]" style={{ color: 'var(--text-tertiary)' }} />
                            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Asset Comment Emails
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                            Receive an email when someone comments on an asset assigned to your plant. Applies to Plant
                            Managers and District Managers only.
                        </p>
                    </div>
                    <Toggle
                        accentColor={accentColor}
                        ariaLabel="Toggle asset comment email notifications"
                        checked={!!preferences.acceptCommentEmails}
                        onChange={() => updatePreferences('acceptCommentEmails', !preferences.acceptCommentEmails)}
                    />
                </div>
            </div>
        </Card>
    )
}

function PasswordModal({
    accentColor,
    confirmPassword,
    currentPassword,
    loading,
    newPassword,
    onClose,
    onSubmit,
    passwordError,
    setConfirmPassword,
    setCurrentPassword,
    setNewPassword
}) {
    const canSubmit =
        !loading && currentPassword && newPassword && newPassword === confirmPassword && newPassword.length >= 8
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 23, 42, 0.65)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-key text-[11px]" />
                        </div>
                        <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Change Password
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="px-4 py-3 flex flex-col gap-3">
                    {passwordError && (
                        <div
                            className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[12px] font-medium"
                            style={{ background: '#fee2e2', color: '#b91c1c' }}
                        >
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            <span>{passwordError}</span>
                        </div>
                    )}
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            required
                            className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                            style={FieldStyle}
                        />
                    </div>
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            New Password
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            required
                            className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                            style={FieldStyle}
                        />
                        <p className="mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            Must be at least 8 characters
                        </p>
                    </div>
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            required
                            className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                            style={FieldStyle}
                        />
                    </div>
                    <div className="flex gap-2 mt-1">
                        <SubtleButton onClick={onClose}>Cancel</SubtleButton>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="flex-1 rounded py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: accentColor }}
                        >
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function AccountSkeleton() {
    const Bar = ({ className = '', style }) => (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
    )
    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}>
                <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 py-2 flex items-center gap-2">
                    <Bar className="h-6 w-6" />
                    <Bar className="h-3 w-32" />
                </div>
            </div>
            <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 py-4 grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-1 flex flex-col gap-3">
                    <div
                        className="rounded p-4 flex items-center gap-3"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        <Bar className="h-12 w-12" />
                        <div className="flex-1 flex flex-col gap-1.5">
                            <Bar className="h-3 w-32" />
                            <Bar className="h-2.5 w-40" />
                        </div>
                    </div>
                    <div
                        className="rounded"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="px-3 py-2 flex items-center gap-2"
                                style={{ borderBottom: i < 4 ? '1px solid var(--border-light)' : 'none' }}
                            >
                                <Bar className="h-3 w-3" />
                                <Bar className="h-3 w-20" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-2 flex flex-col gap-3">
                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className="rounded"
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                        >
                            <div
                                className="px-4 py-3 flex items-center gap-2.5"
                                style={{ borderBottom: '1px solid var(--border-light)' }}
                            >
                                <Bar className="h-7 w-7" />
                                <Bar className="h-3 w-32" />
                            </div>
                            <div className="px-4 py-3 flex flex-col gap-2">
                                <Bar className="h-8 w-full" />
                                <Bar className="h-8 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default MyAccountView
