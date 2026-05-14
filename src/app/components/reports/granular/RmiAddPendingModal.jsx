import React from 'react'

import { getPlantNameFromList, POSITIONS } from '../../../constants/rmiReportConstants'
import { FIELD_INPUT_CLASS, FIELD_STYLE } from '../../../constants/weeklyReportConstants'
import { FormModal, ModalField } from './RmiAtoms'

/** "Add pending operator" form modal — pick position + name + plant + start
 *  date + optional trainer. The plant picker is opened via the orchestrator
 *  so both Add modals share it. */
export default function RmiAddPendingModal({
    isOpen,
    onClose,
    onOpenPlantPicker,
    onSubmit,
    pending,
    plants,
    setPending
}) {
    return (
        <FormModal
            icon="fa-user-clock"
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            submitLabel="Add Operator"
            title="Add Pending Start Operator"
            sub="Add a new operator awaiting start date."
        >
            <ModalField icon="fa-briefcase" label="Position" required>
                <select
                    value={pending.position}
                    onChange={(e) => setPending({ ...pending, position: e.target.value })}
                    className={`${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8`}
                    style={FIELD_STYLE}
                >
                    <option value={POSITIONS.MIXER}>Mixer Operator</option>
                    <option value={POSITIONS.TRACTOR}>Tractor Operator</option>
                </select>
            </ModalField>
            <ModalField icon="fa-user" label="Operator Name" required>
                <input
                    type="text"
                    value={pending.name}
                    onChange={(e) => setPending({ ...pending, name: e.target.value })}
                    className={FIELD_INPUT_CLASS}
                    style={FIELD_STYLE}
                    placeholder="Enter operator name"
                />
            </ModalField>
            <ModalField icon="fa-industry" label="Assign to Plant" required>
                <button
                    type="button"
                    className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer`}
                    style={FIELD_STYLE}
                    onClick={onOpenPlantPicker}
                >
                    <span>{pending.plant ? getPlantNameFromList(pending.plant, plants) : 'Select plant…'}</span>
                    <i className="fas fa-chevron-down text-[9px] text-text-tertiary" />
                </button>
            </ModalField>
            <ModalField icon="fa-calendar-alt" label="Start Date" required>
                <input
                    type="date"
                    value={pending.startDate}
                    onChange={(e) => setPending({ ...pending, startDate: e.target.value })}
                    className={`${FIELD_INPUT_CLASS} tabular-nums`}
                    style={FIELD_STYLE}
                />
            </ModalField>
            <ModalField icon="fa-chalkboard-teacher" label="Assigned Trainer">
                <input
                    type="text"
                    value={pending.trainer}
                    onChange={(e) => setPending({ ...pending, trainer: e.target.value })}
                    className={FIELD_INPUT_CLASS}
                    style={FIELD_STYLE}
                    placeholder="Enter trainer name (optional)"
                />
            </ModalField>
        </FormModal>
    )
}
