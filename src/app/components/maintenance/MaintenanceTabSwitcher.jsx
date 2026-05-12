/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Plan-tab inspired switcher for the Maintenance view. Mirrors
 * `PlanTabSwitcher` so both surfaces share the same pill-segment chrome —
 * accent-tinted active button, ghost idle state, optional badge for counts
 * (Recurring Forms due, Review queue length).
 */
export function MaintenanceTabSwitcher({ accentColor, activeTab, isMobile, onChange, tabs }) {
    if (!Array.isArray(tabs) || tabs.length <= 1) return null
    return (
        <div
            className="flex items-center rounded-lg p-0.5 overflow-x-auto bg-bg-tertiary border border-border-light"
            role="tablist"
            aria-label="Maintenance sections"
        >
            {tabs.map(({ badge, icon, key, label }) => {
                const isActive = activeTab === key
                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(key)}
                        className="flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 whitespace-nowrap transition-colors"
                        style={{
                            backgroundColor: isActive ? accentColor : 'transparent',
                            color: isActive ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        {icon && <i className={`fas ${icon}`} />}
                        {!isMobile && <span>{label}</span>}
                        {badge != null && badge > 0 && (
                            <span
                                className="font-mono tabular-nums rounded px-1 text-[9.5px] font-bold uppercase tracking-wider text-white"
                                style={{ background: isActive ? 'rgba(255,255,255,0.25)' : '#dc2626' }}
                            >
                                {badge}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
