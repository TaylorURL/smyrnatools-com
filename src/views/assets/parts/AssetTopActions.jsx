import React from 'react'

const SUBTLE_BUTTON_CLASS =
    'hidden md:flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

const SUBTLE_BUTTON_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

/**
 * Toolbar buttons (Recap + Export Issues) shown next to the search row.
 * Styled to match the Plan-tab `ActionButton` aesthetic — flat, subtle,
 * 12px font, no accent fill.
 */
export default function AssetTopActions({ config, isExportDisabled, isExportingIssues, onExportIssues, onOpenRecap }) {
    const recapButton = config.hasRecap ? (
        <button
            aria-label="Recap"
            className={SUBTLE_BUTTON_CLASS}
            onClick={onOpenRecap}
            style={SUBTLE_BUTTON_STYLE}
            type="button"
        >
            <i className="fa-solid fa-clock-rotate-left" />
            <span>Recap</span>
        </button>
    ) : null

    const exportButton = (
        <button
            aria-label="Export Issues"
            className={SUBTLE_BUTTON_CLASS}
            disabled={isExportDisabled}
            onClick={onExportIssues}
            style={SUBTLE_BUTTON_STYLE}
            type="button"
        >
            <i className={`fas ${isExportingIssues ? 'fa-spinner fa-spin' : 'fa-file-export'}`} />
            <span>{isExportingIssues ? 'Exporting…' : 'Export Issues'}</span>
        </button>
    )

    return config.hasRecap ? (
        <>
            {recapButton}
            {exportButton}
        </>
    ) : (
        exportButton
    )
}
