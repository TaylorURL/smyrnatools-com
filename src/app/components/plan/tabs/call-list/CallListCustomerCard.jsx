/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { mergeCustomerContacts, normalizeContactDigits } from '../../../../../utils/CallListContactsUtility'
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
            className="text-left rounded-md p-3 flex flex-col gap-2 cursor-pointer border transition-colors"
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
                    className="text-[11.5px] text-text-secondary cursor-pointer bg-transparent border-none p-1"
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
                    className="w-full rounded-md p-2 text-[12.5px] resize-y outline-none bg-bg-secondary border border-border-light text-text-primary mb-2"
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
                                className="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-[12px] font-semibold border-none cursor-pointer disabled:opacity-50 transition-colors"
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
                        className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer disabled:opacity-40 border-none bg-transparent p-0 text-text-secondary hover:underline"
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

/** Live "X is also viewing this customer" warning. Hidden when no
 *  other dispatcher is on the same customer detail. Renders an amber
 *  banner with the other viewers' names and roles so the dispatcher
 *  can coordinate before dialling. Driven by
 *  `useCallListCustomerPresence` — purely ephemeral, no DB writes. */
function CustomerPresenceBanner({ viewers }) {
    if (!viewers || viewers.length === 0) return null
    const names = viewers.map((v) => v.name)
    const message =
        viewers.length === 1
            ? `${names[0]} is also viewing this customer`
            : viewers.length === 2
              ? `${names[0]} and ${names[1]} are also viewing this customer`
              : `${names[0]} and ${viewers.length - 1} others are also viewing this customer`
    return (
        <div
            className="rounded-md flex items-start gap-3 px-3 py-2.5"
            style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)'
            }}
            role="status"
        >
            <i className="fas fa-triangle-exclamation text-[14px] mt-0.5" style={{ color: 'var(--text-primary)' }} />
            <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {message}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Coordinate before calling so this customer isn&apos;t dialled twice.
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {viewers.map((v) => (
                        <span
                            key={v.userId}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                            style={{
                                background: 'rgba(245, 158, 11, 0.18)',
                                color: 'var(--text-primary)'
                            }}
                            title={v.role || undefined}
                        >
                            <i className="fas fa-circle text-[6px]" style={{ color: 'var(--text-primary)' }} />
                            {v.name}
                            {v.role && <span className="opacity-70">· {v.role}</span>}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Editable phone-number list. Numbers come from two places merged into
 *  a single rendered list: the parsed dispatch phone string (auto-
 *  populated default) and the `customer_contacts` overrides. Each row
 *  has Edit + Delete affordances. Deletes of dispatch-sourced numbers
 *  soft-hide them so the next dispatch import doesn't resurrect a
 *  number the user explicitly removed. */
function ContactsSection({
    contacts,
    customerNum,
    isLoadingContacts,
    isSavingContact,
    onDeleteContact,
    onSaveContact
}) {
    const [editingKey, setEditingKey] = useState(null)
    const [showAddForm, setShowAddForm] = useState(false)

    const handleDelete = async (entry) => {
        if (!onDeleteContact) return
        const ok = window.confirm(`Remove ${entry.display} from this customer?`)
        if (!ok) return
        await onDeleteContact(customerNum, entry.phoneDigits, entry.phoneDisplay)
    }

    return (
        <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Phone numbers</div>
                {!showAddForm && (
                    <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer border-none bg-transparent p-0 text-text-secondary hover:underline"
                    >
                        <i className="fas fa-plus text-[9px]" />
                        Add number
                    </button>
                )}
            </div>
            {isLoadingContacts && contacts.length === 0 ? (
                <div className="text-[11.5px] italic text-text-tertiary">Loading numbers…</div>
            ) : contacts.length === 0 && !showAddForm ? (
                <div className="text-[12px] text-text-tertiary inline-flex items-center gap-1.5">
                    <i className="fas fa-phone-slash text-[10px]" />
                    No phone on file. Add one to start cold-calling.
                </div>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {contacts.map((entry) =>
                        editingKey === entry.phoneDigits ? (
                            <li key={entry.phoneDigits}>
                                <ContactEditor
                                    customerNum={customerNum}
                                    initial={entry}
                                    isSaving={isSavingContact}
                                    onCancel={() => setEditingKey(null)}
                                    onSave={async (payload) => {
                                        const result = await onSaveContact(customerNum, payload)
                                        if (result) setEditingKey(null)
                                    }}
                                />
                            </li>
                        ) : (
                            <li
                                key={entry.phoneDigits}
                                className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 bg-bg-secondary border border-border-light"
                            >
                                <a
                                    href={`tel:${entry.href}`}
                                    className="flex items-baseline gap-2 min-w-0 text-[13px] font-mono tabular-nums font-semibold hover:underline text-text-primary"
                                >
                                    <i className="fas fa-phone text-[11px] text-text-tertiary shrink-0" />
                                    <span className="truncate">{entry.display}</span>
                                    {entry.label && (
                                        <span className="text-[10.5px] uppercase tracking-wider text-text-tertiary font-sans truncate">
                                            · {entry.label}
                                        </span>
                                    )}
                                    {entry.contactName && (
                                        <span className="text-[11px] text-text-secondary font-sans truncate">
                                            · {entry.contactName}
                                        </span>
                                    )}
                                    {entry.isPrimary && (
                                        <span
                                            className="text-[9px] uppercase tracking-wider font-bold rounded-sm px-1 py-0.5"
                                            style={{ background: '#16a34a22', color: 'var(--text-primary)' }}
                                            title="Primary number"
                                        >
                                            Primary
                                        </span>
                                    )}
                                </a>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setEditingKey(entry.phoneDigits)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded border-none cursor-pointer bg-transparent text-text-tertiary hover:text-text-primary"
                                        title="Edit name / label"
                                        aria-label="Edit contact"
                                    >
                                        <i className="fas fa-pen text-[10px]" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(entry)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded border-none cursor-pointer bg-transparent text-text-tertiary hover:text-text-primary"
                                        title="Remove this number"
                                        aria-label="Remove contact"
                                    >
                                        <i className="fas fa-trash text-[10px]" />
                                    </button>
                                </div>
                            </li>
                        )
                    )}
                </ul>
            )}
            {showAddForm && (
                <div className="mt-2">
                    <ContactEditor
                        customerNum={customerNum}
                        initial={null}
                        isSaving={isSavingContact}
                        onCancel={() => setShowAddForm(false)}
                        onSave={async (payload) => {
                            const result = await onSaveContact(customerNum, payload)
                            if (result) setShowAddForm(false)
                        }}
                    />
                </div>
            )}
        </div>
    )
}

/** Single-row editor for a phone-number entry. Used inline for new
 *  numbers and as a per-row swap when editing an existing entry. */
function ContactEditor({ initial, isSaving, onCancel, onSave }) {
    const [phoneDisplay, setPhoneDisplay] = useState(initial?.phoneDisplay || '')
    const [label, setLabel] = useState(initial?.label || '')
    const [contactName, setContactName] = useState(initial?.contactName || '')
    const [isPrimary, setIsPrimary] = useState(initial?.isPrimary || false)
    const digits = normalizeContactDigits(phoneDisplay)
    const canSave = digits.length >= 7 && !isSaving

    const submit = async () => {
        if (!canSave) return
        await onSave({
            contactName: contactName.trim() || null,
            isPrimary,
            label: label.trim() || null,
            phoneDigits: digits,
            phoneDisplay: phoneDisplay.trim(),
            source: initial?.source || 'manual'
        })
    }

    return (
        <div className="rounded-md p-2.5 bg-bg-secondary border border-border-light flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                    type="tel"
                    value={phoneDisplay}
                    onChange={(e) => setPhoneDisplay(e.target.value)}
                    placeholder="(713) 555-0123"
                    disabled={!!initial}
                    className="rounded px-2 py-1.5 text-[12.5px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary disabled:opacity-60 font-mono tabular-nums"
                />
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Label (Office, Cell…)"
                    className="rounded px-2 py-1.5 text-[12.5px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary"
                />
                <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact name"
                    className="rounded px-2 py-1.5 text-[12.5px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary"
                />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 text-[11.5px] text-text-secondary cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isPrimary}
                        onChange={(e) => setIsPrimary(e.target.checked)}
                        className="cursor-pointer"
                    />
                    Mark as primary
                </label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer border-none bg-transparent p-0 text-text-tertiary hover:underline"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSave}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold border-none cursor-pointer disabled:opacity-40"
                        style={{
                            background: '#2563eb22',
                            boxShadow: 'inset 0 0 0 1px #2563eb55',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <i className="fas fa-floppy-disk text-[10px]" />
                        {isSaving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function HistoryEntries({ currentUserId, entries, isLoading, onDelete }) {
    const [deletingId, setDeletingId] = useState(null)
    if (isLoading) {
        return <HistoryEntriesSkeleton />
    }
    if (!entries?.length) {
        return <div className="text-xs italic px-4 py-3 text-text-tertiary">No calls logged yet.</div>
    }
    const handleDelete = async (entry) => {
        if (!onDelete) return
        const ok = window.confirm('Delete this entry? This cannot be undone.')
        if (!ok) return
        setDeletingId(entry.id)
        try {
            await onDelete(entry.id)
        } finally {
            setDeletingId(null)
        }
    }
    return (
        <ol className="flex flex-col">
            {entries.map((entry, idx) => {
                const canDelete = !!currentUserId && entry.created_by === currentUserId
                const tone = CALL_OUTCOME_COLORS[entry.outcome] || '#64748b'
                return (
                    <li
                        key={entry.id}
                        className="px-4 py-2 flex flex-col gap-1"
                        style={{
                            borderBottom: idx === entries.length - 1 ? 'none' : '1px solid var(--border-light)'
                        }}
                    >
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                            <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[9.5px]"
                                style={{
                                    background: `${tone}29`,
                                    boxShadow: `inset 0 0 0 1px ${tone}55`,
                                    color: tone
                                }}
                            >
                                {CALL_OUTCOME_LABELS[entry.outcome] || entry.outcome}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                                <span>{DateUtility.formatDateTime(entry.created_at)}</span>
                                {entry.created_by_name && (
                                    <span className="font-semibold text-text-secondary">· {entry.created_by_name}</span>
                                )}
                                {canDelete && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(entry)}
                                        disabled={deletingId === entry.id}
                                        title="Delete this entry"
                                        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded border-none cursor-pointer disabled:opacity-40 bg-transparent text-text-tertiary"
                                    >
                                        <i className="fas fa-trash text-[10px]" />
                                    </button>
                                )}
                            </span>
                        </div>
                        {entry.comment && (
                            <div className="text-[12px] whitespace-pre-wrap text-text-secondary">{entry.comment}</div>
                        )}
                    </li>
                )
            })}
        </ol>
    )
}

const SkelBar = ({ className = '', style }) => (
    <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
)

/** Single placeholder card matching the customer card layout. Rendered
 *  inside `CallListCustomerListSkeleton` so the grid keeps its shape
 *  during a refresh instead of going blank. */
export function CallListCustomerCardRowSkeleton() {
    return (
        <div className="rounded-md p-3 flex flex-col gap-2 border bg-bg-primary border-border-light">
            <div className="flex items-baseline justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <SkelBar className="h-3.5 w-2/3" />
                    <SkelBar className="h-2.5 w-1/3" />
                </div>
                <SkelBar className="h-5 w-10" />
            </div>
            <div className="flex items-center gap-3">
                <SkelBar className="h-2.5 w-28" />
                <SkelBar className="h-2.5 w-20" />
            </div>
            <div className="flex items-center justify-between gap-2">
                <SkelBar className="h-2.5 w-24" />
                <SkelBar className="h-2.5 w-20" />
            </div>
        </div>
    )
}

/** Skeleton grid for the customer list — rendered while the roster is
 *  loading or refreshing so the dispatcher sees the layout shape
 *  instead of stale data or a blank space. Mirrors the responsive grid
 *  the live list uses. */
export function CallListCustomerListSkeleton({ count = 9 }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from({ length: count }).map((_, i) => (
                <CallListCustomerCardRowSkeleton key={i} />
            ))}
        </div>
    )
}

/** Skeleton for the full detail card — header, 4-stat block, phones,
 *  log form, service history, team history. Same vertical structure as
 *  `CallListCustomerDetail` so content slots in without a jump. Mirrors
 *  the Customer Lookup detail skeleton shape. */
export function CallListCustomerDetailSkeleton() {
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-1.5">
                    <SkelBar className="h-4 w-48" />
                    <SkelBar className="h-3 w-64" />
                </div>
                <SkelBar className="h-3 w-10" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pb-4 border-b border-border-light">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <SkelBar className="h-2.5 w-16" />
                        <SkelBar className="h-5 w-20" />
                        <SkelBar className="h-2.5 w-24" />
                    </div>
                ))}
            </div>
            <div className="flex flex-col gap-1.5">
                <SkelBar className="h-2.5 w-20" />
                <SkelBar className="h-3 w-48" />
                <SkelBar className="h-3 w-40" />
            </div>
            <div className="flex flex-col gap-2.5">
                <SkelBar className="h-2.5 w-16" />
                <SkelBar className="h-16 w-full" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkelBar key={i} className="h-9 w-full" />
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <SkelBar className="h-2.5 w-40" />
                <div className="rounded-md border border-border-light p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-1">
                                <SkelBar className="h-2.5 w-16" />
                                <SkelBar className="h-5 w-20" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <SkelBar className="h-2.5 w-32" />
                <div className="rounded-md border border-border-light overflow-hidden">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="px-4 py-2 flex items-center gap-3"
                            style={{ borderBottom: i === 2 ? 'none' : '1px solid var(--border-light)' }}
                        >
                            <SkelBar className="h-3 w-16" />
                            <div className="flex-1" />
                            <SkelBar className="h-3 w-28" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function HistoryEntriesSkeleton() {
    return (
        <div className="flex flex-col">
            {Array.from({ length: 3 }).map((_, i) => (
                <div
                    key={i}
                    className="px-4 py-2 flex items-center gap-2"
                    style={{ borderBottom: i === 2 ? 'none' : '1px solid var(--border-light)' }}
                >
                    <SkelBar className="h-3 w-16" />
                    <div className="flex-1" />
                    <SkelBar className="h-3 w-28" />
                </div>
            ))}
        </div>
    )
}
