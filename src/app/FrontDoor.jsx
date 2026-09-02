import React from 'react'

import LoginView from '../views/common/login/LoginView'
import AppFooter from './components/common/AppFooter'

/**
 * The signed-out front door: the sign-in screen with the footer under it, in
 * the shell every screen shares.
 *
 * It sits in a module of its own because the build renders it into index.html
 * and App.jsx renders it in the browser. A visitor is shown the drawn screen
 * before the bundle has arrived, and what React mounts a moment later has to be
 * that same screen; one component is how the two stay the same screen, and
 * keeping it out of App.jsx is what keeps the operations shell's imports out of
 * the render the build performs.
 */
export default function FrontDoor() {
    return (
        <div className="relative z-base flex h-screen w-full flex-col overflow-hidden bg-transparent font-sans">
            <LoginView />
            <AppFooter tone="dark" />
        </div>
    )
}
