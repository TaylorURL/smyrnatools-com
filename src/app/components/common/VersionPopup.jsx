/* eslint-disable react/forbid-dom-props */
import React from 'react'
import ReactDOM from 'react-dom'

import { useAccentColor } from '../../hooks/useAccentColor'

/**
 * Fixed-position version badge at the bottom-right of the viewport.
 * Theme-aware, hairline-bordered. Clicking opens the changelog when an
 * `onClick` handler is provided.
 */
function VersionPopup({ version, onClick }) {
    const accentColor = useAccentColor()
    if (!version) return null
    const interactive = typeof onClick === 'function'
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <button
            type="button"
            onClick={interactive ? onClick : undefined}
            disabled={!interactive}
            className="fixed bottom-3 right-3 z-[1000] flex items-center gap-2 rounded border border-border-light bg-bg-primary px-2.5 py-1.5 shadow-sm cursor-pointer disabled:cursor-default active:scale-[0.97] disabled:active:scale-100 transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
            title={interactive ? `View changelog · ${version}` : `Version ${version}`}
            aria-label={interactive ? `View changelog, version ${version}` : `Version ${version}`}
        >
            <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                style={{ background: `${accentColor}1a`, color: accentColor }}
            >
                <i className="fas fa-code-branch text-[10px]" aria-hidden="true" />
            </span>
            <span className="flex flex-col items-start leading-tight">
                <span className="text-[9.5px] font-semibold uppercase tracking-wider text-text-tertiary">Version</span>
                <span className="text-[12px] font-bold tabular-nums text-text-primary">{version}</span>
            </span>
            {interactive && (
                <i className="fas fa-clock-rotate-left text-[10px] text-text-tertiary" aria-hidden="true" />
            )}
        </button>,
        document.body
    )
}

export default VersionPopup
