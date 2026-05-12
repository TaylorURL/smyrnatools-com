/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Refresh button — disables itself while a sync is already in flight
 *  so the user can't queue overlapping fetches. */
function RefreshButton({ isMobile, isSyncing, lastSyncedAt, onRefresh }) {
    const title = lastSyncedAt ? `Last updated ${lastSyncedAt.toLocaleTimeString()}` : 'Refresh schedule'
    return (
        <button
            onClick={() => onRefresh?.()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 disabled:opacity-60 bg-bg-tertiary text-text-secondary"
            title={title}
        >
            <i className={`fas fa-rotate ${isSyncing ? 'fa-spin' : ''}`} />
            {!isMobile && <span>{isSyncing ? 'Syncing…' : 'Refresh'}</span>}
        </button>
    )
}

/** Copy-plan button — flips green for a beat after a successful copy. */
function CopyPlanButton({ copied, isMobile, onCopy }) {
    return (
        <button
            onClick={onCopy}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
            style={{
                backgroundColor: copied ? '#16a34a' : 'var(--bg-tertiary)',
                color: copied ? '#fff' : 'var(--text-secondary)'
            }}
            title="Copy a full plan briefing — assignments, per-plant orders, help routes, send-home and slot recommendations, notes."
        >
            <i className={`fas fa-${copied ? 'check' : 'copy'}`} />
            {!isMobile && <span>{copied ? 'Copied' : 'Copy Plan'}</span>}
        </button>
    )
}

/**
 * Right-aligned action cluster in the Plan header — refresh + copy-plan.
 * Settings now live inline on the Admin tab (gated by `plan.admin`), so
 * the cog button is gone from here.
 */
export function PlanActionButtons({ copied, isMobile, isSchedulesSyncing, onCopy, onRefresh, scheduleLastSyncedAt }) {
    return (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <RefreshButton
                isMobile={isMobile}
                isSyncing={isSchedulesSyncing}
                lastSyncedAt={scheduleLastSyncedAt}
                onRefresh={onRefresh}
            />
            <CopyPlanButton copied={copied} isMobile={isMobile} onCopy={onCopy} />
        </div>
    )
}
