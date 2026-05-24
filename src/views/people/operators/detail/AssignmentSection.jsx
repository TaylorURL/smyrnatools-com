import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import { SELECT_CLASS } from './operatorDetailConstants'

/**
 * Assignment section: status / pending start date / assigned plant button
 * (opens picker modal in parent) / position selector.
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
                <div className="flex flex-col gap-1.5">
                    <label>Status</label>
                    <select
                        value={status}
                        onChange={(e) => {
                            const value = e.target.value
                            setStatus(value)
                            if (value === 'Active') setAssignedTrainer('')
                        }}
                        className={SELECT_CLASS}
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
                    <div className="flex flex-col gap-1.5">
                        <label>Pending Start Date</label>
                        <input
                            type="date"
                            value={pendingStartDate || ''}
                            onChange={(e) => setPendingStartDate(e.target.value)}
                            className="w-full rounded border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                            disabled={!canEditOperator}
                        />
                    </div>
                )}
                <div className="flex flex-col gap-1.5">
                    <label>Assigned Plant</label>
                    <button
                        className="w-full rounded border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary text-left outline-none transition-colors focus:border-accent"
                        onClick={() => setShowPlantModal(true)}
                        type="button"
                        disabled={!canEditOperator}
                    >
                        <span className="block overflow-hidden text-ellipsis">{plantDisplayText}</span>
                    </button>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label>Position</label>
                    <select
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        className={SELECT_CLASS}
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
