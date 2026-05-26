import React, { useEffect, useRef, useState } from 'react'

import { SORT_OPTIONS } from '../../hooks/useDayforceOperatorFilters'

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary'

/**
 * Compact filter pill with a popover dropdown. Mirrors the visual
 * language used by PlantFilterMenu / ComparisonMenu in
 * PlanStatisticsControls — accent-tinted active state, neutral bg otherwise.
 */
function FilterPill({ activeId, defaultId, icon, label, onSelect, options, title }) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef(null)
    const active = activeId !== defaultId
    const current = options.find((o) => o.id === activeId)
    const display = active ? `${label} · ${current?.label || activeId}` : label

    useEffect(() => {
        if (!open) return
        function onDocClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [open])

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen((s) => !s)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none ${FOCUS_RING} ${
                    active
                        ? 'bg-accent/15 text-text-primary border border-accent/30'
                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
                }`}
                title={title}
                aria-haspopup="listbox"
                aria-expanded={open}
                type="button"
            >
                {icon && <i className={`fas ${icon} text-[11px]`} aria-hidden="true" />}
                <span className="truncate max-w-[180px]">{display}</span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px]`} aria-hidden="true" />
            </button>
            {open && (
                <div
                    className="absolute right-0 top-full mt-1 min-w-[180px] max-h-[320px] z-10 overflow-y-auto overflow-hidden rounded-card border border-border-light bg-bg-primary shadow-modal animate-fade-slide-in"
                    role="listbox"
                >
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => {
                                onSelect(opt.id)
                                setOpen(false)
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-text-primary transition-colors duration-150 ease-out hover:bg-bg-hover motion-reduce:transition-none ${FOCUS_RING} focus-visible:bg-bg-hover ${
                                activeId === opt.id ? 'bg-accent/10' : ''
                            }`}
                            role="option"
                            aria-selected={activeId === opt.id}
                            type="button"
                        >
                            <span className="truncate">{opt.label}</span>
                            {activeId === opt.id && (
                                <i className="fas fa-check text-[10px] text-accent" aria-hidden="true" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/** Inline search input — matches the pill height + radius. */
function SearchPill({ onChange, value }) {
    const active = value.trim() !== ''
    return (
        <label
            className={`inline-flex flex-1 min-w-[160px] max-w-[260px] cursor-text items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-150 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1 focus-within:ring-offset-bg-primary ${
                active
                    ? 'bg-accent/15 text-text-primary border border-accent/30'
                    : 'bg-bg-tertiary text-text-secondary border border-transparent'
            }`}
        >
            <i className="fas fa-magnifying-glass text-[11px]" aria-hidden="true" />
            <input
                aria-label="Search operators"
                className="min-w-0 flex-1 border-none bg-transparent text-text-primary outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search…"
                type="search"
                value={value}
            />
            {active && (
                <button
                    aria-label="Clear search"
                    className={`rounded p-0.5 text-[10px] text-text-secondary transition-all duration-150 ease-out hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] motion-reduce:transition-none ${FOCUS_RING}`}
                    onClick={(e) => {
                        e.preventDefault()
                        onChange('')
                    }}
                    type="button"
                >
                    <i className="fas fa-xmark" aria-hidden="true" />
                </button>
            )}
        </label>
    )
}

/**
 * Page-local filter bar for the Dayforce-sourced operator surfaces
 * (Hours, Labor Cost). Search + role/position + sort, plus a "X in view"
 * scope summary on the right.
 */
export function DayforceFilters({
    availablePositions,
    controls,
    excluded,
    onReset,
    setPosition,
    setSearch,
    setSort,
    sortIds,
    visibleCount
}) {
    const positionOptions = [{ id: 'all', label: 'All roles' }, ...availablePositions.map((p) => ({ id: p, label: p }))]
    const sortOptions = sortIds.map((id) => ({ id, label: SORT_OPTIONS[id]?.label || id }))
    const isFiltered = controls.search.trim() !== '' || controls.position !== 'all'
    const excludedTotal = (excluded?.unmatched || 0) + (excluded?.otherPosition || 0)

    return (
        <div className="flex items-center flex-wrap gap-2">
            <SearchPill onChange={setSearch} value={controls.search} />

            <FilterPill
                activeId={controls.position}
                defaultId="all"
                icon="fa-user-tag"
                label="Role"
                onSelect={setPosition}
                options={positionOptions}
                title="Filter by operator role"
            />

            <FilterPill
                activeId={controls.sort}
                defaultId={sortIds[0]}
                icon="fa-arrow-down-wide-short"
                label="Sort"
                onSelect={setSort}
                options={sortOptions}
                title="Sort the per-operator list"
            />

            {isFiltered && (
                <button
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-text-tertiary transition-all duration-150 ease-out hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] motion-reduce:transition-none ${FOCUS_RING}`}
                    onClick={onReset}
                    title="Clear all filters"
                    type="button"
                >
                    <i className="fas fa-rotate-left text-[10px]" aria-hidden="true" />
                    Reset
                </button>
            )}

            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
                <span>
                    <span className="font-semibold text-text-primary tabular-nums">{visibleCount}</span> in view
                </span>
                {excludedTotal > 0 && (
                    <span
                        title={`Excluded: ${excluded.unmatched} not in operator roster, ${excluded.otherPosition} non-operator role (plant managers, office, etc.)`}
                    >
                        · <span className="font-semibold tabular-nums">{excludedTotal}</span> excluded
                    </span>
                )}
            </span>
        </div>
    )
}

export default DayforceFilters
