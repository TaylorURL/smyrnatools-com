/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { CALL_OUTCOME_COLORS, CALL_OUTCOME_LABELS } from '../../../../../../utils/CallListUtility'
import DateUtility from '../../../../../../utils/DateUtility'
import { useConfirm } from '../../../../../context/ConfirmContext'
import { SkelBar } from './SkelBar'

export function HistoryEntries({ currentUserId, entries, isLoading, onDelete }) {
    const [deletingId, setDeletingId] = useState(null)
    const confirm = useConfirm()
    if (isLoading) {
        return <HistoryEntriesSkeleton />
    }
    if (!entries?.length) {
        return <div className="text-xs italic px-4 py-3 text-text-tertiary">No calls logged yet.</div>
    }
    const handleDelete = async (entry) => {
        if (!onDelete) return
        const ok = await confirm({
            title: 'Delete this entry?',
            message: 'This cannot be undone.',
            confirmLabel: 'Delete'
        })
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
                                        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded border-none cursor-pointer disabled:opacity-40 bg-transparent text-text-tertiary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
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

export function HistoryEntriesSkeleton() {
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
