import React from 'react'

/**
 * Banner + dimmed list shown beneath the main results when the search
 * matches items that fall outside the active filter chips. Rendered with a
 * different header copy depending on whether there are also exact filter
 * matches above it.
 */
export default function AssetPotentialMatches({ children, count, hasFiltered }) {
    return (
        <>
            <div className="mt-4 flex items-center gap-3 rounded-md bg-bg-hover px-4 py-3 animate-fade-in-fast">
                <i className="fas fa-filter text-xs text-text-tertiary" />
                <span className="text-sm font-semibold text-text-primary">
                    {hasFiltered ? 'Potential Matches' : 'Results Outside Current Filters'}
                </span>
                <span className="text-xs text-text-secondary">
                    {hasFiltered
                        ? '(hidden by active filters)'
                        : 'No exact filter matches — showing results that match your search'}
                </span>
                <span className="ml-auto inline-flex items-center rounded-full bg-bg-secondary px-2 py-0.5 text-xs font-bold tabular-nums text-text-secondary">
                    {count}
                </span>
            </div>
            <div className={hasFiltered ? 'opacity-60 transition-opacity duration-200 hover:opacity-100' : ''}>
                {children}
            </div>
        </>
    )
}
