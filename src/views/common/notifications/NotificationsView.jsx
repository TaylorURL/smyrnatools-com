import React, { useEffect, useMemo, useRef, useState } from 'react'

import EmbeddedViewModal from '../../../app/components/dashboard/EmbeddedViewModal'
import { useSharedMessages } from '../../../app/context/MessagesContext'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useAccentColor } from '../../../app/hooks/useAccentColor'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import MessageService from '../../../services/MessageService'
import { UserService } from '../../../services/UserService'
import DateUtility from '../../../utils/DateUtility'
import UserUtility from '../../../utils/UserUtility'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'

function formatMessageTime(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function getDateLabel(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ATTACHMENT_ICONS = {
    equipment: 'fas fa-snowplow',
    issue: 'fas fa-exclamation-triangle',
    mixer: 'fas fa-truck-moving',
    pickup_truck: 'fas fa-truck-pickup',
    tractor: 'fas fa-truck',
    trailer: 'fas fa-trailer'
}

/** Maps message attachment types to EmbeddedViewModal view keys. */
const ATTACHMENT_VIEW_MAP = {
    equipment: 'equipment',
    mixer: 'mixers',
    pickup_truck: 'tractors',
    tractor: 'tractors',
    trailer: 'trailers'
}

/** Maps issue meta.itemType (capitalized) to embedded view keys. */
const ITEM_TYPE_VIEW_MAP = {
    Equipment: 'equipment',
    Mixer: 'mixers',
    Tractor: 'tractors',
    Trailer: 'trailers'
}

/** Resolves the embedded view key and search term from an attachment. */
function resolveAttachmentView(type, meta) {
    if (type === 'issue' || type === 'asset') {
        const viewKey = ITEM_TYPE_VIEW_MAP[meta?.itemType]
        return viewKey ? { search: meta?.itemNumber || '', viewKey } : null
    }
    const viewKey = ATTACHMENT_VIEW_MAP[type]
    return viewKey ? { search: meta?.itemNumber || '', viewKey } : null
}

/**
 * Messages center — split-pane inbox.
 *
 * Left rail lists every conversation; right pane renders the active thread
 * (or a list view when none is selected). On mobile only one pane shows at
 * a time. All chrome follows the Plan-tab aesthetic: flat 1px borders, 6px
 * radius, var() tokens, monospace timestamps.
 */
/** Sidebar filter modes. Pinned / Unread / All — keeping the list short
 *  on purpose; @mentions don't exist yet so the noise floor is low. */
const FILTER_PILLS = [
    { icon: 'fa-inbox', id: 'all', label: 'All' },
    { icon: 'fa-bell', id: 'unread', label: 'Unread' },
    { icon: 'fa-thumbtack', id: 'pinned', label: 'Pinned' }
]

function NotificationsView({ initialConversationId = null }) {
    const accentColor = useAccentColor()
    const isMobile = useIsMobile()
    const [composing, setComposing] = useState(false)
    const [activeConversationId, setActiveConversationId] = useState(initialConversationId)
    const [embeddedView, setEmbeddedView] = useState(null)
    const [embeddedViewSearch, setEmbeddedViewSearch] = useState('')
    const [search, setSearch] = useState('')
    const [activeFilter, setActiveFilter] = useState('all')

    const {
        conversations,
        deleteMessage,
        unreadCount,
        loading: msgLoading,
        markAllRead: markAllMsgRead,
        markConversationRead,
        mutedSet,
        pinnedSet,
        sendMessage,
        toggleMute,
        togglePin,
        resolvedUserId
    } = useSharedMessages()

    // Sync prop changes (e.g. clicking a conversation from the nav popup while already on this view)
    const handledConvoRef = useRef(initialConversationId)
    useEffect(() => {
        if (initialConversationId && initialConversationId !== handledConvoRef.current) {
            handledConvoRef.current = initialConversationId
            setActiveConversationId(initialConversationId)
            markConversationRead(initialConversationId)
        }
    }, [initialConversationId, markConversationRead])

    const activeConversation = useMemo(
        () => (activeConversationId ? conversations.find((c) => c.otherId === activeConversationId) || null : null),
        [activeConversationId, conversations]
    )

    const [userNames, setUserNames] = useState({})

    useEffect(() => {
        const ids = new Set(conversations.map((c) => c.otherId))
        const missing = [...ids].filter((id) => id && !userNames[id])
        if (!missing.length) return
        let cancelled = false
        const resolve = async () => {
            const names = {}
            await Promise.all(
                missing.map(async (id) => {
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
    }, [conversations, userNames])

    const filteredConversations = useMemo(() => {
        const term = search.trim().toLowerCase()
        const matchesSearch = (c) => {
            if (!term) return true
            const name = (userNames[c.otherId] || '').toLowerCase()
            const subject = (c.lastMessage?.subject || '').toLowerCase()
            const body = (c.lastMessage?.body || '').toLowerCase()
            return name.includes(term) || subject.includes(term) || body.includes(term)
        }
        const matchesFilter = (c) => {
            if (activeFilter === 'unread') return c.unread > 0
            if (activeFilter === 'pinned') return pinnedSet.has(c.otherId)
            return true
        }
        return conversations.filter((c) => matchesSearch(c) && matchesFilter(c))
    }, [conversations, search, userNames, activeFilter, pinnedSet])

    const openConversation = (conv) => {
        setActiveConversationId(conv.otherId)
        if (conv.unread > 0) markConversationRead(conv.otherId)
    }

    const openAttachment = (type, meta) => {
        const resolved = resolveAttachmentView(type, meta)
        if (!resolved) return
        setEmbeddedView(resolved.viewKey)
        setEmbeddedViewSearch(resolved.search)
    }

    /** Soft-deletes every message in the active thread for this user. */
    const deleteConversation = async (otherId) => {
        const convo = conversations.find((c) => c.otherId === otherId)
        if (!convo) return
        if (!window.confirm('Delete this conversation? Messages will disappear from your inbox.')) return
        await Promise.all((convo.messages || []).map((m) => deleteMessage(m.id)))
        if (activeConversationId === otherId) setActiveConversationId(null)
    }

    /** Sidebar context-pane visibility. The right rail is hidden while the
     *  user is on a smaller viewport so the thread + sidebar can claim the
     *  full width. Threshold is the same `xl` breakpoint Plan tabs use. */
    const showSidebar = !isMobile || !activeConversation
    const showThreadPane = !isMobile || !!activeConversation
    const showContextRail = !isMobile && !!activeConversation

    const activeIsPinned = activeConversation ? pinnedSet.has(activeConversation.otherId) : false
    const activeIsMuted = activeConversation ? mutedSet.has(activeConversation.otherId) : false

    return (
        <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
            <PageHeader
                accentColor={accentColor}
                conversationCount={conversations.length}
                unreadCount={unreadCount}
                onMarkAllRead={markAllMsgRead}
                onCompose={() => setComposing(true)}
            />

            <div className="flex-1 flex min-h-0">
                {showSidebar && (
                    <ConversationSidebar
                        accentColor={accentColor}
                        activeConversationId={activeConversationId}
                        activeFilter={activeFilter}
                        conversations={filteredConversations}
                        loading={msgLoading}
                        mutedSet={mutedSet}
                        onFilterChange={setActiveFilter}
                        onSelect={openConversation}
                        onSearchChange={setSearch}
                        pinnedSet={pinnedSet}
                        search={search}
                        unreadCount={unreadCount}
                        userNames={userNames}
                    />
                )}

                {showThreadPane && (
                    <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-secondary)' }}>
                        {activeConversation ? (
                            <>
                                <ChatHeader
                                    accentColor={accentColor}
                                    conversation={activeConversation}
                                    isMobile={isMobile}
                                    isMuted={activeIsMuted}
                                    isPinned={activeIsPinned}
                                    onBack={() => setActiveConversationId(null)}
                                    onDelete={() => deleteConversation(activeConversation.otherId)}
                                    onToggleMute={() => toggleMute(activeConversation.otherId)}
                                    onTogglePin={() => togglePin(activeConversation.otherId)}
                                    userNames={userNames}
                                />
                                <ChatMessages
                                    conversation={activeConversation}
                                    userNames={userNames}
                                    accentColor={accentColor}
                                    resolvedUserId={resolvedUserId}
                                    onAttachmentClick={openAttachment}
                                />
                                <ReplyBar
                                    accentColor={accentColor}
                                    otherName={userNames[activeConversation.otherId] || 'Unknown'}
                                    onSend={async (body) => {
                                        await sendMessage(activeConversation.otherId, '', body)
                                    }}
                                />
                            </>
                        ) : (
                            <EmptyThreadPane onCompose={() => setComposing(true)} accentColor={accentColor} />
                        )}
                    </div>
                )}

                {showContextRail && activeConversation && (
                    <ConversationContextRail
                        accentColor={accentColor}
                        conversation={activeConversation}
                        displayName={userNames[activeConversation.otherId] || 'Loading…'}
                        isMuted={activeIsMuted}
                        isPinned={activeIsPinned}
                        onAttachmentClick={openAttachment}
                        onDelete={() => deleteConversation(activeConversation.otherId)}
                        onToggleMute={() => toggleMute(activeConversation.otherId)}
                        onTogglePin={() => togglePin(activeConversation.otherId)}
                        resolvedUserId={resolvedUserId}
                    />
                )}
            </div>

            {composing && (
                <ComposeModal accentColor={accentColor} onSend={sendMessage} onClose={() => setComposing(false)} />
            )}

            {embeddedView && (
                <EmbeddedViewModal
                    embeddedView={embeddedView}
                    embeddedViewSearch={embeddedViewSearch}
                    accentColor={accentColor}
                    onClose={() => {
                        setEmbeddedView(null)
                        setEmbeddedViewSearch('')
                    }}
                />
            )}
        </div>
    )
}

/** Sticky page header — title + at-a-glance chips + Mark all read +
 *  Compose. Mirrors the Plan-tab cockpit header rhythm so the messages
 *  surface feels like part of the same product. */
function PageHeader({ accentColor, conversationCount = 0, unreadCount = 0, onMarkAllRead, onCompose }) {
    return (
        <div
            className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
        >
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0" style={{ color: 'var(--text-primary)' }}>
                Messages
            </h1>
            <span
                className="inline-flex items-center gap-1.5 rounded text-[12px] font-medium px-2.5 py-1"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)'
                }}
            >
                <i className="fas fa-comments text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
                <span className="font-mono tabular-nums">{conversationCount}</span> conversation
                {conversationCount === 1 ? '' : 's'}
            </span>
            {unreadCount > 0 && (
                <span
                    className="inline-flex items-center gap-1.5 rounded text-[12px] font-medium px-2.5 py-1"
                    style={{
                        background: 'rgba(220,38,38,0.12)',
                        border: '1px solid rgba(220,38,38,0.3)',
                        color: '#dc2626'
                    }}
                >
                    <i className="fas fa-envelope text-[10px]" />
                    <span className="font-mono tabular-nums">{unreadCount}</span> unread
                </span>
            )}
            <div className="flex-1 min-w-[8px]" />
            {unreadCount > 0 && (
                <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-check-double" />
                    <span className="hidden sm:inline">Mark all read</span>
                </button>
            )}
            <button
                type="button"
                onClick={onCompose}
                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 text-white"
                style={{ background: accentColor }}
            >
                <i className="fas fa-pen" />
                Compose
            </button>
        </div>
    )
}

/** Left rail — fixed-width on desktop, full-width on mobile. Splits the
 *  conversation list into Pinned / Unread / Recent so high-priority threads
 *  bubble to the top regardless of recency. Filter pills above the sections
 *  apply on top of the search box. */
function ConversationSidebar({
    accentColor,
    activeConversationId,
    activeFilter = 'all',
    conversations,
    loading,
    mutedSet,
    onFilterChange,
    onSelect,
    onSearchChange,
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
        <aside
            className="shrink-0 flex flex-col w-full lg:w-[320px] min-h-0"
            style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border-light)' }}
        >
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="relative">
                    <i
                        className="fas fa-magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-[10px]"
                        style={{ color: 'var(--text-tertiary)' }}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search conversations…"
                        className="w-full rounded text-[12px] pl-7 pr-2 py-1.5 outline-none"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>
            </div>

            <div
                className="flex items-center gap-1.5 flex-wrap px-3 py-2 shrink-0"
                style={{ borderBottom: '1px solid var(--border-light)' }}
            >
                {FILTER_PILLS.map(({ icon, id, label }) => {
                    const isActive = activeFilter === id
                    const count = counts[id] ?? 0
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onFilterChange?.(id)}
                            className="inline-flex items-center gap-1 rounded text-[11px] font-semibold border cursor-pointer px-1.5 py-0.5 transition-colors"
                            style={{
                                background: isActive ? accentColor : 'var(--bg-secondary)',
                                borderColor: isActive ? accentColor : 'var(--border-light)',
                                color: isActive ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            <i className={`fas ${icon} text-[9.5px]`} />
                            <span>{label}</span>
                            <span
                                className="font-mono tabular-nums rounded px-1 text-[10px]"
                                style={{
                                    background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                                    color: isActive ? '#fff' : 'var(--text-tertiary)'
                                }}
                            >
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <SidebarSkeleton />
                ) : conversations.length === 0 ? (
                    <div
                        className="flex flex-col items-center justify-center py-12"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <i className="fas fa-inbox text-2xl mb-2" />
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
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
                            <SidebarSection
                                accentColor={accentColor}
                                badge={pinned.length}
                                icon="fa-thumbtack"
                                label="Pinned"
                            >
                                {pinned.map((conv) => (
                                    <ConversationRow
                                        key={conv.otherId}
                                        accentColor={accentColor}
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
                            <SidebarSection accentColor={accentColor} badge={unreadCount} icon="fa-bell" label="Unread">
                                {unread.map((conv) => (
                                    <ConversationRow
                                        key={conv.otherId}
                                        accentColor={accentColor}
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
                            <SidebarSection
                                accentColor={accentColor}
                                icon="fa-clock-rotate-left"
                                label={pinned.length || unread.length ? 'Recent' : 'All'}
                            >
                                {recent.map((conv) => (
                                    <ConversationRow
                                        key={conv.otherId}
                                        accentColor={accentColor}
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

function SidebarSection({ accentColor, badge, children, icon, label }) {
    return (
        <div>
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                {icon && (
                    <i
                        className={`fas ${icon} text-[10px]`}
                        style={{ color: 'var(--text-tertiary)', textAlign: 'center', width: 12 }}
                    />
                )}
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                </span>
                {badge != null && badge > 0 && (
                    <span
                        className="font-mono tabular-nums rounded px-1 text-[9px] font-bold text-white"
                        style={{ background: accentColor }}
                    >
                        {badge}
                    </span>
                )}
            </div>
            <div>{children}</div>
        </div>
    )
}

function ConversationRow({ accentColor, active, conversation, displayName, muted = false, onSelect, pinned = false }) {
    const initials = UserUtility.getInitials(displayName)
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
    const attachmentIcon = lastAttachment ? ATTACHMENT_ICONS[lastAttachment.attachmentType] || 'fas fa-paperclip' : null

    return (
        <button
            type="button"
            onClick={() => onSelect(conversation)}
            className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-bg-tertiary"
            style={{
                background: active ? `${accentColor}14` : hasUnread ? `${accentColor}0A` : 'transparent',
                borderBottom: '1px solid var(--border-light)',
                borderLeft: active ? `2px solid ${accentColor}` : '2px solid transparent'
            }}
        >
            <div className="relative shrink-0">
                <div
                    className="flex h-9 w-9 items-center justify-center rounded text-[12px] font-bold text-white"
                    style={{ background: accentColor }}
                >
                    {initials}
                </div>
                {hasUnread && (
                    <span
                        className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-white font-mono tabular-nums"
                        style={{ background: '#dc2626', border: '1.5px solid var(--bg-primary)' }}
                    >
                        {conversation.unread}
                    </span>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                        {pinned && (
                            <i
                                className="fas fa-thumbtack text-[9px]"
                                style={{ color: accentColor, transform: 'rotate(40deg)' }}
                            />
                        )}
                        {muted && (
                            <i className="fas fa-bell-slash text-[9px]" style={{ color: 'var(--text-tertiary)' }} />
                        )}
                        <span
                            className={`truncate text-[12.5px] ${hasUnread ? 'font-bold' : 'font-semibold'}`}
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {displayName}
                        </span>
                    </span>
                    <span
                        className="shrink-0 text-[10px] font-mono tabular-nums"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {DateUtility.formatTimeAgo(latest?.createdAt)}
                    </span>
                </div>
                {latest?.subject && (
                    <p
                        className="m-0 truncate text-[10.5px] mt-0.5"
                        style={{ color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                        {latest.subject}
                    </p>
                )}
                <p
                    className="m-0 truncate text-[11px] mt-0.5"
                    style={{ color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                    {latest?.body}
                </p>
                {attachmentLabel && (
                    <div className="mt-1 flex items-center gap-1.5">
                        <span
                            className="inline-flex items-center gap-1 rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                            style={{
                                background: `${accentColor}1a`,
                                color: accentColor
                            }}
                        >
                            <i className={`${attachmentIcon} text-[8.5px]`} />
                            <span className="font-mono tabular-nums">{attachmentLabel}</span>
                        </span>
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
                <div
                    key={i}
                    className="flex animate-pulse items-center gap-2.5 px-3 py-2"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="h-7 w-7 shrink-0 rounded" style={{ background: 'var(--bg-tertiary)' }} />
                    <div className="flex flex-1 min-w-0 flex-col gap-1">
                        <div
                            className="h-3 rounded"
                            style={{ background: 'var(--bg-tertiary)', width: `${60 + i * 8}%` }}
                        />
                        <div
                            className="h-2.5 rounded"
                            style={{ background: 'var(--bg-secondary)', width: `${78 - i * 6}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

function ChatHeader({
    accentColor,
    conversation,
    isMobile,
    isMuted = false,
    isPinned = false,
    onBack,
    onDelete,
    onToggleMute,
    onTogglePin,
    userNames
}) {
    const name = userNames[conversation.otherId] || 'Conversation'
    const messageCount = conversation.messages.length
    return (
        <div
            className="flex items-center gap-2.5 px-3 py-2 shrink-0"
            style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
        >
            {isMobile && (
                <button
                    onClick={onBack}
                    className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-bg-tertiary"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Back to inbox"
                >
                    <i className="fas fa-arrow-left text-[12px]" />
                </button>
            )}
            <div
                className="flex h-9 w-9 items-center justify-center rounded text-[12px] font-bold text-white shrink-0"
                style={{ background: accentColor }}
            >
                {UserUtility.getInitials(name)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold m-0 truncate" style={{ color: 'var(--text-primary)' }}>
                        {name}
                    </span>
                    {isPinned && (
                        <i
                            className="fas fa-thumbtack text-[10px]"
                            style={{ color: accentColor, transform: 'rotate(40deg)' }}
                            title="Pinned"
                        />
                    )}
                    {isMuted && (
                        <i
                            className="fas fa-bell-slash text-[10px]"
                            style={{ color: 'var(--text-tertiary)' }}
                            title="Muted"
                        />
                    )}
                </div>
                <div
                    className="text-[10.5px] m-0 font-mono tabular-nums uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    {messageCount} message{messageCount !== 1 ? 's' : ''}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <ChatHeaderIconButton
                    accentColor={accentColor}
                    active={isPinned}
                    icon="fa-thumbtack"
                    onClick={onTogglePin}
                    title={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                />
                <ChatHeaderIconButton
                    accentColor={accentColor}
                    active={isMuted}
                    icon={isMuted ? 'fa-bell-slash' : 'fa-bell'}
                    onClick={onToggleMute}
                    title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                />
                <ChatHeaderIconButton danger icon="fa-trash-alt" onClick={onDelete} title="Delete conversation" />
            </div>
        </div>
    )
}

/** 30×30 icon button used by the chat header. Active state tints with the
 *  user's accent; danger flips to red. */
function ChatHeaderIconButton({ accentColor, active = false, danger = false, icon, onClick, title }) {
    const styles = danger
        ? { background: 'rgba(220, 38, 38, 0.12)', borderColor: 'rgba(220, 38, 38, 0.3)', color: '#dc2626' }
        : active
          ? { background: `${accentColor}1a`, borderColor: `${accentColor}55`, color: accentColor }
          : { background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="flex h-8 w-8 items-center justify-center rounded cursor-pointer transition-colors hover:brightness-95 border"
            style={styles}
        >
            <i className={`fas ${icon} text-[11px]`} />
        </button>
    )
}

function EmptyThreadPane({ accentColor, onCompose }) {
    return (
        <div
            className="flex-1 flex flex-col items-center justify-center text-center px-4"
            style={{ color: 'var(--text-tertiary)' }}
        >
            <div
                className="flex h-12 w-12 items-center justify-center rounded mb-3"
                style={{ background: 'var(--bg-tertiary)', color: accentColor }}
            >
                <i className="fas fa-comments text-lg" />
            </div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Select a conversation
            </div>
            <div className="text-[10.5px] mt-1">Pick a thread on the left or start a new message</div>
            <button
                onClick={onCompose}
                className="mt-3 flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 text-white"
                style={{ background: accentColor }}
            >
                <i className="fas fa-pen text-[10px]" />
                New Message
            </button>
        </div>
    )
}

/** Scrollable chat messages area. */
function ChatMessages({ conversation, userNames, accentColor, resolvedUserId, onAttachmentClick }) {
    const scrollRef = useRef(null)
    const otherInitials = UserUtility.getInitials(userNames[conversation.otherId] || '')

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
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-3"
            style={{ background: 'var(--bg-secondary)' }}
        >
            {dateGroups.map((group) => (
                <React.Fragment key={group.label}>
                    <div className="flex justify-center my-3 first:mt-0">
                        <span
                            className="px-2 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider font-mono tabular-nums"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-secondary)'
                            }}
                        >
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
                                            <div
                                                className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white"
                                                style={{ background: accentColor }}
                                            >
                                                {otherInitials}
                                            </div>
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
                                            <span
                                                className="text-[9.5px] font-mono tabular-nums"
                                                style={{ opacity: 0.55 }}
                                            >
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

/** Fixed reply bar at the bottom of the conversation. */
function ReplyBar({ accentColor, otherName, onSend }) {
    const [body, setBody] = useState('')
    const [sending, setSending] = useState(false)
    const textareaRef = useRef(null)

    const handleSend = async () => {
        const text = body.trim()
        if (!text || sending) return
        setSending(true)
        setBody('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        try {
            await onSend(text)
        } catch {
            /* empty */
        }
        setSending(false)
        textareaRef.current?.focus()
    }

    const canSend = !!body.trim() && !sending

    return (
        <div
            className="flex items-end gap-2 px-3 sm:px-4 py-2 shrink-0"
            style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-light)' }}
        >
            <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                    }
                }}
                placeholder={`Message ${otherName}…`}
                rows="1"
                className="flex-1 px-3 py-1.5 rounded text-[12.5px] outline-none resize-none"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    maxHeight: '100px'
                }}
                onFocus={(e) => {
                    e.currentTarget.style.borderColor = accentColor
                }}
                onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-light)'
                }}
                onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                }}
            />
            <button
                onClick={handleSend}
                disabled={!canSend}
                className="h-8 w-8 flex items-center justify-center rounded text-white shrink-0"
                style={{
                    background: canSend ? accentColor : 'var(--bg-tertiary)',
                    color: canSend ? '#fff' : 'var(--text-tertiary)',
                    cursor: canSend ? 'pointer' : 'not-allowed'
                }}
                aria-label="Send message"
            >
                <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-[12px]`} />
            </button>
        </div>
    )
}

/** Attachment preview inside chat bubbles. */
function AttachmentPreview({ type, meta, accentColor, light }) {
    const icon = ATTACHMENT_ICONS[type] || 'fas fa-paperclip'
    const label =
        type === 'issue' ? 'Issue' : type?.replace(/_/g, ' ')?.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Attachment'
    const isViewable = !!resolveAttachmentView(type, meta)
    return (
        <div className="flex items-start gap-2">
            <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                style={{ background: light ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)' }}
            >
                <i className={`${icon} text-[10px]`} style={{ color: light ? 'white' : accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                            background: light ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                            color: light ? 'white' : accentColor
                        }}
                    >
                        {label}
                    </span>
                    {meta.itemNumber && (
                        <span className="text-[11px] font-semibold font-mono tabular-nums">{meta.itemNumber}</span>
                    )}
                    {meta.severity && (
                        <span
                            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                            style={{
                                background:
                                    meta.severity === 'High'
                                        ? '#dc2626'
                                        : meta.severity === 'Low'
                                          ? '#16a34a'
                                          : '#2563eb'
                            }}
                        >
                            {meta.severity}
                        </span>
                    )}
                    {isViewable && (
                        <i className="fas fa-external-link-alt text-[9px] ml-auto" style={{ opacity: 0.55 }} />
                    )}
                </div>
                {meta.issueText && (
                    <p className="text-[11px] m-0 leading-snug" style={{ opacity: 0.85 }}>
                        {meta.issueText}
                    </p>
                )}
            </div>
        </div>
    )
}

/** Compose message modal. */
function ComposeModal({ accentColor, onSend, onClose }) {
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
                /* empty */
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

    const fieldStyle = {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        color: 'var(--text-primary)'
    }

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 23, 42, 0.65)' }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div
                className="w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden rounded"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-pen text-[11px]" />
                        </div>
                        <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            New Message
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {sent ? (
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <div
                                className="w-12 h-12 rounded flex items-center justify-center"
                                style={{ background: '#dcfce7', color: '#166534' }}
                            >
                                <i className="fas fa-check text-lg" />
                            </div>
                            <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Message Sent
                            </div>
                            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                {selectedRecipient?.firstName} {selectedRecipient?.lastName} will receive your message
                            </p>
                            <button
                                onClick={onClose}
                                className="rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5"
                                style={{ background: accentColor }}
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label
                                    className={`block ${SECTION_LABEL_CLASS} mb-1.5`}
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    To
                                </label>
                                <div ref={dropdownRef} className="relative">
                                    {selectedRecipient ? (
                                        <div
                                            className="flex items-center gap-2.5 px-2.5 py-2 rounded"
                                            style={fieldStyle}
                                        >
                                            <div
                                                className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                style={{ background: accentColor }}
                                            >
                                                {UserUtility.getInitials(
                                                    `${selectedRecipient.firstName} ${selectedRecipient.lastName}`
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div
                                                    className="text-[12.5px] font-semibold truncate"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    {selectedRecipient.firstName} {selectedRecipient.lastName}
                                                </div>
                                                <div
                                                    className="text-[10.5px] truncate"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                >
                                                    {selectedRecipient.roleName}
                                                    {selectedRecipient.plantCode
                                                        ? ` · ${selectedRecipient.plantCode}`
                                                        : ''}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedRecipient(null)}
                                                className="text-[11px] flex h-6 w-6 items-center justify-center rounded hover:bg-bg-tertiary"
                                                style={{ color: 'var(--text-secondary)' }}
                                                aria-label="Clear recipient"
                                            >
                                                <i className="fas fa-times" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                value={recipientSearch}
                                                onChange={(e) => {
                                                    setRecipientSearch(e.target.value)
                                                    setDropdownOpen(true)
                                                }}
                                                onFocus={() => setDropdownOpen(true)}
                                                placeholder="Search by name, role, or plant…"
                                                className="w-full px-2.5 py-1.5 rounded text-[12.5px] outline-none"
                                                style={fieldStyle}
                                            />
                                            {dropdownOpen && (
                                                <div
                                                    className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-y-auto rounded py-1"
                                                    style={{
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border-light)'
                                                    }}
                                                >
                                                    {loadingRecipients ? (
                                                        <div
                                                            className="px-3 py-2 text-[12px] text-center"
                                                            style={{ color: 'var(--text-secondary)' }}
                                                        >
                                                            <i className="fas fa-spinner fa-spin mr-1.5" />
                                                            Loading…
                                                        </div>
                                                    ) : filteredRecipients.length === 0 ? (
                                                        <div
                                                            className="px-3 py-2 text-[12px] text-center"
                                                            style={{ color: 'var(--text-secondary)' }}
                                                        >
                                                            No results found
                                                        </div>
                                                    ) : (
                                                        filteredRecipients.map((r) => (
                                                            <button
                                                                key={r.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedRecipient(r)
                                                                    setDropdownOpen(false)
                                                                    setRecipientSearch('')
                                                                }}
                                                                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left transition-colors hover:bg-bg-tertiary"
                                                                style={{ color: 'var(--text-primary)' }}
                                                            >
                                                                <div
                                                                    className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                                    style={{ background: accentColor }}
                                                                >
                                                                    {UserUtility.getInitials(
                                                                        `${r.firstName} ${r.lastName}`
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[12px] font-semibold truncate">
                                                                        {r.firstName} {r.lastName}
                                                                    </div>
                                                                    <div
                                                                        className="text-[10.5px] truncate"
                                                                        style={{ color: 'var(--text-secondary)' }}
                                                                    >
                                                                        {r.roleName}
                                                                        {r.plantCode ? ` · ${r.plantCode}` : ''}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label
                                    className={`block ${SECTION_LABEL_CLASS} mb-1.5`}
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject (optional)"
                                    className="w-full px-2.5 py-1.5 rounded text-[12.5px] outline-none"
                                    style={fieldStyle}
                                />
                            </div>

                            <div>
                                <label
                                    className={`block ${SECTION_LABEL_CLASS} mb-1.5`}
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Message
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Write your message…"
                                    rows="5"
                                    className="w-full px-2.5 py-1.5 rounded text-[12.5px] outline-none resize-y"
                                    style={{ ...fieldStyle, fontFamily: 'inherit', lineHeight: 1.55 }}
                                />
                            </div>

                            {error && (
                                <div
                                    className="px-2.5 py-1.5 rounded text-[12px] font-medium"
                                    style={{ background: '#fee2e2', color: '#b91c1c' }}
                                >
                                    <i className="fas fa-exclamation-triangle mr-1.5" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleSend}
                                disabled={!selectedRecipient || !body.trim() || sending}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded text-[10.5px] font-semibold uppercase tracking-wider"
                                style={{
                                    background:
                                        !selectedRecipient || !body.trim() || sending
                                            ? 'var(--bg-tertiary)'
                                            : accentColor,
                                    color:
                                        !selectedRecipient || !body.trim() || sending
                                            ? 'var(--text-tertiary)'
                                            : 'white',
                                    cursor: !selectedRecipient || !body.trim() || sending ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-[10px]`} />
                                {sending ? 'Sending…' : 'Send Message'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Right-side context rail — appears next to the active thread on wide
 *  viewports. Shows the partner's profile, every shared asset across the
 *  thread, derived activity stats, and quick-action toggles for pin / mute /
 *  delete. Hidden under `xl` (the rail is supplementary; the chat header
 *  exposes the same toggles for narrower screens). */
function ConversationContextRail({
    accentColor,
    conversation,
    displayName,
    isMuted,
    isPinned,
    onAttachmentClick,
    onDelete,
    onToggleMute,
    onTogglePin,
    resolvedUserId
}) {
    const initials = UserUtility.getInitials(displayName)
    /** Memo'd to keep `[]` referentially stable for the derivations below. */
    const messages = useMemo(() => conversation.messages || [], [conversation.messages])

    /** Unique list of attachments referenced anywhere in the thread. Keyed
     *  by `type:itemNumber` so the same asset doesn't render twice when
     *  it's been mentioned across multiple messages. */
    const sharedAssets = useMemo(() => {
        const seen = new Map()
        messages.forEach((msg) => {
            if (!msg.attachmentType || !msg.attachmentMeta) return
            const key = `${msg.attachmentType}:${msg.attachmentMeta.itemNumber || msg.id}`
            if (seen.has(key)) return
            seen.set(key, { meta: msg.attachmentMeta, type: msg.attachmentType })
        })
        return [...seen.values()]
    }, [messages])

    /** Lightweight stats — sent vs received message counts, last activity
     *  relative time, and total attachments. Drives the right rail's
     *  "Activity" card. */
    const stats = useMemo(() => {
        let sent = 0
        let received = 0
        messages.forEach((msg) => {
            if (resolvedUserId && String(msg.senderId) === String(resolvedUserId)) sent += 1
            else received += 1
        })
        return {
            attachments: sharedAssets.length,
            lastActivity: conversation.lastMessage?.createdAt,
            received,
            sent,
            total: messages.length
        }
    }, [messages, resolvedUserId, conversation.lastMessage, sharedAssets.length])

    return (
        <aside
            className="hidden xl:flex shrink-0 flex-col w-[280px] overflow-y-auto"
            style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-light)' }}
        >
            <div className="flex flex-col gap-3.5 p-3.5">
                {/* Profile card */}
                <div
                    className="flex flex-col items-center gap-2 rounded p-4 text-center"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                >
                    <div
                        className="flex h-14 w-14 items-center justify-center rounded text-[18px] font-bold text-white"
                        style={{ background: accentColor }}
                    >
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[13.5px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                            {displayName}
                        </div>
                        <div className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                            {stats.total} message{stats.total === 1 ? '' : 's'} · last{' '}
                            {DateUtility.formatTimeAgo(stats.lastActivity)}
                        </div>
                    </div>
                </div>

                {/* Shared assets */}
                <ContextSection icon="fa-paperclip" label="Shared assets" count={sharedAssets.length}>
                    {sharedAssets.length === 0 ? (
                        <ContextEmpty>No assets referenced in this thread yet.</ContextEmpty>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {sharedAssets.map(({ meta, type }) => {
                                const icon = ATTACHMENT_ICONS[type] || 'fas fa-paperclip'
                                const label = (() => {
                                    if (type === 'issue') return 'Issue'
                                    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                                })()
                                const isViewable = !!resolveAttachmentView(type, meta)
                                return (
                                    <button
                                        key={`${type}-${meta.itemNumber || Math.random()}`}
                                        type="button"
                                        onClick={() => isViewable && onAttachmentClick?.(type, meta)}
                                        disabled={!isViewable}
                                        className="flex items-center gap-2 rounded text-left transition-colors hover:bg-bg-tertiary px-2.5 py-1.5 cursor-pointer disabled:cursor-default"
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-light)'
                                        }}
                                    >
                                        <i className={`${icon} text-[11px]`} style={{ color: accentColor }} />
                                        <span
                                            className="font-mono tabular-nums text-[11.5px] font-bold"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {meta.itemNumber || '—'}
                                        </span>
                                        <span
                                            className="ml-auto text-[9.5px] uppercase tracking-wider font-semibold"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            {label}
                                        </span>
                                        {isViewable && (
                                            <i
                                                className="fas fa-external-link-alt text-[9px]"
                                                style={{ color: 'var(--text-tertiary)' }}
                                            />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </ContextSection>

                {/* Activity */}
                <ContextSection icon="fa-chart-line" label="Activity">
                    <div className="grid grid-cols-2 gap-2">
                        <ContextStat label="Sent" value={stats.sent} />
                        <ContextStat label="Received" value={stats.received} />
                        <ContextStat label="Attachments" value={stats.attachments} />
                        <ContextStat label="Total" value={stats.total} />
                    </div>
                </ContextSection>

                {/* Quick actions */}
                <ContextSection icon="fa-bolt" label="Quick actions">
                    <div className="flex flex-col gap-1.5">
                        <ContextActionButton
                            accentColor={accentColor}
                            active={isPinned}
                            icon="fa-thumbtack"
                            label={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                            onClick={onTogglePin}
                        />
                        <ContextActionButton
                            accentColor={accentColor}
                            active={isMuted}
                            icon={isMuted ? 'fa-bell-slash' : 'fa-bell'}
                            label={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                            onClick={onToggleMute}
                        />
                        <ContextActionButton
                            danger
                            icon="fa-trash-alt"
                            label="Delete conversation"
                            onClick={onDelete}
                        />
                    </div>
                </ContextSection>
            </div>
        </aside>
    )
}

/** Section wrapper inside the context rail — title + count + content. */
function ContextSection({ children, count, icon, label }) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
                {icon && (
                    <i
                        className={`fas ${icon} text-[10px]`}
                        style={{ color: 'var(--text-tertiary)', textAlign: 'center', width: 12 }}
                    />
                )}
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                </span>
                {count != null && (
                    <span
                        className="ml-auto font-mono tabular-nums rounded px-1.5 py-0.5 text-[9.5px] font-bold"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
                    >
                        {count}
                    </span>
                )}
            </div>
            {children}
        </div>
    )
}

function ContextEmpty({ children }) {
    return (
        <div
            className="text-[11px] rounded px-2.5 py-2"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border-light)',
                color: 'var(--text-tertiary)'
            }}
        >
            {children}
        </div>
    )
}

function ContextStat({ label, value }) {
    return (
        <div
            className="rounded px-2.5 py-2 flex flex-col gap-0.5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            <span className="text-[15px] font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {value}
            </span>
        </div>
    )
}

function ContextActionButton({ accentColor, active = false, danger = false, icon, label, onClick }) {
    const styles = danger
        ? { background: 'rgba(220, 38, 38, 0.08)', borderColor: 'rgba(220, 38, 38, 0.25)', color: '#dc2626' }
        : active
          ? { background: `${accentColor}14`, borderColor: `${accentColor}55`, color: accentColor }
          : { background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors hover:brightness-95 border"
            style={styles}
        >
            <i className={`fas ${icon} text-[11px]`} style={{ textAlign: 'center', width: 14 }} />
            <span>{label}</span>
        </button>
    )
}

export default NotificationsView
