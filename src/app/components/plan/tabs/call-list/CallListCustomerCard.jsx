/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { mergeCustomerContacts } from '../../../../../utils/CallListContactsUtility'
import {
    CALL_OUTCOME_BUTTONS,
    CALL_OUTCOME_COLORS,
    CALL_OUTCOME_LABELS,
    dormancyTone,
    formatCallListPhone,
    formatDormancyLabel,
    formatRelativeDays,
    isCustomerOnSchedule,
    parsePhoneNumbers
} from '../../../../../utils/CallListUtility'
import DateUtility from '../../../../../utils/DateUtility'
import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { useAuth } from '../../../../context/AuthContext'
import useCallListCustomerPresence from '../../../../hooks/useCallListCustomerPresence'
import useCustomerServiceLookup from '../../../../hooks/useCustomerServiceLookup'
import { CustomerServiceContext, CustomerServiceContextSkeleton, StatBlock } from '../statistics/CustomerServiceContext'
import { ContactsSection } from './customer-card/ContactsSection'
import { CustomerPresenceBanner } from './customer-card/CustomerPresenceBanner'
import { HistoryEntries } from './customer-card/HistoryEntries'

export {
    CallListCustomerCardRowSkeleton,
    CallListCustomerDetailSkeleton,
    CallListCustomerListSkeleton
} from './customer-card/CallListCustomerCardSkeletons'

/** Customer card used by the Outreach Queue and the Directory. Mirrors
 *  the Statistics → Customer Lookup card shape (rounded surface, name +
 *  dormancy on top, info rows below) so both surfaces read the same.
 *  Click anywhere to open the focused detail view. */
export function CallListCustomerCardRow({ isActive, onSelect, row }) {
    const phones = useMemo(() => parsePhoneNumbers(row?.phone), [row?.phone])
    const tone = dormancyTone(row?.days_since_last_pour || 0)
    const lastOutcomeColor = row.last_call_outcome ? CALL_OUTCOME_COLORS[row.last_call_outcome] : null
    return (
        <button
            type="button"
            onClick={() => onSelect(row.customer_num)}
            className="text-left rounded-md p-3 flex flex-col gap-2 cursor-pointer border active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
            style={{
                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                borderColor: isActive ? 'var(--text-secondary)' : 'var(--border-light)'
            }}
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
                    className={`font-semibold tabular-nums leading-none shrink-0 ${isCustomerOnSchedule(row.days_since_last_pour) ? 'text-[11px] uppercase tracking-wider' : 'text-[20px]'}`}
                    style={{ color: 'var(--text-primary)' }}
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
                        {formatCallListPhone(phones[0].raw) || phones[0].display}
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
                        <span style={{ color: 'var(--text-tertiary)' }} className="font-semibold">
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

/** Full detail view for a single customer. Renders when the dispatcher
 *  has tapped a card — the list is hidden by the parent page so this
 *  card claims the full content area. Prominent Close at the top
 *  returns to the list. */
export function CallListCustomerDetail({
    colocationMap,
    contacts,
    history,
    isLoadingContacts,
    isLoadingHistory,
    isSaving,
    isSavingContact,
    onClose,
    onDeleteContact,
    onDeleteEntry,
    onLoadContacts,
    onLoadHistory,
    onLog,
    onSaveContact,
    plantNameByCode,
    row
}) {
    const { user } = useAuth()
    const currentUserId = user?.id || null
    const mergedContacts = useMemo(() => mergeCustomerContacts(row?.phone, contacts), [row?.phone, contacts])
    const tone = dormancyTone(row?.days_since_last_pour || 0)
    const lastOutcomeColor = row.last_call_outcome ? CALL_OUTCOME_COLORS[row.last_call_outcome] : null
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(null)

    /* Per-customer realtime presence. The moment two dispatchers open
     * the same customer detail, both see a warning chip with the other's
     * name so nobody dials a number that's already in flight. Channel
     * dies with the component, so navigating away clears the chip on
     * every other client within the realtime sync window. */
    const { users: presenceUsers } = useCallListCustomerPresence(row.customer_num, { userId: currentUserId })
    const otherViewers = useMemo(() => presenceUsers.filter((u) => !u.isSelf), [presenceUsers])

    /** Pull the same per-customer service-quality context Statistics →
     *  Customer Lookup surfaces. Gives the dispatcher cold-call talking
     *  points (good %, late/slow tallies, recent verdict trail) inline
     *  with the contact info and call log. */
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

    useEffect(() => {
        if (onLoadHistory) onLoadHistory(row.customer_num)
    }, [row.customer_num, onLoadHistory])

    useEffect(() => {
        if (onLoadContacts) onLoadContacts(row.customer_num)
    }, [row.customer_num, onLoadContacts])

    useEffect(() => {
        setComment('')
        setSubmitting(null)
    }, [row.customer_num])

    const submit = async (outcomeKey) => {
        setSubmitting(outcomeKey)
        try {
            await onLog({
                comment: comment.trim() || null,
                contactName: row.contact_name,
                customerName: row.customer_name,
                customerNum: row.customer_num,
                outcome: outcomeKey,
                phone: row.phone
            })
            setComment('')
        } finally {
            setSubmitting(null)
        }
    }

    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light flex flex-col gap-5">
            <CustomerPresenceBanner viewers={otherViewers} />
            <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold m-0 truncate text-text-primary" title={row.customer_name}>
                        {row.customer_name || `Customer ${row.customer_num}`}
                        <span className="text-[11px] text-text-tertiary font-normal ml-2">#{row.customer_num}</span>
                    </h3>
                    <div className="text-[11.5px] text-text-tertiary tabular-nums mt-0.5 flex flex-wrap gap-x-1.5">
                        <span style={{ color: 'var(--text-primary)' }} className="font-semibold">
                            {isCustomerOnSchedule(row.days_since_last_pour)
                                ? 'On Schedule'
                                : `${row.days_since_last_pour}d dormant`}
                        </span>
                        {row.last_pour_date && (
                            <span>
                                · {isCustomerOnSchedule(row.days_since_last_pour) ? 'next pour' : 'last pour'}{' '}
                                {DateUtility.formatDate(row.last_pour_date)}
                            </span>
                        )}
                        {row.contact_name && <span>· {row.contact_name}</span>}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[11.5px] text-text-secondary cursor-pointer bg-transparent border-none p-1 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                    title="Back to list"
                >
                    Close
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pb-4 border-b border-border-light">
                <StatBlock
                    label={isCustomerOnSchedule(row.days_since_last_pour) ? 'Status' : 'Dormant'}
                    value={formatDormancyLabel(row.days_since_last_pour)}
                    sub={
                        row.last_pour_date
                            ? `${isCustomerOnSchedule(row.days_since_last_pour) ? 'Booked' : 'Since'} ${DateUtility.formatDate(row.last_pour_date)}`
                            : 'No prior pour'
                    }
                />
                <StatBlock label="Pour days/yr" value={fmtInt(row.pour_days_last_year)} sub="Last 12 months" />
                <StatBlock
                    label="Calls last 30d"
                    value={fmtInt(row.call_count_last_30 || 0)}
                    sub={row.call_count_last_30 > 0 ? 'By the team' : null}
                />
                <StatBlock
                    label="Last call"
                    value={row.last_call_at ? formatRelativeDays(row.last_call_at) : 'Never'}
                    sub={
                        row.last_call_at
                            ? `${CALL_OUTCOME_LABELS[row.last_call_outcome] || '—'}${
                                  row.last_call_by_name ? ` · ${row.last_call_by_name}` : ''
                              }`
                            : null
                    }
                />
            </div>

            <ContactsSection
                contacts={mergedContacts}
                customerNum={row.customer_num}
                isLoadingContacts={isLoadingContacts}
                isSavingContact={isSavingContact}
                onDeleteContact={onDeleteContact}
                onSaveContact={onSaveContact}
            />

            <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-2">Log a call</div>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Notes — project timeline, gatekeeper, follow-up date, which numbers you tried…"
                    rows={3}
                    aria-label="Call notes"
                    className="w-full rounded-md p-2 text-[12.5px] resize-y outline-none bg-bg-secondary border border-border-light text-text-primary placeholder:text-text-tertiary mb-2 transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CALL_OUTCOME_BUTTONS.map(({ color, icon, key, label }) => {
                        const busy = submitting === key
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => submit(key)}
                                disabled={isSaving || busy}
                                className="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-[12px] font-semibold border-none cursor-pointer disabled:opacity-50 active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
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
                <div className="flex items-center justify-end gap-2 mt-1.5">
                    <button
                        type="button"
                        onClick={() => submit('note')}
                        disabled={!comment.trim() || submitting === 'note'}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer disabled:opacity-40 border-none bg-transparent p-0 text-text-secondary hover:underline active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                    >
                        <i className="fas fa-note-sticky text-[9px]" />
                        Save note without outcome
                    </button>
                </div>
            </div>

            <div>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                        Service history (last 120 days)
                    </div>
                    {serviceAggregate?.lastPourDate && (
                        <div className="text-[10.5px] text-text-tertiary tabular-nums">
                            Last measured pour: {DateUtility.formatDate(serviceAggregate.lastPourDate)}
                        </div>
                    )}
                </div>
                {isLoadingServiceHistory ? (
                    <CustomerServiceContextSkeleton />
                ) : serviceError ? (
                    <div className="rounded-md p-3 text-[12px] bg-bg-secondary border border-border-light text-text-tertiary">
                        Couldn&apos;t load service history: {serviceError}
                    </div>
                ) : (
                    <CustomerServiceContext
                        aggregate={serviceAggregate}
                        colocationMap={colocationMap}
                        emptyMessage="No measured service history for this customer in the last 120 days."
                        orders={serviceOrders}
                        plantNameByCode={plantNameByCode}
                    />
                )}
            </div>

            <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
                    Team call history ({history?.length || 0})
                </div>
                <div className="rounded-md border border-border-light overflow-hidden">
                    <HistoryEntries
                        currentUserId={currentUserId}
                        entries={history}
                        isLoading={isLoadingHistory}
                        onDelete={onDeleteEntry ? (logId) => onDeleteEntry(row.customer_num, logId) : null}
                    />
                </div>
            </div>
        </div>
    )
}
