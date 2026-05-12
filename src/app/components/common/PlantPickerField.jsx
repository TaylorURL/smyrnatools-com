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
            <div className="flex flex-col gap-1">
                <label htmlFor={htmlFor}>{label}</label>
                <button
                    type="button"
                    onClick={openPicker}
                    aria-label={`Select ${label.replace('*', '').toLowerCase()}`}
                >
                    {plantDisplayText}
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
