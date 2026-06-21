/* eslint-disable react/forbid-dom-props */
import React, { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import VersionPopup from '../../../app/components/common/VersionPopup'
import { useVersion } from '../../../app/hooks/useVersion'
import SrmLogo from '../../../assets/images/srm-logo.svg'
import { Database } from '../../../services/DatabaseService'
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

/** Compact, theme-consistent fleet stats strip rendered under the hero copy. */
const PortalStatsRow = memo(function PortalStatsRow({ stats }) {
    const items = [
        { label: 'Fleet Assets', value: stats.assets },
        { label: 'Plants', value: stats.plants },
        { label: 'Operators', value: stats.operators }
    ]
    return (
        <div className="mt-8 inline-flex items-stretch gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3 backdrop-blur-md">
            {items.map((item, idx) => (
                <React.Fragment key={item.label}>
                    {idx > 0 && <span className="my-1 w-px self-stretch bg-white/15" aria-hidden="true" />}
                    <div className="flex flex-col items-center justify-center px-3 tabular-nums">
                        <span className="font-heading text-xl font-bold leading-none text-white">
                            {item.value > 0 ? item.value : '—'}
                        </span>
                        <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/55">
                            {item.label}
                        </span>
                    </div>
                </React.Fragment>
            ))}
        </div>
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
 * Visually composes the cinematic ambient video background and the navy
 * brand identity from the legacy login screen into a portal hero + three
 * uniform destination tiles + an always-visible sign-in panel.
 */
function LoginView() {
    const version = useVersion()
    const [animatedStats, setAnimatedStats] = useState({ assets: 0, operators: 0, plants: 0 })
    const [videoLoaded, setVideoLoaded] = useState(false)
    const loginPanelRef = useRef(null)

    useEffect(() => {
        const timer = setTimeout(() => setVideoLoaded(true), 100)
        return () => clearTimeout(timer)
    }, [])

    // Fetch aggregate fleet counts after a 1s delay (so the UI paints first),
    // then animate them with a cubic ease-out over 1.5s.
    useEffect(() => {
        let cancelled = false
        const fetchStats = async () => {
            if (cancelled) return
            try {
                const [mixersRes, tractorsRes, trailersRes, equipmentRes, operatorsRes, plantsRes] = await Promise.all([
                    Database.from('mixers').select('*', { count: 'exact', head: true }).neq('status', 'Retired'),
                    Database.from('tractors').select('*', { count: 'exact', head: true }).neq('status', 'Retired'),
                    Database.from('trailers').select('*', { count: 'exact', head: true }).neq('status', 'Retired'),
                    Database.from('heavy_equipment')
                        .select('*', { count: 'exact', head: true })
                        .neq('status', 'Retired'),
                    Database.from('operators')
                        .select('*', { count: 'exact', head: true })
                        .in('status', ['Active', 'Training', 'Light Duty']),
                    Database.from('plants').select('*', { count: 'exact', head: true })
                ])
                if (cancelled) return
                const totalAssets =
                    (mixersRes.count || 0) +
                    (tractorsRes.count || 0) +
                    (trailersRes.count || 0) +
                    (equipmentRes.count || 0)
                const targetStats = {
                    assets: totalAssets,
                    operators: operatorsRes.count || 0,
                    plants: plantsRes.count || 0
                }
                const duration = 1500
                const startTime = performance.now()
                const animate = (currentTime) => {
                    if (cancelled) return
                    const elapsed = currentTime - startTime
                    const progress = Math.min(elapsed / duration, 1)
                    const eased = 1 - Math.pow(1 - progress, 3)
                    setAnimatedStats({
                        assets: Math.round(targetStats.assets * eased),
                        operators: Math.round(targetStats.operators * eased),
                        plants: Math.round(targetStats.plants * eased)
                    })
                    if (progress < 1) requestAnimationFrame(animate)
                }
                requestAnimationFrame(animate)
            } catch {
                if (!cancelled) setAnimatedStats({ assets: 0, operators: 0, plants: 0 })
            }
        }
        fetchStats()
        return () => {
            cancelled = true
        }
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
        <div className="relative min-h-screen w-full overflow-x-hidden">
            {videoLoaded ? (
                <Suspense fallback={<VideoFallback />}>
                    <VideoBackground />
                </Suspense>
            ) : (
                <VideoFallback />
            )}
            {/* Extra dark vignette so portal content reads on top of the ambient video */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[4] bg-gradient-to-b from-slate-950/60 via-slate-950/35 to-slate-950/85"
            />
            <VersionPopup version={version} />
            <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-start px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:pt-20">
                <header className="flex w-full max-w-5xl flex-col items-center text-center animate-fade-slide-in motion-reduce:animate-none">
                    <img
                        src={SrmLogo}
                        alt="Smyrna Ready Mix"
                        className="mb-6 h-20 w-20 drop-shadow-2xl sm:h-24 sm:w-24"
                        loading="eager"
                    />
                    <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        Smyrna Portal
                    </span>
                    <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                        Welcome to <span className="text-white/70">Smyrna</span>
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
                        Choose your destination — visit the company, jump into the fleet platform, or sign in to the
                        operations tool.
                    </p>
                    <PortalStatsRow stats={animatedStats} />
                </header>
                <section
                    aria-label="Destinations"
                    className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3"
                >
                    <PortalDestinationCard
                        title="Smyrna Ready Mix"
                        description="The company website — services, plants, and ways to request concrete."
                        href={READY_MIX_URL}
                        accent="#1e3a5f"
                        label="Visit site"
                        icon={<i className="fas fa-industry text-lg" aria-hidden="true" />}
                    />
                    <PortalDestinationCard
                        title="Samsara"
                        description="Live fleet telematics, dash cams, and routing for drivers and dispatchers."
                        href={SAMSARA_URL}
                        accent="#0a7d4f"
                        label="Open Samsara"
                        icon={<i className="fas fa-satellite-dish text-lg" aria-hidden="true" />}
                    />
                    <PortalDestinationCard
                        title="Smyrna Tools"
                        description="Internal operations platform — plants, fleet, people, and reporting."
                        onClick={focusLoginPanel}
                        accent="#1e3a5f"
                        badge="Sign in"
                        label="Sign in below"
                        icon={<i className="fas fa-toolbox text-lg" aria-hidden="true" />}
                    />
                </section>
                <section
                    ref={loginPanelRef}
                    aria-label="Smyrna Tools sign in"
                    className="mt-14 w-full max-w-md"
                >
                    <LoginForm />
                </section>
            </main>
        </div>
    )
}

export default LoginView
