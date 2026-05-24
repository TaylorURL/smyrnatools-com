import React, { useEffect, useMemo, useRef } from 'react'

import { formatMessageTime, getDateLabel, resolveAttachmentView } from '../../constants/notificationsConstants'
import UserAvatar from '../common/UserAvatar'
import AttachmentPreview from './AttachmentPreview'

/** Scrollable chat messages area. Groups messages by date, collapses
 *  consecutive bubbles from the same sender, and auto-scrolls to the bottom
 *  whenever a new message arrives. */
export default function ChatMessages({ accentColor, conversation, onAttachmentClick, resolvedUserId, userNames }) {
    const scrollRef = useRef(null)
    const otherName = userNames[conversation.otherId] || ''

    const chronological = useMemo(
        () => [...conversation.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        [conversation.messages]
    )

    const dateGroups = useMemo(() => {
        const groups = []
        let currentKey = ''
        chronological.forEach((msg) => {
            const key = new Date(msg.createdAt).toDateString()
            if (key !== currentKey) {
                currentKey = key
                groups.push({ label: getDateLabel(msg.createdAt), messages: [] })
            }
            groups[groups.length - 1].messages.push(msg)
        })
        return groups
    }, [chronological])

    useEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [chronological.length])

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-3 bg-bg-secondary">
            {dateGroups.map((group) => (
                <React.Fragment key={group.label}>
                    <div className="flex justify-center my-3 first:mt-0">
                        <span className="px-2 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider font-mono tabular-nums bg-bg-primary border border-border-light text-text-secondary">
                            {group.label}
                        </span>
                    </div>

                    {group.messages.map((msg, idx) => {
                        const isMine =
                            resolvedUserId &&
                            (msg.senderId === resolvedUserId || String(msg.senderId) === String(resolvedUserId))
                        const prev = idx > 0 ? group.messages[idx - 1] : null
                        const next = idx < group.messages.length - 1 ? group.messages[idx + 1] : null
                        const sameSenderAsPrev =
                            prev && (prev.senderId === msg.senderId || String(prev.senderId) === String(msg.senderId))
                        const sameSenderAsNext =
                            next && (next.senderId === msg.senderId || String(next.senderId) === String(msg.senderId))
                        const showAvatar = !isMine && !sameSenderAsNext
                        const showTimestamp = !sameSenderAsNext

                        return (
                            <div
                                key={msg.id}
                                className={`flex ${sameSenderAsPrev ? 'mt-0.5' : 'mt-2.5'} ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}
                            >
                                {!isMine && (
                                    <div className="w-6 flex-shrink-0 self-end">
                                        {showAvatar && (
                                            <UserAvatar
                                                name={otherName}
                                                userId={conversation.otherId}
                                                size={24}
                                                rounded="md"
                                            />
                                        )}
                                    </div>
                                )}

                                <div
                                    className="max-w-[75%] px-3 py-2 rounded"
                                    style={{
                                        background: isMine ? accentColor : 'var(--bg-primary)',
                                        border: isMine ? 'none' : '1px solid var(--border-light)',
                                        color: isMine ? 'white' : 'var(--text-primary)'
                                    }}
                                >
                                    {msg.subject && (
                                        <p
                                            className="text-[9.5px] font-semibold uppercase tracking-wider m-0 mb-1"
                                            style={{ opacity: isMine ? 0.85 : 0.55 }}
                                        >
                                            {msg.subject}
                                        </p>
                                    )}

                                    {msg.attachmentType &&
                                        msg.attachmentMeta &&
                                        (() => {
                                            const isViewable = !!resolveAttachmentView(
                                                msg.attachmentType,
                                                msg.attachmentMeta
                                            )
                                            return (
                                                <div
                                                    className={`rounded p-2 mb-1.5 ${isViewable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                                    style={{
                                                        background: isMine
                                                            ? 'rgba(255,255,255,0.12)'
                                                            : 'var(--bg-secondary)',
                                                        border: `1px solid ${isMine ? 'rgba(255,255,255,0.18)' : 'var(--border-light)'}`
                                                    }}
                                                    onClick={() =>
                                                        isViewable &&
                                                        onAttachmentClick?.(msg.attachmentType, msg.attachmentMeta)
                                                    }
                                                >
                                                    <AttachmentPreview
                                                        type={msg.attachmentType}
                                                        meta={msg.attachmentMeta}
                                                        accentColor={accentColor}
                                                        light={isMine}
                                                    />
                                                </div>
                                            )
                                        })()}

                                    <p className="text-[12.5px] m-0 leading-relaxed whitespace-pre-wrap">{msg.body}</p>

                                    {showTimestamp && (
                                        <div
                                            className={`flex items-center gap-1.5 mt-1 ${isMine ? 'justify-end' : ''}`}
                                        >
                                            <span className="text-[9.5px] font-mono tabular-nums opacity-55">
                                                {formatMessageTime(msg.createdAt)}
                                            </span>
                                            {isMine && (
                                                <i
                                                    className={`fas ${msg.isRead ? 'fa-check-double' : 'fa-check'} text-[9px]`}
                                                    style={{ opacity: msg.isRead ? 0.75 : 0.45 }}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </React.Fragment>
            ))}
        </div>
    )
}
