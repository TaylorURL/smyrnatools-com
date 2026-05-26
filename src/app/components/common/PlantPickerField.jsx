import React from 'react'

import PlantDropdownModal from './PlantDropdownModal'

/**
 * Standard plant-picker field used by every asset Add view: an inline label +
 * button that opens a `PlantDropdownModal`. Bundles the picker UI with its
 * modal so each consumer just wires in the state from `usePlantPicker`.
 *
 * Renders nothing visible for the modal portion when it is closed.
 */
function PlantPickerField({
    closePicker,
    htmlFor = 'assignedPlant',
    isPlantModalOpen,
    label = 'Assigned Plant*',
    openPicker,
    plantDisplayText,
    plants,
    selectPlant
}) {
    return (
        <>
            <div className="flex flex-col gap-1.5">
                <label htmlFor={htmlFor} className="text-sm font-medium text-text-secondary">
                    {label}
                </label>
                <button
                    type="button"
                    id={htmlFor}
                    onClick={openPicker}
                    aria-haspopup="dialog"
                    aria-expanded={!!isPlantModalOpen}
                    aria-label={`Select ${label.replace('*', '').toLowerCase()}`}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border-light bg-bg-secondary px-4 py-3 text-left text-sm text-text-primary outline-none transition-colors duration-150 hover:border-border-medium hover:bg-bg-tertiary focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.99] motion-reduce:active:scale-100"
                >
                    <span className="truncate">{plantDisplayText}</span>
                    <i className="fas fa-chevron-down text-[10px] text-text-tertiary" aria-hidden="true" />
                </button>
            </div>
            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={closePicker}
                    onSelect={selectPlant}
                    plants={plants}
                />
            )}
        </>
    )
}

export default PlantPickerField
