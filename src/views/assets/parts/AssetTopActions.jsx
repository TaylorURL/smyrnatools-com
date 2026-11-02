import React from 'react'

const SUBTLE_BUTTON_CLASS = 'btn-secondary !hidden md:!inline-flex'

/**
 * Toolbar buttons (Recap + Export + Export Issues) shown next to the search
 * row, in the shared secondary button style.
 */
export default function AssetTopActions({
    canExportData,
    config,
    isExportDataDisabled,
    isExportDisabled,
    isExportingData,
    isExportingIssues,
    onExportData,
    onExportIssues,
    onOpenRecap
}) {
    const recapButton = config.hasRecap ? (
        <button aria-label="Recap" className={SUBTLE_BUTTON_CLASS} onClick={onOpenRecap} type="button">
            <i className="fa-solid fa-clock-rotate-left text-[12px]" />
            <span>Recap</span>
        </button>
    ) : null

    const exportDataButton = canExportData ? (
        <button
            aria-label="Export"
            className={SUBTLE_BUTTON_CLASS}
            disabled={isExportDataDisabled}
            onClick={onExportData}
            type="button"
        >
            <i className={`fas ${isExportingData ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'} text-[12px]`} />
            <span>{isExportingData ? 'Exporting…' : 'Export'}</span>
        </button>
    ) : null

    const exportIssuesButton = (
        <button
            aria-label="Export Issues"
            className={SUBTLE_BUTTON_CLASS}
            disabled={isExportDisabled}
            onClick={onExportIssues}
            type="button"
        >
            <i className={`fas ${isExportingIssues ? 'fa-spinner fa-spin' : 'fa-file-export'} text-[12px]`} />
            <span>{isExportingIssues ? 'Exporting…' : 'Export Issues'}</span>
        </button>
    )

    return (
        <>
            {recapButton}
            {exportDataButton}
            {exportIssuesButton}
        </>
    )
}
