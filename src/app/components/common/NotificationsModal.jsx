/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { UserService } from '../../../services/UserService'
import DateUtility from '../../../utils/DateUtility'
import { DIALOG_CLOSE_BUTTON, DIALOG_CLOSE_ICON } from '../ui/Dialog'
import UserAvatar from './UserAvatar'

const SECTION_LABEL = 'px-4 pb-1 pt-3 text-[12px] font-medium text-text-tertiary'

/** Single conversation row in the messages popup: the other person, when the
 *  latest message arrived, and a one-line preview. Unread conversations are
 *  set in a heavier weight and say how many messages are new. */
function ConversationRow({ conversation, displayName, onSelectConversation, onViewAll }) {
    const latest = conversation.lastMessage
    const hasUnread = conversation.unread > 0
    const preview = [latest?.subject, latest?.body].filter(Boolean).join(' · ')

    return (
        <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 border-b border-border-light bg-transparent px-4 py-2.5 text-left transition-colors duration-150 ease-out last:border-b-0 hover:bg-bg-hover focus-visible:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none"
            onClick={() => (onSelectConversation ? onSelectConversation(conversation.otherId) : onViewAll())}
        >
            <UserAvatar name={displayName} userId={conversation.otherId} size="md" />
            <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                    <span
                        className={`truncate text-[13px] text-text-primary ${hasUnread ? 'font-semibold' : 'font-medium'}`}
                    >
                        {displayName}
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">
                        {DateUtility.formatTimeAgo(latest?.createdAt)}
                    </span>
                </span>
                <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-[12px] ${hasUnread ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {preview}
                    </span>
                    {hasUnread && (
                        <span className="shrink-0 text-[12px] font-medium tabular-nums text-text-primary">
                            {conversation.unread} new
                        </span>
                    )}
                </span>
            </span>
        </button>
    )
}

/**
 * Anchored dropdown showing unread messages and recent conversations.
 * Footer links to the full NotificationsView (messages center).
 */
function NotificationsModal({ isOpen, onClose, onViewAll, onSelectConversation, anchorRect, messagesHook }) {
    const panelRef = useRef(null)
    const { conversations = [], loading, markAllRead, unreadCount } = messagesHook
    const [userNames, setUserNames] = useState({})

    const displayedConversations = useMemo(() => conversations.slice(0, 8), [conversations])
    const unreadConversations = useMemo(() => conversations.filter((c) => c.unread > 0), [conversations])
    const readConversations = useMemo(
        () => conversations.filter((c) => c.unread === 0).slice(0, Math.max(0, 6 - unreadConversations.length)),
        [conversations, unreadConversations.length]
    )

    useEffect(() => {
        const ids = displayedConversations.map((c) => c.otherId).filter((id) => id && !userNames[id])
        if (!ids.length) return
        let cancelled = false
        const resolve = async () => {
            const names = {}
            await Promise.all(
                ids.map(async (id) => {
                    try {
                        names[id] = await UserService.getUserDisplayName(id)
                    } catch {
                        names[id] = 'Unknown'
                    }
                })
            )
            if (!cancelled) setUserNames((prev) => ({ ...prev, ...names }))
        }
        resolve()
        return () => {
            cancelled = true
        }
    }, [displayedConversations, userNames])

    useEffect(() => {
        if (!isOpen) return
        const handleClickOutside = (e) => {
            if (!panelRef.current?.contains(e.target)) onClose()
        }
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    if (!isOpen || typeof document === 'undefined' || !document.body) return null

    /* Position is runtime-computed from anchorRect, must stay inline */
    const modalStyle = {
        position: 'fixed',
        zIndex: 'var(--z-panel)',
        ...(anchorRect?.useLeft
            ? { bottom: anchorRect.bottom, left: anchorRect.left }
            : {
                  right: anchorRect ? window.innerWidth - anchorRect.right : '16px',
                  top: anchorRect ? anchorRect.bottom + 8 : '80px'
              })
    }

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-backdrop">
            <button
                type="button"
                aria-label="Close messages"
                className="absolute inset-0 cursor-default"
                onClick={onClose}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="false"
                aria-label="Messages"
                style={modalStyle}
                className="flex max-h-[76vh] w-96 max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-modal border border-border-light bg-bg-primary shadow-modal animate-fade-slide-in motion-reduce:animate-none"
            >
                <div className="flex shrink-0 items-center gap-2 border-b border-border-light py-2 pl-4 pr-2">
                    <span className="text-[14px] font-semibold text-text-primary">Messages</span>
                    {unreadCount > 0 && (
                        <span className="text-[12px] tabular-nums text-text-secondary">{unreadCount} unread</span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="h-7 cursor-pointer rounded-[4px] border-none bg-transparent px-2 text-[12px] font-medium text-text-secondary transition-colors duration-150 ease-out hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                            >
                                Mark all read
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className={DIALOG_CLOSE_BUTTON}
                            aria-label="Close messages"
                        >
                            <i className={DIALOG_CLOSE_ICON} aria-hidden="true" />
                        </button>
                    </span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-text-secondary">
                            <i className="fas fa-spinner fa-spin text-[12px]" aria-hidden="true" />
                            Loading messages
                        </div>
                    ) : displayedConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
                            <p className="m-0 text-[15px] font-medium text-text-primary">No messages</p>
                            <p className="m-0 text-[13px] text-text-secondary">Your inbox is empty.</p>
                        </div>
                    ) : (
                        <div>
                            {unreadConversations.length > 0 && (
                                <>
                                    {readConversations.length > 0 && <div className={SECTION_LABEL}>Unread</div>}
                                    <div className={readConversations.length > 0 ? 'border-b border-border-light' : ''}>
                                        {unreadConversations.map((conv) => (
                                            <ConversationRow
                                                key={conv.otherId}
                                                conversation={conv}
                                                displayName={userNames[conv.otherId] || 'Loading...'}
                                                onSelectConversation={onSelectConversation}
                                                onViewAll={onViewAll}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {readConversations.length > 0 && (
                                <>
                                    {unreadConversations.length > 0 && <div className={SECTION_LABEL}>Recent</div>}
                                    <div>
                                        {readConversations.map((conv) => (
                                            <ConversationRow
                                                key={conv.otherId}
                                                conversation={conv}
                                                displayName={userNames[conv.otherId] || 'Loading...'}
                                                onSelectConversation={onSelectConversation}
                                                onViewAll={onViewAll}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-border-light">
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="flex w-full cursor-pointer items-center border-none bg-transparent px-4 py-2.5 text-left text-[13px] font-medium text-text-primary underline-offset-2 transition-colors duration-150 ease-out hover:bg-bg-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none"
                    >
                        Open messages
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default NotificationsModal
