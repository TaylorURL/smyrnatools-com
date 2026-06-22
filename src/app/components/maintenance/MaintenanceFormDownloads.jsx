/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { downloadMaintenanceFormPdf } from '../../../utils/MaintenancePdfFormUtility'
import { formatFrequency, formatMaintenanceDate } from '../../../utils/MaintenanceUtility'
import Badge from '../common/Badge'
import { EmptyState } from './MaintenanceFormAtoms'

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

/** Persistent notice explaining the download-only workflow — forms are
 *  printed, completed by hand, and kept on file at the plant. Nothing is
 *  uploaded or submitted back through the app. */
function DownloadNotice({ accentColor }) {
    return (
        <div
            role="note"
            className="flex items-start gap-3 rounded-md border border-border-light bg-bg-primary px-3.5 py-3"
        >
            <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ background: `${accentColor}14`, color: accentColor }}
            >
                <i className="fas fa-print text-[13px]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-text-primary">Forms are download-only</div>
                <p className="m-0 mt-0.5 text-[11.5px] leading-relaxed text-text-secondary">
                    Download and print the form you need, complete it by hand, and keep the finished sheet on file at
                    your plant. Completed forms are no longer uploaded, submitted, or reviewed in Smyrna Tools.
                </p>
            </div>
        </div>
    )
}

/** One downloadable form template — title, frequency, description, and a
 *  full-width download button sized for touch. */
function FormDownloadCard({ accentColor, form }) {
    const [downloaded, setDownloaded] = useState(false)
    const [error, setError] = useState('')

    const fieldCount = form.maintenance_form_fields?.length || 0

    const handleDownload = () => {
        try {
            setError('')
            downloadMaintenanceFormPdf(form, { accentColor, frequency: form?.frequency || '' })
            setDownloaded(true)
        } catch (err) {
            setError(err?.message || 'Failed to generate the PDF.')
        }
    }

    return (
        <div className="flex flex-col gap-2.5 rounded-md border border-border-light bg-bg-primary p-3.5 transition-colors duration-150 hover:border-border-medium motion-reduce:transition-none">
            <div className="flex items-start gap-2.5">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `${accentColor}14`, color: accentColor }}
                >
                    <i className="fas fa-file-pdf text-[14px]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-snug text-text-primary">
                        {form.title || 'Untitled form'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {form.frequency && (
                            <Badge tone="info" size="xs" weight="bold">
                                {formatFrequency(form.frequency, form.frequency_value)}
                            </Badge>
                        )}
                        {downloaded && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-active">
                                <i className="fas fa-check text-[9px]" aria-hidden="true" />
                                Downloaded
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {form.description && (
                <p className="m-0 line-clamp-2 text-[11.5px] leading-relaxed text-text-secondary">{form.description}</p>
            )}

            <div className="flex items-center gap-1.5 text-[10.5px] text-text-tertiary">
                <span className="font-mono tabular-nums">
                    {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
                </span>
                {form.created_at && (
                    <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">Added {formatMaintenanceDate(form.created_at)}</span>
                    </>
                )}
            </div>

            {error && (
                <div
                    className="flex items-center gap-1.5 rounded-md border border-status-danger/30 bg-status-danger/10 px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary"
                    role="alert"
                >
                    <i className="fas fa-exclamation-circle text-[11px] text-status-danger" aria-hidden="true" />
                    {error}
                </div>
            )}

            <button type="button"
                onClick={handleDownload}
                className={`mt-auto inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border-none bg-accent px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition-[background-color,transform] duration-150 ease-out hover:bg-accent-hover active:scale-[0.98] motion-reduce:transition-none ${FOCUS_RING}`}
            >
                <i className="fas fa-file-arrow-down text-[12px]" aria-hidden="true" />
                Download PDF
            </button>
        </div>
    )
}

/** Card-grid skeleton — keeps the notice + grid footprint stable while the
 *  form templates load. */
function DownloadsSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            <div className="h-16 animate-pulse rounded-md bg-bg-tertiary" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2.5 rounded-md border border-border-light bg-bg-primary p-3.5"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 animate-pulse rounded-md bg-bg-tertiary" />
                            <div className="flex-1">
                                <div className="h-3.5 w-2/3 animate-pulse rounded bg-bg-tertiary" />
                                <div className="mt-1.5 h-3 w-1/3 animate-pulse rounded bg-bg-secondary" />
                            </div>
                        </div>
                        <div className="h-3 w-full animate-pulse rounded bg-bg-secondary" />
                        <div className="h-10 w-full animate-pulse rounded-md bg-bg-tertiary" />
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Download-only maintenance form library. Renders the workflow notice and a
 * responsive card grid (1 column on phones, 2 on tablets, 3 on wide
 * desktops) of downloadable form PDFs.
 *
 * @param {string} accentColor Hex accent used for icon tints + the PDF band
 * @param {Array} forms Form templates already filtered by the active search
 * @param {boolean} hasAnyForms Whether any forms exist before search filtering
 * @param {boolean} loading Skeleton state while templates load
 */
export function MaintenanceFormDownloads({ accentColor, forms, hasAnyForms, loading }) {
    if (loading) return <DownloadsSkeleton />

    return (
        <div className="flex flex-col gap-3">
            <DownloadNotice accentColor={accentColor} />
            {forms.length === 0 ? (
                <div className="overflow-hidden rounded-md border border-border-light bg-bg-primary">
                    <EmptyState
                        icon={hasAnyForms ? 'fa-magnifying-glass' : 'fa-folder-open'}
                        title={hasAnyForms ? 'No matching forms' : 'No forms available'}
                        message={
                            hasAnyForms
                                ? 'No forms match your search — try a different term.'
                                : 'Maintenance forms published by your administrators will appear here, ready to download.'
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {forms.map((form) => (
                        <FormDownloadCard key={form.id} accentColor={accentColor} form={form} />
                    ))}
                </div>
            )}
        </div>
    )
}
