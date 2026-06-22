/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Top-level tab definitions for the CRM view. Each tab owns a set of
 * section ids that map to sidebar entries and page components.
 *
 * `requiresManage` tabs are only rendered when the caller passes
 * `canManage={true}` — the Settings tab is the only current example.
 */
export const CRM_TABS = [
    { icon: 'fa-briefcase', id: 'work', label: 'Work', sections: ['my-desk', 'outreach', 'followups'] },
    { icon: 'fa-address-book', id: 'customers', label: 'Customers', sections: ['accounts', 'pipeline', 'map'] },
    { icon: 'fa-map-pin', id: 'pins', label: 'Pins', sections: ['pins'] },
    { icon: 'fa-chart-line', id: 'insights', label: 'Insights', sections: ['activity', 'team-monitor'] },
    { icon: 'fa-sliders', id: 'settings', label: 'Settings', requiresManage: true, sections: ['settings'] }
]

/**
 * Horizontal tab switcher for the CRM view header. Mirrors the visual
 * style of `PlanTabSwitcher` — a pill group in `bg-bg-tertiary` with the
 * active tab filled using `accentColor`.
 *
 * @param {object} props
 * @param {string} props.accentColor - Brand accent hex used to fill the active tab.
 * @param {string} props.activeTab - Currently active tab id.
 * @param {boolean} [props.canManage] - When true, tabs with `requiresManage` are shown.
 * @param {(tabId: string) => void} props.onSelect - Called when a tab is clicked.
 */
export function CrmTabSwitcher({ accentColor, activeTab, canManage = false, onSelect }) {
    const visibleTabs = CRM_TABS.filter((tab) => !tab.requiresManage || canManage)

    return (
        <div
            role="tablist"
            aria-label="CRM view"
            className="flex items-center rounded-md p-0.5 bg-bg-tertiary border border-border-light"
        >
            {visibleTabs.map(({ icon, id, label }) => {
                const isActive = activeTab === id
                return (
                    <button type="button"
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onSelect(id)}
                        className={`inline-flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-tertiary ${
                            isActive
                                ? 'text-white shadow-sm'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                        style={isActive ? { backgroundColor: accentColor } : undefined}
                    >
                        <i className={`fas ${icon}`} aria-hidden="true" />
                        <span>{label}</span>
                    </button>
                )
            })}
        </div>
    )
}
