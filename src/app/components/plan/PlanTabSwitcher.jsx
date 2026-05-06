import React from 'react'

/** Definition of every Plan tab in the order they appear in the switcher.
 *  Mobile users always land on Schedule — Planner, Dashboard, Demand, and
 *  Statistics depend on wide layouts (zoomable canvas, sticky scrollspy)
 *  that don't fit a phone, so the switcher itself is hidden on mobile and
 *  this list is the desktop-only menu. */
const PLAN_TABS = [
    { icon: 'fa-gauge-high', label: 'Plan Dashboard', mode: 'dashboard' },
    { icon: 'fa-calendar-days', label: 'Schedule', mode: 'schedule' },
    { icon: 'fa-project-diagram', label: 'Planner', mode: 'flow' },
    { icon: 'fa-chart-column', label: 'Demand', mode: 'demand' },
    { icon: 'fa-chart-line', label: 'Statistics', mode: 'statistics' },
    { icon: 'fa-phone-volume', label: 'Call List', mode: 'call-list' }
]

/**
 * Desktop-only tab switcher in the Plan header. Each button highlights
 * with the user's accent color when its tab is active. The current tab is
 * controlled by the parent — this component is purely presentational.
 */
export function PlanTabSwitcher({ accentColor, onChange, viewMode }) {
    return (
        <div
            className="flex items-center rounded-lg p-0.5"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
        >
            {PLAN_TABS.map(({ icon, label, mode }) => {
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
                        <span>{label}</span>
                    </button>
                )
            })}
        </div>
    )
}
