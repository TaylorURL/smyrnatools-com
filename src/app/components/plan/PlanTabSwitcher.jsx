/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Every Plan tab in the order they appear in the desktop switcher.
 *  Find a Spot (`book-order`) is intentionally disabled — its tab entry
 *  is removed and the OperationsView render branch is gone. The
 *  underlying utilities and components stay in the tree so the feature
 *  can be re-enabled later without rebuilding it; the only thing
 *  required to bring it back is reinstating the tab entry here and the
 *  render branch in OperationsView. */
const PLAN_TABS = [
    { icon: 'fa-gauge-high', label: 'Plan Dashboard', mobileLabel: 'Dashboard', mode: 'dashboard' },
    { icon: 'fa-truck-fast', label: 'Ongoing', mobileLabel: 'Ongoing', mode: 'ongoing' },
    { icon: 'fa-calendar-days', label: 'Schedule', mobileLabel: 'Schedule', mode: 'schedule' },
    { icon: 'fa-project-diagram', label: 'Planner', mode: 'flow' },
    { icon: 'fa-chart-column', label: 'Demand', mode: 'demand' },
    { icon: 'fa-chart-line', label: 'Statistics', mobileLabel: 'Stats', mode: 'statistics' },
    { icon: 'fa-sliders', label: 'Settings', mode: 'settings', requiresSettings: true }
]

/** Tabs that survive on a phone. Wide-layout tabs (Planner / Demand /
 *  Call List / Settings) need horizontal real estate that doesn't exist
 *  on mobile, so they're hidden in favour of the focused live-ops
 *  surfaces (Dashboard, Ongoing, Schedule, Statistics) — the views that
 *  render usefully at narrow widths and cover the most frequent
 *  on-the-go workflows. */
const MOBILE_TAB_MODES = new Set(['dashboard', 'ongoing', 'schedule', 'statistics'])

/**
 * Tab toggle in the Plan header. Desktop renders the full ladder; mobile
 * collapses to a compact switcher (Dashboard + Schedule + Statistics) so
 * the header stays tight on a phone. Settings tab only appears when the
 * caller passes `canSeeSettings` — gated by the `plan.settings` permission.
 */
export function PlanTabSwitcher({ accentColor, canSeeSettings = false, isMobile = false, onChange, viewMode }) {
    const tabs = (isMobile ? PLAN_TABS.filter((t) => MOBILE_TAB_MODES.has(t.mode)) : PLAN_TABS).filter(
        (t) => !t.requiresSettings || canSeeSettings
    )
    return (
        <div
            role="tablist"
            aria-label="Plan view"
            className="flex items-center rounded-lg p-0.5 bg-bg-tertiary border border-border-light"
        >
            {tabs.map(({ icon, label, mobileLabel, mode }) => {
                const isActive = viewMode === mode
                return (
                    <button type="button"
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(mode)}
                        className={`inline-flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-tertiary ${
                            isActive
                                ? 'text-white shadow-sm'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                        style={isActive ? { backgroundColor: accentColor } : undefined}
                    >
                        <i className={`fas ${icon}`} aria-hidden="true" />
                        <span>{isMobile ? mobileLabel || label : label}</span>
                    </button>
                )
            })}
        </div>
    )
}
