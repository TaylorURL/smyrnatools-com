import React, { useMemo, useState } from 'react'

import { StatisticsTimeRange } from '../../common/StatisticsTimeRange'

const OPTION_CLASS =
    'flex h-8 w-full items-center rounded-[4px] border-none px-2.5 text-left text-[13px] cursor-pointer text-text-primary transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent'
const OPTION_ON = 'bg-bg-tertiary font-medium'
const OPTION_OFF = 'bg-transparent hover:bg-bg-hover'

/** Plant filter for the person Statistics page — identical chrome to the
 *  asset version so the surfaces feel like one product. Defaults to "All
 *  plants" because the most-asked question is roster-wide health. */
function PlantFilterMenu({ availablePlants, selectedPlant, setSelectedPlant }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((s) => !s)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Filter every chart and table to a single plant"
                className="btn-secondary"
            >
                <span>{selectedPlant ? `Plant · ${selectedPlant}` : 'All plants'}</span>
                <i className="fas fa-chevron-down text-[10px] text-text-tertiary" aria-hidden="true" />
            </button>
            {open && (
                <div
                    role="listbox"
                    className="absolute left-0 top-full mt-1 rounded-card p-1 shadow-modal z-raised min-w-[240px] max-h-[320px] overflow-y-auto bg-bg-primary border border-border-light"
                >
                    <button
                        type="button"
                        role="option"
                        aria-selected={!selectedPlant}
                        onClick={() => {
                            setSelectedPlant('')
                            setOpen(false)
                        }}
                        className={`${OPTION_CLASS} ${!selectedPlant ? OPTION_ON : OPTION_OFF}`}
                    >
                        All plants
                    </button>
                    {availablePlants.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-text-tertiary">No plants in scope</div>
                    ) : (
                        availablePlants.map(({ code, label }) => {
                            const isActive = selectedPlant === code
                            return (
                                <button
                                    type="button"
                                    key={code}
                                    role="option"
                                    aria-selected={isActive}
                                    onClick={() => {
                                        setSelectedPlant(code)
                                        setOpen(false)
                                    }}
                                    className={`${OPTION_CLASS} ${isActive ? OPTION_ON : OPTION_OFF}`}
                                >
                                    <span className="truncate">{label}</span>
                                </button>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}

export function PersonStatisticsControls({
    accentColor,
    availablePlantCodes,
    period,
    plantNames,
    selectedPlant,
    setSelectedPlant,
    ...periodProps
}) {
    const availablePlants = useMemo(
        () =>
            availablePlantCodes.map((code) => ({
                code,
                label: plantNames?.get(code) ? `${code} · ${plantNames.get(code)}` : code
            })),
        [availablePlantCodes, plantNames]
    )
    return (
        <div className="flex flex-wrap items-center gap-2">
            <StatisticsTimeRange accentColor={accentColor} period={period} {...periodProps} />
            <span className="hidden md:inline-block w-px h-5 bg-border-light mx-1" aria-hidden="true" />
            <PlantFilterMenu
                availablePlants={availablePlants}
                selectedPlant={selectedPlant}
                setSelectedPlant={setSelectedPlant}
            />
            {selectedPlant && (
                <button
                    type="button"
                    onClick={() => setSelectedPlant('')}
                    className="text-[13px] border-none bg-transparent cursor-pointer text-text-secondary underline-offset-2 hover:text-text-primary hover:underline transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1"
                >
                    Clear plant
                </button>
            )}
        </div>
    )
}

export default PersonStatisticsControls
