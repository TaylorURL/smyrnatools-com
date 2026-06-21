import React, { useCallback, useRef } from 'react'

import VersionPopup from '../../../app/components/common/VersionPopup'
import { useVersion } from '../../../app/hooks/useVersion'
import SrmLogo from '../../../assets/images/srm-logo.svg'
import LoginForm from './LoginForm'
import PortalDestinationCard from './PortalDestinationCard'

const READY_MIX_URL = 'https://smyrnareadymix.com'
const SAMSARA_URL = 'https://samsara.com'

/**
 * Public entry portal for Smyrna Tools. Mirrors the in-app design language —
 * slim app-bar header, flat 1px panels on theme-aware surfaces, monochrome
 * type rhythm — so the landing reads as the front door of the operations
 * product, not a marketing splash. Routes visitors to three destinations:
 *  1. Smyrna Ready Mix — corporate site (external)
 *  2. Samsara — fleet & telematics platform (external)
 *  3. Smyrna Tools — the in-app authentication flow (preserved verbatim)
 */
function LoginView() {
    const version = useVersion()
    const loginPanelRef = useRef(null)

    const focusLoginPanel = useCallback(() => {
        const node = loginPanelRef.current
        if (!node) return
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const emailInput = node.querySelector('input[type="email"]')
        if (emailInput) {
            window.setTimeout(() => emailInput.focus({ preventScroll: true }), 350)
        }
    }, [])

    return (
        <div className="flex h-full min-h-screen w-full flex-col overflow-y-auto overflow-x-hidden bg-bg-secondary text-text-primary">
            <VersionPopup version={version} />
            <header className="flex shrink-0 items-center gap-3 border-b border-border-light bg-bg-primary px-4 py-2.5 sm:px-5">
                <img src={SrmLogo} alt="Smyrna Ready Mix" className="h-7 w-7 shrink-0" loading="eager" />
                <div className="flex min-w-0 flex-col leading-tight">
                    <span className="font-heading text-[15px] font-bold tracking-tight text-text-primary">
                        Smyrna Portal
                    </span>
                    <span className="hidden text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary sm:inline">
                        Operations · Fleet · Concrete
                    </span>
                </div>
                <div className="min-w-[8px] flex-1" />
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-active" aria-hidden="true" />
                    <span className="hidden sm:inline">System</span>
                    Online
                </span>
            </header>
            <main className="flex flex-1 flex-col">
                <div className="mx-auto my-auto w-full max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
                    <section
                        aria-labelledby="portal-heading"
                        className="mb-7 flex flex-col gap-1.5 animate-fade-in-fast motion-reduce:animate-none"
                    >
                        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                            <span className="h-px w-6 bg-border-medium" aria-hidden="true" />
                            Welcome
                        </span>
                        <h1
                            id="portal-heading"
                            className="m-0 font-heading text-[28px] font-bold leading-[1.05] tracking-tight text-text-primary sm:text-[34px]"
                        >
                            Smyrna at a glance.
                        </h1>
                        <p className="m-0 max-w-xl text-[13.5px] leading-relaxed text-text-secondary">
                            Visit the company site, hop into the fleet platform, or sign in to the operations
                            tool.
                        </p>
                    </section>
                    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-6">
                        <nav
                            aria-label="Destinations"
                            className="flex flex-col gap-2.5 animate-fade-in-fast motion-reduce:animate-none"
                        >
                            <div className="flex items-center gap-2 px-0.5">
                                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
                                    Destinations
                                </span>
                                <span className="h-px flex-1 bg-border-light" aria-hidden="true" />
                                <span className="text-[10px] font-bold tabular-nums text-text-tertiary">03</span>
                            </div>
                            <PortalDestinationCard
                                title="Smyrna Ready Mix"
                                description="Company site — services, plants, and ways to request concrete."
                                href={READY_MIX_URL}
                                icon="industry"
                                meta="Corporate"
                                tone="info"
                            />
                            <PortalDestinationCard
                                title="Samsara"
                                description="Fleet telematics, dash cams, and routing for drivers and dispatchers."
                                href={SAMSARA_URL}
                                icon="satellite-dish"
                                meta="Fleet platform"
                                tone="success"
                            />
                            <PortalDestinationCard
                                title="Smyrna Tools"
                                description="Internal operations — plants, fleet, people, and reporting."
                                onClick={focusLoginPanel}
                                icon="toolbox"
                                meta="Internal · Sign-in required"
                                tone="accent"
                            />
                        </nav>
                        <section
                            ref={loginPanelRef}
                            aria-label="Smyrna Tools sign in"
                            className="w-full animate-fade-in-fast motion-reduce:animate-none"
                        >
                            <LoginForm />
                        </section>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default LoginView
