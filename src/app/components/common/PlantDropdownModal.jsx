/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import { useAccentColor } from '../../hooks/useAccentColor'

/**
 * Portal modal for selecting one or more plants from a searchable list.
 * Supports single-select (auto-closes on pick) and multi-select (checkbox) modes.
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls portal visibility.
 * @param {Function} props.onClose - Callback to close the modal.
 * @param {Array<Object>} [props.plants] - Plant objects with plantCode/plant_code and plantName/plant_name.
 * @param {Function} props.onSelect - Called with the selected plant code string.
 * @param {string} [props.searchPlaceholder] - Placeholder text for the search input.
 * @param {boolean} [props.showAllPlants=false] - When true in single-select mode, shows an "All Plants" option.
 * @param {boolean} [props.showMyPlants=false] - When true in single-select mode, shows a "My Plants" option that selects 'MY_PLANTS'.
 * @param {boolean} [props.allowMultiple=false] - Enables multi-select mode with checkboxes.
 * @param {string[]} [props.selectedPlantCodes] - Pre-selected plant codes for multi-select mode.
 * @param {string} [props.userPlantCode] - User's primary plant code for "My District" detection.
 * @param {Array<Object>} [props.regionGroups] - Optional region groupings rendered above the
 *   district list in single-select mode. Each entry is `{ code, name, plantCodes: string[] }`.
 *   Clicking a region row emits `REGION:<code>` via `onSelect` so the parent can scope its
 *   filter to that region's plants. Used by the dashboard's Home Office plant picker.
 */
function PlantDropdownModal({
    isOpen,
    onClose,
    plants = [],
    onSelect,
    searchPlaceholder = 'Search plants...',
    showAllPlants = false,
    showMyPlants = false,
    allowMultiple = false,
    selectedPlantCodes = [],
    userPlantCode = '',
    regionGroups = []
}) {
    const [search, setSearch] = useState('')
    const [localSelectedCodes, setLocalSelectedCodes] = useState(selectedPlantCodes || [])
    /** Per-region collapse state for the hierarchical (office-mode) view.
     *  Regions start collapsed so the user can see the whole list at a
     *  glance, then expand the one they want to drill into. */
    const [expandedRegions, setExpandedRegions] = useState({})
    /** Re-seed local state every time the modal opens so the checked rows
     *  always reflect the parent's current `selectedPlantCodes`. Without
     *  this, an external selection change while the modal was closed
     *  would leave the next open in a stale state. */
    useEffect(() => {
        if (isOpen) setLocalSelectedCodes(selectedPlantCodes || [])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])
    useEffect(() => {
        if (isOpen) setExpandedRegions({})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])
    const accentColor = useAccentColor()
    const districtGroups = (() => {
        const map = {}
        plants.forEach((plant) => {
            const code = plant.plantCode || plant.plant_code || ''
            const dists = plant.districts || []
            dists.forEach((d) => {
                const name = typeof d === 'string' ? d : d?.name
                if (!name) return
                if (!map[name]) map[name] = []
                map[name].push(code)
            })
        })
        return Object.entries(map)
            .map(([name, codes]) => ({ name, plantCodes: codes }))
            .sort((a, b) => a.name.localeCompare(b.name))
    })()
    const userDistrict = userPlantCode ? districtGroups.find((d) => d.plantCodes.includes(userPlantCode)) : null
    const filteredPlants = plants.filter((plant) => {
        const code = plant.plantCode || plant.plant_code || ''
        const name = plant.plantName || plant.plant_name || ''
        const term = search.toLowerCase()
        return code.toLowerCase().includes(term) || name.toLowerCase().includes(term)
    })
    const sortedPlants = [...filteredPlants].sort((a, b) => {
        const codeA = a.plantCode || a.plant_code || ''
        const codeB = b.plantCode || b.plant_code || ''
        if (codeA === 'OTHER_REGION') return 1
        if (codeB === 'OTHER_REGION') return -1
        return parseInt(codeA.replace(/\D/g, '') || '0') - parseInt(codeB.replace(/\D/g, '') || '0')
    })
    const handlePlantClick = (code) => {
        if (allowMultiple) {
            setLocalSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
            onSelect(code)
        } else {
            onSelect(code)
            onClose()
        }
    }
    /** Multi-select district click — when every plant in the district is
     *  already selected, deselect them all; otherwise add the missing
     *  ones. We surface the diff through `onSelect(code)` calls so the
     *  parent's reducer sees the same per-code add/remove signals it gets
     *  from the per-plant rows (no special-casing required upstream). */
    const handleDistrictClickMulti = (district) => {
        const codes = district.plantCodes || []
        if (!codes.length) return
        const currentlyAllSelected = codes.every((c) => localSelectedCodes.includes(c))
        setLocalSelectedCodes((prev) => {
            const set = new Set(prev)
            codes.forEach((c) => {
                if (currentlyAllSelected) set.delete(c)
                else set.add(c)
            })
            return [...set]
        })
        codes.forEach((c) => {
            const already = localSelectedCodes.includes(c)
            // Only emit an event for codes whose membership actually flips,
            // so a parent that mirrors the codes via per-event toggling
            // ends up in the right state regardless of seed order.
            if (currentlyAllSelected && already) onSelect(c)
            else if (!currentlyAllSelected && !already) onSelect(c)
        })
    }
    if (!isOpen || typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-5"
            onClick={allowMultiple ? undefined : onClose}
            role="dialog"
            aria-modal="true"
            aria-label={allowMultiple ? 'Select plants' : 'Select plant'}
        >
            <div
                className="flex max-h-[80vh] w-[90%] max-w-[400px] flex-col overflow-hidden rounded-2xl bg-bg-primary border border-border-light shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between rounded-t-2xl border-b border-border-light bg-bg-secondary px-5 py-4">
                    <h2 className="m-0 text-lg font-semibold" style={{ color: accentColor }}>
                        {allowMultiple ? 'Select Plants' : 'Select Plant'}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-base text-text-secondary transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                        <i className="fas fa-times" />
                    </button>
                </div>
                <div className="relative border-b border-border-light px-4 py-3">
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-[10px] border border-border-light bg-bg-secondary py-3 pl-10 pr-9 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-tertiary hover:border-border-medium focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                    <i className="fas fa-search absolute left-7 top-1/2 -translate-y-1/2 text-sm text-text-tertiary" />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                            className="absolute right-6 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                            <i className="fas fa-times text-xs" />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto bg-bg-primary p-2" role="listbox">
                    {showAllPlants && !allowMultiple && (
                        <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            className="mb-1 flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-none bg-transparent px-4 py-3 text-left text-sm text-text-primary transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40"
                            onClick={() => {
                                onSelect('All')
                                onClose()
                            }}
                        >
                            All Plants
                        </button>
                    )}
                    {showMyPlants && !allowMultiple && (
                        <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            className="mb-1 flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-none bg-transparent px-4 py-3 text-left text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40"
                            onClick={() => {
                                onSelect('MY_PLANTS')
                                onClose()
                            }}
                        >
                            <i className="fas fa-user-circle" style={{ color: accentColor }} />
                            My Plants
                        </button>
                    )}
                    {!allowMultiple && regionGroups && regionGroups.length > 0 && !search.trim() && (
                        <>
                            <div className="mx-4 my-1 border-t border-border-light" />
                            <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                Regions
                            </div>
                            {regionGroups.map((region) => {
                                const isExpanded = !!expandedRegions[region.code]
                                const districts = region.districts || []
                                const regionPlants = (region.plants || []).slice().sort((a, b) => {
                                    const codeA = a.plantCode || a.plant_code || ''
                                    const codeB = b.plantCode || b.plant_code || ''
                                    return (
                                        parseInt(codeA.replace(/\D/g, '') || '0') -
                                        parseInt(codeB.replace(/\D/g, '') || '0')
                                    )
                                })
                                return (
                                    <div key={region.code} className="mb-1">
                                        <div className="flex items-center gap-1 rounded-[10px] hover:bg-bg-tertiary">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedRegions((prev) => ({
                                                        ...prev,
                                                        [region.code]: !prev[region.code]
                                                    }))
                                                }
                                                className="flex items-center justify-center w-8 h-8 ml-2 rounded border-none bg-transparent text-text-secondary cursor-pointer transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                                aria-label={isExpanded ? 'Collapse region' : 'Expand region'}
                                                aria-expanded={isExpanded}
                                            >
                                                <i
                                                    className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[11px]`}
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={false}
                                                className="flex flex-1 cursor-pointer items-center gap-3 rounded-[10px] border-none bg-transparent px-2 py-3 text-left text-sm font-medium text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                                onClick={() => {
                                                    onSelect(`REGION:${region.code}`)
                                                    onClose()
                                                }}
                                            >
                                                <i className="fas fa-globe" style={{ color: accentColor }} />
                                                <span className="flex-1">{region.name}</span>
                                                <span className="text-xs text-text-tertiary">
                                                    {region.plantCodes?.length || 0}
                                                </span>
                                            </button>
                                        </div>
                                        {isExpanded && (
                                            <div className="ml-6 mt-1 mb-2 border-l border-border-light pl-2">
                                                {districts.length > 0 && (
                                                    <>
                                                        <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                                                            Districts
                                                        </div>
                                                        {districts.map((district) => (
                                                            <button
                                                                key={`${region.code}:${district.name}`}
                                                                type="button"
                                                                role="option"
                                                                aria-selected={false}
                                                                className="mb-0.5 flex w-full cursor-pointer items-center gap-3 rounded-[8px] border-none bg-transparent px-3 py-2 text-left text-sm text-text-primary transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40"
                                                                onClick={() => {
                                                                    onSelect(`DISTRICT:${district.name}`)
                                                                    onClose()
                                                                }}
                                                            >
                                                                <i
                                                                    className="fas fa-layer-group"
                                                                    style={{ color: accentColor }}
                                                                />
                                                                <span className="flex-1">{district.name}</span>
                                                                <span className="text-xs text-text-tertiary">
                                                                    {district.plantCodes.length}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </>
                                                )}
                                                {regionPlants.length > 0 && (
                                                    <>
                                                        <div className="px-3 py-1 mt-1 text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                                                            Plants
                                                        </div>
                                                        {regionPlants.map((plant) => {
                                                            const code = plant.plantCode || plant.plant_code
                                                            return (
                                                                <button
                                                                    key={`${region.code}:${code}`}
                                                                    type="button"
                                                                    role="option"
                                                                    aria-selected={false}
                                                                    className="flex w-full cursor-pointer items-center gap-3 rounded-[8px] border-none bg-transparent px-3 py-2 text-left text-sm text-text-primary transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40"
                                                                    onClick={() => {
                                                                        onSelect(code)
                                                                        onClose()
                                                                    }}
                                                                >
                                                                    <span>
                                                                        ({code}) {plant.plantName || plant.plant_name}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            <div className="mx-4 my-1 border-t border-border-light" />
                        </>
                    )}
                    {!allowMultiple && regionGroups && regionGroups.length > 0 && search.trim() && (
                        <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                            Plants
                        </div>
                    )}
                    {!allowMultiple && (!regionGroups || regionGroups.length === 0) && districtGroups.length > 0 && (
                        <>
                            <div className="mx-4 my-1 border-t border-border-light" />
                            {userDistrict && (
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={false}
                                    className="mb-1 flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-none bg-transparent px-4 py-3 text-left text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40"
                                    onClick={() => {
                                        onSelect(`DISTRICT:${userDistrict.name}`)
                                        onClose()
                                    }}
                                >
                                    <i className="fas fa-user-circle" style={{ color: accentColor }} />
                                    <span className="flex-1">My District</span>
                                    <span className="text-xs text-text-tertiary">
                                        {userDistrict.plantCodes.length}
                                    </span>
                                </button>
                            )}
                            {districtGroups.map((district) => (
                                <button
                                    key={district.name}
                                    type="button"
                                    role="option"
                                    aria-selected={false}
                                    className="mb-1 flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-none bg-transparent px-4 py-3 text-left text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40"
                                    onClick={() => {
                                        onSelect(`DISTRICT:${district.name}`)
                                        onClose()
                                    }}
                                >
                                    <i className="fas fa-layer-group" style={{ color: accentColor }} />
                                    <span className="flex-1">{district.name}</span>
                                    <span className="text-xs text-text-tertiary">{district.plantCodes.length}</span>
                                </button>
                            ))}
                            <div className="mx-4 my-1 border-t border-border-light" />
                        </>
                    )}
                    {allowMultiple && districtGroups.length > 0 && (
                        <>
                            <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                Districts — tap to toggle every plant
                            </div>
                            {districtGroups.map((district) => {
                                const inDistrict = district.plantCodes
                                const selectedInDistrict = inDistrict.filter((c) =>
                                    localSelectedCodes.includes(c)
                                ).length
                                const allSelected = inDistrict.length > 0 && selectedInDistrict === inDistrict.length
                                const partial = selectedInDistrict > 0 && !allSelected
                                return (
                                    <button
                                        key={district.name}
                                        type="button"
                                        role="option"
                                        aria-selected={allSelected}
                                        className={`mb-1 flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-none px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40 ${allSelected ? 'font-semibold text-text-primary' : 'bg-transparent text-text-primary'}`}
                                        style={allSelected ? { background: `${accentColor}14` } : undefined}
                                        onClick={() => handleDistrictClickMulti(district)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = partial
                                            }}
                                            onChange={() => {}}
                                            className="h-[18px] w-[18px]"
                                            style={{ accentColor }}
                                            tabIndex={-1}
                                        />
                                        <i className="fas fa-layer-group" style={{ color: accentColor }} />
                                        <span className="flex-1">{district.name}</span>
                                        <span className="text-xs text-text-tertiary">
                                            {selectedInDistrict}/{inDistrict.length}
                                        </span>
                                    </button>
                                )
                            })}
                            <div className="mx-4 my-2 border-t border-border-light" />
                            <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                Plants
                            </div>
                        </>
                    )}
                    {/* The hierarchical region accordion already renders
                        every plant nested under its region in office-mode
                        single-select view. Suppressing the flat list while
                        no search is active avoids a duplicate flat dump
                        of every org plant under the accordion. */}
                    {!allowMultiple && regionGroups && regionGroups.length > 0 && !search.trim()
                        ? null
                        : sortedPlants.map((plant) => {
                              const code = plant.plantCode || plant.plant_code
                              const isSelected = allowMultiple && localSelectedCodes.includes(code)
                              return (
                                  <button
                                      key={code}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      className={`flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-none px-4 py-3 text-left text-sm transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary focus-visible:ring-2 focus-visible:ring-accent/40 ${isSelected ? 'font-semibold text-text-primary' : 'bg-transparent text-text-primary'}`}
                                      style={isSelected ? { background: `${accentColor}14` } : undefined}
                                      onClick={() => handlePlantClick(code)}
                                  >
                                      {allowMultiple && (
                                          <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => {}}
                                              className="h-[18px] w-[18px]"
                                              style={{ accentColor }}
                                              tabIndex={-1}
                                          />
                                      )}
                                      <span className="text-text-primary">
                                          ({code}) {plant.plantName || plant.plant_name}
                                      </span>
                                  </button>
                              )
                          })}
                </div>
                {allowMultiple && (
                    <div className="border-t border-border-light bg-bg-secondary px-4 py-3 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                // Emit a toggle for every currently selected
                                // code so the parent's per-event reducer
                                // shrinks back to nothing.
                                localSelectedCodes.forEach((c) => onSelect(c))
                                setLocalSelectedCodes([])
                            }}
                            disabled={localSelectedCodes.length === 0}
                            className="rounded-[10px] border border-border-light bg-bg-primary px-3 py-2 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                            Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 rounded-[10px] border-none px-5 py-3 text-sm font-semibold text-white transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
                            style={{ backgroundColor: accentColor }}
                        >
                            Done ({localSelectedCodes.length} selected)
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
export default PlantDropdownModal
