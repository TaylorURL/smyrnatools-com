import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'

/**
 * Icon and confirm-button styling per variant, so the glyph and the button
 * always carry the same semantic. An unrecognised variant falls back to
 * `danger` — the safest default for a dialog whose purpose is unclear.
 */
const VARIANT_CONFIG = {
    danger: {
        confirmButton: 'bg-status-danger text-white hover:bg-status-danger/90 focus-visible:ring-status-danger',
        icon: 'fa-trash-alt',
        iconWrap: 'bg-status-danger/10 text-status-danger'
    },
    default: {
        confirmButton: 'bg-accent text-white hover:bg-accent-hover focus-visible:ring-accent',
        icon: 'fa-question-circle',
        iconWrap: 'bg-accent/10 text-accent'
    },
    warning: {
        confirmButton: 'bg-status-warning text-white hover:bg-status-warning/90 focus-visible:ring-status-warning',
        icon: 'fa-exclamation-triangle',
        iconWrap: 'bg-status-warning/10 text-status-warning'
    }
}

/**
 * Modal confirmation prompt, portalled to `document.body`.
 *
 * While open it binds Escape to cancel and Enter to confirm on the document,
 * so a stray Enter anywhere on the page confirms — including for the danger
 * variant. Callers whose confirm action is destructive and easy to trigger
 * by accident should account for that.
 *
 * @param {boolean} isOpen - Whether the dialog is visible.
 * @param {Function} onConfirm - Called on the confirm button or Enter.
 * @param {Function} onCancel - Called on the cancel button, the backdrop, or Escape.
 * @param {string} [title='Are you sure?'] - Dialog heading, also the dialog's accessible label.
 * @param {string} [message] - Body text explaining what will happen.
 * @param {string} [confirmLabel='Confirm'] - Text for the confirm button.
 * @param {string} [cancelLabel='Cancel'] - Text for the cancel button.
 * @param {'danger'|'warning'|'default'} [variant='danger'] - Selects the icon and confirm-button colour.
 */
function ConfirmDialog({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger'
}) {
    useEffect(() => {
        if (!isOpen) return undefined
        const handleKey = (event) => {
            if (event.key === 'Escape') onCancel?.()
            if (event.key === 'Enter') onConfirm?.()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [isOpen, onCancel, onConfirm])

    if (!isOpen) return null
    const v = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-confirm flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in-fast motion-reduce:animate-none"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className="w-full max-w-sm overflow-hidden rounded-modal bg-bg-secondary border border-border-light shadow-modal animate-pop-in motion-reduce:animate-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex flex-col items-center px-6 pt-7 pb-2">
                    <div
                        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${v.iconWrap}`}
                        aria-hidden="true"
                    >
                        <i className={`fas ${v.icon} text-xl`} />
                    </div>
                    <h3 className="m-0 mb-2 text-center font-heading text-lg font-semibold text-text-primary">
                        {title}
                    </h3>
                    {message && (
                        <p className="m-0 text-center text-sm leading-relaxed text-text-secondary">{message}</p>
                    )}
                </div>
                <div className="flex gap-3 px-6 pt-4 pb-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 cursor-pointer rounded-md border border-border-light bg-bg-tertiary text-text-primary py-3 text-sm font-semibold transition-colors duration-150 hover:bg-bg-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary motion-reduce:transition-none"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 cursor-pointer rounded-md border-0 py-3 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary motion-reduce:transition-none ${v.confirmButton}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default ConfirmDialog
