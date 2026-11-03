import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import { DETAIL_SELECT_CLS } from '../../../../app/constants/detailFormClasses'

/**
 * Number, type and status for a trailer (its plant sits in the Assignment
 * card, as on the mixer and tractor pages). Active is offered only once a
 * tractor is assigned, since a trailer with nothing to pull it is not active,
 * and the option says so rather than failing on save.
 */
export default function TrailerBasicInfoCard({
    trailerNumber,
    onTrailerNumberChange,
    trailerType,
    onTrailerTypeChange,
    canEditTrailer,
    status,
    onStatusChange,
    assignedTractor
}) {
    return (
        <DetailViewSection.Card title="Trailer Details" icon="fas fa-info-circle">
            <div className="form-group">
                <label>Trailer Number</label>
                <input
                    type="text"
                    inputMode="numeric"
                    value={trailerNumber}
                    onChange={(e) => onTrailerNumberChange(e.target.value)}
                    className="form-control"
                    readOnly={!canEditTrailer}
                />
            </div>
            <div className="form-group">
                <label>Trailer Type</label>
                <select
                    value={trailerType}
                    onChange={(e) => onTrailerTypeChange(e.target.value)}
                    disabled={!canEditTrailer}
                    className={DETAIL_SELECT_CLS}
                >
                    <option value="">Select Trailer Type</option>
                    <option value="Cement">Cement</option>
                    <option value="End Dump">End Dump</option>
                </select>
            </div>
            <div className="form-group">
                <label>Active Status</label>
                <select
                    value={status}
                    onChange={(e) => onStatusChange(e.target.value)}
                    disabled={!canEditTrailer}
                    className={DETAIL_SELECT_CLS}
                >
                    <option value="">Select Status</option>
                    <option value="Active" disabled={!assignedTractor}>
                        Active{!assignedTractor ? ' (Cannot set without a tractor assigned)' : ''}
                    </option>
                    <option value="Spare">Spare</option>
                    <option value="In Shop">In Shop</option>
                    <option value="Retired">Retired</option>
                </select>
            </div>
        </DetailViewSection.Card>
    )
}
