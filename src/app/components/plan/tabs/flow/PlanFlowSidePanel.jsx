/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

/** Empty-state shown when no plant is selected. Matches the flat
 *  `bg-bg-primary` aesthetic the rest of the planner uses — no rounded
 *  badges or accent fills. */
export function PlanFlowEmptyPanel({ accentColor }) {
    return (
        <div className="flex flex-col items-center justify-center text-center px-6 py-10 flex-1">
            <i className="fas fa-arrow-pointer text-[26px] mb-3" style={{ color: 'var(--text-primary)' }} />
            <div className="text-[14px] font-semibold mb-1 text-text-primary">Pick a plant</div>
            <div className="text-[12px] max-w-[240px] text-text-secondary">
                Click a plant on the map to inspect it, edit its routes, or send trucks elsewhere.
            </div>
        </div>
    )
}

/** Selected-plant overview: stats, missing-operator (or Saturday
 *  override) editor, route list. On Saturdays the half-fleet rule
 *  applies, so the side panel swaps the "missing operators" editor for
 *  a "Saturday operator count" field — the dispatcher sets the actual
 *  count for the day directly rather than subtracting from the full
 *  roster (which would be the wrong baseline on a half-crew day). */
export function PlanFlowPlantOverview({
    accentColor,
    calcClockIn,
    canEdit,
    getTravelTime,
    inbound,
    isSaturday = false,
    missingOperators = 0,
    mixerCountsByPlant,
    onAddRoute,
    onDeleteRoute,
    onEditRoute,
    onMissingOperatorsChange,
    onSaturdayOverrideChange,
    outbound,
    production,
    saturdayOverride = null,
    selected,
    yphByCode,
    yphColorFor
}) {
    const yph = yphByCode[selected.code]
    const rosterCount = mixerCountsByPlant[selected.code] || 0
    const halfFleetDefault = Math.floor(rosterCount / 2)
    const hasMissing = missingOperators > 0
    const remaining = Math.max(0, rosterCount - missingOperators)
    return (
        <div className="px-4 py-4 flex flex-col gap-4">
            <PlantHeader
                accentColor={accentColor}
                halfFleetDefault={halfFleetDefault}
                isSaturday={isSaturday}
                missingOperators={missingOperators}
                rosterCount={rosterCount}
                saturdayOverride={saturdayOverride}
                selected={selected}
            />

            <StatRow>
                <StatCell label="Eff ops" value={selected.eff} />
                <StatCell label="Yardage" value={production.totalYardage || '—'} />
                <StatCell label="YPH" value={yph ?? '—'} isLast />
            </StatRow>

            {canEdit && isSaturday && onSaturdayOverrideChange ? (
                <SaturdayOverrideEditor
                    halfFleetDefault={halfFleetDefault}
                    onChange={onSaturdayOverrideChange}
                    override={saturdayOverride}
                    rosterCount={rosterCount}
                />
            ) : (
                canEdit &&
                onMissingOperatorsChange && (
                    <MissingOperatorsEditor
                        baseCount={rosterCount}
                        hasMissing={hasMissing}
                        missingOperators={missingOperators}
                        onChange={onMissingOperatorsChange}
                        remaining={remaining}
                    />
                )
            )}

            {canEdit && (
                <button
                    onClick={onAddRoute}
                    className="border-none rounded-lg cursor-pointer text-sm font-semibold text-white flex items-center justify-center gap-2 py-2 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
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

function PlantHeader({
    accentColor,
    halfFleetDefault,
    isSaturday,
    missingOperators,
    rosterCount,
    saturdayOverride,
    selected
}) {
    const hasMissing = !isSaturday && missingOperators > 0
    const hasSaturdayOverride = isSaturday && saturdayOverride != null
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
                        <span className="font-mono tabular-nums font-semibold text-text-primary">{rosterCount}</span>{' '}
                        roster
                    </span>
                    {isSaturday && (
                        <span className="inline-flex items-baseline gap-1">
                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                {hasSaturdayOverride ? saturdayOverride : halfFleetDefault}
                            </span>
                            <span>{hasSaturdayOverride ? 'Sat override' : 'Sat default'}</span>
                        </span>
                    )}
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

function StatCell({ isLast = false, label, value }) {
    return (
        <div
            className={`px-3 py-2 flex flex-col gap-0.5 bg-bg-primary ${isLast ? '' : 'border-r border-border-light'}`}
        >
            <span className="text-[10.5px] text-text-secondary">{label}</span>
            <span className="text-[16px] font-semibold leading-tight font-mono tabular-nums truncate text-text-primary">
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
                        style={{ color: hasMissing ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                    />
                    <SectionLabel>Missing operators</SectionLabel>
                </div>
                {hasMissing && (
                    <button
                        type="button"
                        onClick={() => onChange(0)}
                        className="bg-transparent border-none cursor-pointer text-[11px] font-semibold text-text-secondary hover:text-text-primary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
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
 * Saturday operator-count override editor. Replaces the missing-operators
 * editor on Saturdays — the half-crew rule is a default, not a fact, so
 * the dispatcher needs to pin the real number for the day. When set,
 * the override IS the working count (no separate missing subtraction);
 * clearing it falls back to floor(roster / 2).
 */
function SaturdayOverrideEditor({ halfFleetDefault, onChange, override, rosterCount }) {
    const max = rosterCount > 0 ? rosterCount : 50
    const hasOverride = override != null
    const displaySeed = hasOverride ? String(override) : ''
    const [inputValue, setInputValue] = useState(displaySeed)
    useEffect(() => {
        setInputValue(hasOverride ? String(override) : '')
    }, [override, hasOverride])
    const commit = (raw) => {
        const digits = String(raw).replace(/\D/g, '')
        setInputValue(digits)
        if (digits === '') {
            onChange(null)
            return
        }
        const parsed = Math.max(0, Math.min(max, parseInt(digits, 10) || 0))
        onChange(parsed)
    }
    const handleBlur = () => {
        if (inputValue === '') onChange(null)
    }
    const resolved = hasOverride ? override : halfFleetDefault
    return (
        <div className="rounded-lg p-3 bg-bg-primary border border-border-light">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <i
                        className="fas fa-calendar-day text-[12px] shrink-0"
                        style={{ color: hasOverride ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                    />
                    <SectionLabel>Saturday operator count</SectionLabel>
                </div>
                {hasOverride && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="bg-transparent border-none cursor-pointer text-[11px] font-semibold text-text-secondary hover:text-text-primary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        title="Clear — fall back to half-fleet default"
                    >
                        Reset
                    </button>
                )}
            </div>
            <CountStepperInput
                ariaLabel="Saturday operator count"
                max={max}
                min={0}
                onBlur={handleBlur}
                onChange={commit}
                placeholder={String(halfFleetDefault)}
                value={inputValue}
            />
            <div className="text-[11px] mt-2 text-text-secondary">
                {hasOverride
                    ? `Running ${resolved} active mixer${resolved === 1 ? '' : 's'} today (override of the ${halfFleetDefault}-mixer half-fleet default from a ${rosterCount}-mixer roster).`
                    : `Default: ${halfFleetDefault} mixer${halfFleetDefault === 1 ? '' : 's'} (half the ${rosterCount}-mixer roster). Type the actual count to override.`}
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
function CountStepperInput({ ariaLabel, max, min = 0, onBlur, onChange, placeholder = '', value }) {
    const numericValue = parseInt(value, 10)
    const safeNumeric = Number.isFinite(numericValue) ? numericValue : 0
    const atMax = max != null && safeNumeric >= max
    const atMin = safeNumeric <= min
    const decrement = () => onChange(String(Math.max(min, safeNumeric - 1)))
    const increment = () => onChange(String(Math.min(max ?? safeNumeric + 1, safeNumeric + 1)))
    return (
        <div className="flex items-stretch rounded-lg overflow-hidden border bg-bg-primary border-border-medium transition-colors duration-150 hover:border-border-dark focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]">
            <button
                type="button"
                onClick={decrement}
                disabled={atMin}
                aria-label="Decrease"
                className="px-3 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary border-r border-border-light active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
            >
                −
            </button>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onFocus={(event) => event.target.select()}
                aria-label={ariaLabel}
                className="flex-1 px-3 py-1.5 text-sm font-mono tabular-nums text-center bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary"
            />
            <button
                type="button"
                onClick={increment}
                disabled={atMax}
                aria-label="Increase"
                className="px-3 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary border-l border-border-light active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
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
            <div className="flex items-center gap-1 font-semibold text-[12px]" style={{ color: 'var(--text-primary)' }}>
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
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer text-text-secondary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        title="Edit"
                        aria-label="Edit"
                    >
                        <i className="fas fa-pen text-[10px]" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer text-text-primary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        title="Delete"
                        aria-label="Delete"
                    >
                        <i className="fas fa-trash text-[10px]" />
                    </button>
                </div>
            )}
        </div>
    )
}
