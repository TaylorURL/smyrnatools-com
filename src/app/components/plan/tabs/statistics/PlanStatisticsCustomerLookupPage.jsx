/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { fmtDate, fmtInt, fmtPct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel, formatColocatedPlantLabel } from '../../../../../utils/PlantColocationUtility'
import ServiceTierBreakdown from './ServiceTierBreakdown'

const GOOD = '#16a34a'
const BAD = '#dc2626'
const LATE = '#f59e0b'
const SLOW = '#ea580c'
const KICKER = '#dc2626'
const SAME_DAY = '#d97706'

const GOOD_THRESHOLD = 0.85

/** Format a yardage value with a trailing unit. Drops the decimal when
 *  the kicker lands on a whole yard so the table reads cleanly. */
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

const pctColor = (pct) => (pct == null ? 'var(--text-tertiary)' : pct >= GOOD_THRESHOLD ? GOOD : BAD)

/* Tier-aware verdict palette + labels. Lateness severity tiers
 * (Not Good / Bad / Very Bad) and slow are SEPARATE dimensions —
 * slow is a pour-pace failure, lateness is an arrival-time failure.
 * A slow-only on-time order reads "Slow" (orange), not "Not Good".
 * An order that's both late and slow reads "<Tier> + slow". */
const TIER_TO_COLOR = { bad: BAD, good: GOOD, notGood: LATE, veryBad: '#7f1d1d' }

const verdictColor = (m) => {
    if (m.tier && m.tier !== 'good') return TIER_TO_COLOR[m.tier]
    if (m.isSlow) return SLOW
    return GOOD
}

const verdictLabel = (m) => {
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

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'bad', label: 'Bad service', test: (c) => c.badJobs > 0 },
    { key: 'late', label: 'Late', test: (c) => c.lateJobs > 0 },
    { key: 'slow', label: 'Slow', test: (c) => c.slowJobs > 0 },
    { key: 'perfect', label: 'Perfect', test: (c) => c.badJobs === 0 && c.jobs > 0 }
]

const SORTS = [
    { key: 'badJobs', label: 'Most bad service' },
    { key: 'recent', label: 'Most recent pour' },
    { key: 'jobs', label: 'Most jobs' },
    { key: 'goodPctAsc', label: 'Lowest good %' },
    { key: 'name', label: 'Name (A–Z)' }
]

/** One dot per measured order, chronological. */
function VerdictTrail({ orders }) {
    const dots = useMemo(() => {
        const sorted = [...orders].sort((a, b) => {
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

/** Stacked horizontal bar: good / late-only / slow-only / both. */
function MixBar({ badJobs, goodJobs, jobs, lateJobs, slowJobs }) {
    if (jobs === 0) return null
    const lateOnly = Math.max(0, lateJobs - Math.min(lateJobs, slowJobs))
    const slowOnly = Math.max(0, slowJobs - Math.min(lateJobs, slowJobs))
    const both = Math.max(0, badJobs - lateOnly - slowOnly)
    const seg = (count, color) =>
        count > 0 ? <div style={{ background: color, width: `${(count / jobs) * 100}%` }} /> : null
    return (
        <div className="rounded-sm h-1.5 overflow-hidden flex bg-bg-tertiary">
            {seg(goodJobs, GOOD)}
            {seg(lateOnly, LATE)}
            {seg(slowOnly, SLOW)}
            {seg(both, BAD)}
        </div>
    )
}

function CustomerCard({ customer, isActive, onSelect, orders }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(customer.key)}
            className="text-left rounded-md p-3 flex flex-col gap-2 cursor-pointer border transition-colors"
            style={{
                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                borderColor: isActive ? 'var(--text-secondary)' : 'var(--border-light)'
            }}
        >
            <div className="flex items-baseline justify-between gap-3 min-w-0">
                <div className="min-w-0">
                    <div
                        className="text-[13.5px] font-semibold text-text-primary truncate leading-tight"
                        title={customer.name}
                    >
                        {customer.name || '(unnamed)'}
                    </div>
                    {customer.lastPourDate && (
                        <div className="text-[10.5px] text-text-tertiary tabular-nums mt-0.5">
                            Last pour {fmtDate(customer.lastPourDate)}
                        </div>
                    )}
                </div>
                <div
                    className="text-[20px] font-semibold tabular-nums leading-none shrink-0"
                    style={{ color: pctColor(customer.goodPct) }}
                >
                    {fmtPct(customer.goodPct)}
                </div>
            </div>
            <MixBar
                badJobs={customer.badJobs}
                goodJobs={customer.goodJobs}
                jobs={customer.jobs}
                lateJobs={customer.lateJobs}
                slowJobs={customer.slowJobs}
            />
            <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-text-tertiary tabular-nums">
                    {fmtInt(customer.jobs)} jobs
                    {customer.lateJobs > 0 && (
                        <>
                            <span className="mx-1.5">·</span>
                            <span style={{ color: LATE }}>{fmtInt(customer.lateJobs)} late</span>
                        </>
                    )}
                    {customer.slowJobs > 0 && (
                        <>
                            <span className="mx-1.5">·</span>
                            <span style={{ color: SLOW }}>{fmtInt(customer.slowJobs)} slow</span>
                        </>
                    )}
                </div>
                <VerdictTrail orders={orders} />
            </div>
            {customer.tierCounts && customer.badJobs > 0 && (
                <ServiceTierBreakdown tierCounts={customer.tierCounts} compact />
            )}
        </button>
    )
}

function StatBlock({ label, sub, value, valueColor }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="text-[11px] text-text-tertiary">{label}</div>
            <div
                className="text-[18px] font-semibold tabular-nums leading-tight"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
            </div>
            {sub && <div className="text-[10.5px] text-text-tertiary">{sub}</div>}
        </div>
    )
}

function CustomerOrdersTable({ colocationMap, orders, plantNameByCode }) {
    if (!orders.length) {
        return (
            <div className="text-[12px] py-4 text-text-tertiary">
                No measured orders for this customer in the window.
            </div>
        )
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
                <thead>
                    <tr>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Date
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Plant
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Verdict
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Scheduled
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            First load
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Late by
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Pace
                        </th>
                        <th
                            className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light"
                            title="Yards the customer added mid-pour (kicker)"
                        >
                            Kicker
                        </th>
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
                                        {formatColocatedCodeLabel(m.plantCode, colocationMap)}
                                    </span>
                                    {formatColocatedPlantLabel(m.plantCode, plantNameByCode, colocationMap)}
                                </td>
                                <td className="px-3 py-2 text-[12px] font-semibold" style={{ color: verdictColor(m) }}>
                                    <div className="flex items-center gap-1.5">
                                        <span>{verdictLabel(m)}</span>
                                        {m.isSameDay && (
                                            <span
                                                title="Same-day order — booked the day it ran (15:00 sentinel)"
                                                className="rounded-sm px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                                                style={{ background: `${SAME_DAY}1a`, color: SAME_DAY }}
                                            >
                                                <i className="fas fa-bolt mr-0.5 text-[8px]" />
                                                Same-day
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {m.startTime || '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {m.firstLoadTime || '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12px] tabular-nums"
                                    style={{ color: m.isLate ? LATE : 'var(--text-tertiary)' }}
                                >
                                    {m.isLate ? fmtMinutes(m.latenessMin) : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12px] tabular-nums"
                                    style={{ color: m.isSlow ? SLOW : 'var(--text-tertiary)' }}
                                >
                                    {m.paceScore == null ? '—' : fmtPct(m.paceScore)}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12px] tabular-nums font-semibold"
                                    style={{ color: kickerLabel ? KICKER : 'var(--text-tertiary)' }}
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

function CustomerDetail({ colocationMap, customer, onClose, orders, plantNameByCode }) {
    const sortedOrders = useMemo(
        () =>
            [...orders].sort((a, b) => {
                if (a.date !== b.date) return b.date.localeCompare(a.date)
                return b.latenessMin - a.latenessMin
            }),
        [orders]
    )
    const lateAndSlow = orders.filter((m) => m.isLate && m.isSlow).length
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold m-0 truncate text-text-primary" title={customer.name}>
                        {customer.name || '(unnamed)'}
                    </h3>
                    <div className="text-[11.5px] text-text-tertiary tabular-nums mt-0.5">
                        {fmtInt(customer.jobs)} measured order{customer.jobs === 1 ? '' : 's'} in the active window
                        {customer.lastPourDate && <> · last pour {fmtDate(customer.lastPourDate)}</>}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[11.5px] text-text-secondary cursor-pointer bg-transparent border-none p-1"
                    title="Clear selection"
                >
                    Close
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5 pb-4 border-b border-border-light">
                <StatBlock
                    label="Good service"
                    value={fmtPct(customer.goodPct)}
                    valueColor={pctColor(customer.goodPct)}
                    sub={`${fmtInt(customer.goodJobs)} of ${fmtInt(customer.jobs)}`}
                />
                <StatBlock
                    label="Late"
                    value={fmtInt(customer.lateJobs)}
                    valueColor={customer.lateJobs > 0 ? LATE : undefined}
                    sub={
                        customer.lateJobs > 0
                            ? `Avg ${fmtMinutes(customer.avgLateMin)} · worst ${fmtMinutes(customer.worstLateMin)}`
                            : null
                    }
                />
                <StatBlock
                    label="Slow"
                    value={fmtInt(customer.slowJobs)}
                    valueColor={customer.slowJobs > 0 ? SLOW : undefined}
                    sub={lateAndSlow > 0 ? `${fmtInt(lateAndSlow)} also late` : null}
                />
                <StatBlock
                    label="Bad total"
                    value={fmtInt(customer.badJobs)}
                    valueColor={customer.badJobs > 0 ? BAD : undefined}
                />
            </div>

            {customer.tierCounts && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                    <span className="font-semibold uppercase tracking-wider">Bad-service severity:</span>
                    <ServiceTierBreakdown tierCounts={customer.tierCounts} showZero />
                </div>
            )}

            <CustomerOrdersTable
                orders={sortedOrders}
                plantNameByCode={plantNameByCode}
                colocationMap={colocationMap}
            />
        </div>
    )
}

export default function PlanStatisticsCustomerLookupPage({
    colocationMap,
    customerLookupLoading,
    loading,
    plansLoading,
    plantNameByCode,
    serviceStats
}) {
    const { customerIndex, orderVerdicts } = serviceStats
    const isLoading = !!(loading || customerLookupLoading || plansLoading)

    const [filterText, setFilterText] = useState('')
    const [filterKey, setFilterKey] = useState('all')
    const [sortKey, setSortKey] = useState('badJobs')
    const [selectedKey, setSelectedKey] = useState(null)
    const searchRef = useRef(null)
    const detailRef = useRef(null)

    useEffect(() => {
        searchRef.current?.focus()
    }, [])

    const ordersByCustomer = useMemo(() => {
        const map = new Map()
        for (const m of orderVerdicts) {
            if (!m.customerKey) continue
            if (!map.has(m.customerKey)) map.set(m.customerKey, [])
            map.get(m.customerKey).push(m)
        }
        return map
    }, [orderVerdicts])

    const visibleCustomers = useMemo(() => {
        const activeFilter = FILTERS.find((f) => f.key === filterKey) || FILTERS[0]
        const lower = filterText.trim().toLowerCase()
        let rows = activeFilter.test ? customerIndex.filter(activeFilter.test) : customerIndex
        if (lower) rows = rows.filter((c) => c.name.toLowerCase().includes(lower))
        rows = [...rows]
        switch (sortKey) {
            case 'jobs':
                rows.sort((a, b) => b.jobs - a.jobs || a.name.localeCompare(b.name))
                break
            case 'recent':
                rows.sort((a, b) => {
                    const ad = a.lastPourDate || ''
                    const bd = b.lastPourDate || ''
                    if (ad !== bd) return bd.localeCompare(ad)
                    return a.name.localeCompare(b.name)
                })
                break
            case 'goodPctAsc':
                rows.sort((a, b) => a.goodPct - b.goodPct || a.name.localeCompare(b.name))
                break
            case 'name':
                rows.sort((a, b) => a.name.localeCompare(b.name))
                break
            case 'badJobs':
            default:
                rows.sort((a, b) => b.badJobs - a.badJobs || a.goodPct - b.goodPct || a.name.localeCompare(b.name))
        }
        return rows
    }, [customerIndex, filterKey, filterText, sortKey])

    const selectedCustomer = useMemo(
        () => customerIndex.find((c) => c.key === selectedKey) || null,
        [customerIndex, selectedKey]
    )
    const selectedOrders = useMemo(
        () => (selectedKey ? ordersByCustomer.get(selectedKey) || [] : []),
        [ordersByCustomer, selectedKey]
    )

    useEffect(() => {
        if (selectedKey && detailRef.current) {
            detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [selectedKey])

    /* Mutually-exclusive views: selecting a customer hides the entire
     * search / filter row and the card grid, and replaces them with the
     * detail card. Closing the detail (or unselecting via the same row)
     * restores the list. Keeps the page focused on one thing at a time
     * and removes the awkward "scroll past the grid to find the detail
     * card" rhythm of the prior layout. */
    if (selectedCustomer) {
        return (
            <div className="flex flex-col gap-3" ref={detailRef}>
                {isLoading ? (
                    <CustomerDetailSkeleton />
                ) : (
                    <CustomerDetail
                        colocationMap={colocationMap}
                        customer={selectedCustomer}
                        onClose={() => setSelectedKey(null)}
                        orders={selectedOrders}
                        plantNameByCode={plantNameByCode}
                    />
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Search + sort */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary pointer-events-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="Search customers"
                        disabled={isLoading}
                        className="w-full rounded pl-9 pr-3 py-2 text-[13px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary disabled:opacity-60"
                    />
                </div>
                <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                    disabled={isLoading}
                    className="rounded px-2.5 py-2 text-[12px] outline-none cursor-pointer bg-bg-primary border border-border-light text-text-primary disabled:opacity-60"
                >
                    {SORTS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filter row + count */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {FILTERS.map((f) => {
                        const active = filterKey === f.key
                        return (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilterKey(f.key)}
                                disabled={isLoading}
                                className="bg-transparent border-none cursor-pointer p-0 text-[12px] disabled:opacity-60"
                                style={{
                                    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    fontWeight: active ? 600 : 400,
                                    textDecoration: active ? 'underline' : 'none',
                                    textUnderlineOffset: '4px'
                                }}
                            >
                                {f.label}
                            </button>
                        )
                    })}
                </div>
                <div className="text-[11px] text-text-tertiary tabular-nums">
                    {isLoading ? (
                        <span className="italic">Loading customers…</span>
                    ) : (
                        <>
                            {fmtInt(visibleCustomers.length)} of {fmtInt(customerIndex.length)}
                        </>
                    )}
                </div>
            </div>

            {/* Customer card grid — replaced wholesale with a skeleton while
             *  the upstream query is still resolving. Showing the previous
             *  filter's data with a tiny "refreshing" label was misleading
             *  because the visible rows didn't reflect the active filter
             *  selection yet. */}
            {isLoading ? (
                <CustomerCardGridSkeleton />
            ) : customerIndex.length === 0 ? (
                <div className="text-[12px] py-8 text-center text-text-tertiary">
                    No customer activity in this window.
                </div>
            ) : visibleCustomers.length === 0 ? (
                <div className="text-[12px] py-8 text-center text-text-tertiary">
                    No matches. Clear the search or switch filters.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {visibleCustomers.map((customer) => (
                        <CustomerCard
                            key={customer.key || customer.name}
                            customer={customer}
                            isActive={customer.key === selectedKey}
                            onSelect={(key) => setSelectedKey((current) => (current === key ? null : key))}
                            orders={ordersByCustomer.get(customer.key) || []}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/** Skeleton for the customer card grid — 9 placeholder cards in the same
 *  responsive grid the real list uses. Renders while the underlying
 *  service-quality query is in-flight (period / plant / comparison
 *  filter swaps) so the visible content matches the active filter
 *  selection instead of lingering on the previous window's results. */
function CustomerCardGridSkeleton() {
    const PlaceholderBar = ({ className = '', style }) => (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
    )
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-md p-3 flex flex-col gap-2 border bg-bg-primary border-border-light">
                    <div className="flex items-baseline justify-between gap-3">
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <PlaceholderBar className="h-3.5 w-2/3" />
                            <PlaceholderBar className="h-2.5 w-1/3" />
                        </div>
                        <PlaceholderBar className="h-5 w-12" />
                    </div>
                    <PlaceholderBar className="h-1.5 w-full" />
                    <div className="flex items-center justify-between gap-2">
                        <PlaceholderBar className="h-2.5 w-20" />
                        <div className="flex items-center gap-[2px]">
                            {Array.from({ length: 12 }).map((__, j) => (
                                <PlaceholderBar key={j} className="h-1.5 w-1.5 rounded-full" />
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Skeleton for the customer detail card — header, 4-stat block, then a
 *  short order table. Rendered when the user has a customer selected
 *  but the upstream data is mid-reload. Keeps the same layout shape so
 *  the actual content slots in without a visual jump. */
function CustomerDetailSkeleton() {
    const PlaceholderBar = ({ className = '', style }) => (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
    )
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <div className="min-w-0 flex flex-col gap-1.5">
                    <PlaceholderBar className="h-4 w-48" />
                    <PlaceholderBar className="h-3 w-64" />
                </div>
                <PlaceholderBar className="h-3 w-10" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5 pb-4 border-b border-border-light">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <PlaceholderBar className="h-2.5 w-16" />
                        <PlaceholderBar className="h-5 w-20" />
                        <PlaceholderBar className="h-2.5 w-24" />
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-bg-secondary border-b border-border-light rounded-t">
                {['12%', '15%', '18%', '12%', '12%', '12%', '12%', '12%'].map((w, i) => (
                    <PlaceholderBar key={i} className="h-2.5" style={{ width: w }} />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-border-light last:border-b-0">
                    {['12%', '15%', '18%', '12%', '12%', '12%', '12%', '12%'].map((w, j) => (
                        <PlaceholderBar key={j} className="h-3" style={{ width: w }} />
                    ))}
                </div>
            ))}
        </div>
    )
}
