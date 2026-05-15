/* eslint-disable react/forbid-dom-props */
import React from 'react'
import ReactDOM from 'react-dom'

import { useAccentColor } from '../../hooks/useAccentColor'

/**
 * Styled confirmation dialog rendered as a portal overlay.
 * Replaces native window.confirm() with a themed modal.
 *
 * @param {boolean} isOpen - Whether the dialog is visible.
 * @param {Function} onConfirm - Called when the user confirms.
 * @param {Function} onCancel - Called when the user cancels or clicks the backdrop.
 * @param {string} [title='Are you sure?'] - Dialog heading.
 * @param {string} [message] - Body text explaining what will happen.
 * @param {string} [confirmLabel='Confirm'] - Text for the confirm button.
 * @param {string} [cancelLabel='Cancel'] - Text for the cancel button.
 * @param {'danger'|'warning'|'default'} [variant='danger'] - Controls confirm button color.
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
    const accentColor = useAccentColor()
    if (!isOpen) return null
    const variantStyles = {
        danger: {
            bg: '#ef4444',
            icon: 'fa-trash-alt',
            iconBg: 'rgba(239,68,68,0.1)',
            iconColor: '#ef4444'
        },
        default: {
            bg: accentColor,
            icon: 'fa-question-circle',
            iconBg: `${accentColor}15`,
            iconColor: accentColor
        },
        warning: {
            bg: '#f59e0b',
            icon: 'fa-exclamation-triangle',
            iconBg: 'rgba(245,158,11,0.1)',
            iconColor: '#f59e0b'
        }
    }
    const v = variantStyles[variant] || variantStyles.danger
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-[380px] overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] animate-confirm-slide-in bg-bg-primary border border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center px-6 pt-7 pb-2">
                    <div
                        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ background: v.iconBg }}
                    >
                        <i className={`fas ${v.icon} text-xl`} style={{ color: v.iconColor }} />
                    </div>
                    <h3 className="m-0 mb-2 text-center text-lg font-bold text-text-primary">{title}</h3>
                    {message && (
                        <p className="m-0 text-center text-sm leading-relaxed text-text-secondary">{message}</p>
                    )}
                </div>
                <div className="flex gap-3 px-6 pt-4 pb-6">
                    <button
                        onClick={onCancel}
                        className="flex-1 cursor-pointer rounded-xl border py-3 text-sm font-semibold transition-colors duration-150 hover:brightness-95 bg-bg-secondary border-border-light text-text-primary"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 cursor-pointer rounded-xl border-none py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                        style={{ background: v.bg }}
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
