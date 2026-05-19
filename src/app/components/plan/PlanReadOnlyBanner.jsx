/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Inline banner shown above the active Plan tab whenever edits are
 * disabled. Two reasons land here today:
 *   - `permission` (default) — the user lacks `plan.edit`.
 *   - `past-day` — every user is blocked from editing yesterday's
 *     plan and earlier; the plan is preserved as a historical record.
 *
 * Same styling as the per-plant region warnings — accent-tinted
 * background with a small lock icon — so it reads as informational,
 * not as an error.
 */
export function PlanReadOnlyBanner({ accentColor, reason = 'permission' }) {
    const message =
        reason === 'past-day'
            ? 'View only — past plans cannot be edited. Switch to today or a future date to make changes.'
            : 'View only — you need permission to make changes'
    return (
        <div
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium border-b shrink-0 border-border-light text-text-secondary"
            style={{ background: `${accentColor}10` }}
        >
            <i className="fas fa-lock text-[10px]" />
            <span>{message}</span>
        </div>
    )
}
