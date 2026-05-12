import React, { useEffect, useMemo, useState } from 'react'

import { CallListSkeleton } from '../../../app/components/common/PlanSkeletons'
import CallListDetail from '../../../app/components/plan/CallListDetail'
import CallListRow from '../../../app/components/plan/CallListRow'
import { Stat, StatGroup } from '../../../app/components/ui/Panel'
import useCallList from '../../../app/hooks/useCallList'
import {
    CALL_LIST_SORT_OPTIONS,
    matchesCallListQuery,
    RECENT_CALL_COOLDOWN_DAYS,
    sortCallListRoster,
    wasRecentlyCalled
} from '../../../utils/CallListUtility'

/**
 * Plan -> Call List tab. Two-pane layout: left column lists every customer
 * who poured in the last 365 days but not in the last 30, sorted longest-
 * dormant first. Right column is a detail panel where dispatchers log a
 * call outcome (No Answer / Will Book Again / Booked / Not Interested) or
 * leave a free-form note. All entries are persisted with the dispatcher's
 * identity stamped server-side and surface as a per-customer history.
 */
function CallListView({ accentColor }) {
    const {
        deleteEntry,
        historyByCustomer,
        isLoadingRoster,
        loadHistory,
        loadingHistoryFor,
        logCall,
        refreshRoster,
        roster,
        rosterError,
        savingFor
    } = useCallList()

    const [query, setQuery] = useState('')
    const [sortKey, setSortKey] = useState('oldest')
    const [selectedCustomerNum, setSelectedCustomerNum] = useState(null)

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return sortCallListRoster(
            roster.filter((row) => matchesCallListQuery(row, q)),
            sortKey
        )
    }, [roster, query, sortKey])

    useEffect(() => {
        if (filtered.length === 0) {
            setSelectedCustomerNum(null)
            return
        }
        if (!filtered.some((row) => row.customer_num === selectedCustomerNum)) {
            // Prefer the first non-cooldown row so the dispatcher lands on an
            // actionable customer; fall back to filtered[0] if the entire list
            // is in the cooldown tier.
            const firstActionable = filtered.find((row) => !wasRecentlyCalled(row.last_call_at))
            setSelectedCustomerNum((firstActionable || filtered[0]).customer_num)
        }
    }, [filtered, selectedCustomerNum])

    useEffect(() => {
        if (selectedCustomerNum) loadHistory(selectedCustomerNum)
    }, [selectedCustomerNum, loadHistory])

    const stats = useMemo(() => {
        const total = roster.length
        const contacted = roster.filter((row) => (row.call_count_last_30 || 0) > 0).length
        const sumDays = roster.reduce((acc, row) => acc + (row.days_since_last_pour || 0), 0)
        const avgDays = total ? Math.round(sumDays / total) : 0
        const callsLogged = roster.reduce((acc, row) => acc + (row.call_count_last_30 || 0), 0)
        return { avgDays, callsLogged, contacted, total }
    }, [roster])

    const selectedRow = filtered.find((row) => row.customer_num === selectedCustomerNum) || null

    /** Index of the first row inside the cooldown tier — lets us render an
     *  accent divider so the bottom group reads as "recently called, come
     *  back later" instead of an unexplained gap in dormancy ordering. */
    const cooldownStartIndex = useMemo(
        () => filtered.findIndex((row) => wasRecentlyCalled(row.last_call_at)),
        [filtered]
    )

    /* Tab fills the parent's available height (the Plan shell wraps each
     * tab in `flex flex-col flex-1 min-h-0 overflow-hidden`). The stat
     * strip takes its natural height; the grid below claims the rest with
     * `flex-1 min-h-0`, which lets the inner list panel scroll precisely
     * within the remaining space — no viewport-math needed.
     *
     * Show the layout-matching skeleton only on first load so the hand-off
     * from the global Plan skeleton doesn't flicker. Manual refreshes keep
     * the previous roster visible so the user isn't yanked back to a blank
     * skeleton mid-task. */
    if (isLoadingRoster && roster.length === 0) return <CallListSkeleton />
    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 overflow-hidden animate-fade-in-fast">
            <StatGroup columns={4}>
                <Stat hint="poured 30d–365d ago" label="Dormant customers" value={stats.total.toLocaleString()} />
                <Stat hint="at least one call / 30d" label="Contacted" value={stats.contacted.toLocaleString()} />
                <Stat hint="across the list" label="Avg days dormant" value={stats.avgDays.toLocaleString()} />
                <Stat hint="entries / 30d" label="Calls logged" value={stats.callsLogged.toLocaleString()} />
            </StatGroup>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
                <section className="lg:col-span-5 flex flex-col gap-2 min-h-0">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5">
                        <h3 className="text-[14px] font-semibold m-0 truncate text-text-primary">
                            {`Dormant Customers (${filtered.length})`}
                        </h3>
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={refreshRoster}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border-none cursor-pointer bg-bg-tertiary text-text-secondary"
                            title="Reload roster"
                        >
                            <i className="fas fa-rotate" />
                            Refresh
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col rounded overflow-hidden bg-bg-primary border border-border-light">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                            <div className="relative flex-1 min-w-0">
                                <i className="fas fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none text-text-tertiary" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search customers, contacts, phone…"
                                    className="w-full rounded-md pl-7 pr-2.5 py-1.5 text-[12px] outline-none bg-bg-secondary border border-border-light text-text-primary"
                                />
                            </div>
                            <select
                                value={sortKey}
                                onChange={(e) => setSortKey(e.target.value)}
                                className="rounded-md px-2 py-1.5 text-[12px] cursor-pointer outline-none bg-bg-secondary border border-border-light text-text-primary"
                            >
                                {CALL_LIST_SORT_OPTIONS.map(({ key, label }) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {isLoadingRoster && (
                            <div className="text-sm italic text-center p-6 text-text-tertiary">
                                Loading dormant customers…
                            </div>
                        )}
                        {rosterError && !isLoadingRoster && (
                            <div className="m-3 rounded-md p-2.5 text-[12px] bg-[rgba(220,38,38,0.1)] text-red-700">
                                {rosterError}
                            </div>
                        )}
                        {!isLoadingRoster && !rosterError && filtered.length === 0 && (
                            <div className="text-sm italic text-center p-6 text-text-tertiary">
                                No dormant customers match your filters.
                            </div>
                        )}

                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {filtered.map((row, idx) => (
                                <React.Fragment key={row.customer_num}>
                                    {idx === cooldownStartIndex && cooldownStartIndex > 0 && (
                                        <div className="px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] flex items-center gap-2 bg-bg-secondary text-text-tertiary border-b border-border-light">
                                            <i className="fas fa-hourglass-half text-[9px]" />
                                            Called in last {RECENT_CALL_COOLDOWN_DAYS} days
                                        </div>
                                    )}
                                    <CallListRow
                                        accentColor={accentColor}
                                        isSelected={row.customer_num === selectedCustomerNum}
                                        onSelect={() => setSelectedCustomerNum(row.customer_num)}
                                        row={row}
                                    />
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="lg:col-span-7 flex flex-col gap-2 min-h-0">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5">
                        <h3 className="text-[14px] font-semibold m-0 min-w-0 truncate text-text-primary">Detail</h3>
                        {selectedRow && (
                            <span className="text-[12px] truncate text-text-tertiary">
                                · {selectedRow.customer_name || selectedRow.customer_num}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto rounded bg-bg-primary border border-border-light">
                        <CallListDetail
                            history={selectedRow ? historyByCustomer[selectedRow.customer_num] : null}
                            isLoadingHistory={selectedRow ? loadingHistoryFor.has(selectedRow.customer_num) : false}
                            isSaving={selectedRow ? savingFor.has(selectedRow.customer_num) : false}
                            onDeleteEntry={deleteEntry}
                            onLog={logCall}
                            row={selectedRow}
                        />
                    </div>
                </section>
            </div>
        </div>
    )
}

export default CallListView
