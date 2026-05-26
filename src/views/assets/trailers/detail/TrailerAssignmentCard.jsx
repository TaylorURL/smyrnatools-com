import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'

/**
 * "Assignment" card with the tractor picker button and the unassign / undo
 * controls. All handlers are wired up by the parent — this component is
 * presentational and stateless.
 */
export default function TrailerAssignmentCard({
    canEditTrailer,
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
                <label>Assigned Tractor</label>
                <div className="operator-select-container">
                    <button
                        className={`operator-select-button form-control text-left ${!canEditTrailer ? 'bg-bg-secondary opacity-80 cursor-not-allowed' : ''}`}
                        onClick={onOpenTractorModal}
                        type="button"
                        disabled={!canEditTrailer}
                    >
                        <span className="block truncate">{tractorDisplayText}</span>
                    </button>
                    {canEditTrailer &&
                        (assignedTractor ? (
                            <button
                                className="unassign-operator-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                aria-label="Unassign Tractor"
                                onClick={onUnassignTractor}
                                type="button"
                            >
                                Unassign Tractor
                            </button>
                        ) : (
                            lastUnassignedTractorId && (
                                <button
                                    className="undo-operator-button unassign-operator-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                    aria-label="Undo Unassign"
                                    onClick={onUndoUnassign}
                                    type="button"
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
