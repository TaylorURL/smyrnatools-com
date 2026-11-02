/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

/**
 * Catalogue of every Statistics sub-page, in menu order. `applies` decides
 * whether a section is offered at all; it sees both the asset config and the
 * live derived summary, so a section is hidden either because the asset type
 * has no such concept (operator coverage on trailers) or because nothing in
 * the current scope carries the data (cleanliness, when no in-scope asset is
 * rated). Data-driven sections can therefore appear and disappear as the
 * plant filter and time range move.
 */
const ALL_ASSET_STATS_SECTIONS = [
    {
        applies: () => true,
        description: 'Headline KPIs + a snapshot of every other section.',
        icon: 'fa-gauge-high',
        id: 'overview',
        label: 'Overview'
    },
    {
        applies: () => true,
        description: 'Status mix, sub-status breakdown, and longest-in-status watchlist.',
        icon: 'fa-circle-half-stroke',
        id: 'fleetStatus',
        label: 'Fleet Status'
    },
    {
        applies: () => true,
        description: 'Per-plant scorecards — active / spare / shop split with verification and coverage.',
        icon: 'fa-industry',
        id: 'plants',
        label: 'Plant Distribution'
    },
    {
        applies: ({ summary }) => summary.hasService,
        description: 'Past-due service, days-since-service distribution, and the longest-overdue watchlist.',
        icon: 'fa-wrench',
        id: 'service',
        label: 'Service Health'
    },
    {
        applies: ({ config }) => !!config?.verification?.hasHours,
        description: 'Hours distribution, fleet-wide averages, per-plant utilization, and highest-hour assets.',
        icon: 'fa-gauge',
        id: 'hours',
        label: 'Hours & Utilization'
    },
    {
        applies: () => true,
        description: 'Shop load, sub-status breakdown, days-in-shop, and the stuck-asset watchlist.',
        icon: 'fa-screwdriver-wrench',
        id: 'shopPerformance',
        label: 'Shop Performance'
    },
    {
        applies: ({ config }) => !!config?.hasVerification,
        description: 'Verification rate, stale verifications, and missing identification fields.',
        icon: 'fa-clipboard-check',
        id: 'verification',
        label: 'Verification & Data'
    },
    {
        applies: ({ summary }) => summary.hasCleanliness,
        description: 'Cleanliness rating distribution, dirty fleet list, and per-plant cleanliness rollup.',
        icon: 'fa-broom',
        id: 'cleanliness',
        label: 'Cleanliness'
    },
    {
        applies: ({ config }) => !!config?.hasOperatorAssignment,
        description: 'Assigned vs. unassigned active assets, plus operators on the bench.',
        icon: 'fa-id-badge',
        id: 'operators',
        label: 'Operator Coverage'
    },
    {
        applies: () => true,
        description: 'Open-issue counts, top problem assets, and issues by plant.',
        icon: 'fa-triangle-exclamation',
        id: 'issues',
        label: 'Issues'
    },
    {
        applies: () => true,
        description: 'Model year distribution and the oldest assets still in operation.',
        icon: 'fa-clock-rotate-left',
        id: 'aging',
        label: 'Fleet Aging'
    }
]

/** The sections currently on offer. Feeds the desktop rail, the mobile tab
 *  bar, and the heading lookup in `AssetStatisticsView` — which also snaps
 *  the active section back into this list whenever it shrinks out from under
 *  the selection. */
export function useAssetStatsSections({ config, summary }) {
    return useMemo(
        () => ALL_ASSET_STATS_SECTIONS.filter((section) => section.applies({ config, summary })),
        [config, summary]
    )
}

export function AssetStatisticsSidebar({ activeSection, onSelect, sections }) {
    return (
        <aside
            aria-label="Statistics sections"
            className="hidden md:flex shrink-0 flex-col gap-px sticky top-0 self-start w-[200px]"
        >
            {sections.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        type="button"
                        key={section.id}
                        onClick={() => onSelect(section.id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={`${section.label}. ${section.description}`}
                        className={`flex h-8 items-center rounded-[4px] border-none cursor-pointer text-left px-2.5 text-[13px] transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            active
                                ? 'bg-bg-tertiary font-medium text-text-primary'
                                : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }`}
                    >
                        <span className="truncate">{section.label}</span>
                    </button>
                )
            })}
        </aside>
    )
}

export function AssetStatisticsSectionTabs({ activeSection, onSelect, sections }) {
    return (
        <div
            className="md:hidden flex items-end gap-5 overflow-x-auto border-b border-border-light"
            style={{ scrollbarWidth: 'none' }}
        >
            {sections.map((section) => {
                const active = section.id === activeSection
                return (
                    <button
                        type="button"
                        key={section.id}
                        onClick={() => onSelect(section.id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={`${section.label}. ${section.description}`}
                        className={`-mb-px shrink-0 border-0 border-b-2 border-solid bg-transparent pb-2.5 pt-1 text-[13px] cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            active
                                ? 'border-text-primary font-medium text-text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        {section.label}
                    </button>
                )
            })}
        </div>
    )
}

export default AssetStatisticsSidebar
