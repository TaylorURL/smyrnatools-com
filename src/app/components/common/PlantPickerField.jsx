import React from 'react'

import { DIALOG_INPUT, DialogField } from '../ui/Dialog'
import PlantDropdownModal from './PlantDropdownModal'

/**
 * Plant-picker field used by every add form: a label plus a trigger button
 * that opens a `PlantDropdownModal`. Bundles the picker UI with its modal so
 * each consumer only has to thread through the state `usePlantPicker`
 * returns.
 *
 * The label and the trigger are DialogField and DIALOG_INPUT, so the plant
 * field reads like the inputs and selects beside it.
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
    const accessibleLabel = `Select ${label.replace('*', '').trim().toLowerCase()}`
    return (
        <>
            <DialogField label={label} htmlFor={htmlFor}>
                <button
                    type="button"
                    id={htmlFor}
                    onClick={openPicker}
                    aria-label={accessibleLabel}
                    aria-haspopup="dialog"
                    aria-expanded={!!isPlantModalOpen}
                    className={`${DIALOG_INPUT} flex cursor-pointer items-center justify-between gap-2 text-left motion-reduce:transition-none`}
                >
                    <span className="truncate">{plantDisplayText}</span>
                    <i className="fas fa-chevron-down shrink-0 text-[10px] text-text-tertiary" aria-hidden="true" />
                </button>
            </DialogField>
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
