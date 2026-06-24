/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtDate, fmtInt } from '../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel } from '../../../../utils/PlantColocationUtility'
import Badge from '../../common/Badge'
import ScorePercent from './ScorePercent'
import ServiceTierBreakdown from './ServiceTierBreakdown'

/** Shared palette + helpers for any UI that surfaces per-customer
 *  service verdicts. Originally lived inside the Statistics → Customer
 *  Lookup page; lifted up here so the Call List detail can render the
 *  exact same context card without duplicating the visual vocabulary. */

export const SERVICE_COLOR_GOOD = '#16a34a'
export const SERVICE_COLOR_BAD = '#dc2626'
export const SERVICE_COLOR_LATE = '#f59e0b'
export const SERVICE_COLOR_SLOW = '#ea580c'
export const SERVICE_COLOR_KICKER = '#dc2626'
export const SERVICE_COLOR_SAME_DAY = '#d97706'

const TIER_TO_COLOR = {
    bad: SERVICE_COLOR_BAD,
    good: SERVICE_COLOR_GOOD,
    notGood: SERVICE_COLOR_LATE,
    veryBad: '#7f1d1d'
}

const TIER_TO_TONE = {
    bad: 'danger',
    good: 'success',
    notGood: 'warning',
    veryBad: 'danger'
}

export const verdictColor = (m) => {
    if (m.tier && m.tier !== 'good') return TIER_TO_COLOR[m.tier]
    if (m.isSlow) return SERVICE_COLOR_SLOW
    return SERVICE_COLOR_GOOD
}

/* Verdict tone for the unified <Badge /> — mirrors verdictColor but routes
 * through the brutalist tone palette so the per-order verdict pills in
 * Call List → Customer detail render with the same saturated-bg + white-
 * text treatment as every other status pill in the app. */
export const verdictTone = (m) => {
    if (m.tier && m.tier !== 'good') return TIER_TO_TONE[m.tier]
    if (m.isSlow) return 'warning'
    return 'success'
}

export const verdictLabel = (m) => {
    const slowSuffix = m.isSlow ? ' + slow' : ''
    switch (m.tier) {
        case 'veryBad':
            return `Very Bad${slowSuffix}`
        case 'bad':
            return `Bad${slowSuffix}`
        case 'notGood':
            return `Not Good${slowSuffix}`
        default:
            return m.isSlow ? 'Slow' : 'Good'
    }
}

/** Format a yardage value with a trailing unit. Drops the decimal when
 *  the value lands on a whole yard so the table reads cleanly. */
const fmtYards = (n) => {
    if (n == null || !Number.isFinite(n) || n <= 0) return null
    if (Math.round(n) === n) return `${fmtInt(n)} yd`
    return `${n.toFixed(1)} yd`
}

const fmtMinutes = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    if (n < 60) return `${Math.round(n)} min`
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function StatBlock({ label, sub, value }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="text-[11px] text-text-tertiary">{label}</div>
            <div className="text-[18px] font-semibold tabular-nums leading-tight text-text-primary">{value}</div>
            {sub && <div className="text-[10.5px] text-text-tertiary">{sub}</div>}
        </div>
    )
}

/** Stacked horizontal bar: good / late-only / slow-only / both. */
export function ServiceMixBar({ badJobs, goodJobs, jobs, lateJobs, slowJobs }) {
    if (!jobs) return null
    const lateOnly = Math.max(0, lateJobs - Math.min(lateJobs, slowJobs))
    const slowOnly = Math.max(0, slowJobs - Math.min(lateJobs, slowJobs))
    const both = Math.max(0, badJobs - lateOnly - slowOnly)
    const seg = (count, color) =>
        count > 0 ? <div style={{ background: color, width: `${(count / jobs) * 100}%` }} /> : null
    return (
        <div className="rounded-sm h-1.5 overflow-hidden flex bg-bg-tertiary">
            {seg(goodJobs, SERVICE_COLOR_GOOD)}
            {seg(lateOnly, SERVICE_COLOR_LATE)}
            {seg(slowOnly, SERVICE_COLOR_SLOW)}
            {seg(both, SERVICE_COLOR_BAD)}
        </div>
    )
}

/** One dot per measured order, chronological. Caps at 24 dots so the
 *  trail stays visually meaningful for very active customers. */
export function VerdictTrail({ orders }) {
    const dots = useMemo(() => {
        const sorted = [...(orders || [])].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date)
            return (a.startMin || 0) - (b.startMin || 0)
        })
        return sorted.slice(-24)
    }, [orders])
    if (!dots.length) return null
    return (
        <div className="flex items-center gap-[2px]">
            {dots.map((m) => (
                <div
                    key={m.orderId}
                    title={`${fmtDate(m.date)} · ${verdictLabel(m)}`}
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: verdictColor(m) }}
                />
            ))}
        </div>
    )
}

/** Per-order verdict table. Reused by Customer Lookup and the Call List
 *  detail so dispatchers see the same row breakdown wherever they look
 *  up a customer. */
export function CustomerOrdersTable({ emptyMessage, orders, plantNameByCode }) {
    if (!orders || orders.length === 0) {
        return (
            <div className="text-[12px] py-4 text-text-tertiary">
                {emptyMessage || 'No measured orders for this customer in the window.'}
            </div>
        )
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
                <thead>
                    <tr>
                        {['Date', 'Plant', 'Verdict'].map((h) => (
                            <th
                                key={h}
                                className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light"
                            >
                                {h}
                            </th>
                        ))}
                        {['Scheduled', 'First load', 'Late by', 'Pace', 'Kicker'].map((h) => (
                            <th
                                key={h}
                                className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light"
                                title={h === 'Kicker' ? 'Yards the customer added mid-pour (kicker)' : undefined}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {orders.map((m) => {
                        const kickerLabel = m.hasKicker ? fmtYards(m.kickerYards) : null
                        return (
                            <tr key={m.orderId} className="border-b border-border-light last:border-b-0">
                                <td className="px-3 py-2 text-[12px] text-text-secondary tabular-nums">
                                    {fmtDate(m.date)}
                                </td>
                                <td className="px-3 py-2 text-[12px] text-text-primary">
                                    <span className="font-mono text-[11px] tabular-nums text-text-tertiary mr-2">
                                        {formatColocatedCodeLabel(m.plantCode)}
                                    </span>
                                    {formatColocatedPlantLabel(m.plantCode, plantNameByCode)}
                                </td>
                                <td className="px-3 py-2 text-[12px] font-semibold">
                                    <div className="flex items-center gap-1.5">
                                        <Badge tone={verdictTone(m)} size="md" shape="rounded-md">
                                            {verdictLabel(m)}
                                        </Badge>
                                        {m.isSameDay && (
                                            <Badge
                                                tone="warning"
                                                size="xs"
                                                shape="square"
                                                icon="bolt"
                                                title="Same-day order — booked the day it ran (15:00 sentinel)"
                                            >
                                                Same-day
                                            </Badge>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {m.startTime || '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {m.firstLoadTime || '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-primary">
                                    {m.isLate ? fmtMinutes(m.latenessMin) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {m.paceScore == null ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        <ScorePercent size="sm" value={m.paceScore} />
                                    )}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12px] tabular-nums font-semibold text-text-primary"
                                    title={
                                        kickerLabel
                                            ? `${m.kickerLoads} kicker load${m.kickerLoads === 1 ? '' : 's'}`
                                            : undefined
                                    }
                                >
                                    {kickerLabel ? `+${kickerLabel}` : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/** Top-level reusable card that surfaces a customer's service-quality
 *  context — stat blocks, tier breakdown, and per-order verdicts table.
 *  The Statistics → Customer Lookup detail and the Call List → customer
 *  detail both render this so the dispatcher sees a consistent
 *  history view wherever they look a customer up.
 *
 *  Optional `header` slot lets the caller provide whatever heading /
 *  context (customer name, last pour date, close button) makes sense in
 *  their surface. Pass null to skip the header — the Call List already
 *  has its own customer header above the context block. */
export function CustomerServiceContext({ aggregate, emptyMessage, header, orders, plantNameByCode }) {
    const sortedOrders = useMemo(() => {
        if (!orders) return []
        return [...orders].sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date)
            return (b.latenessMin || 0) - (a.latenessMin || 0)
        })
    }, [orders])

    if (!aggregate || aggregate.jobs === 0) {
        return (
            <div className="rounded-md p-4 bg-bg-primary border border-border-light flex flex-col gap-2">
                {header}
                <div className="text-[12px] text-text-tertiary">
                    {emptyMessage || 'No measured service history for this customer in the lookup window.'}
                </div>
            </div>
        )
    }

    const lateAndSlow = orders.filter((m) => m.isLate && m.isSlow).length

    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            {header}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5 pb-4 border-b border-border-light">
                <StatBlock
                    label="Good service"
                    value={<ScorePercent value={aggregate.goodPct} />}
                    sub={`${fmtInt(aggregate.goodJobs)} of ${fmtInt(aggregate.jobs)}`}
                />
                <StatBlock
                    label="Late"
                    value={fmtInt(aggregate.lateJobs)}
                    sub={
                        aggregate.lateJobs > 0
                            ? `Avg ${fmtMinutes(aggregate.avgLateMin)} · worst ${fmtMinutes(aggregate.worstLateMin)}`
                            : null
                    }
                />
                <StatBlock
                    label="Slow"
                    value={fmtInt(aggregate.slowJobs)}
                    sub={lateAndSlow > 0 ? `${fmtInt(lateAndSlow)} also late` : null}
                />
                <StatBlock label="Bad total" value={fmtInt(aggregate.badJobs)} />
            </div>

            {aggregate.tierCounts && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary mb-3">
                    <span className="font-semibold uppercase tracking-wider">Bad-service severity:</span>
                    <ServiceTierBreakdown tierCounts={aggregate.tierCounts} showZero />
                </div>
            )}

            <CustomerOrdersTable
                emptyMessage={emptyMessage}
                orders={sortedOrders}
                plantNameByCode={plantNameByCode}
            />
        </div>
    )
}

/** Skeleton matching the shape of `CustomerServiceContext` so any caller
 *  can show a layout-matching placeholder while it fetches verdicts. */
export function CustomerServiceContextSkeleton({ withHeader = false }) {
    const SkelBar = ({ className = '', style }) => (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
    )
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            {withHeader && (
                <div className="flex items-baseline justify-between gap-3 mb-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                        <SkelBar className="h-4 w-48" />
                        <SkelBar className="h-3 w-64" />
                    </div>
                    <SkelBar className="h-3 w-12" />
                </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5 pb-4 border-b border-border-light">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <SkelBar className="h-2.5 w-16" />
                        <SkelBar className="h-5 w-20" />
                        <SkelBar className="h-2.5 w-24" />
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-bg-secondary border-b border-border-light rounded-t">
                {['12%', '15%', '18%', '12%', '12%', '12%', '12%', '12%'].map((w, i) => (
                    <SkelBar key={i} className="h-2.5" style={{ width: w }} />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-border-light last:border-b-0">
                    {['12%', '15%', '18%', '12%', '12%', '12%', '12%', '12%'].map((w, j) => (
                        <SkelBar key={j} className="h-3" style={{ width: w }} />
                    ))}
                </div>
            ))}
        </div>
    )
}
