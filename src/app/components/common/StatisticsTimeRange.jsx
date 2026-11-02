/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { formatPeriodLabel, shiftAnchor } from '../../../utils/PlanStatisticsUtility'
import { getTodayDate } from '../../../utils/PlanUtility'
import { STATISTICS_PERIODS } from '../../hooks/useStatisticsPeriod'

/** Period row — joined buttons; the chosen period is pressed in (darker
 *  fill, darker text), the same as every other switcher in the app. */
function PeriodSelector({ period, setPeriod }) {
    return (
        <div
            role="group"
            aria-label="Statistics time period"
            className="inline-flex h-9 items-stretch overflow-hidden rounded-[4px] border border-border-medium bg-bg-primary"
        >
            {STATISTICS_PERIODS.map(({ id, label }) => {
                const isActive = period === id
                return (
                    <button
                        type="button"
                        key={id}
                        onClick={() => setPeriod(id)}
                        aria-pressed={isActive}
                        className={`border-0 border-r border-solid border-border-light px-3 text-[13px] cursor-pointer transition-colors duration-150 last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${
                            isActive
                                ? 'bg-bg-tertiary font-medium text-text-primary'
                                : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }`}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}

/** Calendar nav arrows + label + Today shortcut, or a date-range picker
 *  when the period is Custom. Hidden entirely for `allTime`. */
function PeriodNavigator({ anchor, customEnd, customStart, period, range, setAnchor, setCustomEnd, setCustomStart }) {
    if (period === 'allTime') return null
    if (period === 'custom') {
        const dateInputClass =
            'h-9 rounded-[4px] px-2 text-[13px] bg-bg-primary border border-border-medium text-text-primary ' +
            'transition-colors duration-150 ' +
            'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ' +
            '[color-scheme:light] dark:[color-scheme:dark]'
        return (
            <div className="flex items-center gap-1.5 text-xs">
                <input
                    type="date"
                    aria-label="Custom range start"
                    value={customStart}
                    max={customEnd}
                    onChange={(event) => setCustomStart(event.target.value)}
                    className={dateInputClass}
                />
                <span className="text-text-secondary">to</span>
                <input
                    type="date"
                    aria-label="Custom range end"
                    value={customEnd}
                    min={customStart}
                    onChange={(event) => setCustomEnd(event.target.value)}
                    className={dateInputClass}
                />
            </div>
        )
    }
    const periodLabel = formatPeriodLabel(period, range)
    return (
        <div className="inline-flex h-9 items-center rounded-[4px] border border-border-medium bg-bg-primary">
            <button
                type="button"
                onClick={() => setAnchor(shiftAnchor(anchor, period, -1))}
                aria-label="Previous period"
                title="Previous period"
                className="h-full w-8 border-0 bg-transparent cursor-pointer text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none"
            >
                <i className="fas fa-chevron-left text-[11px]" aria-hidden="true" />
            </button>
            <span className="min-w-[120px] px-1 text-center text-[13px] font-medium text-text-primary tabular-nums">
                {periodLabel}
            </span>
            <button
                type="button"
                onClick={() => setAnchor(shiftAnchor(anchor, period, 1))}
                aria-label="Next period"
                title="Next period"
                className="h-full w-8 border-0 bg-transparent cursor-pointer text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none"
            >
                <i className="fas fa-chevron-right text-[11px]" aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => setAnchor(getTodayDate())}
                className="h-full border-0 border-l border-solid border-border-light bg-transparent cursor-pointer px-3 text-[13px] text-text-primary transition-colors duration-150 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none"
            >
                Today
            </button>
        </div>
    )
}

/**
 * Period selector + period navigator pair shared across every inventory
 * statistics surface (asset + person). Stateless; expects the caller to
 * own period state via `useStatisticsPeriod`.
 */
export function StatisticsTimeRange({
    accentColor,
    anchor,
    customEnd,
    customStart,
    period,
    range,
    setAnchor,
    setCustomEnd,
    setCustomStart,
    setPeriod
}) {
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
        </div>
    )
}

export default StatisticsTimeRange
