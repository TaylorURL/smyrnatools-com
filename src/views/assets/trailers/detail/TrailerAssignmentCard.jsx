import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import {
    DETAIL_UNASSIGN_BUTTON_CLS,
    DETAIL_UNDO_BUTTON_CLS,
    detailFieldButtonCls
} from '../../../../app/constants/detailFormClasses'

/**
 * The trailer's plant and tractor assignment, laid out like the mixer and
 * tractor Assignment cards: plant first, then the assignee. Unassign and Undo
 * occupy the same slot: whichever one is offered depends on whether a tractor
 * is on now, and Undo only appears while the parent still remembers the one
 * just taken off.
 */
export default function TrailerAssignmentCard({
    canEditTrailer,
    plantDisplayText,
    onOpenPlantModal,
    assignedTractor,
    tractorDisplayText,
    onOpenTractorModal,
    onUnassignTractor,
    lastUnassignedTractorId,
    onUndoUnassign
}) {
    return (
        <DetailViewSection.Card title="Assignment" icon="fas fa-link">
            <div className="form-group">
                <label>Assigned Plant</label>
                <button
                    type="button"
                    className={detailFieldButtonCls(!canEditTrailer)}
                    onClick={() => canEditTrailer && onOpenPlantModal()}
                    disabled={!canEditTrailer}
                >
                    <span className="block truncate">{plantDisplayText}</span>
                </button>
            </div>
            <div className="form-group">
                <label>Assigned Tractor</label>
                <div className="operator-select-container">
                    <button
                        type="button"
                        className={detailFieldButtonCls(!canEditTrailer)}
                        onClick={onOpenTractorModal}
                        disabled={!canEditTrailer}
                    >
                        <span className="block truncate">{tractorDisplayText}</span>
                    </button>
                    {canEditTrailer &&
                        (assignedTractor ? (
                            <button
                                type="button"
                                className={DETAIL_UNASSIGN_BUTTON_CLS}
                                aria-label="Unassign Tractor"
                                onClick={onUnassignTractor}
                            >
                                Unassign Tractor
                            </button>
                        ) : (
                            lastUnassignedTractorId && (
                                <button
                                    type="button"
                                    className={DETAIL_UNDO_BUTTON_CLS}
                                    aria-label="Undo Unassign"
                                    onClick={onUndoUnassign}
                                >
                                    Undo
                                </button>
                            )
                        ))}
                </div>
            </div>
        </DetailViewSection.Card>
    )
}
