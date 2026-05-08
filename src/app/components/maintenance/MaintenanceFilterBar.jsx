import React, { useState } from 'react'

import PlantDropdownModal from '../common/PlantDropdownModal'
import PlantFilterButton from '../ui/PlantFilterButton'

const STATUS_PILL_TINTS = {
    'Due Soon': '#d97706',
    OK: '#16a34a',
    Overdue: '#dc2626',
    Total: '#475569'
}

const SEARCH_INPUT_CLASS = 'text-[12.5px] outline-none rounded py-1.5 pl-8 pr-7'

/** Plan-tab styled search input — flat single row, magnifier icon left, optional
 *  clear "x" right. Mirrors the chrome used in TopSection / ReportsToolbar. */
function SearchInput({ onChange, onClear, placeholder, value }) {
    return (
        <div className="relative flex-1 min-w-[180px] max-w-[340px]" role="search">
            <i
                className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px]"
                style={{ color: 'var(--text-tertiary)' }}
            />
            <input
                type="text"
                aria-label="Search"
                placeholder={placeholder}
                value={value || ''}
                onChange={(event) => onChange?.(event.target.value)}
                className={`w-full ${SEARCH_INPUT_CLASS}`}
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)'
                }}
            />
            {value && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-[10px] cursor-pointer border-none"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-times" />
                </button>
            )}
        </div>
    )
}

/** Compact native select — flat chrome, matches Plan filter dropdowns. */
function FilterSelect({ ariaLabel, onChange, options, value }) {
    return (
        <select
            value={value || options[0]}
            onChange={(event) => onChange?.(event.target.value)}
            aria-label={ariaLabel}
            className="text-[12px] cursor-pointer font-medium rounded py-1.5 pl-2 pr-7"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)'
            }}
        >
            {options.map((opt) => (
                <option key={opt} value={opt}>
                    {opt}
                </option>
            ))}
        </select>
    )
}

/** Square reset button — visible only when at least one filter is dirty. */
function ResetButton({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Reset filters"
            title="Reset filters"
            className="flex items-center justify-center w-7 h-7 rounded text-[12px] cursor-pointer border-none"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)'
            }}
        >
            <i className="fas fa-undo" />
        </button>
    )
}

/** Compact pill that doubles as a status filter — clicking toggles the
 *  matching `statusFilter` on/off. Mirrors the badge tints we already use
 *  for the maintenance status palette so colour reads consistently. */
function CountPill({ accentColor, active, count, label, onClick }) {
    const tint = STATUS_PILL_TINTS[label] || accentColor
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className="inline-flex items-center gap-1 rounded text-[11px] font-semibold border cursor-pointer px-1.5 py-0.5 transition-colors"
            style={{
                background: active ? `${tint}26` : `${tint}14`,
                borderColor: active ? tint : `${tint}30`,
                color: tint
            }}
        >
            <span className="font-mono tabular-nums">{count.toLocaleString()}</span>
            <span>{label}</span>
        </button>
    )
}

/**
 * Slim filter row that sits directly under `MaintenanceHeader`. Mirrors the
 * Plan tabs' "everything fits in one strip" pattern — search + plant
 * picker + status select + custom filter + reset — with a right-aligned
 * cluster of count pills that double as quick status toggles.
 */
export function MaintenanceFilterBar({
    accentColor,
    categoryFilter,
    categoryOptions,
    countPills,
    onCategoryFilterChange,
    onClearSearch,
    onPillClick,
    onPlantChange,
    onReset,
    onSearchChange,
    onStatusFilterChange,
    plantDisplayText,
    plants,
    regionPlantCodes,
    searchPlaceholder,
    searchValue,
    selectedPlant,
    showReset,
    statusFilter,
    statusOptions,
    userPlantCode
}) {
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const safePlants = Array.isArray(plants) ? plants : []
    const filteredPlants =
        regionPlantCodes && regionPlantCodes.size > 0
            ? safePlants.filter((p) =>
                  regionPlantCodes.has(
                      String(p.plantCode || p.plant_code || '')
                          .trim()
                          .toUpperCase()
                  )
              )
            : safePlants

    const hasCategorySelect = Array.isArray(categoryOptions) && categoryOptions.length > 1
    const hasStatusSelect = Array.isArray(statusOptions) && statusOptions.length > 0
    const hasPills = Array.isArray(countPills) && countPills.length > 0
    const hasPlantFilter = !!onPlantChange
    const isPlantActive =
        !!selectedPlant && selectedPlant !== 'All' && selectedPlant !== '' && plantDisplayText !== 'All Plants'

    return (
        <>
            <div
                className="shrink-0 flex items-center flex-wrap gap-x-2 gap-y-2 border-b px-3 sm:px-4 py-2"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
                role="region"
                aria-label="Search and filters"
            >
                <SearchInput
                    onChange={onSearchChange}
                    onClear={onClearSearch}
                    placeholder={searchPlaceholder}
                    value={searchValue}
                />
                {hasPlantFilter && (
                    <PlantFilterButton
                        accentColor={accentColor}
                        active={isPlantActive}
                        displayText={plantDisplayText}
                        onClick={() => setIsPlantModalOpen(true)}
                    />
                )}
                {hasStatusSelect && (
                    <FilterSelect
                        ariaLabel="Status filter"
                        onChange={onStatusFilterChange}
                        options={statusOptions}
                        value={statusFilter}
                    />
                )}
                {hasCategorySelect && (
                    <FilterSelect
                        ariaLabel="Category filter"
                        onChange={(value) => onCategoryFilterChange?.(value === categoryOptions[0] ? '' : value)}
                        options={categoryOptions}
                        value={categoryFilter || categoryOptions[0]}
                    />
                )}
                {showReset && onReset && <ResetButton onClick={onReset} />}
                {hasPills && (
                    <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                        {countPills.map(({ active, count, label }) => (
                            <CountPill
                                key={label}
                                accentColor={accentColor}
                                active={!!active}
                                count={count}
                                label={label}
                                onClick={() => onPillClick?.(label)}
                            />
                        ))}
                    </div>
                )}
            </div>
            {hasPlantFilter && isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={() => setIsPlantModalOpen(false)}
                    onSelect={(value) => {
                        onPlantChange(value)
                        setIsPlantModalOpen(false)
                    }}
                    plants={filteredPlants}
                    showAllPlants
                    userPlantCode={userPlantCode}
                />
            )}
        </>
    )
}
