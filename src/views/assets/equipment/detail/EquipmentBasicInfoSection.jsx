/* eslint-disable react/forbid-dom-props */
import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import { EQUIPMENT_TYPE_OPTIONS, STATUS_OPTIONS } from './equipmentTypeOptions'

/**
 * Renders the Identifying Number / Status / Plant / Type card plus the
 * Make / Model / Year specifications card on the equipment detail view.
 *
 * The plant-selector relies on the parent to open the plant modal; an inline
 * style is still needed for the disabled-state visuals because the design
 * system's `form-control` colors get overridden by the button base class.
 */
export default function EquipmentBasicInfoSection({
    canEditEquipment,
    equipmentType,
    identifyingNumber,
    make,
    model,
    plantDisplayText,
    setEquipmentType,
    setIdentifyingNumber,
    setMake,
    setModel,
    setShowPlantModal,
    setStatus,
    setYear,
    status,
    year
}) {
    return (
        <DetailViewSection.Section id="basic" title="Basic Information" icon="fas fa-cog">
            <DetailViewSection.Card title="Equipment Details" icon="fas fa-info-circle">
                <div className="form-group">
                    <label>Identifying Number</label>
                    <input
                        type="text"
                        value={identifyingNumber}
                        onChange={(e) => setIdentifyingNumber(e.target.value)}
                        className="form-control"
                        readOnly={!canEditEquipment}
                    />
                </div>
                <div className="form-group">
                    <label>Status</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={!canEditEquipment}
                        className="form-control"
                    >
                        <option value="">Select Status</option>
                        {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>Assigned Plant</label>
                    <button
                        className="operator-select-button form-control"
                        onClick={() => canEditEquipment && setShowPlantModal(true)}
                        type="button"
                        disabled={!canEditEquipment}
                        style={
                            !canEditEquipment
                                ? {
                                      backgroundColor: 'var(--card-bg)',
                                      cursor: 'not-allowed',
                                      opacity: 0.8
                                  }
                                : {}
                        }
                    >
                        <span className="block overflow-hidden" style={{ textOverflow: 'ellipsis' }}>
                            {plantDisplayText}
                        </span>
                    </button>
                </div>
                <div className="form-group">
                    <label>Equipment Type</label>
                    <select
                        value={equipmentType}
                        onChange={(e) => setEquipmentType(e.target.value)}
                        disabled={!canEditEquipment}
                        className="form-control"
                    >
                        <option value="">Select Type</option>
                        {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
            </DetailViewSection.Card>
            <DetailViewSection.Card title="Equipment Specifications" icon="fas fa-clipboard-list">
                <div className="form-row-2">
                    <div className="form-group">
                        <label>Make</label>
                        <input
                            type="text"
                            value={make}
                            onChange={(e) => setMake(e.target.value)}
                            className="form-control"
                            readOnly={!canEditEquipment}
                        />
                    </div>
                    <div className="form-group">
                        <label>Model</label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="form-control"
                            readOnly={!canEditEquipment}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label>Year</label>
                    <input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="form-control"
                        readOnly={!canEditEquipment}
                        min="1900"
                        max={new Date().getFullYear()}
                    />
                </div>
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}
