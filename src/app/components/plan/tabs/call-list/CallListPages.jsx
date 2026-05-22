/* eslint-disable react/forbid-dom-props */
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
            <div className="rounded-lg p-3 text-[12px] bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.25)] text-red-700">
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

/** Activity Feed — chronological log of every team call. Clicking an
 *  entry opens the matching customer's detail (same surface Outreach +
 *  Directory use) so dispatchers can pivot from "I see Bob called ACME
 *  yesterday" to "let me log my own follow-up" without leaving the
 *  tab. The skeleton matches the entry shape so the feed doesn't
 *  collapse on refresh. */
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
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return recentActivity.filter((entry) => {
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
    }, [recentActivity, query, outcomeFilter])

    // If parent has resolved a customer for activity click-through, hand
    // off to the detail surface. The view-level pages pick it up via
    // `onSelectCustomer` and render the appropriate page detail.
    if (selectedCustomerForActivity) {
        return selectedCustomerForActivity
    }

    return (
        <div className="flex flex-col gap-3 min-w-0">
            <div
                className="rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-bg-primary border border-border-light"
                style={{ boxShadow: 'var(--shadow-sm)' }}
            >
                <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 flex-1 min-w-[200px] bg-bg-secondary border border-border-light">
                    <i className="fas fa-magnifying-glass text-[11px] text-text-tertiary" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by customer, contact, note, or who called…"
                        disabled={isLoading && recentActivity.length === 0}
                        className="bg-transparent outline-none border-none text-[12.5px] w-full text-text-primary disabled:opacity-60"
                    />
                </div>
                <select
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    disabled={isLoading && recentActivity.length === 0}
                    className="rounded-md px-2.5 py-1.5 text-[12.5px] cursor-pointer outline-none bg-bg-secondary border border-border-light text-text-primary disabled:opacity-60"
                >
                    <option value="all">All outcomes</option>
                    {Object.entries(CALL_OUTCOME_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                            {label}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer bg-bg-tertiary text-text-secondary"
                    title="Reload activity feed"
                >
                    <i className="fas fa-rotate text-[10px]" />
                    Refresh
                </button>
                <span className="text-[11.5px] text-text-tertiary tabular-nums">
                    {isLoading && recentActivity.length === 0 ? (
                        <span className="italic">Loading…</span>
                    ) : (
                        <>
                            {filtered.length} of {recentActivity.length}
                        </>
                    )}
                </span>
            </div>

            {isLoading && recentActivity.length === 0 ? (
                <ActivityListSkeleton />
            ) : filtered.length === 0 ? (
                <div className="rounded-lg p-6 text-center text-[12.5px] bg-bg-primary border border-border-light text-text-secondary">
                    {recentActivity.length === 0
                        ? 'No team calls logged yet.'
                        : 'No entries match the current filters.'}
                </div>
            ) : (
                <ActivityList accentColor={accentColor} entries={filtered} onSelectCustomer={onSelectCustomer} />
            )}
        </div>
    )
}

function ActivityList({ entries, onSelectCustomer }) {
    return (
        <div className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            <ol className="flex flex-col">
                {entries.map((entry, idx) => {
                    const tone = CALL_OUTCOME_COLORS[entry.outcome] || '#64748b'
                    return (
                        <li key={entry.id} className="border-b border-border-light last:border-b-0">
                            <button
                                type="button"
                                onClick={() => onSelectCustomer && onSelectCustomer(entry.customer_num)}
                                disabled={!entry.customer_num || !onSelectCustomer}
                                className="w-full text-left px-4 py-2.5 flex items-start gap-3 cursor-pointer disabled:cursor-default border-none bg-transparent hover:bg-bg-secondary transition-colors"
                                style={{
                                    borderBottom: idx === entries.length - 1 ? 'none' : undefined
                                }}
                            >
                                <span
                                    className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-[11px] uppercase"
                                    style={{ background: `${tone}29`, color: tone }}
                                    title={CALL_OUTCOME_LABELS[entry.outcome]}
                                >
                                    {(CALL_OUTCOME_LABELS[entry.outcome] || '?').charAt(0)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="font-semibold text-[13px] text-text-primary truncate">
                                            {entry.customer_name || `Customer ${entry.customer_num}`}
                                        </span>
                                        <span className="text-[10.5px] text-text-tertiary">#{entry.customer_num}</span>
                                        <span
                                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider text-[9.5px]"
                                            style={{ background: `${tone}22`, color: tone }}
                                        >
                                            {CALL_OUTCOME_LABELS[entry.outcome] || entry.outcome}
                                        </span>
                                    </div>
                                    <div className="text-[11px] mt-0.5 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-text-tertiary">
                                        <span>{DateUtility.formatDateTime(entry.created_at)}</span>
                                        {entry.created_by_name && (
                                            <span className="text-text-secondary font-semibold">
                                                · {entry.created_by_name}
                                            </span>
                                        )}
                                        {entry.contact_name && <span>· {entry.contact_name}</span>}
                                    </div>
                                    {entry.comment && (
                                        <div className="text-[12px] mt-1 whitespace-pre-wrap text-text-secondary">
                                            {entry.comment}
                                        </div>
                                    )}
                                </div>
                            </button>
                        </li>
                    )
                })}
            </ol>
        </div>
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
