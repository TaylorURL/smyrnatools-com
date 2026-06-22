/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { CRM_ROSTER_SORT_OPTIONS, RECENT_CALL_COOLDOWN_DAYS } from '../../../../utils/CrmRosterUtility'
import {
    CrmCustomerCardRow,
    CrmCustomerDetail,
    CrmCustomerDetailSkeleton,
    CrmCustomerListSkeleton
} from '../CrmCustomerCard'
import { CrmTable } from '../CrmTable'

/** Shared filter strip — search input + sort dropdown. Mirrors the
 *  Statistics tab's controls strip so both tabs read the same. Inputs
 *  are disabled while the upstream roster is loading so users can't
 *  type into stale state. */
export function FilterStrip({ isLoading, onChangeQuery, onChangeSort, query, sortKey, totalShown, totalUnfiltered }) {
    return (
        <div
            className="rounded-md px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 flex-1 min-w-[200px] bg-bg-secondary border border-border-light transition-colors duration-150 hover:border-border-medium focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]">
                <i className="fas fa-magnifying-glass text-[11px] text-text-tertiary" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => onChangeQuery(e.target.value)}
                    placeholder="Search customers, contacts, phone…"
                    disabled={isLoading}
                    aria-label="Search call list"
                    className="bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-accent/30 border-none text-[12.5px] w-full text-text-primary placeholder:text-text-tertiary disabled:opacity-60 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                    <button type="button"
                        onClick={() => onChangeQuery('')}
                        className="border-none bg-transparent cursor-pointer text-text-tertiary hover:text-text-primary active:scale-[0.92] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                        aria-label="Clear search"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                )}
            </div>
            <div className="relative">
                <select
                    value={sortKey}
                    onChange={(e) => onChangeSort(e.target.value)}
                    disabled={isLoading}
                    className="appearance-none rounded-md pl-2.5 pr-7 py-1.5 text-[12.5px] cursor-pointer outline-none bg-bg-secondary border border-border-light text-text-primary disabled:opacity-60 transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    title="Sort by"
                    aria-label="Sort by"
                >
                    {CRM_ROSTER_SORT_OPTIONS.map(({ key, label }) => (
                        <option key={key} value={key}>
                            Sort: {label}
                        </option>
                    ))}
                </select>
                <i
                    aria-hidden="true"
                    className="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-text-tertiary"
                />
            </div>
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
 *  displays stale rows for the wrong filter window.
 *
 *  `viewMode` ('list'|'cards') controls the list presentation when no row is
 *  selected. 'list' renders a `CrmTable` (default); 'cards' renders the
 *  existing `CrmCustomerCardRow` grid. `columns` is required when
 *  `viewMode === 'list'` — passed straight through to `CrmTable`. */
export function ListOrDetailPane({
    accentColor,
    colocationMap,
    columns,
    contactsByCustomer,
    cooldownStartIndex,
    deleteContact,
    deleteEntry,
    filtered,
    historyByCustomer,
    interactions,
    isLoading,
    listEmptyMessage,
    loadContacts,
    loadHistory,
    loadingContactsFor,
    loadingHistoryFor,
    logCall,
    onArchiveAccount,
    onClearSelection,
    onLogInteraction,
    onSelectCustomer,
    opportunitiesSlot,
    plantNameByCode,
    rosterError,
    saveContact,
    savingContactFor,
    savingFor,
    selectedRow,
    viewMode = 'list'
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
                    <CrmCustomerDetailSkeleton />
                </>
            )
        }
        return (
            <CrmCustomerDetail
                accentColor={accentColor}
                colocationMap={colocationMap}
                contacts={contactsByCustomer?.[selectedRow.customer_num] || null}
                history={historyByCustomer[selectedRow.customer_num] || null}
                interactions={interactions}
                isLoadingContacts={loadingContactsFor?.has(selectedRow.customer_num) || false}
                isLoadingHistory={isHistoryLoading}
                isSaving={savingFor.has(selectedRow.customer_num)}
                isSavingContact={savingContactFor?.has(selectedRow.customer_num) || false}
                onClose={onClearSelection}
                onDeleteContact={deleteContact}
                onDeleteEntry={deleteEntry}
                onArchiveAccount={onArchiveAccount}
                onLoadContacts={loadContacts}
                onLoadHistory={loadHistory}
                onLog={logCall}
                onLogInteraction={onLogInteraction}
                onSaveContact={saveContact}
                opportunitiesSlot={opportunitiesSlot}
                plantNameByCode={plantNameByCode}
                row={selectedRow}
            />
        )
    }

    if (isLoading) return <CrmCustomerListSkeleton />
    if (rosterError) {
        return (
            <div className="rounded-md p-3 text-[12px] bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.25)] text-text-primary">
                {rosterError}
            </div>
        )
    }
    if (filtered.length === 0) {
        return (
            <div className="rounded-md p-6 text-center text-[12.5px] bg-bg-primary border border-border-light text-text-secondary">
                {listEmptyMessage}
            </div>
        )
    }

    if (viewMode === 'list' && columns) {
        return (
            <CrmTable
                columns={columns}
                emptyMessage={listEmptyMessage}
                onRowClick={(row) => onSelectCustomer(row.account_id)}
                rowKey={(row) => row.account_id}
                rows={filtered}
            />
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filtered.map((row, idx) => (
                <React.Fragment key={row.account_id}>
                    {idx === cooldownStartIndex && cooldownStartIndex > 0 && (
                        <div className="col-span-full px-2 pt-1 text-[10px] font-bold uppercase tracking-[0.08em] flex items-center gap-2 text-text-tertiary">
                            <i className="fas fa-hourglass-half text-[9px]" />
                            Called in last {RECENT_CALL_COOLDOWN_DAYS} days
                        </div>
                    )}
                    <CrmCustomerCardRow onSelect={onSelectCustomer} row={row} />
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
            <button type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
            >
                <i className="fas fa-arrow-left text-[10px]" />
                Back to list
            </button>
        </div>
    )
}
