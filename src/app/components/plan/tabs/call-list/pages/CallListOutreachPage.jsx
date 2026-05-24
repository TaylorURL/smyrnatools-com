import React, { useMemo, useState } from 'react'

import { matchesCallListQuery, sortCallListRoster, wasRecentlyCalled } from '../../../../../../utils/CallListUtility'
import { FilterStrip, ListOrDetailPane } from './callListShared'

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
