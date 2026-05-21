/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import {
    formatPeriodLabel,
    PLAN_STATS_COMPARISONS,
    PLAN_STATS_PERIODS,
    shiftAnchor
} from '../../../../../utils/PlanStatisticsUtility'
import { getTodayDate } from '../../../../../utils/PlanUtility'

/** Period selector buttons (Day/Week/Month/Quarter/Year/Custom). */
function PeriodSelector({ accentColor, period, setPeriod }) {
    return (
        <div className="flex items-center rounded-lg p-0.5 bg-bg-tertiary border border-border-light">
            {PLAN_STATS_PERIODS.map(({ id, label }) => (
                <button
                    key={id}
                    onClick={() => setPeriod(id)}
                    className="rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5"
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
                    className="rounded px-2 py-1 text-xs bg-bg-primary border border-border-light text-text-primary"
                />
                <span className="text-text-secondary">to</span>
                <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded px-2 py-1 text-xs bg-bg-primary border border-border-light text-text-primary"
                />
            </div>
        )
    }
    const periodLabel = formatPeriodLabel(period, range)
    return (
        <div className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1 py-0.5 bg-bg-tertiary border border-border-light">
            <button
                onClick={() => setAnchor(shiftAnchor(anchor, period, -1))}
                className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary"
                title="Previous period"
            >
                <i className="fas fa-chevron-left text-xs" />
            </button>
            <span className="px-2 text-xs font-semibold text-text-primary">{periodLabel}</span>
            <button
                onClick={() => setAnchor(shiftAnchor(anchor, period, 1))}
                className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary"
                title="Next period"
            >
                <i className="fas fa-chevron-right text-xs" />
            </button>
            <button
                onClick={() => setAnchor(getTodayDate())}
                className="border-none bg-transparent cursor-pointer px-2 py-1 rounded text-xs font-semibold"
                style={{ color: accentColor }}
            >
                Today
            </button>
        </div>
    )
}

/** Plant-filter dropdown — scopes every metric to a single plant or all. */
function PlantFilterMenu({ accentColor, availablePlants, plantNameByCode, selectedPlant, setSelectedPlant }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="relative ml-auto">
            <button
                onClick={() => setOpen((s) => !s)}
                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                style={{
                    backgroundColor: selectedPlant ? `${accentColor}20` : 'var(--bg-tertiary)',
                    color: selectedPlant ? accentColor : 'var(--text-secondary)'
                }}
                title="Filter every chart and table to a single plant"
            >
                <i className="fas fa-industry text-[11px]" />
                <span>
                    {selectedPlant
                        ? `Plant · ${plantNameByCode?.[selectedPlant] ? `${selectedPlant}` : selectedPlant}`
                        : 'All plants'}
                </span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px]`} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-lg z-10 min-w-[220px] max-h-[320px] overflow-y-auto bg-bg-primary border border-border-light">
                    <button
                        onClick={() => {
                            setSelectedPlant(null)
                            setOpen(false)
                        }}
                        className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between"
                        style={{
                            backgroundColor: !selectedPlant ? `${accentColor}15` : 'transparent',
                            color: !selectedPlant ? accentColor : 'var(--text-primary)'
                        }}
                    >
                        <span>All plants</span>
                        {!selectedPlant && <i className="fas fa-check text-[10px]" />}
                    </button>
                    {availablePlants.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-text-tertiary">No plants in this range</div>
                    ) : (
                        availablePlants.map(({ code, label }) => (
                            <button
                                key={code}
                                onClick={() => {
                                    setSelectedPlant(code)
                                    setOpen(false)
                                }}
                                className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between"
                                style={{
                                    backgroundColor: selectedPlant === code ? `${accentColor}15` : 'transparent',
                                    color: selectedPlant === code ? accentColor : 'var(--text-primary)'
                                }}
                            >
                                <span className="truncate">{label}</span>
                                {selectedPlant === code && <i className="fas fa-check text-[10px]" />}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

/** Compare-window dropdown — Off / Previous / Last year. */
function ComparisonMenu({ accentColor, comparison, setComparison }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="relative">
            <button
                onClick={() => setOpen((s) => !s)}
                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                style={{
                    backgroundColor: comparison !== 'none' ? `${accentColor}20` : 'var(--bg-tertiary)',
                    color: comparison !== 'none' ? accentColor : 'var(--text-secondary)'
                }}
                title="Compare against another period"
            >
                <i className="fas fa-code-compare text-[11px]" />
                <span>
                    {comparison === 'none'
                        ? 'Compare'
                        : `Compare · ${PLAN_STATS_COMPARISONS.find((c) => c.id === comparison)?.label}`}
                </span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px]`} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-lg z-10 min-w-[160px] bg-bg-primary border border-border-light">
                    {PLAN_STATS_COMPARISONS.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => {
                                setComparison(id)
                                setOpen(false)
                            }}
                            className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between"
                            style={{
                                backgroundColor: comparison === id ? `${accentColor}15` : 'transparent',
                                color: comparison === id ? accentColor : 'var(--text-primary)'
                            }}
                        >
                            <span>{label}</span>
                            {comparison === id && <i className="fas fa-check text-[10px]" />}
                        </button>
                    ))}
                </div>
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
        <div className="flex flex-wrap items-center gap-2">
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
