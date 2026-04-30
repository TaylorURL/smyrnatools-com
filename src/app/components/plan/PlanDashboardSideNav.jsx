import React from 'react'

/** Display labels for the contextual "Your X" nav entry — flips with
 *  the user's scope kind (plant / district / region / dispatch). */
export const YOUR_SECTION_LABELS = {
    dispatch: 'Your Dispatch',
    district: 'Your District',
    plant: 'Your Plant',
    region: 'Your Region'
}

/** Static dashboard nav layout. Visibility is filtered at render time
 *  based on whether the section has any content (insights, compaction,
 *  open windows) or is gated by user scope (`my-plant`). */
export const DASHBOARD_NAV_SECTIONS = [
    { icon: 'fa-chart-line', id: 'overview', label: 'Overview' },
    { icon: 'fa-user-tie', id: 'my-plant', label: 'Your Plant', requiresYourScope: true },
    { icon: 'fa-sticky-note', id: 'notes', label: 'Notes' },
    { icon: 'fa-project-diagram', id: 'flow-preview', label: 'Flow' },
    { icon: 'fa-circle-exclamation', id: 'extra-diligence', label: 'Extra Diligence' },
    { icon: 'fa-clock-rotate-left', id: 'compaction', label: 'Compact Schedule' },
    { icon: 'fa-calendar-plus', id: 'open-windows', label: 'Open Windows' },
    { icon: 'fa-triangle-exclamation', id: 'insights', label: 'Plan Insights' },
    { icon: 'fa-cubes', id: 'yardage', label: 'Yardage by Plant' }
]

/**
 * Scrollspy side nav for the dashboard. Hidden below `lg` breakpoint —
 * the dashboard center column flows to fill the viewport on smaller
 * screens. Renders one row per visible section with its content count
 * as a soft badge.
 */
export function PlanDashboardSideNav({
    accent,
    activeId,
    compactionCount = 0,
    hasInsights,
    hasYourScope,
    onJump,
    openWindowsCount = 0,
    sections,
    specialCount,
    qcCount,
    yourSectionLabel
}) {
    return (
        <aside className="hidden lg:block sticky top-0 self-start py-5 pr-3" style={{ width: 200 }}>
            <nav className="flex flex-col">
                {sections.map((section) => {
                    if (section.requiresYourScope && !hasYourScope) return null
                    if (section.id === 'insights' && !hasInsights) return null
                    if (section.id === 'compaction' && compactionCount === 0) return null
                    if (section.id === 'open-windows' && openWindowsCount === 0) return null
                    const isActive = activeId === section.id
                    let badge = null
                    if (section.id === 'extra-diligence') badge = (specialCount || 0) + (qcCount || 0)
                    else if (section.id === 'compaction') badge = compactionCount
                    else if (section.id === 'open-windows') badge = openWindowsCount
                    const label = section.id === 'my-plant' ? yourSectionLabel || section.label : section.label
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
                            <span className="flex-1 truncate">{label}</span>
                            {badge != null && badge > 0 && (
                                <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
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
