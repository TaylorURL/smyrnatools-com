/* eslint-disable react/forbid-dom-props */
import React from 'react'

import DetailViewSection from '../sections/DetailViewSection'

const readOnlyPlantStyle = {
    backgroundColor: 'var(--card-bg)',
    cursor: 'not-allowed',
    opacity: 0.8
}

const readOnlyOperatorStyle = {
    backgroundColor: 'var(--bg-secondary)',
    cursor: 'not-allowed',
    opacity: 0.8
}

const undoButtonStyle = {
    border: 'none',
    boxSizing: 'border-box',
    marginLeft: '8px',
    minWidth: '140px',
    padding: '0 16px'
}

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
    return (
        <DetailViewSection.Card title="Assignment" icon="fas fa-user-tag">
            <div className="form-group">
                <label>Assigned Plant</label>
                <button
                    className="operator-select-button form-control active:scale-[0.97] disabled:active:scale-100 transition-transform duration-150 ease-out motion-reduce:transition-none"
                    onClick={() => canEditMixer && onOpenPlantModal()}
                    type="button"
                    disabled={!canEditMixer}
                    style={!canEditMixer ? readOnlyPlantStyle : {}}
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
                        onClick={onOpenOperatorModal}
                        type="button"
                        disabled={!canEditMixer || isCleanlinessBlocking}
                        style={!canEditMixer || isCleanlinessBlocking ? readOnlyOperatorStyle : {}}
                    >
                        <span className="block overflow-hidden" style={{ textOverflow: 'ellipsis' }}>
                            {assignedOperator ? getOperatorName(assignedOperator) : 'None (Click to select)'}
                        </span>
                    </button>
                    {canEditMixer &&
                        (assignedOperator ? (
                            <button
                                className="unassign-operator-button active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                title="Unassign Operator"
                                onClick={onUnassignOperator}
                                type="button"
                            >
                                Unassign Operator
                            </button>
                        ) : (
                            lastUnassignedOperatorId && (
                                <button
                                    className="undo-operator-button unassign-operator-button bg-[var(--success)] rounded text-[var(--text-light)] cursor-pointer text-[1rem] h-[38px] active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    title="Undo Unassign"
                                    onClick={onUndoUnassignOperator}
                                    type="button"
                                    style={undoButtonStyle}
                                >
                                    Undo
                                </button>
                            )
                        ))}
                </div>
                {isCleanlinessBlocking && (
                    <div
                        className="items-center bg-bg-hover rounded-md text-text-secondary flex text-[0.8125rem]"
                        style={{ gap: '0.5rem', marginTop: '0.5rem', padding: '0.5rem 0.75rem' }}
                    >
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Cleanliness must be 3+ stars to assign an operator</span>
                    </div>
                )}
            </div>
        </DetailViewSection.Card>
    )
}
