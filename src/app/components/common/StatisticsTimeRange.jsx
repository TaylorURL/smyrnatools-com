/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { formatPeriodLabel, shiftAnchor } from '../../../utils/PlanStatisticsUtility'
import { getTodayDate } from '../../../utils/PlanUtility'
import { STATISTICS_PERIODS } from '../../hooks/useStatisticsPeriod'

/** Period pill row — same chrome as the Operations statistics surface so
 *  the two pages feel like one product. The `All-time` chip lives at the
 *  front and acts as a clean "no time filter" default for inventory-style
 *  data (rosters, fleet snapshots) that aren't natively time-series. */
function PeriodSelector({ accentColor, period, setPeriod }) {
    return (
        <div className="flex items-center rounded-lg p-0.5 bg-bg-tertiary border border-border-light">
            {STATISTICS_PERIODS.map(({ id, label }) => (
                <button
                    key={id}
                    onClick={() => setPeriod(id)}
                    className="rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
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

/** Calendar nav arrows + label + Today shortcut, or a date-range picker
 *  when the period is Custom. Hidden entirely for `allTime` since there's
 *  nothing to navigate. */
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
    if (period === 'allTime') return null
    if (period === 'custom') {
        const dateInputClass =
            'rounded px-2 py-1 text-xs bg-bg-primary border border-border-light text-text-primary ' +
            'transition-colors duration-150 hover:border-border-medium ' +
            'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ' +
            '[color-scheme:light] dark:[color-scheme:dark]'
        return (
            <div className="flex items-center gap-1.5 text-xs">
                <input
                    type="date"
                    aria-label="Custom range start"
                    value={customStart}
                    max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className={dateInputClass}
                />
                <span className="text-text-secondary">to</span>
                <input
                    type="date"
                    aria-label="Custom range end"
                    value={customEnd}
                    min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className={dateInputClass}
                />
            </div>
        )
    }
    const periodLabel = formatPeriodLabel(period, range)
    return (
        <div className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1 py-0.5 bg-bg-tertiary border border-border-light">
            <button
                onClick={() => setAnchor(shiftAnchor(anchor, period, -1))}
                className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none"
                title="Previous period"
            >
                <i className="fas fa-chevron-left text-xs" />
            </button>
            <span className="px-2 text-xs font-semibold text-text-primary">{periodLabel}</span>
            <button
                onClick={() => setAnchor(shiftAnchor(anchor, period, 1))}
                className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none"
                title="Next period"
            >
                <i className="fas fa-chevron-right text-xs" />
            </button>
            <button
                onClick={() => setAnchor(getTodayDate())}
                className="border-none bg-transparent cursor-pointer px-2 py-1 rounded text-xs font-semibold active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                style={{ color: accentColor }}
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
 *
 * For inventory pages (which aren't natively time-series), `All-time` is
 * the only sensible default — the date-bounded periods let the user scope
 * to "activity in this window" (filtered by updatedAt or createdAt
 * depending on what the consumer wires up).
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
