/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { TractorService } from '../../../services/TractorService'
import {
    READ_ONLY_BUTTON_STYLE,
    READ_ONLY_OPERATOR_BUTTON_STYLE,
    UNDO_BUTTON_STYLE
} from '../../constants/tractorDetailConstants'

/**
 * Plant + operator assignment block from the tractor detail. Owns the
 * three flow paths around the assigned-operator button: opening the picker
 * modal, unassigning (with status set to Spare), and the time-limited
 * "Undo Unassign" button shown until a different operator is re-picked.
 */
function TractorOperatorAssignmentField({
    assignedOperator,
    canEditTractor,
    fetchOperatorsForModal,
    getOperatorName,
    handleSave,
    lastUnassignedOperatorId,
    operators,
    plantDisplayText,
    refreshOperators,
    setAssignedOperator,
    setLastUnassignedOperatorId,
    setMessage,
    setShowOperatorModal,
    setShowPlantModal,
    setStatus,
    setTractor,
    showOperatorModal,
    tractorId
}) {
    const flashMessage = (text, ms = 3000) => {
        setMessage(text)
        setTimeout(() => setMessage(''), ms)
    }

    async function handleUnassign() {
        try {
            const prevOperator = assignedOperator
            await handleSave({
                assignedOperator: null,
                prevAssignedOperator: prevOperator,
                status: 'Spare'
            })
            setAssignedOperator(null)
            setStatus('Spare')
            setLastUnassignedOperatorId(prevOperator)
            await refreshOperators()
            await fetchOperatorsForModal()
            const updatedTractor = await TractorService.fetchTractorById(tractorId)
            setTractor(updatedTractor)
            flashMessage('Operator unassigned and status set to Spare')
            if (showOperatorModal) {
                setShowOperatorModal(false)
                setTimeout(() => setShowOperatorModal(true), 0)
            }
        } catch {
            flashMessage('Error unassigning operator. Please try again.')
        }
    }

    async function handleUndoUnassign() {
        try {
            await handleSave({
                assignedOperator: lastUnassignedOperatorId,
                status: 'Active'
            })
            setAssignedOperator(lastUnassignedOperatorId)
            setStatus('Active')
            setLastUnassignedOperatorId(null)
            await refreshOperators()
            await fetchOperatorsForModal()
            const updatedTractor = await TractorService.fetchTractorById(tractorId)
            setTractor(updatedTractor)
            flashMessage('Operator re-assigned and status set to Active')
        } catch {
            flashMessage('Error undoing unassign. Please try again.')
        }
    }

    const readOnlyPlantStyle = !canEditTractor ? READ_ONLY_BUTTON_STYLE : {}

    return (
        <>
            <div className="form-group">
                <label>Assigned Plant</label>
                <button
                    className="operator-select-button form-control active:scale-[0.97] disabled:active:scale-100 transition-transform duration-150 ease-out motion-reduce:transition-none"
                    onClick={() => canEditTractor && setShowPlantModal(true)}
                    type="button"
                    disabled={!canEditTractor}
                    style={readOnlyPlantStyle}
                >
                    <span className="block overflow-hidden" style={{ textOverflow: 'ellipsis' }}>
                        {plantDisplayText}
                    </span>
                </button>
            </div>
            <div className="form-group">
                <label>Assigned Operator</label>
                <div className="operator-select-container">
                    <button
                        className="operator-select-button form-control active:scale-[0.97] disabled:active:scale-100 transition-transform duration-150 ease-out motion-reduce:transition-none"
                        onClick={async () => {
                            if (canEditTractor) {
                                await fetchOperatorsForModal()
                                setShowOperatorModal(true)
                            }
                        }}
                        type="button"
                        disabled={!canEditTractor}
                        style={!canEditTractor ? READ_ONLY_OPERATOR_BUTTON_STYLE : {}}
                    >
                        <span className="block overflow-hidden" style={{ textOverflow: 'ellipsis' }}>
                            {assignedOperator ? getOperatorName(assignedOperator, operators) : 'None (Click to select)'}
                        </span>
                    </button>
                    {canEditTractor &&
                        (assignedOperator ? (
                            <button
                                className="unassign-operator-button active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                title="Unassign Operator"
                                onClick={handleUnassign}
                                type="button"
                            >
                                Unassign Operator
                            </button>
                        ) : (
                            lastUnassignedOperatorId && (
                                <button
                                    className="undo-operator-button unassign-operator-button bg-[var(--success)] rounded text-[var(--text-light)] cursor-pointer text-[1rem] h-[38px] active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    title="Undo Unassign"
                                    onClick={handleUndoUnassign}
                                    type="button"
                                    style={UNDO_BUTTON_STYLE}
                                >
                                    Undo
                                </button>
                            )
                        ))}
                </div>
            </div>
        </>
    )
}

export default TractorOperatorAssignmentField
