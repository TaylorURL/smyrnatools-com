/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../common/Badge'
import { YardageDeltaBadge } from './PlanScheduleBadges'
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

    const hasActual = customerSatisfaction && customerSatisfaction.samples > 0
    const hasPrediction = predictedSatisfaction && predictedSatisfaction.samples > 0
    /* The strip carries ONE satisfaction stat, never two. On past days the
     * actual card absorbs the forecast and reads "actual / predicted"; the
     * standalone predicted card is only for days that have a forecast but no
     * actuals yet — future days, or a past day with no ticket data. */
    const showPredictedAlone = hasPrediction && !hasActual

    /* Inline caption for the satisfaction stat — the descriptive line that now
     * sits next to the value (the quality / live / predicted badges moved to
     * their own row beneath, where they can wrap instead of getting clipped). */
    const actualSatisfactionCaption = (() => {
        if (!hasActual) return ''
        if (hasPrediction) {
            return predictedSatisfaction.isSnapshot ? 'actual / predicted at 5:30 PM' : 'actual / predicted'
        }
        const parts = [
            `${customerSatisfaction.goodService} good service`,
            `${customerSatisfaction.badService} bad service`
        ]
        if (customerSatisfaction.isLive && customerSatisfaction.inProgress > 0) {
            parts.push(`${customerSatisfaction.inProgress} in progress`)
        }
        return parts.join(' · ')
    })()
    const predictedSatisfactionCaption = (() => {
        if (!showPredictedAlone) return ''
        const truckLabel = predictedSatisfaction.trucksShort === 1 ? 'truck' : 'trucks'
        const base =
            predictedSatisfaction.badService === 0
                ? `${predictedSatisfaction.goodService} on pace · no shortages forecast`
                : [
                      `${predictedSatisfaction.goodService} on pace`,
                      `${predictedSatisfaction.badService} needs help`,
                      `${predictedSatisfaction.trucksShort} ${truckLabel} short`
                  ].join(' · ')
        return predictedSatisfaction.isSnapshot ? `${base} · as of 5:30 PM` : base
    })()

    return (
        /* Mobile: horizontal snap scroller — swipe through the masthead like
         * the Stocks app. Desktop: original `flex-wrap` row. The hidden
         * scrollbar utilities ([&::-webkit-scrollbar]:hidden +
         * scrollbar-width:none) keep the strip visually quiet on mobile while
         * the snap-mandatory + snap-start on each cell make swipes land
         * cleanly on a stat boundary instead of mid-cell. */
        <div
            className="rounded-xl flex md:flex-wrap overflow-x-auto md:overflow-visible snap-x md:snap-none snap-mandatory bg-bg-primary border border-border-light [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
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
            {hasActual && (
                <PlanScheduleStat
                    hint={actualSatisfactionCaption}
                    label={customerSatisfaction.isLive ? 'Customer satisfaction · so far' : 'Customer satisfaction'}
                    value={
                        hasPrediction
                            ? `${Math.round(customerSatisfaction.score * 100)}% / ${Math.round(predictedSatisfaction.score * 100)}%`
                            : `${Math.round(customerSatisfaction.score * 100)}%`
                    }
                />
            )}
            {showPredictedAlone && (
                <PlanScheduleStat
                    hint={predictedSatisfactionCaption}
                    label="Customer satisfaction · predicted"
                    value={`${Math.round(predictedSatisfaction.score * 100)}%`}
                />
            )}
        </div>
    )
}
