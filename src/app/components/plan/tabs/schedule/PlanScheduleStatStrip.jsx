/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../common/Badge'
import { SatisfactionBadge, YardageDeltaBadge } from './PlanScheduleBadges'
import PlanScheduleStat from './PlanScheduleStat'

/** Format a percent delta with leading sign, one decimal, and a `%` suffix.
 *  Returns `'0%'` for an exact match and `null` when the baseline is zero
 *  (a `%` against zero is meaningless — caller falls back to the raw
 *  count delta instead). */
const formatPctDelta = (live, base) => {
    if (!Number.isFinite(live) || !Number.isFinite(base)) return null
    if (base === 0) return null
    const pct = ((live - base) / base) * 100
    if (Math.abs(pct) < 0.05) return '0%'
    const sign = pct > 0 ? '+' : ''
    return `${sign}${pct.toFixed(1)}%`
}

const formatCountDelta = (live, base) => {
    if (!Number.isFinite(live) || !Number.isFinite(base)) return null
    const delta = live - base
    if (delta === 0) return '±0'
    const sign = delta > 0 ? '+' : ''
    return `${sign}${delta.toLocaleString()}`
}

const formatBaseValue = (base) => {
    if (!Number.isFinite(base)) return null
    return base.toLocaleString()
}

const deltaTone = (live, base) => {
    if (!Number.isFinite(live) || !Number.isFinite(base) || live === base) return 'neutral'
    return live > base ? 'up' : 'down'
}

const DELTA_TONE_TO_BADGE = {
    down: { icon: 'arrow-down', tone: 'danger' },
    neutral: { icon: 'equals', tone: 'neutral' },
    up: { icon: 'arrow-up', tone: 'success' }
}

/** Inline before/after pill shown next to a stat's value when the
 *  schedule is in compare mode. Falls back to the count delta when a
 *  percentage doesn't apply (zero baseline, e.g. a fresh plant with 0
 *  orders on the snapshot). */
function CompareDeltaBadge({ baseLabel, base, live, unit }) {
    if (!Number.isFinite(live) || !Number.isFinite(base)) return null
    const pct = formatPctDelta(live, base)
    const count = formatCountDelta(live, base)
    const tone = deltaTone(live, base)
    const display = pct ?? count
    const title = `Original ${baseLabel}: ${formatBaseValue(base) ?? '—'}${unit ? ` ${unit}` : ''}`
    const { icon, tone: badgeTone } = DELTA_TONE_TO_BADGE[tone]
    return (
        <Badge
            className="tabular-nums"
            icon={icon}
            shape="pill"
            size="sm"
            title={title}
            tone={badgeTone}
            uppercase={false}
        >
            {display}
        </Badge>
    )
}

const ALWAYS_HINT_BASE = (label, base, unit) =>
    Number.isFinite(base) ? `vs ${formatBaseValue(base)}${unit ? ` ${unit}` : ''} at 5:30 PM` : null

/** Headline strip rendered above the schedule. Reads like a newspaper
 *  masthead — small label, big number, optional inline badge / hint.
 *  When `compareBaseline` is provided (split-view / compare mode), each
 *  numeric stat picks up an inline pill showing the % delta vs. the
 *  5:30 PM snapshot value, and the hint line is rewritten to surface
 *  the baseline number. */
export default function PlanScheduleStatStrip({
    allOrdersCount,
    compareBaseline = null,
    customerSatisfaction,
    earliestTime,
    filteredCount,
    hasActiveFilters,
    latestTime,
    liveOrdersCount,
    predictedSatisfaction,
    previousBusinessDayLabel,
    previousBusinessDayYardage,
    totalTrucks,
    totalYards,
    uniqueCustomers,
    uniquePlants,
    weekYardage,
    yardageDeltaPct
}) {
    const inCompare = !!compareBaseline

    return (
        <div
            className="rounded-xl flex flex-wrap bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <PlanScheduleStat
                badge={
                    inCompare ? (
                        <CompareDeltaBadge base={compareBaseline.orders} baseLabel="orders" live={liveOrdersCount} />
                    ) : null
                }
                first
                hint={
                    inCompare
                        ? ALWAYS_HINT_BASE('orders', compareBaseline.orders, '')
                        : hasActiveFilters && filteredCount !== allOrdersCount
                          ? `of ${allOrdersCount.toLocaleString()}`
                          : 'on the day · cancelled excluded'
                }
                label="Orders"
                value={liveOrdersCount.toLocaleString()}
            />
            <PlanScheduleStat
                badge={
                    inCompare ? (
                        <CompareDeltaBadge base={compareBaseline.plants} baseLabel="plants" live={uniquePlants} />
                    ) : null
                }
                hint={
                    inCompare
                        ? `${uniqueCustomers.toLocaleString()} customers · vs ${formatBaseValue(compareBaseline.plants) ?? '—'} plants at 5:30 PM`
                        : `${uniqueCustomers.toLocaleString()} customer${uniqueCustomers === 1 ? '' : 's'}`
                }
                label="Plants"
                value={uniquePlants.toLocaleString()}
            />
            <PlanScheduleStat
                badge={
                    inCompare ? (
                        <CompareDeltaBadge
                            base={compareBaseline.yardage}
                            baseLabel="yardage"
                            live={totalYards}
                            unit="yd"
                        />
                    ) : yardageDeltaPct != null ? (
                        <YardageDeltaBadge
                            comparisonLabel={previousBusinessDayLabel}
                            comparisonYardage={previousBusinessDayYardage}
                            pct={yardageDeltaPct}
                        />
                    ) : null
                }
                hint={
                    inCompare
                        ? ALWAYS_HINT_BASE('yardage', compareBaseline.yardage, 'yd')
                        : yardageDeltaPct != null
                          ? `vs ${previousBusinessDayYardage.toLocaleString()} yd ${previousBusinessDayLabel}`
                          : 'cancelled excluded'
                }
                label="Yardage"
                unit="yd"
                value={totalYards.toLocaleString()}
            />
            <PlanScheduleStat hint="this week (Mon–Sat)" label="Week" unit="yd" value={weekYardage.toLocaleString()} />
            <PlanScheduleStat
                badge={
                    inCompare ? (
                        <CompareDeltaBadge base={compareBaseline.trucks} baseLabel="loads" live={totalTrucks} />
                    ) : null
                }
                hint={inCompare ? ALWAYS_HINT_BASE('loads', compareBaseline.trucks, '') : 'truck loads'}
                label="Loads"
                value={totalTrucks.toLocaleString()}
            />
            <PlanScheduleStat
                hint={
                    inCompare
                        ? compareBaseline.earliestTime && compareBaseline.latestTime
                            ? `original ${compareBaseline.earliestTime}–${compareBaseline.latestTime}`
                            : 'no original window'
                        : earliestTime && latestTime
                          ? 'first → last start'
                          : undefined
                }
                label="Window"
                value={earliestTime && latestTime ? `${earliestTime}–${latestTime}` : '—'}
            />
            {customerSatisfaction && customerSatisfaction.samples > 0 && (
                <PlanScheduleStat
                    badge={
                        <span className="inline-flex items-center gap-1.5">
                            {customerSatisfaction.isLive && (
                                <Badge
                                    dot
                                    pulse
                                    shape="pill"
                                    size="xs"
                                    title="Live — score updates as orders complete throughout the day"
                                    tone="danger"
                                >
                                    LIVE
                                </Badge>
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
            {predictedSatisfaction && predictedSatisfaction.samples > 0 && (
                <PlanScheduleStat
                    badge={
                        <span className="inline-flex items-center gap-1.5">
                            <Badge
                                icon="wand-magic-sparkles"
                                shape="pill"
                                size="xs"
                                title="Forecast — based on which orders the pool simulation flags as NEEDS HELP"
                                tone="info"
                            >
                                PREDICTED
                            </Badge>
                            <SatisfactionBadge score={predictedSatisfaction.score} />
                        </span>
                    }
                    hint={(() => {
                        if (predictedSatisfaction.badService === 0) {
                            return `${predictedSatisfaction.goodService} on pace · no shortages forecast`
                        }
                        const truckLabel = predictedSatisfaction.trucksShort === 1 ? 'truck' : 'trucks'
                        return [
                            `${predictedSatisfaction.goodService} on pace`,
                            `${predictedSatisfaction.badService} needs help`,
                            `${predictedSatisfaction.trucksShort} ${truckLabel} short`
                        ].join(' · ')
                    })()}
                    label="Customer satisfaction · predicted"
                    value={`${Math.round(predictedSatisfaction.score * 100)}%`}
                />
            )}
        </div>
    )
}
