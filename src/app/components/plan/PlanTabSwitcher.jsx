/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Every Plan tab in the order they appear in the desktop switcher. */
const PLAN_TABS = [
    { icon: 'fa-gauge-high', label: 'Plan Dashboard', mobileLabel: 'Dashboard', mode: 'dashboard' },
    { icon: 'fa-calendar-days', label: 'Schedule', mobileLabel: 'Schedule', mode: 'schedule' },
    { icon: 'fa-project-diagram', label: 'Planner', mode: 'flow' },
    { icon: 'fa-chart-column', label: 'Demand', mode: 'demand' },
    { icon: 'fa-chart-line', label: 'Statistics', mode: 'statistics' },
    { icon: 'fa-phone-volume', label: 'Call List', mode: 'call-list' },
    { icon: 'fa-clipboard-list', label: 'Find a Spot', mode: 'book-order' },
    { icon: 'fa-sliders', label: 'Settings', mode: 'settings', requiresSettings: true }
]

/** Tabs that survive on a phone. Wide-layout tabs (Planner / Demand /
 *  Statistics / Call List / Find a Spot / Settings) need horizontal real
 *  estate that doesn't exist on mobile, so they're hidden in favour of
 *  Dashboard + Schedule — the two surfaces that already render usefully
 *  at narrow widths and cover the most frequent on-the-go workflows. */
const MOBILE_TAB_MODES = new Set(['dashboard', 'schedule'])

/**
 * Tab toggle in the Plan header. Desktop renders the full ladder; mobile
 * collapses to a compact two-tab switcher (Dashboard + Schedule) so the
 * header stays single-line on a phone. Settings tab only appears when the
 * caller passes `canSeeSettings` — gated by the `plan.settings` permission.
 */
export function PlanTabSwitcher({ accentColor, canSeeSettings = false, isMobile = false, onChange, viewMode }) {
    const tabs = (isMobile ? PLAN_TABS.filter((t) => MOBILE_TAB_MODES.has(t.mode)) : PLAN_TABS).filter(
        (t) => !t.requiresSettings || canSeeSettings
    )
    return (
        <div className="flex items-center rounded-lg p-0.5 bg-bg-tertiary border border-border-light">
            {tabs.map(({ icon, label, mobileLabel, mode }) => {
                const isActive = viewMode === mode
                return (
                    <button
                        key={mode}
                        onClick={() => onChange(mode)}
                        className="flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5"
                        style={{
                            backgroundColor: isActive ? accentColor : 'transparent',
                            color: isActive ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        <i className={`fas ${icon}`} />
                        <span>{isMobile ? mobileLabel || label : label}</span>
                    </button>
                )
            })}
        </div>
    )
}
