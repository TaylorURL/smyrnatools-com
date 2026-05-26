import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'

/**
 * "Assignment" card — primary plant, additional plants (multi-select chips),
 * and role dropdown. Pure presentational; all state lives in the parent.
 */
export default function ManagerAssignmentCard({
    plantDisplayText,
    onOpenPlantModal,
    additionalPlants,
    onOpenAdditionalPlantsModal,
    onRemoveAdditionalPlant,
    plants,
    roleName,
    onRoleNameChange,
    availableRoles,
    isReadOnly,
    canEditManager
}) {
    const readOnly = isReadOnly || !canEditManager
    return (
        <DetailViewSection.Card title="Assignment" icon="fas fa-building">
            <div className="flex flex-col gap-1.5">
                <label>Plant</label>
                <button
                    className={`w-full rounded-xl border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary text-left outline-none transition-colors focus:border-accent ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !readOnly && onOpenPlantModal()}
                    type="button"
                    disabled={readOnly}
                >
                    <span className="block overflow-hidden text-ellipsis">{plantDisplayText}</span>
                </button>
            </div>
            <div className="flex flex-col gap-1.5">
                <label>Additional Plants</label>
                <button
                    className={`w-full rounded-xl border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary text-left outline-none transition-colors focus:border-accent ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !readOnly && onOpenAdditionalPlantsModal()}
                    type="button"
                    disabled={readOnly}
                >
                    <span className="block overflow-hidden text-ellipsis">
                        {additionalPlants.length
                            ? additionalPlants
                                  .map((code) => {
                                      const p = plants.find((pl) => pl.plant_code === code)
                                      return `(${code}) ${p?.plant_name || ''}`
                                  })
                                  .join(', ')
                            : 'No additional plants'}
                    </span>
                </button>
                {additionalPlants.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {additionalPlants.map((code) => {
                            const p = plants.find((pl) => pl.plant_code === code)
                            return (
                                <span
                                    key={code}
                                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                                >
                                    ({code}) {p?.plant_name || ''}
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            className="ml-1 rounded text-accent/70 transition-colors duration-150 hover:bg-accent/20 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.92]"
                                            onClick={() => onRemoveAdditionalPlant(code)}
                                            aria-label={`Remove plant ${code}`}
                                        >
                                            <i className="fas fa-times text-[10px]" aria-hidden="true" />
                                        </button>
                                    )}
                                </span>
                            )
                        })}
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <label>Role</label>
                <div className="relative">
                    <select
                        value={roleName}
                        onChange={(e) => onRoleNameChange(e.target.value)}
                        className={`w-full appearance-none rounded-xl border border-border-light bg-bg-secondary pl-4 pr-10 py-3 text-sm outline-none transition-colors focus:border-accent ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${roleName ? 'text-text-primary' : 'text-text-secondary'}`}
                        disabled={readOnly || !availableRoles.length || !roleName}
                    >
                        {!availableRoles.length || !roleName ? (
                            <option value={roleName}>{roleName || 'Loading...'}</option>
                        ) : (
                            availableRoles.map((role) => (
                                <option key={role.id} value={role.name}>
                                    {role.name}
                                </option>
                            ))
                        )}
                    </select>
                    <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-secondary pointer-events-none" />
                </div>
            </div>
        </DetailViewSection.Card>
    )
}
