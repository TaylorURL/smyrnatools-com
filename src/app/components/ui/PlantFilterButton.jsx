/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Trigger chip for the plant filter. It only opens the picker; pair it with
 * `PlantDropdownModal`, which does the selecting. Passing `active` alongside
 * an accent tints the chip, so a narrowed list is visible without reading the
 * label.
 */
function PlantFilterButton({
    accentColor,
    active = false,
    displayText,
    isOpen = false,
    onClick,
    title = 'Filter by plant'
}) {
    const tinted = active && accentColor
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={title}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-pressed={!!active}
            title={title}
            className="inline-flex h-9 items-center gap-2 rounded-[4px] px-3 text-[13px] cursor-pointer transition-colors duration-150 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none"
            style={{
                background: tinted ? `${accentColor}12` : 'var(--bg-primary)',
                border: `1px solid ${tinted ? accentColor : 'var(--border-medium)'}`,
                color: 'var(--text-primary)'
            }}
        >
            <i className="fas fa-industry text-[11px] text-text-tertiary" aria-hidden="true" />
            <span className="truncate max-w-[200px]">{displayText}</span>
            <i className="fas fa-chevron-down text-[9px] text-text-tertiary" aria-hidden="true" />
        </button>
    )
}

export default PlantFilterButton
