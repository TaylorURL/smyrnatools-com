import React from 'react'

/**
 * Inline banner shown above the active Plan tab whenever the signed-in
 * user lacks the `plan.edit` permission. Same styling as the per-plant
 * region warnings — accent-tinted background with a small lock icon — so
 * it reads as informational, not as an error.
 */
export function PlanReadOnlyBanner({ accentColor }) {
    return (
        <div
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium border-b shrink-0"
            style={{
                background: `${accentColor}10`,
                borderColor: 'var(--border-light)',
                color: 'var(--text-secondary)'
            }}
        >
            <i className="fas fa-lock text-[10px]" />
            <span>View only — you need permission to make changes</span>
        </div>
    )
}
