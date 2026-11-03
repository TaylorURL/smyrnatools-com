import React, { useEffect, useMemo, useState } from 'react'

import Dialog from '../ui/Dialog'
import DialogListRow from './DialogListRow'
import DialogSearchField from './DialogSearchField'
import useDialogClose from './useDialogClose'

const plantCodeOf = (plant) => plant.plantCode || plant.plant_code || ''
const plantNameOf = (plant) => plant.plantName || plant.plant_name || ''
const numericRank = (code) => parseInt(String(code).replace(/\D/g, '') || '0', 10)

const sortPlantsByCode = (list) =>
    [...list].sort((a, b) => {
        const codeA = plantCodeOf(a)
        const codeB = plantCodeOf(b)
        if (codeA === 'OTHER_REGION') return 1
        if (codeB === 'OTHER_REGION') return -1
        return numericRank(codeA) - numericRank(codeB)
    })

/** Compute the district groupings from a flat plants list. Each plant can
 *  contribute to multiple districts via its `.districts` array. */
const computeDistrictGroups = (plants) => {
    const map = {}
    plants.forEach((plant) => {
        const code = plantCodeOf(plant)
        const districts = plant.districts || []
        districts.forEach((district) => {
            const name = typeof district === 'string' ? district : district?.name
            if (!name) return
            if (!map[name]) map[name] = []
            map[name].push(code)
        })
    })
    return Object.entries(map)
        .map(([name, plantCodes]) => ({ name, plantCodes }))
        .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The plant picker: search in the toolbar, then plain ruled rows with the
 * plant code in a mono column. In single-select mode a pick closes it; with
 * `allowMultiple` every row is a checkbox and the footer clears or finishes.
 * Above the plants it can offer "All plants", "My plants", the districts the
 * plants belong to, or (with `regionGroups`) every region with its districts
 * and plants folded under it.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Array<Object>} [props.plants]
 * @param {Function} props.onSelect
 * @param {string} [props.searchPlaceholder]
 * @param {boolean} [props.showAllPlants=false]
 * @param {boolean} [props.showMyPlants=false]
 * @param {boolean} [props.allowMultiple=false]
 * @param {string[]} [props.selectedPlantCodes]
 * @param {string} [props.selectedPlantCode] Current value in single-select
 *   mode ('' or 'All' for every plant), so the open list can mark it.
 * @param {string} [props.userPlantCode]
 * @param {Array<Object>} [props.regionGroups]
 */
function PlantDropdownModal({
    isOpen,
    onClose,
    plants = [],
    onSelect,
    searchPlaceholder = 'Search plants…',
    showAllPlants = false,
    showMyPlants = false,
    allowMultiple = false,
    selectedPlantCodes = [],
    selectedPlantCode,
    userPlantCode = '',
    regionGroups = []
}) {
    const [search, setSearch] = useState('')
    const [localSelectedCodes, setLocalSelectedCodes] = useState(selectedPlantCodes || [])
    const [expandedRegions, setExpandedRegions] = useState({})
    const { anchorRef, handleClose } = useDialogClose(onClose)

    useEffect(() => {
        if (isOpen) setLocalSelectedCodes(selectedPlantCodes || [])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    useEffect(() => {
        if (isOpen) setExpandedRegions({})
    }, [isOpen])

    const districtGroups = useMemo(() => computeDistrictGroups(plants), [plants])
    const userDistrict = useMemo(
        () => (userPlantCode ? districtGroups.find((d) => d.plantCodes.includes(userPlantCode)) : null),
        [districtGroups, userPlantCode]
    )

    const filteredPlants = useMemo(() => {
        const term = search.toLowerCase()
        if (!term) return plants
        return plants.filter((plant) => {
            const code = plantCodeOf(plant).toLowerCase()
            const name = plantNameOf(plant).toLowerCase()
            return code.includes(term) || name.includes(term)
        })
    }, [plants, search])

    const sortedPlants = useMemo(() => sortPlantsByCode(filteredPlants), [filteredPlants])

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
        const currentlyAllSelected = codes.every((code) => localSelectedCodes.includes(code))
        setLocalSelectedCodes((prev) => {
            const set = new Set(prev)
            codes.forEach((code) => {
                if (currentlyAllSelected) set.delete(code)
                else set.add(code)
            })
            return [...set]
        })
        codes.forEach((code) => {
            const already = localSelectedCodes.includes(code)
            if (currentlyAllSelected && already) onSelect(code)
            else if (!currentlyAllSelected && !already) onSelect(code)
        })
    }

    if (!isOpen || typeof document === 'undefined' || !document.body) return null

    const hasRegions = regionGroups && regionGroups.length > 0
    const searchActive = search.trim().length > 0
    // The region accordion already lists every plant under its region, so
    // the flat list waits for a search there.
    const showFlatPlants = allowMultiple || !hasRegions || searchActive
    // A "Plants" band only where other rows sit above the plants.
    const hasRowsAbovePlants =
        (!allowMultiple && (showAllPlants || showMyPlants || hasRegions)) || districtGroups.length > 0

    return (
        <Dialog
            open
            onClose={handleClose}
            size="md"
            tall
            title={allowMultiple ? 'Select plants' : 'Select plant'}
            zClassName="z-system"
            bodyClassName="p-0"
            toolbar={
                <DialogSearchField
                    autoFocus
                    label={searchPlaceholder}
                    onChange={setSearch}
                    placeholder={searchPlaceholder}
                    value={search}
                />
            }
            footer={
                allowMultiple ? (
                    <>
                        <span className="mr-auto text-[12px] tabular-nums text-text-secondary">
                            {localSelectedCodes.length} selected
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                // Emit a toggle for every currently selected
                                // code so the parent's per-event reducer
                                // shrinks back to nothing.
                                localSelectedCodes.forEach((code) => onSelect(code))
                                setLocalSelectedCodes([])
                            }}
                            disabled={localSelectedCodes.length === 0}
                            className="btn-secondary"
                        >
                            Clear
                        </button>
                        <button type="button" onClick={onClose} className="btn-primary">
                            Done
                        </button>
                    </>
                ) : undefined
            }
        >
            <div ref={anchorRef} role="listbox" aria-label={allowMultiple ? 'Plants' : 'Plant'}>
                {showAllPlants && !allowMultiple && (
                    <PickerRow
                        selected={
                            selectedPlantCode !== undefined && (!selectedPlantCode || selectedPlantCode === 'All')
                        }
                        onClick={() => {
                            onSelect('All')
                            onClose()
                        }}
                    >
                        All plants
                    </PickerRow>
                )}
                {showMyPlants && !allowMultiple && (
                    <PickerRow
                        selected={selectedPlantCode === 'MY_PLANTS'}
                        onClick={() => {
                            onSelect('MY_PLANTS')
                            onClose()
                        }}
                    >
                        My plants
                    </PickerRow>
                )}

                {!allowMultiple && hasRegions && !searchActive && (
                    <>
                        <GroupHeader>Regions</GroupHeader>
                        {regionGroups.map((region) => {
                            const isExpanded = !!expandedRegions[region.code]
                            const districts = region.districts || []
                            const regionPlants = sortPlantsByCode(region.plants || [])
                            return (
                                <div key={region.code}>
                                    <div className="flex items-center border-b border-border-light transition-colors duration-150 hover:bg-bg-hover motion-reduce:transition-none">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedRegions((prev) => ({
                                                    ...prev,
                                                    [region.code]: !prev[region.code]
                                                }))
                                            }
                                            aria-label={isExpanded ? 'Collapse region' : 'Expand region'}
                                            aria-expanded={isExpanded}
                                            className="ml-4 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent text-text-tertiary transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                                        >
                                            <i
                                                className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[11px]`}
                                                aria-hidden="true"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={false}
                                            onClick={() => {
                                                onSelect(`REGION:${region.code}`)
                                                onClose()
                                            }}
                                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent py-3 pl-2 pr-6 text-left text-[13px] font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                                        >
                                            <span className="min-w-0 flex-1 truncate">{region.name}</span>
                                            <span className="text-[12px] font-normal tabular-nums text-text-tertiary">
                                                {region.plantCodes?.length || 0}
                                            </span>
                                        </button>
                                    </div>
                                    {isExpanded && (
                                        <>
                                            {districts.length > 0 && (
                                                <>
                                                    <NestedLabel>Districts</NestedLabel>
                                                    {districts.map((district) => (
                                                        <PickerRow
                                                            key={`${region.code}:${district.name}`}
                                                            indent
                                                            count={district.plantCodes.length}
                                                            onClick={() => {
                                                                onSelect(`DISTRICT:${district.name}`)
                                                                onClose()
                                                            }}
                                                        >
                                                            {district.name}
                                                        </PickerRow>
                                                    ))}
                                                </>
                                            )}
                                            {regionPlants.length > 0 && (
                                                <>
                                                    <NestedLabel>Plants</NestedLabel>
                                                    {regionPlants.map((plant) => {
                                                        const code = plantCodeOf(plant)
                                                        return (
                                                            <PickerRow
                                                                key={`${region.code}:${code}`}
                                                                indent
                                                                code={code}
                                                                onClick={() => {
                                                                    onSelect(code)
                                                                    onClose()
                                                                }}
                                                            >
                                                                {plantNameOf(plant)}
                                                            </PickerRow>
                                                        )
                                                    })}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </>
                )}

                {!allowMultiple && !hasRegions && districtGroups.length > 0 && (
                    <>
                        <GroupHeader>Districts</GroupHeader>
                        {userDistrict && (
                            <PickerRow
                                onClick={() => {
                                    onSelect(`DISTRICT:${userDistrict.name}`)
                                    onClose()
                                }}
                                count={userDistrict.plantCodes.length}
                            >
                                My district
                            </PickerRow>
                        )}
                        {districtGroups.map((district) => (
                            <PickerRow
                                key={district.name}
                                onClick={() => {
                                    onSelect(`DISTRICT:${district.name}`)
                                    onClose()
                                }}
                                count={district.plantCodes.length}
                            >
                                {district.name}
                            </PickerRow>
                        ))}
                    </>
                )}

                {allowMultiple && districtGroups.length > 0 && (
                    <>
                        <GroupHeader hint="Pick one to toggle every plant in it">Districts</GroupHeader>
                        {districtGroups.map((district) => {
                            const codes = district.plantCodes
                            const selectedInDistrict = codes.filter((code) => localSelectedCodes.includes(code)).length
                            const allSelected = codes.length > 0 && selectedInDistrict === codes.length
                            const partial = selectedInDistrict > 0 && !allSelected
                            return (
                                <DialogListRow
                                    key={district.name}
                                    role="option"
                                    current={allSelected}
                                    onClick={() => handleDistrictClickMulti(district)}
                                    leading={<RowCheckbox checked={allSelected} indeterminate={partial} />}
                                    title={district.name}
                                    aside={<RowCount>{`${selectedInDistrict}/${codes.length}`}</RowCount>}
                                />
                            )
                        })}
                    </>
                )}

                {showFlatPlants && sortedPlants.length > 0 && (
                    <>
                        {hasRowsAbovePlants && <GroupHeader>Plants</GroupHeader>}
                        {sortedPlants.map((plant) => {
                            const code = plantCodeOf(plant)
                            const isSelected = allowMultiple
                                ? localSelectedCodes.includes(code)
                                : selectedPlantCode === code
                            return (
                                <DialogListRow
                                    key={code}
                                    role="option"
                                    current={isSelected}
                                    onClick={() => handlePlantClick(code)}
                                    leading={
                                        <>
                                            {allowMultiple && <RowCheckbox checked={isSelected} />}
                                            <PlantCode code={code} />
                                        </>
                                    }
                                    title={plantNameOf(plant)}
                                />
                            )
                        })}
                    </>
                )}

                {sortedPlants.length === 0 && searchActive && (
                    <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 px-6 text-center">
                        <p className="m-0 text-[15px] font-medium text-text-primary">No plants match “{search}”</p>
                        <p className="m-0 text-[13px] text-text-secondary">Try a plant code or part of the name.</p>
                    </div>
                )}
            </div>
        </Dialog>
    )
}

/** Plant code in its fixed-width mono column, so names line up. */
function PlantCode({ code }) {
    return <span className="w-12 shrink-0 truncate font-mono text-[12px] tabular-nums text-text-secondary">{code}</span>
}

/** The checkbox a multi-select row leads with. It only shows the row's state;
 *  the row itself is the control, so the box stays out of the tab order. */
function RowCheckbox({ checked, indeterminate = false }) {
    return (
        <input
            type="checkbox"
            checked={checked}
            ref={(el) => {
                if (el) el.indeterminate = indeterminate
            }}
            onChange={() => {}}
            className="h-4 w-4 shrink-0 accent-accent"
            tabIndex={-1}
        />
    )
}

/** A plain figure on the right of a row: plants in a district or region. */
function RowCount({ children }) {
    return <span className="text-[12px] font-normal tabular-nums text-text-tertiary">{children}</span>
}

/** A single-select row: a plant (with `code`), or a choice above the plants
 *  such as All plants or a district (with an optional `count`). */
function PickerRow({ children, code, count, indent = false, onClick, selected = false }) {
    return (
        <DialogListRow
            role="option"
            current={selected}
            indent={indent}
            onClick={onClick}
            leading={code !== undefined && <PlantCode code={code} />}
            title={children}
            aside={count != null && <RowCount>{count}</RowCount>}
        />
    )
}

/** The band that starts a group of rows, as in a table head. */
function GroupHeader({ children, hint }) {
    return (
        <div className="flex items-baseline gap-3 border-b border-border-light bg-bg-secondary px-6 py-2 text-[12px] font-medium text-text-secondary">
            <span className="flex-1">{children}</span>
            {hint && <span className="font-normal text-text-tertiary">{hint}</span>}
        </div>
    )
}

/** A small label over the districts or plants of an open region. */
function NestedLabel({ children }) {
    return <div className="pb-1 pl-14 pr-6 pt-3 text-[12px] font-medium text-text-tertiary">{children}</div>
}

export default PlantDropdownModal
