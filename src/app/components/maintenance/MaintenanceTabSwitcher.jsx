import React from 'react'

import Badge from '../common/Badge'

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

/**
 * Plan-tab inspired switcher for the Maintenance view. Mirrors
 * `PlanTabSwitcher` so both surfaces share the same pill-segment chrome —
 * accent-tinted active button, ghost idle state, optional badge for counts
 * (Recurring Forms due, Review queue length).
 */
export function MaintenanceTabSwitcher({ activeTab, isMobile, onChange, tabs }) {
    if (!Array.isArray(tabs) || tabs.length <= 1) return null
    return (
        <div
            className="flex items-center rounded-md p-0.5 overflow-x-auto bg-bg-tertiary border border-border-light"
            role="tablist"
            aria-label="Maintenance sections"
        >
            {tabs.map(({ badge, icon, key, label }) => {
                const isActive = activeTab === key
                return (
                    <button type="button"
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(key)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none ${FOCUS_RING} ${
                            isActive
                                ? 'bg-accent text-white shadow-sm'
                                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                    >
                        {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
                        {!isMobile && <span>{label}</span>}
                        {badge != null && badge > 0 && (
                            <Badge
                                tone="danger"
                                variant={isActive ? 'custom' : 'solid'}
                                bg={isActive ? 'rgba(255,255,255,0.25)' : undefined}
                                fg={isActive ? '#fff' : undefined}
                                size="xs"
                                shape="rounded"
                                weight="bold"
                                className="font-mono tabular-nums"
                            >
                                {badge}
                            </Badge>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
