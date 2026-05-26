/* eslint-disable react/forbid-dom-props */
import React from 'react'

import DetailViewSection from '../sections/DetailViewSection'

const UNDO_BUTTON_CLASSES =
    'undo-operator-button unassign-operator-button bg-[var(--success)] rounded text-[var(--text-light)] cursor-pointer text-[1rem] h-[38px] min-w-[140px] border-0 box-border ml-2 px-4 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

/**
 * Renders the Assigned Plant and Assigned Operator selectors with their
 * inline unassign/undo controls. Disabling rules are passed in so the parent
 * controls the cleanliness gate.
 */
export default function MixerAssignmentCard({
    assignedOperator,
    canEditMixer,
    getOperatorName,
    isCleanlinessBlocking,
    lastUnassignedOperatorId,
    onOpenOperatorModal,
    onOpenPlantModal,
    onUndoUnassignOperator,
    onUnassignOperator,
    plantDisplayText
}) {
    const plantDisabled = !canEditMixer
    const operatorDisabled = !canEditMixer || isCleanlinessBlocking
    const disabledFieldClasses = 'bg-bg-secondary opacity-80 cursor-not-allowed'

    return (
        <DetailViewSection.Card title="Assignment" icon="fas fa-user-tag">
            <div className="form-group">
                <label>Assigned Plant</label>
                <button
                    className={`operator-select-button form-control text-left active:scale-[0.97] disabled:active:scale-100 transition-transform duration-150 ease-out motion-reduce:transition-none ${plantDisabled ? disabledFieldClasses : ''}`}
                    onClick={() => canEditMixer && onOpenPlantModal()}
                    type="button"
                    disabled={plantDisabled}
                >
                    <span className="block truncate">{plantDisplayText}</span>
                </button>
            </div>
            <div className="form-group">
                <label>Assigned Operator</label>
                <div className="operator-select-container">
                    <button
                        className={`operator-select-button form-control text-left active:scale-[0.97] disabled:active:scale-100 transition-transform duration-150 ease-out motion-reduce:transition-none ${operatorDisabled ? disabledFieldClasses : ''}`}
                        onClick={onOpenOperatorModal}
                        type="button"
                        disabled={operatorDisabled}
                    >
                        <span className="block truncate">
                            {assignedOperator ? getOperatorName(assignedOperator) : 'None (Click to select)'}
                        </span>
                    </button>
                    {canEditMixer &&
                        (assignedOperator ? (
                            <button
                                className="unassign-operator-button active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                aria-label="Unassign Operator"
                                onClick={onUnassignOperator}
                                type="button"
                            >
                                Unassign Operator
                            </button>
                        ) : (
                            lastUnassignedOperatorId && (
                                <button
                                    className={UNDO_BUTTON_CLASSES}
                                    aria-label="Undo Unassign"
                                    onClick={onUndoUnassignOperator}
                                    type="button"
                                >
                                    Undo
                                </button>
                            )
                        ))}
                </div>
                {isCleanlinessBlocking && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-bg-hover rounded-md text-text-secondary text-[0.8125rem]">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Cleanliness must be 3+ stars to assign an operator</span>
                    </div>
                )}
            </div>
        </DetailViewSection.Card>
    )
}
