import React from 'react'

/** Refresh button — disables itself while a sync is already in flight
 *  so the user can't queue overlapping fetches. */
function RefreshButton({ isMobile, isSyncing, lastSyncedAt, onRefresh }) {
    const title = lastSyncedAt ? `Last updated ${lastSyncedAt.toLocaleTimeString()}` : 'Refresh schedule'
    return (
        <button
            onClick={() => onRefresh?.()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 disabled:opacity-60"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
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

/** Settings cog — only renders for users with edit permission. The active
 *  state is wired to the panel's open/closed flag so the button reads as
 *  a toggle. */
function SettingsButton({ accentColor, onToggle, showSettings }) {
    return (
        <button
            onClick={onToggle}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
            style={{
                backgroundColor: showSettings ? accentColor : 'var(--bg-tertiary)',
                color: showSettings ? '#fff' : 'var(--text-secondary)'
            }}
            title="Travel time settings"
        >
            <i className="fas fa-cog" />
        </button>
    )
}

/**
 * Right-aligned action cluster in the Plan header — refresh, copy-plan,
 * and the settings cog (edit-only). The cluster collapses to icons on
 * mobile so the tab switcher beside it doesn't overflow.
 */
export function PlanActionButtons({
    accentColor,
    canEdit,
    copied,
    isMobile,
    isSchedulesSyncing,
    onCopy,
    onRefresh,
    onToggleSettings,
    scheduleLastSyncedAt,
    showSettings
}) {
    return (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <RefreshButton
                isMobile={isMobile}
                isSyncing={isSchedulesSyncing}
                lastSyncedAt={scheduleLastSyncedAt}
                onRefresh={onRefresh}
            />
            <CopyPlanButton copied={copied} isMobile={isMobile} onCopy={onCopy} />
            {canEdit && (
                <SettingsButton accentColor={accentColor} onToggle={onToggleSettings} showSettings={showSettings} />
            )}
        </div>
    )
}
