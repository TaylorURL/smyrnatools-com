import React from 'react'

import { useAccentColor } from '../../hooks/useAccentColor'

/**
 * Fixed-position version badge at the bottom-right of the viewport. Uses the
 * Plan-tab design tokens (CSS custom properties for theme awareness, hairline
 * border, compact 10–12px typography, 4px corner radius) so it visually
 * matches the rest of the redesigned surfaces. Clicking opens the changelog
 * when an `onClick` handler is provided.
 *
 * @param {Object} props
 * @param {string} [props.version] - Semantic version string to display.
 * @param {Function} [props.onClick] - Handler invoked when the badge is clicked.
 */
function VersionPopup({ version, onClick }) {
    const accentColor = useAccentColor()
    if (!version) return null
    const interactive = typeof onClick === 'function'
    return (
        <button
            type="button"
            onClick={interactive ? onClick : undefined}
            disabled={!interactive}
            className="fixed bottom-3 right-3 z-[1000] flex items-center gap-2 rounded px-2.5 py-1.5 border-none cursor-pointer disabled:cursor-default"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)'
            }}
            title={interactive ? `View changelog · ${version}` : `Version ${version}`}
        >
            <span
                className="flex h-5 w-5 items-center justify-center rounded shrink-0"
                style={{ background: `${accentColor}1a`, color: accentColor }}
            >
                <i className="fas fa-code-branch text-[10px]" />
            </span>
            <span className="flex flex-col items-start leading-tight">
                <span
                    className="text-[9.5px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    Version
                </span>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {version}
                </span>
            </span>
            {interactive && (
                <i className="fas fa-clock-rotate-left text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
            )}
        </button>
    )
}

export default VersionPopup
