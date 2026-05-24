/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { UserService } from '../../../services/UserService'
import DateUtility from '../../../utils/DateUtility'
import { useAccentColor } from '../../hooks/useAccentColor'
import UserAvatar from './UserAvatar'

const SECTION_LABEL = 'flex items-center gap-2 px-3 pt-2.5 pb-1 text-[9.5px] font-semibold uppercase tracking-wider'

/** Single conversation row in the messages popup. Avatar uses the other
 *  participant's accent colour; the unread tint/badge use the viewer's
 *  accent because it signals the viewer's unread state. */
function ConversationRow({ accentColor, conversation, displayName, onSelectConversation, onViewAll }) {
    const latest = conversation.lastMessage
    const hasUnread = conversation.unread > 0

    return (
        <div
            className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-bg-tertiary border-b border-border-light"
            style={{ background: hasUnread ? `${accentColor}0D` : 'transparent' }}
            onClick={() => (onSelectConversation ? onSelectConversation(conversation.otherId) : onViewAll())}
        >
            <UserAvatar name={displayName} userId={conversation.otherId} size="md" rounded="md">
                {hasUnread && (
                    <span
                        className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded px-0.5 text-[9px] font-bold text-white font-mono tabular-nums border border-[var(--bg-primary)]"
                        style={{ background: accentColor }}
                    >
                        {conversation.unread}
                    </span>
                )}
            </UserAvatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span
                        className={`truncate text-[12px] ${hasUnread ? 'font-semibold' : 'font-medium'} text-text-primary`}
                    >
                        {displayName}
                    </span>
                    <span className="shrink-0 text-[10px] font-mono tabular-nums text-text-tertiary">
                        {DateUtility.formatTimeAgo(latest?.createdAt)}
                    </span>
                </div>
                {latest?.subject && (
                    <p
                        className="m-0 truncate text-[10.5px]"
                        style={{ color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                        {latest.subject}
                    </p>
                )}
                <p className="m-0 truncate text-[10.5px] text-text-secondary">{latest?.body}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 font-mono tabular-nums text-[10px] text-text-tertiary">
                <span>{conversation.messages.length}</span>
                <i className="fas fa-chevron-right text-[8px]" />
            </div>
        </div>
    )
}

/**
 * Anchored dropdown showing unread messages and recent conversations.
 * Footer links to the full NotificationsView (messages center).
 */
function NotificationsModal({ isOpen, onClose, onViewAll, onSelectConversation, anchorRect, messagesHook }) {
    const accentColor = useAccentColor()
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
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, onClose])

    if (!isOpen || typeof document === 'undefined' || !document.body) return null

    /* Position is runtime-computed from anchorRect, must stay inline */
    const modalStyle = {
        position: 'fixed',
        zIndex: 1000,
        ...(anchorRect?.useLeft
            ? { bottom: anchorRect.bottom, left: anchorRect.left }
            : {
                  right: anchorRect ? window.innerWidth - anchorRect.right : '16px',
                  top: anchorRect ? anchorRect.bottom + 8 : '80px'
              })
    }

    const pillBtnStyle = {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        color: 'var(--text-secondary)'
    }

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[999]" onClick={onClose}>
            <div
                ref={panelRef}
                style={{
                    ...modalStyle,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 6
                }}
                className="flex max-h-[76vh] w-96 flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between px-3 py-2 border-b border-border-light">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-envelope text-[11px]" />
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                            Messages
                        </span>
                        {unreadCount > 0 && (
                            <span
                                className="font-mono tabular-nums rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white"
                                style={{ background: accentColor }}
                            >
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="rounded px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider transition-colors hover:brightness-95"
                                style={pillBtnStyle}
                            >
                                Mark all read
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary text-text-secondary"
                            aria-label="Close"
                        >
                            <i className="fas fa-times text-[11px]" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-bg-primary">
                    {loading ? (
                        <div>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="flex animate-pulse items-center gap-2.5 px-3 py-2 border-b border-border-light"
                                >
                                    <div className="h-7 w-7 shrink-0 rounded bg-bg-tertiary" />
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div
                                                className="h-3 rounded bg-bg-tertiary"
                                                style={{ width: `${60 + i * 10}%` }}
                                            />
                                            <div className="h-2.5 w-10 shrink-0 rounded bg-bg-tertiary" />
                                        </div>
                                        <div
                                            className="h-2.5 rounded bg-bg-secondary"
                                            style={{ width: `${80 - i * 8}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : displayedConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-text-tertiary">
                            <i className="fas fa-envelope-open mb-2 text-2xl" />
                            <span className="text-[12px] font-semibold text-text-primary">No messages</span>
                            <span className="mt-0.5 text-[10.5px]">Your inbox is empty</span>
                        </div>
                    ) : (
                        <div>
                            {unreadConversations.length > 0 && (
                                <>
                                    <div className={SECTION_LABEL} style={{ color: 'var(--text-tertiary)' }}>
                                        <span>Unread</span>
                                        <span
                                            className="font-mono tabular-nums rounded px-1 text-[9px] font-bold text-white"
                                            style={{ background: accentColor }}
                                        >
                                            {unreadCount}
                                        </span>
                                    </div>
                                    <div>
                                        {unreadConversations.map((conv) => (
                                            <ConversationRow
                                                key={conv.otherId}
                                                accentColor={accentColor}
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
                                    {unreadConversations.length > 0 && (
                                        <div className={SECTION_LABEL} style={{ color: 'var(--text-tertiary)' }}>
                                            <span>Recent</span>
                                        </div>
                                    )}
                                    <div>
                                        {readConversations.map((conv) => (
                                            <ConversationRow
                                                key={conv.otherId}
                                                accentColor={accentColor}
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

                {/* Footer */}
                <div className="shrink-0 border-t border-border-light">
                    <button
                        onClick={onViewAll}
                        className="flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider transition-colors hover:bg-bg-tertiary"
                        style={{ color: accentColor }}
                    >
                        View All Messages
                        <i className="fas fa-arrow-right text-[10px]" />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default NotificationsModal
