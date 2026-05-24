/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { CALL_LIST_SORT_OPTIONS, RECENT_CALL_COOLDOWN_DAYS } from '../../../../../../utils/CallListUtility'
import {
    CallListCustomerCardRow,
    CallListCustomerDetail,
    CallListCustomerDetailSkeleton,
    CallListCustomerListSkeleton
} from '../CallListCustomerCard'

/** Shared filter strip — search input + sort dropdown. Mirrors the
 *  Statistics tab's controls strip so both tabs read the same. Inputs
 *  are disabled while the upstream roster is loading so users can't
 *  type into stale state. */
export function FilterStrip({ isLoading, onChangeQuery, onChangeSort, query, sortKey, totalShown, totalUnfiltered }) {
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
export function ListOrDetailPane({
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
