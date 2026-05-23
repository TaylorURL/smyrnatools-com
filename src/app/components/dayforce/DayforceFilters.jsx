/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useRef, useState } from 'react'

import { SORT_OPTIONS } from '../../hooks/useDayforceOperatorFilters'

/**
 * Compact filter pill with a popover dropdown. Mirrors the visual
 * language used by PlantFilterMenu / ComparisonMenu in
 * PlanStatisticsControls — solid accent tint when an option other than
 * the default is active, neutral bg otherwise. No outer border/container.
 */
function FilterPill({ accentColor, activeId, defaultId, icon, label, onSelect, options, title }) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef(null)
    const active = activeId !== defaultId
    const current = options.find((o) => o.id === activeId)
    const display = active ? `${label} · ${current?.label || activeId}` : label

    // Click-outside to close — without it the popover hangs around when
    // you tab to a different control. Matching the dispatch UI pattern
    // (which uses the same plain DOM listener).
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
                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                style={{
                    backgroundColor: active ? `${accentColor}20` : 'var(--bg-tertiary)',
                    color: active ? accentColor : 'var(--text-secondary)'
                }}
                title={title}
                type="button"
            >
                {icon && <i className={`fas ${icon} text-[11px]`} />}
                <span className="truncate max-w-[180px]">{display}</span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px]`} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-lg z-10 min-w-[180px] max-h-[320px] overflow-y-auto bg-bg-primary border border-border-light">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => {
                                onSelect(opt.id)
                                setOpen(false)
                            }}
                            className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between"
                            style={{
                                backgroundColor: activeId === opt.id ? `${accentColor}15` : 'transparent',
                                color: activeId === opt.id ? accentColor : 'var(--text-primary)'
                            }}
                            type="button"
                        >
                            <span className="truncate">{opt.label}</span>
                            {activeId === opt.id && <i className="fas fa-check text-[10px]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/** Inline search input — matches the pill height + radius without
 *  fighting the same outer container. Grows on wider screens, stays
 *  compact on narrow. */
function SearchPill({ accentColor, onChange, value }) {
    const active = value.trim() !== ''
    return (
        <label
            className="inline-flex items-center gap-1.5 rounded-lg cursor-text text-xs font-semibold px-3 py-2 flex-1 min-w-[160px] max-w-[260px]"
            style={{
                backgroundColor: active ? `${accentColor}20` : 'var(--bg-tertiary)',
                color: active ? accentColor : 'var(--text-secondary)'
            }}
        >
            <i className="fas fa-magnifying-glass text-[11px]" />
            <input
                aria-label="Search operators"
                className="bg-transparent border-none outline-none flex-1 min-w-0 text-text-primary"
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search…"
                type="text"
                value={value}
            />
            {active && (
                <button
                    aria-label="Clear search"
                    className="border-none bg-transparent cursor-pointer text-[10px]"
                    onClick={(e) => {
                        e.preventDefault()
                        onChange('')
                    }}
                    style={{ color: accentColor }}
                    type="button"
                >
                    <i className="fas fa-xmark" />
                </button>
            )}
        </label>
    )
}

/**
 * Page-local filter bar for the Dayforce-sourced operator surfaces
 * (Hours, Labor Cost). Search + role/position + sort, plus a "X in view"
 * scope summary on the right.
 *
 * Visual rhythm matches PlanStatisticsControls — pill buttons + custom
 * popovers, no outer bordered container that boxes the row off from
 * the rest of the layout.
 */
export function DayforceFilters({
    accentColor,
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
    const accent = accentColor || '#1e3a5f'
    const positionOptions = [{ id: 'all', label: 'All roles' }, ...availablePositions.map((p) => ({ id: p, label: p }))]
    const sortOptions = sortIds.map((id) => ({ id, label: SORT_OPTIONS[id]?.label || id }))
    const isFiltered = controls.search.trim() !== '' || controls.position !== 'all'
    const excludedTotal = (excluded?.unmatched || 0) + (excluded?.otherPosition || 0)

    return (
        <div className="flex items-center flex-wrap gap-2">
            <SearchPill accentColor={accent} onChange={setSearch} value={controls.search} />

            <FilterPill
                accentColor={accent}
                activeId={controls.position}
                defaultId="all"
                icon="fa-user-tag"
                label="Role"
                onSelect={setPosition}
                options={positionOptions}
                title="Filter by operator role"
            />

            <FilterPill
                accentColor={accent}
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
                    className="text-[11px] font-semibold border-none bg-transparent cursor-pointer px-2 py-1 text-text-tertiary hover:text-text-primary"
                    onClick={onReset}
                    title="Clear all filters"
                    type="button"
                >
                    <i className="fas fa-rotate-left mr-1 text-[10px]" />
                    Reset
                </button>
            )}

            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
                <span>
                    <span className="font-semibold text-text-primary">{visibleCount}</span> in view
                </span>
                {excludedTotal > 0 && (
                    <span
                        title={`Excluded: ${excluded.unmatched} not in operator roster, ${excluded.otherPosition} non-operator role (plant managers, office, etc.)`}
                    >
                        · <span className="font-semibold">{excludedTotal}</span> excluded
                    </span>
                )}
            </span>
        </div>
    )
}

export default DayforceFilters
