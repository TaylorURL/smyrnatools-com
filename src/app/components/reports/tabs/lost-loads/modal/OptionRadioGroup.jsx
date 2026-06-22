/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Renders a labelled radio-style group as accent-colored "card" buttons.
 * Used for both the Dump Location and Reason pickers to keep their visuals
 * and selection styling identical without duplicating the markup.
 */
function OptionRadioGroup({ label, required, options, value, onChange, accentColor, columns = 1, children }) {
    const gridClass = columns === 2 ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {label} {required && <span className="text-text-primary">*</span>}
            </label>
            <div className={gridClass}>
                {options.map((option) => {
                    const isSelected = value === option
                    return (
                        <button type="button"
                            key={option}
                            type="button"
                            onClick={() => onChange(option)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors"
                            style={
                                isSelected
                                    ? {
                                          backgroundColor: `${accentColor}10`,
                                          borderColor: accentColor,
                                          color: accentColor
                                      }
                                    : { borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }
                            }
                        >
                            <div
                                className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                style={
                                    isSelected ? { borderColor: accentColor } : { borderColor: 'var(--border-light)' }
                                }
                            >
                                {isSelected && (
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                                )}
                            </div>
                            <span className="font-medium">{option}</span>
                        </button>
                    )
                })}
            </div>
            {children}
        </div>
    )
}

export default OptionRadioGroup
