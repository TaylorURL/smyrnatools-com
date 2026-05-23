/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import {
    CALL_LIST_SORT_OPTIONS,
    CALL_OUTCOME_COLORS,
    CALL_OUTCOME_LABELS,
    matchesCallListQuery,
    RECENT_CALL_COOLDOWN_DAYS,
    sortCallListRoster,
    wasRecentlyCalled
} from '../../../../../utils/CallListUtility'
import DateUtility from '../../../../../utils/DateUtility'
import {
    CallListCustomerCardRow,
    CallListCustomerDetail,
    CallListCustomerDetailSkeleton,
    CallListCustomerListSkeleton
} from './CallListCustomerCard'

/** Shared filter strip — search input + sort dropdown. Mirrors the
 *  Statistics tab's controls strip so both tabs read the same. Inputs
 *  are disabled while the upstream roster is loading so users can't
 *  type into stale state. */
function FilterStrip({ isLoading, onChangeQuery, onChangeSort, query, sortKey, totalShown, totalUnfiltered }) {
    return (
        <div
            className="rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 flex-1 min-w-[200px] bg-bg-secondary border border-border-light">
                <i className="fas fa-magnifying-glass text-[11px] text-text-tertiary" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => onChangeQuery(e.target.value)}
                    placeholder="Search customers, contacts, phone…"
                    disabled={isLoading}
                    className="bg-transparent outline-none border-none text-[12.5px] w-full text-text-primary disabled:opacity-60"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => onChangeQuery('')}
                        className="border-none bg-transparent cursor-pointer text-text-tertiary"
                        aria-label="Clear search"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                )}
            </div>
            <select
                value={sortKey}
                onChange={(e) => onChangeSort(e.target.value)}
                disabled={isLoading}
                className="rounded-md px-2.5 py-1.5 text-[12.5px] cursor-pointer outline-none bg-bg-secondary border border-border-light text-text-primary disabled:opacity-60"
                title="Sort by"
            >
                {CALL_LIST_SORT_OPTIONS.map(({ key, label }) => (
                    <option key={key} value={key}>
                        Sort: {label}
                    </option>
                ))}
            </select>
            <span className="text-[11.5px] text-text-tertiary tabular-nums">
                {isLoading ? (
                    <span className="italic">Loading…</span>
                ) : (
                    <>
                        {totalShown} of {totalUnfiltered}
                    </>
                )}
            </span>
        </div>
    )
}

/** Mutually-exclusive list/detail surface shared by Outreach + Directory.
 *  When `selectedRow` is non-null the list (and filter strip) collapse
 *  away and only the detail card renders — same UX shape as the
 *  Statistics → Customer Lookup page. When the upstream data is
 *  reloading we swap in the matching skeleton so the page never
 *  displays stale rows for the wrong filter window. */
function ListOrDetailPane({
    accentColor,
    colocationMap,
    contactsByCustomer,
    cooldownStartIndex,
    deleteContact,
    deleteEntry,
    filtered,
    historyByCustomer,
    isLoading,
    listEmptyMessage,
    loadContacts,
    loadHistory,
    loadingContactsFor,
    loadingHistoryFor,
    logCall,
    onClearSelection,
    onSelectCustomer,
    plantNameByCode,
    rosterError,
    saveContact,
    savingContactFor,
    savingFor,
    selectedRow
}) {
    if (selectedRow) {
        const isHistoryLoading = loadingHistoryFor.has(selectedRow.customer_num)
        const hasHistory = historyByCustomer[selectedRow.customer_num] !== undefined
        // Treat the detail as still loading on the very first visit (no
        // history slot in the cache yet) — once an entry exists, the
        // detail shows the data and uses the inline "Loading history…"
        // hint inside the history list for subsequent reloads. Avoids
        // ping-ponging the entire detail skeleton on every refetch.
        if (isLoading || (!hasHistory && isHistoryLoading)) {
            return (
                <>
                    <BackToListBar accentColor={accentColor} onClose={onClearSelection} />
                    <CallListCustomerDetailSkeleton />
                </>
            )
        }
        return (
            <CallListCustomerDetail
                colocationMap={colocationMap}
                contacts={contactsByCustomer?.[selectedRow.customer_num] || null}
                history={historyByCustomer[selectedRow.customer_num] || null}
                isLoadingContacts={loadingContactsFor?.has(selectedRow.customer_num) || false}
                isLoadingHistory={isHistoryLoading}
                isSaving={savingFor.has(selectedRow.customer_num)}
                isSavingContact={savingContactFor?.has(selectedRow.customer_num) || false}
                onClose={onClearSelection}
                onDeleteContact={deleteContact}
                onDeleteEntry={deleteEntry}
                onLoadContacts={loadContacts}
                onLoadHistory={loadHistory}
                onLog={logCall}
                onSaveContact={saveContact}
                plantNameByCode={plantNameByCode}
                row={selectedRow}
            />
        )
    }

    if (isLoading) return <CallListCustomerListSkeleton />
    if (rosterError) {
        return (
            <div className="rounded-lg p-3 text-[12px] bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.25)] text-text-primary">
                {rosterError}
            </div>
        )
    }
    if (filtered.length === 0) {
        return (
            <div className="rounded-lg p-6 text-center text-[12.5px] bg-bg-primary border border-border-light text-text-secondary">
                {listEmptyMessage}
            </div>
        )
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filtered.map((row, idx) => (
                <React.Fragment key={row.customer_num}>
                    {idx === cooldownStartIndex && cooldownStartIndex > 0 && (
                        <div className="col-span-full px-2 pt-1 text-[10px] font-bold uppercase tracking-[0.08em] flex items-center gap-2 text-text-tertiary">
                            <i className="fas fa-hourglass-half text-[9px]" />
                            Called in last {RECENT_CALL_COOLDOWN_DAYS} days
                        </div>
                    )}
                    <CallListCustomerCardRow onSelect={onSelectCustomer} row={row} />
                </React.Fragment>
            ))}
        </div>
    )
}

/** A small toolbar shown above the detail skeleton — gives the user a
 *  way to bail out even before the data finishes loading. */
function BackToListBar({ onClose }) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary"
            >
                <i className="fas fa-arrow-left text-[10px]" />
                Back to list
            </button>
        </div>
    )
}

/** Outreach Queue — dormant customers not in cooldown, longest dormant
 *  first. Selecting a customer hides the entire list (and the filter
 *  strip) so the detail owns the page. */
export function CallListOutreachPage({
    accentColor,
    colocationMap,
    contactsByCustomer,
    deleteContact,
    deleteEntry,
    historyByCustomer,
    isLoading,
    loadContacts,
    loadHistory,
    loadingContactsFor,
    loadingHistoryFor,
    logCall,
    onClearSelectedCustomer,
    onSelectCustomer,
    plantNameByCode,
    roster,
    rosterError,
    saveContact,
    savingContactFor,
    savingFor,
    selectedCustomerNum
}) {
    const [query, setQuery] = useState('')
    const [sortKey, setSortKey] = useState('oldest')

    // Outreach only surfaces the dormant pool (no pour in past 30 days).
    // The roster now ships active customers too — for the Directory — so
    // we strip them out here before applying the recent-call cooldown.
    const dormant = useMemo(() => roster.filter((row) => (row.pouring_status || 'dormant') === 'dormant'), [roster])
    const fresh = useMemo(() => dormant.filter((row) => !wasRecentlyCalled(row.last_call_at)), [dormant])
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return sortCallListRoster(
            fresh.filter((row) => matchesCallListQuery(row, q)),
            sortKey
        )
    }, [fresh, query, sortKey])

    const selectedRow = useMemo(
        () => roster.find((row) => row.customer_num === selectedCustomerNum) || null,
        [roster, selectedCustomerNum]
    )

    return (
        <div className="flex flex-col gap-3 min-w-0">
            {!selectedRow && (
                <FilterStrip
                    isLoading={isLoading && roster.length === 0}
                    onChangeQuery={setQuery}
                    onChangeSort={setSortKey}
                    query={query}
                    sortKey={sortKey}
                    totalShown={filtered.length}
                    totalUnfiltered={fresh.length}
                />
            )}
            <ListOrDetailPane
                accentColor={accentColor}
                colocationMap={colocationMap}
                contactsByCustomer={contactsByCustomer}
                deleteContact={deleteContact}
                deleteEntry={deleteEntry}
                filtered={filtered}
                historyByCustomer={historyByCustomer}
                isLoading={isLoading && roster.length === 0}
                listEmptyMessage={
                    fresh.length === 0
                        ? 'No dormant customers waiting on a call right now.'
                        : 'No customers match your search.'
                }
                loadContacts={loadContacts}
                loadHistory={loadHistory}
                loadingContactsFor={loadingContactsFor}
                loadingHistoryFor={loadingHistoryFor}
                logCall={logCall}
                onClearSelection={onClearSelectedCustomer}
                onSelectCustomer={onSelectCustomer}
                plantNameByCode={plantNameByCode}
                rosterError={rosterError}
                saveContact={saveContact}
                savingContactFor={savingContactFor}
                savingFor={savingFor}
                selectedRow={selectedRow}
            />
        </div>
    )
}

/** Directory — every customer that's poured in the last year, including
 *  both active accounts and dormant ones. Same list/detail toggle as
 *  Outreach but no dormancy filter. Cooldown tier (recently-called rows)
 *  sits behind a divider. */
export function CallListDirectoryPage({
    accentColor,
    colocationMap,
    contactsByCustomer,
    deleteContact,
    deleteEntry,
    historyByCustomer,
    isLoading,
    loadContacts,
    loadHistory,
    loadingContactsFor,
    loadingHistoryFor,
    logCall,
    onClearSelectedCustomer,
    onSelectCustomer,
    plantNameByCode,
    roster,
    rosterError,
    saveContact,
    savingContactFor,
    savingFor,
    selectedCustomerNum
}) {
    const [query, setQuery] = useState('')
    const [sortKey, setSortKey] = useState('oldest')
    const [statusFilter, setStatusFilter] = useState('all')

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return sortCallListRoster(
            roster.filter((row) => {
                if (!matchesCallListQuery(row, q)) return false
                if (statusFilter === 'active' && row.pouring_status !== 'active') return false
                if (statusFilter === 'dormant' && row.pouring_status === 'active') return false
                return true
            }),
            sortKey
        )
    }, [roster, query, sortKey, statusFilter])

    const cooldownStartIndex = useMemo(
        () => filtered.findIndex((row) => wasRecentlyCalled(row.last_call_at)),
        [filtered]
    )

    const selectedRow = useMemo(
        () => roster.find((row) => row.customer_num === selectedCustomerNum) || null,
        [roster, selectedCustomerNum]
    )

    return (
        <div className="flex flex-col gap-3 min-w-0">
            {!selectedRow && (
                <>
                    <FilterStrip
                        isLoading={isLoading && roster.length === 0}
                        onChangeQuery={setQuery}
                        onChangeSort={setSortKey}
                        query={query}
                        sortKey={sortKey}
                        totalShown={filtered.length}
                        totalUnfiltered={roster.length}
                    />
                    <StatusFilterRow activeKey={statusFilter} onSelect={setStatusFilter} roster={roster} />
                </>
            )}
            <ListOrDetailPane
                accentColor={accentColor}
                colocationMap={colocationMap}
                contactsByCustomer={contactsByCustomer}
                cooldownStartIndex={cooldownStartIndex}
                deleteContact={deleteContact}
                deleteEntry={deleteEntry}
                filtered={filtered}
                historyByCustomer={historyByCustomer}
                isLoading={isLoading && roster.length === 0}
                listEmptyMessage={roster.length === 0 ? 'No customers found yet.' : 'No customers match your search.'}
                loadContacts={loadContacts}
                loadHistory={loadHistory}
                loadingContactsFor={loadingContactsFor}
                loadingHistoryFor={loadingHistoryFor}
                logCall={logCall}
                onClearSelection={onClearSelectedCustomer}
                onSelectCustomer={onSelectCustomer}
                plantNameByCode={plantNameByCode}
                rosterError={rosterError}
                saveContact={saveContact}
                savingContactFor={savingContactFor}
                savingFor={savingFor}
                selectedRow={selectedRow}
            />
        </div>
    )
}

/** Pouring-status chip filter sitting above the Directory grid. Counts
 *  refresh as the roster updates so the dispatcher knows at a glance how
 *  many customers are actively pouring vs. dormant. */
function StatusFilterRow({ activeKey, onSelect, roster }) {
    const counts = useMemo(() => {
        let active = 0
        let dormant = 0
        for (const row of roster) {
            if (row.pouring_status === 'active') active += 1
            else dormant += 1
        }
        return { active, all: roster.length, dormant }
    }, [roster])
    const options = [
        { count: counts.all, key: 'all', label: 'All customers' },
        { count: counts.active, key: 'active', label: 'Currently pouring' },
        { count: counts.dormant, key: 'dormant', label: 'Dormant' }
    ]
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {options.map(({ count, key, label }) => {
                const active = activeKey === key
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(key)}
                        className="bg-transparent border-none cursor-pointer p-0 text-[12px]"
                        style={{
                            color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            fontWeight: active ? 600 : 400,
                            textDecoration: active ? 'underline' : 'none',
                            textUnderlineOffset: '4px'
                        }}
                    >
                        {label}
                        <span className="ml-1 text-text-tertiary tabular-nums">({count})</span>
                    </button>
                )
            })}
        </div>
    )
}

/* ─── Activity feed — metrics + grouped timeline ──────────────────
 *
 * Rebuilt around three layers: a KPI strip (calls today / this week,
 * booked rate, unique customers, top caller), a stacked outcome bar
 * showing the mix at a glance, and a date-grouped timeline of every
 * entry. Clicking a row jumps into the matching customer's detail
 * surface — same pivot the old design supported, just framed with
 * context above so the team can see WHO is making progress and WHAT
 * outcomes are landing.
 */

const ICON_BY_OUTCOME = {
    booked: 'fa-circle-check',
    no_answer: 'fa-phone-slash',
    not_interested: 'fa-circle-xmark',
    note: 'fa-note-sticky',
    will_book_again: 'fa-rotate-right'
}

const TIME_RANGE_OPTIONS = [
    { days: 1, key: 'today', label: 'Today' },
    { days: 7, key: 'week', label: 'This week' },
    { days: 30, key: 'month', label: '30 days' },
    { days: null, key: 'all', label: 'All' }
]

const startOfDayMs = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

const formatTimeOfDay = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const formatRelativeShort = (iso) => {
    const ts = Date.parse(iso)
    if (!Number.isFinite(ts)) return ''
    const deltaSec = Math.round((Date.now() - ts) / 1000)
    if (deltaSec < 45) return 'just now'
    if (deltaSec < 60 * 60) return `${Math.round(deltaSec / 60)}m ago`
    if (deltaSec < 60 * 60 * 24) return `${Math.round(deltaSec / 3600)}h ago`
    return formatTimeOfDay(iso)
}

const initialsOf = (name) => {
    if (!name) return '—'
    const parts = String(name).trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}

/** Bucket entries into Today / Yesterday / This week / Earlier based
 *  on local-time day boundaries. Order preserved within each bucket
 *  (the caller already sorts newest-first). */
function groupEntriesByDay(entries) {
    const todayStart = startOfDayMs(new Date())
    const yesterdayStart = todayStart - 86400000
    const weekStart = todayStart - 6 * 86400000
    const groups = { earlier: [], today: [], week: [], yesterday: [] }
    entries.forEach((entry) => {
        const ts = Date.parse(entry.created_at)
        if (!Number.isFinite(ts)) {
            groups.earlier.push(entry)
            return
        }
        if (ts >= todayStart) groups.today.push(entry)
        else if (ts >= yesterdayStart) groups.yesterday.push(entry)
        else if (ts >= weekStart) groups.week.push(entry)
        else groups.earlier.push(entry)
    })
    return groups
}

/** Metric rollup for the KPI strip + outcome breakdown bar. Pure: no
 *  React state, no side effects. Run from a memo against the filtered
 *  entry list. */
function computeActivityMetrics(entries) {
    const todayStart = startOfDayMs(new Date())
    const weekStart = todayStart - 6 * 86400000
    const outcomeCounts = {}
    const callerCounts = new Map()
    const uniqueCustomers = new Set()
    let callsToday = 0
    let callsWeek = 0
    entries.forEach((entry) => {
        const ts = Date.parse(entry.created_at)
        if (Number.isFinite(ts)) {
            if (ts >= todayStart) callsToday += 1
            if (ts >= weekStart) callsWeek += 1
        }
        const outcome = entry.outcome || 'note'
        outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1
        if (entry.customer_num) uniqueCustomers.add(String(entry.customer_num))
        const caller = entry.created_by_name?.trim()
        if (caller) callerCounts.set(caller, (callerCounts.get(caller) || 0) + 1)
    })
    const topCaller = [...callerCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null
    const bookedRate = entries.length > 0 ? (outcomeCounts.booked || 0) / entries.length : 0
    return {
        bookedRate,
        callsToday,
        callsWeek,
        outcomeCounts,
        topCaller: topCaller ? { count: topCaller[1], name: topCaller[0] } : null,
        total: entries.length,
        uniqueCustomers: uniqueCustomers.size
    }
}

/** Activity Feed — chronological log of every team call. Clicking an
 *  entry opens the matching customer's detail (same surface Outreach +
 *  Directory use) so dispatchers can pivot from "I see Bob called ACME
 *  yesterday" to "let me log my own follow-up" without leaving the
 *  tab. */
export function CallListActivityPage({
    accentColor,
    isLoading,
    onRefresh,
    onSelectCustomer,
    recentActivity,
    selectedCustomerForActivity
}) {
    const [query, setQuery] = useState('')
    const [outcomeFilter, setOutcomeFilter] = useState('all')
    const [timeRange, setTimeRange] = useState('all')

    const timeFiltered = useMemo(() => {
        const cfg = TIME_RANGE_OPTIONS.find((o) => o.key === timeRange)
        if (!cfg?.days) return recentActivity
        const cutoff = startOfDayMs(new Date()) - (cfg.days - 1) * 86400000
        return recentActivity.filter((entry) => {
            const ts = Date.parse(entry.created_at)
            return Number.isFinite(ts) && ts >= cutoff
        })
    }, [recentActivity, timeRange])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return timeFiltered.filter((entry) => {
            if (outcomeFilter !== 'all' && entry.outcome !== outcomeFilter) return false
            if (!q) return true
            const haystack = [
                entry.customer_name,
                entry.customer_num,
                entry.contact_name,
                entry.comment,
                entry.created_by_name
            ]
                .filter(Boolean)
                .map((v) => String(v).toLowerCase())
                .join(' | ')
            return haystack.includes(q)
        })
    }, [timeFiltered, query, outcomeFilter])

    const metrics = useMemo(() => computeActivityMetrics(timeFiltered), [timeFiltered])
    const groupedFiltered = useMemo(() => groupEntriesByDay(filtered), [filtered])

    if (selectedCustomerForActivity) {
        return selectedCustomerForActivity
    }

    const showSkeleton = isLoading && recentActivity.length === 0
    const showEmpty = !showSkeleton && filtered.length === 0
    const hasOutcomeFilter = outcomeFilter !== 'all'

    return (
        <div className="flex flex-col gap-3 min-w-0">
            <ActivityMetrics
                accentColor={accentColor}
                isLoading={showSkeleton}
                metrics={metrics}
                rangeLabel={TIME_RANGE_OPTIONS.find((o) => o.key === timeRange)?.label || 'All'}
            />

            <ActivityOutcomeBreakdown
                isLoading={showSkeleton}
                metrics={metrics}
                onSelectOutcome={(key) => setOutcomeFilter((cur) => (cur === key ? 'all' : key))}
                selectedOutcome={outcomeFilter}
            />

            <ActivityToolbar
                hasOutcomeFilter={hasOutcomeFilter}
                isLoading={showSkeleton}
                onClearOutcome={() => setOutcomeFilter('all')}
                onQueryChange={setQuery}
                onRefresh={onRefresh}
                onTimeRangeChange={setTimeRange}
                outcomeFilter={outcomeFilter}
                query={query}
                shown={filtered.length}
                timeRange={timeRange}
                total={recentActivity.length}
            />

            {showSkeleton ? (
                <ActivityListSkeleton />
            ) : showEmpty ? (
                <ActivityEmpty hasFilters={hasOutcomeFilter || !!query.trim()} totalLoaded={recentActivity.length} />
            ) : (
                <ActivityGroupedList groups={groupedFiltered} onSelectCustomer={onSelectCustomer} />
            )}
        </div>
    )
}

/* ─── KPI strip ────────────────────────────────────────────────── */

function ActivityMetrics({ accentColor, isLoading, metrics, rangeLabel }) {
    if (isLoading) {
        return (
            <div className="rounded-lg overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-bg-primary border border-border-light">
                {Array.from({ length: 5 }).map((_, i) => (
                    <MetricSkel key={i} />
                ))}
            </div>
        )
    }
    const bookedPct = Math.round((metrics.bookedRate || 0) * 100)
    return (
        <div className="rounded-lg overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-bg-primary border border-border-light">
            <MetricCell label="Calls today" value={metrics.callsToday} />
            <MetricCell label="Calls this week" value={metrics.callsWeek} sub={`Range · ${rangeLabel}`} />
            <MetricCell
                label="Booked"
                sub={metrics.total > 0 ? `${bookedPct}% of activity` : 'No activity'}
                value={metrics.outcomeCounts.booked || 0}
            />
            <MetricCell label="Customers contacted" sub="Unique customer #" value={metrics.uniqueCustomers} />
            <MetricCell
                label="Top caller"
                sub={
                    metrics.topCaller
                        ? `${metrics.topCaller.count} call${metrics.topCaller.count === 1 ? '' : 's'}`
                        : '—'
                }
                value={metrics.topCaller ? metrics.topCaller.name : '—'}
                valueText
            />
        </div>
    )
}

function MetricCell({ label, sub, value, valueText }) {
    return (
        <div className="px-3 py-2.5 flex flex-col gap-0.5 bg-bg-primary border-r last:border-r-0 border-b sm:border-b-0 border-border-light">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-text-tertiary">{label}</span>
            <span
                className={`leading-tight font-semibold tabular-nums text-text-primary ${valueText ? 'text-[14px] truncate' : 'text-[20px] font-mono'}`}
                title={valueText ? String(value) : undefined}
            >
                {value}
            </span>
            {sub && <span className="text-[10.5px] text-text-tertiary">{sub}</span>}
        </div>
    )
}

function MetricSkel() {
    return (
        <div className="px-3 py-2.5 flex flex-col gap-1 border-r last:border-r-0 border-b sm:border-b-0 border-border-light">
            <div className="h-2 w-16 rounded bg-bg-tertiary animate-pulse" />
            <div className="h-5 w-12 rounded bg-bg-tertiary animate-pulse" />
            <div className="h-2 w-20 rounded bg-bg-tertiary animate-pulse" />
        </div>
    )
}

/* ─── Outcome breakdown bar (stacked, clickable) ────────────────── */

function ActivityOutcomeBreakdown({ isLoading, metrics, onSelectOutcome, selectedOutcome }) {
    if (isLoading) {
        return (
            <div className="rounded-lg p-3 bg-bg-primary border border-border-light">
                <div className="h-2.5 rounded bg-bg-tertiary animate-pulse" />
            </div>
        )
    }
    if (!metrics.total) return null
    const orderedKeys = ['booked', 'will_book_again', 'note', 'no_answer', 'not_interested']
    return (
        <div className="rounded-lg p-3 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-text-tertiary">
                    Outcome mix
                </span>
                <span className="text-[10.5px] text-text-tertiary tabular-nums">
                    {metrics.total} entr{metrics.total === 1 ? 'y' : 'ies'}
                </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-bg-tertiary">
                {orderedKeys.map((key) => {
                    const count = metrics.outcomeCounts[key] || 0
                    if (count === 0) return null
                    const pct = (count / metrics.total) * 100
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onSelectOutcome(key)}
                            title={`${CALL_OUTCOME_LABELS[key]} · ${count} (${Math.round(pct)}%)`}
                            className="h-full border-none cursor-pointer transition-opacity"
                            style={{
                                background: CALL_OUTCOME_COLORS[key],
                                opacity: selectedOutcome === 'all' || selectedOutcome === key ? 1 : 0.35,
                                width: `${pct}%`
                            }}
                            aria-label={`${CALL_OUTCOME_LABELS[key]} ${count} calls`}
                        />
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {orderedKeys.map((key) => {
                    const count = metrics.outcomeCounts[key] || 0
                    if (count === 0) return null
                    const isActive = selectedOutcome === key
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onSelectOutcome(key)}
                            className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer bg-transparent border-none p-0"
                            style={{
                                color: isActive ? CALL_OUTCOME_COLORS[key] : 'var(--text-secondary)',
                                fontWeight: isActive ? 700 : 500
                            }}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ background: CALL_OUTCOME_COLORS[key] }} />
                            <span>{CALL_OUTCOME_LABELS[key]}</span>
                            <span className="tabular-nums text-text-tertiary">{count}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/* ─── Toolbar ──────────────────────────────────────────────────── */

function ActivityToolbar({
    hasOutcomeFilter,
    isLoading,
    onClearOutcome,
    onQueryChange,
    onRefresh,
    onTimeRangeChange,
    outcomeFilter,
    query,
    shown,
    timeRange,
    total
}) {
    return (
        <div
            className="rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 flex-1 min-w-[200px] bg-bg-secondary border border-border-light">
                <i className="fas fa-magnifying-glass text-[11px] text-text-tertiary" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search by customer, contact, note, or who called…"
                    disabled={isLoading}
                    className="bg-transparent outline-none border-none text-[12.5px] w-full text-text-primary disabled:opacity-60"
                />
            </div>
            <div className="inline-flex rounded-md overflow-hidden border border-border-light">
                {TIME_RANGE_OPTIONS.map((opt) => {
                    const active = opt.key === timeRange
                    return (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => onTimeRangeChange(opt.key)}
                            disabled={isLoading}
                            className="text-[11.5px] font-semibold px-2.5 py-1.5 border-none cursor-pointer disabled:opacity-60 transition-colors"
                            style={{
                                background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                                color: active ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>
            {hasOutcomeFilter && (
                <button
                    type="button"
                    onClick={onClearOutcome}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer"
                    style={{
                        background: `${CALL_OUTCOME_COLORS[outcomeFilter]}1A`,
                        color: CALL_OUTCOME_COLORS[outcomeFilter]
                    }}
                    title="Clear outcome filter"
                >
                    <i className={`fas ${ICON_BY_OUTCOME[outcomeFilter] || 'fa-filter'} text-[10px]`} />
                    {CALL_OUTCOME_LABELS[outcomeFilter]}
                    <i className="fas fa-xmark text-[10px] opacity-80" />
                </button>
            )}
            <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer bg-bg-tertiary text-text-secondary"
                title="Reload activity feed"
            >
                <i className="fas fa-rotate text-[10px]" />
                Refresh
            </button>
            <span className="text-[11.5px] text-text-tertiary tabular-nums ml-auto">
                {isLoading ? (
                    <span className="italic">Loading…</span>
                ) : (
                    <>
                        {shown} of {total}
                    </>
                )}
            </span>
        </div>
    )
}

/* ─── Empty state ──────────────────────────────────────────────── */

function ActivityEmpty({ hasFilters, totalLoaded }) {
    return (
        <div className="rounded-lg p-8 text-center bg-bg-primary border border-border-light flex flex-col items-center gap-2">
            <i className="fas fa-phone-volume text-[22px] text-text-tertiary" />
            <div className="text-[13px] font-semibold text-text-primary">
                {totalLoaded === 0 ? 'No team calls logged yet' : hasFilters ? 'No matches' : 'Nothing in this range'}
            </div>
            <div className="text-[11.5px] text-text-secondary max-w-[420px]">
                {totalLoaded === 0
                    ? 'Once anyone on the team logs a call from the Outreach or Directory tab, it lands here in chronological order.'
                    : hasFilters
                      ? 'Adjust the search, outcome filter, or time range to see more activity.'
                      : 'Try widening the time range to see older calls.'}
            </div>
        </div>
    )
}

/* ─── Date-grouped timeline ────────────────────────────────────── */

const GROUP_LABELS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This week' },
    { key: 'earlier', label: 'Earlier' }
]

function ActivityGroupedList({ groups, onSelectCustomer }) {
    const visibleGroups = GROUP_LABELS.filter(({ key }) => groups[key] && groups[key].length > 0)
    if (visibleGroups.length === 0) return null
    return (
        <div className="flex flex-col gap-2.5">
            {visibleGroups.map(({ key, label }) => (
                <ActivityGroupSection
                    key={key}
                    entries={groups[key]}
                    label={label}
                    onSelectCustomer={onSelectCustomer}
                />
            ))}
        </div>
    )
}

function ActivityGroupSection({ entries, label, onSelectCustomer }) {
    return (
        <section className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            <header className="px-3 py-1.5 flex items-baseline justify-between bg-bg-secondary border-b border-border-light">
                <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-text-secondary">{label}</span>
                <span className="text-[10.5px] text-text-tertiary tabular-nums">
                    {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                </span>
            </header>
            <ol className="flex flex-col">
                {entries.map((entry, idx) => (
                    <li key={entry.id} className={idx === entries.length - 1 ? '' : 'border-b border-border-light'}>
                        <ActivityRow entry={entry} onSelectCustomer={onSelectCustomer} />
                    </li>
                ))}
            </ol>
        </section>
    )
}

function ActivityRow({ entry, onSelectCustomer }) {
    const tone = CALL_OUTCOME_COLORS[entry.outcome] || '#64748b'
    const icon = ICON_BY_OUTCOME[entry.outcome] || 'fa-phone'
    return (
        <button
            type="button"
            onClick={() => onSelectCustomer && onSelectCustomer(entry.customer_num)}
            disabled={!entry.customer_num || !onSelectCustomer}
            className="w-full text-left px-3 py-2.5 flex items-start gap-3 cursor-pointer disabled:cursor-default border-none bg-transparent hover:bg-bg-secondary transition-colors"
            style={{ borderLeft: `3px solid ${tone}` }}
        >
            <span
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md"
                style={{ background: `${tone}22`, color: tone }}
                title={CALL_OUTCOME_LABELS[entry.outcome] || entry.outcome}
                aria-hidden="true"
            >
                <i className={`fas ${icon} text-[12px]`} />
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-[13px] text-text-primary truncate">
                        {entry.customer_name || `Customer ${entry.customer_num}`}
                    </span>
                    <span className="text-[10.5px] text-text-tertiary tabular-nums">#{entry.customer_num}</span>
                    {entry.contact_name && (
                        <span className="text-[10.5px] text-text-tertiary truncate">· {entry.contact_name}</span>
                    )}
                </div>
                {entry.comment && (
                    <div className="text-[12px] mt-1 whitespace-pre-wrap text-text-secondary line-clamp-3">
                        {entry.comment}
                    </div>
                )}
                {entry.created_by_name && (
                    <span
                        className="inline-flex items-center gap-1 mt-1.5 rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        title={`Logged by ${entry.created_by_name}`}
                    >
                        <span
                            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white"
                            style={{ background: tone }}
                        >
                            {initialsOf(entry.created_by_name)}
                        </span>
                        {entry.created_by_name}
                    </span>
                )}
            </div>
            <span
                className="shrink-0 text-[10.5px] text-text-tertiary tabular-nums"
                title={DateUtility.formatDateTime(entry.created_at)}
            >
                {formatRelativeShort(entry.created_at)}
            </span>
        </button>
    )
}

const SkelBar = ({ className = '', style }) => (
    <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
)

function ActivityListSkeleton() {
    return (
        <div className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="px-4 py-2.5 flex items-start gap-3"
                    style={{ borderBottom: i === 7 ? 'none' : '1px solid var(--border-light)' }}
                >
                    <SkelBar className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <SkelBar className="h-3 w-1/2" />
                        <SkelBar className="h-2.5 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    )
}
