/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
    formatCrmPhone,
    formatRelativeDays,
    matchesCrmRosterQuery,
    sortCrmRoster,
    wasRecentlyCalled
} from '../../../../utils/CrmRosterUtility'
import DateUtility from '../../../../utils/DateUtility'
import { useCrmViewMode } from '../../../hooks/useCrmViewMode'
import { useOpportunities } from '../../../hooks/useOpportunities'
import Badge from '../../common/Badge'
import { CrmInlineAddForm } from '../CrmInlineAddForm'
import { CrmViewToggle } from '../CrmViewToggle'
import { BulkAssignSalesRepsModal } from '../customer-card/BulkAssignSalesRepsModal'
import { FilterStrip, ListOrDetailPane } from './crmShared'

/** Directory — every customer that's poured in the last year, including
 *  both active accounts and dormant ones. Same list/detail toggle as
 *  Outreach but no dormancy filter. Cooldown tier (recently-called rows)
 *  sits behind a divider. */
export function CrmAccountsPage({
    accountInteractionsByAccount,
    accentColor,
    contactsByCustomer,
    deleteContact,
    deleteEntry,
    historyByCustomer,
    isLoading,
    loadAccountInteractions,
    loadContacts,
    loadHistory,
    loadingContactsFor,
    loadingHistoryFor,
    logCall,
    logInteraction,
    onAddProspect,
    onArchiveAccount,
    onClearSelectedCustomer,
    onSelectCustomer,
    roster,
    rosterError,
    saveContact,
    savingContactFor,
    savingFor,
    selectedAccountId
}) {
    const [query, setQuery] = useState('')
    const [sortKey, setSortKey] = useState('oldest')
    const [statusFilter, setStatusFilter] = useState('all')
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
    const [viewMode, setViewMode] = useCrmViewMode('accounts', 'list')

    // Archived prospects (lifecycle_stage 'lost') drop out of the active
    // directory — they stay in the database but no longer clutter the list.
    const activeRoster = useMemo(() => roster.filter((row) => row.lifecycle_stage !== 'lost'), [roster])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return sortCrmRoster(
            activeRoster.filter((row) => {
                if (!matchesCrmRosterQuery(row, q)) return false
                if (statusFilter === 'active' && row.pouring_status !== 'active') return false
                if (statusFilter === 'dormant' && row.pouring_status === 'active') return false
                return true
            }),
            sortKey
        )
    }, [activeRoster, query, sortKey, statusFilter])

    const cooldownStartIndex = useMemo(
        () => filtered.findIndex((row) => wasRecentlyCalled(row.last_call_at)),
        [filtered]
    )

    const selectedRow = useMemo(
        () => roster.find((row) => row.account_id === selectedAccountId) || null,
        [roster, selectedAccountId]
    )

    const {
        isLoading: isLoadingOpps,
        opportunities,
        save: saveOpportunity
    } = useOpportunities(selectedAccountId ? { accountId: selectedAccountId } : undefined)

    // Lazy-load interactions when a customer with a known account_id is selected.
    useEffect(() => {
        if (selectedAccountId) loadAccountInteractions?.(selectedAccountId)
    }, [selectedAccountId, loadAccountInteractions])

    // ── Opportunities tab slot ────────────────────────────────────────────
    // Composed here so CrmAccountsPage owns the data; threaded into
    // AccountDetailBody via CrmCustomerDetail's opportunitiesSlot prop.
    const opportunitiesSlot = selectedAccountId ? (
        <div className="flex flex-col gap-2">
            {isLoadingOpps ? (
                <div className="text-[12px] text-text-tertiary animate-pulse">Loading…</div>
            ) : opportunities.length === 0 ? (
                <p className="text-[12px] text-text-tertiary">No opportunities yet.</p>
            ) : (
                opportunities.map((opp) => (
                    <div
                        key={opp.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border-light bg-bg-primary px-3 py-2"
                    >
                        <span className="text-[12.5px] text-text-primary font-medium truncate min-w-0">
                            {opp.title}
                        </span>
                        <Badge tone={STAGE_TONE[opp.stage] ?? 'neutral'} size="xs">
                            {opp.stage}
                        </Badge>
                    </div>
                ))
            )}
            <CrmInlineAddForm
                accentColor={accentColor}
                fieldId="add-opp-title"
                fieldLabel="Title"
                placeholder="e.g. Summer repave contract"
                toggleLabel="Add opportunity"
                onSubmit={(title) => saveOpportunity({ accountId: selectedAccountId, title })}
            />
        </div>
    ) : null

    // ── Interactions section ──────────────────────────────────────────────
    // The Accounts page wires CRM account interactions (logInteraction /
    // InteractionTimeline) into AccountDetailBody's Activity tab via the
    // interactions + onLogInteraction props on CrmCustomerDetail (passed
    // through crmShared's ListOrDetailPane). However CrmCustomerDetail
    // currently delegates its Activity tab body entirely to AccountDetailBody
    // which already owns LogInteractionComposer + InteractionTimeline.
    // We supply the interactions array and the submit handler through the
    // detail's prop chain via a wrapper below.

    // ── Table columns (list view) ─────────────────────────────────────────
    const accountsColumns = useMemo(
        () => [
            {
                key: 'customer_name',
                label: 'Name',
                render: (row) => (
                    <span className="flex items-center gap-2 min-w-0">
                        {row.lifecycle_stage && (
                            <Badge tone={LIFECYCLE_TONE[row.lifecycle_stage] ?? 'neutral'} size="xs">
                                {row.lifecycle_stage}
                            </Badge>
                        )}
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="font-semibold text-text-primary truncate">
                                {row.customer_name || `Customer ${row.customer_num}`}
                            </span>
                            {row.customer_name && row.customer_num && (
                                <span className="text-[10.5px] text-text-tertiary tabular-nums truncate">
                                    #{row.customer_num}
                                </span>
                            )}
                        </span>
                    </span>
                )
            },
            {
                key: 'sales_rep_user_id',
                label: 'Rep',
                render: (row) =>
                    row.sales_rep_user_id ? (
                        <Badge tone="neutral" size="xs">
                            Assigned
                        </Badge>
                    ) : (
                        <span className="text-text-tertiary">—</span>
                    )
            },
            {
                key: 'plant_codes',
                label: 'Plants',
                render: (row) =>
                    row.plant_codes?.length ? (
                        <span className="text-text-secondary">{row.plant_codes.join(', ')}</span>
                    ) : (
                        <span className="text-text-tertiary">—</span>
                    )
            },
            {
                key: 'pouring_status',
                label: 'Status',
                render: (row) => (
                    <Badge size="xs" tone={POURING_STATUS_TONE[row.pouring_status] ?? 'neutral'}>
                        {row.pouring_status || 'unknown'}
                    </Badge>
                )
            },
            {
                align: 'right',
                key: 'pour_days_last_year',
                label: 'Pours/yr',
                mono: true,
                render: (row) => row.pour_days_last_year ?? 0
            },
            {
                align: 'right',
                key: 'call_count_last_30',
                label: 'Calls 30d',
                mono: true,
                render: (row) => row.call_count_last_30 ?? 0
            },
            {
                align: 'right',
                key: 'last_pour_date',
                label: 'Last pour',
                mono: true,
                render: (row) =>
                    row.last_pour_date ? (
                        DateUtility.formatDate(row.last_pour_date)
                    ) : (
                        <span className="text-text-tertiary">—</span>
                    )
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
            {isBulkModalOpen && (
                <BulkAssignSalesRepsModal
                    accentColor={accentColor}
                    onClose={() => setIsBulkModalOpen(false)}
                    onDone={() => setIsBulkModalOpen(false)}
                />
            )}
            {!selectedRow && (
                <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <FilterStrip
                            isLoading={isLoading && roster.length === 0}
                            onChangeQuery={setQuery}
                            onChangeSort={setSortKey}
                            query={query}
                            sortKey={sortKey}
                            totalShown={filtered.length}
                            totalUnfiltered={activeRoster.length}
                        />
                        <div className="flex items-center gap-2 shrink-0">
                            <CrmViewToggle accentColor={accentColor} onChange={setViewMode} value={viewMode} />
                            <button type="button"
                                onClick={() => setIsBulkModalOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold border border-border-light bg-bg-secondary text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:text-text-primary hover:border-border-medium"
                            >
                                <i className="fas fa-user-tag text-[10px]" aria-hidden="true" />
                                Bulk assign reps
                            </button>
                        </div>
                    </div>
                    <StatusFilterRow activeKey={statusFilter} onSelect={setStatusFilter} roster={activeRoster} />
                    <CrmInlineAddForm
                        accentColor={accentColor}
                        fieldId="add-prospect-name"
                        fieldLabel="Company name"
                        placeholder="e.g. Acme Paving"
                        toggleLabel="Add prospect"
                        onSubmit={onAddProspect}
                    />
                </>
            )}

            {/* Interactions and Opportunities are threaded in as slots so they
                render inside AccountDetailBody's tab strip when a customer is
                selected, not as an undifferentiated scroll below the card. */}
            <AccountsDetailWrapper
                accountInteractionsByAccount={accountInteractionsByAccount}
                accentColor={accentColor}
                columns={accountsColumns}
                contactsByCustomer={contactsByCustomer}
                cooldownStartIndex={cooldownStartIndex}
                deleteContact={deleteContact}
                deleteEntry={deleteEntry}
                filtered={filtered}
                historyByCustomer={historyByCustomer}
                isLoading={isLoading && roster.length === 0}
                listEmptyMessage={
                    activeRoster.length === 0 ? 'No customers found yet.' : 'No customers match your search.'
                }
                loadContacts={loadContacts}
                onArchiveAccount={onArchiveAccount}
                loadHistory={loadHistory}
                loadingContactsFor={loadingContactsFor}
                loadingHistoryFor={loadingHistoryFor}
                logCall={logCall}
                logInteraction={logInteraction}
                onClearSelection={onClearSelectedCustomer}
                onSelectCustomer={onSelectCustomer}
                opportunitiesSlot={opportunitiesSlot}
                rosterError={rosterError}
                saveContact={saveContact}
                savingContactFor={savingContactFor}
                savingFor={savingFor}
                selectedAccountId={selectedAccountId}
                selectedRow={selectedRow}
                viewMode={viewMode}
            />
        </div>
    )
}

// ─── AccountsDetailWrapper ────────────────────────────────────────────────────

/** Thin wrapper rendered when a customer is selected. Supplies the
 *  interactions array (for the Activity tab timeline) and the
 *  onLogInteraction callback to ListOrDetailPane → CrmCustomerDetail →
 *  AccountDetailBody, keeping CrmAccountsPage free of duplicate slot JSX. */
function AccountsDetailWrapper({
    accountInteractionsByAccount,
    accentColor,
    columns,
    logInteraction,
    opportunitiesSlot,
    selectedAccountId,
    viewMode,
    ...passthroughProps
}) {
    // Interactions for THIS account, or empty array while loading.
    const interactions = accountInteractionsByAccount?.[selectedAccountId] ?? []

    const handleLogInteraction = useCallback(
        (payload) => logInteraction?.({ ...payload, accountId: selectedAccountId }),
        [logInteraction, selectedAccountId]
    )

    return (
        <ListOrDetailPane
            accentColor={accentColor}
            columns={columns}
            interactions={interactions}
            onLogInteraction={handleLogInteraction}
            opportunitiesSlot={opportunitiesSlot}
            viewMode={viewMode}
            {...passthroughProps}
        />
    )
}

// ─── StatusFilterRow ──────────────────────────────────────────────────────────

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
                    <button type="button"
                        key={key}
                        type="button"
                        onClick={() => onSelect(key)}
                        className="bg-transparent border-none cursor-pointer p-0 text-[12px] active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
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

// ─── Shared table cell atoms ──────────────────────────────────────────────────

/** Tone map for lifecycle_stage badges. */
const LIFECYCLE_TONE = { customer: 'success', lost: 'neutral', prospect: 'accent' }

/** Tone map for opportunity stage badges. */
const STAGE_TONE = { contacted: 'info', lost: 'danger', new: 'neutral', quoted: 'warning', won: 'success' }

/** pouring_status → Badge tone for the Status column. */
const POURING_STATUS_TONE = { active: 'success', dormant: 'warning', never: 'neutral' }
