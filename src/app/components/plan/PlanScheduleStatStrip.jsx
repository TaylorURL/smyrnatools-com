/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SatisfactionBadge, YardageDeltaBadge } from './PlanScheduleBadges'
import PlanScheduleStat from './PlanScheduleStat'

/** Headline strip rendered above the schedule. Reads like a newspaper
 *  masthead — small label, big number, optional inline badge / hint. */
export default function PlanScheduleStatStrip({
    allOrdersCount,
    customerSatisfaction,
    earliestTime,
    filteredCount,
    hasActiveFilters,
    latestTime,
    liveOrdersCount,
    previousBusinessDayLabel,
    previousBusinessDayYardage,
    totalTrucks,
    totalYards,
    uniqueCustomers,
    uniquePlants,
    weekYardage,
    yardageDeltaPct
}) {
    return (
        <div
            className="rounded-xl flex flex-wrap bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <PlanScheduleStat
                first
                hint={
                    hasActiveFilters && filteredCount !== allOrdersCount
                        ? `of ${allOrdersCount.toLocaleString()}`
                        : 'on the day · cancelled excluded'
                }
                label="Orders"
                value={liveOrdersCount.toLocaleString()}
            />
            <PlanScheduleStat
                hint={`${uniqueCustomers.toLocaleString()} customer${uniqueCustomers === 1 ? '' : 's'}`}
                label="Plants"
                value={uniquePlants.toLocaleString()}
            />
            <PlanScheduleStat
                badge={
                    yardageDeltaPct != null ? (
                        <YardageDeltaBadge
                            comparisonLabel={previousBusinessDayLabel}
                            comparisonYardage={previousBusinessDayYardage}
                            pct={yardageDeltaPct}
                        />
                    ) : null
                }
                hint={
                    yardageDeltaPct != null
                        ? `vs ${previousBusinessDayYardage.toLocaleString()} yd ${previousBusinessDayLabel}`
                        : 'cancelled excluded'
                }
                label="Yardage"
                unit="yd"
                value={totalYards.toLocaleString()}
            />
            <PlanScheduleStat hint="this week (Mon–Sat)" label="Week" unit="yd" value={weekYardage.toLocaleString()} />
            <PlanScheduleStat hint="truck loads" label="Loads" value={totalTrucks.toLocaleString()} />
            <PlanScheduleStat
                hint={earliestTime && latestTime ? 'first → last start' : undefined}
                label="Window"
                value={earliestTime && latestTime ? `${earliestTime}–${latestTime}` : '—'}
            />
            {customerSatisfaction && customerSatisfaction.samples > 0 && (
                <PlanScheduleStat
                    badge={
                        <span className="inline-flex items-center gap-1.5">
                            {customerSatisfaction.isLive && (
                                <span
                                    className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-[rgba(220,_38,_38,_0.12)] text-red-600"
                                    title="Live — score updates as orders complete throughout the day"
                                >
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" />
                                    LIVE
                                </span>
                            )}
                            <SatisfactionBadge score={customerSatisfaction.score} />
                        </span>
                    }
                    hint={(() => {
                        // Sentence-case hints to match every other stat in the
                        // strip ("this week (Mon–Sat)", "truck loads",
                        // "cancelled excluded", …). The label above the value
                        // is the only place that displays uppercase, and it
                        // does so via CSS `text-transform: uppercase`, not
                        // by hardcoding caps in the source string.
                        const parts = [
                            `${customerSatisfaction.goodService} good service`,
                            `${customerSatisfaction.badService} bad service`
                        ]
                        if (customerSatisfaction.isLive && customerSatisfaction.inProgress > 0) {
                            parts.push(`${customerSatisfaction.inProgress} in progress`)
                        }
                        return parts.join(' · ')
                    })()}
                    label={customerSatisfaction.isLive ? 'Customer satisfaction · so far' : 'Customer satisfaction'}
                    value={`${Math.round(customerSatisfaction.score * 100)}%`}
                />
            )}
        </div>
    )
}
