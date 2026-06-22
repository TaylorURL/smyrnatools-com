/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { normalizeContactDigits } from '../../../../utils/CrmContactsUtility'

/** Single-row editor for a phone-number entry. Used inline for new
 *  numbers and as a per-row swap when editing an existing entry. */
export function ContactEditor({ initial, isSaving, onCancel, onSave }) {
    const [phoneDisplay, setPhoneDisplay] = useState(initial?.phoneDisplay || '')
    const [label, setLabel] = useState(initial?.label || '')
    const [contactName, setContactName] = useState(initial?.contactName || '')
    const [isPrimary, setIsPrimary] = useState(initial?.isPrimary || false)
    const digits = normalizeContactDigits(phoneDisplay)
    const canSave = digits.length >= 7 && !isSaving

    const submit = async () => {
        if (!canSave) return
        await onSave({
            contactName: contactName.trim() || null,
            isPrimary,
            label: label.trim() || null,
            phoneDigits: digits,
            phoneDisplay: phoneDisplay.trim(),
            source: initial?.source || 'manual'
        })
    }

    return (
        <div className="rounded-md p-2.5 bg-bg-secondary border border-border-light flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                    type="tel"
                    value={phoneDisplay}
                    onChange={(e) => setPhoneDisplay(e.target.value)}
                    placeholder="(713) 555-0123"
                    disabled={!!initial}
                    aria-label="Phone number"
                    className="rounded px-2 py-1.5 text-[12.5px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary disabled:opacity-60 font-mono tabular-nums transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                />
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Label (Office, Cell…)"
                    aria-label="Contact label"
                    className="rounded px-2 py-1.5 text-[12.5px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                />
                <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact name"
                    aria-label="Contact name"
                    className="rounded px-2 py-1.5 text-[12.5px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 text-[11.5px] text-text-secondary cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isPrimary}
                        onChange={(e) => setIsPrimary(e.target.checked)}
                        className="cursor-pointer"
                    />
                    Mark as primary
                </label>
                <div className="flex items-center gap-2">
                    <button type="button"
                        onClick={onCancel}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer border-none bg-transparent p-0 text-text-tertiary hover:underline active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                    >
                        Cancel
                    </button>
                    <button type="button"
                        onClick={submit}
                        disabled={!canSave}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold border-none cursor-pointer disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                        style={{
                            background: '#2563eb22',
                            boxShadow: 'inset 0 0 0 1px #2563eb55',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <i className="fas fa-floppy-disk text-[10px]" />
                        {isSaving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}
