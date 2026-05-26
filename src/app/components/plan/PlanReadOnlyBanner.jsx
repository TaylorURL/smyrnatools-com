import React from 'react'

/**
 * Inline banner shown above the active Plan tab whenever edits are
 * disabled. Two reasons land here today:
 *   - `permission` (default) — the user lacks `plan.edit`.
 *   - `past-day` — every user is blocked from editing yesterday's
 *     plan and earlier; the plan is preserved as a historical record.
 *
 * Accent-tinted background with a small lock icon — reads as
 * informational, not as an error.
 */
export function PlanReadOnlyBanner({ reason = 'permission' }) {
    const message =
        reason === 'past-day'
            ? 'View only — past plans cannot be edited. Switch to today or a future date to make changes.'
            : 'View only — you need permission to make changes'
    return (
        <div
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium border-b shrink-0 border-l-4 bg-accent/5 border-l-accent border-border-light text-text-secondary animate-fade-slide-in"
            role="status"
        >
            <i className="fas fa-lock text-[10px] text-accent" aria-hidden="true" />
            <span>{message}</span>
        </div>
    )
}
