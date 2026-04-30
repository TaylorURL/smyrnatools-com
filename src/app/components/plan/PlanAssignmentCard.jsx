import React from 'react'

import { DEFAULT_STAGGER_MINUTES } from '../../../utils/PlanUtility'
import { PlantSelect, TimeInput } from '../common/PlanComponents'
import { PlanAssignmentDetails } from './PlanAssignmentDetails'

/**
 * Single assignment card in the dispatch planner. Two-row layout:
 *
 *  - Row 1: route (from/to plant), op count, arrive/leave times, clock-in.
 *  - Row 2: badges (stagger, travel, load) and expand/delete actions.
 *
 * The expanded panel shows per-operator stagger / custom time controls.
 */
export default function PlanAssignmentCard({
    accentColor,
    assignment,
    assignmentCount,
    calcClockIn,
    index,
    isExpanded,
    moveAssignment,
    onDelete,
    plants,
    switchToCustom,
    toggleRowExpanded,
    travelTime,
    updateAssignment,
    updateCustomTime
}) {
    const clockIn =
        assignment.time && travelTime !== null
            ? calcClockIn(assignment.time, assignment.fromPlant, assignment.toPlant)
            : null
    const missingTravelTime = travelTime === null && assignment.fromPlant && assignment.toPlant
    const hasDetails = assignment.driverCount > 1

    return (
        <div
            className="rounded-lg border transition-opacity"
            style={{
                background: 'var(--bg-primary)',
                borderColor: isExpanded ? accentColor : 'var(--border-light)'
            }}
        >
            <PrimaryRow
                accentColor={accentColor}
                assignment={assignment}
                assignmentCount={assignmentCount}
                clockIn={clockIn}
                index={index}
                moveAssignment={moveAssignment}
                plants={plants}
                travelTime={travelTime}
                updateAssignment={updateAssignment}
            />
            <BadgeRow
                accentColor={accentColor}
                assignment={assignment}
                hasDetails={hasDetails}
                isExpanded={isExpanded}
                missingTravelTime={missingTravelTime}
                travelTime={travelTime}
                onDelete={onDelete}
                onToggleExpanded={() => toggleRowExpanded(assignment.id)}
                updateAssignment={updateAssignment}
            />
            {isExpanded && hasDetails && (
                <PlanAssignmentDetails
                    accentColor={accentColor}
                    assignment={assignment}
                    calcClockIn={calcClockIn}
                    switchToCustom={switchToCustom}
                    updateAssignment={updateAssignment}
                    updateCustomTime={updateCustomTime}
                />
            )}
        </div>
    )
}

function FieldGroup({ label, children, className = '' }) {
    return (
        <div className={`flex flex-col gap-0.5 shrink-0 ${className}`}>
            <span
                className="text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
            >
                {label}
            </span>
            {children}
        </div>
    )
}

function ReorderControls({ accentColor, assignmentCount, index, onMove }) {
    return (
        <div className="flex flex-col items-center gap-0.5 shrink-0">
            {index > 0 && (
                <button
                    onClick={() => onMove(-1)}
                    className="border-none bg-transparent cursor-pointer p-0 opacity-40 hover:opacity-100 transition-opacity leading-none"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-caret-up text-[10px]" />
                </button>
            )}
            <span
                className="inline-flex items-center justify-center rounded-md text-white text-[11px] font-bold w-6 h-6"
                style={{ background: accentColor }}
            >
                {index + 1}
            </span>
            {index < assignmentCount - 1 && (
                <button
                    onClick={() => onMove(1)}
                    className="border-none bg-transparent cursor-pointer p-0 opacity-40 hover:opacity-100 transition-opacity leading-none"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-caret-down text-[10px]" />
                </button>
            )}
        </div>
    )
}

function RouteGroup({ accentColor, assignment, plants, travelTime, updateAssignment }) {
    return (
        <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 shrink-0"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <FieldGroup label="From">
                <PlantSelect
                    value={assignment.fromPlant}
                    onChange={(event) => updateAssignment(assignment.id, 'fromPlant', event.target.value)}
                    plants={plants}
                    excludeValue={assignment.toPlant}
                    placeholder="—"
                    className="!w-[80px]"
                />
            </FieldGroup>
            <i
                className="fas fa-arrow-right text-xs mt-3 shrink-0"
                style={{ color: travelTime !== null ? accentColor : 'var(--border-medium)' }}
            />
            <FieldGroup label="To">
                <PlantSelect
                    value={assignment.toPlant}
                    onChange={(event) => updateAssignment(assignment.id, 'toPlant', event.target.value)}
                    plants={plants}
                    excludeValue={assignment.fromPlant}
                    placeholder="—"
                    className="!w-[80px]"
                />
            </FieldGroup>
        </div>
    )
}

function OpsInput({ assignment, updateAssignment }) {
    return (
        <FieldGroup label="Ops">
            <input
                type="number"
                min="1"
                value={assignment.driverCount || ''}
                onChange={(event) =>
                    updateAssignment(
                        assignment.id,
                        'driverCount',
                        event.target.value === '' ? '' : Math.max(1, parseInt(event.target.value, 10) || 1)
                    )
                }
                className="border rounded-md text-sm outline-none font-mono text-center py-1.5 px-1.5 w-[48px]"
                style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-medium)',
                    color: 'var(--text-primary)'
                }}
            />
        </FieldGroup>
    )
}

function ClockInDisplay({ clockIn }) {
    return (
        <div
            className="ml-auto flex flex-col items-end gap-0.5 shrink-0 rounded-lg px-3 py-1.5"
            style={{
                background: clockIn ? '#16a34a10' : 'var(--bg-secondary)',
                border: `1px solid ${clockIn ? '#16a34a30' : 'var(--border-light)'}`
            }}
        >
            <span
                className="text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: clockIn ? '#16a34a' : 'var(--text-secondary)' }}
            >
                Clock In
            </span>
            <span
                className="font-mono font-bold text-lg leading-none"
                style={{ color: clockIn ? '#16a34a' : 'var(--border-medium)' }}
            >
                {clockIn || '--:--'}
            </span>
        </div>
    )
}

function PrimaryRow({
    accentColor,
    assignment,
    assignmentCount,
    clockIn,
    index,
    moveAssignment,
    plants,
    travelTime,
    updateAssignment
}) {
    return (
        <div className="flex items-center gap-3 px-3 pt-3 pb-2">
            <ReorderControls
                accentColor={accentColor}
                assignmentCount={assignmentCount}
                index={index}
                onMove={(delta) => moveAssignment(assignment.id, delta)}
            />
            <RouteGroup
                accentColor={accentColor}
                assignment={assignment}
                plants={plants}
                travelTime={travelTime}
                updateAssignment={updateAssignment}
            />
            <OpsInput assignment={assignment} updateAssignment={updateAssignment} />
            <FieldGroup label="Arrive">
                <TimeInput
                    value={assignment.time}
                    onChange={(val) => updateAssignment(assignment.id, 'time', val)}
                    className="!w-[80px]"
                />
            </FieldGroup>
            <FieldGroup label="Leave">
                <TimeInput
                    value={assignment.leaveTime}
                    onChange={(val) => updateAssignment(assignment.id, 'leaveTime', val)}
                    className="!w-[80px]"
                />
            </FieldGroup>
            <ClockInDisplay clockIn={clockIn} />
        </div>
    )
}

function Pill({ background, border, color, children }) {
    return (
        <span className="text-[10px] font-semibold rounded-full px-2.5 py-1" style={{ background, border, color }}>
            {children}
        </span>
    )
}

function BadgeRow({
    accentColor,
    assignment,
    hasDetails,
    isExpanded,
    missingTravelTime,
    travelTime,
    onDelete,
    onToggleExpanded,
    updateAssignment
}) {
    const showStaggerBadge = assignment.driverCount > 1 && assignment.timeMode !== 'custom'
    const showCustomBadge = assignment.driverCount > 1 && assignment.timeMode === 'custom'
    return (
        <div className="flex items-center gap-1.5 px-3 pb-2.5 flex-wrap" style={{ marginLeft: 36 }}>
            {showStaggerBadge && (
                <Pill
                    background="var(--bg-tertiary)"
                    border="1px solid var(--border-light)"
                    color="var(--text-secondary)"
                >
                    <i className="fas fa-clock text-[8px] mr-1" style={{ opacity: 0.6 }} />
                    {assignment.staggerMinutes || DEFAULT_STAGGER_MINUTES}m stagger
                </Pill>
            )}
            {showCustomBadge && (
                <Pill background={`${accentColor}10`} border={`1px solid ${accentColor}25`} color={accentColor}>
                    <i className="fas fa-sliders-h text-[8px] mr-1" style={{ opacity: 0.7 }} />
                    custom times
                </Pill>
            )}
            {travelTime !== null && (
                <Pill
                    background="var(--bg-tertiary)"
                    border="1px solid var(--border-light)"
                    color="var(--text-secondary)"
                >
                    <i className="fas fa-route text-[8px] mr-1" style={{ opacity: 0.6 }} />
                    {travelTime}m travel
                </Pill>
            )}
            {missingTravelTime && (
                <Pill background="#fef3c715" border="1px solid #d9770625" color="#d97706">
                    <i className="fas fa-exclamation-triangle text-[8px] mr-1" />
                    no travel time
                </Pill>
            )}
            <LoadFromPlantToggle
                accentColor={accentColor}
                assignment={assignment}
                updateAssignment={updateAssignment}
            />
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 shrink-0">
                {hasDetails && (
                    <button
                        onClick={onToggleExpanded}
                        className="border-none cursor-pointer p-1.5 rounded-md transition-colors"
                        style={{
                            background: isExpanded ? `${accentColor}15` : 'transparent',
                            color: isExpanded ? accentColor : 'var(--text-secondary)'
                        }}
                        title={isExpanded ? 'Collapse' : 'Expand operator details'}
                    >
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px]`} />
                    </button>
                )}
                <button
                    onClick={onDelete}
                    className="flex items-center gap-1.5 border-none rounded-md cursor-pointer px-2.5 py-1.5 text-[10px] font-semibold transition-colors"
                    style={{ background: '#ef444415', border: '1px solid #ef444425', color: '#ef4444' }}
                >
                    <i className="fas fa-trash text-[9px]" />
                    Delete
                </button>
            </div>
        </div>
    )
}

function LoadFromPlantToggle({ accentColor, assignment, updateAssignment }) {
    const isLoaded = !!assignment.loadFromPlant
    return (
        <label
            className="flex items-center gap-1.5 cursor-pointer shrink-0 text-[10px] font-semibold rounded-full px-2.5 py-1"
            style={{
                background: isLoaded ? `${accentColor}10` : 'var(--bg-tertiary)',
                border: `1px solid ${isLoaded ? `${accentColor}25` : 'var(--border-light)'}`,
                color: isLoaded ? accentColor : 'var(--text-secondary)'
            }}
        >
            <input
                type="checkbox"
                checked={isLoaded}
                onChange={(event) => updateAssignment(assignment.id, 'loadFromPlant', event.target.checked)}
                className="cursor-pointer h-3 w-3 rounded"
                style={{ accentColor }}
            />
            Load from Plant
        </label>
    )
}
