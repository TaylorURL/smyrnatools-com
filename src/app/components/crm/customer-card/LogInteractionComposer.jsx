/* eslint-disable react/forbid-dom-props */
import { useState } from 'react'

const INTERACTION_TYPES = [
    { icon: 'fa-phone', id: 'call', label: 'Call' },
    { icon: 'fa-location-dot', id: 'site_visit', label: 'Site visit' },
    { icon: 'fa-handshake', id: 'meeting', label: 'Meeting' },
    { icon: 'fa-envelope', id: 'email', label: 'Email' },
    { icon: 'fa-note-sticky', id: 'note', label: 'Note' }
]

const ROLE_LENSES = [
    { id: 'sales', label: 'Sales' },
    { id: 'plant', label: 'Plant' },
    { id: 'dispatch', label: 'Dispatch' },
    { id: 'general', label: 'General' }
]

const activeChipStyle = (accentColor) => ({ background: `${accentColor}1f`, borderColor: accentColor })

const typeChipClass = (active) =>
    `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold border ` +
    `transition-[colors,transform] duration-150 ease-out active:scale-[0.97] ` +
    (active ? 'text-text-primary' : 'border-border-light text-text-secondary hover:text-text-primary')

const lensChipClass = (active) =>
    `rounded-md px-2 py-1 text-[11px] font-semibold border ` +
    `transition-[colors,transform] duration-150 ease-out active:scale-[0.97] ` +
    (active ? 'text-text-primary' : 'border-border-light text-text-secondary hover:text-text-primary')

/** Compact composer for logging one interaction (any type) against an account.
 *  @param {string} accentColor - CSS color applied to the active chip and submit button.
 *  @param {string} [defaultLens='general'] - Pre-selected role lens.
 *  @param {boolean} [isSaving=false] - Disables the submit button and shows "Logging…".
 *  @param {(payload: { interactionType: string, roleLens: string, comment: string|null }) => void} onSubmit */
export function LogInteractionComposer({ accentColor, defaultLens = 'general', isSaving = false, onSubmit }) {
    const [selectedType, setSelectedType] = useState('call')
    const [selectedLens, setSelectedLens] = useState(defaultLens)
    const [comment, setComment] = useState('')

    const handleSubmit = (event) => {
        event.preventDefault()
        onSubmit({
            comment: comment.trim() || null,
            interactionType: selectedType,
            roleLens: selectedLens
        })
        setComment('')
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 rounded-md border border-border-light bg-bg-secondary p-3"
        >
            {/* Interaction type selector */}
            <div className="flex flex-wrap gap-1.5">
                {INTERACTION_TYPES.map((interactionType) => {
                    const isActive = selectedType === interactionType.id
                    return (
                        <button type="button"
                            key={interactionType.id}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setSelectedType(interactionType.id)}
                            className={typeChipClass(isActive)}
                            style={isActive ? activeChipStyle(accentColor) : undefined}
                        >
                            <i className={`fas ${interactionType.icon}`} aria-hidden="true" />
                            {interactionType.label}
                        </button>
                    )
                })}
            </div>

            {/* Role lens selector */}
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Lens</span>
                {ROLE_LENSES.map((lens) => {
                    const isActive = selectedLens === lens.id
                    return (
                        <button type="button"
                            key={lens.id}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setSelectedLens(lens.id)}
                            className={lensChipClass(isActive)}
                            style={isActive ? activeChipStyle(accentColor) : undefined}
                        >
                            {lens.label}
                        </button>
                    )
                })}
            </div>

            {/* Note textarea */}
            <label htmlFor="crm-interaction-note" className="text-[11px] font-semibold text-text-secondary">
                Note
            </label>
            <textarea
                id="crm-interaction-note"
                value={comment}
                rows={3}
                placeholder="What happened? (optional)"
                onChange={(e) => setComment(e.target.value)}
                className="rounded-md border border-border-light bg-bg-primary p-2 text-[13px] text-text-primary placeholder:text-text-tertiary"
            />

            {/* Submit */}
            <div className="flex justify-end">
                <button type="button"
                    type="submit"
                    disabled={isSaving}
                    className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
                    style={{ background: accentColor }}
                >
                    {isSaving ? 'Logging…' : 'Log interaction'}
                </button>
            </div>
        </form>
    )
}
