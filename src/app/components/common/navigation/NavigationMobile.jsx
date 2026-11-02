/* eslint-disable react/forbid-dom-props */
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'

import { SRM_LOGO_URL } from '../../../constants/assetUrls'
import CountBubble from '../CountBubble'
import { sidebarBackground, SidebarContent } from './NavigationSidebar'

/** Phone shell: a slim bar in the rail's colour with the logo, messages and
 *  the menu button. The menu opens the same rail the desktop shows, as a
 *  drawer from the left edge. */
export default function NavigationMobile({ children, footer, mobileMenuOpen, setMobileMenuOpen, ...railProps }) {
    const { accentColor, combinedCount = 0, onMenuClick } = railProps
    const canPortal = typeof document !== 'undefined' && !!document.body

    // The drawer covers the bar, and with it the button that opened it, so
    // Escape and the drawer's own close button are the ways back out.
    useEffect(() => {
        if (!mobileMenuOpen) return undefined
        const handleKey = (e) => {
            if (e.key === 'Escape') setMobileMenuOpen(false)
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [mobileMenuOpen, setMobileMenuOpen])

    const drawer = mobileMenuOpen ? (
        <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-0 z-drawer bg-black/50 animate-fade-in-fast motion-reduce:animate-none"
            onClick={() => setMobileMenuOpen(false)}
        >
            <div
                className="absolute left-0 top-0 h-full w-[288px] max-w-[85vw] shadow-modal animate-drawer-in-left motion-reduce:animate-none"
                onClick={(e) => e.stopPropagation()}
            >
                <SidebarContent
                    {...railProps}
                    onShowNotifications={() => onMenuClick('Notifications')}
                    onClose={() => setMobileMenuOpen(false)}
                />
            </div>
        </div>
    ) : null

    const barButton =
        'relative inline-flex h-10 w-10 items-center justify-center rounded-[4px] border-none text-white cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'

    return (
        <div
            className="flex min-h-0 w-full flex-1 flex-col"
            style={{ '--rail-width': '0px', '--topbar-height': '56px' }}
        >
            <div
                style={{ background: sidebarBackground(accentColor) }}
                className="sticky top-0 z-nav flex h-14 items-center justify-between px-3"
            >
                <button
                    type="button"
                    aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileMenuOpen}
                    aria-controls="mobile-nav-drawer"
                    className={barButton}
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    <i className="fas fa-bars" aria-hidden="true" />
                </button>
                <img
                    className="h-7 w-auto"
                    src={SRM_LOGO_URL}
                    alt="Smyrna Ready Mix"
                    width={223}
                    height={85}
                    draggable={false}
                />
                <button
                    type="button"
                    aria-label={combinedCount > 0 ? `Messages, ${combinedCount} unread` : 'Messages'}
                    onClick={() => onMenuClick('Notifications')}
                    className={barButton}
                >
                    <i className="fas fa-envelope" aria-hidden="true" />
                    <CountBubble
                        count={combinedCount}
                        size="sm"
                        ring="ring-transparent"
                        className="absolute right-1 top-1"
                    />
                </button>
            </div>
            {drawer && canPortal && ReactDOM.createPortal(drawer, document.body)}
            <div className="relative flex-1 overflow-x-hidden overflow-y-auto bg-bg-secondary" data-content-scroll>
                {children}
            </div>
            {footer}
        </div>
    )
}
