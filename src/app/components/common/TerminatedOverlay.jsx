import React from 'react'

import SmyrnaLogo from '../../../assets/images/SmyrnaLogo.webp'
import { useAuth } from '../../context/AuthContext'
import BlockingStateCard from './BlockingStateCard'

/**
 * Full-screen overlay displayed when a user's access has been revoked.
 * Provides only a sign-out option with no way to dismiss.
 */
function TerminatedOverlay() {
    const { signOut } = useAuth()
    const handleSignOut = async () => {
        try {
            await signOut()
            window.location.href = '/'
        } catch {}
    }
    return (
        <BlockingStateCard
            titleId="terminated-overlay-title"
            title="Access revoked"
            media={
                <img src={SmyrnaLogo} alt="Smyrna Ready Mix" width={200} height={200} className="mb-4 h-auto w-16" />
            }
            actions={
                <button
                    type="button"
                    className="btn-primary flex-1 justify-center sm:flex-none"
                    onClick={handleSignOut}
                >
                    Sign out
                </button>
            }
        >
            Your access to this application has been revoked. Please contact your district manager for more information.
        </BlockingStateCard>
    )
}
export default TerminatedOverlay
