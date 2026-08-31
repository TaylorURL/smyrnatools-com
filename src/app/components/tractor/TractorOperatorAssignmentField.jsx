import React from 'react'

import { TractorService } from '../../../services/TractorService'

const DISABLED_FIELD_CLASSES = 'bg-bg-secondary opacity-80 cursor-not-allowed'

const UNDO_BUTTON_CLASSES =
    'undo-operator-button unassign-operator-button bg-[var(--success)] rounded text-[var(--text-light)] cursor-pointer text-[1rem] h-[38px] min-w-[140px] border-0 box-border ml-2 px-4 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

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
                    className={`operator-select-button form-control text-left active:scale-[0.97] disabled:active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none ${plantDisabled ? DISABLED_FIELD_CLASSES : ''}`}
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
                        className={`operator-select-button form-control text-left active:scale-[0.97] disabled:active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none ${operatorDisabled ? DISABLED_FIELD_CLASSES : ''}`}
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
                                className="unassign-operator-button active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                aria-label="Unassign Operator"
                                onClick={handleUnassign}
                            >
                                Unassign Operator
                            </button>
                        ) : (
                            lastUnassignedOperatorId && (
                                <button
                                    type="button"
                                    className={UNDO_BUTTON_CLASSES}
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
