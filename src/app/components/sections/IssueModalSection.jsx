import React, { useCallback, useEffect, useRef, useState } from 'react'

import { UserService } from '../../../services/UserService'
import { SEVERITY_TO_BAR, SEVERITY_TO_TONE } from '../../constants/issueModalConstants'
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
import KeepPermanentSwitch from './notes/KeepPermanentSwitch'
import NoteCountChip from './notes/NoteCountChip'
import NotePopupEyebrow from './notes/NotePopupEyebrow'
import { NOTE_ACTION_CLS, NOTE_COMPOSER_TEXTAREA } from './notes/notePopupStyles'
import NoteStatusChip from './notes/NoteStatusChip'
import ResolvedNoteLine from './notes/ResolvedNoteLine'

const SEVERITY_OPTIONS = ['Low', 'Medium', 'High'].map((sev) => ({ id: sev, label: sev }))

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
    const [permanent, setPermanent] = useState(false)
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
            await service.addIssue(itemId, newIssue, severity, userId, permanent)
            setNewIssue('')
            setSeverity('Medium')
            setPermanent(false)
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
    const title = 'Issues'
    const eyebrow = <NotePopupEyebrow itemType={itemType} itemLabel={itemNumber || itemId} />
    const noun = String(itemType || 'item').toLowerCase()

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

    // List first, newest on top, with the composer pinned underneath on the
    // Open tab so the popup reads like a thread. Whether an issue is kept is
    // chosen once, in the composer, for the issue being reported; a reported
    // issue shows what was chosen and offers no way to change it.
    const body = (
        <>
            {error && activeTab !== 'open' && (
                <div className="px-6 pt-4">
                    <ErrorMessage message={error} onDismiss={() => setError(null)} />
                </div>
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
                            ? 'Report one below when something needs fixing.'
                            : 'Issues marked resolved, including ones that timed out, show up here.'}
                    </p>
                </div>
            ) : (
                <ul className="m-0 list-none p-0">
                    {displayIssues.map((issue) => {
                        const isResolved = !!issue.time_completed
                        return (
                            <li
                                key={issue.id}
                                className="flex items-start gap-3 border-b border-border-light px-6 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-bg-hover motion-reduce:transition-none"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`w-1 shrink-0 self-stretch rounded-[2px] ${
                                        SEVERITY_TO_BAR[issue.severity] || SEVERITY_TO_BAR.Medium
                                    }`}
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <p className="m-0 whitespace-pre-wrap break-words text-[13px] font-medium leading-5 text-text-primary">
                                        {issue.issue}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <Badge tone={SEVERITY_TO_TONE[issue.severity] || 'warning'} size="xs">
                                            {issue.severity}
                                        </Badge>
                                        <span className="text-[12px] tabular-nums text-text-tertiary">
                                            {getCreatorName(issue)} · {formatDate(issue.time_created)}
                                        </span>
                                        <NoteStatusChip
                                            createdAt={issue.time_created}
                                            permanent={issue.permanent}
                                            resolved={isResolved}
                                        />
                                    </div>
                                    {isResolved && (
                                        <ResolvedNoteLine
                                            autoResolved={issue.auto_resolved === true}
                                            when={formatDate(issue.time_completed)}
                                        />
                                    )}
                                </div>
                                <div className="-mr-1.5 flex shrink-0 items-center">
                                    {!isResolved && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleCompleteIssue(issue.id)}
                                                aria-label="Mark resolved"
                                                className={`${NOTE_ACTION_CLS} font-semibold text-status-active hover:bg-bg-tertiary`}
                                            >
                                                Resolve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMessageIssue(issue)}
                                                aria-label="Send message"
                                                className={`${NOTE_ACTION_CLS} text-text-secondary hover:bg-bg-tertiary hover:text-text-primary`}
                                            >
                                                Message
                                            </button>
                                        </>
                                    )}
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteIssue(issue.id)}
                                            aria-label="Delete issue"
                                            className={`${NOTE_ACTION_CLS} text-text-tertiary hover:bg-bg-tertiary hover:text-status-danger`}
                                        >
                                            Delete
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

    const composer =
        activeTab === 'open' ? (
            <form onSubmit={handleAddIssue} className="flex w-full flex-col gap-2.5" aria-label="Report a new issue">
                <span className="text-[12px] font-semibold text-text-secondary">Report a new issue</span>
                <ErrorMessage message={error} onDismiss={() => setError(null)} />
                <textarea
                    value={newIssue}
                    onChange={(e) => setNewIssue(e.target.value)}
                    placeholder={`What's wrong with this ${noun}?`}
                    aria-label="Describe the issue"
                    disabled={isSubmitting}
                    rows="3"
                    className={`${DIALOG_TEXTAREA} ${NOTE_COMPOSER_TEXTAREA}`}
                />
                <div className="flex items-center gap-3">
                    <span className="text-[12px] font-medium text-text-secondary">Severity</span>
                    <SegmentedChoice
                        ariaLabel="Severity"
                        onChange={setSeverity}
                        options={SEVERITY_OPTIONS}
                        value={severity}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3">
                    <KeepPermanentSwitch
                        checked={permanent}
                        disabled={isSubmitting}
                        noun="issue"
                        onChange={setPermanent}
                    />
                    <button type="submit" disabled={isSubmitDisabled} className="btn-primary ml-auto">
                        {isSubmitting ? 'Reporting' : 'Report issue'}
                    </button>
                </div>
            </form>
        ) : null

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
                footer={composer}
                bodyClassName="p-0"
            >
                {body}
            </Dialog>
            {overlays}
        </>
    )
}

export default IssueModalSection
