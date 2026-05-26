import React from 'react'

/** Refresh button — disables itself while a sync is already in flight
 *  so the user can't queue overlapping fetches. */
function RefreshButton({ isMobile, isSyncing, lastSyncedAt, onRefresh }) {
    const title = lastSyncedAt ? `Last updated ${lastSyncedAt.toLocaleTimeString()}` : 'Refresh schedule'
    return (
        <button
            type="button"
            onClick={() => onRefresh?.()}
            disabled={isSyncing}
            aria-label={isSyncing ? 'Syncing' : 'Refresh schedule'}
            title={title}
            className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-2 bg-bg-tertiary text-text-secondary border border-border-light transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
        >
            <i className={`fas fa-rotate ${isSyncing ? 'fa-spin' : ''}`} aria-hidden="true" />
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
