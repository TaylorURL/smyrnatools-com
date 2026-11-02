import React, { useEffect, useId, useRef, useState } from 'react'

import MessageService from '../../../../services/MessageService'
import { UserService } from '../../../../services/UserService'
import { SEVERITY_TO_TONE } from '../../../constants/issueModalConstants'
import { usePreferences } from '../../../context/PreferencesContext'
import Badge from '../../common/Badge'
import ErrorMessage from '../../common/ErrorMessage'
import Dialog, { DIALOG_INPUT, DIALOG_TEXTAREA, DialogField } from '../../ui/Dialog'
import { RecipientFieldSkeleton } from './IssueModalSkeletons'

const recipientMeta = (mgr) => [mgr.roleName, mgr.plantCode].filter(Boolean).join(' · ')

/**
 * Sends one issue to a teammate as a message with an `issue` attachment.
 * Rendered in the shared `Dialog`, which portals to document.body: mounted in
 * place it would sit inside AssetSidePanel's sticky aside, a stacking context
 * of its own, and paint under the navigation. `z-modal-menu` keeps it above
 * the issues dialog that opens it.
 */
function SendIssueMessageModal({ issue, itemNumber, itemType, creatorName, onClose }) {
    const [managers, setManagers] = useState([])
    const [selectedManager, setSelectedManager] = useState(null)
    const [commentary, setCommentary] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')
    const [managerDropdownOpen, setManagerDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)
    const recipientId = useId()
    const { preferences } = usePreferences()
    const regionCode = preferences?.selectedRegion?.code || ''

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setManagerDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const list = await MessageService.getRegionalRecipients(regionCode)
                if (!cancelled) setManagers(list)
            } catch {
                setError('Failed to load team members')
            }
            setLoading(false)
        }
        load()
        return () => {
            cancelled = true
        }
    }, [regionCode])

    const handleSend = async () => {
        if (!selectedManager || sending) return
        setSending(true)
        setError('')
        try {
            const currentUser = await UserService.getCurrentUser()
            const subject = `Issue on ${itemType} ${itemNumber || ''} — ${issue.severity} Severity`
            const attachment = {
                meta: {
                    issueId: issue.id,
                    issueText: issue.issue,
                    itemNumber,
                    itemType,
                    reportedBy: creatorName,
                    severity: issue.severity
                },
                type: 'issue'
            }
            await MessageService.sendMessage(
                currentUser?.id,
                selectedManager.id,
                subject,
                commentary || issue.issue,
                attachment
            )
            window.dispatchEvent(new Event('messages-refresh'))
            setSent(true)
        } catch (e) {
            setError(e?.message || 'Failed to send message')
        }
        setSending(false)
    }

    const footer = sent ? (
        <button type="button" onClick={onClose} className="btn-primary">
            Done
        </button>
    ) : (
        <>
            <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
            </button>
            <button type="button" onClick={handleSend} disabled={!selectedManager || sending} className="btn-primary">
                {sending ? 'Sending' : 'Send'}
            </button>
        </>
    )

    return (
        <Dialog
            open
            onClose={onClose}
            size="md"
            zClassName="z-modal-menu"
            eyebrow="Send issue to a teammate"
            title={`${itemType} ${itemNumber || 'N/A'}`}
            footer={footer}
        >
            {sent ? (
                <div className="flex flex-col items-center gap-1 py-6 text-center">
                    <p className="m-0 text-[15px] font-medium text-text-primary">Message sent</p>
                    <p className="m-0 text-[13px] text-text-secondary">
                        {selectedManager?.firstName} {selectedManager?.lastName} will be notified.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="rounded-[4px] border border-border-light bg-bg-secondary px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Badge tone={SEVERITY_TO_TONE[issue.severity] || 'warning'} size="sm">
                                {issue.severity}
                            </Badge>
                            <span className="text-[12px] text-text-tertiary">Reported by {creatorName}</span>
                        </div>
                        <p className="m-0 mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-primary">
                            {issue.issue}
                        </p>
                    </div>

                    <DialogField label="Send to" htmlFor={recipientId}>
                        {loading ? (
                            <RecipientFieldSkeleton />
                        ) : (
                            <div ref={dropdownRef}>
                                <button
                                    id={recipientId}
                                    type="button"
                                    onClick={() => setManagerDropdownOpen((prev) => !prev)}
                                    aria-haspopup="listbox"
                                    aria-expanded={managerDropdownOpen}
                                    className={`${DIALOG_INPUT} flex cursor-pointer items-center gap-2 text-left`}
                                >
                                    {selectedManager ? (
                                        <span className="min-w-0 flex-1 truncate">
                                            <span className="font-medium">
                                                {selectedManager.firstName} {selectedManager.lastName}
                                            </span>
                                            {recipientMeta(selectedManager) && (
                                                <span className="text-text-tertiary">
                                                    {' · '}
                                                    {recipientMeta(selectedManager)}
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="flex-1 text-text-tertiary">Select a recipient</span>
                                    )}
                                    <i
                                        className={`fas fa-chevron-down text-[10px] text-text-secondary transition-transform duration-150 motion-reduce:transition-none ${
                                            managerDropdownOpen ? 'rotate-180' : ''
                                        }`}
                                        aria-hidden="true"
                                    />
                                </button>
                                {managerDropdownOpen && (
                                    <div
                                        role="listbox"
                                        aria-label="Recipients"
                                        className="mt-1 max-h-[220px] overflow-y-auto rounded-[4px] border border-border-medium bg-bg-primary"
                                    >
                                        {managers.length === 0 ? (
                                            <p className="m-0 px-3 py-3 text-center text-[13px] text-text-secondary">
                                                No team members found
                                            </p>
                                        ) : (
                                            managers.map((mgr) => {
                                                const isSelected = selectedManager?.id === mgr.id
                                                return (
                                                    <button
                                                        type="button"
                                                        key={mgr.id}
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        onClick={() => {
                                                            setSelectedManager(mgr)
                                                            setManagerDropdownOpen(false)
                                                        }}
                                                        className={`flex w-full cursor-pointer flex-col items-start border-0 border-b border-solid border-border-light px-3 py-2 text-left transition-colors duration-150 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${
                                                            isSelected
                                                                ? 'bg-bg-tertiary font-medium'
                                                                : 'bg-transparent hover:bg-bg-hover'
                                                        }`}
                                                    >
                                                        <span className="text-[13px] text-text-primary">
                                                            {mgr.firstName} {mgr.lastName}
                                                        </span>
                                                        {recipientMeta(mgr) && (
                                                            <span className="text-[12px] font-normal text-text-secondary">
                                                                {recipientMeta(mgr)}
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogField>

                    <DialogField label="Message (optional)" htmlFor="issue-message-textarea">
                        <textarea
                            id="issue-message-textarea"
                            value={commentary}
                            onChange={(e) => setCommentary(e.target.value)}
                            placeholder="Add context, questions or instructions"
                            aria-label="Message"
                            rows="3"
                            className={DIALOG_TEXTAREA}
                        />
                    </DialogField>

                    <ErrorMessage message={error} />
                </div>
            )}
        </Dialog>
    )
}

export default SendIssueMessageModal
