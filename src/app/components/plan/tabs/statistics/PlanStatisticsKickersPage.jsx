/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { fmtDate, fmtInt, fmtScorePct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel, formatColocatedPlantLabel } from '../../../../../utils/PlantColocationUtility'
import ScorePercent from './ScorePercent'

/* Two-state colour system, matching the Customer Lookup page palette.
 * `HEAVY` lights the customers who drag the schedule the most — used
 * for the big number on every card and the "Heavy kickers" filter
 * threshold.  `SOFT` is the muted accent used for the secondary chart
 * fill and supplementary stats. */
const HEAVY = '#dc2626'
const SOFT = '#f59e0b'

/* Customers whose AVERAGE kicker meets or exceeds this many yards land
 * in the "Heavy kickers" filter. Tuned so a typical 3-yard top-up
 * doesn't qualify but anything that meaningfully reshapes the pool
 * does. */
const HEAVY_KICKER_AVG_YARDS = 10
/* Customers whose kicker rate meets or exceeds this fraction are
 * "frequent" — i.e. dispatch can pencil in a kicker on most of their
 * jobs ahead of time. */
const FREQUENT_KICKER_RATE = 0.3

/** Format a yardage value with the trailing unit. Drops the decimal
 *  when the number lands on a whole yard. */
const fmtYards = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    if (Math.round(n) === n) return `${fmtInt(n)} yd`
    return `${n.toFixed(1)} yd`
}

const FILTERS = [
    { key: 'all', label: 'All' },
    {
        key: 'heavy',
        label: `Heavy avg (≥ ${HEAVY_KICKER_AVG_YARDS} yd)`,
        test: (c) => c.avgKickerYards >= HEAVY_KICKER_AVG_YARDS
    },
    {
        key: 'frequent',
        label: `Frequent (≥ ${Math.round(FREQUENT_KICKER_RATE * 100)}%)`,
        test: (c) => c.kickerRate >= FREQUENT_KICKER_RATE
    },
    { key: 'recent', label: 'Kicked this week', test: (c) => withinDays(c.lastKickerDate, 7) }
]

const SORTS = [
    { key: 'avg', label: 'Largest avg kicker' },
    { key: 'total', label: 'Most yards kicked' },
    { key: 'rate', label: 'Most frequent kicker' },
    { key: 'kickerJobs', label: 'Most kicker jobs' },
    { key: 'recent', label: 'Most recent kicker' },
    { key: 'name', label: 'Name (A–Z)' }
]

/** True when `iso` (a YYYY-MM-DD plan date) is within `days` of today's
 *  calendar date. Used by the "Kicked this week" filter. */
function withinDays(iso, days) {
    if (!iso) return false
    const planMs = Date.parse(`${iso}T00:00:00`)
    if (!Number.isFinite(planMs)) return false
    const ageDays = (Date.now() - planMs) / 86400000
    return ageDays >= 0 && ageDays <= days
}

/** One dot per kicker job, chronological. Dot size scales with the
 *  kicker yardage (capped) so a 30-yard surprise visually outweighs a
 *  3-yard nudge. */
function KickerTrail({ orders }) {
    const dots = useMemo(() => {
        const sorted = [...orders].sort((a, b) => a.date.localeCompare(b.date))
        return sorted.slice(-18)
    }, [orders])
    if (!dots.length) return null
    return (
        <div className="flex items-end gap-[2px] h-3.5">
            {dots.map((m) => {
                const scaled = Math.min(1, m.kickerYards / 25)
                const size = 4 + Math.round(scaled * 6)
                return (
                    <div
                        key={m.orderId}
                        title={`${fmtDate(m.date)} · ${fmtYards(m.kickerYards)}`}
                        className="rounded-full shrink-0"
                        style={{ background: HEAVY, height: `${size}px`, width: `${size}px` }}
                    />
                )
            })}
        </div>
    )
}

/** Stacked horizontal bar: total scheduled yards (muted) vs. kicker
 *  yards (HEAVY).  The width ratio reads at-a-glance as "kickers were
 *  this fraction of their book." */
function KickerShareBar({ kickerYards, scheduledYards }) {
    const total = scheduledYards + kickerYards
    if (total <= 0) return null
    const kickerPct = (kickerYards / total) * 100
    return (
        <div className="rounded-sm h-1.5 overflow-hidden flex bg-bg-tertiary">
            <div style={{ background: 'var(--text-tertiary)', opacity: 0.35, width: `${100 - kickerPct}%` }} />
            <div style={{ background: HEAVY, width: `${kickerPct}%` }} />
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
                    {customer.lastKickerDate && (
                        <div className="text-[10.5px] text-text-tertiary tabular-nums mt-0.5">
                            Last kicker {fmtDate(customer.lastKickerDate)}
                        </div>
                    )}
                </div>
                <div
                    className="text-[20px] font-semibold tabular-nums leading-none shrink-0"
                    style={{ color: HEAVY }}
                    title="Average kicker size on jobs where this customer kicked"
                >
                    {fmtYards(customer.avgKickerYards)}
                </div>
            </div>
            <KickerShareBar kickerYards={customer.kickerYards} scheduledYards={customer.scheduledYards} />
            <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-text-tertiary tabular-nums">
                    {fmtInt(customer.kickerJobs)} of {fmtInt(customer.jobs)} jobs
                    <span className="mx-1.5">·</span>
                    {fmtYards(customer.kickerYards)} total
                    <span className="mx-1.5">·</span>
                    {fmtScorePct(customer.kickerRate)} rate
                </div>
                <KickerTrail orders={orders} />
            </div>
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

function CustomerKickersTable({ colocationMap, orders, plantNameByCode }) {
    if (!orders.length) {
        return (
            <div className="text-[12px] py-4 text-text-tertiary">No kicker jobs for this customer in the window.</div>
        )
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse">
                <thead>
                    <tr>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Date
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Plant
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Scheduled
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Kicker
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Loads
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            % over
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((m) => {
                        const overPct = m.scheduledYards > 0 ? m.kickerYards / m.scheduledYards : null
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
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {fmtYards(m.scheduledYards)}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12px] tabular-nums font-semibold"
                                    style={{ color: HEAVY }}
                                >
                                    +{fmtYards(m.kickerYards)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {fmtInt(m.kickerLoads)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {overPct == null ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        <ScorePercent size="sm" value={overPct} />
                                    )}
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
                return b.kickerYards - a.kickerYards
            }),
        [orders]
    )
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold m-0 truncate text-text-primary" title={customer.name}>
                        {customer.name || '(unnamed)'}
                    </h3>
                    <div className="text-[11.5px] text-text-tertiary tabular-nums mt-0.5">
                        {fmtInt(customer.kickerJobs)} kicker{customer.kickerJobs === 1 ? '' : 's'} across{' '}
                        {fmtInt(customer.jobs)} measured order{customer.jobs === 1 ? '' : 's'}
                        {customer.lastKickerDate && <> · last kicker {fmtDate(customer.lastKickerDate)}</>}
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
                    label="Avg kicker"
                    sub={`per kicker job (${fmtInt(customer.kickerJobs)})`}
                    value={fmtYards(customer.avgKickerYards)}
                    valueColor={HEAVY}
                />
                <StatBlock
                    label="Avg per job"
                    sub={`across all ${fmtInt(customer.jobs)} jobs`}
                    value={fmtYards(customer.avgKickPerJob)}
                    valueColor={SOFT}
                />
                <StatBlock
                    label="Total kicked"
                    sub={
                        customer.scheduledYards > 0
                            ? `${fmtScorePct(customer.kickerYards / customer.scheduledYards)} of scheduled`
                            : null
                    }
                    value={fmtYards(customer.kickerYards)}
                    valueColor={HEAVY}
                />
                <StatBlock
                    label="Kicker rate"
                    sub={`worst single ${fmtYards(customer.maxKickerYards)}`}
                    value={<ScorePercent value={customer.kickerRate} />}
                />
            </div>

            <CustomerKickersTable
                colocationMap={colocationMap}
                orders={sortedOrders}
                plantNameByCode={plantNameByCode}
            />
        </div>
    )
}

export default function PlanStatisticsKickersPage({
    colocationMap,
    kickerStats,
    loading,
    plansLoading,
    plantNameByCode
}) {
    const { customerIndex, kpi, orderKickers } = kickerStats
    const isLoading = !!(loading || plansLoading)

    const [filterText, setFilterText] = useState('')
    const [filterKey, setFilterKey] = useState('all')
    const [sortKey, setSortKey] = useState('avg')
    const [selectedKey, setSelectedKey] = useState(null)
    const searchRef = useRef(null)
    const detailRef = useRef(null)

    useEffect(() => {
        searchRef.current?.focus()
    }, [])

    const ordersByCustomer = useMemo(() => {
        const map = new Map()
        for (const m of orderKickers) {
            if (!m.customerKey) continue
            if (!map.has(m.customerKey)) map.set(m.customerKey, [])
            map.get(m.customerKey).push(m)
        }
        return map
    }, [orderKickers])

    const visibleCustomers = useMemo(() => {
        const activeFilter = FILTERS.find((f) => f.key === filterKey) || FILTERS[0]
        const lower = filterText.trim().toLowerCase()
        let rows = activeFilter.test ? customerIndex.filter(activeFilter.test) : customerIndex
        if (lower) rows = rows.filter((c) => c.name.toLowerCase().includes(lower))
        rows = [...rows]
        switch (sortKey) {
            case 'total':
                rows.sort((a, b) => b.kickerYards - a.kickerYards || a.name.localeCompare(b.name))
                break
            case 'rate':
                rows.sort(
                    (a, b) => b.kickerRate - a.kickerRate || b.kickerJobs - a.kickerJobs || a.name.localeCompare(b.name)
                )
                break
            case 'kickerJobs':
                rows.sort((a, b) => b.kickerJobs - a.kickerJobs || a.name.localeCompare(b.name))
                break
            case 'recent':
                rows.sort((a, b) => {
                    const ad = a.lastKickerDate || ''
                    const bd = b.lastKickerDate || ''
                    if (ad !== bd) return bd.localeCompare(ad)
                    return a.name.localeCompare(b.name)
                })
                break
            case 'name':
                rows.sort((a, b) => a.name.localeCompare(b.name))
                break
            case 'avg':
            default:
                rows.sort(
                    (a, b) =>
                        b.avgKickerYards - a.avgKickerYards ||
                        b.kickerJobs - a.kickerJobs ||
                        a.name.localeCompare(b.name)
                )
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

    const summaryLine = useMemo(() => {
        if (!kpi.kickerJobs) return null
        return `${fmtInt(kpi.customers)} customers · ${fmtInt(kpi.kickerJobs)} kicker jobs · ${fmtYards(
            kpi.totalKickerYards
        )} added · avg ${fmtYards(kpi.avgKickerYards)} per kicker`
    }, [kpi])

    return (
        <div className="flex flex-col gap-3">
            {summaryLine && <div className="text-[12px] text-text-secondary tabular-nums">{summaryLine}</div>}

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
                        className="w-full rounded pl-9 pr-3 py-2 text-[13px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary"
                    />
                </div>
                <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                    className="rounded px-2.5 py-2 text-[12px] outline-none cursor-pointer bg-bg-primary border border-border-light text-text-primary"
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
                                className="bg-transparent border-none cursor-pointer p-0 text-[12px]"
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
                    {fmtInt(visibleCustomers.length)} of {fmtInt(customerIndex.length)}
                    {isLoading && <span className="ml-2 italic">refreshing</span>}
                </div>
            </div>

            {/* Customer card grid */}
            {customerIndex.length === 0 ? (
                <div className="text-[12px] py-8 text-center text-text-tertiary">
                    {isLoading ? 'Loading…' : 'No kicker activity in this window.'}
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

            {/* Detail */}
            <div ref={detailRef}>
                {selectedCustomer && (
                    <CustomerDetail
                        colocationMap={colocationMap}
                        customer={selectedCustomer}
                        onClose={() => setSelectedKey(null)}
                        orders={selectedOrders}
                        plantNameByCode={plantNameByCode}
                    />
                )}
            </div>
        </div>
    )
}
