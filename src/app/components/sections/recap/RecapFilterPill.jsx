/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Toggleable pill button used by the recap modal's date/type filter rows.
 * Active state is themed with the user's accent color.
 */
function RecapFilterPill({ active, label, onClick, accentColor }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded text-[10.5px] font-semibold uppercase tracking-wider px-2 py-1 transition-colors"
            style={{
                background: active ? accentColor : 'var(--bg-secondary)',
                border: active ? `1px solid ${accentColor}` : '1px solid var(--border-light)',
                color: active ? '#fff' : 'var(--text-secondary)'
            }}
        >
            {label}
        </button>
    )
}

export default RecapFilterPill
