import React from 'react'

import Badge from '../../../../app/components/common/Badge'
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
                                <Badge
                                    key={code}
                                    tone="accent"
                                    size="md"
                                    shape="pill"
                                    weight="medium"
                                    uppercase={false}
                                    removable={!readOnly}
                                    onRemove={() => onRemoveAdditionalPlant(code)}
                                >
                                    ({code}) {p?.plant_name || ''}
                                </Badge>
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
