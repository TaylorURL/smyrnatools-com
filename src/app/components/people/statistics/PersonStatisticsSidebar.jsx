/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

/**
 * Catalogue of every Statistics sub-page available for a people roster
 * view. The `applies` predicate runs against the entity kind + the derived
 * summary so sections that have no data (e.g. rating for managers,
 * last-login for operators) never appear in the menu.
 */
const ALL_PERSON_STATS_SECTIONS = [
    {
        applies: () => true,
        description: 'Headline counts + a snapshot into every other section.',
        icon: 'fa-gauge-high',
        id: 'overview',
        label: 'Overview'
    },
    {
        applies: ({ kind }) => kind === 'operators',
        description: 'Status mix across the operator roster (Active, Light Duty, Training, etc.).',
        icon: 'fa-circle-half-stroke',
        id: 'status',
        label: 'Roster Status'
    },
    {
        applies: () => true,
        description: 'Per-plant counts, active split, and trainer/role coverage.',
        icon: 'fa-industry',
        id: 'plants',
        label: 'Plant Distribution'
    },
    {
        applies: () => true,
        description: 'Breakdown by operator position (Mixer / Tractor) or manager role.',
        icon: 'fa-user-tag',
        id: 'roles',
        label: 'Position & Role'
    },
    {
        applies: ({ kind }) => kind === 'operators',
        description: 'Pending starts, active training, trainer roster, and recent hires — the operator lifecycle.',
        icon: 'fa-user-plus',
        id: 'hiringTraining',
        label: 'Hiring & Training'
    },
    {
        applies: ({ kind }) => kind === 'operators',
        description: 'Operator ratings distribution and the lowest-rated active operators.',
        icon: 'fa-star',
        id: 'rating',
        label: 'Ratings'
    },
    {
        applies: ({ kind }) => kind === 'managers',
        description: 'Plant coverage gaps, single-point-of-failure plants, role tiers, and recent additions.',
        icon: 'fa-shield-halved',
        id: 'coverage',
        label: 'Coverage & Risk'
    },
    {
        applies: ({ kind }) => kind === 'managers',
        description: 'Last-login recency and stale-account watchlist.',
        icon: 'fa-right-to-bracket',
        id: 'activity',
        label: 'Login Activity'
    }
]

export function usePersonStatsSections({ kind, summary }) {
    return useMemo(
        () => ALL_PERSON_STATS_SECTIONS.filter((section) => section.applies({ kind, summary })),
        [kind, summary]
    )
}

export function PersonStatisticsSidebar({ activeSection, onSelect, sections }) {
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
                        title={section.description}
                        aria-current={active ? 'page' : undefined}
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

export function PersonStatisticsSectionTabs({ activeSection, onSelect, sections }) {
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
                        title={section.description}
                        aria-current={active ? 'page' : undefined}
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

export default PersonStatisticsSidebar
