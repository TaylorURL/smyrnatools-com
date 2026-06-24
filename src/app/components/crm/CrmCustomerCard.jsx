/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { mergeCustomerContacts } from '../../../utils/CrmContactsUtility'
import {
    CALL_OUTCOME_BUTTONS,
    CALL_OUTCOME_LABELS,
    formatCrmPhone,
    formatDormancyLabel,
    formatRelativeDays,
    isCustomerOnSchedule,
    parsePhoneNumbers
} from '../../../utils/CrmRosterUtility'
import DateUtility from '../../../utils/DateUtility'
import { fmtInt } from '../../../utils/PlanStatisticsFormatUtility'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import useCrmCustomerPresence from '../../hooks/useCrmCustomerPresence'
import useCustomerServiceLookup from '../../hooks/useCustomerServiceLookup'
import { Stat } from '../ui/Panel'
import { CrmPanel as Panel, CrmStatGroup as StatGroup } from './CrmSection'
import { AccountDetailBody } from './customer-card/AccountDetailBody'
import { ContactsSection } from './customer-card/ContactsSection'
import { CustomerPresenceBanner } from './customer-card/CustomerPresenceBanner'
import { CustomerServiceContext, CustomerServiceContextSkeleton } from './customer-card/CustomerServiceContext'
import { HistoryEntries } from './customer-card/HistoryEntries'

export {
    CrmCustomerCardRowSkeleton,
    CrmCustomerDetailSkeleton,
    CrmCustomerListSkeleton
} from './customer-card/CrmCustomerCardSkeletons'

/** The fallback accent used when the consumer doesn't pass accentColor.
 *  Matches the ContactEditor hardcoded value so the detail card is
 *  consistent even without the prop. */
const DEFAULT_ACCENT = '#2563eb'

/** Customer card used by the Outreach Queue and the Directory. Mirrors
 *  the Statistics → Customer Lookup card shape (rounded surface, name +
 *  dormancy on top, info rows below) so both surfaces read the same.
 *  Click anywhere to open the focused detail view. */
export function CrmCustomerCardRow({ isActive, onSelect, row }) {
    const phones = useMemo(() => parsePhoneNumbers(row?.phone), [row?.phone])
    return (
        <button type="button"
            onClick={() => onSelect(row.account_id)}
            aria-current={isActive ? 'true' : undefined}
            className={`text-left rounded-md p-3 flex flex-col gap-2 cursor-pointer border transition-[colors,transform,box-shadow] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary ${
                isActive
                    ? 'bg-bg-secondary border-text-secondary shadow-card'
                    : 'bg-bg-primary border-border-light hover:border-border-medium hover:shadow-sm'
            }`}
        >
            <div className="flex items-baseline justify-between gap-3 min-w-0">
                <div className="min-w-0">
                    <div
                        className="text-[13.5px] font-semibold text-text-primary truncate leading-tight"
                        title={row.customer_name}
                    >
                        {row.customer_name || `Customer ${row.customer_num}`}
                    </div>
                    <div className="text-[10.5px] text-text-tertiary tabular-nums mt-0.5">
                        {row.last_pour_date
                            ? `${isCustomerOnSchedule(row.days_since_last_pour) ? 'Next pour' : 'Last pour'} ${DateUtility.formatDate(row.last_pour_date)}`
                            : 'No prior pour'}
                    </div>
                </div>
                <div
                    className={`font-semibold tabular-nums leading-none shrink-0 text-text-primary ${isCustomerOnSchedule(row.days_since_last_pour) ? 'text-[11px] uppercase tracking-wider' : 'text-[20px]'}`}
                    title={
                        isCustomerOnSchedule(row.days_since_last_pour)
                            ? 'Booked on an upcoming schedule'
                            : `${row.days_since_last_pour} days since last pour`
                    }
                >
                    {formatDormancyLabel(row.days_since_last_pour)}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-text-secondary min-w-0">
                {phones.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <i className="fas fa-phone text-[10px] text-text-tertiary" />
                        {formatCrmPhone(phones[0].raw) || phones[0].display}
                        {phones.length > 1 && (
                            <span className="text-[10.5px] text-text-tertiary ml-1">+{phones.length - 1}</span>
                        )}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-text-tertiary">
                        <i className="fas fa-phone-slash text-[10px]" />
                        No phone
                    </span>
                )}
                {row.contact_name && (
                    <span className="inline-flex items-center gap-1 truncate">
                        <i className="fas fa-user text-[10px] text-text-tertiary" />
                        <span className="truncate">{row.contact_name}</span>
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[10.5px] text-text-tertiary tabular-nums">
                <span>{row.pour_days_last_year} pour days/yr</span>
                {row.last_call_at ? (
                    <span
                        className="truncate"
                        title={row.last_call_by_name ? `By ${row.last_call_by_name}` : undefined}
                    >
                        <span className="font-semibold text-text-tertiary">
                            {CALL_OUTCOME_LABELS[row.last_call_outcome] || '—'}
                        </span>
                        <span> · {formatRelativeDays(row.last_call_at)}</span>
                    </span>
                ) : (
                    <span>Never called</span>
                )}
            </div>
        </button>
    )
}

// ─── CrmCustomerDetail ────────────────────────────────────────────────────────

/** Full detail view for a single customer. Uses the shared AccountDetailBody
 *  for the sticky header + tab-strip layout (Contacts | Activity | Opportunities).
 *
 *  - Contacts tab: stat strip + phone numbers + service history + team call history
 *    with an inline "Log a call" panel so dispatchers can log without switching tabs.
 *  - Activity tab: LogInteractionComposer + InteractionTimeline (NOTE: this component
 *    does not receive CRM account interactions — those are wired from CrmAccountsPage).
 *    The tab exists so the body is consistent with AccountDetailDrawer.
 *  - Opportunities tab: rendered by the parent via opportunitiesSlot.
 *
 *  @param {string}  [accentColor]       - CSS color for the header CTA and active tab.
 *  @param {object}  colocationMap       - Plant co-location alias map.
 *  @param {Array}   [contacts]          - Merged contact entries for phone numbers.
 *  @param {Array}   [history]           - Team call log entries.
 *  @param {Array}   [interactions]      - CRM account interactions for the Activity tab timeline.
 *  @param {boolean} isLoadingContacts
 *  @param {boolean} isLoadingHistory
 *  @param {boolean} [isSavingInteraction] - Disables the Activity tab log composer submit.
 *  @param {boolean} isSaving            - Disables call-log outcome buttons.
 *  @param {boolean} isSavingContact
 *  @param {() => void} onClose
 *  @param {Function} [onDeleteContact]
 *  @param {Function} [onDeleteEntry]
 *  @param {Function} [onLoadContacts]
 *  @param {Function} [onLoadHistory]
 *  @param {Function} [onLogInteraction]  - Submit a CRM interaction (Activity tab).
 *  @param {Function} onLog              - Submit a call-outcome log (Contacts tab).
 *  @param {Function} [onSaveContact]
 *  @param {object}  [opportunitiesSlot] - React node for the Opportunities tab.
 *  @param {object}  plantNameByCode
 *  @param {object}  row                 - The CRM roster row for this customer.
 */
export function CrmCustomerDetail({
    accentColor = DEFAULT_ACCENT,
    contacts,
    history,
    interactions = [],
    isLoadingContacts,
    isLoadingHistory,
    isSaving,
    isSavingContact,
    isSavingInteraction = false,
    onArchiveAccount,
    onClose,
    onDeleteContact,
    onDeleteEntry,
    onLoadContacts,
    onLoadHistory,
    onLog,
    onLogInteraction,
    onSaveContact,
    opportunitiesSlot,
    plantNameByCode,
    row
}) {
    const { user } = useAuth()
    const currentUserId = user?.id || null
    const confirm = useConfirm()
    const mergedContacts = useMemo(() => mergeCustomerContacts(row?.phone, contacts), [row?.phone, contacts])

    // Archive is offered only for prospects (manually-added accounts not yet
    // poured). It marks the account 'lost' so it leaves the active directory.
    const displayName = row.customer_name || `Customer ${row.customer_num}`
    const canArchive = Boolean(onArchiveAccount) && row.lifecycle_stage === 'prospect'
    const handleArchive = useCallback(async () => {
        const ok = await confirm({
            confirmLabel: 'Archive',
            message: 'This prospect will leave the active directory. You can re-add them later.',
            title: `Archive ${displayName}?`
        })
        if (ok) await onArchiveAccount(row.account_id, displayName)
    }, [confirm, displayName, onArchiveAccount, row.account_id])

    const { users: presenceUsers } = useCrmCustomerPresence(row.customer_num, { userId: currentUserId })
    const otherViewers = useMemo(() => presenceUsers.filter((u) => !u.isSelf), [presenceUsers])

    const {
        aggregate: serviceAggregate,
        error: serviceError,
        isLoading: isLoadingServiceHistory,
        orders: serviceOrders
    } = useCustomerServiceLookup({
        customerName: row.customer_name,
        customerNum: row.customer_num,
        enabled: true,
        lastPourDate: row.last_pour_date
    })

    const [callComment, setCallComment] = useState('')
    const [submitting, setSubmitting] = useState(null)

    useEffect(() => {
        if (onLoadHistory) onLoadHistory(row.customer_num)
    }, [row.customer_num, onLoadHistory])

    useEffect(() => {
        if (onLoadContacts) onLoadContacts(row.customer_num)
    }, [row.customer_num, onLoadContacts])

    useEffect(() => {
        setCallComment('')
        setSubmitting(null)
    }, [row.customer_num])

    // ── derive primary phone for the sticky header ─────────────────────────
    const primaryContact = mergedContacts?.find((c) => c.isPrimary) ?? mergedContacts?.[0] ?? null
    const primaryPhone = primaryContact?.display ?? null
    const primaryPhoneHref = primaryContact?.href ?? null

    // ── submit a call-outcome log entry ────────────────────────────────────
    const submitCallLog = async (outcomeKey) => {
        setSubmitting(outcomeKey)
        try {
            await onLog({
                comment: callComment.trim() || null,
                contactName: row.contact_name,
                customerName: row.customer_name,
                customerNum: row.customer_num,
                outcome: outcomeKey,
                phone: row.phone
            })
            setCallComment('')
        } finally {
            setSubmitting(null)
        }
    }

    // ── Left-rail: contacts-only slot ─────────────────────────────────────
    const contactsSlot = (
        <ContactsSection
            contacts={mergedContacts}
            customerNum={row.customer_num}
            isLoadingContacts={isLoadingContacts}
            isSavingContact={isSavingContact}
            onDeleteContact={onDeleteContact}
            onSaveContact={onSaveContact}
        />
    )

    // ── Activity snapshot — KPI strip matching the dashboard's StatGroup ───
    const quickStatsSlot = (
        <StatGroup columns={4}>
            <Stat
                label={isCustomerOnSchedule(row.days_since_last_pour) ? 'Status' : 'Dormant'}
                value={formatDormancyLabel(row.days_since_last_pour)}
            />
            <Stat label="Pour days/yr" value={fmtInt(row.pour_days_last_year)} />
            <Stat label="Calls 30d" value={fmtInt(row.call_count_last_30 || 0)} />
            <Stat label="Last call" value={row.last_call_at ? formatRelativeDays(row.last_call_at) : 'Never'} />
        </StatGroup>
    )

    // ── Main column: service history + team call history + quick-log panel ─
    //    Each rendered as a flat `Panel` so the detail matches the dashboard.
    const mainExtraSlot = (
        <>
            {/* Service history — the context card is already self-framed, so the
                Panel contributes only its title row (transparent, border-less body). */}
            <Panel
                title="Service history · last 120 days"
                innerClassName="!border-0 !bg-transparent !p-0"
                right={
                    serviceAggregate?.lastPourDate ? (
                        <span className="text-[11px] text-text-tertiary tabular-nums">
                            Last measured {DateUtility.formatDate(serviceAggregate.lastPourDate)}
                        </span>
                    ) : null
                }
            >
                {isLoadingServiceHistory ? (
                    <CustomerServiceContextSkeleton />
                ) : serviceError ? (
                    <div className="rounded-md border border-border-light bg-bg-primary px-3 py-2 text-[12px] text-text-tertiary">
                        Couldn&apos;t load service history: {serviceError}
                    </div>
                ) : (
                    <CustomerServiceContext
                        aggregate={serviceAggregate}
                        emptyMessage="No measured service history in the last 120 days."
                        orders={serviceOrders}
                        plantNameByCode={plantNameByCode}
                    />
                )}
            </Panel>

            {/* Team call history */}
            <Panel title={`Team call history (${history?.length || 0})`} innerClassName="p-0 overflow-hidden">
                <HistoryEntries
                    currentUserId={currentUserId}
                    entries={history}
                    isLoading={isLoadingHistory}
                    onDelete={onDeleteEntry ? (logId) => onDeleteEntry(row.customer_num, logId) : null}
                />
            </Panel>

            {/* Quick call-log panel — compact outcome row so dispatchers can log
                a call result without leaving the main activity stream. */}
            <Panel title="Log a call">
                <div className="flex flex-col gap-2">
                    <textarea
                        value={callComment}
                        onChange={(e) => setCallComment(e.target.value)}
                        placeholder="Notes — project timeline, gatekeeper, follow-up date, which numbers you tried…"
                        rows={3}
                        aria-label="Call notes"
                        className="w-full rounded-md p-2 text-[12.5px] resize-y outline-none bg-bg-secondary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {CALL_OUTCOME_BUTTONS.map(({ color, icon, key, label }) => {
                            const busy = submitting === key
                            return (
                                <button type="button"
                                    key={key}
                                    type="button"
                                    onClick={() => submitCallLog(key)}
                                    disabled={isSaving || busy}
                                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-md px-2.5 text-[12px] font-semibold border-none cursor-pointer disabled:opacity-50 active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                                    style={{
                                        background: `${color}22`,
                                        boxShadow: `inset 0 0 0 1px ${color}55`,
                                        color
                                    }}
                                >
                                    <i className={`fas ${icon} text-[11px]`} />
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                    <div className="flex items-center justify-end">
                        <button type="button"
                            onClick={() => submitCallLog('note')}
                            disabled={!callComment.trim() || submitting === 'note'}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer disabled:opacity-40 border-none bg-transparent p-0 text-text-secondary hover:underline active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                        >
                            <i className="fas fa-note-sticky text-[9px]" />
                            Save note without outcome
                        </button>
                    </div>
                </div>
            </Panel>
        </>
    )

    return (
        <div className="flex flex-col rounded-md border border-border-light bg-bg-secondary overflow-hidden min-h-[480px] animate-fade-in-up">
            <AccountDetailBody
                accentColor={accentColor}
                closeIcon="back"
                closeLabel="Back to list"
                contactsSlot={contactsSlot}
                customerName={displayName}
                interactions={interactions}
                isSavingInteraction={isSavingInteraction}
                lifecycleStage={row.pouring_status === 'active' ? 'customer' : undefined}
                mainExtraSlot={mainExtraSlot}
                onArchive={canArchive ? handleArchive : undefined}
                onClose={onClose}
                onLogInteraction={onLogInteraction ?? null}
                opportunitiesSlot={opportunitiesSlot}
                presenceBannerSlot={otherViewers.length > 0 ? <CustomerPresenceBanner viewers={otherViewers} /> : null}
                primaryPhone={primaryPhone}
                primaryPhoneHref={primaryPhoneHref}
                quickStatsSlot={quickStatsSlot}
            />
        </div>
    )
}
