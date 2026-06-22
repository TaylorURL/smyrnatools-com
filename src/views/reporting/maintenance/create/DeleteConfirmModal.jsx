import React from 'react'
import ReactDOM from 'react-dom'

import { SECTION_LABEL_CLASS } from '../../../../app/constants/maintenanceCreateConstants'
import { SubtleButton } from './atoms'

export function DeleteConfirmModal({ onCancel, onConfirm, saving }) {
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 animate-fade-in-fast"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="w-full max-w-sm rounded-modal overflow-hidden bg-bg-primary border border-border-light shadow-modal animate-pop-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border-light">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0 bg-status-danger/15 text-status-danger">
                        <i className="fas fa-trash text-[12px]" aria-hidden="true" />
                    </div>
                    <span className={`${SECTION_LABEL_CLASS} text-text-secondary`}>Delete Form</span>
                </div>
                <div className="px-4 py-3">
                    <p className="m-0 text-[12.5px] text-text-secondary">
                        Are you sure you want to delete this form? This action cannot be undone.
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 px-3 py-2 bg-bg-secondary border-t border-border-light">
                    <SubtleButton onClick={onCancel}>Cancel</SubtleButton>
                    <button type="button"
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-status-danger px-3 py-2 min-h-[36px] text-[10.5px] font-semibold uppercase tracking-wider text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                    >
                        <i
                            className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-trash'} text-[10px]`}
                            aria-hidden="true"
                        />
                        {saving ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
