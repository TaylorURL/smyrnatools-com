/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAccentColor } from '../../../app/hooks/useAccentColor'
import MaintenanceService from '../../../services/MaintenanceService'
import { UserService } from '../../../services/UserService'
import { downloadMaintenanceFormPdf } from '../../../utils/MaintenancePdfFormUtility'
import { formatMaintenanceDateShort } from '../../../utils/MaintenanceUtility'

/* ── Plan-tab design tokens (matches the redesigned reports). ────────────── */
const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const FIELD_INPUT_CLASS = 'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90'

function CardHeader({ accent, icon, label, sub, title, right }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-7 w-7 items-center justify-center rounded shrink-0"
                    style={{
                        background: accent ? `${accent}1a` : 'var(--bg-tertiary)',
                        color: accent || 'var(--text-secondary)'
                    }}
                >
                    <i className={`fas ${icon} text-[11.5px]`} />
                </div>
                <div className="min-w-0 flex-1">
                    {label && (
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {label}
                        </div>
                    )}
                    <div className="text-[13px] font-bold leading-tight text-text-primary">{title}</div>
                    {sub && <div className="text-[11px] mt-0.5 text-text-tertiary">{sub}</div>}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    )
}

function PageHeader({ accentColor, dueDate, onBack, plantCode, status, statusColor, title, label }) {
    return (
        <div className="sticky top-0 z-40 flex items-center gap-2.5 px-3 sm:px-4 py-2 bg-bg-primary border-b border-border-light">
            <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="flex h-7 w-7 items-center justify-center rounded border-none cursor-pointer bg-bg-tertiary"
                style={{ color: accentColor }}
            >
                <i className="fas fa-arrow-left text-[11px]" />
            </button>
            <div
                className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                style={{ color: accentColor }}
            >
                <i className="fas fa-file-pdf text-[11px]" />
            </div>
            <div className="min-w-0 flex-1">
                <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </div>
                <div className="text-[12.5px] font-semibold truncate text-text-primary">
                    {title || 'Maintenance Form'}
                </div>
                <div className="text-[10.5px] truncate text-text-tertiary">
                    {[plantCode && `Plant ${plantCode}`, dueDate && `Due ${dueDate}`].filter(Boolean).join('  ·  ')}
                </div>
            </div>
            {status && (
                <span
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
                    style={{
                        background: `${statusColor}1f`,
                        border: `1px solid ${statusColor}55`,
                        color: statusColor
                    }}
                >
                    {status}
                </span>
            )}
        </div>
    )
}

function LoadingShell({ accentColor, label, onBack, title }) {
    return (
        <div className="flex h-full w-full flex-col overflow-y-auto bg-bg-secondary">
            <PageHeader accentColor={accentColor} label={label} onBack={onBack} title={title} />
            <div className="flex-1 flex items-center justify-center gap-2 text-[12.5px] text-text-tertiary">
                <i className="fas fa-circle-notch fa-spin text-[12px]" />
                Loading…
            </div>
        </div>
    )
}

function StatusForSubmission(submission) {
    const status = (submission?.status || '').toLowerCase()
    if (status === 'approved') return { color: '#16a34a', label: 'Approved' }
    if (status === 'rejected') return { color: '#dc2626', label: 'Rejected' }
    if (status === 'submitted') return { color: '#0ea5e9', label: 'Pending Review' }
    if (status === 'draft') return { color: '#d97706', label: 'Draft' }
    return { color: 'var(--text-tertiary)', label: status || 'Unknown' }
}

/* ── PDF preview ─────────────────────────────────────────────────────────── */

function PdfEmbed({ url }) {
    if (!url) {
        return (
            <div className="rounded p-6 text-center text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
                <i className="fas fa-file-pdf text-[18px] block mb-1" />
                No scanned PDF was attached to this submission.
            </div>
        )
    }
    return (
        <div className="rounded overflow-hidden border border-border-light">
            <iframe
                title="Submitted maintenance form"
                src={url}
                className="w-full bg-bg-secondary h-[70vh]"
                style={{ border: 'none', minHeight: 480 }}
            />
            <div className="flex items-center justify-between px-3 py-2 text-[11px] bg-bg-secondary border-t border-border-light">
                <span className="text-text-tertiary">Embedded scan — open in a new tab for full view</span>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-text-secondary"
                >
                    Open <i className="fas fa-external-link-alt text-[10px]" />
                </a>
            </div>
        </div>
    )
}

/* ── Submit mode ─────────────────────────────────────────────────────────── */

function SubmitMode({ accentColor, dueDate, formObj, item, onBack, onSubmitted, plantCode }) {
    const [pdfFile, setPdfFile] = useState(null)
    const [submitterNotes, setSubmitterNotes] = useState('')
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [downloadedAt, setDownloadedAt] = useState(null)
    const fileInputRef = useRef(null)

    const handleDownload = useCallback(() => {
        try {
            // Plant + completion date + submitter are all printed as fillable
            // fields on the PDF itself, so we no longer pass plantCode/dueDate
            // through here — the worker writes them in by hand at the plant
            // they're actually working at.
            downloadMaintenanceFormPdf(formObj, {
                accentColor,
                frequency: formObj?.frequency || ''
            })
            setDownloadedAt(new Date())
        } catch (err) {
            setError(err?.message || 'Failed to generate PDF.')
        }
    }, [accentColor, formObj])

    const handleFile = useCallback((file) => {
        if (!file) return
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
        if (!isPdf) {
            setError('Only PDF scans are supported. Convert images to PDF before uploading.')
            return
        }
        setError('')
        setPdfFile(file)
    }, [])

    const onDrop = useCallback(
        (e) => {
            e.preventDefault()
            const file = e.dataTransfer?.files?.[0]
            if (file) handleFile(file)
        },
        [handleFile]
    )

    const handleSubmit = useCallback(async () => {
        if (!pdfFile) {
            setError('Upload the completed scan before submitting.')
            return
        }
        setSubmitting(true)
        setError('')
        try {
            setUploading(true)
            const url = await MaintenanceService.uploadScannedPdf(pdfFile, formObj.id)
            setUploading(false)
            const submission = await MaintenanceService.submitScannedForm({
                dueDate: dueDate || item?.due_date,
                formId: formObj.id,
                notes: submitterNotes,
                plantCode: plantCode || item?.plant_code || null,
                scannedPdfUrl: url
            })
            setSuccess(true)
            if (onSubmitted) onSubmitted(submission)
        } catch (err) {
            setError(err?.message || 'Failed to submit scanned form.')
        } finally {
            setUploading(false)
            setSubmitting(false)
        }
    }, [pdfFile, formObj, dueDate, item, plantCode, submitterNotes, onSubmitted])

    return (
        <div className="flex h-full w-full flex-col overflow-y-auto bg-bg-secondary">
            <PageHeader
                accentColor={accentColor}
                dueDate={formatMaintenanceDateShort(dueDate || item?.due_date)}
                label="Maintenance form"
                onBack={onBack}
                plantCode={plantCode || item?.plant_code}
                title={formObj?.title}
            />

            <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 py-3 flex flex-col gap-2.5">
                {/* Step 1 — Download */}
                <div className="rounded p-3" style={CARD_STYLE}>
                    <CardHeader
                        accent={accentColor}
                        icon="fa-file-arrow-down"
                        label="Step 1"
                        title="Download blank form"
                        sub="Print the PDF, hand-fill every required field, then scan the completed sheet."
                        right={
                            downloadedAt && (
                                <span className="text-[10.5px] text-green-600">
                                    <i className="fas fa-check mr-1 text-[9px]" />
                                    Downloaded
                                </span>
                            )
                        }
                    />
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 rounded px-3 py-2 text-[12.5px] font-bold uppercase tracking-wider text-white border-none cursor-pointer"
                        style={{ background: accentColor }}
                    >
                        <i className="fas fa-file-pdf text-[12px]" />
                        Download blank PDF
                    </button>
                </div>

                {/* Step 2 — Upload scan */}
                <div className="rounded p-3" style={CARD_STYLE}>
                    <CardHeader
                        accent={accentColor}
                        icon="fa-file-arrow-up"
                        label="Step 2"
                        title="Upload completed scan"
                        sub="Drop a single PDF below or click to browse. The scan must be a PDF — convert images first if needed."
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                        className="w-full rounded p-5 text-center cursor-pointer transition-colors"
                        style={{
                            background: pdfFile ? `${accentColor}10` : 'var(--bg-secondary)',
                            border: `1px dashed ${pdfFile ? accentColor : 'var(--border-medium)'}`,
                            color: pdfFile ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        {pdfFile ? (
                            <div className="flex flex-col items-center gap-1">
                                <i className="fas fa-file-circle-check text-[22px]" style={{ color: accentColor }} />
                                <div className="text-[12.5px] font-semibold">{pdfFile.name}</div>
                                <div className="text-[11px] text-text-tertiary">
                                    {(pdfFile.size / 1024).toFixed(0)} KB · click to replace
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1">
                                <i className="fas fa-cloud-arrow-up text-[22px]" />
                                <div className="text-[12.5px] font-semibold">Click to browse or drag a PDF here</div>
                                <div className="text-[11px] text-text-tertiary">PDF only · single file</div>
                            </div>
                        )}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                        className="hidden"
                    />
                </div>

                {/* Step 3 — Notes + submit */}
                <div className="rounded p-3" style={CARD_STYLE}>
                    <CardHeader
                        accent={accentColor}
                        icon="fa-pen-to-square"
                        label="Step 3"
                        title="Notes & submit"
                        sub="Optional context for the reviewer (issues found, parts ordered, follow-up needed)."
                    />
                    <textarea
                        value={submitterNotes}
                        onChange={(e) => setSubmitterNotes(e.target.value)}
                        placeholder="Anything the reviewer should know about this submission…"
                        rows={4}
                        className={`${FIELD_INPUT_CLASS} resize-y min-h-[88px]`}
                        style={FIELD_STYLE}
                    />
                    {error && (
                        <div className="mt-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium bg-red-100 border border-red-300 text-red-700">
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mt-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium bg-[rgba(22,_163,_74,_0.12)] border border-[rgba(22,_163,_74,_0.45)] text-green-700">
                            <i className="fas fa-check-circle text-[11px]" />
                            Submitted for review.
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !pdfFile}
                        className="mt-2 inline-flex items-center gap-2 rounded px-3 py-2 text-[12.5px] font-bold uppercase tracking-wider text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: accentColor }}
                    >
                        <i className={`fas ${submitting ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'} text-[12px]`} />
                        {uploading ? 'Uploading…' : submitting ? 'Submitting…' : 'Submit for review'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ── Review mode ─────────────────────────────────────────────────────────── */

function ReviewMode({ accentColor, formObj, item, onBack, onSubmitted, submission }) {
    const status = StatusForSubmission(submission)
    const pdfUrl = useMemo(
        () => MaintenanceService.getScannedPdfUrl(submission?.scanned_pdf_url),
        [submission?.scanned_pdf_url]
    )
    const [reviewNotes, setReviewNotes] = useState('')
    const [submitterName, setSubmitterName] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

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

            <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 py-3 flex flex-col gap-2.5">
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
                        <div className="mt-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium bg-red-100 border border-red-300 text-red-700">
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
            </div>
        </div>
    )
}

/* ── View-only mode ──────────────────────────────────────────────────────── */

function ViewOnlyMode({ accentColor, formObj, item, onBack, submission }) {
    const status = StatusForSubmission(submission)
    const pdfUrl = useMemo(
        () => MaintenanceService.getScannedPdfUrl(submission?.scanned_pdf_url),
        [submission?.scanned_pdf_url]
    )
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
            <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 py-3 flex flex-col gap-2.5">
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
            </div>
        </div>
    )
}

/* ── Router ──────────────────────────────────────────────────────────────── */

export default function MaintenanceFormView({ item, onBack, onSubmitted }) {
    const accentColor = useAccentColor()
    const [loading, setLoading] = useState(true)
    const [formObj, setFormObj] = useState(null)
    const [submission, setSubmission] = useState(null)

    const isReview = !!item?.isReview
    const isViewOnly = !!item?.isViewOnly
    const submissionId = item?.submission_id || (isReview || isViewOnly ? item?.id : null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            try {
                let sub = null
                let formId = item?.form_id || item?.maintenance_forms?.id || item?.form?.id || null
                if (submissionId) {
                    sub = await MaintenanceService.fetchSubmissionById(submissionId).catch(() => null)
                    if (sub) formId = formId || sub.form_id || sub.maintenance_forms?.id
                }
                let form = sub?.maintenance_forms || item?.maintenance_forms || item?.form || null
                if (!form && formId) {
                    form = await MaintenanceService.fetchFormById(formId).catch(() => null)
                }
                if (!cancelled) {
                    setSubmission(sub)
                    setFormObj(form)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [item, submissionId])

    if (loading) {
        const label = isReview ? 'Form review' : isViewOnly ? 'Submission' : 'Maintenance form'
        return <LoadingShell accentColor={accentColor} label={label} onBack={onBack} title={formObj?.title} />
    }

    if (isReview) {
        return (
            <ReviewMode
                accentColor={accentColor}
                formObj={formObj}
                item={item}
                onBack={onBack}
                onSubmitted={onSubmitted}
                submission={submission}
            />
        )
    }
    if (isViewOnly) {
        return (
            <ViewOnlyMode
                accentColor={accentColor}
                formObj={formObj}
                item={item}
                onBack={onBack}
                submission={submission}
            />
        )
    }
    return (
        <SubmitMode
            accentColor={accentColor}
            dueDate={item?.due_date}
            formObj={formObj}
            item={item}
            onBack={onBack}
            onSubmitted={onSubmitted}
            plantCode={item?.plant_code}
        />
    )
}
