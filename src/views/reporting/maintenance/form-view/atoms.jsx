/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SECTION_LABEL_CLASS } from './constants'

export function CardHeader({ accent, icon, label, sub, title, right }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-7 w-7 items-center justify-center rounded shrink-0 text-text-primary"
                    style={{
                        background: accent ? `${accent}1a` : 'var(--bg-tertiary)'
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

export function PageHeader({
    accentColor: _accentColor,
    dueDate,
    onBack,
    plantCode,
    status,
    statusColor,
    title,
    label
}) {
    return (
        <div className="sticky top-0 z-40 flex items-center gap-2.5 px-3 sm:px-4 py-2 bg-bg-primary border-b border-border-light">
            <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="flex h-7 w-7 items-center justify-center rounded border-none cursor-pointer bg-bg-tertiary text-text-primary"
            >
                <i className="fas fa-arrow-left text-[11px]" />
            </button>
            <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-primary">
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
                        color: 'var(--text-primary)'
                    }}
                >
                    {status}
                </span>
            )}
        </div>
    )
}

export function LoadingShell({ accentColor, label, onBack, title }) {
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

export function PdfEmbed({ url }) {
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
