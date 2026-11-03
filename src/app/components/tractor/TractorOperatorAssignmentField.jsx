import React from 'react'

import { TractorService } from '../../../services/TractorService'
import {
    DETAIL_UNASSIGN_BUTTON_CLS,
    DETAIL_UNDO_BUTTON_CLS,
    detailFieldButtonCls
} from '../../constants/detailFormClasses'

/**
 * Plant and operator assignment block on the tractor detail. Unassigning
 * also drops the tractor to Spare, since a tractor with nobody in it is not
 * running; Undo puts both back. Undo stays offered for as long as the parent
 * holds `lastUnassignedOperatorId` and no new operator has been picked.
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
            // Unassigning from inside the picker leaves it showing the roster
            // as it was before the operator came free. Closing and reopening on
            // the next tick remounts it against the list just refreshed.
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

    const plantDisabled = !canEditTractor
    const operatorDisabled = !canEditTractor

    return (
        <>
            <div className="form-group">
                <label>Assigned Plant</label>
                <button
                    type="button"
                    className={detailFieldButtonCls(plantDisabled)}
                    onClick={() => canEditTractor && setShowPlantModal(true)}
                    disabled={plantDisabled}
                >
                    <span className="block truncate">{plantDisplayText}</span>
                </button>
            </div>
            <div className="form-group">
                <label>Assigned Operator</label>
                <div className="operator-select-container">
                    <button
                        type="button"
                        className={detailFieldButtonCls(operatorDisabled)}
                        onClick={async () => {
                            if (canEditTractor) {
                                await fetchOperatorsForModal()
                                setShowOperatorModal(true)
                            }
                        }}
                        disabled={operatorDisabled}
                    >
                        <span className="block truncate">
                            {assignedOperator ? getOperatorName(assignedOperator, operators) : 'None (Click to select)'}
                        </span>
                    </button>
                    {canEditTractor &&
                        (assignedOperator ? (
                            <button
                                type="button"
                                className={DETAIL_UNASSIGN_BUTTON_CLS}
                                aria-label="Unassign Operator"
                                onClick={handleUnassign}
                            >
                                Unassign Operator
                            </button>
                        ) : (
                            lastUnassignedOperatorId && (
                                <button
                                    type="button"
                                    className={DETAIL_UNDO_BUTTON_CLS}
                                    aria-label="Undo Unassign"
                                    onClick={handleUndoUnassign}
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
