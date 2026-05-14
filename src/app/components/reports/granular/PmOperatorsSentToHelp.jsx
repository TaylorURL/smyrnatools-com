/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import OperatorSelectModal from '../../../../views/assets/mixers/OperatorSelectModal'
import { PM_INPUT } from '../../../constants/plantManagerReportConstants'
import { CARD_STYLE, FIELD_STYLE, SECTION_LABEL_CLASS } from '../../../constants/weeklyReportConstants'
import { usePmHelpData } from '../../../hooks/usePmHelpData'
import PlantDropdownModal from '../../common/PlantDropdownModal'
import { IconChip } from './PmAtoms'
import { CardHeader } from './RmiAtoms'

/** Renders a date `YYYY-MM-DD` string as a long-form weekday + month/day. */
function formatDayName(dateString) {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'long' })
}

function getValidDate(iso) {
    if (!iso) return new Date()
    const d = new Date(iso + 'T00:00:00')
    return isNaN(d.getTime()) ? new Date() : d
}

/** Render-only label for the chosen destination plant. Handles the
 *  special `OTHER_REGION` sentinel and falls back to the raw code. */
function renderPlantLabel(plantCodeValue, plants) {
    if (!plantCodeValue) return 'No plant selected'
    if (plantCodeValue === 'OTHER_REGION') return 'Other Region'
    const plant = plants.find((p) => (p.plantCode || p.plant_code) === plantCodeValue)
    return plant ? `${plant.plantCode || plant.plant_code} · ${plant.plantName || plant.plant_name}` : plantCodeValue
}

const SECTION_INTRO_BULLETS = [
    'Record each operator who assisted another plant, including travel time in total hours.',
    'Create a separate entry for each day an operator helped a different plant.',
    'For partial days, enter actual hours (e.g., 4 hours for a half-day).',
    'If an operator helped multiple plants in one day, add individual entries for each plant.',
    'This data contributes to plant efficiency calculations.'
]

/** Help-block callout describing how to use the form. */
function HelpInstructions() {
    return (
        <div className="rounded p-2.5 bg-[rgba(14,_165,_233,_0.06)] border border-[rgba(14,_165,_233,_0.25)]">
            <div className="flex items-center gap-1.5 mb-1.5">
                <i className="fas fa-info-circle text-[11px] text-[#0369a1]" />
                <span className="text-[11.5px] font-semibold text-[#0369a1]">How to track operator assistance</span>
            </div>
            <ul className="m-0 pl-4 text-[11px] leading-relaxed [&>li]:mb-0.5 text-text-secondary">
                {SECTION_INTRO_BULLETS.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                ))}
            </ul>
        </div>
    )
}

function EmptyEntriesNotice() {
    return (
        <div className="flex items-center gap-2 rounded p-3 text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
            <i className="fas fa-info-circle text-[11px]" />
            <span>No operators were sent to other plants this week.</span>
        </div>
    )
}

/** Plant + Date header row, plus delete-entry button. */
function EntryHeader({ entry, handlers, minDate, maxDate, plants, readOnly }) {
    return (
        <div className="flex items-start justify-between gap-2.5 p-2.5 border-b border-border-light">
            <div className="flex flex-wrap gap-2.5 flex-1">
                <div className="flex flex-col gap-1 min-w-[150px]">
                    <label className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Date
                    </label>
                    {readOnly ? (
                        <div className="text-[12.5px] font-semibold text-text-primary">{formatDayName(entry.date)}</div>
                    ) : (
                        <input
                            type="date"
                            value={entry.date || ''}
                            onChange={(e) => handlers.updateEntry(entry.id, 'date', e.target.value)}
                            className={PM_INPUT}
                            style={FIELD_STYLE}
                            min={minDate}
                            max={maxDate}
                        />
                    )}
                </div>
                <div className="flex flex-col gap-1 min-w-[180px]">
                    <label className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Destination Plant
                    </label>
                    {readOnly ? (
                        <div className="text-[12.5px] font-semibold text-text-primary">
                            {renderPlantLabel(entry.destination_plant, plants)}
                        </div>
                    ) : (
                        <button
                            type="button"
                            className={`${PM_INPUT} text-left cursor-pointer min-w-[180px]`}
                            style={FIELD_STYLE}
                            onClick={() => handlers.openPlantModal(entry.id)}
                        >
                            {entry.destination_plant
                                ? renderPlantLabel(entry.destination_plant, plants)
                                : 'Select Plant'}
                        </button>
                    )}
                </div>
            </div>
            {!readOnly && (
                <button
                    type="button"
                    onClick={() => handlers.removeEntry(entry.id)}
                    title="Remove entry"
                    className="flex items-center justify-center rounded border-none cursor-pointer h-7 w-7 bg-[rgba(220,_38,_38,_0.12)] text-red-700"
                >
                    <i className="fas fa-times text-[10px]" />
                </button>
            )}
        </div>
    )
}

/** Single operator row inside an entry — operator picker + hours input. */
function OperatorRow({ entry, handlers, op, opIdx, operators, readOnly }) {
    const selectedOperator = operators.find((o) => o.employeeId === op.operator_id)
    return (
        <div className="grid grid-cols-[1fr_110px_auto] items-end gap-2 rounded p-2 bg-bg-primary border border-border-light">
            <div className="flex flex-col gap-1">
                <label className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    Operator
                </label>
                {readOnly ? (
                    <div className="text-[12.5px] font-semibold text-text-primary">
                        {selectedOperator ? selectedOperator.name : 'Unknown'}
                    </div>
                ) : (
                    <button
                        type="button"
                        className={`${PM_INPUT} w-full text-left cursor-pointer`}
                        style={FIELD_STYLE}
                        onClick={() => handlers.openOperatorModal(entry.id, opIdx)}
                    >
                        {selectedOperator ? selectedOperator.name : 'Select Operator'}
                    </button>
                )}
            </div>
            <div className="flex flex-col gap-1">
                <label className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    Hours
                </label>
                {readOnly ? (
                    <div className="text-[12.5px] font-semibold tabular-nums text-text-primary">
                        {op.hours || '0'} hrs
                    </div>
                ) : (
                    <input
                        type="number"
                        min="0"
                        max="80"
                        step="0.5"
                        value={op.hours || ''}
                        onChange={(e) => handlers.updateOperator(entry.id, opIdx, 'hours', e.target.value)}
                        className={`${PM_INPUT} w-full tabular-nums`}
                        style={FIELD_STYLE}
                        placeholder="0"
                    />
                )}
            </div>
            {!readOnly && (
                <button
                    type="button"
                    onClick={() => handlers.removeOperator(entry.id, opIdx)}
                    title="Remove operator"
                    className="flex items-center justify-center rounded border-none cursor-pointer bg-[rgba(220,_38,_38,_0.12)] text-red-700 h-[30px] w-[30px]"
                >
                    <i className="fas fa-times text-[10px]" />
                </button>
            )}
        </div>
    )
}

/** Card for one help-entry — header + operator rows + add-operator chip. */
function EntryCard({ entry, handlers, minDate, maxDate, operators, plants, readOnly }) {
    return (
        <div className="rounded overflow-hidden bg-bg-secondary border border-border-light">
            <EntryHeader
                entry={entry}
                handlers={handlers}
                minDate={minDate}
                maxDate={maxDate}
                plants={plants}
                readOnly={readOnly}
            />
            <div className="p-2.5">
                <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-secondary">
                        <i className="fas fa-users text-[10px]" />
                        Operators
                    </span>
                    {!readOnly && (
                        <IconChip
                            accent="#0369a1"
                            icon="fa-plus"
                            label="Add Operator"
                            onClick={() => handlers.addOperator(entry.id)}
                        />
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    {entry.operators.map((op, opIdx) => (
                        <OperatorRow
                            key={opIdx}
                            entry={entry}
                            handlers={handlers}
                            op={op}
                            opIdx={opIdx}
                            operators={operators}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Builds the entry mutation handlers exposed to child rows. */
function useEntryMutations(entries, onUpdate, minDate, openPlantModal, openOperatorModal) {
    return {
        addEntry: () => {
            const defaultDate = minDate || new Date().toISOString().split('T')[0]
            const newEntry = {
                date: defaultDate,
                destination_plant: '',
                id: Date.now(),
                operators: [{ hours: '', operator_id: '' }]
            }
            onUpdate([...(entries || []), newEntry])
        },
        addOperator: (entryId) => {
            onUpdate(
                (entries || []).map((e) =>
                    e.id === entryId ? { ...e, operators: [...e.operators, { hours: '', operator_id: '' }] } : e
                )
            )
        },
        openOperatorModal,
        openPlantModal,
        removeEntry: (entryId) => {
            onUpdate((entries || []).filter((e) => e.id !== entryId))
        },
        removeOperator: (entryId, operatorIndex) => {
            onUpdate(
                (entries || []).map((e) =>
                    e.id === entryId ? { ...e, operators: e.operators.filter((_, i) => i !== operatorIndex) } : e
                )
            )
        },
        updateEntry: (entryId, field, value) => {
            onUpdate((entries || []).map((e) => (e.id === entryId ? { ...e, [field]: value } : e)))
        },
        updateOperator: (entryId, operatorIndex, field, value) => {
            let processedValue = value
            if (field === 'hours') {
                const numValue = parseFloat(value)
                if (!isNaN(numValue) && numValue > 80) processedValue = '80'
            }
            onUpdate(
                (entries || []).map((e) =>
                    e.id === entryId
                        ? {
                              ...e,
                              operators: e.operators.map((op, i) =>
                                  i === operatorIndex ? { ...op, [field]: processedValue } : op
                              )
                          }
                        : e
                )
            )
        }
    }
}

/** Operators-sent-to-help section — entries list + plant/operator
 *  picker modals. Uses `usePmHelpData` to load roster + regional plants. */
export function OperatorsSentToHelp({ entries, onUpdate, weekIso, readOnly, user, plantCode, regionalPlants }) {
    const [showPlantModal, setShowPlantModal] = useState(false)
    const [selectedEntryIdForPlant, setSelectedEntryIdForPlant] = useState(null)
    const [showOperatorModal, setShowOperatorModal] = useState(false)
    const [selectedEntryIdForOperator, setSelectedEntryIdForOperator] = useState(null)
    const [selectedOperatorIndex, setSelectedOperatorIndex] = useState(null)

    const currentPlantCode = plantCode || user?.plant_code
    const { loading, operators, plants, refreshOperators } = usePmHelpData(currentPlantCode, regionalPlants)

    const weekStartDate = getValidDate(weekIso)
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekEndDate.getDate() + 5)
    const minDate = weekStartDate.toISOString().split('T')[0]
    const maxDate = weekEndDate.toISOString().split('T')[0]

    const openPlantModal = (entryId) => {
        setSelectedEntryIdForPlant(entryId)
        setShowPlantModal(true)
    }
    const openOperatorModal = (entryId, opIdx) => {
        setSelectedEntryIdForOperator(entryId)
        setSelectedOperatorIndex(opIdx)
        setShowOperatorModal(true)
    }
    const handlers = useEntryMutations(entries, onUpdate, minDate, openPlantModal, openOperatorModal)

    if (loading) {
        return (
            <div className="rounded p-3" style={CARD_STYLE}>
                <CardHeader icon="fa-hands-helping" label="Help" title="Operators Sent to Other Plants" />
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-text-tertiary">
                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                    Loading…
                </div>
            </div>
        )
    }

    return (
        <div className="rounded p-3 flex flex-col gap-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-hands-helping"
                label="Help"
                title="Operators Sent to Other Plants"
                sub="Track operators sent to help other plants during this week."
                right={
                    !readOnly ? (
                        <button
                            type="button"
                            onClick={handlers.addEntry}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none bg-accent"
                        >
                            <i className="fas fa-plus text-[10px]" />
                            Add Entry
                        </button>
                    ) : null
                }
            />
            <HelpInstructions />
            <div className="flex flex-col gap-2">
                {(!entries || entries.length === 0) && <EmptyEntriesNotice />}
                {(entries || []).map((entry) => (
                    <EntryCard
                        key={entry.id}
                        entry={entry}
                        handlers={handlers}
                        minDate={minDate}
                        maxDate={maxDate}
                        operators={operators}
                        plants={plants}
                        readOnly={readOnly}
                    />
                ))}
            </div>
            {showPlantModal && !loading && (
                <PlantDropdownModal
                    isOpen={showPlantModal}
                    onClose={() => {
                        setShowPlantModal(false)
                        setSelectedEntryIdForPlant(null)
                    }}
                    onSelect={(plantCodeValue) => {
                        if (selectedEntryIdForPlant) {
                            handlers.updateEntry(selectedEntryIdForPlant, 'destination_plant', plantCodeValue)
                        }
                        setShowPlantModal(false)
                        setSelectedEntryIdForPlant(null)
                    }}
                    plants={[
                        ...plants.filter(
                            (p) => String(p.plantCode || p.plant_code || '') !== String(currentPlantCode || '')
                        ),
                        { plantCode: 'OTHER_REGION', plantName: 'Other Region' }
                    ]}
                    currentValue={
                        selectedEntryIdForPlant
                            ? entries.find((e) => e.id === selectedEntryIdForPlant)?.destination_plant
                            : ''
                    }
                />
            )}
            {showOperatorModal && !loading && (
                <OperatorSelectModal
                    isOpen={showOperatorModal}
                    onClose={() => {
                        setShowOperatorModal(false)
                        setSelectedEntryIdForOperator(null)
                        setSelectedOperatorIndex(null)
                    }}
                    onSelect={(operatorId) => {
                        if (selectedEntryIdForOperator !== null && selectedOperatorIndex !== null) {
                            handlers.updateOperator(
                                selectedEntryIdForOperator,
                                selectedOperatorIndex,
                                'operator_id',
                                operatorId
                            )
                        }
                        setShowOperatorModal(false)
                        setSelectedEntryIdForOperator(null)
                        setSelectedOperatorIndex(null)
                    }}
                    currentValue={
                        selectedEntryIdForOperator !== null && selectedOperatorIndex !== null
                            ? entries.find((e) => e.id === selectedEntryIdForOperator)?.operators[selectedOperatorIndex]
                                  ?.operator_id
                            : ''
                    }
                    operators={operators.filter((op) => {
                        if (!selectedEntryIdForOperator) return true
                        const currentEntry = entries.find((e) => e.id === selectedEntryIdForOperator)
                        if (!currentEntry) return true
                        const alreadySelected = currentEntry.operators
                            .filter((_, idx) => idx !== selectedOperatorIndex)
                            .map((o) => o.operator_id)
                        return !alreadySelected.includes(op.employeeId)
                    })}
                    assignedPlant={currentPlantCode}
                    mixers={[]}
                    onRefresh={refreshOperators}
                />
            )}
        </div>
    )
}
