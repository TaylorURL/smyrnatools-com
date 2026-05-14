import React from 'react'

/** Sticky page header — title + at-a-glance chips + Mark all read + Compose.
 *  Mirrors the Plan-tab cockpit header rhythm so the messages surface feels
 *  like part of the same product. */
export default function PageHeader({ accentColor, conversationCount = 0, onCompose, onMarkAllRead, unreadCount = 0 }) {
    return (
        <div className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5 bg-bg-primary border-border-light">
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0 text-text-primary">Messages</h1>
            <span className="inline-flex items-center gap-1.5 rounded text-[12px] font-medium px-2.5 py-1 bg-bg-secondary border border-border-light text-text-primary">
                <i className="fas fa-comments text-[10px] text-text-tertiary" />
                <span className="font-mono tabular-nums">{conversationCount}</span> conversation
                {conversationCount === 1 ? '' : 's'}
            </span>
            {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded text-[12px] font-medium px-2.5 py-1 bg-[rgba(220,38,38,0.12)] border border-[rgba(220,38,38,0.3)] text-red-600">
                    <i className="fas fa-envelope text-[10px]" />
                    <span className="font-mono tabular-nums">{unreadCount}</span> unread
                </span>
            )}
            <div className="flex-1 min-w-[8px]" />
            {unreadCount > 0 && (
                <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 bg-bg-tertiary text-text-secondary"
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
