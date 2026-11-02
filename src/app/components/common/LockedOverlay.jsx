import React from 'react'

import { useAuth } from '../../context/AuthContext'
import BlockingStateCard from './BlockingStateCard'
import VideoBackground from './VideoBackground'

/** Title and message per lock reason. Any reason without an entry here
 *  renders `DEFAULT_REASON` rather than failing. */
const REASON_CONFIG = {
    'invalid-session': {
        message:
            'Your session has expired or is invalid. Please refresh the page or sign out and log in again to continue.',
        title: 'Session invalid'
    },
    'no-plant': {
        message:
            'Your account is not assigned to a plant. Please contact your district manager to complete your setup.',
        title: 'Setup incomplete'
    }
}

const DEFAULT_REASON = {
    message: 'You do not have access.',
    title: 'Access pending'
}

/**
 * Full-screen overlay for a user who is signed in but not allowed through.
 * Portalled to `document.body` above the app, and deliberately not
 * dismissible: the only ways out are reloading the page and signing out, so
 * a locked account cannot reach the UI behind it.
 */
function LockedOverlay({ reason }) {
    const { signOut } = useAuth()
    const { title, message } = REASON_CONFIG[reason] || DEFAULT_REASON
    const handleSignOut = async () => {
        try {
            await signOut()
            window.location.href = '/'
        } catch {}
    }
    return (
        <BlockingStateCard
            titleId="locked-overlay-title"
            title={title}
            backdrop={<VideoBackground />}
            actions={
                <>
                    <button
                        type="button"
                        className="btn-secondary flex-1 justify-center sm:flex-none"
                        onClick={handleSignOut}
                    >
                        Sign out
                    </button>
                    <button
                        type="button"
                        className="btn-primary flex-1 justify-center sm:flex-none"
                        onClick={() => window.location.reload()}
                    >
                        Refresh page
                    </button>
                </>
            }
        >
            {message}
        </BlockingStateCard>
    )
}
export default LockedOverlay
