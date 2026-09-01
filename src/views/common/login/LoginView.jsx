import React, { useCallback, useRef, useState } from 'react'

import VideoBackground from '../../../app/components/common/VideoBackground'
import { SRM_LOGO_URL } from '../../../app/constants/assetUrls'
import LoginForm from './LoginForm'
import PortalDestinationCard from './PortalDestinationCard'

const READY_MIX_URL = 'https://smyrnareadymix.com'
const SAMSARA_URL = 'https://samsara.com'
const FOCUS_AFTER_REVEAL_MS = 480

/**
 * The public front door. Fixed light-on-dark throughout rather than themed,
 * because it sits over the ambient video and there is no signed-in preference
 * to read yet.
 *
 * Nothing but the title shows until the title is clicked: the destination
 * cards and the sign-in panel slide in on that click, so a visitor is not met
 * with a form. The click toggles, and concealing hands focus back to the
 * title so a keyboard user is not stranded on a hidden panel.
 */
function LoginView() {
    const loginPanelRef = useRef(null)
    const gateButtonRef = useRef(null)
    const [isRevealed, setIsRevealed] = useState(false)

    const focusEmailField = useCallback(() => {
        const node = loginPanelRef.current
        if (!node) return
        const emailInput = node.querySelector('input[type="email"]')
        if (emailInput) emailInput.focus({ preventScroll: true })
    }, [])

    const focusLoginPanel = useCallback(() => {
        const node = loginPanelRef.current
        if (!node) return
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
        window.setTimeout(focusEmailField, 350)
    }, [focusEmailField])

    const reveal = useCallback(() => {
        setIsRevealed(true)
        window.setTimeout(focusEmailField, FOCUS_AFTER_REVEAL_MS)
    }, [focusEmailField])

    const conceal = useCallback(() => {
        setIsRevealed(false)
        window.setTimeout(() => gateButtonRef.current?.focus({ preventScroll: true }), 0)
    }, [])

    const handleBrandClick = useCallback(() => {
        if (isRevealed) conceal()
        else reveal()
    }, [isRevealed, reveal, conceal])

    return (
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden text-white">
            {/*
             * Fixed to the viewport rather than laid out, so the video and
             * the ground under it keep covering the screen however far the
             * revealed portal scrolls. The gradient over it is what lets the
             * translucent panels read against moving footage.
             *
             * The ground is painted here rather than on the scrolling column,
             * so that column stays a plain layout box and the header and
             * footer sit against the page rather than inside a panel.
             */}
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-slate-950">
                <VideoBackground />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/90" />
            </div>
            <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950/40 px-4 py-2.5 backdrop-blur-xl sm:px-5">
                <button
                    type="button"
                    onClick={handleBrandClick}
                    aria-expanded={isRevealed}
                    aria-controls="portal-landing"
                    aria-label={isRevealed ? 'Hide sign-in portal' : 'Reveal sign-in portal'}
                    className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-md border-none bg-transparent p-0 text-left transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none"
                >
                    <img
                        src={SRM_LOGO_URL}
                        alt="Smyrna Ready Mix"
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0"
                        loading="eager"
                        fetchPriority="high"
                    />
                    <span className="flex min-w-0 flex-col leading-tight">
                        <span className="font-heading text-[15px] font-bold tracking-tight text-white">
                            Smyrna Portal
                        </span>
                        <span className="hidden text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/55 sm:inline">
                            Operations · Fleet · Concrete
                        </span>
                    </span>
                </button>
                <div className="min-w-[8px] flex-1" />
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/75">
                    <span
                        className="h-1.5 w-1.5 rounded-full bg-current text-status-active shadow-glow"
                        aria-hidden="true"
                    />
                    <span className="hidden sm:inline">System</span>
                    Online
                </span>
            </header>
            <main className="relative z-10 flex flex-1 flex-col">
                {isRevealed ? (
                    <div
                        id="portal-landing"
                        className="mx-auto my-auto w-full max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10 lg:py-14 animate-fade-in-up motion-reduce:animate-none"
                    >
                        <section aria-labelledby="portal-heading" className="mb-7 flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                                <span className="h-px w-6 bg-white/25" aria-hidden="true" />
                                Welcome
                            </span>
                            <h1
                                id="portal-heading"
                                className="m-0 font-heading text-[28px] font-bold leading-[1.05] tracking-tight text-white sm:text-[34px]"
                            >
                                Smyrna at a glance.
                            </h1>
                            <p className="m-0 max-w-xl text-[13.5px] leading-relaxed text-white/70">
                                Visit the company site, hop into the fleet platform, or sign in to the operations tool.
                            </p>
                        </section>
                        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-6">
                            <nav aria-label="Destinations" className="flex flex-col gap-2.5">
                                <div className="flex items-center gap-2 px-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
                                        Destinations
                                    </span>
                                    <span className="h-px flex-1 bg-white/15" aria-hidden="true" />
                                    <span className="text-[10px] font-bold tabular-nums text-white/55">03</span>
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
                            <section ref={loginPanelRef} aria-label="Smyrna Tools sign in" className="w-full">
                                <LoginForm />
                            </section>
                        </div>
                    </div>
                ) : (
                    <div className="m-auto flex w-full max-w-md flex-col items-center px-6 py-12 animate-fade-in motion-reduce:animate-none">
                        <button
                            type="button"
                            ref={gateButtonRef}
                            onClick={reveal}
                            aria-expanded={isRevealed}
                            aria-controls="portal-landing"
                            className="group flex w-full cursor-pointer flex-col items-center gap-5 rounded-card border border-transparent bg-transparent px-6 py-8 text-center transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                        >
                            <span className="relative inline-flex h-16 w-16 items-center justify-center">
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-full bg-white/10 transition-[transform,background-color] duration-300 ease-out group-hover:scale-110 group-hover:bg-white/15 motion-reduce:transition-none"
                                />
                                <img
                                    src={SRM_LOGO_URL}
                                    alt=""
                                    aria-hidden="true"
                                    width={48}
                                    height={48}
                                    className="relative h-12 w-12"
                                    loading="eager"
                                    fetchPriority="high"
                                />
                            </span>
                            <span className="flex flex-col items-center gap-2.5">
                                <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                                    <span className="h-px w-6 bg-white/25" aria-hidden="true" />
                                    Welcome
                                    <span className="h-px w-6 bg-white/25" aria-hidden="true" />
                                </span>
                                <span className="font-heading text-[40px] font-bold leading-none tracking-tight text-white sm:text-[48px]">
                                    Smyrna Tools
                                </span>
                                <span className="text-[12.5px] text-white/70">Click to sign in</span>
                            </span>
                            <span
                                aria-hidden="true"
                                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 transition-[color,border-color,transform,background-color] duration-200 ease-out group-hover:translate-y-0.5 group-hover:border-white/30 group-hover:bg-white/[0.1] group-hover:text-white motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                            >
                                <i className="fas fa-chevron-down text-[9px]" />
                                Enter
                            </span>
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}

export default LoginView
