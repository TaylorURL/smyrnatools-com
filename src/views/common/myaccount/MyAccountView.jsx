import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'

import VersionPopup from '../../../app/components/common/VersionPopup'
import { useAuth } from '../../../app/context/AuthContext'
import { useSharedMessages } from '../../../app/context/MessagesContext'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useTutorial } from '../../../app/context/TutorialContext'
import { usePlanScrollSpy } from '../../../app/hooks/usePlanScrollSpy'
import { useThemeMode } from '../../../app/hooks/useThemeMode'
import { useVersion } from '../../../app/hooks/useVersion'
import { getBrowserName, getDeviceType, getOSName } from '../../../app/utils/BrowserDetection'
import { Database } from '../../../services/DatabaseService'
import { UserService } from '../../../services/UserService'
import APIUtility from '../../../utils/APIUtility'
import { CacheUtility } from '../../../utils/CacheUtility'
import DashboardUtility from '../../../utils/DashboardUtility'

const ChangelogView = lazy(() => import('../login/ChangelogView'))
const AUTH_FUNCTION = '/auth-service'

const MAX_BRIGHTNESS_HEX = '#D6D6D6'
const MAX_BRIGHTNESS_VALUE = 214

const FIELD_LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wider mb-2'

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
    return <div className={`rounded-lg ${className} bg-bg-primary border border-border-light`}>{children}</div>
}

function CardHeader({ icon, title, description, accentColor }) {
    return (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
            <div
                className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-bg-tertiary"
                style={{ color: accentColor }}
            >
                <i className={`fas ${icon} text-[16px]`} />
            </div>
            <div className="min-w-0">
                <div className="text-[14px] font-semibold text-text-primary">{title}</div>
                {description && <div className="text-[12px] mt-0.5 text-text-tertiary">{description}</div>}
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
            className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider text-white px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accentColor }}
        >
            {icon && <i className={`fas ${icon} text-[12px]`} />}
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
            className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider px-3.5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-95"
            style={{
                background: danger ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-secondary)',
                border: `1px solid ${danger ? 'rgba(220, 38, 38, 0.35)' : 'var(--border-light)'}`,
                color: danger ? '#dc2626' : 'var(--text-secondary)'
            }}
        >
            {icon && <i className={`fas ${icon} text-[12px]`} />}
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
            className="relative inline-flex shrink-0 rounded-full transition-colors border border-border-light h-6 w-11"
            style={{ background: checked ? accentColor : 'var(--bg-tertiary)' }}
        >
            <span
                className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all bg-white h-[18px] w-[18px]"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.2)', left: checked ? 22 : 2 }}
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
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors"
                style={FieldStyle}
            >
                <span className="flex items-center gap-3">
                    <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary"
                        style={{ color: accentColor }}
                    >
                        <i className={`fas ${selected.icon} text-[14px]`} />
                    </span>
                    <span className="text-[14px] font-semibold text-text-primary">{selected.id}</span>
                </span>
                <i
                    className={`fas fa-chevron-down text-[11px] transition-transform ${open ? 'rotate-180' : ''} text-text-tertiary`}
                />
            </button>
            {open && (
                <div
                    className="absolute left-0 right-0 z-50 mt-1.5 max-h-72 overflow-y-auto rounded-lg py-1.5 bg-bg-primary border border-border-light"
                    style={{ boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.18))' }}
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
                                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-bg-tertiary text-text-primary"
                                style={{
                                    background: isActive ? `${accentColor}14` : 'transparent',
                                    fontWeight: isActive ? 600 : 500
                                }}
                            >
                                <span
                                    className="flex h-7 w-7 items-center justify-center rounded-md"
                                    style={{
                                        background: isActive ? `${accentColor}20` : 'var(--bg-tertiary)',
                                        color: accentColor
                                    }}
                                >
                                    <i className={`fas ${icon} text-[12px]`} />
                                </span>
                                {id}
                                {isActive && (
                                    <i className="fas fa-check ml-auto text-[11px]" style={{ color: accentColor }} />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/* ── Cockpit primitives — Plan-tab inspired chrome ────────────────────── */

/** Slim sticky page header. Mirrors `PlanHeader`'s rhythm: title + region
 *  scope chip + flex spacer + action cluster + inline tab pill switcher. */
function CockpitHeader({
    accentColor,
    activeTab,
    isMobile,
    onChangeTab,
    onOpenMessages,
    onSignOut,
    regionLabel,
    tabs,
    unreadMessageCount = 0
}) {
    return (
        <div className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5 bg-bg-primary border-border-light">
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0 text-text-primary">Account</h1>
            {regionLabel && (
                <span className="inline-flex items-center gap-2 rounded text-[12px] font-medium px-2.5 py-1 max-w-full bg-bg-secondary border border-border-light text-text-primary">
                    <i className="fas fa-location-dot text-[10px] text-green-600" />
                    <span className="truncate">{regionLabel}</span>
                </span>
            )}
            <div className="flex-1 min-w-[8px]" />
            <div className="flex items-center gap-1.5 shrink-0">
                {onOpenMessages && (
                    <button
                        type="button"
                        onClick={() => onOpenMessages()}
                        title={
                            unreadMessageCount > 0
                                ? `${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}`
                                : 'Open messages'
                        }
                        className="relative flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 transition-colors hover:brightness-95 bg-bg-tertiary text-text-secondary"
                    >
                        <i className="fas fa-comments" />
                        {!isMobile && <span>Messages</span>}
                        {unreadMessageCount > 0 && (
                            <span
                                className="absolute font-mono tabular-nums rounded-full text-[9.5px] font-bold uppercase tracking-wider min-w-[16px] h-[16px] flex items-center justify-center px-1 bg-red-600 text-white"
                                style={{ border: '1.5px solid var(--bg-primary)', right: -4, top: -4 }}
                            >
                                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                            </span>
                        )}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onSignOut}
                    title="Sign out"
                    className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 transition-colors hover:brightness-95 bg-[rgba(220,_38,_38,_0.12)] text-red-600"
                >
                    <i className="fas fa-arrow-right-from-bracket" />
                    {!isMobile && <span>Sign out</span>}
                </button>
            </div>
            <div
                className="flex items-center rounded-lg p-0.5 overflow-x-auto bg-bg-tertiary border border-border-light"
                role="tablist"
            >
                {tabs.map(({ icon, id, label }) => {
                    const isActive = activeTab === id
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onChangeTab(id)}
                            data-tutorial-target={id === 'preferences' ? 'preferences-tab' : null}
                            className="flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 whitespace-nowrap transition-colors"
                            style={{
                                backgroundColor: isActive ? accentColor : 'transparent',
                                color: isActive ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            <i className={`fas ${icon}`} />
                            {!isMobile && <span>{label}</span>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/** Single cell in the at-a-glance stat strip. Flat label / mono value / hint. */
function StatCell({ hint, label, value, valueColor }) {
    return (
        <div className="px-3 py-2.5 flex flex-col gap-0.5 bg-bg-primary border-r border-border-light">
            <span className="text-[11px] text-text-secondary">{label}</span>
            <span
                className="font-semibold text-[20px] leading-tight font-mono tabular-nums"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
            </span>
            {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
        </div>
    )
}

/** Compact "X years Y months" label from a created_at timestamp. */
function formatAccountAge(joinedAt) {
    if (!joinedAt) return '—'
    const joined = new Date(joinedAt)
    if (Number.isNaN(joined.getTime())) return '—'
    const now = new Date()
    const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth())
    if (months < 1) return 'New'
    if (months < 12) return `${months}mo`
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    return remainingMonths === 0 ? `${years}y` : `${years}y ${remainingMonths}mo`
}

function formatJoinedDate(joinedAt) {
    if (!joinedAt) return '—'
    const d = new Date(joinedAt)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '—'
    const d = new Date(timestamp)
    if (Number.isNaN(d.getTime())) return '—'
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 5) return 'Active now'
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    return `${days}d`
}

/** 6-cell snapshot of the user's account that lives just under the header.
 *  Hints are reserved for genuinely useful context (a date the value alone
 *  can't convey, a device fingerprint, a count of related items). Cells with
 *  nothing helpful to add show no third line at all. */
function AccountStatStrip({ additionalPlants, joinedAt, plantCode, regionName, role, sessions }) {
    const currentSession = sessions.find((s) => s.isCurrent) || sessions[0]
    const sessionDeviceCounts = sessions.reduce(
        (acc, s) => {
            const device = (s.device || '').toLowerCase()
            if (device.includes('mobile')) acc.mobile += 1
            else if (device.includes('tablet')) acc.tablet += 1
            else acc.desktop += 1
            return acc
        },
        { desktop: 0, mobile: 0, tablet: 0 }
    )
    const sessionsHint =
        sessions.length === 0
            ? null
            : [
                  sessionDeviceCounts.desktop && `${sessionDeviceCounts.desktop} desktop`,
                  sessionDeviceCounts.mobile && `${sessionDeviceCounts.mobile} mobile`,
                  sessionDeviceCounts.tablet && `${sessionDeviceCounts.tablet} tablet`
              ]
                  .filter(Boolean)
                  .join(' · ')
    const additionalCount = additionalPlants?.length || 0
    return (
        <section className="scroll-mt-4" id="overview">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 rounded overflow-hidden border border-border-light">
                <StatCell label="Account age" value={formatAccountAge(joinedAt)} hint={formatJoinedDate(joinedAt)} />
                <StatCell
                    label="Sessions"
                    value={sessions.length}
                    valueColor={sessions.length > 0 ? '#16a34a' : undefined}
                    hint={sessionsHint}
                />
                <StatCell label="Region" value={regionName || '—'} />
                <StatCell
                    label="Home plant"
                    value={plantCode || '—'}
                    hint={additionalCount > 0 ? `+${additionalCount} more` : null}
                />
                <StatCell label="Role" value={role || '—'} />
                <StatCell
                    label="Last sign-in"
                    value={currentSession ? formatRelativeTime(currentSession.lastActive) : '—'}
                    valueColor={currentSession?.isCurrent ? '#16a34a' : undefined}
                    hint={
                        currentSession
                            ? [currentSession.browser, currentSession.os].filter(Boolean).join(' · ') || null
                            : null
                    }
                />
            </div>
        </section>
    )
}

/** Sticky scrollspy nav for the cockpit's left column. Each entry scrolls
 *  its section into view; active state mirrors the Plan dashboard side-nav
 *  with a 2px accent border on the leading edge. */
function AccountSideNav({ accentColor, activeId, onJump, sections }) {
    return (
        <aside
            className="hidden lg:block sticky top-0 self-start py-5 pr-3 overflow-y-auto w-[200px]"
            style={{ maxHeight: '100vh' }}
        >
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 pb-2 text-text-tertiary">
                Sections
            </div>
            <nav className="flex flex-col">
                {sections.map(({ icon, id, label }) => {
                    const isActive = activeId === id
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onJump(id)}
                            className="flex items-center gap-2 px-2 py-1.5 border-none cursor-pointer text-[13px] text-left bg-transparent transition-colors"
                            style={{
                                borderLeft: `2px solid ${isActive ? accentColor : 'transparent'}`,
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: isActive ? 600 : 400
                            }}
                        >
                            <i
                                className={`fas ${icon} text-[12px] w-3.5`}
                                style={{ color: isActive ? accentColor : 'var(--text-tertiary)' }}
                            />
                            <span className="flex-1 truncate">{label}</span>
                        </button>
                    )
                })}
            </nav>
        </aside>
    )
}

/** Right-rail snapshot. Hidden under xl breakpoint where the stat strip
 *  already covers the same ground. */
function AccountAtAGlance({ additionalPlants, email, joinedAt, plantCode, regionName, sessions, userRole }) {
    const currentSession = sessions.find((s) => s.isCurrent) || sessions[0]
    const rows = [
        { label: 'Email', mono: false, value: email || '—' },
        { label: 'Joined', value: formatJoinedDate(joinedAt) },
        {
            color: currentSession?.isCurrent ? '#16a34a' : undefined,
            hint: currentSession ? `${currentSession.browser || ''} · ${currentSession.os || ''}`.trim() : null,
            label: 'Last sign-in',
            value: currentSession ? formatRelativeTime(currentSession.lastActive) : '—'
        },
        {
            hint: regionName ? null : 'No region selected',
            label: 'Region',
            value: regionName || '—'
        },
        {
            hint: additionalPlants.length > 0 ? `+ ${additionalPlants.join(' · ')}` : null,
            label: 'Home plant',
            value: plantCode || '—'
        },
        { label: 'Sessions', value: sessions.length.toString() },
        { label: 'Role', value: userRole || '—' }
    ]
    return (
        <aside className="hidden xl:block sticky top-0 self-start py-5 pl-4 w-60">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 pb-2 text-text-tertiary">
                At a glance
            </div>
            <div className="rounded p-3 flex flex-col bg-bg-primary border border-border-light">
                {rows.map((row, idx) => (
                    <div
                        key={row.label}
                        className="flex flex-col py-2"
                        style={{
                            borderBottom: idx < rows.length - 1 ? '1px dashed var(--border-light)' : 'none'
                        }}
                    >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">
                            {row.label}
                        </span>
                        <span
                            className={`font-semibold text-[13px] ${row.mono === false ? '' : 'font-mono tabular-nums'} truncate`}
                            style={{ color: row.color || 'var(--text-primary)' }}
                            title={row.value}
                        >
                            {row.value}
                        </span>
                        {row.hint && (
                            <span className="text-[11px] truncate text-text-secondary" title={row.hint}>
                                {row.hint}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </aside>
    )
}

/** Side-nav anchors per tab. Each entry must match a `<section id>` rendered
 *  in the corresponding tab body. */
const TAB_SECTIONS = {
    notifications: [
        { icon: 'fa-comments', id: 'messages', label: 'Messages' },
        { icon: 'fa-bell', id: 'notifications', label: 'Email notifications' }
    ],
    preferences: [
        { icon: 'fa-rocket', id: 'startpage', label: 'Start page' },
        { icon: 'fa-palette', id: 'appearance', label: 'Appearance' },
        { icon: 'fa-bars', id: 'navigation', label: 'Navigation' },
        { icon: 'fa-graduation-cap', id: 'tutorials', label: 'Tutorials' },
        { icon: 'fa-database', id: 'cache', label: 'Cache' }
    ],
    profile: [
        { icon: 'fa-id-card', id: 'identity', label: 'Identity' },
        { icon: 'fa-building', id: 'scope', label: 'Scope' }
    ],
    security: [
        { icon: 'fa-key', id: 'password', label: 'Password' },
        { icon: 'fa-laptop', id: 'sessions', label: 'Sessions' }
    ]
}

function MyAccountView({ userId, onSelectView }) {
    const { preferences, updatePreferences } = usePreferences()
    const { isMobile, resetAllTutorials, triggerTutorial } = useTutorial()
    const { signOut: authSignOut, verifyPassword, updatePassword: authUpdatePassword } = useAuth()
    const { themeMode } = useThemeMode()
    const version = useVersion()
    const { conversations, unreadCount: unreadMessageCount } = useSharedMessages()
    const accentColor = preferences.accentColor || '#2A3163'

    /** Jump straight to the messages center. Optional `conversationId` deep-
     *  links to a specific thread when the caller has one. */
    const handleOpenMessages = (conversationId = null) => {
        if (typeof onSelectView !== 'function') return
        onSelectView('Notifications', conversationId ? { initialConversationId: conversationId } : {})
    }

    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [userRole, setUserRole] = useState('')
    const [plantCode, setPlantCode] = useState('')
    const [additionalPlants, setAdditionalPlants] = useState([])
    const [joinedAt, setJoinedAt] = useState(null)
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
                    if (profileData.created_at) setJoinedAt(profileData.created_at)
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

    const TABS = [
        { icon: 'fa-user', id: 'profile', label: 'Profile' },
        { icon: 'fa-shield-halved', id: 'security', label: 'Security' },
        { icon: 'fa-sliders', id: 'preferences', label: 'Preferences' },
        { icon: 'fa-bell', id: 'notifications', label: 'Notifications' }
    ]

    const sectionsForTab = TAB_SECTIONS[activeTab] || []
    const regionLabel = preferences.selectedRegion?.name || ''

    // Hooks must run before any early-return guards below — keep the
    // scrollspy ref + state at the top so React's hook order stays stable.
    const scrollContainerRef = useRef(null)
    const [activeSection, jumpTo] = usePlanScrollSpy({
        deps: [activeTab, loading, sessions.length, additionalPlants.length],
        scrollContainerRef,
        sections: sectionsForTab
    })

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

    return (
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top bg-bg-secondary flex flex-col overflow-hidden absolute"
            style={{ inset: 0 }}
        >
            <CockpitHeader
                accentColor={accentColor}
                activeTab={activeTab}
                isMobile={isMobile}
                onChangeTab={setActiveTab}
                onOpenMessages={onSelectView ? handleOpenMessages : undefined}
                onSignOut={handleSignOut}
                regionLabel={regionLabel}
                tabs={TABS}
                unreadMessageCount={unreadMessageCount}
            />

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 lg:px-6 flex gap-4">
                    <AccountSideNav
                        accentColor={accentColor}
                        activeId={activeSection}
                        onJump={jumpTo}
                        sections={sectionsForTab}
                    />

                    <main className="flex-1 min-w-0 py-3 sm:py-5 flex flex-col gap-3 sm:gap-5">
                        {message && (
                            <div
                                className="flex items-center gap-3 rounded-lg px-4 py-3"
                                style={{
                                    background: message.includes('Error')
                                        ? 'rgba(220, 38, 38, 0.12)'
                                        : 'rgba(22, 163, 74, 0.12)',
                                    border: `1px solid ${message.includes('Error') ? 'rgba(220, 38, 38, 0.35)' : 'rgba(22, 163, 74, 0.35)'}`,
                                    color: message.includes('Error') ? '#dc2626' : '#16a34a'
                                }}
                            >
                                <i
                                    className={`fas ${message.includes('Error') ? 'fa-exclamation-circle' : 'fa-check-circle'} text-[14px]`}
                                />
                                <span className="flex-1 text-[13px] font-medium">{message}</span>
                                <button
                                    onClick={() => setMessage('')}
                                    className="opacity-60 hover:opacity-100"
                                    aria-label="Dismiss"
                                >
                                    <i className="fas fa-times text-[12px]" />
                                </button>
                            </div>
                        )}

                        <AccountStatStrip
                            additionalPlants={additionalPlants}
                            joinedAt={joinedAt}
                            plantCode={plantCode}
                            regionName={regionLabel}
                            role={userRole}
                            sessions={sessions}
                        />

                        {activeTab === 'profile' && (
                            <ProfileTab
                                accentColor={accentColor}
                                additionalPlants={additionalPlants}
                                email={email}
                                firstName={firstName}
                                getInitials={getInitials}
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
                                conversations={conversations}
                                onOpenMessages={onSelectView ? handleOpenMessages : undefined}
                                preferences={preferences}
                                unreadMessageCount={unreadMessageCount}
                                updatePreferences={updatePreferences}
                            />
                        )}

                        <div className="h-8" />
                    </main>

                    <AccountAtAGlance
                        additionalPlants={additionalPlants}
                        email={email}
                        joinedAt={joinedAt}
                        plantCode={plantCode}
                        regionName={regionLabel}
                        sessions={sessions}
                        userRole={userRole}
                    />
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
    getInitials,
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
    const initials = getInitials?.()
    return (
        <>
            <section id="identity" className="scroll-mt-4">
                <Card>
                    <div className="flex items-center gap-4 px-5 py-4 border-b border-border-light">
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-[18px] font-bold text-white"
                            style={{ background: accentColor }}
                        >
                            {initials || <i className="fas fa-user text-[18px]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[16px] font-semibold truncate text-text-primary">
                                {firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : 'My Account'}
                            </div>
                            <div className="text-[12px] truncate mt-0.5 text-text-tertiary">{email || 'No email'}</div>
                            {userRole && (
                                <span
                                    className="mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                                    style={{ background: `${accentColor}14`, color: accentColor }}
                                >
                                    {userRole}
                                </span>
                            )}
                        </div>
                    </div>
                    <form onSubmit={onSubmit} className="px-5 py-5 flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
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
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
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
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                                    style={FieldStyle}
                                />
                            </div>
                        </div>
                        <div>
                            <PrimaryButton accentColor={accentColor} disabled={loading} icon="fa-save" type="submit">
                                Save Changes
                            </PrimaryButton>
                        </div>
                    </form>
                </Card>
            </section>

            <section id="scope" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-building"
                        title="Scope"
                        description="Region and plant assignments"
                    />
                    <div className="px-5">
                        <DetailRow icon="fa-envelope" label="Email" value={email || 'Not set'} />
                        {userRole && <DetailRow icon="fa-user-tag" label="Role" value={userRole} />}
                        <div className="flex items-center justify-between py-3.5 border-b border-border-light">
                            <div className="flex items-center gap-3">
                                <i className="fas fa-globe text-[13px] w-5 text-center text-text-tertiary" />
                                <span className="text-[13px] text-text-secondary">Region</span>
                            </div>
                            <div className="relative">
                                <select
                                    value={preferences.selectedRegion?.code || ''}
                                    onChange={onChangeRegion}
                                    disabled={!regionsLoaded}
                                    className="appearance-none rounded-lg py-2 pl-3 pr-9 text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    style={FieldStyle}
                                >
                                    {permittedRegions.map((r) => (
                                        <option
                                            key={r.regionCode || r.region_code}
                                            value={r.regionCode || r.region_code}
                                        >
                                            {r.regionName || r.region_name || ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <i className="fas fa-chevron-down text-[10px] text-text-tertiary" />
                                </div>
                            </div>
                        </div>
                        {plantCode && <DetailRow icon="fa-building" label="Plant Code" value={plantCode} mono />}
                        {additionalPlants.length > 0 && (
                            <div className="py-3.5">
                                <div className="flex items-center gap-3 mb-2">
                                    <i className="fas fa-building text-[13px] w-5 text-center text-text-tertiary" />
                                    <span className="text-[13px] text-text-secondary">Additional Plants</span>
                                </div>
                                <div className="flex flex-wrap gap-2 ml-8">
                                    {additionalPlants.map((code) => (
                                        <span
                                            key={code}
                                            className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider font-mono tabular-nums"
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
            </section>
        </>
    )
}

function DetailRow({ icon, label, mono, value }) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-border-light">
            <div className="flex items-center gap-3">
                <i className={`fas ${icon} text-[13px] w-5 text-center text-text-tertiary`} />
                <span className="text-[13px] text-text-secondary">{label}</span>
            </div>
            <span className={`text-[14px] font-semibold ${mono ? 'font-mono tabular-nums' : ''} text-text-primary`}>
                {value}
            </span>
        </div>
    )
}

function SecurityTab({ accentColor, formatSessionTime, onOpenPasswordModal, onRevokeSession, sessions }) {
    return (
        <>
            <section id="password" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-key"
                        title="Password"
                        description="Keep your account secure with a strong password"
                    />
                    <div className="px-5 py-5">
                        <PrimaryButton accentColor={accentColor} icon="fa-lock" onClick={onOpenPasswordModal}>
                            Change Password
                        </PrimaryButton>
                    </div>
                </Card>
            </section>

            <section id="sessions" className="scroll-mt-4">
                <Card>
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-laptop text-[16px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-text-primary">Active Sessions</div>
                            <div className="text-[12px] mt-0.5 text-text-tertiary">Manage your login sessions</div>
                        </div>
                        <span className="font-mono tabular-nums rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary text-text-secondary">
                            {sessions.length}
                        </span>
                    </div>
                    <div>
                        {sessions.length > 0 ? (
                            sessions.map((session, idx) => (
                                <div
                                    key={session.id}
                                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                                    style={{
                                        background: session.isCurrent ? 'rgba(22, 163, 74, 0.08)' : 'transparent',
                                        borderBottom:
                                            idx < sessions.length - 1 ? '1px solid var(--border-light)' : 'none'
                                    }}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                                            style={{
                                                background: session.isCurrent
                                                    ? 'rgba(22, 163, 74, 0.15)'
                                                    : 'var(--bg-tertiary)',
                                                color: session.isCurrent ? '#16a34a' : 'var(--text-secondary)'
                                            }}
                                        >
                                            <i
                                                className={`fas ${session.device === 'Mobile' ? 'fa-mobile-alt' : session.device === 'Tablet' ? 'fa-tablet-alt' : 'fa-desktop'} text-[14px]`}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[14px] font-semibold truncate text-text-primary">
                                                    {session.browser}
                                                </span>
                                                {session.isCurrent && (
                                                    <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[rgba(22,_163,_74,_0.15)] text-green-600">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[12px] mt-0.5 font-mono tabular-nums text-text-tertiary">
                                                {session.os} · {session.device} ·{' '}
                                                {formatSessionTime(session.lastActive)}
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
                            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                                <i className="fas fa-laptop text-3xl mb-3" />
                                <span className="text-[14px]">No active sessions found</span>
                            </div>
                        )}
                    </div>
                </Card>
            </section>
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
            <section id="startpage" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-rocket"
                        title="Start Page"
                        description="Choose which page loads when you open the app"
                    />
                    <div className="px-5 py-5">
                        <StartPageDropdown
                            value={preferences.startPage || 'Dashboard'}
                            accentColor={accentColor}
                            onChange={(id) => updatePreferences('startPage', id)}
                        />
                    </div>
                </Card>
            </section>

            <section id="appearance" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-palette"
                        title="Appearance"
                        description="Customize the look of the application"
                    />
                    <div className="px-5 py-5 grid gap-5 md:grid-cols-2">
                        {/* Accent color */}
                        <div>
                            <div className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Accent Color
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {ACCENT_PRESETS.map(({ color, name }) => {
                                    const isActive = (preferences.accentColor || '#2A3163') === color
                                    return (
                                        <button
                                            key={color}
                                            onClick={() => updatePreferences('accentColor', color)}
                                            className="relative h-10 w-10 rounded-lg transition-transform hover:scale-105"
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
                                                <i className="fas fa-check text-white text-[13px] absolute inset-0 flex items-center justify-center" />
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
                                        className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
                                        aria-label="Custom accent color"
                                    />
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary border border-border-light text-text-tertiary">
                                        <i className="fas fa-eyedropper text-[13px]" />
                                    </div>
                                </div>
                            </div>
                            <p className="mt-2.5 text-[11px] text-text-tertiary">
                                Very light colors will be clamped for readability (max {MAX_BRIGHTNESS_HEX})
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2.5">
                                <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={FieldStyle}>
                                    <div className="h-7 w-7 rounded-md" style={{ background: accentColor }} />
                                    <div>
                                        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                                            Current
                                        </div>
                                        <div className="font-mono text-[14px] font-semibold tabular-nums text-text-primary">
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
            </section>

            <section id="navigation" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-bars"
                        title="Navigation Style"
                        description="Choose your preferred navigation layout"
                    />
                    <div className="px-5 py-5">
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
            </section>

            {!isMobile && (
                <section id="tutorials" className="scroll-mt-4">
                    <Card>
                        <CardHeader
                            accentColor={accentColor}
                            icon="fa-graduation-cap"
                            title="Tutorials"
                            description="Manage tutorial hints and guides"
                        />
                        <div className="px-5 py-5 flex flex-col gap-3">
                            <div
                                className="flex items-center justify-between gap-3 rounded-lg px-4 py-3"
                                style={FieldStyle}
                            >
                                <div className="min-w-0">
                                    <div className="text-[14px] font-semibold text-text-primary">Enable Tutorials</div>
                                    <div className="text-[12px] mt-0.5 text-text-secondary">
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
                </section>
            )}

            <section id="cache" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-database"
                        title="Cache"
                        description="Clear cached data to free up space and fix stale content"
                    />
                    <div className="px-5 py-5">
                        <SubtleButton
                            disabled={cacheClearing}
                            icon={cacheClearing ? 'fa-spinner fa-spin' : 'fa-broom'}
                            onClick={onClearCache}
                        >
                            {cacheClearing ? 'Clearing…' : 'Clear All Caches'}
                        </SubtleButton>
                    </div>
                </Card>
            </section>
        </>
    )
}

function SegmentedControl({ accentColor, options, value, onChange }) {
    return (
        <div className="inline-flex items-center rounded-lg p-1 gap-1 bg-bg-tertiary border border-border-light">
            {options.map((opt) => {
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="rounded-md text-[12.5px] font-semibold uppercase tracking-wider px-3.5 py-2 transition-colors flex items-center gap-2"
                        style={{
                            background: active ? accentColor : 'transparent',
                            color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        {opt.icon && <i className={`fas ${opt.icon} text-[12px]`} />}
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

function NotificationsTab({
    accentColor,
    conversations = [],
    onOpenMessages,
    preferences,
    unreadMessageCount = 0,
    updatePreferences
}) {
    const conversationCount = conversations?.length || 0
    return (
        <>
            {onOpenMessages && (
                <section id="messages" className="scroll-mt-4">
                    <Card>
                        <CardHeader
                            accentColor={accentColor}
                            icon="fa-comments"
                            title="Messages"
                            description="Direct messages with teammates and managers"
                        />
                        <div className="px-5 py-5 flex flex-col gap-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-bg-secondary border border-border-light">
                                    <span
                                        className="font-mono tabular-nums text-[18px] font-bold"
                                        style={{ color: unreadMessageCount > 0 ? '#dc2626' : 'var(--text-primary)' }}
                                    >
                                        {unreadMessageCount}
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                                        Unread
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-bg-secondary border border-border-light">
                                    <span className="font-mono tabular-nums text-[18px] font-bold text-text-primary">
                                        {conversationCount}
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                                        Conversation{conversationCount === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="flex-1" />
                                <PrimaryButton
                                    accentColor={accentColor}
                                    icon="fa-inbox"
                                    onClick={() => onOpenMessages()}
                                >
                                    Open inbox
                                </PrimaryButton>
                            </div>
                            {conversationCount === 0 && (
                                <p className="m-0 text-[12.5px] text-text-tertiary">
                                    Nothing here yet. New messages from teammates will land in your inbox.
                                </p>
                            )}
                        </div>
                    </Card>
                </section>
            )}

            <section id="notifications" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-bell"
                        title="Email Notifications"
                        description="Control which email notifications you receive"
                    />
                    <div className="px-5 py-5">
                        <div className="flex items-start justify-between gap-4 rounded-lg px-4 py-4" style={FieldStyle}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <i className="fas fa-comment-dots text-[13px] text-text-tertiary" />
                                    <span className="text-[14px] font-semibold text-text-primary">
                                        Asset Comment Emails
                                    </span>
                                </div>
                                <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
                                    Receive an email when someone comments on an asset assigned to your plant. Applies
                                    to Plant Managers and District Managers only.
                                </p>
                            </div>
                            <Toggle
                                accentColor={accentColor}
                                ariaLabel="Toggle asset comment email notifications"
                                checked={!!preferences.acceptCommentEmails}
                                onChange={() =>
                                    updatePreferences('acceptCommentEmails', !preferences.acceptCommentEmails)
                                }
                            />
                        </div>
                    </div>
                </Card>
            </section>
        </>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-lg overflow-hidden bg-bg-primary border border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-key text-[16px]" />
                        </div>
                        <span className="text-[16px] font-semibold text-text-primary">Change Password</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-bg-tertiary text-text-secondary"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[14px]" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="px-5 py-5 flex flex-col gap-4">
                    {passwordError && (
                        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium bg-[rgba(220,_38,_38,_0.12)] border border-[rgba(220,_38,_38,_0.35)] text-red-600">
                            <i className="fas fa-exclamation-circle text-[13px]" />
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
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
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
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                            style={FieldStyle}
                        />
                        <p className="mt-1.5 text-[11.5px] text-text-tertiary">Must be at least 8 characters</p>
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
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                            style={FieldStyle}
                        />
                    </div>
                    <div className="flex gap-3 mt-1">
                        <SubtleButton onClick={onClose}>Cancel</SubtleButton>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="flex-1 rounded-lg py-2.5 text-[12px] font-semibold uppercase tracking-wider text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top bg-bg-secondary flex flex-col overflow-hidden absolute"
            style={{ inset: 0 }}
        >
            {/* Slim header */}
            <div className="shrink-0 flex items-center gap-3 px-3 sm:px-4 py-2.5 bg-bg-primary border-b border-border-light">
                <Bar className="h-6 w-24" />
                <Bar className="h-6 w-40 rounded-md" />
                <div className="flex-1" />
                <Bar className="h-8 w-24 rounded-lg" />
                <Bar className="h-8 w-72 rounded-lg" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 lg:px-6 flex gap-4 h-full">
                    {/* Side nav skeleton */}
                    <div className="hidden lg:flex flex-col gap-1.5 py-5 w-[200px]">
                        <Bar className="h-3 w-16 mb-2" />
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                                <Bar className="h-3 w-3" />
                                <Bar className="h-3 w-24" />
                            </div>
                        ))}
                    </div>

                    {/* Main */}
                    <div className="flex-1 min-w-0 py-3 sm:py-5 flex flex-col gap-4">
                        {/* Stat strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 rounded overflow-hidden border border-border-light">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="px-3 py-2.5 flex flex-col gap-1.5 bg-bg-primary"
                                    style={{ borderRight: i < 6 ? '1px solid var(--border-light)' : 'none' }}
                                >
                                    <Bar className="h-2.5 w-16" />
                                    <Bar className="h-5 w-12" />
                                    <Bar className="h-2.5 w-20" />
                                </div>
                            ))}
                        </div>
                        {/* Cards */}
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-lg bg-bg-primary border border-border-light">
                                <div className="px-5 py-4 flex items-center gap-3 border-b border-border-light">
                                    <Bar className="h-10 w-10" />
                                    <div className="flex-1 flex flex-col gap-1.5">
                                        <Bar className="h-3.5 w-40" />
                                        <Bar className="h-2.5 w-56" />
                                    </div>
                                </div>
                                <div className="px-5 py-5 flex flex-col gap-3">
                                    <Bar className="h-10 w-full" />
                                    <Bar className="h-10 w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* At-a-glance rail skeleton */}
                    <div className="hidden xl:block py-5 w-60">
                        <Bar className="h-3 w-20 mb-2 ml-2" />
                        <div className="rounded p-3 flex flex-col gap-2 bg-bg-primary border border-border-light">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="flex flex-col gap-1.5 py-2"
                                    style={{ borderBottom: i < 6 ? '1px dashed var(--border-light)' : 'none' }}
                                >
                                    <Bar className="h-2.5 w-14" />
                                    <Bar className="h-3.5 w-24" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyAccountView
