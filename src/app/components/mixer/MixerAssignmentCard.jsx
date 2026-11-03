import React from 'react'

import {
    DETAIL_UNASSIGN_BUTTON_CLS,
    DETAIL_UNDO_BUTTON_CLS,
    detailFieldButtonCls
} from '../../constants/detailFormClasses'
import DetailViewSection from '../sections/DetailViewSection'

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

    return (
        <DetailViewSection.Card title="Assignment" icon="fas fa-user-tag">
            <div className="form-group">
                <label>Assigned Plant</label>
                <button
                    type="button"
                    className={detailFieldButtonCls(plantDisabled)}
                    onClick={() => canEditMixer && onOpenPlantModal()}
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
                        onClick={onOpenOperatorModal}
                        disabled={operatorDisabled}
                    >
                        <span className="block truncate">
                            {assignedOperator ? getOperatorName(assignedOperator) : 'None (Click to select)'}
                        </span>
                    </button>
                    {canEditMixer &&
                        (assignedOperator ? (
                            <button
                                type="button"
                                className={DETAIL_UNASSIGN_BUTTON_CLS}
                                aria-label="Unassign Operator"
                                onClick={onUnassignOperator}
                            >
                                Unassign Operator
                            </button>
                        ) : (
                            lastUnassignedOperatorId && (
                                <button
                                    type="button"
                                    className={DETAIL_UNDO_BUTTON_CLS}
                                    aria-label="Undo Unassign"
                                    onClick={onUndoUnassignOperator}
                                >
                                    Undo
                                </button>
                            )
                        ))}
                </div>
                {isCleanlinessBlocking && (
                    <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-md border border-[color:var(--tint-warning-line)] bg-[color:var(--notice-warning-bg)] text-[color:var(--notice-warning-strong)] text-[0.8125rem] leading-snug">
                        <i
                            className="fas fa-exclamation-triangle mt-0.5 text-[color:var(--notice-warning-icon)]"
                            aria-hidden="true"
                        />
                        <span>Cleanliness must be 3+ stars to assign an operator</span>
                    </div>
                )}
            </div>
        </DetailViewSection.Card>
    )
}
