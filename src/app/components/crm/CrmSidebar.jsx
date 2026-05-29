/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Flat section catalogue for the CRM view. Section ids match what
 * `CrmTabSwitcher` references so the sidebar and tab switcher stay
 * in sync without a shared state layer.
 */
export const CRM_SECTIONS = [
    {
        description: 'Team & region overview — outreach, pipeline, activity at a glance.',
        icon: 'fa-house',
        id: 'my-desk',
        label: 'Overview'
    },
    {
        description: 'Dormant customers due for a cold call, longest dormant first.',
        icon: 'fa-phone-volume',
        id: 'outreach',
        label: 'Outreach Queue'
    },
    {
        description: 'Scheduled next actions across the team.',
        icon: 'fa-list-check',
        id: 'followups',
        label: 'Follow-ups'
    },
    {
        description: 'Every call logged by the team, newest first — see who reached out to whom.',
        icon: 'fa-rss',
        id: 'activity',
        label: 'Activity'
    },
    {
        description: 'Full searchable directory of every customer and prospect.',
        icon: 'fa-address-book',
        id: 'accounts',
        label: 'Accounts'
    },
    {
        description: 'Opportunities by stage — win new and reactivated customers.',
        icon: 'fa-chart-simple',
        id: 'pipeline',
        label: 'Pipeline'
    },
    {
        description: 'Accounts and site visits on the map.',
        icon: 'fa-map-location-dot',
        id: 'map',
        label: 'Map'
    },
    {
        description:
            'Monitor team outreach activity — calls logged, bookings closed, and follow-up coverage by caller.',
        icon: 'fa-chart-line',
        id: 'team-monitor',
        label: 'Team Monitor',
        // Gated to crm.manage in CrmView.
        minRoleWeight: 31
    },
    {
        description: 'Field pins dropped by the team.',
        icon: 'fa-map-pin',
        id: 'pins',
        label: 'Pins'
    }
]

/**
 * Section groups for grouped sidebar rendering. CrmView uses CrmTabSwitcher
 * instead. Exported for any consumers that need the group list directly.
 */
export const CRM_GROUPS = [
    { id: 'work', label: 'Work', sectionIds: ['my-desk', 'outreach', 'followups'] },
    { id: 'customers', label: 'Customers', sectionIds: ['accounts', 'pipeline', 'map'] },
    { id: 'insights', label: 'Insights', sectionIds: ['activity', 'team-monitor'] }
]

/** Filter the section list to only entries the caller's role weight clears.
 *  Sections without a `minRoleWeight` are visible to everyone. */
export function visibleCrmSections(userRoleWeight = 0) {
    return CRM_SECTIONS.filter((section) => !section.minRoleWeight || (userRoleWeight || 0) >= section.minRoleWeight)
}

/** Full section metadata map covering every CRM section id, plus the
 *  Settings entry only available to managers. Exported so tests and the
 *  parent view can look up metadata by id. */
export const CRM_SECTION_META = [
    ...CRM_SECTIONS,
    {
        description: 'Geocoding, pipeline stages, and team preferences.',
        icon: 'fa-sliders',
        id: 'settings',
        label: 'Settings'
    }
]

const sectionMetaById = new Map(CRM_SECTION_META.map((s) => [s.id, s]))

const navItemClass =
    'inline-flex items-center gap-2.5 rounded-md border-none cursor-pointer text-left transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

/**
 * Left-rail navigation for the CRM view. Renders the given section ids as a
 * flat list using the shared `CRM_SECTION_META` shape. Groups are handled at
 * the tab level in CrmView via CrmTabSwitcher.
 *
 * @param {object} props
 * @param {string} props.accentColor
 * @param {string} props.activeSection
 * @param {(sectionId: string) => void} props.onSelect
 * @param {string[]} props.sectionIds - Ordered list of section ids to render.
 * @param {object[]} [props.sectionMeta] - Override metadata array (defaults to CRM_SECTION_META).
 */
export function CrmSidebar({ accentColor, activeSection, onSelect, sectionIds, sectionMeta }) {
    const metaById = sectionMeta ? new Map(sectionMeta.map((s) => [s.id, s])) : sectionMetaById

    return (
        <aside
            className="hidden md:flex shrink-0 flex-col gap-0.5 sticky top-0 self-start py-2 pr-1 w-[200px]"
            aria-label="CRM sections"
        >
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] px-3 py-2 text-text-tertiary">CRM</div>
            {sectionIds.map((sectionId) => {
                const section = metaById.get(sectionId)
                if (!section) return null
                const isActive = sectionId === activeSection
                return (
                    <button
                        key={sectionId}
                        type="button"
                        onClick={() => onSelect(sectionId)}
                        aria-current={isActive ? 'page' : undefined}
                        title={section.description}
                        className={`${navItemClass} px-3 py-2`}
                        style={{
                            background: isActive ? `${accentColor}15` : 'transparent',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        <i className={`fas ${section.icon} text-[12px] w-3.5 text-center`} aria-hidden="true" />
                        <span className="text-[12.5px] font-semibold truncate">{section.label}</span>
                    </button>
                )
            })}
        </aside>
    )
}

export default CrmSidebar
