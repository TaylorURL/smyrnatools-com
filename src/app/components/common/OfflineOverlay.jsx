import React, { useState } from 'react'

import BlockingStateCard from './BlockingStateCard'

/**
 * Full-screen overlay for a lost network connection, portalled to
 * `document.body`. Has no dismiss of its own — the caller unmounts it once
 * the connection is back.
 *
 * `onRetry` is awaited, and the button stays disabled for its whole
 * duration, so a slow check cannot be fired twice.
 */
function OfflineOverlay({ onRetry }) {
    const [isRetrying, setIsRetrying] = useState(false)
    const handleRetry = async () => {
        setIsRetrying(true)
        try {
            await onRetry()
        } finally {
            setIsRetrying(false)
        }
    }
    return (
        <BlockingStateCard
            titleId="offline-overlay-title"
            title="Connection lost"
            actions={
                <button
                    type="button"
                    className="btn-primary flex-1 justify-center sm:flex-none"
                    onClick={handleRetry}
                    disabled={isRetrying}
                >
                    <i
                        className={`fas fa-redo text-[12px] ${isRetrying ? 'animate-spin motion-reduce:animate-none' : ''}`}
                        aria-hidden="true"
                    />
                    {isRetrying ? 'Checking connection…' : 'Retry connection'}
                </button>
            }
        >
            Your connection appears to be offline or unstable. Please check your network and try again.
        </BlockingStateCard>
    )
}
export default OfflineOverlay
