/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useRef, useState } from 'react'

import { CARD_STYLE, FIELD_INPUT_CLASS, FIELD_STYLE } from '../../../../app/constants/maintenanceFormConstants'
import { useSubmissionHistory } from '../../../../app/hooks/useSubmissionHistory'
import MaintenanceService from '../../../../services/MaintenanceService'
import { downloadMaintenanceFormPdf } from '../../../../utils/MaintenancePdfFormUtility'
import { formatMaintenanceDateShort } from '../../../../utils/MaintenanceUtility'
import { CardHeader, PageHeader } from './atoms'
import { SubmissionHistoryCard } from './SubmissionHistoryCard'

export function SubmitMode({ accentColor, dueDate, formObj, item, onBack, onSubmitted, plantCode }) {
    const [pdfFile, setPdfFile] = useState(null)
    const [submitterNotes, setSubmitterNotes] = useState('')
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [downloadedAt, setDownloadedAt] = useState(null)
    const [historyExpanded, setHistoryExpanded] = useState(false)
    const { history, loading: historyLoading, refresh: refreshHistory } = useSubmissionHistory(formObj?.id)
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
            setPdfFile(null)
            setSubmitterNotes('')
            // Pull the updated history so the new row appears at the top of
            // the "Submission history" card without forcing a full reload.
            refreshHistory()
            if (onSubmitted) onSubmitted(submission)
        } catch (err) {
            setError(err?.message || 'Failed to submit scanned form.')
        } finally {
            setUploading(false)
            setSubmitting(false)
        }
    }, [pdfFile, formObj, dueDate, item, plantCode, submitterNotes, onSubmitted, refreshHistory])

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

            <div className="w-full px-3 sm:px-4 py-3 flex flex-col gap-2.5">
                {/* Submission history — every prior upload for this form, newest first. */}
                <SubmissionHistoryCard
                    accentColor={accentColor}
                    expanded={historyExpanded}
                    history={history}
                    loading={historyLoading}
                    onToggleExpanded={() => setHistoryExpanded((prev) => !prev)}
                />

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
                                <span className="text-[10.5px] text-text-primary">
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
                                <i className="fas fa-file-circle-check text-[22px] text-text-primary" />
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
                    {success && (
                        <div
                            className="mt-2 flex items-center gap-1.5 rounded-md border border-status-active/30 bg-status-active/10 px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary animate-fade-slide-in"
                            role="status"
                        >
                            <i className="fas fa-check-circle text-[11px] text-status-active" aria-hidden="true" />
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
