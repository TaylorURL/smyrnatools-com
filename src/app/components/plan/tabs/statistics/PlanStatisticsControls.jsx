/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
    formatPeriodLabel,
    PLAN_STATS_COMPARISONS,
    PLAN_STATS_PERIODS,
    shiftAnchor
} from '../../../../../utils/PlanStatisticsUtility'
import { getTodayDate } from '../../../../../utils/PlanUtility'
import useFixedDropdownPosition from '../../../../hooks/useFixedDropdownPosition'

/** Closes the menu when the user clicks outside both the trigger and the
 *  portaled menu. Needed because the menu lives outside the React tree's
 *  natural click bubbling for "click anywhere to dismiss" intuition. */
function useClickOutsideToClose(open, setOpen, triggerRef, menuRef) {
    useEffect(() => {
        if (!open) return undefined
        const handler = (e) => {
            const t = e.target
            if (triggerRef.current?.contains(t)) return
            if (menuRef.current?.contains(t)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open, setOpen, triggerRef, menuRef])
}

/** Period selector buttons (Day/Week/Month/Quarter/Year/Custom). */
function PeriodSelector({ accentColor, period, setPeriod }) {
    return (
        <div
            role="group"
            aria-label="Time period"
            className="flex items-center rounded-lg p-0.5 bg-bg-tertiary border border-border-light"
        >
            {PLAN_STATS_PERIODS.map(({ id, label }) => (
                <button
                    key={id}
                    onClick={() => setPeriod(id)}
                    aria-pressed={period === id}
                    className="rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                    style={{
                        backgroundColor: period === id ? accentColor : 'transparent',
                        color: period === id ? '#fff' : 'var(--text-secondary)'
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}

/** Calendar nav arrows + period label + Today shortcut, or a date-range
 *  picker when the period is Custom. */
function PeriodNavigator({
    accentColor,
    anchor,
    customEnd,
    customStart,
    period,
    range,
    setAnchor,
    setCustomEnd,
    setCustomStart
}) {
    if (period === 'custom') {
        return (
            <div className="flex items-center gap-1.5 text-xs">
                <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    aria-label="Custom range start"
                    className="rounded px-2 py-1 text-xs bg-bg-primary border border-border-light text-text-primary outline-none transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] [color-scheme:light] dark:[color-scheme:dark]"
                />
                <span className="text-text-secondary">to</span>
                <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    aria-label="Custom range end"
                    className="rounded px-2 py-1 text-xs bg-bg-primary border border-border-light text-text-primary outline-none transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] [color-scheme:light] dark:[color-scheme:dark]"
                />
            </div>
        )
    }
    const periodLabel = formatPeriodLabel(period, range)
    return (
        <div className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1 py-0.5 bg-bg-tertiary border border-border-light">
            <button
                onClick={() => setAnchor(shiftAnchor(anchor, period, -1))}
                className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 active:scale-[0.92] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                title="Previous period"
                aria-label="Previous period"
            >
                <i className="fas fa-chevron-left text-xs" />
            </button>
            <span className="px-2 text-xs font-semibold text-text-primary">{periodLabel}</span>
            <button
                onClick={() => setAnchor(shiftAnchor(anchor, period, 1))}
                className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 active:scale-[0.92] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                title="Next period"
                aria-label="Next period"
            >
                <i className="fas fa-chevron-right text-xs" />
            </button>
            <button
                onClick={() => setAnchor(getTodayDate())}
                className="border-none bg-transparent cursor-pointer px-2 py-1 rounded text-xs font-semibold active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                style={{ color: 'var(--text-primary)' }}
            >
                Today
            </button>
        </div>
    )
}

/** Plant-filter dropdown — scopes every metric to a single plant or all. */
function PlantFilterMenu({ accentColor, availablePlants, plantNameByCode, selectedPlant, setSelectedPlant }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef(null)
    const menuRef = useRef(null)
    const pos = useFixedDropdownPosition(triggerRef, open, 'right')
    useClickOutsideToClose(open, setOpen, triggerRef, menuRef)
    return (
        <div className="relative ml-auto shrink-0">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((s) => !s)}
                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                style={{
                    backgroundColor: selectedPlant ? `${accentColor}20` : 'var(--bg-tertiary)',
                    color: selectedPlant ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
                title="Filter every chart and table to a single plant"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Filter every chart and table to a single plant"
            >
                <i className="fas fa-industry text-[11px]" aria-hidden="true" />
                <span>
                    {selectedPlant
                        ? `Plant · ${plantNameByCode?.[selectedPlant] ? `${selectedPlant}` : selectedPlant}`
                        : 'All plants'}
                </span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px]`} aria-hidden="true" />
            </button>
            {open &&
                pos &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        className="fixed rounded-lg overflow-hidden shadow-lg z-50 min-w-[220px] max-h-[320px] overflow-y-auto bg-bg-primary border border-border-light origin-top-right animate-[fadeSlideIn_180ms_ease-out_both] motion-reduce:animate-none"
                        style={{ right: pos.right, top: pos.top }}
                    >
                        <button
                            type="button"
                            role="option"
                            aria-selected={!selectedPlant}
                            onClick={() => {
                                setSelectedPlant(null)
                                setOpen(false)
                            }}
                            className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover focus-visible:outline-none focus-visible:bg-bg-hover"
                            style={{
                                backgroundColor: !selectedPlant ? `${accentColor}15` : 'transparent',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <span>All plants</span>
                            {!selectedPlant && <i className="fas fa-check text-[10px]" aria-hidden="true" />}
                        </button>
                        {availablePlants.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-text-tertiary">No plants in this range</div>
                        ) : (
                            availablePlants.map(({ code, label }) => (
                                <button
                                    key={code}
                                    type="button"
                                    role="option"
                                    aria-selected={selectedPlant === code}
                                    onClick={() => {
                                        setSelectedPlant(code)
                                        setOpen(false)
                                    }}
                                    className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover focus-visible:outline-none focus-visible:bg-bg-hover"
                                    style={{
                                        backgroundColor: selectedPlant === code ? `${accentColor}15` : 'transparent',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <span className="truncate">{label}</span>
                                    {selectedPlant === code && (
                                        <i className="fas fa-check text-[10px]" aria-hidden="true" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>,
                    document.body
                )}
        </div>
    )
}

/** Compare-window dropdown — Off / Previous / Last year. */
function ComparisonMenu({ accentColor, comparison, setComparison }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef(null)
    const menuRef = useRef(null)
    const pos = useFixedDropdownPosition(triggerRef, open, 'right')
    useClickOutsideToClose(open, setOpen, triggerRef, menuRef)
    return (
        <div className="relative shrink-0">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((s) => !s)}
                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                style={{
                    backgroundColor: comparison !== 'none' ? `${accentColor}20` : 'var(--bg-tertiary)',
                    color: comparison !== 'none' ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
                title="Compare against another period"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Compare against another period"
            >
                <i className="fas fa-code-compare text-[11px]" aria-hidden="true" />
                <span>
                    {comparison === 'none'
                        ? 'Compare'
                        : `Compare · ${PLAN_STATS_COMPARISONS.find((c) => c.id === comparison)?.label}`}
                </span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px]`} aria-hidden="true" />
            </button>
            {open &&
                pos &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        className="fixed rounded-lg overflow-hidden shadow-lg z-50 min-w-[160px] bg-bg-primary border border-border-light origin-top-right animate-[fadeSlideIn_180ms_ease-out_both] motion-reduce:animate-none"
                        style={{ right: pos.right, top: pos.top }}
                    >
                        {PLAN_STATS_COMPARISONS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                role="option"
                                aria-selected={comparison === id}
                                onClick={() => {
                                    setComparison(id)
                                    setOpen(false)
                                }}
                                className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover focus-visible:outline-none focus-visible:bg-bg-hover"
                                style={{
                                    backgroundColor: comparison === id ? `${accentColor}15` : 'transparent',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <span>{label}</span>
                                {comparison === id && <i className="fas fa-check text-[10px]" aria-hidden="true" />}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    )
}

/**
 * Statistics page top-bar controls — period + period nav + plant filter +
 * comparison. Stateless aside from per-menu open/close UI state; every
 * selector is lifted into `usePlanStatistics`.
 */
export function PlanStatisticsControls({
    accentColor,
    anchor,
    availablePlantCodes,
    comparison,
    customEnd,
    customStart,
    period,
    plantNameByCode,
    range,
    selectedPlant,
    setAnchor,
    setComparison,
    setCustomEnd,
    setCustomStart,
    setPeriod,
    setSelectedPlant
}) {
    const availablePlants = useMemo(
        () =>
            availablePlantCodes.map((code) => ({
                code,
                label: plantNameByCode?.[code] ? `${code} · ${plantNameByCode[code]}` : code
            })),
        [availablePlantCodes, plantNameByCode]
    )

    return (
        <div className="flex flex-nowrap items-center gap-2">
            <PeriodSelector accentColor={accentColor} period={period} setPeriod={setPeriod} />
            <PeriodNavigator
                accentColor={accentColor}
                anchor={anchor}
                customEnd={customEnd}
                customStart={customStart}
                period={period}
                range={range}
                setAnchor={setAnchor}
                setCustomEnd={setCustomEnd}
                setCustomStart={setCustomStart}
            />
            <PlantFilterMenu
                accentColor={accentColor}
                availablePlants={availablePlants}
                plantNameByCode={plantNameByCode}
                selectedPlant={selectedPlant}
                setSelectedPlant={setSelectedPlant}
            />
            <ComparisonMenu accentColor={accentColor} comparison={comparison} setComparison={setComparison} />
        </div>
    )
}

export default PlanStatisticsControls
