import React, { useCallback, useEffect, useRef, useState } from 'react'

import { UserService } from '../../../services/UserService'
import { SEVERITY_TO_TONE } from '../../constants/issueModalConstants'
import Badge from '../common/Badge'
import ConfirmDialog from '../common/ConfirmDialog'
import ErrorMessage from '../common/ErrorMessage'
import { SkeletonStack } from '../common/Skeleton'
import Dialog, { DIALOG_TEXTAREA } from '../ui/Dialog'
import TabButton from '../ui/TabButton'
import DockedPanel from './DockedPanel'
import { formatDate } from './issue-modal/issueModalHelpers'
import { IssueRowSkeleton } from './issue-modal/IssueModalSkeletons'
import SegmentedChoice from './issue-modal/SegmentedChoice'
import SendIssueMessageModal from './issue-modal/SendIssueMessageModal'

const SEVERITY_OPTIONS = ['Low', 'Medium', 'High'].map((sev) => ({ id: sev, label: sev }))

const ROW_ACTION_CLS =
    'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none'

/**
 * Issue list and composer for one asset. `displayMode: 'panel'` drops the
 * shared `Dialog` and renders the same header, switcher, composer and list
 * inline as a card, which is how the right-side panel on the list views
 * mounts it. The nested SendIssueMessageModal is a portal either way so the
 * panel's own stacking context cannot clip it.
 */
function IssueModalSection({ itemId, itemNumber, itemType, onClose, service, displayMode = 'modal' }) {
    const [issues, setIssues] = useState([])
    const [newIssue, setNewIssue] = useState('')
    const [severity, setSeverity] = useState('Medium')
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [userNames, setUserNames] = useState({})
    const [canDelete, setCanDelete] = useState(false)
    const [activeTab, setActiveTab] = useState('open')
    const [messageIssue, setMessageIssue] = useState(null)
    const [pendingDeleteId, setPendingDeleteId] = useState(null)

    // The Dialog's close handler stays the same function for its whole life:
    // a new one would re-run its open effect and pull focus out of the
    // composer whenever a parent re-renders. While the delete confirmation or
    // the send-message dialog is up, Escape belongs to that one, so the
    // dialog underneath ignores it.
    const onCloseRef = useRef(onClose)
    const nestedOpenRef = useRef(false)
    useEffect(() => {
        onCloseRef.current = onClose
        nestedOpenRef.current = pendingDeleteId !== null || messageIssue !== null
    }, [onClose, pendingDeleteId, messageIssue])
    const handleDialogClose = useCallback(() => {
        if (!nestedOpenRef.current) onCloseRef.current()
    }, [])
    const closeMessage = useCallback(() => setMessageIssue(null), [])
    const cancelDelete = useCallback(() => setPendingDeleteId(null), [])

    useEffect(() => {
        async function checkDeletePermission() {
            try {
                const currentUser = await UserService.getCurrentUser()
                const userId = currentUser?.id || null
                if (userId) {
                    const hasPermission = await UserService.hasPermission(userId, 'detailview.bypass.plantrestriction')
                    setCanDelete(hasPermission)
                }
            } catch {
                setCanDelete(false)
            }
        }
        checkDeletePermission()
    }, [])

    const sortedIssues = [...issues].sort((a, b) => new Date(b.time_created) - new Date(a.time_created))
    const openIssues = sortedIssues.filter((issue) => !issue.time_completed)
    const resolvedIssues = sortedIssues.filter((issue) => issue.time_completed)

    const fetchIssues = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const fetchedIssues = await service.fetchIssues(itemId)
            setIssues(Array.isArray(fetchedIssues) ? fetchedIssues : [])
            const userIds = new Set()
            fetchedIssues.forEach((issue) => {
                if (issue.created_by) userIds.add(issue.created_by)
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
            setError('Failed to load issues. Please try again.')
            setIssues([])
        } finally {
            setIsLoading(false)
        }
    }, [itemId, service])

    useEffect(() => {
        if (itemId) fetchIssues()
    }, [itemId, fetchIssues])

    const handleDeleteIssue = (issueId) => setPendingDeleteId(issueId)

    const confirmDeleteIssue = async () => {
        const issueId = pendingDeleteId
        setPendingDeleteId(null)
        try {
            await service.deleteIssue(issueId)
            fetchIssues()
        } catch {
            setError('Failed to delete issue. Please try again.')
        }
    }

    const handleCompleteIssue = async (issueId) => {
        try {
            await service.completeIssue(issueId)
            fetchIssues()
        } catch {
            setError('Failed to complete issue. Please try again.')
        }
    }

    const handleAddIssue = async (e) => {
        e.preventDefault()
        if (!newIssue.trim()) {
            setError('Please enter an issue description')
            return
        }
        setIsSubmitting(true)
        setError(null)
        try {
            const currentUser = await UserService.getCurrentUser()
            const userId = currentUser?.id || null
            if (!userId) {
                setError('You must be logged in to add an issue')
                return
            }
            await service.addIssue(itemId, newIssue, severity, userId)
            setNewIssue('')
            setSeverity('Medium')
            fetchIssues()
        } catch (err) {
            setError(err.message || 'Failed to add issue. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getCreatorName = (issue) => {
        if (issue.created_by && userNames[issue.created_by]) return userNames[issue.created_by]
        return 'Unknown'
    }

    const displayIssues = activeTab === 'open' ? openIssues : resolvedIssues
    const isPanel = displayMode === 'panel'
    const isSubmitDisabled = isSubmitting || !newIssue.trim()
    const title = itemNumber || itemId
    const eyebrow = isLoading
        ? itemType
        : `${itemType} · ${openIssues.length} open ${openIssues.length === 1 ? 'issue' : 'issues'}`

    // Open and Resolved are two views of the list, so they are underline tabs
    // laid on the toolbar's bottom rule exactly as the history popup lays its
    // own (pulled down by the toolbar's 16px padding plus the 1px the active
    // tab's bar overlaps).
    const toolbar = (
        <div className="-mb-[17px] flex gap-5 overflow-x-auto pb-px">
            {[
                { count: openIssues.length, id: 'open', label: 'Open' },
                { count: resolvedIssues.length, id: 'resolved', label: 'Resolved' }
            ].map((tab) => (
                <TabButton
                    key={tab.id}
                    label={
                        <>
                            {tab.label}
                            <span className="ml-1.5 font-normal tabular-nums text-text-tertiary">{tab.count}</span>
                        </>
                    }
                    isActive={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                />
            ))}
        </div>
    )

    const body = (
        <>
            {error && (
                <div className="px-6 pt-4">
                    <ErrorMessage message={error} onDismiss={() => setError(null)} />
                </div>
            )}

            {activeTab === 'open' && (
                <form onSubmit={handleAddIssue} className="flex flex-col gap-3 border-b border-border-light px-6 py-4">
                    <textarea
                        value={newIssue}
                        onChange={(e) => setNewIssue(e.target.value)}
                        placeholder="What's the issue?"
                        aria-label="Describe the issue"
                        disabled={isSubmitting}
                        rows="3"
                        className={DIALOG_TEXTAREA}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Severity</span>
                            <SegmentedChoice
                                ariaLabel="Severity"
                                onChange={setSeverity}
                                options={SEVERITY_OPTIONS}
                                value={severity}
                            />
                        </div>
                        <button type="submit" disabled={isSubmitDisabled} className="btn-primary">
                            {isSubmitting ? 'Submitting' : 'Submit'}
                        </button>
                    </div>
                </form>
            )}

            {isLoading ? (
                <SkeletonStack count={3} gapClassName="gap-0">
                    {() => <IssueRowSkeleton />}
                </SkeletonStack>
            ) : displayIssues.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                    <p className="m-0 text-[15px] font-medium text-text-primary">
                        {activeTab === 'open' ? 'No open issues' : 'No resolved issues yet'}
                    </p>
                    <p className="m-0 text-[13px] text-text-secondary">
                        {activeTab === 'open'
                            ? 'Report one above when something needs fixing.'
                            : 'Issues marked resolved show up here.'}
                    </p>
                </div>
            ) : (
                <ul className="m-0 list-none p-0">
                    {displayIssues.map((issue) => {
                        const isResolved = !!issue.time_completed
                        return (
                            <li
                                key={issue.id}
                                className="flex items-start gap-3 border-b border-border-light px-6 py-3 transition-colors duration-150 hover:bg-bg-hover motion-reduce:transition-none"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <Badge tone={SEVERITY_TO_TONE[issue.severity] || 'warning'} size="sm">
                                            {issue.severity}
                                        </Badge>
                                        <span className="text-[13px] font-medium text-text-primary">
                                            {getCreatorName(issue)}
                                        </span>
                                        <span className="text-[12px] tabular-nums text-text-tertiary">
                                            {formatDate(issue.time_created)}
                                        </span>
                                    </div>
                                    <p className="m-0 mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-primary">
                                        {issue.issue}
                                    </p>
                                    {isResolved && (
                                        <p className="m-0 mt-1 text-[12px] text-text-secondary">
                                            Resolved {formatDate(issue.time_completed)}
                                        </p>
                                    )}
                                </div>
                                <div className="-mr-2 flex shrink-0">
                                    {!isResolved && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleCompleteIssue(issue.id)}
                                                title="Mark resolved"
                                                aria-label="Mark resolved"
                                                className={`${ROW_ACTION_CLS} text-text-secondary hover:text-text-primary`}
                                            >
                                                <i className="fas fa-check text-[12px]" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMessageIssue(issue)}
                                                title="Send message"
                                                aria-label="Send message"
                                                className={`${ROW_ACTION_CLS} text-text-secondary hover:text-text-primary`}
                                            >
                                                <i className="fas fa-paper-plane text-[12px]" aria-hidden="true" />
                                            </button>
                                        </>
                                    )}
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteIssue(issue.id)}
                                            title="Delete"
                                            aria-label="Delete issue"
                                            className={`${ROW_ACTION_CLS} text-text-tertiary hover:text-status-danger`}
                                        >
                                            <i className="fas fa-trash text-[12px]" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </>
    )

    const overlays = (
        <>
            {messageIssue && (
                <SendIssueMessageModal
                    issue={messageIssue}
                    itemNumber={itemNumber}
                    itemType={itemType}
                    creatorName={getCreatorName(messageIssue)}
                    onClose={closeMessage}
                />
            )}
            <ConfirmDialog
                isOpen={pendingDeleteId !== null}
                onConfirm={confirmDeleteIssue}
                onCancel={cancelDelete}
                title="Delete this issue?"
                message="This can't be undone."
                confirmLabel="Delete"
                variant="danger"
            />
        </>
    )

    if (isPanel) {
        return (
            <>
                <DockedPanel onClose={onClose} eyebrow={eyebrow} title={title} toolbar={toolbar} bodyClassName="p-0">
                    {body}
                </DockedPanel>
                {overlays}
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
                bodyClassName="p-0"
            >
                {body}
            </Dialog>
            {overlays}
        </>
    )
}

export default IssueModalSection
