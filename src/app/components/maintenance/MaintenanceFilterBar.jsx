import React from 'react'

const SEARCH_INPUT_CLASS =
    'text-[12.5px] outline-none rounded py-1.5 pl-8 pr-7 transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none'

/**
 * Slim search strip that sits directly under `MaintenanceHeader`. Mirrors the
 * Plan tabs' flat single-row chrome — magnifier icon left, optional clear "x"
 * right. Search is the only filter the download-only forms library needs.
 */
export function MaintenanceFilterBar({ onClearSearch, onSearchChange, searchPlaceholder, searchValue }) {
    return (
        <div
            className="shrink-0 flex items-center border-b px-3 sm:px-4 py-2 bg-bg-primary border-border-light"
            role="search"
        >
            <div className="relative flex-1 min-w-[180px] max-w-[360px]">
                <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none text-text-tertiary" />
                <input
                    type="search"
                    aria-label="Search forms"
                    placeholder={searchPlaceholder}
                    value={searchValue || ''}
                    onChange={(event) => onSearchChange?.(event.target.value)}
                    className={`w-full ${SEARCH_INPUT_CLASS} bg-bg-secondary border border-border-light text-text-primary placeholder:text-text-tertiary`}
                />
                {searchValue && onClearSearch && (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        aria-label="Clear search"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-[10px] cursor-pointer border-none bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary active:scale-[0.92] transition-[background-color,color,transform] duration-150 ease-out motion-reduce:transition-none"
                    >
                        <i className="fas fa-times" />
                    </button>
                )}
            </div>
        </div>
    )
}
