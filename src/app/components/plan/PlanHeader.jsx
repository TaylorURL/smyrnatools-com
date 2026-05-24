import React from 'react'

import { PlanActionButtons } from './PlanActionButtons'
import { PlanDateNav } from './PlanDateNav'
import { PlanSyncStatusPill } from './PlanSyncStatusPill'
import { PlanTabSwitcher } from './PlanTabSwitcher'

/** Tabs where the global single-day date stepper would conflict with
 *  tab-owned controls (Statistics has its own range picker) or simply
 *  isn't meaningful (Call List + Settings don't operate on a plan date).
 *  On those tabs we either replace the stepper with the tab's own
 *  controls portal (Statistics) or render nothing at all. */
const TABS_WITHOUT_DATE_NAV = new Set(['call-list', 'settings'])

/**
 * Slim sticky header shared by every Plan tab. Composes:
 *
 *   1. Title.
 *   2. Date-control slot — `PlanDateNav` by default, the Statistics
 *      controls bar portaled in when `viewMode === 'statistics'`, or
 *      nothing on Call List / Settings.
 *   3. `PlanActionButtons` — refresh / copy-plan / settings cog.
 *   4. `PlanTabSwitcher` — desktop ladder, or a compact two-tab toggle
 *      (Dashboard + Schedule) on mobile.
 *
 * Wraps on narrow viewports so the action buttons never clip off the
 * right edge.
 */
export function PlanHeader({
    accentColor,
    canSeeSettings = false,
    isDark,
    isMobile,
    isRealtime,
    isSchedulesSyncing,
    onChangeDate,
    onChangeViewMode,
    onRefresh,
    planDate,
    scheduleLastSyncedAt,
    setStatsSlotEl,
    syncStatus = 'idle',
    viewMode
}) {
    const isStatisticsTab = viewMode === 'statistics'
    const hideDateNav = TABS_WITHOUT_DATE_NAV.has(viewMode)
    return (
        <div className="shrink-0 flex items-center flex-nowrap gap-3 border-b px-3 sm:px-4 py-2.5 bg-bg-primary border-border-light overflow-x-auto">
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0 text-text-primary">Plan</h1>
            {isStatisticsTab ? (
                <div ref={setStatsSlotEl} className="flex flex-nowrap items-center gap-2 min-w-0 shrink-0" />
            ) : hideDateNav ? null : (
                <PlanDateNav
                    accentColor={accentColor}
                    isDark={isDark}
                    isRealtime={isRealtime}
                    onChange={onChangeDate}
                    planDate={planDate}
                />
            )}
            {viewMode === 'flow' && <PlanSyncStatusPill status={syncStatus} />}
            <div className="flex-1 min-w-[8px]" />
            <PlanActionButtons
                accentColor={accentColor}
                isMobile={isMobile}
                isSchedulesSyncing={isSchedulesSyncing}
                onRefresh={onRefresh}
                scheduleLastSyncedAt={scheduleLastSyncedAt}
            />
            <PlanTabSwitcher
                accentColor={accentColor}
                canSeeSettings={canSeeSettings}
                isMobile={isMobile}
                onChange={onChangeViewMode}
                viewMode={viewMode}
            />
        </div>
    )
}
