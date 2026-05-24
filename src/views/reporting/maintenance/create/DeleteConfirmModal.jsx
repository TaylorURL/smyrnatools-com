/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SECTION_LABEL_CLASS } from '../../../../app/constants/maintenanceCreateConstants'
import { SubtleButton } from './atoms'

export function DeleteConfirmModal({ onCancel, onConfirm, saving }) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-sm rounded overflow-hidden bg-bg-primary border border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light">
                    <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-red-100 text-text-primary">
                        <i className="fas fa-trash text-[11px]" />
                    </div>
                    <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Delete Form
                    </span>
                </div>
                <div className="px-4 py-3">
                    <p className="m-0 text-[12px] text-text-secondary">
                        Are you sure you want to delete this form? This action cannot be undone.
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 px-3 py-2 bg-bg-secondary border-t border-border-light">
                    <SubtleButton onClick={onCancel}>Cancel</SubtleButton>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600"
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-trash'} text-[10px]`} />
                        {saving ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    )
}
