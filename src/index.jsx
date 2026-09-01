import './app/index.css'

import * as Sentry from '@sentry/react'
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import packageJson from '../package.json'
import App from './app/App'
import { AuthProvider } from './app/context/AuthContext'
import { ConfirmProvider } from './app/context/ConfirmContext'
import { PreferencesProvider } from './app/context/PreferencesContext'
import { TutorialProvider } from './app/context/TutorialContext'
import { getSessionUserId } from './services/SessionService'

// The three public pages are the only routes the app declares; every other
// path is the operations shell, which picks its own screen from state rather
// than from the URL. Loading them lazily keeps their prose out of the bundle
// the signed-in app pays for on every visit.
const ContactView = lazy(() => import('./views/common/legal/ContactView'))
const PrivacyView = lazy(() => import('./views/common/legal/PrivacyView'))
const TermsView = lazy(() => import('./views/common/legal/TermsView'))

const SENTRY_DSN = import.meta.env.REACT_APP_SENTRY_DSN

if (SENTRY_DSN) {
    Sentry.init({
        beforeSend(event) {
            if (event.user) {
                delete event.user.email
                delete event.user.ip_address
                delete event.user.username
            }
            return event
        },
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        release: `smyrnatools@${packageJson.version}`,
        sendDefaultPii: false
    })
}

/** Minimal full-screen error fallback shown when the root ErrorBoundary catches. */
function ErrorFallback() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6 dark:bg-gray-900">
            <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
                <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">Something went wrong</h1>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                    An unexpected error occurred. Please reload the page to try again.
                </p>
                <button
                    type="button"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    onClick={() => window.location.reload()}
                >
                    Reload Page
                </button>
            </div>
        </div>
    )
}

/**
 * Keeps the Sentry scope in step with the app's auth and region state by
 * listening for the `authSuccess`, `authSignOut`, and `region-changed` window
 * events the rest of the app dispatches. Only the user id is attached — email,
 * username, and IP are stripped in `beforeSend` above.
 */
function configureSentryUserScope() {
    if (!SENTRY_DSN) return

    const attachUser = () => {
        const userId = getSessionUserId()
        if (userId) Sentry.setUser({ id: userId })
    }

    const detachUser = () => {
        Sentry.setUser(null)
    }

    const attachRegion = (event) => {
        const region = event?.detail
        if (region?.code) {
            Sentry.setTag('region.code', region.code)
            Sentry.setTag('region.name', region.name)
            Sentry.setTag('region.type', region.type)
        }
    }

    window.addEventListener('authSuccess', attachUser)
    window.addEventListener('authSignOut', detachUser)
    window.addEventListener('region-changed', attachRegion)

    attachUser()
}

configureSentryUserScope()

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <PreferencesProvider>
                    <TutorialProvider>
                        <ConfirmProvider>
                            <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
                                <Suspense fallback={null}>
                                    <Routes>
                                        <Route path="/privacy" element={<PrivacyView />} />
                                        <Route path="/terms" element={<TermsView />} />
                                        <Route path="/contact" element={<ContactView />} />
                                        <Route path="*" element={<App />} />
                                    </Routes>
                                </Suspense>
                            </Sentry.ErrorBoundary>
                        </ConfirmProvider>
                    </TutorialProvider>
                </PreferencesProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
)
const runWhenIdle = (callback) => {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout: 2000 })
    } else {
        setTimeout(callback, 1)
    }
}
runWhenIdle(() => {
    import('./utils/VitalsUtility').then((module) => {
        module.default()
    })
})
// No worker is registered for this origin, and one that a browser still holds
// keeps intercepting fetches until something unregisters it — including the
// range requests the background video is served over. Clearing any leftover
// registration and the caches behind it hands every request back to the HTTP
// cache, which the assets are already given immutable lifetimes for.
if ('serviceWorker' in navigator) {
    runWhenIdle(() => {
        navigator.serviceWorker
            .getRegistrations()
            .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
            .then((results) => {
                if (results.some(Boolean) && 'caches' in window) {
                    return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
                }
                return null
            })
            .catch(() => {})
    })
}
