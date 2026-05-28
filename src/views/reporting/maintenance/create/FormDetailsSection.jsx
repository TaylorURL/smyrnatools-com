/* eslint-disable react/forbid-dom-props */
import React from 'react'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'
import {
    FIELD_INPUT_CLASS,
    FIELD_SELECT_CLASS,
    FIELD_STYLE,
    FIELD_TEXTAREA_CLASS,
    FREQUENCY_HINT,
    FREQUENCY_OPTIONS
} from '../../../../app/constants/maintenanceCreateConstants'
import { Card, CardHeader, Chip, ErrorText, FieldLabel } from './atoms'

const PER_N_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly']

const frequencyUnitLabel = (frequency) => {
    if (frequency === 'daily') return 'day(s)'
    if (frequency === 'weekly') return 'week(s)'
    if (frequency === 'monthly') return 'month(s)'
    return 'year(s)'
}

export function FormDetailsSection({
    accentColor,
    availablePlants,
    description,
    errors,
    frequency,
    frequencyValue,
    selectedPlants,
    setDescription,
    setFrequency,
    setFrequencyValue,
    setSelectedPlants,
    setShowPlantModal,
    setStartDate,
    setTitle,
    showPlantModal,
    startDate,
    title
}) {
    const showPerN = PER_N_FREQUENCIES.includes(frequency)

    return (
        <Card>
            <CardHeader
                accentColor={accentColor}
                icon="fa-info-circle"
                title="Form Details"
                description="Title, plants, description, and recurrence"
            />
            <div className="px-4 py-3 flex flex-col gap-3">
                <div>
                    <FieldLabel required>Title</FieldLabel>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter form title"
                        className={FIELD_INPUT_CLASS}
                        style={{
                            ...FIELD_STYLE,
                            borderColor: errors.title ? '#dc2626' : 'var(--border-light)'
                        }}
                    />
                    {errors.title && <ErrorText>{errors.title}</ErrorText>}
                </div>

                <div>
                    <FieldLabel required>Plants</FieldLabel>
                    {selectedPlants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {selectedPlants.map((code) => {
                                const plant = availablePlants.find((p) => (p.plantCode || p.plant_code) === code)
                                const name = plant?.plantName || plant?.plant_name || code
                                return (
                                    <Chip
                                        key={code}
                                        accentColor={accentColor}
                                        onRemove={() => setSelectedPlants(selectedPlants.filter((c) => c !== code))}
                                    >
                                        <span className="font-mono tabular-nums text-[10.5px]">{code}</span>
                                        {name !== code && <span className="text-text-secondary">· {name}</span>}
                                    </Chip>
                                )
                            })}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowPlantModal(true)}
                        className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-[12.5px] cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary hover:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        style={{
                            ...FIELD_STYLE,
                            borderColor: errors.plants ? '#dc2626' : 'var(--border-light)'
                        }}
                    >
                        <span>{selectedPlants.length === 0 ? 'Select plants' : 'Add more plants'}</span>
                        <i className="fas fa-plus text-[10px] text-text-tertiary" />
                    </button>
                    {errors.plants && <ErrorText>{errors.plants}</ErrorText>}
                    <PlantDropdownModal
                        isOpen={showPlantModal}
                        onClose={() => setShowPlantModal(false)}
                        plants={availablePlants.filter((p) => !selectedPlants.includes(p.plantCode || p.plant_code))}
                        onSelect={(code) => {
                            if (!selectedPlants.includes(code)) {
                                setSelectedPlants([...selectedPlants, code])
                            }
                            setShowPlantModal(false)
                        }}
                    />
                </div>

                <div>
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description or instructions"
                        rows={3}
                        className={FIELD_TEXTAREA_CLASS}
                        style={FIELD_STYLE}
                    />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="w-full sm:flex-1 sm:min-w-[180px]">
                        <FieldLabel>Frequency</FieldLabel>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                            aria-label="Frequency"
                            className={FIELD_SELECT_CLASS}
                            style={FIELD_STYLE}
                        >
                            {FREQUENCY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {showPerN && (
                        <div className="w-full sm:w-[160px]">
                            <FieldLabel>Every</FieldLabel>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    value={frequencyValue}
                                    onChange={(e) => setFrequencyValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    min="1"
                                    aria-label="Frequency value"
                                    className={`${FIELD_INPUT_CLASS} font-mono tabular-nums`}
                                    style={FIELD_STYLE}
                                />
                                <span className="text-[10.5px] whitespace-nowrap uppercase tracking-wider text-text-tertiary">
                                    {frequencyUnitLabel(frequency)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <FieldLabel required>First Due Date</FieldLabel>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={`${FIELD_INPUT_CLASS} font-mono tabular-nums`}
                        style={FIELD_STYLE}
                    />
                    <p className="mt-1 text-[10.5px] text-text-tertiary">{FREQUENCY_HINT[frequency]}</p>
                </div>
            </div>
        </Card>
    )
}
