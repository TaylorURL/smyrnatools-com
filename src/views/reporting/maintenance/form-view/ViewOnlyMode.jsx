/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import MaintenanceService from '../../../../services/MaintenanceService'
import { formatMaintenanceDateShort } from '../../../../utils/MaintenanceUtility'
import { CardHeader, PageHeader, PdfEmbed } from './atoms'
import { CARD_STYLE } from './constants'
import { statusForSubmission } from './helpers'
import { SubmissionHistoryCard } from './SubmissionHistoryCard'
import { useSubmissionHistory } from './useSubmissionHistory'

export function ViewOnlyMode({ accentColor, formObj, item, onBack, submission }) {
    const status = statusForSubmission(submission)
    const pdfUrl = useMemo(
        () => MaintenanceService.getScannedPdfUrl(submission?.scanned_pdf_url),
        [submission?.scanned_pdf_url]
    )
    const [historyExpanded, setHistoryExpanded] = useState(false)
    const { history, loading: historyLoading } = useSubmissionHistory(formObj?.id)
    return (
        <div className="flex h-full w-full flex-col overflow-y-auto bg-bg-secondary">
            <PageHeader
                accentColor={accentColor}
                dueDate={formatMaintenanceDateShort(submission?.due_date || item?.due_date)}
                label="Submission"
                onBack={onBack}
                plantCode={submission?.plant_code || item?.plant_code}
                status={status.label}
                statusColor={status.color}
                title={formObj?.title}
            />
            <div className="w-full px-3 sm:px-4 py-3 flex flex-col gap-2.5">
                <div className="rounded p-3" style={CARD_STYLE}>
                    <CardHeader
                        accent={accentColor}
                        icon="fa-file-pdf"
                        label="Scanned form"
                        title={formObj?.title || 'Maintenance form'}
                        sub={`Submitted ${formatMaintenanceDateShort(submission?.submitted_at)}${
                            submission?.reviewed_at
                                ? ` · Reviewed ${formatMaintenanceDateShort(submission.reviewed_at)}`
                                : ''
                        }`}
                    />
                    <PdfEmbed url={pdfUrl} />
                </div>
                {submission?.submitter_notes && (
                    <div className="rounded p-3" style={CARD_STYLE}>
                        <CardHeader
                            accent={accentColor}
                            icon="fa-pen-to-square"
                            label="Notes"
                            title="Submitter notes"
                        />
                        <div className="text-[12.5px] leading-relaxed text-text-primary">
                            {submission.submitter_notes}
                        </div>
                    </div>
                )}
                {submission?.review_notes && (
                    <div className="rounded p-3" style={CARD_STYLE}>
                        <CardHeader
                            accent={accentColor}
                            icon="fa-clipboard-check"
                            label="Review"
                            title="Reviewer notes"
                        />
                        <div className="text-[12.5px] leading-relaxed text-text-primary">{submission.review_notes}</div>
                    </div>
                )}

                <SubmissionHistoryCard
                    accentColor={accentColor}
                    currentSubmissionId={submission?.id}
                    expanded={historyExpanded}
                    history={history}
                    loading={historyLoading}
                    onToggleExpanded={() => setHistoryExpanded((prev) => !prev)}
                />
            </div>
        </div>
    )
}
