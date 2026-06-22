/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useState } from 'react'

/**
 * Collapsed "+ Add X" chip that expands into a single-field inline form
 * (one labeled text input + Save / Cancel). Enter submits, Escape cancels,
 * and Save is disabled while the request is in flight.
 *
 * Shared by the Accounts "Add prospect" and the account "Add opportunity"
 * flows — same interaction, different copy — so the markup lives in one place.
 *
 * @param {string}   accentColor   - Background color for the Save button.
 * @param {string}   fieldId       - id/htmlFor pair for the input + label.
 * @param {string}   fieldLabel    - Visible label for the input.
 * @param {string}   placeholder   - Input placeholder text.
 * @param {string}   toggleLabel   - Label on the collapsed "+ Add" button.
 * @param {(value: string) => (Promise<unknown> | unknown)} onSubmit - Receives the trimmed value.
 */
export function CrmInlineAddForm({ accentColor, fieldId, fieldLabel, placeholder, toggleLabel, onSubmit }) {
    const [isOpen, setIsOpen] = useState(false)
    const [value, setValue] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const handleCancel = useCallback(() => {
        setIsOpen(false)
        setValue('')
    }, [])

    const handleSave = useCallback(async () => {
        const trimmed = value.trim()
        if (!trimmed || isSaving) return
        setIsSaving(true)
        try {
            await onSubmit(trimmed)
            setIsOpen(false)
            setValue('')
        } finally {
            setIsSaving(false)
        }
    }, [value, isSaving, onSubmit])

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
        },
        [handleSave, handleCancel]
    )

    if (!isOpen) {
        return (
            <button type="button"
                type="button"
                onClick={() => setIsOpen(true)}
                className="self-start inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold border border-border-light bg-bg-secondary text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:text-text-primary hover:border-border-medium"
            >
                <i className="fas fa-plus text-[10px]" aria-hidden="true" />
                {toggleLabel}
            </button>
        )
    }

    return (
        <div className="flex items-center gap-2 flex-wrap rounded-md border border-border-light bg-bg-secondary px-3 py-2">
            <label htmlFor={fieldId} className="text-[11.5px] font-semibold text-text-secondary shrink-0">
                {fieldLabel}
            </label>
            <input
                id={fieldId}
                type="text"
                value={value}
                autoFocus
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-[180px] rounded-md border border-border-light bg-bg-primary px-2.5 py-1 text-[12.5px] text-text-primary placeholder:text-text-tertiary outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
            />
            <button type="button"
                type="button"
                disabled={!value.trim() || isSaving}
                onClick={handleSave}
                className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white transition-[colors,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: accentColor }}
            >
                {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button"
                type="button"
                onClick={handleCancel}
                className="rounded-md px-2.5 py-1 text-[12px] font-semibold border border-border-light bg-transparent text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out hover:text-text-primary"
            >
                Cancel
            </button>
        </div>
    )
}

export default CrmInlineAddForm
