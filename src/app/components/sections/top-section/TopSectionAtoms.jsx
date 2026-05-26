/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Search input — flat, single-row, matches Plan-tab filter styling. */
export const SearchInput = ({ value, onChange, onClear, placeholder, className = '' }) => (
    <div className={`relative ${className}`} role="search">
        <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary" />
        <input
            type="search"
            className="w-full text-[12.5px] outline-none rounded py-1.5 pl-8 pr-7 bg-bg-secondary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
            placeholder={placeholder}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            aria-label={placeholder || 'Search'}
        />
        {value && onClear && (
            <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-[10px] cursor-pointer border-none bg-bg-tertiary text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                onClick={onClear}
                type="button"
                aria-label="Clear search"
            >
                <i className="fas fa-times" />
            </button>
        )}
    </div>
)

/** Action button — flat. `primary` is the accent-color CTA, `subtle` is bg-secondary. */
export const ActionButton = ({ icon, label, onClick, variant = 'subtle', accentColor }) => {
    const isPrimary = variant === 'primary'
    return (
        <button
            type="button"
            className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer border-none"
            style={{
                background: isPrimary ? accentColor : 'var(--bg-secondary)',
                border: isPrimary ? `1px solid ${accentColor}` : '1px solid var(--border-light)',
                color: isPrimary ? '#fff' : 'var(--text-primary)'
            }}
            onClick={onClick}
            aria-label={label}
        >
            {icon && <i className={`fas ${icon}`} />}
            {label && <span>{label}</span>}
        </button>
    )
}

/** Two-button list/grid view toggle — flat, no slate-100 frame. */
export const ViewToggle = ({ viewMode, onChange, accentColor }) => (
    <div
        className="inline-flex items-center rounded overflow-hidden border border-border-light"
        role="group"
        aria-label="View mode"
    >
        {['list', 'grid'].map((mode) => {
            const isActive = viewMode === mode
            return (
                <button
                    key={mode}
                    type="button"
                    className="flex items-center justify-center w-7 h-7 text-[12px] cursor-pointer border-none"
                    style={{
                        background: isActive ? accentColor : 'var(--bg-secondary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => onChange?.(mode)}
                    aria-pressed={isActive}
                    aria-label={`${mode} view`}
                >
                    <i className={`fas ${mode === 'list' ? 'fa-list' : 'fa-th-large'}`} />
                </button>
            )
        })}
    </div>
)

/** Standard select — uses native browser chrome with var(--bg-secondary) styling. */
export const FilterSelect = ({ value, options, onChange, ariaLabel, className = '' }) => (
    <select
        className={`text-[12px] cursor-pointer font-medium rounded py-1.5 pl-2 pr-7 ${className} bg-bg-secondary border border-border-light text-text-primary transition-colors duration-150 hover:border-border-medium focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30`}
        style={{ minWidth: 130 }}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={ariaLabel}
    >
        {options.map((opt) => (
            <option key={opt} value={opt === 'All Positions' || opt === 'All Freight' ? '' : opt}>
                {opt}
            </option>
        ))}
    </select>
)

/** Reset filters button — square, flat. */
export const ResetButton = ({ onClick }) => (
    <button
        type="button"
        className="flex items-center justify-center w-7 h-7 rounded text-[12px] cursor-pointer border-none bg-bg-secondary border border-border-light text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        onClick={onClick}
        aria-label="Reset filters"
        title="Reset filters"
    >
        <i className="fas fa-undo" />
    </button>
)

/** List column header row — bg-tertiary, 10.5px uppercase tracked-wider, mono sort caret. */
export const ListHeader = ({ labels, colWidths, sortKey, sortDirection, onHeaderClick }) => (
    <div className="flex items-center -mx-4 px-4 mt-3 -mb-3 bg-bg-tertiary border-t border-border-light border-b border-border-light">
        {labels.map((label, index) => {
            const colWidth = colWidths[index] || 'auto'
            const isFlex = colWidth === 'flex' || colWidth === 'auto'
            const isActive = sortKey === label
            return (
                <button
                    key={label}
                    type="button"
                    className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider py-2 px-2 cursor-pointer select-none border-none bg-transparent"
                    style={{
                        ...(isFlex ? { flex: 1, minWidth: 0 } : { flexShrink: 0, width: colWidth }),
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        textAlign: 'left'
                    }}
                    onClick={() => onHeaderClick?.(label)}
                >
                    <span>{label}</span>
                    {isActive && (
                        <i
                            className={`fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'} text-[9px]`}
                            style={{ color: 'var(--text-primary)' }}
                        />
                    )}
                </button>
            )
        })}
    </div>
)

/** Mobile-only stacked view toggle. */
export const MobileViewToggle = ({ viewMode, onChange, accentColor }) => (
    <div className="flex gap-2">
        {[
            { icon: 'fa-list', label: 'List', mode: 'list' },
            { icon: 'fa-th-large', label: 'Grid', mode: 'grid' }
        ].map(({ mode, icon, label }) => {
            const isActive = viewMode === mode
            return (
                <button
                    key={mode}
                    type="button"
                    className="flex items-center justify-center gap-1.5 flex-1 rounded text-[12px] font-semibold py-2 cursor-pointer"
                    style={{
                        background: isActive ? `${accentColor}14` : 'var(--bg-secondary)',
                        border: `1px solid ${isActive ? accentColor : 'var(--border-light)'}`,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                    onClick={() => onChange?.(mode)}
                    aria-label={`${label} view`}
                >
                    <i className={`fas ${icon}`} />
                    <span>{label}</span>
                </button>
            )
        })}
    </div>
)

export const MobileFilterItem = ({ label, children, fullWidth = false }) => (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
        {children}
    </div>
)
