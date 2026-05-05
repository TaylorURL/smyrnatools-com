import React from 'react'

/**
 * Static dashboard nav layout. Visibility is filtered at render time
 * based on whether the section has any content.
 */
export const DASHBOARD_NAV_SECTIONS = [
    { icon: 'fa-bell', id: 'alerts', label: 'Alerts' },
    { icon: 'fa-calendar-day', id: 'schedule', label: 'Schedule' },
    { icon: 'fa-truck-fast', id: 'fleet', label: 'Fleet' },
    { icon: 'fa-users', id: 'people', label: 'People' },
    { icon: 'fa-file-lines', id: 'reports', label: 'Reports' }
]

/**
 * Scrollspy side nav for the dashboard. Hidden below `lg` breakpoint.
 * Renders one row per section with optional badge count, mirroring the
 * Plan tab's `PlanDashboardSideNav` so the two views feel consistent.
 */
export function DashboardScrollSpyNav({ accent, activeId, alertCount = 0, onJump, peopleCount = 0, sections }) {
    return (
        <aside
            className="hidden lg:block sticky top-0 self-start py-5 pr-3 overflow-y-auto"
            style={{ maxHeight: '100vh', width: 200 }}
        >
            <div
                className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 pb-2"
                style={{ color: 'var(--text-tertiary)' }}
            >
                Sections
            </div>
            <nav className="flex flex-col">
                {sections.map((section) => {
                    const isActive = activeId === section.id
                    let badge = null
                    if (section.id === 'alerts') badge = alertCount
                    else if (section.id === 'people') badge = peopleCount
                    return (
                        <button
                            key={section.id}
                            onClick={() => onJump(section.id)}
                            className="flex items-center gap-2 px-2 py-1.5 border-none cursor-pointer text-[13px] text-left bg-transparent"
                            style={{
                                borderLeft: `2px solid ${isActive ? accent : 'transparent'}`,
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: isActive ? 600 : 400
                            }}
                        >
                            <span className="flex-1 truncate">{section.label}</span>
                            {badge != null && badge > 0 && (
                                <span
                                    className="text-[11px] font-mono tabular-nums"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    {badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </nav>
        </aside>
    )
}
