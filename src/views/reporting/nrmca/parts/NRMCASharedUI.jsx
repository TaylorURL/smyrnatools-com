/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { STATUS_BADGE, STATUS_PILL_CLS } from './nrmcaConstants'

export function StatusBadge({ status }) {
    const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.unknown
    return <span className={`${cfg.cls} ${STATUS_PILL_CLS}`}>{cfg.label}</span>
}

export function Field({ label, children }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
            {children}
        </div>
    )
}

export function Modal({ title, onClose, onSubmit, submitting, children }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="rounded shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto bg-bg-primary border border-border-light">
                <div className="sticky top-0 flex items-center justify-between px-6 py-4 z-10 bg-bg-primary border-b border-border-light">
                    <h2 className="text-base font-bold text-text-primary">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="transition-colors text-text-tertiary"
                        aria-label="Close"
                    >
                        <i className="fas fa-times" />
                    </button>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        onSubmit()
                    }}
                    className="px-6 py-5 flex flex-col gap-4"
                >
                    {children}
                </form>
                <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 bg-bg-primary border-t border-border-light">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold rounded transition-colors bg-bg-secondary border border-border-light text-text-primary"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-semibold rounded text-white disabled:opacity-50 transition-colors bg-[var(--accent)]"
                    >
                        {submitting ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export function IconBtn({ icon, onClick, danger, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="px-2 py-1 text-[10.5px] font-semibold rounded shrink-0 inline-flex items-center justify-center transition-colors bg-bg-secondary border border-border-light"
            style={{ color: danger ? '#dc2626' : 'var(--text-secondary)' }}
            aria-label={title || (danger ? 'Delete' : 'Edit')}
        >
            <i className={`fas ${icon} text-[10px]`} />
        </button>
    )
}
