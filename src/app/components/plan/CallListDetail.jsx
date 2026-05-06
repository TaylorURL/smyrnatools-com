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
import { Stat, StatGroup } from '../ui/Panel'

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
        return (
            <div className="text-xs italic px-3 py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                Loading history…
            </div>
        )
    }
    if (!entries?.length) {
        return (
            <div className="text-xs italic px-3 py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No calls logged yet.
            </div>
        )
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
                            <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[9.5px]"
                                style={{
                                    background: `${CALL_OUTCOME_COLORS[entry.outcome] || '#64748b'}1f`,
                                    color: CALL_OUTCOME_COLORS[entry.outcome] || '#64748b'
                                }}
                            >
                                {CALL_OUTCOME_LABELS[entry.outcome] || entry.outcome}
                            </span>
                            <span
                                className="inline-flex items-center gap-1.5"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                <span>{DateUtility.formatDateTime(entry.created_at)}</span>
                                {entry.created_by_name && (
                                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        · {entry.created_by_name}
                                    </span>
                                )}
                                {canDelete && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(entry)}
                                        disabled={deletingId === entry.id}
                                        title="Delete this entry"
                                        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded border-none cursor-pointer disabled:opacity-40"
                                        style={{ background: 'transparent', color: 'var(--text-tertiary)' }}
                                    >
                                        <i className="fas fa-trash text-[10px]" />
                                    </button>
                                )}
                            </span>
                        </div>
                        {entry.comment && (
                            <div className="text-[12px] whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                                {entry.comment}
                            </div>
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
            <div
                className="flex items-center justify-center text-sm italic p-8"
                style={{ color: 'var(--text-tertiary)' }}
            >
                Select a customer from the list to log a call.
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
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-[18px] font-bold m-0 truncate" style={{ color: 'var(--text-primary)' }}>
                        {row.customer_name || row.customer_num}
                    </h3>
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        #{row.customer_num}
                    </span>
                </div>
                <div
                    className="flex items-center gap-3 mt-1.5 flex-wrap text-[12px]"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {row.contact_name && (
                        <span>
                            <i className="fas fa-user mr-1" style={{ color: 'var(--text-tertiary)' }} />
                            {row.contact_name}
                        </span>
                    )}
                    {row.phone ? (
                        <a
                            href={`tel:${row.phone}`}
                            className="font-semibold underline"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            <i className="fas fa-phone mr-1" />
                            {formatCallListPhone(row.phone)}
                        </a>
                    ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>
                            <i className="fas fa-phone-slash mr-1" />
                            no phone on file
                        </span>
                    )}
                </div>
            </div>

            <StatGroup columns={4} className="rounded-none border-x-0">
                <Stat
                    hint={DateUtility.formatDate(row.last_pour_date)}
                    label="Days dormant"
                    value={row.days_since_last_pour}
                    valueColor={tone}
                />
                <Stat hint="last 365 days" label="Pours / yr" value={row.pour_days_last_year} />
                <Stat
                    hint={row.last_call_at ? `last ${DateUtility.formatDateTime(row.last_call_at)}` : 'no calls yet'}
                    label="Calls / 30d"
                    value={row.call_count_last_30 || 0}
                />
                <Stat
                    hint={row.last_call_by_name || ' '}
                    label="Last outcome"
                    value={row.last_call_outcome ? CALL_OUTCOME_LABELS[row.last_call_outcome] : '—'}
                    valueColor={row.last_call_outcome ? CALL_OUTCOME_COLORS[row.last_call_outcome] : undefined}
                />
            </StatGroup>

            <div className="px-4 py-3 flex flex-col gap-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="grid grid-cols-2 gap-2">
                    {CALL_OUTCOME_BUTTONS.map(({ color, icon, key, label }) => {
                        const busy = submitting === key
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => submit(key)}
                                disabled={isSaving || busy}
                                className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-semibold border-none cursor-pointer disabled:opacity-50"
                                style={{ background: `${color}1f`, color }}
                            >
                                <i className={`fas ${icon}`} />
                                {label}
                            </button>
                        )
                    })}
                </div>
                <div className="flex flex-col gap-1.5">
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Comment (saved with the outcome above, or click Save Note for a comment-only entry)"
                        rows={2}
                        className="w-full rounded-md p-2 text-[12px] resize-y"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                    />
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                            {currentUserName ? (
                                <>
                                    Logging as{' '}
                                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        {currentUserName}
                                    </span>
                                </>
                            ) : (
                                'Logging as your account'
                            )}
                        </span>
                        <button
                            type="button"
                            onClick={() => submit('note')}
                            disabled={!comment.trim() || submitting === 'note'}
                            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold border-none cursor-pointer disabled:opacity-40"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                            <i className="fas fa-note-sticky" />
                            Save Note
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col">
                <div
                    className="px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-light)' }}
                >
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
