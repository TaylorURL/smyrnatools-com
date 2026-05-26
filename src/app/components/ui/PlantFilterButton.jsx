/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Flat plant-filter trigger button — single source of truth for the
 * "All Plants ▾" / "Plant 70 · Smyrna ▾" chip used across TopSection,
 * ReportsToolbar, PlanRealtimeView, and PlanDemandView. Pair with
 * `PlantDropdownModal` for selection. Goes accent-tinted when a plant is
 * actively selected so the filter state is visible at a glance.
 */
function PlantFilterButton({ accentColor, active = false, displayText, onClick, title = 'Filter by plant' }) {
    const tinted = active && accentColor
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={title}
            title={title}
            className="text-[12px] font-medium cursor-pointer rounded py-1.5 px-2 flex items-center gap-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
            style={{
                background: tinted ? `${accentColor}14` : 'var(--bg-secondary)',
                border: `1px solid ${tinted ? accentColor : 'var(--border-light)'}`,
                color: tinted ? accentColor : 'var(--text-primary)'
            }}
        >
            <span className="truncate max-w-[200px]">{displayText}</span>
            <i
                className="fas fa-chevron-down text-[9px]"
                style={{ color: tinted ? accentColor : 'var(--text-tertiary)' }}
            />
        </button>
    )
}

export default PlantFilterButton
