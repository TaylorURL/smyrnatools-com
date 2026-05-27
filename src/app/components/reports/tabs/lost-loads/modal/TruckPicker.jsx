/* eslint-disable react/forbid-dom-props */
import React from 'react'

function TruckPicker({
    accentColor,
    truckNumber,
    setTruckNumber,
    truckPickerOpen,
    setTruckPickerOpen,
    truckSearch,
    setTruckSearch,
    regionalMixers,
    operatorMap
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Truck Number</label>
            <button
                type="button"
                onClick={() => setTruckPickerOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={truckPickerOpen}
                aria-label="Select truck"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors duration-150 bg-bg-primary border border-border-light text-text-primary hover:border-border-medium focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
            >
                {truckNumber ? (
                    <span className="flex items-center gap-2 text-text-primary">
                        <span
                            className="px-2 py-0.5 rounded-md text-xs font-bold text-white"
                            style={{ backgroundColor: accentColor }}
                        >
                            #{truckNumber}
                        </span>
                        <span className="text-text-secondary">
                            {operatorMap[regionalMixers.find((m) => m.truckNumber === truckNumber)?.assignedOperator] ||
                                'Unassigned'}
                        </span>
                    </span>
                ) : (
                    <span className="text-text-secondary">Select truck...</span>
                )}
                <i className={`fas fa-chevron-${truckPickerOpen ? 'up' : 'down'} text-xs text-text-secondary`} />
            </button>
            {truckPickerOpen && (
                <div className="rounded-lg overflow-hidden shadow-md bg-bg-primary border border-border-light">
                    <div className="p-2 border-b border-border-light">
                        <input
                            type="search"
                            value={truckSearch}
                            onChange={(e) => setTruckSearch(e.target.value)}
                            placeholder="Search truck #, operator, or plant..."
                            aria-label="Search trucks"
                            className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent bg-bg-secondary border border-border-light text-text-primary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                            autoFocus
                        />
                    </div>
                    {regionalMixers.length === 0 ? (
                        <div className="px-4 py-5 text-center text-sm text-text-secondary">
                            <i className="fas fa-truck mb-2 text-lg block" />
                            No mixers found
                        </div>
                    ) : (
                        <div
                            role="listbox"
                            aria-label="Trucks"
                            className="max-h-48 overflow-y-auto border-border-light"
                        >
                            {regionalMixers.map((m) => {
                                const opName = operatorMap[m.assignedOperator] || null
                                const isSelected = truckNumber === m.truckNumber
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            setTruckNumber(m.truckNumber)
                                            setTruckPickerOpen(false)
                                            setTruckSearch('')
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset"
                                        style={isSelected ? { backgroundColor: `${accentColor}08` } : {}}
                                    >
                                        <span
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-white flex-shrink-0"
                                            style={{
                                                backgroundColor: isSelected ? accentColor : '#94a3b8'
                                            }}
                                        >
                                            #{m.truckNumber}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            {opName ? (
                                                <span className="text-sm font-medium truncate block text-text-primary">
                                                    {opName}
                                                </span>
                                            ) : (
                                                <span className="text-sm italic text-text-secondary">Unassigned</span>
                                            )}
                                        </span>
                                        <span className="text-[10px] font-medium flex-shrink-0 text-text-secondary">
                                            {m.assignedPlant || '-'}
                                        </span>
                                        {isSelected && (
                                            <i
                                                className="fas fa-check text-xs flex-shrink-0"
                                                style={{ color: accentColor }}
                                            />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default TruckPicker
