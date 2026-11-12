import React, { useId } from 'react'

import { NOTE_EXPIRY_MONTHS } from '../../../../utils/StaleNoteUtility'

/**
 * The create form's "keep this one" switch. It belongs to the note being
 * written and nothing else: the form resets it after every post, and a note
 * already posted has no switch, because whether it is kept is settled the
 * moment it is written. `noun` is "comment" or "issue".
 */
export default function KeepPermanentSwitch({ checked, disabled = false, noun, onChange }) {
    const hintId = useId()
    return (
        <label
            className={`flex min-w-0 flex-1 items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-describedby={hintId}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border-none p-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary disabled:cursor-not-allowed motion-reduce:transition-none ${
                    checked ? 'bg-accent' : 'bg-border-medium'
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-[left] duration-150 motion-reduce:transition-none ${
                        checked ? 'left-4' : 'left-0.5'
                    }`}
                />
            </button>
            <span className="flex min-w-0 flex-col gap-px">
                <span className="text-[13px] font-medium text-text-primary">Keep this {noun} permanently</span>
                <span id={hintId} className={`text-[12px] ${checked ? 'text-accent' : 'text-text-tertiary'}`}>
                    {checked
                        ? `On: this ${noun} is never auto-deleted`
                        : `Off: deleted automatically after ${NOTE_EXPIRY_MONTHS} months`}
                </span>
            </span>
        </label>
    )
}
