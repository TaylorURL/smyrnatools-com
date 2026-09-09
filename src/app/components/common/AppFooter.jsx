import SplitRail from '@taylorurl/split-rail'

import { useVersion } from '../../hooks/useVersion'

/** Per-surface palette. The app shell follows the theme tokens so the bar
 *  reads in the dark, light, and gray themes alike; the login portal sits on
 *  its own video backdrop, so there the bar mirrors that page's glass header
 *  instead. */
const TONES = {
    app: { bar: 'border-border-light bg-bg-primary text-text-tertiary' },
    dark: { bar: 'border-white/10 bg-slate-950/40 text-white/45 backdrop-blur-xl' }
}

/**
 * Hairline bar closing out every screen. Deliberately quiet — the shared Split
 * Rail on its own.
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
            <SplitRail version={version ? `v${version}` : undefined} />
        </footer>
    )
}

export default AppFooter
