import React from 'react'

import { getPlantNameFromList, POSITIONS } from '../../../constants/rmiReportConstants'
import { FIELD_INPUT_CLASS, FIELD_SELECT_CLASS, FIELD_STYLE } from '../../../constants/weeklyReportConstants'
import { FormModal, ModalField } from './RmiAtoms'

/** "Add trainer" form modal — pick position + existing trainer + plant.
 *  Emits `onOpenPlantPicker` when the plant button is pressed; the
 *  orchestrator owns the shared plant picker so both Add modals share it. */
export default function RmiAddTrainerModal({
    availableTrainers,
    isOpen,
    onClose,
    onOpenPlantPicker,
    onSubmit,
    plants,
    setTrainer,
    trainer
}) {
    return (
        <FormModal
            icon="fa-user-plus"
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            submitLabel="Add Trainer"
            title="Add Trainer"
            sub="Select an existing trainer from your region."
        >
            <ModalField icon="fa-briefcase" label="Position" required>
                <select
                    value={trainer.position}
                    onChange={(e) => setTrainer({ ...trainer, position: e.target.value, trainerId: '' })}
                    className={FIELD_SELECT_CLASS}
                    style={FIELD_STYLE}
                >
                    <option value={POSITIONS.MIXER}>Mixer Operator</option>
                    <option value={POSITIONS.TRACTOR}>Tractor Operator</option>
                </select>
            </ModalField>
            <ModalField icon="fa-user-tie" label="Select Trainer" required>
                <select
                    value={trainer.trainerId}
                    onChange={(e) => setTrainer({ ...trainer, trainerId: e.target.value })}
                    className={FIELD_SELECT_CLASS}
                    style={FIELD_STYLE}
                >
                    <option value="">Choose a trainer…</option>
                    {availableTrainers.map((t) => (
                        <option key={t.employeeId} value={t.employeeId}>
                            {t.name} · {getPlantNameFromList(t.plantCode, plants)}
                        </option>
                    ))}
                </select>
                {availableTrainers.length === 0 && (
                    <span className="text-[10.5px] text-text-tertiary">No trainers available for this position.</span>
                )}
            </ModalField>
            <ModalField icon="fa-industry" label="Assign to Plant" required>
                <button type="button"
                    className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer`}
                    style={FIELD_STYLE}
                    onClick={onOpenPlantPicker}
                >
                    <span>{trainer.plant ? getPlantNameFromList(trainer.plant, plants) : 'Select plant…'}</span>
                    <i className="fas fa-chevron-down text-[9px] text-text-tertiary" />
                </button>
            </ModalField>
        </FormModal>
    )
}
