import React from 'react'

import { addMinutesToTime, DEFAULT_STAGGER_MINUTES } from '../../../utils/PlanUtility'
import { TimeInput } from '../common/PlanComponents'

const TIME_MODES = ['stagger', 'custom']

const computeOperatorArrival = (assignment, operatorIndex) => {
    if (assignment.timeMode === 'custom') return assignment.customTimes?.[operatorIndex]?.time ?? null
    if (!assignment.time) return null
    return addMinutesToTime(assignment.time, operatorIndex * (assignment.staggerMinutes || DEFAULT_STAGGER_MINUTES))
}

/**
 * Expanded operator-detail pane shown below an assignment row when its
 * driver count is > 1. Toggles between staggered (every-N-minutes) and
 * custom-per-operator scheduling, and renders a card per operator.
 */
export function PlanAssignmentDetails({
    accentColor,
    assignment,
    calcClockIn,
    switchToCustom,
    updateAssignment,
    updateCustomTime
}) {
    return (
        <div
            className="px-4 py-3 border-t"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
        >
            <DetailControls
                accentColor={accentColor}
                assignment={assignment}
                switchToCustom={switchToCustom}
                updateAssignment={updateAssignment}
            />
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {Array.from({ length: assignment.driverCount }, (_, operatorIndex) => (
                    <OperatorRow
                        key={operatorIndex}
                        accentColor={accentColor}
                        assignment={assignment}
                        calcClockIn={calcClockIn}
                        operatorIndex={operatorIndex}
                        updateCustomTime={updateCustomTime}
                    />
                ))}
            </div>
        </div>
    )
}

function DetailControls({ accentColor, assignment, switchToCustom, updateAssignment }) {
    return (
        <div className="flex items-center gap-3 mb-2.5">
            <div className="rounded-md flex overflow-hidden" style={{ border: '1px solid var(--border-medium)' }}>
                {TIME_MODES.map((mode) => {
                    const isActive =
                        mode === 'custom' ? assignment.timeMode === 'custom' : assignment.timeMode !== 'custom'
                    return (
                        <button
                            key={mode}
                            onClick={() =>
                                mode === 'custom'
                                    ? switchToCustom(assignment.id)
                                    : updateAssignment(assignment.id, 'timeMode', 'stagger')
                            }
                            className="border-none cursor-pointer text-[11px] font-semibold px-3 py-1"
                            style={{
                                background: isActive ? accentColor : 'transparent',
                                color: isActive ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    )
                })}
            </div>
            {assignment.timeMode !== 'custom' && (
                <StaggerInput assignment={assignment} updateAssignment={updateAssignment} />
            )}
        </div>
    )
}

function StaggerInput({ assignment, updateAssignment }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                Every
            </span>
            <input
                type="number"
                min="5"
                step="5"
                value={assignment.staggerMinutes || DEFAULT_STAGGER_MINUTES}
                onChange={(event) =>
                    updateAssignment(
                        assignment.id,
                        'staggerMinutes',
                        parseInt(event.target.value, 10) || DEFAULT_STAGGER_MINUTES
                    )
                }
                className="border rounded-md text-xs outline-none py-1 px-1.5 text-center w-[40px]"
                style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-medium)',
                    color: 'var(--text-primary)'
                }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                min
            </span>
        </div>
    )
}

function OperatorRow({ accentColor, assignment, calcClockIn, operatorIndex, updateCustomTime }) {
    const isCustom = assignment.timeMode === 'custom'
    const customTime = assignment.customTimes?.[operatorIndex] || {}
    const arrival = computeOperatorArrival(assignment, operatorIndex)
    const opClockIn = arrival ? calcClockIn(arrival, assignment.fromPlant, assignment.toPlant) : null

    return (
        <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-2"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <span
                className="inline-flex items-center justify-center rounded text-white text-[9px] font-bold w-5 h-5 shrink-0"
                style={{ background: accentColor }}
            >
                {operatorIndex + 1}
            </span>
            {isCustom ? (
                <>
                    <TimeInput
                        value={customTime.time}
                        onChange={(val) => updateCustomTime(assignment.id, operatorIndex, 'time', val)}
                        placeholder="Arrive"
                    />
                    <TimeInput
                        value={customTime.leaveTime}
                        onChange={(val) => updateCustomTime(assignment.id, operatorIndex, 'leaveTime', val)}
                        placeholder="Leave"
                    />
                </>
            ) : (
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-primary)' }}>
                    {arrival || '--:--'}
                </span>
            )}
            <span
                className="ml-auto text-[11px] font-mono font-bold"
                style={{ color: opClockIn ? '#16a34a' : 'var(--text-secondary)' }}
            >
                {opClockIn || '--:--'}
            </span>
            <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                in
            </span>
        </div>
    )
}
