/* eslint-disable react/forbid-dom-props */
import React, { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import VersionPopup from '../../../app/components/common/VersionPopup'
import { useVersion } from '../../../app/hooks/useVersion'
import SrmLogo from '../../../assets/images/srm-logo.svg'
import LoginForm from './LoginForm'
import PortalDestinationCard from './PortalDestinationCard'

const VideoBackground = lazy(() => import('../../../app/components/common/VideoBackground'))

/** Static gradient placeholder shown while the video background lazy-loads. */
const VideoFallback = memo(function VideoFallback() {
    return (
        <div
            className="absolute inset-0 z-0"
            style={{ background: 'linear-gradient(135deg, #0a1929 0%, #1e3a5f 100%)' }}
        />
    )
})

const READY_MIX_URL = 'https://smyrnareadymix.com'
const SAMSARA_URL = 'https://samsara.com'

/**
 * Public entry portal for Smyrna. Routes visitors to three destinations:
 *  1. Smyrna Ready Mix — the company's corporate site (external)
 *  2. Samsara — fleet & telematics platform (external)
 *  3. Smyrna Tools — the in-app authentication flow (preserved verbatim)
 *
 * Composition (desktop): a compact centered hero anchors the brand at the
 * top, then a two-column layout pairs the destination rail (left) with the
 * sign-in panel (right) as equal-weight peers. On mobile the columns
 * collapse into a single stack: hero → destinations → sign-in form.
 */
function LoginView() {
    const version = useVersion()
    const [videoLoaded, setVideoLoaded] = useState(false)
    const loginPanelRef = useRef(null)

    useEffect(() => {
        const timer = setTimeout(() => setVideoLoaded(true), 100)
        return () => clearTimeout(timer)
    }, [])

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
        <div className="relative h-full min-h-screen w-full overflow-x-hidden overflow-y-auto bg-slate-950">
            {/* Fixed ambient background — pinned to the viewport so the navy
             *  layer always extends to the edges regardless of scroll
             *  position or how tall the portal content grows. */}
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
                {videoLoaded ? (
                    <Suspense fallback={<VideoFallback />}>
                        <VideoBackground />
                    </Suspense>
                ) : (
                    <VideoFallback />
                )}
                {/* Extra dark vignette so portal content reads on top of the ambient video */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/90" />
            </div>
            <VersionPopup version={version} />
            <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-12 sm:px-8 sm:py-14 lg:py-16">
                <header className="mx-auto flex w-full max-w-2xl flex-col items-center text-center animate-fade-slide-in motion-reduce:animate-none">
                    <img
                        src={SrmLogo}
                        alt="Smyrna Ready Mix"
                        className="mb-5 h-16 w-16 drop-shadow-2xl sm:h-20 sm:w-20"
                        loading="eager"
                    />
                    <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        Smyrna Portal
                    </span>
                    <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                        Welcome to <span className="text-white/70">Smyrna</span>
                    </h1>
                    <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white/60 sm:text-base">
                        Visit the company, jump into the fleet platform, or sign in to the operations tool.
                    </p>
                </header>
                <div className="mt-10 grid w-full grid-cols-1 items-start gap-8 sm:mt-12 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
                    <nav
                        aria-label="Destinations"
                        className="flex flex-col gap-3 animate-fade-slide-in motion-reduce:animate-none"
                    >
                        <h2 className="mb-1 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/55">
                            Choose a destination
                        </h2>
                        <PortalDestinationCard
                            title="Smyrna Ready Mix"
                            description="Company website — services, plants, and ways to request concrete."
                            href={READY_MIX_URL}
                            accent="#1e3a5f"
                            label="Visit"
                            icon={<i className="fas fa-industry text-lg" aria-hidden="true" />}
                        />
                        <PortalDestinationCard
                            title="Samsara"
                            description="Live fleet telematics, dash cams, and routing for drivers and dispatchers."
                            href={SAMSARA_URL}
                            accent="#0a7d4f"
                            label="Open"
                            icon={<i className="fas fa-satellite-dish text-lg" aria-hidden="true" />}
                        />
                        <PortalDestinationCard
                            title="Smyrna Tools"
                            description="Internal operations platform — plants, fleet, people, and reporting."
                            onClick={focusLoginPanel}
                            accent="#1e3a5f"
                            badge="Sign in"
                            label="Sign in"
                            icon={<i className="fas fa-toolbox text-lg" aria-hidden="true" />}
                        />
                    </nav>
                    <section
                        ref={loginPanelRef}
                        aria-label="Smyrna Tools sign in"
                        className="w-full lg:sticky lg:top-16"
                    >
                        <LoginForm />
                    </section>
                </div>
            </main>
        </div>
    )
}

export default LoginView
