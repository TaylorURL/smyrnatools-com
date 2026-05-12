/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Section catalogue for the Statistics tab. Each entry maps to a sub-page
 * rendered in the right pane when its `id` matches the active section. The
 * order here is also the order shown in the side menu.
 */
export const PLAN_STATS_SECTIONS = [
    {
        description: 'Headline KPIs + a snapshot of every other section.',
        icon: 'fa-gauge-high',
        id: 'overview',
        label: 'Overview'
    },
    {
        description: 'Daily trend, day-of-week shape, and yardage by plant.',
        icon: 'fa-cubes-stacked',
        id: 'yardage',
        label: 'Yardage'
    },
    {
        description: 'Short / medium / long-term horizons, plant comparison, year-over-year.',
        icon: 'fa-face-smile',
        id: 'satisfaction',
        label: 'Customer satisfaction'
    },
    {
        description: 'Per-plant scorecards, share of yardage, utilization status.',
        icon: 'fa-industry',
        id: 'plants',
        label: 'Plants'
    },
    {
        description: 'Top customers, product mix, concentration risk.',
        icon: 'fa-handshake',
        id: 'customers',
        label: 'Customers & products'
    },
    {
        description: 'Large pours that need early coordination.',
        icon: 'fa-truck-monster',
        id: 'bigPours',
        label: 'Big pours'
    }
]

/**
 * Left-rail navigation for the Statistics tab. Lifts each sub-page into its
 * own destination so the right pane stays focused — every section has its
 * own dedicated layout instead of a single combined wall of panels.
 */
export function PlanStatisticsSidebar({ accentColor, activeSection, onSelect }) {
    return (
        <aside className="hidden md:flex shrink-0 flex-col gap-0.5 sticky top-0 self-start py-2 pr-1 w-[220px]">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-3 py-2 text-text-tertiary">
                Statistics
            </div>
            {PLAN_STATS_SECTIONS.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        key={section.id}
                        onClick={() => onSelect(section.id)}
                        className="flex items-center gap-2.5 rounded-md border-none cursor-pointer text-left px-3 py-2 transition-colors"
                        style={{
                            background: active ? `${accentColor}15` : 'transparent',
                            color: active ? accentColor : 'var(--text-secondary)'
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

/**
 * Mobile-only horizontal scroller alternative to the sidebar — keeps every
 * section reachable when the layout collapses below the md breakpoint.
 */
export function PlanStatisticsSectionTabs({ accentColor, activeSection, onSelect }) {
    return (
        <div
            className="md:hidden flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1"
            style={{ scrollbarWidth: 'none' }}
        >
            {PLAN_STATS_SECTIONS.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        key={section.id}
                        onClick={() => onSelect(section.id)}
                        className="flex items-center gap-1.5 rounded-md border-none cursor-pointer px-2.5 py-1.5 text-[12px] font-semibold shrink-0"
                        style={{
                            background: active ? `${accentColor}15` : 'var(--bg-tertiary)',
                            color: active ? accentColor : 'var(--text-secondary)'
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

export default PlanStatisticsSidebar
