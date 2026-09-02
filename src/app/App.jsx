import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { getSessionUserId } from '../services/SessionService'
import { NetworkUtility } from '../utils/NetworkUtility'
import LoginView from '../views/common/login/LoginView'
import AppFooter from './components/common/AppFooter'
import LockedOverlay from './components/common/LockedOverlay'
import OfflineOverlay from './components/common/OfflineOverlay'
import TerminatedOverlay from './components/common/TerminatedOverlay'
import TutorialManager from './components/common/TutorialPopup'
import VersionUpdateBanner from './components/common/VersionUpdateBanner'
import WebOverlay from './components/common/WebOverlay'
import { VALID_START_PAGE_IDS } from './constants/myAccountConstants'
import { usePreferences } from './context/PreferencesContext'
import { useTutorial } from './context/TutorialContext'
import FrontDoor from './FrontDoor'
import { useAuthSession } from './hooks/useAuth'
import { useOfflineDetection } from './hooks/useOfflineDetection'
import { useThemeMode } from './hooks/useThemeMode'
import { useVersionCheck } from './hooks/useVersionCheck'

const CHUNK_RELOAD_KEY = 'chunk_reload_attempted'
// A deploy that lands mid-session leaves the running page pointing at chunk
// hashes the server no longer serves, so the first lazy import to fail
// triggers a full reload to pick up the new asset manifest. The session flag
// caps that at one reload per session, so a chunk that is broken rather than
// stale surfaces as a Suspense failure instead of a reload loop; it is cleared once
// the app mounts successfully.
const lazyWithRetry = (importer) =>
    lazy(() =>
        importer().catch(() => {
            if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
                sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
                window.location.reload()
            }
            return importer()
        })
    )
// The navigation bar and the messages provider are mounted only behind a
// session, and between them they reach every service that talks to the
// database. Held apart from the entry graph, the client those services build
// is fetched when somebody signs in rather than on every visit to the login
// screen. Both land in one chunk, since the navigation reads the provider.
const importMessagesContext = () => import('./context/MessagesContext')
const importNavigation = () => import('./components/common/Navigation')
const MessagesProvider = lazyWithRetry(() =>
    importMessagesContext().then((module) => ({ default: module.MessagesProvider }))
)
const Navigation = lazyWithRetry(importNavigation)
const AppInstallPromptModal = lazyWithRetry(() => import('./components/common/AppInstallPromptModal'))
const DashboardView = lazyWithRetry(() => import('../views/common/dashboard/DashboardView'))
const EquipmentsView = lazyWithRetry(() => import('../views/assets/equipment/EquipmentsView'))
const ManagersView = lazyWithRetry(() => import('../views/people/managers/ManagersView'))
const MixerDetailView = lazyWithRetry(() => import('../views/assets/mixers/MixerDetailView'))
const MixersView = lazyWithRetry(() => import('../views/assets/mixers/MixersView'))
const MyAccountView = lazyWithRetry(() => import('../views/common/myaccount/MyAccountView'))
const OperatorsView = lazyWithRetry(() => import('../views/people/operators/OperatorsView'))
const PickupTrucksView = lazyWithRetry(() => import('../views/assets/pickup-trucks/PickupTrucksView'))
const PlantsView = lazyWithRetry(() => import('../views/admin/plants/PlantsView'))
const RegionsView = lazyWithRetry(() => import('../views/admin/regions/RegionsView'))
const RolesView = lazyWithRetry(() => import('../views/admin/roles/RolesView'))
const TractorsView = lazyWithRetry(() => import('../views/assets/tractors/TractorsView'))
const TrailersView = lazyWithRetry(() => import('../views/assets/trailers/TrailersView'))
const NotificationsView = lazyWithRetry(() => import('../views/common/notifications/NotificationsView'))
// Both services below are reached only behind a session, and the module that
// constructs the database client is the heaviest dependency in the graph.
// Importing them from inside the effects that call them keeps them off the
// path a signed-out visitor pays for.
const loadDatabase = () => import('../services/DatabaseService').then((module) => module.Database)
const loadUserService = () => import('../services/UserService').then((module) => module.UserService)
// Which views a region type will tolerate. Switching region checks the view
// currently on screen against these and drops back to Dashboard when it no
// longer belongs, so nobody is left looking at data their new region has no
// concept of. MyAccount and Notifications sit outside the region entirely and
// are never checked.

/** Only these views survive a switch into an "Office" region. */
const OFFICE_VISIBLE_VIEWS = new Set(['Dashboard', 'Managers', 'Plants', 'Regions', 'Roles'])
/** Every view except these survives a switch into an "Aggregate" region. */
const AGGREGATE_HIDDEN_VIEWS = new Set(['Mixers', 'Plants', 'Regions'])
/** Every view except these survives a switch into any other region type. */
const DEFAULT_HIDDEN_VIEWS = new Set(['Plants', 'Regions'])
function AppContent() {
    // The session lives in memory alone, so a freshly loaded document never
    // carries one and the first screen is always the sign-in screen. Seeding
    // both pieces of state here rather than waiting for the restore effect is
    // what lets React's first commit draw that screen, which is the screen the
    // prerendered document is already showing.
    const [userId, setUserId] = useState(getSessionUserId)
    const [selectedView, setSelectedView] = useState({ initialStatusFilter: null, view: 'Dashboard' })
    const [title, setTitle] = useState('Dashboard')
    const [selectedMixer, setSelectedMixer] = useState(null)
    const [webViewURL, setWebViewURL] = useState(null)
    const [userDisplayName, setUserDisplayName] = useState('')
    const [isGuestOnly, setIsGuestOnly] = useState(false)
    const [rolesLoaded, setRolesLoaded] = useState(false)
    const [offlineMode, setOfflineMode] = useState(false)
    const [terminatedMode, setTerminatedMode] = useState(false)
    const [regionKey, setRegionKey] = useState(0)
    const [sessionChecked, setSessionChecked] = useState(true)
    const { onlineStreakRef, offlineStreakRef, offlineSinceRef } = useOfflineDetection(setOfflineMode)
    const { preferences, loading: preferencesLoading } = usePreferences()
    const startPageAppliedRef = useRef(false)
    useAuthSession(setUserId, setIsGuestOnly, setRolesLoaded, setSelectedView, setSessionChecked)
    useThemeMode()
    const { triggerTutorial } = useTutorial()
    useEffect(() => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    }, [])
    // Apply the user's preferred start page, once, after preferences and
    // roles have both settled — before that the preference is not yet known
    // and the redirect would fight the session bootstrap. A stored page that
    // is not in VALID_START_PAGE_IDS is ignored, leaving the user on the
    // Dashboard rather than on the "coming soon" placeholder that an unknown
    // view renders. The ref latches even when nothing is applied, so a later
    // preference change never yanks the user out of the view they are in.
    useEffect(() => {
        if (startPageAppliedRef.current || preferencesLoading || !userId || !rolesLoaded || isGuestOnly) return
        const page = preferences.startPage
        if (page && page !== 'Dashboard' && VALID_START_PAGE_IDS.has(page)) {
            setSelectedView({ initialStatusFilter: null, view: page })
        }
        startPageAppliedRef.current = true
    }, [preferencesLoading, userId, rolesLoaded, isGuestOnly, preferences.startPage])
    useEffect(() => {
        if (userId && rolesLoaded) {
            triggerTutorial('account-nav-hint', 2000)
        }
    }, [userId, rolesLoaded, triggerTutorial])
    // The shell those two chunks build is not rendered until roles resolve, and
    // that resolution is a round trip of its own. Starting the fetch as soon as
    // a session exists runs the two in parallel, so the chunk is normally in
    // hand by the time there is something to render with it.
    useEffect(() => {
        if (!userId) return
        importNavigation().catch(() => {})
        importMessagesContext().catch(() => {})
    }, [userId])
    useEffect(() => {
        if (!userId) return
        loadUserService()
            .then((service) => service.getCurrentUser())
            .catch(() => {})
    }, [userId])
    useEffect(() => {
        const handleRegionChange = (event) => {
            const regionType = event?.detail?.type
            const view = selectedView?.view
            const isViewAllowed = (v, t) => {
                if (!v || v === 'MyAccount' || v === 'Notifications') return true
                if (t === 'Office') return OFFICE_VISIBLE_VIEWS.has(v)
                if (t === 'Aggregate') return !AGGREGATE_HIDDEN_VIEWS.has(v)
                return !DEFAULT_HIDDEN_VIEWS.has(v)
            }
            if (!isViewAllowed(view, regionType)) {
                setSelectedView({ initialStatusFilter: null, view: 'Dashboard' })
            }
            setRegionKey((prev) => prev + 1)
        }
        window.addEventListener('region-changed', handleRegionChange)
        return () => window.removeEventListener('region-changed', handleRegionChange)
    }, [selectedView])
    useEffect(() => {
        if (!userId || rolesLoaded) return
        let cancelled = false
        const loadRoles = async () => {
            try {
                const userService = await loadUserService()
                const roles = await userService.getUserRoles(userId)
                if (cancelled) return
                if (roles?.some((r) => r?.name?.toLowerCase() === 'terminated')) {
                    setTerminatedMode(true)
                    setRolesLoaded(true)
                    return
                }
                const guestOnly = roles.length > 0 && roles.every((r) => r?.name?.toLowerCase() === 'guest')
                setIsGuestOnly(guestOnly)
                setRolesLoaded(true)
                if (guestOnly) setSelectedView({ initialStatusFilter: null, view: 'Guest' })
            } catch (err) {
                if (!cancelled) {
                    setIsGuestOnly(false)
                    setRolesLoaded(true)
                }
            }
        }
        loadRoles()
        return () => {
            cancelled = true
        }
    }, [userId, rolesLoaded])
    useEffect(() => {
        if (!userId) return
        loadDatabase()
            .then((database) =>
                database.from('users_profiles').select('first_name, last_name').eq('id', userId).single()
            )
            .then(({ data, error }) => {
                if (!error && data) {
                    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim()
                    if (name) {
                        setTitle(`Welcome, ${name}`)
                        setUserDisplayName(name)
                    } else {
                        setUserDisplayName(userId.substring(0, 8))
                    }
                }
            })
            .catch(() => {})
    }, [userId])
    useEffect(() => {
        document.querySelectorAll('[data-content-scroll]').forEach((el) => el.scrollTo(0, 0))
    }, [selectedView.view])
    const handleViewSelection = useCallback(
        (viewId, options = {}) => {
            if (isGuestOnly && viewId !== 'Guest') return
            setSelectedView({
                initialConversationId: options.initialConversationId || null,
                initialStatusFilter: null,
                view: viewId
            })
            setTitle(viewId === 'Guest' ? 'Access Pending' : viewId)
            setSelectedMixer((prev) => (prev && viewId !== 'Mixers' ? null : prev))
        },
        [isGuestOnly]
    )
    const handleSetSelectedView = useCallback(
        (view, initialStatusFilter = null, initialSelectedPlant = null, initialPositionFilter = null) => {
            setSelectedView({ initialPositionFilter, initialSelectedPlant, initialStatusFilter, view })
        },
        []
    )
    const handleRetryConnection = useCallback(async () => {
        if (!navigator.onLine) return
        const ok = await NetworkUtility.checkConnection()
        if (ok) {
            onlineStreakRef.current = 0
            offlineStreakRef.current = 0
            offlineSinceRef.current = null
            setOfflineMode(false)
        }
    }, [onlineStreakRef, offlineStreakRef, offlineSinceRef])
    const handleReloadIfOnline = useCallback(async () => {
        if (!navigator.onLine) return
        const ok = await NetworkUtility.checkConnection()
        if (ok) {
            onlineStreakRef.current = 0
            offlineStreakRef.current = 0
            offlineSinceRef.current = null
            setOfflineMode(false)
            window.location.reload()
        }
    }, [onlineStreakRef, offlineStreakRef, offlineSinceRef])
    const handleCloseWebView = useCallback(() => setWebViewURL(null), [])
    const renderCurrentView = () => {
        if (!userId) return <LoginView />
        if (!rolesLoaded) return null
        if (isGuestOnly) return null
        if (webViewURL) return <WebOverlay url={webViewURL} onClose={handleCloseWebView} />
        switch (selectedView.view) {
            case 'Dashboard':
                return <DashboardView />
            case 'Mixers':
                if (selectedMixer) {
                    return (
                        <MixerDetailView
                            mixerId={selectedMixer}
                            onClose={() => {
                                setSelectedMixer(null)
                                setTitle('Mixers')
                            }}
                        />
                    )
                }
                return (
                    <MixersView
                        onSelectMixer={(id) => {
                            if (id) {
                                setSelectedMixer(id)
                                setTitle('Mixer Details')
                            }
                        }}
                        setSelectedView={handleSetSelectedView}
                    />
                )
            case 'Operators':
                return (
                    <OperatorsView
                        title={title}
                        initialStatusFilter={selectedView.initialStatusFilter}
                        initialSelectedPlant={selectedView.initialSelectedPlant}
                        initialPositionFilter={selectedView.initialPositionFilter}
                    />
                )
            case 'Managers':
                return <ManagersView title={title} />
            case 'Tractors':
                return <TractorsView title="Tractor Fleet" setSelectedView={handleSetSelectedView} />
            case 'Trailers':
                return <TrailersView title="Trailer Fleet" onSelectTrailer={() => {}} />
            case 'Heavy Equipment':
                return <EquipmentsView title="Equipment Fleet" onSelectEquipment={() => {}} />
            case 'Pickup Trucks':
                return <PickupTrucksView title="Pickup Trucks" />
            case 'Plants':
                return <PlantsView title="Plants" />
            case 'Regions':
                return <RegionsView title="Regions" />
            case 'Roles':
                return <RolesView />
            case 'MyAccount': {
                const effectiveUserId = userId || getSessionUserId()
                return effectiveUserId ? (
                    <MyAccountView userId={effectiveUserId} onSelectView={handleViewSelection} />
                ) : (
                    <LoginView />
                )
            }
            case 'Notifications':
                return (
                    <NotificationsView
                        userId={userId}
                        initialConversationId={selectedView.initialConversationId || null}
                    />
                )
            default:
                return (
                    <div className="relative mx-auto my-8 flex h-[70vh] w-full max-w-[600px] flex-col items-center justify-center overflow-x-hidden rounded-xl bg-bg-primary p-8 text-center shadow-md">
                        <h2 className="mb-4 text-[28px] text-text-primary">View Not Found</h2>
                        <p className="mb-6 text-base text-text-secondary">
                            No view is registered under the name &quot;{selectedView.view}&quot;. Choose one from the
                            navigation above.
                        </p>
                    </div>
                )
        }
    }
    if (terminatedMode) return <TerminatedOverlay />
    if (!sessionChecked) return null
    if (!userId) return <FrontDoor />
    if (!rolesLoaded) return null
    return (
        <div className="relative z-base flex h-screen w-full flex-col overflow-hidden bg-transparent font-sans">
            <Suspense fallback={null}>
                <MessagesProvider userId={userId}>
                    <Navigation
                        selectedView={selectedView.view}
                        onSelectView={handleViewSelection}
                        onExternalLink={setWebViewURL}
                        userName={userDisplayName}
                        userDisplayName={userDisplayName}
                        userId={userId}
                    >
                        <Suspense fallback={null}>
                            <div key={`view-${regionKey}`} className="flex min-h-full flex-col">
                                <div className="relative flex-1">{renderCurrentView()}</div>
                            </div>
                        </Suspense>
                    </Navigation>
                </MessagesProvider>
            </Suspense>
            <AppFooter />
            {offlineMode && <OfflineOverlay onRetry={handleRetryConnection} onReload={handleReloadIfOnline} />}
            {isGuestOnly && <LockedOverlay reason="guest-only" />}
        </div>
    )
}
function App() {
    const { hasUpdate, dismiss } = useVersionCheck()
    useEffect(() => {
        document.documentElement.style.overflowX = 'hidden'
        document.body.style.overflowX = 'hidden'
        return () => {
            document.documentElement.style.overflowX = ''
            document.body.style.overflowX = ''
        }
    }, [])
    return (
        <>
            <AppContent />
            <Suspense fallback={null}>
                <AppInstallPromptModal />
            </Suspense>
            <TutorialManager />
            {hasUpdate && <VersionUpdateBanner onDismiss={dismiss} />}
            <Analytics />
            <SpeedInsights />
        </>
    )
}
export default App
