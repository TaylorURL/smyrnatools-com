import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import { DETAIL_SELECT_CLS } from '../../../../app/constants/detailFormClasses'

/**
 * Status, plant and position for one operator. Pending Start and Training are
 * offered only to a viewer who holds the training permission, and going Active
 * clears the assigned trainer, since a working operator is no longer someone
 * else's trainee. The start-date field appears only for Pending Start.
 */
function AssignmentSection({
    canEditOperator,
    hasTrainingPermission,
    pendingStartDate,
    plantDisplayText,
    position,
    setAssignedTrainer,
    setPendingStartDate,
    setPosition,
    setShowPlantModal,
    setStatus,
    status
}) {
    return (
        <DetailViewSection.Section id="assignment" title="Assignment" icon="fas fa-building">
            <DetailViewSection.Card title="Assignment Information" icon="fas fa-map-marker-alt">
                <div className="form-group">
                    <label>Status</label>
                    <select
                        value={status}
                        onChange={(e) => {
                            const value = e.target.value
                            setStatus(value)
                            if (value === 'Active') setAssignedTrainer('')
                        }}
                        className={DETAIL_SELECT_CLS}
                        disabled={!canEditOperator}
                    >
                        <option value="Active">Active</option>
                        <option value="Light Duty">Light Duty</option>
                        <option value="Terminated">Terminated</option>
                        {hasTrainingPermission && <option value="Pending Start">Pending Start</option>}
                        {hasTrainingPermission && <option value="Training">Training</option>}
                        <option value="No Hire">No Hire</option>
                    </select>
                </div>
                {status === 'Pending Start' && (
                    <div className="form-group">
                        <label>Pending Start Date</label>
                        <input
                            type="date"
                            value={pendingStartDate || ''}
                            onChange={(e) => setPendingStartDate(e.target.value)}
                            className="form-control [color-scheme:light] dark:[color-scheme:dark]"
                            disabled={!canEditOperator}
                        />
                    </div>
                )}
                <div className="form-group">
                    <label>Assigned Plant</label>
                    <button
                        type="button"
                        className={`operator-select-button form-control text-left ${!canEditOperator ? 'bg-bg-secondary opacity-80 cursor-not-allowed' : ''}`}
                        onClick={() => setShowPlantModal(true)}
                        disabled={!canEditOperator}
                    >
                        <span className="block overflow-hidden text-ellipsis">{plantDisplayText}</span>
                    </button>
                </div>
                <div className="form-group">
                    <label>Position</label>
                    <select
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        className={DETAIL_SELECT_CLS}
                        disabled={!canEditOperator}
                    >
                        <option value="">Select Position</option>
                        <option value="Mixer Operator">Mixer Operator</option>
                        <option value="Tractor Operator">Tractor Operator</option>
                    </select>
                </div>
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}

export default AssignmentSection
