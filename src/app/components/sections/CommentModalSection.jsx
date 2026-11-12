import React, { useCallback, useEffect, useRef, useState } from 'react'

import { UserService } from '../../../services/UserService'
import { formatCentralDate } from '../../../utils/PlanUtility'
import { isStaleNote } from '../../../utils/StaleNoteUtility'
import Badge from '../common/Badge'
import ConfirmDialog from '../common/ConfirmDialog'
import ErrorMessage from '../common/ErrorMessage'
import Skeleton, { SkeletonStack } from '../common/Skeleton'
import StaleNoteFlag from '../common/StaleNoteFlag'
import Dialog, { DIALOG_TEXTAREA } from '../ui/Dialog'
import DockedPanel from './DockedPanel'

function CommentRowSkeleton() {
    return (
        <div className="border-b border-border-light px-6 py-3">
            <div className="mb-2 flex items-center gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="mb-1.5 h-3 w-full" />
            <Skeleton className="h-3 w-3/5" />
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

    const isSubmitDisabled = isSubmitting || !newComment.trim()
    const isPanel = displayMode === 'panel'
    const eyebrow = isLoading
        ? itemType
        : `${itemType} · ${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`

    const body = (
        <>
            <form onSubmit={handleAddComment} className="flex flex-col gap-3 border-b border-border-light px-6 py-4">
                <ErrorMessage message={error} onDismiss={() => setError(null)} />
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment"
                    aria-label="Write a comment"
                    disabled={isSubmitting}
                    rows="3"
                    className={DIALOG_TEXTAREA}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-secondary">
                        <input
                            type="checkbox"
                            checked={permanent}
                            onChange={(e) => setPermanent(e.target.checked)}
                            disabled={isSubmitting}
                        />
                        Permanent (never auto-deleted)
                    </label>
                    <button type="submit" disabled={isSubmitDisabled} className="btn-primary">
                        {isSubmitting ? 'Posting' : 'Post'}
                    </button>
                </div>
            </form>

            {isLoading ? (
                <SkeletonStack count={3} gapClassName="gap-0">
                    {() => <CommentRowSkeleton />}
                </SkeletonStack>
            ) : comments.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                    <p className="m-0 text-[15px] font-medium text-text-primary">No comments yet</p>
                    <p className="m-0 text-[13px] text-text-secondary">Be the first to add one.</p>
                </div>
            ) : (
                <ul className="m-0 list-none p-0">
                    {sortedComments.map((comment) => (
                        <li
                            key={comment.id}
                            className="flex items-start gap-3 border-b border-border-light px-6 py-3 transition-colors duration-150 hover:bg-bg-hover motion-reduce:transition-none"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="text-[13px] font-medium text-text-primary">
                                        {getAuthorName(comment)}
                                    </span>
                                    <span className="text-[12px] tabular-nums text-text-tertiary">
                                        {formatDate(comment.createdAt || comment.created_at)}
                                    </span>
                                    {comment.permanent ? (
                                        <Badge tone="neutral" size="xs" icon="thumbtack">
                                            Permanent
                                        </Badge>
                                    ) : (
                                        isStaleNote(comment.createdAt || comment.created_at) && <StaleNoteFlag />
                                    )}
                                </div>
                                <p className="m-0 mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-primary">
                                    {comment.text}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDeleteComment(comment.id)}
                                title="Delete"
                                aria-label="Delete comment"
                                className="-mr-2 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-text-tertiary transition-colors duration-150 hover:bg-bg-tertiary hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                            >
                                <i className="fas fa-trash text-[12px]" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    )

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

    const title = itemNumber || itemId

    if (isPanel) {
        return (
            <>
                <DockedPanel onClose={onClose} eyebrow={eyebrow} title={title} bodyClassName="p-0">
                    {body}
                </DockedPanel>
                {confirmDialog}
            </>
        )
    }

    return (
        <>
            <Dialog open onClose={handleDialogClose} size="md" eyebrow={eyebrow} title={title} bodyClassName="p-0">
                {body}
            </Dialog>
            {confirmDialog}
        </>
    )
}

export default CommentModalSection
