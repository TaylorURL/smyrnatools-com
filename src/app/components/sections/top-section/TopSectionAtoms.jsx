/* eslint-disable react/forbid-dom-props */
import React from 'react'

const CONTROL =
    'h-9 rounded-[4px] border border-border-medium bg-bg-primary text-[13px] text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25'

export const SearchInput = ({ value, onChange, onClear, placeholder, className = '' }) => (
    <div className={`relative ${className}`} role="search">
        <i className="fas fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary" />
        <input
            type="search"
            className={`${CONTROL} w-full pl-8 pr-8 outline-none placeholder:text-text-tertiary hover:border-border-dark [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none`}
            placeholder={placeholder}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            aria-label={placeholder || 'Search'}
        />
        {value && onClear && (
            <button
                type="button"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[3px] border-none bg-transparent text-[11px] text-text-tertiary cursor-pointer transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                onClick={onClear}
                aria-label="Clear search"
            >
                <i className="fas fa-times" />
            </button>
        )}
    </div>
)

export const ActionButton = ({ icon, label, onClick, variant = 'subtle' }) => (
    <button
        type="button"
        className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}
        onClick={onClick}
        aria-label={label}
    >
        {icon && <i className={`fas ${icon} text-[12px]`} />}
        {label && <span>{label}</span>}
    </button>
)

/** List / cards switch: two square buttons sharing one outline, the current
 *  one filled with the surface colour and drawn in full-strength ink. */
export const ViewToggle = ({ viewMode, onChange }) => (
    <div
        className="inline-flex h-9 items-center rounded-[4px] border border-border-medium bg-bg-tertiary p-0.5"
        role="group"
        aria-label="View mode"
    >
        {['list', 'grid'].map((mode) => {
            const isActive = viewMode === mode
            return (
                <button
                    type="button"
                    key={mode}
                    className={`flex h-full w-8 items-center justify-center rounded-[3px] border-none text-[12px] cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        isActive
                            ? 'bg-bg-primary text-text-primary shadow-card'
                            : 'bg-transparent text-text-tertiary hover:text-text-primary'
                    }`}
                    onClick={() => onChange?.(mode)}
                    aria-pressed={isActive}
                    aria-label={`${mode} view`}
                >
                    <i className={`fas ${mode === 'list' ? 'fa-list' : 'fa-grip'}`} />
                </button>
            )
        })}
    </div>
)

/** `appearance-none` drops the browser's own arrow, so the chevron is drawn
 *  as a background SVG instead and reads the same in both themes. It is
 *  stroked in `currentColor` to stay with the select's text colour.
 *
 *  The two "All …" entries map to an empty value, which is what the filter
 *  hooks read as no filter; every other option submits its own label. */
export const FilterSelect = ({ value, options, onChange, ariaLabel, className = '' }) => (
    <select
        className={`${CONTROL} appearance-none bg-no-repeat bg-[right_0.6rem_center] bg-[length:0.8rem_0.8rem] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke=%22currentColor%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20stroke-width=%222%22%20d=%22M19%209l-7%207-7-7%22/%3E%3C/svg%3E')] [color-scheme:light] dark:[color-scheme:dark] cursor-pointer py-0 pl-3 pr-8 hover:border-border-dark disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        style={{ minWidth: 140 }}
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

export const ResetButton = ({ onClick }) => (
    <button
        type="button"
        className="btn-secondary w-9 justify-center px-0"
        onClick={onClick}
        aria-label="Reset filters"
        title="Reset filters"
    >
        <i className="fas fa-rotate-left text-[12px]" />
    </button>
)

/** Column headings for the list below, drawn as the top of the table's own
 *  card: the same border and inset, so each percentage width resolves against
 *  the same inner width and every heading sits over its column. The card
 *  below picks up without a top border, so the two read as one table. */
export const ListHeader = ({ labels, colWidths, sortKey, sortDirection, onHeaderClick }) => (
    <div className="flex items-center rounded-t-card border border-border-light bg-bg-tertiary">
        {labels.map((label, index) => {
            const colWidth = colWidths[index] || 'auto'
            const isFlex = colWidth === 'flex' || colWidth === 'auto'
            const isActive = sortKey === label
            return (
                <button
                    type="button"
                    key={label}
                    className="flex h-9 items-center justify-start gap-1.5 rounded border-none bg-transparent px-3 text-[12px] font-medium normal-case cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    style={{
                        ...(isFlex ? { flex: 1, minWidth: 0 } : { flexShrink: 0, width: colWidth }),
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        textAlign: 'left'
                    }}
                    onClick={() => onHeaderClick?.(label)}
                >
                    <span className="truncate">{label}</span>
                    {isActive && (
                        <i
                            className={`fas fa-arrow-${sortDirection === 'asc' ? 'up' : 'down'} text-[9px]`}
                            style={{ color: 'var(--text-primary)' }}
                        />
                    )}
                </button>
            )
        })}
    </div>
)

export const MobileViewToggle = ({ viewMode, onChange, accentColor }) => (
    <div className="flex gap-2">
        {[
            { icon: 'fa-list', label: 'List', mode: 'list' },
            { icon: 'fa-th-large', label: 'Grid', mode: 'grid' }
        ].map(({ mode, icon, label }) => {
            const isActive = viewMode === mode
            return (
                <button
                    type="button"
                    key={mode}
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
        <span className="text-[12px] font-medium text-text-tertiary">{label}</span>
        {children}
    </div>
)
