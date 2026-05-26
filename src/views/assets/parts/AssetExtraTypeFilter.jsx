import React from 'react'

/**
 * Optional "extra type" select rendered into `TopSection`'s `customFilters`
 * slot — used by asset configs that need a third filter beyond plant +
 * status (e.g. equipment type). Persists via the same filter-persistence
 * keys as the rest of the toolbar.
 */
export default function AssetExtraTypeFilter({ config, filters, updateFilterRef }) {
    const { extraTypeFilter } = config
    if (!extraTypeFilter) return null

    const handleChange = (event) => {
        const nextValue = event.target.value
        filters.setExtraTypeFilter(nextValue)
        if (extraTypeFilter.persistKey) {
            updateFilterRef.current?.(extraTypeFilter.persistKey, nextValue)
        }
    }

    return (
        <select
            aria-label={extraTypeFilter.label}
            className="min-w-[130px] cursor-pointer rounded text-[12px] font-medium py-1.5 pl-2 pr-7 bg-bg-secondary border border-border-light text-text-primary hover:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors duration-150"
            onChange={handleChange}
            value={filters.extraTypeFilter}
        >
            <option value="">{extraTypeFilter.allLabel}</option>
            {extraTypeFilter.options.map((option) => (
                <option key={option} value={option}>
                    {option}
                </option>
            ))}
        </select>
    )
}
