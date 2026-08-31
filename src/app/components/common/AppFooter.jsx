import SplitRail from '@taylorurl/split-rail'
import React from 'react'
import { Link } from 'react-router-dom'

import { useVersion } from '../../hooks/useVersion'

/** The three public routes `src/index.jsx` declares outside the app shell. */
const LEGAL_LINKS = [
    { label: 'Privacy', to: '/privacy' },
    { label: 'Terms', to: '/terms' },
    { label: 'Contact', to: '/contact' }
]

/** Per-surface palette. The app shell follows the theme tokens so the bar
 *  reads in the dark, light, and gray themes alike; the login portal sits on
 *  its own video backdrop, so there the bar mirrors that page's glass header
 *  instead. */
const TONES = {
    app: {
        bar: 'border-border-light bg-bg-primary text-text-tertiary',
        link: 'text-text-tertiary hover:text-accent focus-visible:text-accent focus-visible:ring-accent focus-visible:ring-offset-bg-primary'
    },
    dark: {
        bar: 'border-white/10 bg-slate-950/40 text-white/45 backdrop-blur-xl',
        link: 'text-white/60 hover:text-white focus-visible:text-white focus-visible:ring-white/60 focus-visible:ring-offset-slate-950'
    }
}

/**
 * Hairline bar closing out every screen. Deliberately quiet — the three public
 * routes on one row, and the shared Split Rail beneath them. The privacy route
 * is where the app discloses the analytics it loads, so the link out to it is
 * also that disclosure.
 *
 * Split Rail is mounted inside this footer rather than beside it, which is what
 * lets it take the surrounding palette: it names no ground and no ink of its
 * own, mixing every tone from `currentColor`, so the same rail reads correctly
 * under the app shell's theme tokens and under the login portal's dark glass.
 * It also carries the deployed version, which is why nothing here states it
 * twice.
 *
 * The footer renders in the normal flow at the bottom of the shell rather than
 * pinned to the viewport, so it never covers the content above it; full-screen
 * overlays (detail views, offline/locked states, modals) still sit over it.
 */
function AppFooter({ tone = 'app' }) {
    const version = useVersion()
    const palette = TONES[tone] || TONES.app
    return (
        <footer className={`z-20 flex w-full shrink-0 flex-col border-t ${palette.bar}`}>
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-[10.5px] leading-none tracking-wide">
                {LEGAL_LINKS.map(({ label, to }, index) => (
                    <React.Fragment key={to}>
                        {index > 0 && (
                            <span aria-hidden="true" className="opacity-50">
                                &middot;
                            </span>
                        )}
                        <Link
                            to={to}
                            className={`rounded-sm transition-colors duration-150 ease-out focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none ${palette.link}`}
                        >
                            {label}
                        </Link>
                    </React.Fragment>
                ))}
            </div>
            <SplitRail version={version ? `v${version}` : undefined} />
        </footer>
    )
}

export default AppFooter
