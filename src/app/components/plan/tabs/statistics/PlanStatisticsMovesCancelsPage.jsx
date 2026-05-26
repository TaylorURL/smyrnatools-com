/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import { fmtInt, fmtScorePct } from '../../../../../utils/PlanStatisticsFormatUtility'
import PlanStatisticsMovesCancelsDetail from './PlanStatisticsMovesCancelsDetail'
import PlanStatisticsMovesCancelsTable, { RankChip } from './PlanStatisticsMovesCancelsTable'

/* Severity palette — `HEAVY` for cancels (truck never rolled), `SOFT` for
 * moves (truck rolled but the plan slid), `NEUTRAL` for incidental field
 * edits. Mirrors PlanStatisticsKickersPage so the two customer-behaviour
 * leaderboards read with the same vocabulary. */
const HEAVY = '#dc2626'
const SOFT = '#f59e0b'
const NEUTRAL = '#64748b'

/* Top-N spotlights at the top of the page — small enough to fit alongside
 * the table and large enough to answer "who's the worst this week?" in a
 * glance. */
const SPOTLIGHT_SIZE = 5

const SORT_COLUMNS = [
    {
        accent: HEAVY,
        compare: (a, b) => b.cancelCount - a.cancelCount || b.churnEvents - a.churnEvents,
        key: 'cancels'
    },
    {
        accent: SOFT,
        compare: (a, b) => b.moveCount - a.moveCount || b.churnEvents - a.churnEvents,
        key: 'moves'
    },
    {
        compare: (a, b) => b.editCount - a.editCount || b.churnEvents - a.churnEvents,
        key: 'edits'
    },
    {
        compare: (a, b) => b.churnEvents - a.churnEvents || b.cancelCount - a.cancelCount,
        key: 'churn'
    },
    {
        compare: (a, b) => b.churnRate - a.churnRate || b.churnEvents - a.churnEvents,
        key: 'rate'
    },
    {
        compare: (a, b) => b.lastEventDate.localeCompare(a.lastEventDate),
        key: 'recent'
    }
]

const SORT_BY_KEY = Object.fromEntries(SORT_COLUMNS.map((s) => [s.key, s]))

/** KPI tile — uppercase tracked-out label, oversized value, small sub. The
 *  accent only tints the icon chip (pill with background + matching fg);
 *  the headline number stays in theme text. */
function StatTile({ accent, icon, label, sub, value }) {
    return (
        <div className="flex items-start gap-3">
            {icon && (
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-text-primary"
                    style={{ background: `${accent || NEUTRAL}1a` }}
                >
                    <i className={`fas ${icon} text-[14px]`} />
                </div>
            )}
            <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</div>
                <div className="text-[22px] font-semibold tabular-nums leading-tight text-text-primary">{value}</div>
                {sub && <div className="text-[10.5px] text-text-tertiary leading-tight">{sub}</div>}
            </div>
        </div>
    )
}

/** Spotlight card — top N for a single metric (cancels or moves).
 *  Compact list answering "who's the worst here?" without forcing the user
 *  to scan the full table. */
function SpotlightCard({ accent, customers, emptyHint, icon, label, metric, onSelect }) {
    if (!customers.length) {
        return (
            <div className="rounded-md p-4 bg-bg-primary border border-border-light">
                <div className="flex items-center gap-2 mb-2">
                    <span
                        className="w-7 h-7 rounded-md flex items-center justify-center text-text-primary"
                        style={{ background: `${accent}1a` }}
                    >
                        <i className={`fas ${icon} text-[12px]`} />
                    </span>
                    <div className="text-[12.5px] font-semibold text-text-primary">{label}</div>
                </div>
                <div className="text-[11.5px] text-text-tertiary">{emptyHint}</div>
            </div>
        )
    }
    const topValue = metric(customers[0]) || 1
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
                <span
                    className="w-7 h-7 rounded-md flex items-center justify-center text-text-primary"
                    style={{ background: `${accent}1a` }}
                >
                    <i className={`fas ${icon} text-[12px]`} />
                </span>
                <div className="text-[12.5px] font-semibold text-text-primary">{label}</div>
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                {customers.map((c, index) => {
                    const value = metric(c)
                    const fillPct = Math.max(4, (value / topValue) * 100)
                    return (
                        <li key={c.key} className="flex flex-col gap-1">
                            <button
                                type="button"
                                onClick={() => onSelect(c.key)}
                                className="w-full text-left flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                            >
                                <RankChip rank={index + 1} />
                                <span
                                    className="flex-1 min-w-0 text-[12.5px] font-medium text-text-primary truncate"
                                    title={c.name}
                                >
                                    {c.name}
                                </span>
                                <span className="text-[13px] font-semibold tabular-nums text-text-primary">
                                    {fmtInt(value)}
                                </span>
                            </button>
                            <div className="rounded-sm h-1 overflow-hidden bg-bg-tertiary ml-9">
                                <div style={{ background: accent, height: '100%', width: `${fillPct}%` }} />
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

function SnapshotCoverageBanner({ daysAnalyzed, daysWithSnapshot, isLoading }) {
    if (isLoading) {
        return (
            <div className="text-[11.5px] text-text-tertiary flex items-center gap-2">
                <i className="fas fa-circle-notch fa-spin" />
                Loading 5:30 PM snapshots…
            </div>
        )
    }
    if (!daysAnalyzed) return null
    if (daysWithSnapshot === daysAnalyzed) {
        return (
            <div className="text-[11.5px] text-text-tertiary">
                Comparing {fmtInt(daysAnalyzed)} day{daysAnalyzed === 1 ? '' : 's'} of live schedule against the 5:30 PM
                snapshot.
            </div>
        )
    }
    const missing = daysAnalyzed - daysWithSnapshot
    return (
        <div className="text-[11.5px] text-text-secondary">
            <i className="fas fa-triangle-exclamation mr-1" />
            {fmtInt(daysWithSnapshot)} of {fmtInt(daysAnalyzed)} days have a 5:30 PM snapshot — {fmtInt(missing)} day
            {missing === 1 ? ' is' : 's are'} excluded (Sunday skip or pre-snapshot date).
        </div>
    )
}

function EmptyState() {
    return (
        <div className="rounded-md p-10 bg-bg-primary border border-border-light text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-bg-tertiary text-text-tertiary">
                <i className="fas fa-shuffle text-[18px]" />
            </div>
            <div className="text-[13px] font-semibold text-text-primary mb-1">No churn in this window</div>
            <div className="text-[11.5px] text-text-tertiary max-w-sm mx-auto">
                Every order survived the 5:30 PM commit without a move, cancel, or field edit. Widen the date range to
                find recent disruption.
            </div>
        </div>
    )
}

/**
 * Statistics → Moves & Cancels sub-page.
 *
 * Ranks customers by how often the dispatcher had to shuffle their pour
 * after the 5:30 PM commit — pure cancels, time/plant moves, and other
 * field edits broken out side by side so the user can see whether a given
 * customer is mostly walking jobs away (cancel-heavy) or just keeps moving
 * the goalposts (move-heavy).
 */
export default function PlanStatisticsMovesCancelsPage({
    colocationMap,
    loading,
    movesCancelsStats,
    plansLoading,
    plantNameByCode
}) {
    const { customers, daysAnalyzed, daysWithSnapshot, isLoading: snapshotLoading, kpi } = movesCancelsStats
    const isLoading = !!(loading || plansLoading || snapshotLoading)

    const [filterText, setFilterText] = useState('')
    const [sortKey, setSortKey] = useState('cancels')
    const [selectedKey, setSelectedKey] = useState(null)

    const topCancellers = useMemo(
        () =>
            [...customers]
                .filter((c) => c.cancelCount > 0)
                .sort((a, b) => b.cancelCount - a.cancelCount || b.churnEvents - a.churnEvents)
                .slice(0, SPOTLIGHT_SIZE),
        [customers]
    )

    const topMovers = useMemo(
        () =>
            [...customers]
                .filter((c) => c.moveCount > 0)
                .sort((a, b) => b.moveCount - a.moveCount || b.churnEvents - a.churnEvents)
                .slice(0, SPOTLIGHT_SIZE),
        [customers]
    )

    const sorted = useMemo(() => {
        const sort = SORT_BY_KEY[sortKey] || SORT_COLUMNS[0]
        return [...customers].sort(sort.compare)
    }, [customers, sortKey])

    const visible = useMemo(() => {
        const query = filterText.trim().toLowerCase()
        if (!query) return sorted
        return sorted.filter((c) => c.name.toLowerCase().includes(query))
    }, [sorted, filterText])

    const selectedCustomer = useMemo(
        () => (selectedKey ? customers.find((c) => c.key === selectedKey) || null : null),
        [customers, selectedKey]
    )

    if (isLoading && customers.length === 0) {
        return (
            <div className="rounded-md p-6 bg-bg-primary border border-border-light text-[12px] text-text-tertiary flex items-center gap-3">
                <i className="fas fa-circle-notch fa-spin" />
                Comparing live schedules against the 5:30 PM snapshots…
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-md p-4 bg-bg-primary border border-border-light">
                <StatTile
                    accent={HEAVY}
                    icon="fa-circle-minus"
                    label="Cancels"
                    sub={`${fmtScorePct(kpi.cancelRate)} of orders`}
                    value={fmtInt(kpi.cancelCount)}
                />
                <StatTile
                    accent={SOFT}
                    icon="fa-shuffle"
                    label="Moves"
                    sub="time / plant shifts"
                    value={fmtInt(kpi.moveCount)}
                />
                <StatTile
                    icon="fa-pen-to-square"
                    label="Other edits"
                    sub="yardage, address, contact…"
                    value={fmtInt(kpi.editCount)}
                />
                <StatTile
                    icon="fa-users"
                    label="Customers tracked"
                    sub={`${fmtScorePct(kpi.churnRate)} combined churn`}
                    value={fmtInt(kpi.customersTracked)}
                />
            </div>

            <SnapshotCoverageBanner
                daysAnalyzed={daysAnalyzed}
                daysWithSnapshot={daysWithSnapshot}
                isLoading={snapshotLoading}
            />

            {customers.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    {/* Top movers + top cancellers spotlights */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SpotlightCard
                            accent={HEAVY}
                            customers={topCancellers}
                            emptyHint="No cancellations recorded in this window."
                            icon="fa-circle-minus"
                            label="Cancels the most"
                            metric={(c) => c.cancelCount}
                            onSelect={(key) => setSelectedKey((current) => (current === key ? null : key))}
                        />
                        <SpotlightCard
                            accent={SOFT}
                            customers={topMovers}
                            emptyHint="No moves recorded in this window."
                            icon="fa-shuffle"
                            label="Moves the most"
                            metric={(c) => c.moveCount}
                            onSelect={(key) => setSelectedKey((current) => (current === key ? null : key))}
                        />
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary" />
                            <input
                                type="text"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                placeholder="Search customer…"
                                className="w-full text-[12.5px] outline-none rounded py-1.5 pl-7 pr-2 bg-bg-secondary border border-border-light text-text-primary"
                                aria-label="Customer filter"
                            />
                        </div>
                        <div className="text-[11px] text-text-tertiary">
                            Showing {fmtInt(visible.length)} of {fmtInt(customers.length)} customer
                            {customers.length === 1 ? '' : 's'}
                        </div>
                    </div>

                    <PlanStatisticsMovesCancelsTable
                        customers={visible}
                        onSelectCustomer={(key) => setSelectedKey((current) => (current === key ? null : key))}
                        onSortChange={setSortKey}
                        selectedKey={selectedKey}
                        sortKey={sortKey}
                    />

                    {/* Inline legend — explains the breakdown bar tint */}
                    <div className="flex items-center gap-4 text-[11px] text-text-tertiary -mt-1">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: HEAVY }} />
                            Cancel
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SOFT }} />
                            Move
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: NEUTRAL }} />
                            Edit
                        </span>
                        <span className="hidden sm:inline">
                            <span className="mr-1">↤</span>earlier ·<span className="mx-1">↦</span>later
                        </span>
                    </div>
                </>
            )}

            {selectedCustomer && (
                <PlanStatisticsMovesCancelsDetail
                    colocationMap={colocationMap}
                    customer={selectedCustomer}
                    onClose={() => setSelectedKey(null)}
                    plantNameByCode={plantNameByCode}
                />
            )}
        </div>
    )
}
