/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
    CARD_STYLE,
    FIELD_INPUT_CLASS,
    FIELD_STYLE,
    SECTION_LABEL_CLASS
} from '../../../../app/constants/maintenanceFormConstants'
import { useSubmissionHistory } from '../../../../app/hooks/useSubmissionHistory'
import MaintenanceService from '../../../../services/MaintenanceService'
import { UserService } from '../../../../services/UserService'
import { formatMaintenanceDateShort } from '../../../../utils/MaintenanceUtility'
import { CardHeader, PageHeader, PdfEmbed } from './atoms'
import { statusForSubmission } from './helpers'
import { SubmissionHistoryCard } from './SubmissionHistoryCard'

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
                statusTone={status.tone}
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
                        <div
                            className="mt-2 flex items-center gap-1.5 rounded-md border border-status-danger/30 bg-status-danger/10 px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary animate-fade-slide-in"
                            role="alert"
                        >
                            <i
                                className="fas fa-exclamation-circle text-[11px] text-status-danger"
                                aria-hidden="true"
                            />
                            {error}
                        </div>
                    )}
                    <div className="mt-2 flex gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleReview('approved')}
                            disabled={submitting}
                            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-md bg-status-active px-3 py-2.5 min-h-[40px] text-[11.5px] font-bold uppercase tracking-wider text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-active focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                        >
                            <i className="fas fa-check text-[10px]" aria-hidden="true" />
                            Approve
                        </button>
                        <button
                            type="button"
                            onClick={() => handleReview('rejected')}
                            disabled={submitting}
                            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-md bg-status-danger px-3 py-2.5 min-h-[40px] text-[11.5px] font-bold uppercase tracking-wider text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                        >
                            <i className="fas fa-times text-[10px]" aria-hidden="true" />
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
