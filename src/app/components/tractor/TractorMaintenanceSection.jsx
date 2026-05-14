/* eslint-disable react/forbid-dom-props */
import React from 'react'

import AssetStatsUtility from '../../../utils/AssetStatsUtility'
import DateUtility from '../../../utils/DateUtility'
import { CLEANLINESS_RATING_LABELS } from '../../constants/tractorDetailConstants'
import DetailViewSection from '../sections/DetailViewSection'

/** Formats a Date instance into YYYY-MM-DD for the `<input type="date">` value. */
function formatIsoDate(date) {
    if (!date) return ''
    return date instanceof Date ? date.toISOString().split('T')[0] : date
}

/** Renders the 1-5 cleanliness star picker, including the textual label readout. */
function CleanlinessRating({ canEditTractor, cleanlinessRating, setCleanlinessRating }) {
    return (
        <div className="form-group">
            <label>Cleanliness Rating</label>
            <div className="cleanliness-rating-editor">
                <div className="star-input">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            className={`star-button ${star <= cleanlinessRating ? 'active' : ''} ${!canEditTractor ? 'disabled' : ''}`}
                            onClick={() =>
                                canEditTractor && setCleanlinessRating(star === cleanlinessRating ? 0 : star)
                            }
                            aria-label={`Rate ${star} of 5 stars`}
                            disabled={!canEditTractor}
                        >
                            <i
                                className={`fas fa-star ${star <= cleanlinessRating ? 'filled' : ''}`}
                                style={star <= cleanlinessRating ? { color: '#f59e0b' } : {}}
                            ></i>
                        </button>
                    ))}
                </div>
                {cleanlinessRating > 0 && (
                    <div className="rating-value-display">
                        <span className="rating-label">{CLEANLINESS_RATING_LABELS[cleanlinessRating]}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * "Maintenance" tab on the tractor detail view: last service date,
 * hours, blower flag, and cleanliness rating.
 */
function TractorMaintenanceSection({
    canEditTractor,
    cleanlinessRating,
    hasBlower,
    hours,
    lastServiceDate,
    setCleanlinessRating,
    setHasBlower,
    setHours,
    setLastServiceDate
}) {
    return (
        <DetailViewSection.Section id="maintenance" title="Maintenance" icon="fas fa-wrench">
            <DetailViewSection.Card title="Service Information" icon="fas fa-calendar-alt">
                <div className="form-group">
                    <label>Last Service Date</label>
                    <input
                        type="date"
                        value={lastServiceDate ? formatIsoDate(lastServiceDate) : ''}
                        onChange={(e) =>
                            setLastServiceDate(e.target.value ? DateUtility.parseLocalDate(e.target.value) : null)
                        }
                        className="form-control"
                        readOnly={!canEditTractor}
                    />
                    {lastServiceDate && AssetStatsUtility.isServiceOverdue(lastServiceDate) && (
                        <div className="warning-text">Service overdue</div>
                    )}
                    <div className="text-text-secondary text-[11px]" style={{ lineHeight: '1.4', marginTop: '4px' }}>
                        Service will show as overdue if it has been more than 6 months since last serviced. Service is
                        determined by hours on the asset - check hours of service.
                    </div>
                </div>
                <div className="form-group">
                    <label>Hours</label>
                    <input
                        type="number"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        className="form-control"
                        readOnly={!canEditTractor}
                        min="0"
                        step="any"
                        placeholder="Enter hours"
                    />
                </div>
                <div className="form-group">
                    <label>Has Blower</label>
                    <select
                        value={hasBlower ? 'Yes' : 'No'}
                        onChange={(e) => setHasBlower(e.target.value === 'Yes')}
                        disabled={!canEditTractor}
                        className="form-control"
                    >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                    </select>
                </div>
            </DetailViewSection.Card>
            <DetailViewSection.Card title="Cleanliness Rating" icon="fas fa-broom">
                <CleanlinessRating
                    canEditTractor={canEditTractor}
                    cleanlinessRating={cleanlinessRating}
                    setCleanlinessRating={setCleanlinessRating}
                />
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}

export default TractorMaintenanceSection
