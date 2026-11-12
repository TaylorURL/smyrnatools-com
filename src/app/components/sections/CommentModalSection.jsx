import React, { useCallback, useEffect, useRef, useState } from 'react'

import { UserService } from '../../../services/UserService'
import { formatCentralDate } from '../../../utils/PlanUtility'
import { isAutoResolvedNote, isResolvedComment } from '../../../utils/StaleNoteUtility'
import ConfirmDialog from '../common/ConfirmDialog'
import ErrorMessage from '../common/ErrorMessage'
import Skeleton, { SkeletonStack } from '../common/Skeleton'
import UserAvatar from '../common/UserAvatar'
import Dialog, { DIALOG_TEXTAREA } from '../ui/Dialog'
import TabButton from '../ui/TabButton'
import DockedPanel from './DockedPanel'
import KeepPermanentSwitch from './notes/KeepPermanentSwitch'
import NoteCountChip from './notes/NoteCountChip'
import NotePopupEyebrow from './notes/NotePopupEyebrow'
import { NOTE_ACTION_CLS, NOTE_COMPOSER_TEXTAREA } from './notes/notePopupStyles'
import NoteStatusChip from './notes/NoteStatusChip'
import ResolvedNoteLine from './notes/ResolvedNoteLine'

function CommentRowSkeleton() {
    return (
        <div className="flex items-start gap-3 border-b border-border-light px-6 py-3.5">
            <Skeleton className="h-8 w-8 shrink-0" rounded="rounded-full" />
            <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="mb-1.5 h-3 w-full" />
                <Skeleton className="h-3 w-3/5" />
            </div>
        </div>
    )
}

const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return formatCentralDate(date)
}

/**
 * @param {Object}   props
 * @param {string}   props.itemId       - DB id of the parent record.
 * @param {string}   props.itemNumber   - Human-readable identifier (truck #, name, etc.).
 * @param {string}   props.itemType     - Label like "Mixer" / "Operator".
 * @param {Function} props.onClose      - Invoked when the user dismisses the surface.
 * @param {Object}   props.service      - Service exposing fetchComments/addComment/deleteComment.
 * @param {'modal'|'panel'} [props.displayMode='modal']
 *        'modal' renders in the shared `Dialog` (default).
 *        'panel' renders the same header, composer and list inline as a card,
 *        used as a right-side panel on the asset/people list views. No portal,
 *        no scrim.
 */
function CommentModalSection({ itemId, itemNumber, itemType, onClose, service, displayMode = 'modal' }) {
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')
    const [permanent, setPermanent] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [userNames, setUserNames] = useState({})
    const [pendingDeleteId, setPendingDeleteId] = useState(null)
    const [activeTab, setActiveTab] = useState('active')

    // The Dialog's close handler stays the same function for its whole life:
    // a new one would re-run its open effect and pull focus out of the
    // composer whenever a parent re-renders. While the delete confirmation is
    // up, Escape belongs to it, so the dialog underneath ignores it.
    const onCloseRef = useRef(onClose)
    const confirmOpenRef = useRef(false)
    useEffect(() => {
        onCloseRef.current = onClose
        confirmOpenRef.current = pendingDeleteId !== null
    }, [onClose, pendingDeleteId])
    const handleDialogClose = useCallback(() => {
        if (!confirmOpenRef.current) onCloseRef.current()
    }, [])
    const cancelDelete = useCallback(() => setPendingDeleteId(null), [])

    const fetchComments = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const fetchedComments = await service.fetchComments(itemId)
            setComments(Array.isArray(fetchedComments) ? fetchedComments : [])
            const userIds = new Set()
            fetchedComments.forEach((comment) => {
                if (comment.author) userIds.add(comment.author)
            })
            const names = {}
            for (const userId of userIds) {
                try {
                    const displayName = await UserService.getUserDisplayName(userId)
                    names[userId] = displayName || 'Unknown'
                } catch {
                    names[userId] = 'Unknown'
                }
            }
            setUserNames((prev) => ({ ...prev, ...names }))
        } catch {
            setError('Failed to load comments. Please try again.')
            setComments([])
        } finally {
            setIsLoading(false)
        }
    }, [itemId, service])

    useEffect(() => {
        if (itemId) fetchComments()
    }, [itemId, fetchComments])

    const handleDeleteComment = (commentId) => setPendingDeleteId(commentId)

    const confirmDeleteComment = async () => {
        const commentId = pendingDeleteId
        setPendingDeleteId(null)
        try {
            await service.deleteComment(commentId)
            fetchComments()
        } catch {
            setError('Failed to delete comment. Please try again.')
        }
    }

    const handleAddComment = async (e) => {
        e.preventDefault()
        if (!newComment.trim()) {
            setError('Please enter a comment')
            return
        }
        setIsSubmitting(true)
        setError(null)
        try {
            const currentUser = await UserService.getCurrentUser()
            const userId = currentUser?.id || null
            if (!userId) {
                setError('You must be logged in to add comments')
                return
            }
            await service.addComment(itemId, newComment, userId, permanent)
            setNewComment('')
            setPermanent(false)
            fetchComments()
        } catch (err) {
            setError(err.message || 'Failed to add comment. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getAuthorName = (comment) => {
        if (comment.author && userNames[comment.author]) return userNames[comment.author]
        return 'Loading...'
    }

    const sortedComments = [...comments].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at)
        const dateB = new Date(b.createdAt || b.created_at)
        return dateB - dateA
    })
    // A comment stays active until it is resolved; the nightly job resolves
    // the ones left unkept for three months and flags them as timed out.
    const activeComments = sortedComments.filter((comment) => !isResolvedComment(comment))
    const resolvedComments = sortedComments.filter((comment) => isResolvedComment(comment))
    const displayComments = activeTab === 'active' ? activeComments : resolvedComments

    const isSubmitDisabled = isSubmitting || !newComment.trim()
    const isPanel = displayMode === 'panel'
    const eyebrow = <NotePopupEyebrow itemType={itemType} itemLabel={itemNumber || itemId} />
    const noun = String(itemType || 'item').toLowerCase()

    // List first, newest on top, with the composer pinned underneath so the
    // popup reads like a thread. Whether a comment is kept is chosen once, in
    // the composer, for the comment being posted; a posted comment shows what
    // was chosen and offers no way to change it.
    const body = isLoading ? (
        <SkeletonStack count={3} gapClassName="gap-0">
            {() => <CommentRowSkeleton />}
        </SkeletonStack>
    ) : displayComments.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
            <p className="m-0 text-[15px] font-medium text-text-primary">
                {activeTab === 'active' ? 'No comments yet' : 'No resolved comments'}
            </p>
            <p className="m-0 text-[13px] text-text-secondary">
                {activeTab === 'active'
                    ? 'Be the first to add one below.'
                    : 'Comments marked resolved, including ones that timed out, show up here.'}
            </p>
        </div>
    ) : (
        <ul className="m-0 list-none p-0">
            {displayComments.map((comment) => {
                const createdAt = comment.createdAt || comment.created_at
                const isResolved = isResolvedComment(comment)
                return (
                    <li
                        key={comment.id}
                        className="flex items-start gap-3 border-b border-border-light px-6 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-bg-hover motion-reduce:transition-none"
                    >
                        <UserAvatar name={getAuthorName(comment)} userId={comment.author} size={32} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-[13px] font-semibold text-text-primary">
                                    {getAuthorName(comment)}
                                </span>
                                <span className="text-[12px] tabular-nums text-text-tertiary">
                                    {formatDate(createdAt)}
                                </span>
                                <NoteStatusChip
                                    createdAt={createdAt}
                                    permanent={comment.permanent}
                                    resolved={isResolved}
                                />
                            </div>
                            <p className="m-0 mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-text-primary">
                                {comment.text}
                            </p>
                            {isResolved && (
                                <div className="mt-1.5">
                                    <ResolvedNoteLine
                                        autoResolved={isAutoResolvedNote(comment)}
                                        when={formatDate(comment.resolvedAt || comment.resolved_at)}
                                    />
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            aria-label="Delete comment"
                            className={`${NOTE_ACTION_CLS} text-text-tertiary hover:text-status-danger`}
                        >
                            Delete
                        </button>
                    </li>
                )
            })}
        </ul>
    )

    const composer =
        activeTab === 'active' ? (
            <form onSubmit={handleAddComment} className="flex w-full flex-col gap-2.5" aria-label="New comment">
                <span className="text-[12px] font-semibold text-text-secondary">New comment</span>
                <ErrorMessage message={error} onDismiss={() => setError(null)} />
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={`Write a comment for this ${noun}…`}
                    aria-label="Write a comment"
                    disabled={isSubmitting}
                    rows="3"
                    className={`${DIALOG_TEXTAREA} ${NOTE_COMPOSER_TEXTAREA}`}
                />
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3">
                    <KeepPermanentSwitch
                        checked={permanent}
                        disabled={isSubmitting}
                        noun="comment"
                        onChange={setPermanent}
                    />
                    <button type="submit" disabled={isSubmitDisabled} className="btn-primary ml-auto">
                        {isSubmitting ? 'Posting' : 'Post comment'}
                    </button>
                </div>
            </form>
        ) : null

    const confirmDialog = (
        <ConfirmDialog
            isOpen={pendingDeleteId !== null}
            onConfirm={confirmDeleteComment}
            onCancel={cancelDelete}
            title="Delete this comment?"
            message="This can't be undone."
            confirmLabel="Delete"
            variant="danger"
        />
    )

    const title = (
        <span className="inline-flex items-center gap-2">
            Comments
            {!isLoading && <NoteCountChip count={activeComments.length} />}
        </span>
    )

    // Active and Resolved are two views of the list, laid on the toolbar's
    // bottom rule the same way the issues popup lays Open and Resolved.
    const toolbar = (
        <div className="-mb-[17px] flex gap-5 overflow-x-auto pb-px">
            {[
                { count: activeComments.length, id: 'active', label: 'Active' },
                { count: resolvedComments.length, id: 'resolved', label: 'Resolved' }
            ].map((tab) => (
                <TabButton
                    key={tab.id}
                    label={
                        <>
                            {tab.label}
                            {!isLoading && (
                                <span className="ml-1.5">
                                    <NoteCountChip count={tab.count} />
                                </span>
                            )}
                        </>
                    }
                    isActive={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                />
            ))}
        </div>
    )

    if (isPanel) {
        return (
            <>
                <DockedPanel
                    onClose={onClose}
                    eyebrow={eyebrow}
                    title={title}
                    toolbar={toolbar}
                    footer={composer}
                    bodyClassName="p-0"
                >
                    {body}
                </DockedPanel>
                {confirmDialog}
            </>
        )
    }

    return (
        <>
            <Dialog
                open
                onClose={handleDialogClose}
                size="md"
                eyebrow={eyebrow}
                title={title}
                toolbar={toolbar}
                footer={composer}
                bodyClassName="p-0"
            >
                {body}
            </Dialog>
            {confirmDialog}
        </>
    )
}

export default CommentModalSection
