/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import Badge from '../../../../app/components/common/Badge'
import { CARD_STYLE, HISTORY_COLLAPSED_LIMIT } from '../../../../app/constants/maintenanceFormConstants'
import MaintenanceService from '../../../../services/MaintenanceService'
import { formatMaintenanceDateShort } from '../../../../utils/MaintenanceUtility'
import { CardHeader } from './atoms'
import { formatHistoryDateTime, statusForSubmission } from './helpers'

function HistoryStatusPill({ submission }) {
    const status = statusForSubmission(submission)
    return (
        <Badge tone={status.tone} size="sm" shape="pill" weight="bold" className="shrink-0">
            {status.label}
        </Badge>
    )
}

function HistoryRow({ accentColor, isCurrent, submission }) {
    const pdfUrl = useMemo(
        () => MaintenanceService.getScannedPdfUrl(submission?.scanned_pdf_url),
        [submission?.scanned_pdf_url]
    )
    return (
        <div
            className="flex items-center gap-2 py-2 border-t border-border-light first:border-t-0"
            style={isCurrent ? { background: `${accentColor}10` } : undefined}
        >
            <HistoryStatusPill submission={submission} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[13px] font-semibold leading-tight text-text-primary truncate">
                        {formatHistoryDateTime(submission?.submitted_at)}
                    </div>
                    {isCurrent && (
                        <Badge tone="accent" size="xs" weight="bold" className="shrink-0">
                            Viewing
                        </Badge>
                    )}
                </div>
                <div className="text-[11px] text-text-tertiary tabular-nums truncate mt-0.5">
                    {submission?.plant_code ? `Plant ${submission.plant_code}` : 'No plant'}
                    {submission?.due_date && (
                        <>
                            <span className="mx-1.5">·</span>
                            Due {formatMaintenanceDateShort(submission.due_date)}
                        </>
                    )}
                </div>
            </div>
            {pdfUrl ? (
                <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer bg-bg-secondary border border-border-light text-text-secondary shrink-0"
                    title="Open the scanned PDF in a new tab"
                >
                    <i className="fas fa-file-pdf text-[10px]" />
                    View PDF
                </a>
            ) : (
                <span className="text-[11px] text-text-tertiary shrink-0">No PDF</span>
            )}
        </div>
    )
}

export function SubmissionHistoryCard({
    accentColor,
    currentSubmissionId,
    expanded,
    history,
    loading,
    onToggleExpanded
}) {
    const total = history?.length || 0
    const visible = expanded ? history : history.slice(0, HISTORY_COLLAPSED_LIMIT)
    const hiddenCount = total - visible.length
    const canExpand = total > HISTORY_COLLAPSED_LIMIT
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                accent={accentColor}
                icon="fa-clock-rotate-left"
                label="History"
                title="Previous submissions"
                sub={
                    loading
                        ? 'Loading prior submissions…'
                        : total === 0
                          ? 'No submissions for this form yet. The first one you submit will show up here.'
                          : `${total} submission${total === 1 ? '' : 's'} on file. Newest first.`
                }
            />
            {!loading && total > 0 && (
                <>
                    <div className="flex flex-col">
                        {visible.map((submission) => (
                            <HistoryRow
                                key={submission.id}
                                accentColor={accentColor}
                                isCurrent={!!currentSubmissionId && submission.id === currentSubmissionId}
                                submission={submission}
                            />
                        ))}
                    </div>
                    {canExpand && (
                        <button
                            type="button"
                            onClick={onToggleExpanded}
                            className="mt-2 self-start text-[12px] font-semibold px-0 py-1 bg-transparent border-none cursor-pointer text-text-secondary"
                        >
                            {expanded ? 'Show less' : `Show all (${hiddenCount} more)`}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
