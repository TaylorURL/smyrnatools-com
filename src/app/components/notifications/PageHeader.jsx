import React from 'react'

/** Messages page header: the title with the conversation and unread counts
 *  under it, Mark all read and Compose on the right. */
export default function PageHeader({ conversationCount = 0, onCompose, onMarkAllRead, unreadCount = 0 }) {
    return (
        <header className="shrink-0 border-b border-border-light bg-bg-secondary px-4 pb-4 pt-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1">
                    <h1 className="m-0 font-heading text-[28px] font-semibold leading-none tracking-tight text-text-primary">
                        Messages
                    </h1>
                    <p className="m-0 mt-2 text-[13px] text-text-secondary">
                        <span className="tabular-nums">{conversationCount}</span> conversation
                        {conversationCount === 1 ? '' : 's'}
                        {unreadCount > 0 && (
                            <>
                                {' · '}
                                <span className="font-medium text-status-danger">
                                    <span className="tabular-nums">{unreadCount}</span> unread
                                </span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button type="button" onClick={onMarkAllRead} className="btn-secondary">
                            <i className="fas fa-check-double text-[12px]" />
                            <span className="hidden sm:inline">Mark all read</span>
                        </button>
                    )}
                    <button type="button" onClick={onCompose} className="btn-primary">
                        <i className="fas fa-pen text-[11px]" />
                        Compose
                    </button>
                </div>
            </div>
        </header>
    )
}
