/* eslint-disable react/forbid-dom-props */
import React from 'react'

import {
    MIXER_SHOP_STATUS_NOTES,
    MIXER_SHOP_STATUS_OPTIONS,
    MIXER_STATUS_OPTIONS
} from '../../constants/mixerDetailConstants'
import DetailViewSection from '../sections/DetailViewSection'

const readOnlySelectStyle = {
    backgroundColor: 'var(--card-bg)',
    cursor: 'not-allowed',
    opacity: 0.8
}

/**
 * Truck Number, Status, and (when In Shop) Shop Status sub-selector. Status
 * change is async because moving away from Active while an operator is
 * assigned triggers an immediate save + unassign elsewhere.
 */
export default function MixerTruckDetailsCard({
    canEditMixer,
    isCleanlinessBlocking,
    onStatusChange,
    onTruckNumberChange,
    setShopStatus,
    shopStatus,
    status,
    truckNumber
}) {
    const shopStatusNote = MIXER_SHOP_STATUS_NOTES[shopStatus] || MIXER_SHOP_STATUS_NOTES.in_shop

    return (
        <DetailViewSection.Card title="Truck Details" icon="fas fa-info-circle">
            <div className="form-group">
                <label>Truck Number</label>
                <input
                    type="text"
                    value={truckNumber}
                    onChange={(e) => onTruckNumberChange(e.target.value)}
                    className="form-control"
                    readOnly={!canEditMixer}
                />
            </div>
            <div className="form-group">
                <label>Status</label>
                <select
                    value={status}
                    onChange={(e) => {
                        const newStatus = e.target.value
                        if (isCleanlinessBlocking && newStatus === 'Active') return
                        onStatusChange(newStatus)
                    }}
                    disabled={!canEditMixer}
                    className="form-control"
                >
                    <option value="">Select Status</option>
                    {MIXER_STATUS_OPTIONS.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            disabled={option.value === 'Active' && isCleanlinessBlocking}
                        >
                            {option.label}
                            {option.value === 'Active' && isCleanlinessBlocking ? ' (Requires 3+ stars)' : ''}
                        </option>
                    ))}
                </select>
                {isCleanlinessBlocking && (
                    <div
                        className="items-center bg-bg-hover rounded-md text-text-secondary flex text-[0.8125rem]"
                        style={{ gap: '0.5rem', marginTop: '0.5rem', padding: '0.5rem 0.75rem' }}
                    >
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Cleanliness must be 3+ stars to set Active status</span>
                    </div>
                )}
            </div>
            {status === 'Spare' && (
                <div className="spare-status-note">
                    If this truck is not runnable, it needs to be set as &quot;In Shop&quot; with the appropriate shop
                    status selected
                </div>
            )}
            {status === 'In Shop' && (
                <div className="down-in-yard-container">
                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                        <label>Shop Status</label>
                        <select
                            className="form-control"
                            value={shopStatus || 'in_shop'}
                            onChange={(e) => canEditMixer && setShopStatus(e.target.value)}
                            disabled={!canEditMixer}
                            style={!canEditMixer ? readOnlySelectStyle : {}}
                        >
                            {MIXER_SHOP_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="down-in-yard-note text-text-secondary text-xs" style={{ marginTop: '4px' }}>
                        {shopStatusNote}
                    </div>
                </div>
            )}
        </DetailViewSection.Card>
    )
}
