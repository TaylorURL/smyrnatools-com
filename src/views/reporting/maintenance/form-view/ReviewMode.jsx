/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import MaintenanceService from '../../../../services/MaintenanceService'
import { UserService } from '../../../../services/UserService'
import { formatMaintenanceDateShort } from '../../../../utils/MaintenanceUtility'
import { CardHeader, PageHeader, PdfEmbed } from './atoms'
import { CARD_STYLE, FIELD_INPUT_CLASS, FIELD_STYLE, SECTION_LABEL_CLASS } from './constants'
import { statusForSubmission } from './helpers'
import { SubmissionHistoryCard } from './SubmissionHistoryCard'
import { useSubmissionHistory } from './useSubmissionHistory'

export function ReviewMode({ accentColor, formObj, item, onBack, onSubmitted, submission }) {
    const status = statusForSubmission(submission)
    const pdfUrl = useMemo(
        () => MaintenanceService.getScannedPdfUrl(submission?.scanned_pdf_url),
        [submission?.scanned_pdf_url]
    )
    const [reviewNotes, setReviewNotes] = useState('')
    const [submitterName, setSubmitterName] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [historyExpanded, setHistoryExpanded] = useState(false)
    const { history, loading: historyLoading } = useSubmissionHistory(formObj?.id)

    useEffect(() => {
        let cancelled = false
        if (submission?.submitted_by) {
            UserService.getUserDisplayName(submission.submitted_by)
                .then((n) => !cancelled && setSubmitterName(n || 'Unknown'))
                .catch(() => !cancelled && setSubmitterName('Unknown'))
        }
        return () => {
            cancelled = true
        }
    }, [submission?.submitted_by])

    const handleReview = useCallback(
        async (decision) => {
            setSubmitting(true)
            setError('')
            try {
                await MaintenanceService.reviewSubmission(submission.id, decision, reviewNotes)
                if (onSubmitted) onSubmitted({ ...submission, status: decision })
            } catch (err) {
                setError(err?.message || 'Failed to submit review.')
                setSubmitting(false)
            }
        },
        [submission, reviewNotes, onSubmitted]
    )

    return (
        <div className="flex h-full w-full flex-col overflow-y-auto bg-bg-secondary">
            <PageHeader
                accentColor={accentColor}
                dueDate={formatMaintenanceDateShort(submission?.due_date || item?.due_date)}
                label="Form review"
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
                        icon="fa-user-pen"
                        label="Submission"
                        title={`Scanned form · ${submitterName || 'Unknown'}`}
                        sub={`Submitted ${formatMaintenanceDateShort(submission?.submitted_at)} for due date ${formatMaintenanceDateShort(submission?.due_date)}.`}
                    />
                    <PdfEmbed url={pdfUrl} />
                    {submission?.submitter_notes && (
                        <div className="mt-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-light text-text-primary">
                            <div className={`${SECTION_LABEL_CLASS} mb-1 text-text-tertiary`}>Submitter notes</div>
                            {submission.submitter_notes}
                        </div>
                    )}
                </div>

                <div className="rounded p-3" style={CARD_STYLE}>
                    <CardHeader accent={accentColor} icon="fa-clipboard-check" label="Decision" title="Review" />
                    <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Reviewer notes (optional)…"
                        rows={3}
                        className={`${FIELD_INPUT_CLASS} resize-y min-h-[80px]`}
                        style={FIELD_STYLE}
                    />
                    {error && (
                        <div className="mt-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium bg-red-100 border border-red-300 text-text-primary">
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {error}
                        </div>
                    )}
                    <div className="mt-2 flex gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleReview('approved')}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-3 py-1.5 border-none cursor-pointer disabled:opacity-50 bg-green-600"
                        >
                            <i className="fas fa-check text-[10px]" />
                            Approve
                        </button>
                        <button
                            type="button"
                            onClick={() => handleReview('rejected')}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-3 py-1.5 border-none cursor-pointer disabled:opacity-50 bg-red-600"
                        >
                            <i className="fas fa-times text-[10px]" />
                            Reject
                        </button>
                    </div>
                </div>

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
