import React, { useMemo, useState } from 'react'

import {
    formatCrmPhone,
    formatRelativeDays,
    matchesCrmRosterQuery,
    sortCrmRoster,
    wasRecentlyCalled
} from '../../../../utils/CrmRosterUtility'
import { useCrmViewMode } from '../../../hooks/useCrmViewMode'
import Badge from '../../common/Badge'
import { CrmViewToggle } from '../CrmViewToggle'
import { FilterStrip, ListOrDetailPane } from './crmShared'

/** Outreach Queue — dormant customers not in cooldown, longest dormant
 *  first. Selecting a customer hides the entire list (and the filter
 *  strip) so the detail owns the page. */
export function CrmOutreachPage({
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
    selectedAccountId
}) {
    const [query, setQuery] = useState('')
    const [sortKey, setSortKey] = useState('oldest')
    const [worklistMode, setWorklistMode] = useState('dormant')
    const [viewMode, setViewMode] = useCrmViewMode('outreach', 'list')

    // Outreach only surfaces the dormant pool (no pour in past 30 days).
    // The roster now ships active customers too — for the Directory — so
    // we strip them out here before applying the recent-call cooldown.
    // Prospects are surfaced in their own worklist mode to avoid double-listing.
    const dormant = useMemo(
        () =>
            roster.filter(
                (row) => (row.pouring_status || 'dormant') === 'dormant' && row.lifecycle_stage !== 'prospect'
            ),
        [roster]
    )
    const fresh = useMemo(() => dormant.filter((row) => !wasRecentlyCalled(row.last_call_at)), [dormant])
    const prospects = useMemo(() => roster.filter((row) => row.lifecycle_stage === 'prospect'), [roster])
    const activePool = worklistMode === 'prospects' ? prospects : fresh
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return sortCrmRoster(
            activePool.filter((row) => matchesCrmRosterQuery(row, q)),
            sortKey
        )
    }, [activePool, query, sortKey])

    const selectedRow = useMemo(
        () => roster.find((row) => row.account_id === selectedAccountId) || null,
        [roster, selectedAccountId]
    )

    // ── Table columns (list view) ─────────────────────────────────────────
    const outreachColumns = useMemo(
        () => [
            {
                key: 'customer_name',
                label: 'Name',
                render: (row) => (
                    <span className="font-semibold text-text-primary">
                        {row.customer_name || `Customer ${row.customer_num}`}
                    </span>
                )
            },
            {
                key: 'pouring_status',
                label: 'Status',
                render: (row) => (
                    <Badge size="xs" tone={OUTREACH_STATUS_TONE[row.pouring_status] ?? 'neutral'}>
                        {row.pouring_status || 'unknown'}
                    </Badge>
                )
            },
            {
                align: 'right',
                key: 'days_since_last_pour',
                label: 'Days dormant',
                mono: true,
                render: (row) => {
                    const days = row.days_since_last_pour
                    if (days == null || !Number.isFinite(days)) return <span className="text-text-tertiary">—</span>
                    const color = days >= 180 ? '#dc2626' : days >= 90 ? '#d97706' : undefined
                    return <span style={color ? { color } : undefined}>{days}d</span>
                }
            },
            {
                align: 'right',
                key: 'last_call_at',
                label: 'Last call',
                mono: true,
                render: (row) => {
                    const relative = formatRelativeDays(row.last_call_at)
                    return relative ? relative : <span className="text-text-tertiary">—</span>
                }
            },
            {
                key: 'phone',
                label: 'Phone',
                mono: true,
                render: (row) => {
                    const formatted = formatCrmPhone(row.phone)
                    return formatted ? formatted : <span className="text-text-tertiary">—</span>
                }
            }
        ],
        []
    )

    return (
        <div className="flex flex-col gap-3 min-w-0">
            {!selectedRow && (
                <>
                    <div className="flex items-center gap-2 flex-wrap">
                        <WorklistToggle
                            accentColor={accentColor}
                            activeMode={worklistMode}
                            onSelect={setWorklistMode}
                        />
                        <CrmViewToggle accentColor={accentColor} onChange={setViewMode} value={viewMode} />
                    </div>
                    <FilterStrip
                        isLoading={isLoading && roster.length === 0}
                        onChangeQuery={setQuery}
                        onChangeSort={setSortKey}
                        query={query}
                        sortKey={sortKey}
                        totalShown={filtered.length}
                        totalUnfiltered={activePool.length}
                    />
                </>
            )}
            <ListOrDetailPane
                accentColor={accentColor}
                colocationMap={colocationMap}
                columns={outreachColumns}
                contactsByCustomer={contactsByCustomer}
                deleteContact={deleteContact}
                deleteEntry={deleteEntry}
                filtered={filtered}
                historyByCustomer={historyByCustomer}
                isLoading={isLoading && roster.length === 0}
                listEmptyMessage={
                    activePool.length === 0
                        ? worklistMode === 'prospects'
                            ? 'No prospects in the roster yet.'
                            : 'No dormant customers waiting on a call right now.'
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
                viewMode={viewMode}
            />
        </div>
    )
}

/** Segmented chip toggle: Dormant (default) vs Prospects. */
function WorklistToggle({ accentColor, activeMode, onSelect }) {
    const modes = [
        { id: 'dormant', label: 'Dormant' },
        { id: 'prospects', label: 'Prospects' }
    ]
    return (
        <div className="inline-flex rounded-md overflow-hidden border border-border-light self-start">
            {modes.map(({ id, label }) => {
                const active = activeMode === id
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className="text-[11.5px] font-semibold px-3 py-1.5 border-none cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                        style={{
                            background: active ? accentColor : 'var(--bg-secondary)',
                            color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                        aria-pressed={active}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}

// ─── Shared table cell atoms ──────────────────────────────────────────────────

/** pouring_status → Badge tone for the Outreach Status column. */
const OUTREACH_STATUS_TONE = { active: 'success', dormant: 'warning', never: 'neutral' }
