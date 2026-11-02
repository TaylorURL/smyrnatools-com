import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import MessageService from '../../../services/MessageService'
import UserUtility from '../../../utils/UserUtility'
import { usePreferences } from '../../context/PreferencesContext'
import UserAvatar from '../common/UserAvatar'
import Dialog, { DIALOG_INPUT, DIALOG_TEXTAREA, DialogField } from '../ui/Dialog'

/** Role and plant under a recipient's name. */
function recipientMeta(recipient) {
    return `${recipient.roleName || ''}${recipient.plantCode ? ` · ${recipient.plantCode}` : ''}`
}

/** Modal for composing a brand new message thread. Loads the regional
 *  recipient list on mount, supports search, and shows a confirmation
 *  state after the message sends successfully. */
export default function ComposeModal({ onClose, onSend }) {
    const { preferences } = usePreferences()
    const regionCode = preferences?.selectedRegion?.code || ''
    const [recipients, setRecipients] = useState([])
    const [selectedRecipient, setSelectedRecipient] = useState(null)
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')
    const [recipientSearch, setRecipientSearch] = useState('')
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [loadingRecipients, setLoadingRecipients] = useState(true)
    const dropdownRef = useRef(null)
    const toId = useId()
    const subjectId = useId()
    const bodyId = useId()

    // The parent hands this a fresh `onClose` whenever it re-renders (a new
    // message arriving is enough), and the dialog re-runs its focus handling
    // on every new identity. One stable close keeps focus where the writer is.
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    })
    const handleClose = useCallback(() => onCloseRef.current?.(), [])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoadingRecipients(true)
            try {
                const list = await MessageService.getRegionalRecipients(regionCode)
                if (!cancelled) setRecipients(list)
            } catch {
                // Leave the recipient list empty — the compose form still works
                // with a manually chosen recipient.
            }
            if (!cancelled) setLoadingRecipients(false)
        }
        load()
        return () => {
            cancelled = true
        }
    }, [regionCode])

    const filteredRecipients = recipientSearch
        ? recipients.filter((r) =>
              `${r.firstName} ${r.lastName} ${r.roleName} ${r.plantCode}`
                  .toLowerCase()
                  .includes(recipientSearch.toLowerCase())
          )
        : recipients

    const handleSend = async () => {
        if (!selectedRecipient || !body.trim() || sending) return
        setSending(true)
        setError('')
        try {
            await onSend(selectedRecipient.id, subject, body)
            setSent(true)
        } catch (e) {
            setError(e?.message || 'Failed to send message')
        }
        setSending(false)
    }

    const cannotSend = !selectedRecipient || !body.trim() || sending

    return (
        <Dialog
            open
            onClose={handleClose}
            size="md"
            title={sent ? 'Message sent' : 'New message'}
            footer={
                sent ? (
                    <button type="button" onClick={handleClose} className="btn-primary">
                        Done
                    </button>
                ) : (
                    <>
                        <button type="button" onClick={handleClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="button" onClick={handleSend} disabled={cannotSend} className="btn-primary">
                            {sending && <i className="fas fa-spinner animate-dv-spin text-[12px]" aria-hidden="true" />}
                            {sending ? 'Sending…' : 'Send'}
                        </button>
                    </>
                )
            }
        >
            {sent ? (
                <div className="flex min-h-[120px] flex-col items-center justify-center gap-1 text-center">
                    <p className="m-0 text-[15px] font-medium text-text-primary">
                        Sent to {selectedRecipient?.firstName} {selectedRecipient?.lastName}
                    </p>
                    <p className="m-0 text-[13px] text-text-secondary">They will receive it in their messages.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <DialogField label="To" htmlFor={toId}>
                        <div ref={dropdownRef} className="relative">
                            {selectedRecipient ? (
                                <div className="flex min-h-[36px] items-center gap-2.5 rounded-[4px] border border-border-medium bg-bg-primary py-1 pl-2 pr-1">
                                    <UserAvatar
                                        userId={selectedRecipient.id}
                                        initials={UserUtility.getInitials(
                                            `${selectedRecipient.firstName} ${selectedRecipient.lastName}`
                                        )}
                                        size="sm"
                                    />
                                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                                        <span className="truncate text-[13px] font-medium text-text-primary">
                                            {selectedRecipient.firstName} {selectedRecipient.lastName}
                                        </span>
                                        <span className="truncate text-[12px] text-text-secondary">
                                            {recipientMeta(selectedRecipient)}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRecipient(null)}
                                        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                                        aria-label="Clear recipient"
                                    >
                                        <i className="fas fa-times text-[12px]" aria-hidden="true" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <i
                                            aria-hidden="true"
                                            className="fas fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary"
                                        />
                                        <input
                                            id={toId}
                                            type="search"
                                            value={recipientSearch}
                                            onChange={(e) => {
                                                setRecipientSearch(e.target.value)
                                                setDropdownOpen(true)
                                            }}
                                            onFocus={() => setDropdownOpen(true)}
                                            onKeyDown={(e) => {
                                                // Escape closes the results first, not the whole message.
                                                if (e.key === 'Escape' && dropdownOpen) {
                                                    e.stopPropagation()
                                                    setDropdownOpen(false)
                                                }
                                            }}
                                            placeholder="Search by name, role or plant"
                                            aria-label="Search recipients"
                                            aria-expanded={dropdownOpen}
                                            aria-haspopup="listbox"
                                            data-autofocus
                                            className={`${DIALOG_INPUT} pl-8 [&::-webkit-search-cancel-button]:hidden`}
                                        />
                                    </div>
                                    {dropdownOpen && (
                                        <div
                                            role="listbox"
                                            className="absolute left-0 right-0 z-raised mt-1 max-h-60 overflow-y-auto rounded-card border border-border-light bg-bg-primary shadow-modal"
                                        >
                                            {loadingRecipients ? (
                                                <div className="px-3 py-3 text-center text-[13px] text-text-secondary">
                                                    Loading people…
                                                </div>
                                            ) : filteredRecipients.length === 0 ? (
                                                <div className="px-3 py-3 text-center text-[13px] text-text-secondary">
                                                    No one matches that search
                                                </div>
                                            ) : (
                                                filteredRecipients.map((r) => (
                                                    <button
                                                        type="button"
                                                        key={r.id}
                                                        role="option"
                                                        aria-selected={false}
                                                        onClick={() => {
                                                            setSelectedRecipient(r)
                                                            setDropdownOpen(false)
                                                            setRecipientSearch('')
                                                        }}
                                                        className="flex w-full cursor-pointer items-center gap-2.5 border-b border-border-light bg-transparent px-3 py-2 text-left text-text-primary transition-colors duration-150 last:border-b-0 hover:bg-bg-hover focus-visible:bg-bg-hover focus-visible:outline-none motion-reduce:transition-none"
                                                    >
                                                        <UserAvatar
                                                            userId={r.id}
                                                            initials={UserUtility.getInitials(
                                                                `${r.firstName} ${r.lastName}`
                                                            )}
                                                            size="sm"
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-[13px] font-medium">
                                                                {r.firstName} {r.lastName}
                                                            </span>
                                                            <span className="block truncate text-[12px] text-text-secondary">
                                                                {recipientMeta(r)}
                                                            </span>
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </DialogField>

                    <DialogField label="Subject" htmlFor={subjectId}>
                        <input
                            id={subjectId}
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Optional"
                            className={DIALOG_INPUT}
                        />
                    </DialogField>

                    <DialogField label="Message" htmlFor={bodyId}>
                        <textarea
                            id={bodyId}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Write your message"
                            rows="6"
                            className={DIALOG_TEXTAREA}
                        />
                    </DialogField>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-[4px] border border-[color:var(--notice-danger-border)] bg-[color:var(--notice-danger-bg)] px-3 py-2 text-[13px] text-[color:var(--notice-danger-strong)]"
                        >
                            {error}
                        </div>
                    )}
                </div>
            )}
        </Dialog>
    )
}
