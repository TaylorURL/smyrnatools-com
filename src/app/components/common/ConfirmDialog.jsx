import React, { useCallback, useEffect, useRef } from 'react'

import Dialog from '../ui/Dialog'

/**
 * Confirm-button class per variant. A destructive prompt confirms with the
 * red outline; anything else confirms with the primary button. An
 * unrecognised variant falls back to `danger`, the safest default for a
 * dialog whose purpose is unclear.
 */
const CONFIRM_BUTTON = {
    danger: 'btn-danger',
    default: 'btn-primary',
    warning: 'btn-primary'
}

/**
 * Modal confirmation prompt on the shared dialog shell, stacked above every
 * other layer (`z-confirm`) so it can sit on top of an open dialog.
 *
 * Escape, the scrim and the close button cancel. While open, Enter confirms
 * from anywhere on the page except a focused control, which answers Enter
 * itself — so Enter on Cancel cancels, and Enter on Confirm confirms once.
 * This applies to the danger variant too; callers whose confirm action is
 * destructive and easy to trigger by accident should account for that.
 *
 * @param {boolean} isOpen - Whether the dialog is visible.
 * @param {Function} onConfirm - Called on the confirm button or Enter.
 * @param {Function} onCancel - Called on the cancel button, the scrim, the close button or Escape.
 * @param {string} [title='Are you sure?'] - Dialog heading, also the dialog's accessible label.
 * @param {string} [message] - Body text explaining what will happen.
 * @param {string} [confirmLabel='Confirm'] - Text for the confirm button.
 * @param {string} [cancelLabel='Cancel'] - Text for the cancel button.
 * @param {'danger'|'warning'|'default'} [variant='danger'] - Selects the confirm button.
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
    // Callers hand in inline handlers. The dialog re-runs its focus handling
    // whenever `onClose` changes, so it gets one stable cancel that calls the
    // latest prop.
    const onCancelRef = useRef(onCancel)
    useEffect(() => {
        onCancelRef.current = onCancel
    })
    const handleCancel = useCallback(() => onCancelRef.current?.(), [])

    useEffect(() => {
        if (!isOpen) return undefined
        const handleKey = (event) => {
            if (event.key !== 'Enter') return
            if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return
            onConfirm?.()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [isOpen, onConfirm])

    return (
        <Dialog
            open={isOpen}
            onClose={handleCancel}
            size="sm"
            title={title}
            zClassName="z-confirm"
            // With no message the empty body collapses and the footer's rule
            // sits on the header's, so the two read as one line.
            bodyClassName={message ? undefined : '-mt-px p-0'}
            footer={
                <>
                    <button type="button" onClick={handleCancel} className="btn-secondary">
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={CONFIRM_BUTTON[variant] || CONFIRM_BUTTON.danger}
                    >
                        {confirmLabel}
                    </button>
                </>
            }
        >
            {message && <p className="m-0 text-[13px] leading-relaxed text-text-secondary">{message}</p>}
        </Dialog>
    )
}

export default ConfirmDialog
