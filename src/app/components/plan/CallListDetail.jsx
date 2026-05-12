/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

import {
    CALL_OUTCOME_BUTTONS,
    CALL_OUTCOME_COLORS,
    CALL_OUTCOME_LABELS,
    dormancyTone,
    formatCallListPhone
} from '../../../utils/CallListUtility'
import DateUtility from '../../../utils/DateUtility'
import { useAuth } from '../../context/AuthContext'

const buildDisplayName = (user) => {
    if (!user) return ''
    const first = (user.first_name || user.firstName || '').trim()
    const last = (user.last_name || user.lastName || '').trim()
    const combined = [first, last].filter(Boolean).join(' ').trim()
    if (combined) return combined
    if (user.name) return String(user.name).trim()
    if (user.email) return String(user.email).trim()
    return ''
}

/** Vertical timeline of calls + comments for the selected customer.
 *  Hairline-divided so it reads as one unit inside the detail panel. The
 *  delete button only renders for entries the current user authored — the
 *  server enforces the same rule, so a tampered request would still 404. */
function HistoryList({ currentUserId, entries, isLoading, onDelete }) {
    const [deletingId, setDeletingId] = useState(null)
    if (isLoading) {
        return <div className="text-xs italic px-3 py-4 text-center text-text-tertiary">Loading history…</div>
    }
    if (!entries?.length) {
        return <div className="text-xs italic px-3 py-4 text-center text-text-tertiary">No calls logged yet.</div>
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
                return (
                    <li
                        key={entry.id}
                        className="px-3 py-2 flex flex-col gap-1"
                        style={{
                            borderBottom: idx === entries.length - 1 ? 'none' : '1px solid var(--border-light)'
                        }}
                    >
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                            {(() => {
                                const tone = CALL_OUTCOME_COLORS[entry.outcome] || '#64748b'
                                return (
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
                                )
                            })()}
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

/** Right-pane detail for the selected customer — header, KPI strip, action
 *  buttons, comment box, and call history. Empty placeholder when nothing
 *  is selected. */
export default function CallListDetail({ history, isLoadingHistory, isSaving, onDeleteEntry, onLog, row }) {
    const { user } = useAuth()
    const currentUserId = user?.id || null
    const currentUserName = buildDisplayName(user)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(null)

    useEffect(() => {
        setComment('')
        setSubmitting(null)
    }, [row?.customer_num])

    if (!row) {
        return (
            <div className="flex flex-col items-center justify-center text-center gap-2 p-10 text-text-tertiary">
                <i className="fas fa-headset text-2xl" />
                <div className="text-[12.5px]">Select a customer from the list to log a call.</div>
            </div>
        )
    }

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

    const tone = dormancyTone(row.days_since_last_pour)

    return (
        <div className="flex flex-col">
            <div className="px-4 py-2.5 flex flex-col gap-1 border-b border-border-light">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-[16px] font-bold m-0 truncate text-text-primary font-heading">
                        {row.customer_name || row.customer_num}
                    </h3>
                    <span className="text-[11px] text-text-tertiary">#{row.customer_num}</span>
                    <div className="flex-1" />
                    {row.phone ? (
                        <a
                            href={`tel:${row.phone}`}
                            className="text-[12px] font-semibold inline-flex items-center gap-1.5 text-text-primary"
                        >
                            <i className="fas fa-phone text-[10px] text-text-tertiary" />
                            {formatCallListPhone(row.phone)}
                        </a>
                    ) : (
                        <span className="text-[11.5px] inline-flex items-center gap-1.5 text-text-tertiary">
                            <i className="fas fa-phone-slash text-[10px]" />
                            no phone
                        </span>
                    )}
                </div>
                {row.contact_name && (
                    <div className="text-[11.5px] truncate text-text-secondary">
                        <i className="fas fa-user mr-1.5 text-[10px] text-text-tertiary" />
                        {row.contact_name}
                    </div>
                )}
            </div>

            {/* Compact KPI strip — replaces the 4-card StatGroup so the action
             *  area surfaces in the same vertical real estate. */}
            <div className="px-4 py-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-[11.5px] border-b border-border-light text-text-secondary">
                <span className="inline-flex items-baseline gap-1" title={DateUtility.formatDate(row.last_pour_date)}>
                    <span className="font-bold text-[13px] font-heading" style={{ color: tone }}>
                        {row.days_since_last_pour}d
                    </span>
                    <span className="text-text-tertiary">dormant</span>
                </span>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-baseline gap-1" title="Pour days in the last 365 days">
                    <span className="font-bold text-[13px] text-text-primary font-heading">
                        {row.pour_days_last_year}
                    </span>
                    <span className="text-text-tertiary">pours/yr</span>
                </span>
                <span className="opacity-40">·</span>
                <span
                    className="inline-flex items-baseline gap-1"
                    title={
                        row.last_call_at
                            ? `Last call ${DateUtility.formatDateTime(row.last_call_at)}`
                            : 'No calls logged yet'
                    }
                >
                    <span className="font-bold text-[13px] text-text-primary font-heading">
                        {row.call_count_last_30 || 0}
                    </span>
                    <span className="text-text-tertiary">calls/30d</span>
                </span>
                {row.last_call_outcome && (
                    <>
                        <span className="opacity-40">·</span>
                        <span
                            className="inline-flex items-center gap-1"
                            title={row.last_call_by_name ? `Logged by ${row.last_call_by_name}` : undefined}
                        >
                            <span className="text-text-tertiary">last:</span>
                            <span
                                className="font-bold uppercase tracking-wider text-[10px]"
                                style={{ color: CALL_OUTCOME_COLORS[row.last_call_outcome] || 'var(--text-secondary)' }}
                            >
                                {CALL_OUTCOME_LABELS[row.last_call_outcome]}
                            </span>
                        </span>
                    </>
                )}
            </div>

            <div className="px-4 py-3 flex flex-col gap-2.5 border-b border-border-light">
                <div className="grid grid-cols-2 gap-2">
                    {CALL_OUTCOME_BUTTONS.map(({ color, icon, key, label }) => {
                        const busy = submitting === key
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => submit(key)}
                                disabled={isSaving || busy}
                                className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[12.5px] font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                                style={{
                                    background: `${color}29`,
                                    boxShadow: `inset 0 0 0 1px ${color}66`,
                                    color
                                }}
                            >
                                <i className={`fas ${icon} text-[11px]`} />
                                {label}
                            </button>
                        )
                    })}
                </div>
                <div className="flex flex-col gap-1.5">
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Optional comment — saved with the outcome above, or click Save Note for a comment-only entry."
                        rows={2}
                        className="w-full rounded-md p-2 text-[12px] resize-y outline-none bg-bg-secondary border border-border-light text-text-primary"
                    />
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-text-tertiary">
                            {currentUserName ? (
                                <>
                                    Logging as{' '}
                                    <span className="font-semibold text-text-secondary">{currentUserName}</span>
                                </>
                            ) : (
                                'Logging as your account'
                            )}
                        </span>
                        <button
                            type="button"
                            onClick={() => submit('note')}
                            disabled={!comment.trim() || submitting === 'note'}
                            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold cursor-pointer disabled:opacity-40 transition-colors bg-bg-secondary border border-border-light text-text-primary"
                        >
                            <i className="fas fa-note-sticky" />
                            Save Note
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col">
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-text-tertiary border-b border-border-light">
                    Call & Comment History
                </div>
                <HistoryList
                    currentUserId={currentUserId}
                    entries={history}
                    isLoading={isLoadingHistory}
                    onDelete={onDeleteEntry ? (logId) => onDeleteEntry(row.customer_num, logId) : null}
                />
            </div>
        </div>
    )
}
