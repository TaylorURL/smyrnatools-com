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

const navItemClass =
    'inline-flex items-center gap-2.5 rounded-md border-none cursor-pointer text-left transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

export function CallListSidebar({ accentColor, activeSection, onSelect, userRoleWeight = 0 }) {
    const sections = visibleCallListSections(userRoleWeight)
    return (
        <aside
            className="hidden md:flex shrink-0 flex-col gap-0.5 sticky top-0 self-start py-2 pr-1 w-[220px]"
            aria-label="Call list sections"
        >
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-3 py-2 text-text-tertiary">
                Call List
            </div>
            {sections.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => onSelect(section.id)}
                        aria-current={active ? 'page' : undefined}
                        title={section.description}
                        className={`${navItemClass} px-3 py-2 ${active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
                        style={active ? { background: `${accentColor}15` } : undefined}
                    >
                        <i className={`fas ${section.icon} text-[12px] w-3.5 text-center`} aria-hidden="true" />
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
            role="tablist"
            aria-label="Call list sections"
        >
            {sections.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        key={section.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onSelect(section.id)}
                        title={section.description}
                        className={`${navItemClass} px-2.5 py-1.5 text-[12px] font-semibold shrink-0 ${active ? 'text-text-primary' : 'text-text-secondary bg-bg-tertiary hover:bg-bg-hover hover:text-text-primary'}`}
                        style={active ? { background: `${accentColor}15` } : undefined}
                    >
                        <i className={`fas ${section.icon} text-[11px]`} aria-hidden="true" />
                        <span>{section.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

export default CallListSidebar
