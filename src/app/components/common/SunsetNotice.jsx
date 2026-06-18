/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useState } from 'react'
import ReactDOM from 'react-dom'

const DISMISS_STORAGE_KEY = 'smyrna-sunset-notice-dismissed'

const isDismissed = () => {
    try {
        return localStorage.getItem(DISMISS_STORAGE_KEY) === '1'
    } catch {
        return false
    }
}

const persistDismissal = () => {
    try {
        localStorage.setItem(DISMISS_STORAGE_KEY, '1')
    } catch {
        // Storage unavailable (private mode, quota) — silently ignore; banner just reappears next visit.
    }
}

/**
 * Fixed bottom-right notice warning users that Smyrna Tools is being sunset
 * and that they should document or export anything they need before service ends.
 * Dismissal is persisted to localStorage so it does not reappear on later visits.
 */
function SunsetNotice() {
    const [visible, setVisible] = useState(() => !isDismissed())

    const handleDismiss = useCallback(() => {
        persistDismissal()
        setVisible(false)
    }, [])

    if (!visible) return null
    if (typeof document === 'undefined' || !document.body) return null

    return ReactDOM.createPortal(
        <div
            role="alert"
            aria-live="polite"
            className="fixed bottom-4 right-4 z-[10000] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-modal border border-status-warning/40 bg-bg-primary shadow-modal animate-fade-slide-in motion-reduce:animate-none sm:bottom-5 sm:right-5"
        >
            <div className="flex items-center gap-2 bg-status-warning px-4 py-3">
                <i className="fas fa-triangle-exclamation text-sm text-white" aria-hidden="true" />
                <span className="text-sm font-semibold text-white">Smyrna Tools is shutting down soon</span>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dismiss sunset notice"
                    className="ml-auto -mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-white/90 cursor-pointer transition-[background-color,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-white/15 hover:text-white active:scale-[0.93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-status-warning"
                >
                    <i className="fas fa-xmark text-sm" aria-hidden="true" />
                </button>
            </div>
            <div className="px-4 py-3">
                <p className="text-sm leading-relaxed text-text-secondary">
                    This service will no longer be available soon. Please{' '}
                    <span className="font-semibold text-text-primary">
                        document or export anything you need
                    </span>{' '}
                    from Smyrna Tools before it goes away.
                </p>
            </div>
        </div>,
        document.body
    )
}

export default SunsetNotice
