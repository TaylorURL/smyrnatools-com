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
            <div className="flex items-center gap-3 px-4 py-3 mt-4 rounded-lg bg-bg-hover">
                <i className="fas fa-filter text-xs text-text-secondary" />
                <span className="text-sm font-semibold text-text-primary">
                    {hasFiltered ? 'Potential Matches' : 'Results Outside Current Filters'}
                </span>
                <span className="text-xs text-text-secondary">
                    {hasFiltered
                        ? '(hidden by active filters)'
                        : 'No exact filter matches — showing results that match your search'}
                </span>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
                    {count}
                </span>
            </div>
            <div className={hasFiltered ? 'opacity-60' : ''}>{children}</div>
        </>
    )
}
