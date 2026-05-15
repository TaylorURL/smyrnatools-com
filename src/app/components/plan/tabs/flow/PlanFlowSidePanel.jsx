/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

/** Empty-state shown when no plant is selected. Matches the flat
 *  `bg-bg-primary` aesthetic the rest of the planner uses — no rounded
 *  badges or accent fills. */
export function PlanFlowEmptyPanel({ accentColor }) {
    return (
        <div className="flex flex-col items-center justify-center text-center px-6 py-10 flex-1">
            <i className="fas fa-arrow-pointer text-[26px] mb-3" style={{ color: accentColor }} />
            <div className="text-[14px] font-semibold mb-1 text-text-primary">Pick a plant</div>
            <div className="text-[12px] max-w-[240px] text-text-secondary">
                Click a plant on the map to inspect it, edit its routes, or send trucks elsewhere.
            </div>
        </div>
    )
}

/** Selected-plant overview: stats, missing-operator editor, route list. */
export function PlanFlowPlantOverview({
    accentColor,
    calcClockIn,
    canEdit,
    getTravelTime,
    inbound,
    missingOperators = 0,
    mixerCountsByPlant,
    onAddRoute,
    onDeleteRoute,
    onEditRoute,
    onMissingOperatorsChange,
    outbound,
    production,
    selected,
    yphByCode,
    yphColorFor
}) {
    const yph = yphByCode[selected.code]
    const baseCount = mixerCountsByPlant[selected.code] || 0
    const hasMissing = missingOperators > 0
    const remaining = Math.max(0, baseCount - missingOperators)
    return (
        <div className="px-4 py-4 flex flex-col gap-4">
            <PlantHeader
                accentColor={accentColor}
                baseCount={baseCount}
                missingOperators={missingOperators}
                selected={selected}
            />

            <StatRow>
                <StatCell label="Eff ops" value={selected.eff} />
                <StatCell label="Yardage" value={production.totalYardage || '—'} />
                <StatCell
                    label="YPH"
                    value={yph ?? '—'}
                    valueColor={yph != null ? yphColorFor(yph, accentColor) : undefined}
                    isLast
                />
            </StatRow>

            {canEdit && onMissingOperatorsChange && (
                <MissingOperatorsEditor
                    baseCount={baseCount}
                    hasMissing={hasMissing}
                    missingOperators={missingOperators}
                    onChange={onMissingOperatorsChange}
                    remaining={remaining}
                />
            )}

            {canEdit && (
                <button
                    onClick={onAddRoute}
                    className="border-none rounded-lg cursor-pointer text-sm font-semibold text-white flex items-center justify-center gap-2 py-2"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-truck text-[12px]" />
                    Send trucks from {selected.code}
                </button>
            )}

            <RouteSection
                accentColor={accentColor}
                calcClockIn={calcClockIn}
                canEdit={canEdit}
                emptyHint={`No outbound routes from ${selected.code}`}
                getTravelTime={getTravelTime}
                items={outbound}
                keyPrefix="out"
                onDelete={onDeleteRoute}
                onEdit={onEditRoute}
                title="Outbound"
            />

            <RouteSection
                accentColor={accentColor}
                calcClockIn={calcClockIn}
                canEdit={canEdit}
                emptyHint={`No inbound routes to ${selected.code}`}
                getTravelTime={getTravelTime}
                items={inbound}
                keyPrefix="in"
                onDelete={onDeleteRoute}
                onEdit={onEditRoute}
                title="Inbound"
            />
        </div>
    )
}

function PlantHeader({ accentColor, baseCount, missingOperators, selected }) {
    const hasMissing = missingOperators > 0
    return (
        <div className="flex items-center gap-3">
            <div
                className="flex items-center justify-center rounded-lg text-white font-semibold h-10 w-10 shrink-0"
                style={{ background: accentColor, fontSize: 14 }}
            >
                {selected.code}
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] leading-tight text-text-primary">Plant {selected.code}</div>
                <div className="text-[11.5px] mt-0.5 text-text-secondary flex flex-wrap items-center gap-x-2">
                    <span>
                        <span className="font-mono tabular-nums font-semibold text-text-primary">{baseCount}</span> base
                    </span>
                    {hasMissing && <SubtleDelta color="#dc2626" value={`-${missingOperators}`} label="missing" />}
                    {selected.send > 0 && <SubtleDelta color="#dc2626" value={`-${selected.send}`} label="sent" />}
                    {selected.recv > 0 && <SubtleDelta color="#16a34a" value={`+${selected.recv}`} label="recv" />}
                </div>
            </div>
        </div>
    )
}

function SubtleDelta({ color, label, value }) {
    return (
        <span className="inline-flex items-baseline gap-1">
            <span className="font-mono tabular-nums font-semibold" style={{ color }}>
                {value}
            </span>
            <span>{label}</span>
        </span>
    )
}

function StatRow({ children }) {
    return <div className="grid grid-cols-3 rounded-lg overflow-hidden border border-border-light">{children}</div>
}

function StatCell({ isLast = false, label, value, valueColor }) {
    return (
        <div
            className={`px-3 py-2 flex flex-col gap-0.5 bg-bg-primary ${isLast ? '' : 'border-r border-border-light'}`}
        >
            <span className="text-[10.5px] text-text-secondary">{label}</span>
            <span
                className="text-[16px] font-semibold leading-tight font-mono tabular-nums truncate"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
            </span>
        </div>
    )
}

function MissingOperatorsEditor({ baseCount, hasMissing, missingOperators, onChange, remaining }) {
    const max = baseCount > 0 ? baseCount : 50
    const [inputValue, setInputValue] = useState(String(missingOperators))
    useEffect(() => {
        setInputValue(String(missingOperators))
    }, [missingOperators])
    const commit = (raw) => {
        const digits = String(raw).replace(/\D/g, '')
        setInputValue(digits)
        if (digits === '') return
        const parsed = Math.max(0, Math.min(max, parseInt(digits, 10) || 0))
        onChange(parsed)
    }
    const handleBlur = () => {
        if (inputValue === '' || !Number.isFinite(parseInt(inputValue, 10))) {
            setInputValue('0')
            onChange(0)
        }
    }
    return (
        <div className="rounded-lg p-3 bg-bg-primary border border-border-light">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <i
                        className="fas fa-user-slash text-[12px] shrink-0"
                        style={{ color: hasMissing ? '#dc2626' : 'var(--text-tertiary)' }}
                    />
                    <SectionLabel>Missing operators</SectionLabel>
                </div>
                {hasMissing && (
                    <button
                        type="button"
                        onClick={() => onChange(0)}
                        className="bg-transparent border-none cursor-pointer text-[11px] font-semibold text-text-secondary hover:text-text-primary"
                        title="Clear — everyone is in"
                    >
                        Reset
                    </button>
                )}
            </div>
            <CountStepperInput
                ariaLabel="Missing operators"
                max={max}
                min={0}
                onBlur={handleBlur}
                onChange={commit}
                value={inputValue}
            />
            <div className="text-[11px] mt-2 text-text-secondary">
                {hasMissing
                    ? `Running on ${remaining} active mixer${remaining === 1 ? '' : 's'} today (${baseCount} − ${missingOperators}).`
                    : 'Note anyone out sick or on vacation.'}
            </div>
        </div>
    )
}

/**
 * Numeric stepper styled to match the site's flat input + table chrome.
 * Free-form typing via `type="text"` so the value can be cleared by
 * backspacing; the +/− buttons are flush-borderless and read as part of
 * the same field.
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

function SectionLabel({ children }) {
    return <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{children}</div>
}

function RouteSection({
    accentColor,
    calcClockIn,
    canEdit,
    emptyHint,
    getTravelTime,
    items,
    keyPrefix,
    onDelete,
    onEdit,
    title
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <SectionLabel>{title}</SectionLabel>
                <span className="text-[11px] font-mono tabular-nums text-text-tertiary">{items.length}</span>
            </div>
            {items.length === 0 ? (
                <div className="text-[12px] px-3 py-3 text-center rounded-lg bg-bg-primary border border-border-light text-text-tertiary">
                    {emptyHint}
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {items.map((assignment) => (
                        <RouteRow
                            key={`${keyPrefix}-${assignment.idx}`}
                            accentColor={accentColor}
                            assignment={assignment}
                            canEdit={canEdit}
                            clockIn={
                                assignment.time && calcClockIn
                                    ? calcClockIn(assignment.time, assignment.fromPlant, assignment.toPlant)
                                    : null
                            }
                            onDelete={() => onDelete(assignment.idx)}
                            onEdit={() => onEdit(assignment.idx)}
                            travel={getTravelTime?.(assignment.fromPlant, assignment.toPlant)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function RouteRow({ accentColor, assignment, canEdit, clockIn, onDelete, onEdit, travel }) {
    const ops = parseInt(assignment.driverCount, 10) || 0
    return (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2.5 bg-bg-primary border border-border-light">
            <div className="flex items-center gap-1 font-semibold text-[12px]" style={{ color: accentColor }}>
                <span>{assignment.fromPlant}</span>
                <i className="fas fa-arrow-right text-[9px] text-text-tertiary" />
                <span>{assignment.toPlant}</span>
            </div>
            <div className="flex-1 min-w-0 text-[11px] text-text-secondary truncate">
                <span className="font-mono tabular-nums font-semibold text-text-primary">{ops}</span> op
                {ops === 1 ? '' : 's'}
                {travel != null && <span className="text-text-tertiary"> · {travel}m</span>}
                {clockIn && <span className="text-text-tertiary"> · clock {clockIn}</span>}
            </div>
            <div className="text-[12px] font-mono tabular-nums font-semibold text-text-primary shrink-0">
                {assignment.time || '—'}
            </div>
            {canEdit && (
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={onEdit}
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer text-text-secondary"
                        title="Edit"
                    >
                        <i className="fas fa-pen text-[10px]" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer text-red-600"
                        title="Delete"
                    >
                        <i className="fas fa-trash text-[10px]" />
                    </button>
                </div>
            )}
        </div>
    )
}
