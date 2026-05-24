/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import { matchesCallListQuery, sortCallListRoster, wasRecentlyCalled } from '../../../../../../utils/CallListUtility'
import { FilterStrip, ListOrDetailPane } from './callListShared'

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
