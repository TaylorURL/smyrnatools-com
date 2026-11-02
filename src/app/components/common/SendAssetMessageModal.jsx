import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import MessageService from '../../../services/MessageService'
import { UserService } from '../../../services/UserService'
import { usePreferences } from '../../context/PreferencesContext'
import Dialog, { DIALOG_INPUT, DIALOG_TEXTAREA, DialogField } from '../ui/Dialog'
import ErrorMessage from './ErrorMessage'
import Skeleton, { SkeletonStack } from './Skeleton'

const recipientMeta = (mgr) => [mgr.roleName, mgr.plantCode].filter(Boolean).join(' · ')

/**
 * Sends one asset to a teammate as a message with an `asset` attachment, so the
 * recipient can open the record from their inbox. Recipients are the message
 * recipients for the viewer's currently selected region, and a successful send
 * dispatches a `messages-refresh` window event so open inbox views update.
 *
 * @param {object} props.item - The asset item being sent; `id` and `status` go into the attachment.
 * @param {string} props.itemNumber - Display identifier (truck #, trailer #, etc.)
 * @param {string} props.itemType - Asset type label ("Tractor", "Trailer", etc.)
 * @param {function} props.onClose - Close handler
 */
export default function SendAssetMessageModal({ item, itemNumber, itemType, onClose }) {
    const [managers, setManagers] = useState([])
    const [selectedManager, setSelectedManager] = useState(null)
    const [commentary, setCommentary] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [recipientSearch, setRecipientSearch] = useState('')
    const dropdownRef = useRef(null)
    const recipientId = useId()
    const messageId = useId()
    const { preferences } = usePreferences()
    const regionCode = preferences?.selectedRegion?.code || ''

    // The Dialog's close handler stays the same function for its whole life:
    // a new one from a parent re-render would re-run its open effect and pull
    // focus out of whatever field is being typed in.
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])
    const handleClose = useCallback(() => onCloseRef.current(), [])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        let cancelled = false
        async function load() {
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

    const filteredManagers = useMemo(() => {
        const query = recipientSearch.trim().toLowerCase()
        if (!query) return managers
        return managers.filter((mgr) => {
            const fullName = `${mgr.firstName || ''} ${mgr.lastName || ''}`.toLowerCase()
            const role = (mgr.roleName || '').toLowerCase()
            const plant = (mgr.plantCode || '').toLowerCase()
            return fullName.includes(query) || role.includes(query) || plant.includes(query)
        })
    }, [managers, recipientSearch])

    const handleSend = async () => {
        if (!selectedManager || sending) return
        setSending(true)
        setError('')
        try {
            const currentUser = await UserService.getCurrentUser()
            const subject = `${itemType} ${itemNumber || ''} — ${item.status || 'Unknown'} Status`
            const attachment = {
                meta: { itemId: item.id, itemNumber, itemType, status: item.status },
                type: 'asset'
            }
            await MessageService.sendMessage(
                currentUser?.id,
                selectedManager.id,
                subject,
                commentary || `${itemType} ${itemNumber || 'N/A'} — Status: ${item.status || 'Unknown'}`,
                attachment
            )
            window.dispatchEvent(new Event('messages-refresh'))
            setSent(true)
        } catch (e) {
            setError(e?.message || 'Failed to send message')
        }
        setSending(false)
    }

    const disabled = !selectedManager || sending

    const footer = sent ? (
        <button type="button" onClick={handleClose} className="btn-primary">
            Done
        </button>
    ) : (
        <>
            <button type="button" onClick={handleClose} className="btn-secondary">
                Cancel
            </button>
            <button type="button" onClick={handleSend} disabled={disabled} className="btn-primary">
                {sending ? 'Sending' : 'Send'}
            </button>
        </>
    )

    return (
        <Dialog
            open
            onClose={handleClose}
            size="md"
            zClassName="z-modal-menu"
            eyebrow="Send to a teammate"
            title={`${itemType} ${itemNumber || 'N/A'}`}
            description={`Status: ${item.status || 'Unknown'}`}
            footer={footer}
        >
            {sent ? (
                <div className="flex flex-col items-center gap-1 py-6 text-center">
                    <p className="m-0 text-[15px] font-medium text-text-primary">Message sent</p>
                    <p className="m-0 text-[13px] text-text-secondary">
                        Sent to {selectedManager?.firstName} {selectedManager?.lastName}.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <DialogField label="Send to" htmlFor={recipientId}>
                        {loading ? (
                            <SkeletonStack count={1} gapClassName="gap-0">
                                {() => <Skeleton className="h-9 w-full" rounded="rounded-[4px]" />}
                            </SkeletonStack>
                        ) : (
                            <div ref={dropdownRef}>
                                <button
                                    id={recipientId}
                                    type="button"
                                    onClick={() => setDropdownOpen((prev) => !prev)}
                                    aria-haspopup="listbox"
                                    aria-expanded={dropdownOpen}
                                    aria-label="Select recipient"
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
                                            dropdownOpen ? 'rotate-180' : ''
                                        }`}
                                        aria-hidden="true"
                                    />
                                </button>

                                {dropdownOpen && (
                                    <div className="mt-1 overflow-hidden rounded-[4px] border border-border-medium bg-bg-primary">
                                        <div className="relative border-b border-border-light p-2">
                                            <i
                                                className="fas fa-search pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary"
                                                aria-hidden="true"
                                            />
                                            <input
                                                type="search"
                                                value={recipientSearch}
                                                onChange={(e) => setRecipientSearch(e.target.value)}
                                                placeholder="Search recipients"
                                                aria-label="Search recipients"
                                                autoFocus
                                                className="h-9 w-full rounded-[4px] border border-border-medium bg-bg-primary pl-8 pr-8 text-[13px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors duration-150 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 motion-reduce:transition-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                                            />
                                            {recipientSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setRecipientSearch('')}
                                                    aria-label="Clear search"
                                                    className="absolute right-3.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-text-tertiary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                                                >
                                                    <i className="fas fa-times text-[10px]" aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>

                                        <div
                                            role="listbox"
                                            aria-label="Recipients"
                                            className="max-h-[220px] overflow-y-auto"
                                        >
                                            {filteredManagers.length === 0 ? (
                                                <p className="m-0 px-3 py-3 text-center text-[13px] text-text-secondary">
                                                    {managers.length === 0 ? 'No team members found' : 'No matches'}
                                                </p>
                                            ) : (
                                                filteredManagers.map((mgr) => {
                                                    const isSelected = selectedManager?.id === mgr.id
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={mgr.id}
                                                            role="option"
                                                            aria-selected={isSelected}
                                                            onClick={() => {
                                                                setSelectedManager(mgr)
                                                                setDropdownOpen(false)
                                                                setRecipientSearch('')
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
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogField>

                    <DialogField label="Message (optional)" htmlFor={messageId}>
                        <textarea
                            id={messageId}
                            value={commentary}
                            onChange={(e) => setCommentary(e.target.value)}
                            placeholder="Add a note"
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
