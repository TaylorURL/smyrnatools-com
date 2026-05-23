/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

/**
 * Section catalogue for the Statistics tab. Each entry maps to a sub-page
 * rendered in the right pane when its `id` matches the active section.
 * Kept as a flat array so `PlanStatisticsView` can still `.find()` the
 * active section's meta by id. The visual grouping is layered on top via
 * `PLAN_STATS_GROUPS` below — the catalogue itself stays grouping-agnostic
 * so the same sections can be reordered or re-grouped without touching
 * any view-side code.
 */
export const PLAN_STATS_SECTIONS = [
    {
        description: 'Headline KPIs + a snapshot of every other section.',
        icon: 'fa-gauge-high',
        id: 'overview',
        label: 'Overview'
    },
    {
        description: 'Per-plant scorecards, daily yardage trend, and day-of-week shape.',
        icon: 'fa-industry',
        id: 'production',
        label: 'Production'
    },
    {
        description: 'Load counts per operator across the selected window.',
        icon: 'fa-id-badge',
        id: 'operators',
        label: 'Operators Loads'
    },
    {
        description: 'Planned deadhead trips and actual cross-plant loading.',
        icon: 'fa-arrows-rotate',
        id: 'helpCrossLoading',
        label: 'Help & Cross-Loading'
    },
    {
        description:
            'Good vs. bad customer experience — late starts, slow pours, and where service is winning or slipping.',
        icon: 'fa-thumbs-up',
        id: 'service',
        label: 'Service'
    },
    {
        description: 'Search any customer to see every job they had — scheduled time, plant, and verdict.',
        icon: 'fa-magnifying-glass',
        id: 'customerLookup',
        label: 'Service Lookup'
    },
    {
        description: 'Pull up a single ticket — see its order, coverage, flags, and the full ticket list around it.',
        icon: 'fa-receipt',
        id: 'ticketLookup',
        label: 'Ticket Lookup'
    },
    {
        description:
            'Customers ranked by how much extra yardage they call in mid-pour — average kicker, rate, and totals.',
        icon: 'fa-bolt',
        id: 'kickers',
        label: 'Kickers Analysis'
    },
    {
        description: 'Customers ranked by how often their jobs got moved or cancelled after the 5:30 PM commit.',
        icon: 'fa-shuffle',
        id: 'movesCancels',
        label: 'Moves & Cancels'
    },
    {
        description: 'Scheduled vs actual hours from Dayforce, plant rollups, weekly trend, and exception counts.',
        icon: 'fa-clock',
        id: 'hours',
        label: 'Hours'
    },
    {
        description: 'Per-shift schedule from Dayforce — scheduled vs actual clock in/out per operator per day.',
        icon: 'fa-calendar-days',
        id: 'schedules',
        label: 'Schedules'
    },
    {
        description: 'Labor cost from Dayforce — regular vs overtime, blended rate, per-operator and per-plant cost.',
        icon: 'fa-dollar-sign',
        id: 'laborCost',
        label: 'Labor Cost'
    },
    {
        description:
            'Yards-per-hour by operator and plant — who is converting clocked hours into yardage and where the data gaps are.',
        icon: 'fa-gauge-high',
        id: 'efficiency',
        label: 'Efficiency'
    }
]

/**
 * Sidebar grouping — categorises the flat `PLAN_STATS_SECTIONS` into
 * collapsible buckets so the rail doesn't read as one long list. Each
 * top-level entry is either:
 *   • `{ kind: 'section', sectionId }` — a standalone leaf (Overview).
 *   • `{ kind: 'group', id, label, icon, sectionIds }` — a category
 *     header with child sections, collapsible from a chevron on the
 *     right.
 *
 * Children inherit their own icon / description from PLAN_STATS_SECTIONS;
 * the group only carries the header label + icon + the ordered list of
 * member section IDs.
 */
export const PLAN_STATS_GROUPS = [
    { kind: 'section', sectionId: 'overview' },
    {
        icon: 'fa-industry',
        id: 'operations',
        kind: 'group',
        label: 'Operations',
        sectionIds: ['production', 'operators', 'helpCrossLoading']
    },
    {
        icon: 'fa-handshake',
        id: 'customerExperience',
        kind: 'group',
        label: 'Customer Experience',
        sectionIds: ['service', 'customerLookup', 'ticketLookup', 'kickers', 'movesCancels']
    },
    {
        icon: 'fa-user-clock',
        id: 'workforce',
        kind: 'group',
        label: 'Workforce',
        sectionIds: ['hours', 'schedules', 'laborCost', 'efficiency']
    }
]

/** Build a quick lookup of `sectionId → section meta` so the rendering
 *  code doesn't `.find()` for every child cell on every render. */
const sectionsById = new Map(PLAN_STATS_SECTIONS.map((s) => [s.id, s]))

/** Returns the group that owns a given section id, or null when the
 *  section is a top-level standalone. */
const groupForSection = (sectionId) => {
    for (const entry of PLAN_STATS_GROUPS) {
        if (entry.kind === 'group' && entry.sectionIds.includes(sectionId)) return entry
    }
    return null
}

/**
 * Left-rail navigation for the Statistics tab. Renders each top-level
 * entry from `PLAN_STATS_GROUPS`:
 *   - Standalone sections render exactly like the old flat-list buttons.
 *   - Category groups render a header button with a chevron that
 *     toggles the children's visibility. The header animates the
 *     chevron; children indent slightly so the hierarchy reads at a
 *     glance.
 *
 * The group that owns the active section is auto-expanded on mount and
 * stays expanded when the user navigates into a sibling section.
 * Manual collapse / expand state persists for the lifetime of the view.
 */
export function PlanStatisticsSidebar({ accentColor, activeSection, onSelect }) {
    const ownerGroupId = useMemo(() => groupForSection(activeSection)?.id || null, [activeSection])
    /* Accordion model — at most one category open at a time. Opening
     * group B while A is open closes A; clicking the open group's
     * header again closes it. Null means everything is collapsed. */
    const [openGroupId, setOpenGroupId] = useState(null)

    /* When the user navigates into a section inside a collapsed group,
     * open that group (and close whichever was open before). Keeps the
     * breadcrumb visible without breaking the single-open invariant. */
    useEffect(() => {
        if (!ownerGroupId) return
        setOpenGroupId((prev) => (prev === ownerGroupId ? prev : ownerGroupId))
    }, [ownerGroupId])

    const toggleGroup = (groupId) => setOpenGroupId((prev) => (prev === groupId ? null : groupId))

    return (
        <aside className="hidden md:flex shrink-0 flex-col gap-0.5 sticky top-0 self-start py-2 pr-1 w-[220px]">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-3 py-2 text-text-tertiary">
                Statistics
            </div>
            {PLAN_STATS_GROUPS.map((entry) => {
                if (entry.kind === 'section') {
                    const section = sectionsById.get(entry.sectionId)
                    if (!section) return null
                    return (
                        <SidebarSectionButton
                            key={section.id}
                            accentColor={accentColor}
                            active={section.id === activeSection}
                            onSelect={onSelect}
                            section={section}
                        />
                    )
                }
                const isOpen = openGroupId === entry.id
                const containsActive = entry.sectionIds.includes(activeSection)
                return (
                    <SidebarGroup
                        key={entry.id}
                        accentColor={accentColor}
                        activeSection={activeSection}
                        containsActive={containsActive}
                        group={entry}
                        isOpen={isOpen}
                        onSelect={onSelect}
                        onToggle={() => toggleGroup(entry.id)}
                    />
                )
            })}
        </aside>
    )
}

/** Single leaf-section button. Pulled into its own component so groups
 *  and standalone sections share the exact same styling. Active state
 *  is signalled by the accent-tinted background only — text + icon
 *  stay on the theme-aware primary token so they read black in light
 *  and white in dark, matching every other interactive surface. */
function SidebarSectionButton({ accentColor, active, indent, onSelect, section }) {
    return (
        <button
            onClick={() => onSelect(section.id)}
            className="flex items-center gap-2.5 rounded-md border-none cursor-pointer text-left px-3 py-2 transition-colors"
            style={{
                background: active ? `${accentColor}15` : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                paddingLeft: indent ? '28px' : undefined
            }}
            title={section.description}
        >
            <i className={`fas ${section.icon} text-[12px] w-3.5 text-center`} />
            <span className="text-[12.5px] font-semibold truncate">{section.label}</span>
        </button>
    )
}

/** Collapsible category header + indented children. Header chevron
 *  rotates to indicate the expand state; the header tints when one of
 *  its children is the active section so the parent context stays
 *  visible even while collapsed. */
function SidebarGroup({ accentColor, activeSection, containsActive, group, isOpen, onSelect, onToggle }) {
    // Header text + icon use the theme-aware primary token regardless of
    // active state — the accent shows up only as the subtle tinted
    // background on `containsActive`.
    const headerTint = containsActive ? 'var(--text-primary)' : 'var(--text-secondary)'
    return (
        <>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="flex items-center gap-2.5 rounded-md border-none cursor-pointer text-left px-3 py-2 transition-colors"
                style={{
                    background: containsActive ? `${accentColor}10` : 'transparent',
                    color: headerTint
                }}
                title={`${group.label} — click to ${isOpen ? 'collapse' : 'expand'}`}
            >
                <i className={`fas ${group.icon} text-[12px] w-3.5 text-center`} />
                <span className="text-[12.5px] font-semibold truncate flex-1">{group.label}</span>
                <i
                    className={`fas fa-chevron-${isOpen ? 'down' : 'right'} text-[9px] transition-transform`}
                    style={{ color: 'var(--text-tertiary)' }}
                />
            </button>
            {isOpen &&
                group.sectionIds.map((sectionId) => {
                    const section = sectionsById.get(sectionId)
                    if (!section) return null
                    return (
                        <SidebarSectionButton
                            key={section.id}
                            accentColor={accentColor}
                            active={section.id === activeSection}
                            indent
                            onSelect={onSelect}
                            section={section}
                        />
                    )
                })}
        </>
    )
}

/**
 * Mobile-only horizontal scroller alternative to the sidebar — keeps every
 * section reachable when the layout collapses below the md breakpoint.
 * Stays flat (no grouping) because horizontal scroll doesn't benefit from
 * collapsible categories.
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

export default PlanStatisticsSidebar
