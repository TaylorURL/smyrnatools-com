import React from 'react'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'

/**
 * Renders the stacked modal layer for the manager detail view — primary plant
 * picker and the multi-select additional-plants picker.
 */
export default function ManagerDetailModals({
    showPlantModal,
    onClosePlantModal,
    filteredPlants,
    onSelectPlant,
    showAdditionalPlantsModal,
    onCloseAdditionalPlantsModal,
    additionalPlantOptions,
    onToggleAdditionalPlant,
    additionalPlants
}) {
    return (
        <>
            {showPlantModal && (
                <PlantDropdownModal
                    isOpen={showPlantModal}
                    onClose={onClosePlantModal}
                    plants={filteredPlants}
                    onSelect={onSelectPlant}
                />
            )}
            {showAdditionalPlantsModal && (
                <PlantDropdownModal
                    isOpen={showAdditionalPlantsModal}
                    onClose={onCloseAdditionalPlantsModal}
                    plants={additionalPlantOptions}
                    onSelect={onToggleAdditionalPlant}
                    allowMultiple={true}
                    selectedPlantCodes={additionalPlants}
                />
            )}
        </>
    )
}
