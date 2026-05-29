/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import {
    addMinutesToTime,
    isAssignmentTimingComplete,
    minutesToTime,
    timeToMinutes
} from '../../../../../utils/PlanUtility'
import { CustomTimeRows } from './route-editor/CustomTimeRows'
import { CountStepperInput, LabeledField } from './route-editor/FormPrimitives'
import { RouteSummary } from './route-editor/RouteSummary'
import { StaggerFields } from './route-editor/StaggerFields'
import { SummaryRow } from './route-editor/SummaryRow'
import { TIME_MODE_CUSTOM, TIME_MODE_STAGGER } from './route-editor/timeModes'
import { TimeModeToggle } from './route-editor/TimeModeToggle'

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
    const timingComplete = isAssignmentTimingComplete(draft)
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
                    className="border-none bg-transparent cursor-pointer flex items-center gap-1 text-[12px] font-semibold text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
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
                    <div className="relative flex-1">
                        <select
                            value={draft.toPlant || ''}
                            onChange={(event) => {
                                setDraft({ ...draft, toPlant: event.target.value })
                                setPickingDestination(false)
                            }}
                            className="w-full appearance-none px-3 py-2 pr-9 rounded-lg text-sm border bg-bg-primary border-border-medium text-text-primary cursor-pointer outline-none transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
                        >
                            <option value="">Select destination…</option>
                            {destinationOptions.map((plant) => (
                                <option key={plant.plant_code} value={plant.plant_code}>
                                    {plant.plant_code}
                                    {plant.plant_name ? ` — ${plant.plant_name}` : ''}
                                </option>
                            ))}
                        </select>
                        <i
                            aria-hidden="true"
                            className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-text-tertiary"
                        />
                    </div>
                    <button
                        onClick={() => setPickingDestination((value) => !value)}
                        className="px-3 rounded-lg text-[12px] font-semibold border cursor-pointer flex items-center gap-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
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
                    <div className="text-[11px] mt-1 text-text-primary">
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
                    <div className="relative">
                        <select
                            value={draft.forOrderId || ''}
                            onChange={(event) => handleJobSelect(event.target.value)}
                            className="w-full appearance-none px-3 py-2 pr-9 rounded-lg text-sm border bg-bg-primary border-border-medium text-text-primary cursor-pointer outline-none transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
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
                        <i
                            aria-hidden="true"
                            className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-text-tertiary"
                        />
                    </div>
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
                    <div className="relative">
                        <select
                            value={draft.returnPlant || draft.fromPlant}
                            onChange={(event) => setDraft({ ...draft, returnPlant: event.target.value })}
                            className="w-full appearance-none px-3 py-2 pr-9 rounded-lg text-sm border bg-bg-primary border-border-medium text-text-primary cursor-pointer outline-none transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
                        >
                            {returnPlantOptions.map((plant) => (
                                <option key={plant.plant_code} value={plant.plant_code}>
                                    {plant.plant_code}
                                    {plant.plant_name ? ` — ${plant.plant_name}` : ''}
                                    {plant.plant_code === draft.fromPlant ? ' (home)' : ''}
                                </option>
                            ))}
                        </select>
                        <i
                            aria-hidden="true"
                            className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-text-tertiary"
                        />
                    </div>
                </LabeledField>
            )}

            <TimeModeToggle accentColor={accentColor} isCustom={isCustom} onModeChange={handleModeChange} />

            {!isCustom && <StaggerFields accentColor={accentColor} draft={draft} setDraft={setDraft} />}

            {isCustom && <CustomTimeRows draft={draft} driverCount={driverCount} onUpdate={updateCustomTime} />}

            <SummaryRow clockIn={clockIn} returnTime={returnTime} travel={travel} />

            {draft.toPlant && !timingComplete && (
                <p className="text-[11.5px] leading-snug text-text-tertiary" role="status">
                    Add an arrival and leave time for {isCustom ? 'every operator' : 'this route'} before sending help.
                </p>
            )}

            <div className="flex gap-2 pt-1">
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer border bg-bg-primary border-border-medium text-text-primary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                    >
                        <i className="fas fa-trash mr-1" /> Delete
                    </button>
                )}
                <button
                    onClick={onCancel}
                    className="px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer border bg-bg-primary border-border-medium text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    disabled={!draft.toPlant || !timingComplete}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-check mr-1" /> {mode === 'edit' ? 'Save changes' : 'Create route'}
                </button>
            </div>
        </div>
    )
}
