/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useMemo } from 'react'

import { addMinutesToTime, minutesToTime, timeToMinutes } from '../../../../../utils/PlanUtility'
import { MilitaryTimeInput } from '../../../common/MilitaryTimeInput'

const TIME_MODE_CUSTOM = 'custom'
const TIME_MODE_STAGGER = 'stagger'

/**
 * Editor for an outbound route — destination, operator count, optional
 * destination job, return plant, time mode (staggered or per-driver custom),
 * and read-only travel/clock-in/return summary at the bottom. Styled to
 * match the rest of the planner: flat panels, single-pixel borders,
 * monospace tabular numbers, and uppercase section labels.
 */
export function PlanFlowRouteEditor({
    accentColor,
    clockIn,
    draft,
    mode,
    onCancel,
    onDelete,
    onSubmit,
    pickingDestination,
    plantProduction,
    plants,
    setDraft,
    setPickingDestination,
    stats,
    travel
}) {
    const leaveMinutes = timeToMinutes(draft.leaveTime)
    const returnTime = leaveMinutes != null && travel != null ? minutesToTime(leaveMinutes + travel) : null
    const driverCount = Math.max(1, parseInt(draft.driverCount, 10) || 1)
    const isCustom = draft.timeMode === TIME_MODE_CUSTOM
    const driverCountInputValue = draft.driverCount === '' || draft.driverCount == null ? '' : String(draft.driverCount)

    const destinationOptions = useMemo(() => {
        const inPlanCodes = new Set(stats.map((stat) => stat.code))
        const all = (plants || []).filter((plant) => plant.plant_code !== draft.fromPlant)
        return [...all].sort((a, b) => {
            const aPriority = inPlanCodes.has(a.plant_code) ? 0 : 1
            const bPriority = inPlanCodes.has(b.plant_code) ? 0 : 1
            if (aPriority !== bPriority) return aPriority - bPriority
            return a.plant_code.localeCompare(b.plant_code)
        })
    }, [plants, draft.fromPlant, stats])

    const destinationJobs = useMemo(() => {
        if (!draft.toPlant) return []
        const production = plantProduction?.[draft.toPlant]
        const orders = Array.isArray(production?.orders) ? production.orders : []
        return orders.slice().sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
    }, [plantProduction, draft.toPlant])

    const returnPlantOptions = useMemo(() => {
        const seen = new Set()
        const out = []
        ;(plants || []).forEach((plant) => {
            if (!plant?.plant_code || seen.has(plant.plant_code)) return
            seen.add(plant.plant_code)
            out.push(plant)
        })
        return out.sort((a, b) => a.plant_code.localeCompare(b.plant_code))
    }, [plants])

    const seedCustomTimesIfNeeded = (nextCount = driverCount) => {
        const existing = Array.isArray(draft.customTimes) ? draft.customTimes : []
        return Array.from({ length: nextCount }, (_, index) => {
            const prior = existing[index]
            if (prior && (prior.time || prior.leaveTime)) return prior
            const arrive = draft.time
                ? addMinutesToTime(draft.time, index * (parseInt(draft.staggerMinutes, 10) || 0))
                : ''
            return { leaveTime: draft.leaveTime || '', time: arrive || '' }
        })
    }

    const handleModeChange = (nextMode) => {
        if (nextMode === TIME_MODE_CUSTOM) {
            setDraft({ ...draft, customTimes: seedCustomTimesIfNeeded(), timeMode: TIME_MODE_CUSTOM })
        } else {
            setDraft({ ...draft, timeMode: TIME_MODE_STAGGER })
        }
    }

    const handleCountChange = (rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '')
        if (digitsOnly === '') {
            setDraft({ ...draft, driverCount: '' })
            return
        }
        const count = parseInt(digitsOnly, 10)
        if (isCustom) {
            const seeded = seedCustomTimesIfNeeded(Math.max(1, count))
            setDraft({ ...draft, customTimes: seeded, driverCount: count })
        } else {
            setDraft({ ...draft, driverCount: count })
        }
    }

    const handleCountBlur = () => {
        if (!draft.driverCount || parseInt(draft.driverCount, 10) < 1) {
            const seeded = isCustom ? seedCustomTimesIfNeeded(1) : draft.customTimes
            setDraft({ ...draft, customTimes: seeded, driverCount: 1 })
        }
    }

    const updateCustomTime = (index, field, value) => {
        const existing = Array.isArray(draft.customTimes) ? [...draft.customTimes] : []
        while (existing.length <= index) existing.push({ leaveTime: '', time: '' })
        existing[index] = { ...existing[index], [field]: value }
        setDraft({ ...draft, customTimes: existing })
    }

    const handleJobSelect = (orderId) => {
        if (!orderId) {
            setDraft({ ...draft, forOrderId: '' })
            return
        }
        const job = destinationJobs.find((order) => (order.orderId || order.orderNum) === orderId)
        if (!job) {
            setDraft({ ...draft, forOrderId: orderId })
            return
        }
        const next = {
            ...draft,
            forOrderId: job.orderId || job.orderNum || orderId,
            returnPlant: draft.returnPlant || draft.fromPlant
        }
        if (!draft.time && job.startTime) next.time = job.startTime
        setDraft(next)
    }

    return (
        <div className="px-4 py-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={onCancel}
                    className="border-none bg-transparent cursor-pointer flex items-center gap-1 text-[12px] font-semibold text-text-secondary"
                >
                    <i className="fas fa-chevron-left text-[10px]" /> Back
                </button>
                <h3 className="text-[14px] font-semibold ml-auto m-0 text-text-primary">
                    {mode === 'edit' ? 'Edit route' : 'New route'}
                </h3>
            </div>

            <RouteSummary accentColor={accentColor} draft={draft} />

            <LabeledField label="Destination">
                <div className="flex items-stretch gap-2">
                    <select
                        value={draft.toPlant || ''}
                        onChange={(event) => {
                            setDraft({ ...draft, toPlant: event.target.value })
                            setPickingDestination(false)
                        }}
                        className="flex-1 px-3 py-2 rounded-lg text-sm border bg-bg-primary border-border-medium text-text-primary"
                    >
                        <option value="">Select destination…</option>
                        {destinationOptions.map((plant) => (
                            <option key={plant.plant_code} value={plant.plant_code}>
                                {plant.plant_code}
                                {plant.plant_name ? ` — ${plant.plant_name}` : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setPickingDestination((value) => !value)}
                        className="px-3 rounded-lg text-[12px] font-semibold border cursor-pointer flex items-center gap-1.5"
                        style={{
                            background: pickingDestination ? '#f59e0b' : 'var(--bg-primary)',
                            borderColor: pickingDestination ? '#f59e0b' : 'var(--border-medium)',
                            color: pickingDestination ? '#fff' : 'var(--text-secondary)'
                        }}
                        title="Click a plant on the map"
                        aria-pressed={pickingDestination}
                    >
                        <i className="fas fa-crosshairs text-[11px]" />
                        Pick
                    </button>
                </div>
                {pickingDestination && (
                    <div className="text-[11px] mt-1 text-[#b45309]">
                        Click any plant on the map to set the destination.
                    </div>
                )}
            </LabeledField>

            <LabeledField label="Operators sent">
                <CountStepperInput
                    ariaLabel="Operators sent"
                    min={1}
                    onBlur={handleCountBlur}
                    onChange={handleCountChange}
                    value={driverCountInputValue}
                />
            </LabeledField>

            {destinationJobs.length > 0 && (
                <LabeledField
                    label={
                        <>
                            Loading for job{' '}
                            <span className="text-text-tertiary normal-case font-normal">· optional</span>
                        </>
                    }
                >
                    <select
                        value={draft.forOrderId || ''}
                        onChange={(event) => handleJobSelect(event.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm border bg-bg-primary border-border-medium text-text-primary"
                    >
                        <option value="">General help — no specific job</option>
                        {destinationJobs.map((job) => {
                            const id = job.orderId || job.orderNum || `${job.startTime}-${job.customer}`
                            const parts = [
                                job.startTime ? String(job.startTime).slice(0, 5) : '—',
                                job.orderNum ? `#${job.orderNum}` : null,
                                job.customer || null,
                                Number.isFinite(parseFloat(job.yardage)) ? `${parseFloat(job.yardage)}yd` : null
                            ].filter(Boolean)
                            return (
                                <option key={id} value={id}>
                                    {parts.join(' · ')}
                                </option>
                            )
                        })}
                    </select>
                </LabeledField>
            )}

            {draft.forOrderId && (
                <LabeledField
                    label={
                        <>
                            Return to{' '}
                            <span className="text-text-tertiary normal-case font-normal">· after pouring</span>
                        </>
                    }
                >
                    <select
                        value={draft.returnPlant || draft.fromPlant}
                        onChange={(event) => setDraft({ ...draft, returnPlant: event.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm border bg-bg-primary border-border-medium text-text-primary"
                    >
                        {returnPlantOptions.map((plant) => (
                            <option key={plant.plant_code} value={plant.plant_code}>
                                {plant.plant_code}
                                {plant.plant_name ? ` — ${plant.plant_name}` : ''}
                                {plant.plant_code === draft.fromPlant ? ' (home)' : ''}
                            </option>
                        ))}
                    </select>
                </LabeledField>
            )}

            <TimeModeToggle accentColor={accentColor} isCustom={isCustom} onModeChange={handleModeChange} />

            {!isCustom && <StaggerFields accentColor={accentColor} draft={draft} setDraft={setDraft} />}

            {isCustom && <CustomTimeRows draft={draft} driverCount={driverCount} onUpdate={updateCustomTime} />}

            <SummaryRow accentColor={accentColor} clockIn={clockIn} returnTime={returnTime} travel={travel} />

            <div className="flex gap-2 pt-1">
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer border bg-bg-primary border-border-medium text-red-600"
                    >
                        <i className="fas fa-trash mr-1" /> Delete
                    </button>
                )}
                <button
                    onClick={onCancel}
                    className="px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer border bg-bg-primary border-border-medium text-text-secondary"
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    disabled={!draft.toPlant}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-check mr-1" /> {mode === 'edit' ? 'Save changes' : 'Create route'}
                </button>
            </div>
        </div>
    )
}

function RouteSummary({ accentColor, draft }) {
    return (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2 bg-bg-primary border border-border-light">
            <PlantTag accentColor={accentColor} code={draft.fromPlant || '—'} />
            <i className="fas fa-arrow-right text-[11px] text-text-tertiary" />
            {draft.toPlant ? (
                <PlantTag accentColor={accentColor} code={draft.toPlant} />
            ) : (
                <span className="text-[12px] italic text-text-tertiary">Pick destination…</span>
            )}
        </div>
    )
}

function PlantTag({ accentColor, code }) {
    return (
        <span
            className="inline-flex items-center justify-center rounded-md text-white text-[12px] font-semibold font-mono tabular-nums h-7 min-w-[40px] px-2"
            style={{ background: accentColor }}
        >
            {code}
        </span>
    )
}

function TimeModeToggle({ accentColor, isCustom, onModeChange }) {
    return (
        <div>
            <SectionLabel className="mb-1.5">Operator times</SectionLabel>
            <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-border-medium bg-bg-primary">
                {[TIME_MODE_STAGGER, TIME_MODE_CUSTOM].map((modeOption) => {
                    const active = (modeOption === TIME_MODE_CUSTOM) === isCustom
                    return (
                        <button
                            key={modeOption}
                            type="button"
                            onClick={() => onModeChange(modeOption)}
                            aria-pressed={active}
                            className="border-none cursor-pointer text-[12px] font-semibold py-2"
                            style={{
                                background: active ? accentColor : 'transparent',
                                color: active ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            {modeOption === TIME_MODE_STAGGER ? 'Staggered' : 'Per operator'}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function StaggerFields({ accentColor, draft, setDraft }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-2">
                <LabeledField label="Arrival time">
                    <MilitaryTimeInput
                        extraClass="w-full"
                        onChange={(next) => setDraft({ ...draft, time: next })}
                        value={draft.time || ''}
                    />
                </LabeledField>
                <LabeledField
                    label={
                        <>
                            Leave time <span className="text-text-tertiary normal-case font-normal">· return</span>
                        </>
                    }
                >
                    <MilitaryTimeInput
                        extraClass="w-full"
                        onChange={(next) => setDraft({ ...draft, leaveTime: next })}
                        value={draft.leaveTime || ''}
                    />
                </LabeledField>
            </div>
            <LabeledField
                label={
                    <>
                        Stagger{' '}
                        <span className="text-text-tertiary normal-case font-normal">
                            · {draft.staggerMinutes || 0} min between operators
                        </span>
                    </>
                }
            >
                <input
                    type="range"
                    min={0}
                    max={15}
                    step={1}
                    value={draft.staggerMinutes || 0}
                    onChange={(event) => setDraft({ ...draft, staggerMinutes: parseInt(event.target.value, 10) })}
                    className="w-full"
                    style={{ accentColor }}
                />
                <div className="flex justify-between text-[10.5px] text-text-tertiary">
                    <span>0m</span>
                    <span>15m</span>
                </div>
            </LabeledField>
        </>
    )
}

function CustomTimeRows({ draft, driverCount, onUpdate }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="grid grid-cols-[28px_1fr_1fr] gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary px-1">
                <span>#</span>
                <span>Arrive</span>
                <span>Leave</span>
            </div>
            {Array.from({ length: driverCount }, (_, index) => {
                const rowTimes = draft.customTimes?.[index] || {}
                return (
                    <div key={index} className="grid grid-cols-[28px_1fr_1fr] gap-2 items-center">
                        <span className="font-mono tabular-nums text-[12px] font-semibold text-text-secondary text-center">
                            {index + 1}
                        </span>
                        <MilitaryTimeInput
                            compact
                            extraClass="w-full"
                            onChange={(next) => onUpdate(index, 'time', next)}
                            value={rowTimes.time || ''}
                        />
                        <MilitaryTimeInput
                            compact
                            extraClass="w-full"
                            onChange={(next) => onUpdate(index, 'leaveTime', next)}
                            value={rowTimes.leaveTime || ''}
                        />
                    </div>
                )
            })}
        </div>
    )
}

function SummaryRow({ accentColor, clockIn, returnTime, travel }) {
    return (
        <div className="grid grid-cols-3 rounded-lg overflow-hidden border border-border-light">
            <SummaryCell label="Travel" value={travel != null ? `${travel}m` : '—'} />
            <SummaryCell label="Clock-in" value={clockIn || '—'} valueColor={clockIn ? '#16a34a' : undefined} />
            <SummaryCell
                label="Return"
                value={returnTime || '—'}
                valueColor={returnTime ? accentColor : undefined}
                isLast
            />
        </div>
    )
}

function SummaryCell({ isLast = false, label, value, valueColor }) {
    return (
        <div
            className={`px-3 py-2 flex flex-col gap-0.5 bg-bg-primary ${isLast ? '' : 'border-r border-border-light'}`}
        >
            <span className="text-[10.5px] text-text-secondary">{label}</span>
            <span
                className="text-[14px] font-semibold font-mono tabular-nums truncate"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
            </span>
        </div>
    )
}

function LabeledField({ children, label }) {
    return (
        <div className="flex flex-col gap-1.5">
            <SectionLabel>{label}</SectionLabel>
            {children}
        </div>
    )
}

function SectionLabel({ children, className = '' }) {
    return (
        <div className={`text-[11px] font-semibold uppercase tracking-wider text-text-secondary ${className}`}>
            {children}
        </div>
    )
}

/**
 * Numeric stepper used for operator counts. `type="text"` keeps native
 * arrow-key stepping and scroll-wheel mutation off the input so the user
 * can backspace to clear the field; `inputMode="numeric"` surfaces the
 * numeric keypad on mobile.
 */
function CountStepperInput({ ariaLabel, max, min = 0, onBlur, onChange, value }) {
    const numericValue = parseInt(value, 10)
    const safeNumeric = Number.isFinite(numericValue) ? numericValue : 0
    const atMax = max != null && safeNumeric >= max
    const atMin = safeNumeric <= min
    const decrement = () => onChange(String(Math.max(min, safeNumeric - 1)))
    const increment = () => onChange(String(Math.min(max ?? safeNumeric + 1, safeNumeric + 1)))
    return (
        <div className="flex items-stretch rounded-lg overflow-hidden border bg-bg-primary border-border-medium">
            <button
                type="button"
                onClick={decrement}
                disabled={atMin}
                aria-label="Decrease"
                className="px-3 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary border-r border-border-light"
            >
                −
            </button>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onFocus={(event) => event.target.select()}
                aria-label={ariaLabel}
                className="flex-1 px-3 py-1.5 text-sm font-mono tabular-nums text-center bg-transparent border-none outline-none text-text-primary"
            />
            <button
                type="button"
                onClick={increment}
                disabled={atMax}
                aria-label="Increase"
                className="px-3 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary border-l border-border-light"
            >
                +
            </button>
        </div>
    )
}
