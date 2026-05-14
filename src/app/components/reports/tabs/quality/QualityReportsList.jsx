import React from 'react'

import { QualityReportsListSkeleton } from '../../ReportsViewSkeletons'

const meaningfulStr = (val) =>
    val && typeof val === 'string' && val.trim() && val.trim() !== 'N/A' ? val.trim() : null

function QualityReportRow({ accent, getUserName, onDelete, onOpen, report }) {
    const submittedLabel = report.submittedAt
        ? new Date(report.submittedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        : ''
    const submitterName = getUserName(report.userId) || 'Unknown'
    const d = report.data || {}
    const isLabReport = report.name === 'third_party_lab'
    const title = isLabReport
        ? meaningfulStr(d.lab_company_name) || 'Third Party Lab Report'
        : meaningfulStr(d.contractor) || meaningfulStr(d.project) || 'QC Strength Report'
    const iconClass = isLabReport ? 'fa-vial' : 'fa-flask'
    /* color-mix tints adapt to whatever the page background is, so the same
     * value reads well in both light and dark mode without a separate
     * dark-mode override. */
    const iconTint = isLabReport
        ? { bg: 'color-mix(in srgb, #f43f5e 14%, transparent)', fg: '#f43f5e' }
        : { bg: 'color-mix(in srgb, #8b5cf6 14%, transparent)', fg: '#8b5cf6' }
    return (
        <div
            className="flex items-center px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary border-b border-border-light"
            onClick={() => onOpen(report)}
        >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ background: iconTint.bg, color: iconTint.fg }}
                >
                    <i className={`fas ${iconClass} text-[11px]`} />
                </div>
                <div className="min-w-0">
                    <span className="text-[12px] font-semibold block truncate text-text-primary">{title}</span>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-text-secondary">
                        <span className="truncate">{submitterName}</span>
                        {submittedLabel && (
                            <>
                                <span className="text-text-tertiary">·</span>
                                <span className="font-mono tabular-nums">{submittedLabel}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {report.reviewed ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0 bg-green-100 text-green-800">
                    Reviewed
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0 bg-amber-100 text-amber-800">
                    Pending
                </span>
            )}
            <button
                className="ml-2 px-2 py-1 rounded text-white text-[10.5px] font-semibold shrink-0 hidden sm:inline-flex uppercase tracking-wider"
                style={{ background: accent }}
                onClick={(e) => {
                    e.stopPropagation()
                    onOpen(report)
                }}
            >
                {report.reviewed ? 'View' : 'Review'}
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onDelete(report)
                }}
                className="w-6 h-6 flex items-center justify-center rounded shrink-0 ml-1.5 hidden sm:flex transition-colors hover:bg-bg-tertiary text-text-tertiary"
                title="Delete"
            >
                <i className="fas fa-trash-alt text-[10px]" />
            </button>
            <i className="fas fa-chevron-right text-[10px] ml-2 sm:hidden text-text-tertiary" />
        </div>
    )
}

/**
 * Quality / Third-Party Lab reports list rendered inside the Quality tab.
 * Handles loading, empty, filtered-empty, and populated states.
 */
export default function QualityReportsList({
    accent,
    allReports,
    getUserName,
    hasActiveFilters,
    isLoading,
    onDelete,
    onOpenLab,
    onOpenQc,
    visibleReports
}) {
    if (isLoading) return <QualityReportsListSkeleton />
    if (allReports.length === 0) {
        return (
            <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                <div className="flex flex-col items-center justify-center py-10 px-4 text-text-tertiary">
                    <i className="fas fa-flask text-2xl mb-2" />
                    <div className="text-[12px]">No quality reports submitted yet</div>
                </div>
            </div>
        )
    }
    const handleOpen = (report) => (report.name === 'third_party_lab' ? onOpenLab(report) : onOpenQc(report))
    return (
        <div>
            <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                    Quality Reports
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono tabular-nums bg-bg-tertiary text-text-secondary">
                    {hasActiveFilters ? `${visibleReports.length} / ${allReports.length}` : allReports.length}
                </span>
            </div>
            {visibleReports.length === 0 ? (
                <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-text-tertiary">
                        <i className="fas fa-filter text-2xl mb-2" />
                        <div className="text-[12px]">No reports match your filters</div>
                    </div>
                </div>
            ) : (
                <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                    {visibleReports.map((report) => (
                        <QualityReportRow
                            key={report.id}
                            accent={accent}
                            getUserName={getUserName}
                            onDelete={onDelete}
                            onOpen={handleOpen}
                            report={report}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
