import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'

// Canonical chevron-bearing select treatment for the trailer detail card.
// Mirrors the surrounding `form-control` size/border/padding while using a
// `currentColor` chevron so the affordance follows `text-text-primary` across
// dark / light / gray themes. Local to the file because the asset detail
// surfaces don't yet have a shared select constant.
const SELECT_CLS =
    'w-full appearance-none cursor-pointer rounded border border-border-light bg-bg-secondary text-text-primary text-[0.8125rem] px-2.5 py-[0.4375rem] pr-9 bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem_1rem] transition-colors duration-150 hover:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark] bg-[url("data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20fill=\'none\'%20viewBox=\'0%200%2024%2024\'%20stroke=\'currentColor\'%3E%3Cpath%20stroke-linecap=\'round\'%20stroke-linejoin=\'round\'%20stroke-width=\'2\'%20d=\'M19%209l-7%207-7-7\'%3E%3C/path%3E%3C/svg%3E")]'

/**
 * "Trailer Details" card containing trailer number, type, plant button, and
 * status select. Pure presentational — all state lives in the parent.
 */
export default function TrailerBasicInfoCard({
    trailerNumber,
    onTrailerNumberChange,
    trailerType,
    onTrailerTypeChange,
    canEditTrailer,
    plantDisplayText,
    onOpenPlantModal,
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
                    className={SELECT_CLS}
                >
                    <option value="">Select Trailer Type</option>
                    <option value="Cement">Cement</option>
                    <option value="End Dump">End Dump</option>
                </select>
            </div>
            <div className="form-group">
                <label>Assigned Plant</label>
                <button
                    className={`operator-select-button form-control text-left ${!canEditTrailer ? 'bg-bg-secondary opacity-80 cursor-not-allowed' : ''}`}
                    onClick={() => canEditTrailer && onOpenPlantModal()}
                    type="button"
                    disabled={!canEditTrailer}
                >
                    <span className="block truncate">{plantDisplayText}</span>
                </button>
            </div>
            <div className="form-group">
                <label>Active Status</label>
                <select
                    value={status}
                    onChange={(e) => onStatusChange(e.target.value)}
                    disabled={!canEditTrailer}
                    className={SELECT_CLS}
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
