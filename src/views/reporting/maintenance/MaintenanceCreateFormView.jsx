import React from 'react'

import { useAccentColor } from '../../../app/hooks/useAccentColor'
import { useMaintenanceForm } from '../../../app/hooks/useMaintenanceForm'
import { AssignedRolesSection } from './create/AssignedRolesSection'
import { PrimaryButton, SubtleButton } from './create/atoms'
import { DeleteConfirmModal } from './create/DeleteConfirmModal'
import { FormDetailsSection } from './create/FormDetailsSection'
import { FormFieldsSection } from './create/FormFieldsSection'
import { PageHeader } from './create/PageHeader'

/**
 * Form builder for creating or editing a maintenance form definition.
 * Plan-tab aesthetic: flat 1px borders, 6px radius, var() tokens, 10/9.5px
 * uppercase tracked-wider labels. All business logic preserved.
 */
export default function MaintenanceCreateFormView({ editingForm, onBack, onSaved }) {
    const accentColor = useAccentColor()
    const form = useMaintenanceForm({ editingForm, onSaved })

    return (
        <div className="min-h-screen w-full bg-bg-secondary">
            <PageHeader
                accentColor={accentColor}
                editingForm={editingForm}
                onBack={onBack}
                onRequestDelete={() => form.setShowDeleteConfirm(true)}
            />

            <div className="mx-auto max-w-[960px] px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-3">
                <FormDetailsSection
                    accentColor={accentColor}
                    availablePlants={form.availablePlants}
                    description={form.description}
                    errors={form.errors}
                    frequency={form.frequency}
                    frequencyValue={form.frequencyValue}
                    selectedPlants={form.selectedPlants}
                    setDescription={form.setDescription}
                    setFrequency={form.setFrequency}
                    setFrequencyValue={form.setFrequencyValue}
                    setSelectedPlants={form.setSelectedPlants}
                    setShowPlantModal={form.setShowPlantModal}
                    setStartDate={form.setStartDate}
                    setTitle={form.setTitle}
                    showPlantModal={form.showPlantModal}
                    startDate={form.startDate}
                    title={form.title}
                />

                <AssignedRolesSection
                    accentColor={accentColor}
                    assignedRoles={form.assignedRoles}
                    availableRoles={form.availableRoles}
                    errors={form.errors}
                    setShowRoleSelector={form.setShowRoleSelector}
                    showRoleSelector={form.showRoleSelector}
                    toggleRole={form.toggleRole}
                />

                <FormFieldsSection
                    accentColor={accentColor}
                    addChecklistItem={form.addChecklistItem}
                    addField={form.addField}
                    errors={form.errors}
                    fields={form.fields}
                    moveField={form.moveField}
                    removeChecklistItem={form.removeChecklistItem}
                    removeField={form.removeField}
                    updateChecklistItem={form.updateChecklistItem}
                    updateField={form.updateField}
                />

                {form.errors.save && (
                    <div className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-medium bg-red-100 border border-red-300 text-text-primary">
                        <i className="fas fa-exclamation-circle text-[11px]" />
                        <span>{form.errors.save}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <SubtleButton onClick={onBack}>Cancel</SubtleButton>
                    <PrimaryButton
                        accentColor={accentColor}
                        disabled={form.saving}
                        icon={form.saving ? 'fa-spinner fa-spin' : 'fa-save'}
                        onClick={form.handleSave}
                    >
                        {form.saving ? 'Saving…' : editingForm ? 'Update Form' : 'Create Form'}
                    </PrimaryButton>
                </div>
            </div>

            {form.showDeleteConfirm && (
                <DeleteConfirmModal
                    onCancel={() => form.setShowDeleteConfirm(false)}
                    onConfirm={form.handleDelete}
                    saving={form.saving}
                />
            )}
        </div>
    )
}
