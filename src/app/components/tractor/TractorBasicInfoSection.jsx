import React from 'react'

import { TractorService } from '../../../services/TractorService'
import { TRACTOR_FREIGHT_TYPES, TRACTOR_STATUSES_FORCING_UNASSIGN } from '../../constants/tractorDetailConstants'
import DetailViewSection from '../sections/DetailViewSection'
import TractorOperatorAssignmentField from './TractorOperatorAssignmentField'

// Canonical chevron-bearing select treatment for the tractor basic-info card.
// Mirrors the surrounding `form-control` size while using a `currentColor`
// chevron so the affordance follows `text-text-primary` across themes.
const SELECT_CLS =
    "w-full appearance-none cursor-pointer rounded border border-border-light bg-bg-secondary text-text-primary text-[0.8125rem] px-2.5 py-[0.4375rem] pr-9 bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem_1rem] transition-colors duration-150 hover:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark] bg-[url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%2024%2024'%20stroke='currentColor'%3E%3Cpath%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='2'%20d='M19%209l-7%207-7-7'%3E%3C/path%3E%3C/svg%3E\")]"

/**
 * "Basic Information" tab on the tractor detail view: identification,
 * status, freight type, plant + operator assignment, and VIN/make/model/year.
 */
function TractorBasicInfoSection({
    assignedOperator,
    canEditTractor,
    fetchOperatorsForModal,
    freight,
    getOperatorName,
    handleSave,
    lastUnassignedOperatorId,
    make,
    model,
    operators,
    originalValues,
    plantDisplayText,
    refreshOperators,
    setAssignedOperator,
    setFreight,
    setLastUnassignedOperatorId,
    setMake,
    setMessage,
    setModel,
    setShowOperatorModal,
    setShowPlantModal,
    setStatus,
    setTractor,
    setTruckNumber,
    setVin,
    setYear,
    showOperatorModal,
    status,
    tractorId,
    truckNumber,
    vin,
    year
}) {
    async function handleStatusChange(event) {
        const newStatus = event.target.value
        const isForcedUnassignTransition =
            assignedOperator &&
            originalValues.status === 'Active' &&
            TRACTOR_STATUSES_FORCING_UNASSIGN.includes(newStatus)

        if (!isForcedUnassignTransition) {
            setStatus(newStatus)
            return
        }
        await handleSave({ assignedOperator: null, status: newStatus })
        setStatus(newStatus)
        setAssignedOperator(null)
        setLastUnassignedOperatorId(assignedOperator)
        setMessage('Status changed and operator unassigned')
        setTimeout(() => setMessage(''), 3000)
        await refreshOperators()
        await fetchOperatorsForModal()
        const updatedTractor = await TractorService.fetchTractorById(tractorId)
        setTractor(updatedTractor)
    }

    return (
        <DetailViewSection.Section id="basic" title="Basic Information" icon="fas fa-truck">
            <DetailViewSection.Card title="Truck Details" icon="fas fa-info-circle">
                <div className="form-group">
                    <label>Truck Number</label>
                    <input
                        type="text"
                        value={truckNumber}
                        onChange={(e) => setTruckNumber(e.target.value)}
                        className="form-control"
                        readOnly={!canEditTractor}
                    />
                </div>
                <div className="form-group">
                    <label>Status</label>
                    <select
                        value={status}
                        onChange={handleStatusChange}
                        disabled={!canEditTractor}
                        className={SELECT_CLS}
                    >
                        <option value="">Select Status</option>
                        <option value="Active" disabled={!assignedOperator}>
                            Active{!assignedOperator ? ' (Cannot set without an operator assigned)' : ''}
                        </option>
                        <option value="Spare">Spare</option>
                        <option value="In Shop">In Shop</option>
                        <option value="Retired">Retired</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Freight</label>
                    <select
                        value={freight}
                        onChange={(e) => setFreight(e.target.value)}
                        disabled={!canEditTractor}
                        className={SELECT_CLS}
                    >
                        <option value="">Select Freight</option>
                        {TRACTOR_FREIGHT_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>
            </DetailViewSection.Card>
            <DetailViewSection.Card title="Assignment" icon="fas fa-user-tag">
                <TractorOperatorAssignmentField
                    assignedOperator={assignedOperator}
                    canEditTractor={canEditTractor}
                    fetchOperatorsForModal={fetchOperatorsForModal}
                    getOperatorName={getOperatorName}
                    handleSave={handleSave}
                    lastUnassignedOperatorId={lastUnassignedOperatorId}
                    operators={operators}
                    plantDisplayText={plantDisplayText}
                    refreshOperators={refreshOperators}
                    setAssignedOperator={setAssignedOperator}
                    setLastUnassignedOperatorId={setLastUnassignedOperatorId}
                    setMessage={setMessage}
                    setShowOperatorModal={setShowOperatorModal}
                    setShowPlantModal={setShowPlantModal}
                    setStatus={setStatus}
                    setTractor={setTractor}
                    showOperatorModal={showOperatorModal}
                    tractorId={tractorId}
                />
            </DetailViewSection.Card>
            <DetailViewSection.Card title="Vehicle Information" icon="fas fa-car">
                <div className="form-group">
                    <label>VIN</label>
                    <input
                        type="text"
                        value={vin}
                        onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[IOQ]/g, ''))}
                        className="form-control"
                        readOnly={!canEditTractor}
                    />
                </div>
                <div className="form-row-2">
                    <div className="form-group">
                        <label>Make</label>
                        <input
                            type="text"
                            value={make}
                            onChange={(e) => setMake(e.target.value)}
                            className="form-control"
                            readOnly={!canEditTractor}
                        />
                    </div>
                    <div className="form-group">
                        <label>Model</label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="form-control"
                            readOnly={!canEditTractor}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label>Year</label>
                    <input
                        type="text"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="form-control"
                        readOnly={!canEditTractor}
                    />
                </div>
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}

export default TractorBasicInfoSection
