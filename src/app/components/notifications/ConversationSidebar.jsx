import React, { useMemo } from 'react'

import DateUtility from '../../../utils/DateUtility'
import { ATTACHMENT_ICONS, FILTER_PILLS, SECTION_LABEL_CLASS } from '../../constants/notificationsConstants'
import Badge from '../common/Badge'
import CountBubble from '../common/CountBubble'
import UserAvatar from '../common/UserAvatar'

function SidebarSection({ badge, children, label }) {
    return (
        <div>
            <div className="flex items-center gap-2 border-b border-border-light bg-bg-secondary px-4 py-1.5">
                <span className={`${SECTION_LABEL_CLASS} text-text-secondary`}>{label}</span>
                {badge > 0 && <span className="text-[12px] tabular-nums text-text-tertiary">{badge}</span>}
            </div>
            <div>{children}</div>
        </div>
    )
}

function ConversationRow({ active, conversation, displayName, muted = false, onSelect, pinned = false }) {
    const latest = conversation.lastMessage
    const hasUnread = conversation.unread > 0 && !muted
    /** Most recent attachment in the thread — surfaced as a chip on the row
     *  so the operator can see "this thread has the M-247 mixer attached"
     *  without opening it. */
    const lastAttachment = useMemo(
        () => (conversation.messages || []).find((m) => m.attachmentType && m.attachmentMeta) || null,
        [conversation.messages]
    )
    const attachmentLabel =
        lastAttachment?.attachmentMeta?.itemNumber || (lastAttachment?.attachmentType === 'issue' ? 'Issue' : null)
    const attachmentIconClass = lastAttachment
        ? ATTACHMENT_ICONS[lastAttachment.attachmentType] || 'fas fa-paperclip'
        : null
    /** Strip the leading FA prefix so Badge's `icon` prop receives the suffix
     *  only (e.g. `paperclip`, `mixer`). */
    const attachmentIconName = attachmentIconClass ? attachmentIconClass.replace(/^fa[a-z]?\s+fa-/, '') : null

    return (
        <button
            type="button"
            onClick={() => onSelect(conversation)}
            aria-current={active ? 'true' : undefined}
            className={`flex w-full cursor-pointer items-start gap-3 border-0 border-b border-solid border-border-light px-4 py-3 text-left transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                active ? 'bg-bg-tertiary' : 'bg-transparent hover:bg-bg-hover'
            }`}
        >
            <UserAvatar name={displayName} userId={conversation.otherId} size={36} rounded="md">
                {hasUnread && (
                    <CountBubble count={conversation.unread} size="sm" className="absolute -right-1.5 -top-1.5" />
                )}
            </UserAvatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                        {pinned && (
                            <i
                                className="fas fa-thumbtack text-[9px] text-text-primary"
                                style={{ transform: 'rotate(40deg)' }}
                            />
                        )}
                        {muted && <i className="fas fa-bell-slash text-[9px] text-text-tertiary" />}
                        <span
                            className={`truncate text-[13px] ${hasUnread ? 'font-semibold' : 'font-medium'} text-text-primary`}
                        >
                            {displayName}
                        </span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">
                        {DateUtility.formatTimeAgo(latest?.createdAt)}
                    </span>
                </div>
                {latest?.subject && (
                    <p
                        className="m-0 truncate text-[12px] mt-0.5"
                        style={{ color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                        {latest.subject}
                    </p>
                )}
                <p
                    className="m-0 truncate text-[12px] mt-0.5"
                    style={{ color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                    {latest?.body}
                </p>
                {attachmentLabel && (
                    <div className="mt-1 flex items-center gap-1.5">
                        <Badge
                            tone="neutral"
                            size="xs"
                            weight="semibold"
                            uppercase={false}
                            icon={attachmentIconName}
                            className="font-mono tabular-nums"
                        >
                            {attachmentLabel}
                        </Badge>
                    </div>
                )}
            </div>
        </button>
    )
}

function SidebarSkeleton() {
    return (
        <div>
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-2.5 px-3 py-2 border-b border-border-light">
                    <div className="h-7 w-7 shrink-0 rounded bg-bg-tertiary" />
                    <div className="flex flex-1 min-w-0 flex-col gap-1">
                        <div className="h-3 rounded bg-bg-tertiary" style={{ width: `${60 + i * 8}%` }} />
                        <div className="h-2.5 rounded bg-bg-secondary" style={{ width: `${78 - i * 6}%` }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Left rail — fixed-width on desktop, full-width on mobile. Splits the
 *  conversation list into Pinned / Unread / Recent so high-priority threads
 *  bubble to the top regardless of recency. Filter pills above the sections
 *  apply on top of the search box. */
export default function ConversationSidebar({
    activeConversationId,
    activeFilter = 'all',
    conversations,
    loading,
    mutedSet,
    onFilterChange,
    onSearchChange,
    onSelect,
    pinnedSet,
    search,
    unreadCount,
    userNames
}) {
    const pinned = conversations.filter((c) => pinnedSet.has(c.otherId))
    const unread = conversations.filter((c) => c.unread > 0 && !pinnedSet.has(c.otherId))
    const recent = conversations.filter((c) => c.unread === 0 && !pinnedSet.has(c.otherId))

    const counts = {
        all: conversations.length,
        pinned: pinned.length,
        unread: conversations.reduce((sum, c) => sum + (c.unread > 0 ? 1 : 0), 0)
    }

    return (
        <aside className="shrink-0 flex flex-col w-full lg:w-[320px] min-h-0 bg-bg-primary border-r border-border-light">
            <div className="px-4 pt-3 pb-0 shrink-0">
                <div className="relative">
                    <i
                        aria-hidden="true"
                        className="fas fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search conversations…"
                        aria-label="Search conversations"
                        className="w-full h-9 rounded-[4px] text-[13px] pl-8 pr-7 outline-none bg-bg-primary border border-border-medium text-text-primary placeholder:text-text-tertiary transition-colors duration-150 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => onSearchChange('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                        >
                            <i className="fas fa-times text-[9px]" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-end gap-5 px-4 shrink-0 border-b border-border-light">
                {FILTER_PILLS.map(({ id, label }) => {
                    const isActive = activeFilter === id
                    const count = counts[id] ?? 0
                    return (
                        <button
                            type="button"
                            key={id}
                            onClick={() => onFilterChange?.(id)}
                            aria-pressed={isActive}
                            className={`-mb-px inline-flex items-center gap-1.5 border-0 border-b-2 border-solid bg-transparent pb-2.5 pt-3 text-[13px] cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                isActive
                                    ? 'border-text-primary font-medium text-text-primary'
                                    : 'border-transparent text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            <span>{label}</span>
                            <span className="tabular-nums text-text-tertiary">{count}</span>
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <SidebarSkeleton />
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                        <i className="fas fa-inbox text-2xl mb-2" />
                        <span className="text-[12px] font-semibold text-text-primary">
                            {activeFilter === 'unread'
                                ? 'No unread messages'
                                : activeFilter === 'pinned'
                                  ? 'Nothing pinned yet'
                                  : 'No conversations'}
                        </span>
                        <span className="text-[10.5px] mt-0.5">
                            {activeFilter === 'pinned' ? 'Pin a thread to keep it on top' : 'Start one with Compose'}
                        </span>
                    </div>
                ) : (
                    <>
                        {pinned.length > 0 && (
                            <SidebarSection badge={pinned.length} label="Pinned">
                                {pinned.map((conv) => (
                                    <ConversationRow
                                        key={conv.otherId}
                                        active={conv.otherId === activeConversationId}
                                        conversation={conv}
                                        displayName={userNames[conv.otherId] || 'Loading…'}
                                        muted={mutedSet?.has(conv.otherId)}
                                        onSelect={onSelect}
                                        pinned
                                    />
                                ))}
                            </SidebarSection>
                        )}
                        {unread.length > 0 && (
                            <SidebarSection badge={unreadCount} label="Unread">
                                {unread.map((conv) => (
                                    <ConversationRow
                                        key={conv.otherId}
                                        active={conv.otherId === activeConversationId}
                                        conversation={conv}
                                        displayName={userNames[conv.otherId] || 'Loading…'}
                                        muted={mutedSet?.has(conv.otherId)}
                                        onSelect={onSelect}
                                    />
                                ))}
                            </SidebarSection>
                        )}
                        {recent.length > 0 && (
                            <SidebarSection label={pinned.length || unread.length ? 'Recent' : 'All'}>
                                {recent.map((conv) => (
                                    <ConversationRow
                                        key={conv.otherId}
                                        active={conv.otherId === activeConversationId}
                                        conversation={conv}
                                        displayName={userNames[conv.otherId] || 'Loading…'}
                                        muted={mutedSet?.has(conv.otherId)}
                                        onSelect={onSelect}
                                    />
                                ))}
                            </SidebarSection>
                        )}
                    </>
                )}
            </div>
        </aside>
    )
}
