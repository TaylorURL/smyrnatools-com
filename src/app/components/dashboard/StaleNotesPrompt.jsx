import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { noteAgeInDays, STALE_NOTE_DAYS } from '../../../utils/StaleNoteUtility'
import { SEVERITY_TO_TONE } from '../../constants/issueModalConstants'
import Badge from '../common/Badge'
import ConfirmDialog from '../common/ConfirmDialog'
import ErrorMessage from '../common/ErrorMessage'
import Dialog from '../ui/Dialog'
import TabButton from '../ui/TabButton'

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/** "4 comments and 1 open issue", leaving out whichever kind has none. */
const summarize = (commentCount, issueCount) =>
    [
        commentCount ? plural(commentCount, 'comment', 'comments') : '',
        issueCount ? plural(issueCount, 'open issue', 'open issues') : ''
    ]
        .filter(Boolean)
        .join(' and ')

function StaleNoteRow({ busy, note, onKeep, onRemove }) {
    const days = noteAgeInDays(note.createdAt)
    const asset = [note.assetType, note.assetLabel].filter(Boolean).join(' ')
    return (
        <li className="flex flex-col gap-3 border-b border-border-light px-6 py-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {note.kind === 'issue' && (
                        <Badge tone={SEVERITY_TO_TONE[note.severity] || 'warning'} size="sm">
                            {note.severity || 'Medium'}
                        </Badge>
                    )}
                    <span className="text-[13px] font-medium text-text-primary">{asset}</span>
                    {note.plantCode && (
                        <span className="text-[12px] tabular-nums text-text-tertiary">Plant {note.plantCode}</span>
                    )}
                </div>
                <p className="m-0 mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-primary">
                    {note.text}
                </p>
                <p className="m-0 mt-1 text-[12px] tabular-nums text-text-secondary">
                    {note.authorName} · {plural(days, 'day', 'days')} ago
                </p>
            </div>
            <div className="flex shrink-0 gap-2">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => onKeep(note)}>
                    Keep
                </button>
                <button type="button" className="btn-danger" disabled={busy} onClick={() => onRemove(note)}>
                    {busy ? 'Removing' : 'Remove'}
                </button>
            </div>
        </li>
    )
}

/**
 * The dashboard's nudge to clear out old notes: a small card in the corner
 * saying how many comments and open issues at the manager's plants are past
 * `STALE_NOTE_DAYS`, and a dialog to go through them. Each one can be removed
 * (deleted for good) or kept (left alone and not asked about again).
 *
 * The card and the dialog both end the prompt for this visit when closed.
 * `onChanged` runs on close if anything was removed, so the dashboard's own
 * counts can catch up.
 */
export default function StaleNotesPrompt({ notes, onChanged, onDismiss, onKeep, onRemove }) {
    const [reviewing, setReviewing] = useState(false)
    const [tab, setTab] = useState(null)
    const [busyKeys, setBusyKeys] = useState(() => new Set())
    const [error, setError] = useState(null)
    const [confirmingAll, setConfirmingAll] = useState(false)
    const removedRef = useRef(false)
    // While the remove-all confirmation is up, Escape belongs to it, so the
    // review dialog underneath ignores its close.
    const confirmOpenRef = useRef(false)
    useEffect(() => {
        confirmOpenRef.current = confirmingAll
    }, [confirmingAll])

    const comments = notes.filter((n) => n.kind === 'comment')
    const issues = notes.filter((n) => n.kind === 'issue')
    const activeTab = tab || 'comments'
    const shown = activeTab === 'comments' ? comments : issues

    const close = useCallback(() => {
        if (confirmOpenRef.current) return
        setReviewing(false)
        onDismiss()
        if (removedRef.current) onChanged?.()
    }, [onChanged, onDismiss])

    const removeNotes = async (list) => {
        setError(null)
        setBusyKeys((keys) => new Set([...keys, ...list.map((n) => n.key)]))
        let failed = 0
        for (const note of list) {
            try {
                await onRemove(note)
                removedRef.current = true
            } catch {
                failed++
            }
            setBusyKeys((keys) => {
                const next = new Set(keys)
                next.delete(note.key)
                return next
            })
        }
        if (failed)
            setError(
                failed === 1
                    ? "Couldn't remove one of them. Please try again."
                    : `Couldn't remove ${failed} of them. Please try again.`
            )
    }

    if (!reviewing && !notes.length) return null
    if (typeof document === 'undefined' || !document.body) return null

    if (!reviewing) {
        return ReactDOM.createPortal(
            <div
                role="status"
                aria-live="polite"
                className="fixed inset-x-4 bottom-4 z-panel rounded-card border border-border-light bg-bg-primary shadow-modal animate-fade-slide-in motion-reduce:animate-none sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[340px]"
            >
                <div className="flex items-start gap-3 p-4">
                    <i className="fas fa-clock-rotate-left mt-1 text-[13px] text-status-warning" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <p className="m-0 font-heading text-[15px] font-semibold text-text-primary">
                            Old notes at your plants
                        </p>
                        <p className="m-0 mt-1 text-[13px] leading-relaxed text-text-secondary">
                            {summarize(comments.length, issues.length)} {notes.length === 1 ? 'is' : 'are'} over{' '}
                            {STALE_NOTE_DAYS} days old and may be out of date.
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                            <button type="button" className="btn-secondary" onClick={close}>
                                Not now
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => {
                                    // The tab is picked once, here, so emptying it shows
                                    // its empty state rather than jumping to the other.
                                    setTab(comments.length ? 'comments' : 'issues')
                                    setReviewing(true)
                                }}
                            >
                                Review
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )
    }

    const toolbar = (
        <div className="-mb-[17px] flex gap-5 overflow-x-auto pb-px">
            {[
                { count: comments.length, id: 'comments', label: 'Comments' },
                { count: issues.length, id: 'issues', label: 'Issues' }
            ].map((t) => (
                <TabButton
                    key={t.id}
                    label={
                        <>
                            {t.label}
                            <span className="ml-1.5 font-normal tabular-nums text-text-tertiary">{t.count}</span>
                        </>
                    }
                    isActive={activeTab === t.id}
                    onClick={() => setTab(t.id)}
                />
            ))}
        </div>
    )

    const anyBusy = busyKeys.size > 0
    const footer = (
        <>
            {shown.length > 1 && (
                <button
                    type="button"
                    className="btn-danger mr-auto"
                    disabled={anyBusy}
                    onClick={() => setConfirmingAll(true)}
                >
                    Remove all {shown.length}
                </button>
            )}
            <button type="button" className="btn-primary" onClick={close}>
                Done
            </button>
        </>
    )

    return (
        <>
            <Dialog
                open
                onClose={close}
                size="lg"
                eyebrow={`Over ${STALE_NOTE_DAYS} days old`}
                title="Old comments and issues"
                description="These may no longer be accurate. Remove what doesn't apply anymore, or keep it."
                toolbar={toolbar}
                footer={footer}
                bodyClassName="p-0"
            >
                {error && (
                    <div className="px-6 pt-4">
                        <ErrorMessage message={error} onDismiss={() => setError(null)} />
                    </div>
                )}
                {shown.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                        <p className="m-0 text-[15px] font-medium text-text-primary">
                            {activeTab === 'comments' ? 'No old comments left' : 'No old issues left'}
                        </p>
                        <p className="m-0 text-[13px] text-text-secondary">
                            {notes.length ? 'The other tab still has some to look at.' : "You're all caught up."}
                        </p>
                    </div>
                ) : (
                    <ul className="m-0 list-none p-0">
                        {shown.map((note) => (
                            <StaleNoteRow
                                key={note.key}
                                busy={busyKeys.has(note.key)}
                                note={note}
                                onKeep={onKeep}
                                onRemove={(n) => removeNotes([n])}
                            />
                        ))}
                    </ul>
                )}
            </Dialog>
            <ConfirmDialog
                isOpen={confirmingAll}
                onConfirm={() => {
                    setConfirmingAll(false)
                    removeNotes(shown)
                }}
                onCancel={() => setConfirmingAll(false)}
                title={`Remove all ${plural(shown.length, activeTab === 'comments' ? 'old comment' : 'old issue', activeTab === 'comments' ? 'old comments' : 'old issues')}?`}
                message="This can't be undone."
                confirmLabel="Remove all"
                variant="danger"
            />
        </>
    )
}
