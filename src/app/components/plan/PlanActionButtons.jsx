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

/**
 * Right-aligned action cluster in the Plan header. Just the refresh
 * button — Settings live inline on the Admin tab (gated by `plan.admin`),
 * and the manual Review & Send surface has been retired in favour of the
 * scheduled `daily-plan-email` cron.
 */
export function PlanActionButtons({ isMobile, isSchedulesSyncing, onRefresh, scheduleLastSyncedAt }) {
    return (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <RefreshButton
                isMobile={isMobile}
                isSyncing={isSchedulesSyncing}
                lastSyncedAt={scheduleLastSyncedAt}
                onRefresh={onRefresh}
            />
        </div>
    )
}
