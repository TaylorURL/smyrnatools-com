/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Section catalogue for the Call List tab. Mirrors the layout pattern
 *  used by the Operations → Statistics tab: a left rail with one entry
 *  per sub-page, plus a mobile-only horizontal scroller fallback. */
export const CALL_LIST_SECTIONS = [
    {
        description: 'Dormant customers due for a cold call, longest dormant first.',
        icon: 'fa-phone-volume',
        id: 'outreach',
        label: 'Outreach Queue'
    },
    {
        description: 'Every call logged by the team, newest first — see who reached out to whom.',
        icon: 'fa-rss',
        id: 'activity',
        label: 'Activity Feed'
    },
    {
        description: 'Full searchable directory of every customer in the dormant pool.',
        icon: 'fa-address-book',
        id: 'directory',
        label: 'Directory'
    },
    {
        description:
            'Monitor team outreach activity — calls logged, bookings closed, and follow-up coverage by caller.',
        // Manager-only side menu — gated to role weight ≥ 31 by `CallListView`.
        icon: 'fa-chart-line',
        id: 'team-monitor',
        label: 'Team Monitor',
        minRoleWeight: 31
    }
]

/** Filter the section list to only entries the caller's role weight
 *  clears. Sections without a `minRoleWeight` are visible to everyone. */
export function visibleCallListSections(userRoleWeight = 0) {
    return CALL_LIST_SECTIONS.filter(
        (section) => !section.minRoleWeight || (userRoleWeight || 0) >= section.minRoleWeight
    )
}

export function CallListSidebar({ accentColor, activeSection, onSelect, userRoleWeight = 0 }) {
    const sections = visibleCallListSections(userRoleWeight)
    return (
        <aside className="hidden md:flex shrink-0 flex-col gap-0.5 sticky top-0 self-start py-2 pr-1 w-[220px]">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-3 py-2 text-text-tertiary">
                Call List
            </div>
            {sections.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        key={section.id}
                        onClick={() => onSelect(section.id)}
                        className="flex items-center gap-2.5 rounded-md border-none cursor-pointer text-left px-3 py-2 transition-colors"
                        style={{
                            background: active ? `${accentColor}15` : 'transparent',
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                        title={section.description}
                    >
                        <i className={`fas ${section.icon} text-[12px] w-3.5 text-center`} />
                        <span className="text-[12.5px] font-semibold truncate">{section.label}</span>
                    </button>
                )
            })}
        </aside>
    )
}

export function CallListSectionTabs({ accentColor, activeSection, onSelect, userRoleWeight = 0 }) {
    const sections = visibleCallListSections(userRoleWeight)
    return (
        <div
            className="md:hidden flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1"
            style={{ scrollbarWidth: 'none' }}
        >
            {sections.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        key={section.id}
                        onClick={() => onSelect(section.id)}
                        className="flex items-center gap-1.5 rounded-md border-none cursor-pointer px-2.5 py-1.5 text-[12px] font-semibold shrink-0"
                        style={{
                            background: active ? `${accentColor}15` : 'var(--bg-tertiary)',
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                        title={section.description}
                    >
                        <i className={`fas ${section.icon} text-[11px]`} />
                        <span>{section.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

export default CallListSidebar
