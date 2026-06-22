/* eslint-disable react/forbid-dom-props */
import React from 'react'

const OPTIONS = [
    { icon: 'fa-table-list', id: 'list', label: 'List' },
    { icon: 'fa-grip', id: 'cards', label: 'Cards' }
]

/**
 * List / Cards segmented toggle for CRM list views. Matches the Outreach
 * worklist toggle styling (accent-filled active segment). List is the
 * default everywhere; callers persist the choice via `useCrmViewMode`.
 *
 * @param {{ accentColor: string, onChange: (mode: 'list'|'cards') => void, value: string }} props
 */
export function CrmViewToggle({ accentColor, onChange, value }) {
    return (
        <div
            className="inline-flex rounded-md overflow-hidden border border-border-light self-start"
            role="group"
            aria-label="View mode"
        >
            {OPTIONS.map((opt) => {
                const active = value === opt.id
                return (
                    <button type="button"
                        key={opt.id}
                        type="button"
                        onClick={() => onChange(opt.id)}
                        aria-pressed={active}
                        title={`${opt.label} view`}
                        className="flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1.5 border-none cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                        style={{
                            background: active ? accentColor : 'var(--bg-secondary)',
                            color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        <i className={`fas ${opt.icon} text-[11px]`} aria-hidden="true" />
                        <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
