import React, { useMemo } from 'react'

import { addMinutesToTime, minutesToTime, timeToMinutes } from '../../../utils/PlanUtility'

const TIME_MODE_CUSTOM = 'custom'
const TIME_MODE_STAGGER = 'stagger'

/**
 * Editor for an outbound route — destination, truck count, optional
 * destination job, return plant, time mode (staggered or per-driver
 * custom), and read-only travel/clock-in/return summary at the bottom.
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

    const destinationOptions = useMemo(() => {
        // Show all plants except the sender; prefer ones already in the plan.
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
        const count = Math.max(1, parseInt(rawValue, 10) || 1)
        if (isCustom) {
            const seeded = seedCustomTimesIfNeeded(count)
            setDraft({ ...draft, customTimes: seeded, driverCount: count })
        } else {
            setDraft({ ...draft, driverCount: count })
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
        // Auto-fill arrival to the job's scheduled start time so the trucks
        // land right when the pour begins. Dispatcher can tweak afterward.
        const next = {
            ...draft,
            forOrderId: job.orderId || job.orderNum || orderId,
            returnPlant: draft.returnPlant || draft.fromPlant
        }
        if (!draft.time && job.startTime) next.time = job.startTime
        setDraft(next)
    }

    return (
        <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={onCancel}
                    className="border-none bg-transparent cursor-pointer flex items-center gap-1 text-xs font-semibold text-text-secondary"
                >
                    <i className="fas fa-chevron-left text-[10px]" /> Back
                </button>
                <div className="font-bold text-[16px] ml-auto text-text-primary font-heading">
                    {mode === 'edit' ? 'Edit Route' : 'New Route'}
                </div>
            </div>

            <FromToFlowSummary accentColor={accentColor} draft={draft} />

            <div className="flex items-center gap-2">
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
                    className="px-2.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                    style={{
                        background: pickingDestination ? '#f59e0b' : 'var(--bg-primary)',
                        borderColor: pickingDestination ? '#f59e0b' : 'var(--border-medium)',
                        color: pickingDestination ? '#fff' : 'var(--text-secondary)'
                    }}
                    title="Click a plant on the canvas"
                >
                    <i className="fas fa-crosshairs" />
                </button>
            </div>

            <LabeledField label="Trucks">
                <input
                    type="number"
                    min={1}
                    value={draft.driverCount}
                    onChange={(event) => handleCountChange(event.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border font-mono bg-bg-primary border-border-medium text-text-primary"
                />
            </LabeledField>

            {destinationJobs.length > 0 && (
                <LabeledField
                    label={
                        <>
                            Loading for job <span className="text-text-tertiary font-medium">· optional</span>
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
                            Return to <span className="text-text-tertiary font-medium">· after pouring</span>
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

            {isCustom && (
                <CustomTimeRows
                    accentColor={accentColor}
                    draft={draft}
                    driverCount={driverCount}
                    onUpdate={updateCustomTime}
                />
            )}

            <SummaryRow accentColor={accentColor} clockIn={clockIn} returnTime={returnTime} travel={travel} />

            <div className="flex gap-2 mt-auto">
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border bg-bg-primary border-border-medium text-red-600"
                    >
                        <i className="fas fa-trash mr-1" /> Delete
                    </button>
                )}
                <button
                    onClick={onCancel}
                    className="px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border bg-bg-primary border-border-medium text-text-secondary"
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    disabled={!draft.toPlant}
                    className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-check mr-1" /> {mode === 'edit' ? 'Save changes' : 'Create route'}
                </button>
            </div>
        </div>
    )
}

function FromToFlowSummary({ accentColor, draft }) {
    return (
        <div className="rounded-xl p-3 flex items-center justify-between gap-2 bg-bg-secondary border border-border-light">
            <div
                className="rounded-lg px-3 py-2 text-center flex-1"
                style={{ background: `${accentColor}14`, color: accentColor }}
            >
                <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">From</div>
                <div className="font-bold text-lg font-heading">{draft.fromPlant || '—'}</div>
            </div>
            <div className="text-text-tertiary">
                <i className="fas fa-arrow-right" />
            </div>
            <div
                className="rounded-lg px-3 py-2 text-center flex-1"
                style={{
                    background: draft.toPlant ? `${accentColor}14` : 'var(--bg-primary)',
                    border: draft.toPlant ? 'none' : '1px dashed var(--border-medium)',
                    color: draft.toPlant ? accentColor : 'var(--text-tertiary)'
                }}
            >
                <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">To</div>
                <div className="font-bold text-lg font-heading">{draft.toPlant || 'Pick…'}</div>
            </div>
        </div>
    )
}

function TimeModeToggle({ accentColor, isCustom, onModeChange }) {
    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-text-secondary">
                Operator times
            </div>
            <div className="inline-flex rounded-md overflow-hidden border border-border-medium">
                {[TIME_MODE_STAGGER, TIME_MODE_CUSTOM].map((modeOption) => {
                    const active = (modeOption === TIME_MODE_CUSTOM) === isCustom
                    return (
                        <button
                            key={modeOption}
                            type="button"
                            onClick={() => onModeChange(modeOption)}
                            className="border-none cursor-pointer text-[11px] font-semibold px-3 py-1.5"
                            style={{
                                background: active ? accentColor : 'transparent',
                                color: active ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            {modeOption === TIME_MODE_STAGGER ? 'Staggered' : 'Custom per operator'}
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
                    <input
                        type="time"
                        value={draft.time || ''}
                        onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm border font-mono bg-bg-primary border-border-medium text-text-primary"
                    />
                </LabeledField>
                <LabeledField
                    label={
                        <>
                            Leave time <span className="text-text-tertiary font-medium">· return</span>
                        </>
                    }
                >
                    <input
                        type="time"
                        value={draft.leaveTime || ''}
                        onChange={(event) => setDraft({ ...draft, leaveTime: event.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm border font-mono bg-bg-primary border-border-medium text-text-primary"
                    />
                </LabeledField>
            </div>
            <LabeledField
                label={
                    <>
                        Stagger{' '}
                        <span className="text-text-tertiary font-medium">
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
                <div className="flex justify-between text-[10px] text-text-tertiary">
                    <span>0m</span>
                    <span>15m</span>
                </div>
            </LabeledField>
        </>
    )
}

function CustomTimeRows({ accentColor, draft, driverCount, onUpdate }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[24px_1fr_1fr] gap-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                <span>#</span>
                <span>Arrive</span>
                <span>Leave</span>
            </div>
            {Array.from({ length: driverCount }, (_, index) => {
                const rowTimes = draft.customTimes?.[index] || {}
                return (
                    <div key={index} className="grid grid-cols-[24px_1fr_1fr] gap-2 items-center">
                        <span
                            className="inline-flex items-center justify-center rounded text-white text-[10px] font-bold w-6 h-6 shrink-0"
                            style={{ background: accentColor }}
                        >
                            {index + 1}
                        </span>
                        <input
                            type="time"
                            value={rowTimes.time || ''}
                            onChange={(event) => onUpdate(index, 'time', event.target.value)}
                            className="w-full px-2 py-1.5 rounded-md text-[12px] border font-mono bg-bg-primary border-border-medium text-text-primary"
                        />
                        <input
                            type="time"
                            value={rowTimes.leaveTime || ''}
                            onChange={(event) => onUpdate(index, 'leaveTime', event.target.value)}
                            className="w-full px-2 py-1.5 rounded-md text-[12px] border font-mono bg-bg-primary border-border-medium text-text-primary"
                        />
                    </div>
                )
            })}
        </div>
    )
}

function SummaryRow({ accentColor, clockIn, returnTime, travel }) {
    return (
        <div className="rounded-lg p-3 grid grid-cols-3 gap-2 bg-bg-secondary border border-border-light">
            <SummaryCell label="Travel" value={travel != null ? `${travel}m` : '—'} />
            <SummaryCell label="Clock-in" value={clockIn || '—'} color={clockIn ? '#16a34a' : 'var(--text-tertiary)'} />
            <SummaryCell
                label="Return"
                value={returnTime || '—'}
                color={returnTime ? accentColor : 'var(--text-tertiary)'}
            />
        </div>
    )
}

function SummaryCell({ color, label, value }) {
    return (
        <div>
            <div className="text-[9px] uppercase tracking-wider font-bold text-text-tertiary">{label}</div>
            <div className="font-bold text-base font-heading" style={{ color: color || 'var(--text-primary)' }}>
                {value}
            </div>
        </div>
    )
}

function LabeledField({ children, label }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</div>
            {children}
        </div>
    )
}
