import React from 'react'

import { PlanActionButtons } from './PlanActionButtons'
import { PlanDateNav } from './PlanDateNav'
import { PlanTabSwitcher } from './PlanTabSwitcher'

/**
 * Slim sticky header shared by every Plan tab. Composes:
 *
 *   1. Title.
 *   2. `PlanDateNav` — date stepper (or read-only "today" pill on the
 *      realtime tab). On the Statistics tab the stepper is grayed out
 *      because the tab owns its own date range + custom-tab picker.
 *   3. `PlanActionButtons` — refresh / copy-plan / settings cog.
 *   4. `PlanTabSwitcher` — desktop ladder, or a compact two-tab toggle
 *      (Dashboard + Schedule) on mobile.
 *
 * Wraps on narrow viewports so the action buttons never clip off the
 * right edge.
 */
export function PlanHeader({
    accentColor,
    canEdit,
    copied,
    isDark,
    isMobile,
    isRealtime,
    isSchedulesSyncing,
    onChangeDate,
    onChangeViewMode,
    onCopyPlan,
    onRefresh,
    onToggleSettings,
    planDate,
    scheduleLastSyncedAt,
    showSettings,
    viewMode
}) {
    /** Statistics manages its own from/to range + range-mode tab — the
     *  Plan-wide single-day stepper would conflict, so it's locked here. */
    const isStatisticsTab = viewMode === 'statistics'
    return (
        <div
            className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
        >
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0" style={{ color: 'var(--text-primary)' }}>
                Plan
            </h1>
            <PlanDateNav
                accentColor={accentColor}
                disabled={isStatisticsTab}
                disabledReason={
                    isStatisticsTab ? 'Statistics uses its own date range — pick the window inside the tab' : undefined
                }
                isDark={isDark}
                isRealtime={isRealtime}
                onChange={onChangeDate}
                planDate={planDate}
            />
            <div className="flex-1 min-w-[8px]" />
            <PlanActionButtons
                accentColor={accentColor}
                canEdit={canEdit}
                copied={copied}
                isMobile={isMobile}
                isSchedulesSyncing={isSchedulesSyncing}
                onCopy={onCopyPlan}
                onRefresh={onRefresh}
                onToggleSettings={onToggleSettings}
                scheduleLastSyncedAt={scheduleLastSyncedAt}
                showSettings={showSettings}
            />
            <PlanTabSwitcher
                accentColor={accentColor}
                isMobile={isMobile}
                onChange={onChangeViewMode}
                viewMode={viewMode}
            />
        </div>
    )
}
