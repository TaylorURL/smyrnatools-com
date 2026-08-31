import React from 'react'
import ReactDOM from 'react-dom'

export default function DetailViewDeleteModal({ deleteMessage, deleteTitle, onDeleteCancel, onDeleteConfirm, show }) {
    if (!show) return null
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-shell-modal flex items-center justify-center bg-[var(--scrim)] p-5">
            <div className="w-full max-w-[360px] overflow-hidden rounded bg-bg-primary shadow-modal">
                <div className="p-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded bg-[var(--tint-danger-wash)]">
                        <i className="fas fa-trash-alt text-2xl text-text-primary"></i>
                    </div>
                    <h3 className="m-0 mb-1.5 text-lg font-bold text-text-primary">{deleteTitle}</h3>
                    <p className="m-0 text-[13px] text-text-secondary">{deleteMessage}</p>
                </div>
                <div className="flex gap-2.5 border-t border-border-light bg-bg-secondary px-5 py-3.5">
                    <button
                        type="button"
                        className="dv-btn flex-1 rounded-[10px] border-none bg-bg-tertiary px-4 py-2.5 text-[13px] font-semibold text-text-secondary cursor-pointer"
                        onClick={onDeleteCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="dv-btn flex-1 rounded-[10px] border-none bg-[var(--danger)] px-4 py-2.5 text-[13px] font-semibold text-[color:var(--on-accent)] cursor-pointer"
                        onClick={onDeleteConfirm}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
