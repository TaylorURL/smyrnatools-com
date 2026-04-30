import React from 'react'

import { PlanActionButtons } from './PlanActionButtons'
import { PlanDateNav } from './PlanDateNav'
import { PlanTabSwitcher } from './PlanTabSwitcher'

/**
 * Slim sticky header shared by every Plan tab. Composes:
 *
 *   1. Title.
 *   2. `PlanDateNav` — date stepper (or read-only "today" pill on the
 *      realtime tab).
 *   3. `PlanActionButtons` — refresh / copy-plan / settings cog.
 *   4. `PlanTabSwitcher` — desktop-only tab toggle.
 *
 * Wraps on narrow viewports so the action buttons never clip off the
 * right edge. Mobile users get the whole thing without the tab switcher;
 * the parent component handles forcing them onto the Schedule tab.
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
            {!isMobile && <PlanTabSwitcher accentColor={accentColor} onChange={onChangeViewMode} viewMode={viewMode} />}
        </div>
    )
}
