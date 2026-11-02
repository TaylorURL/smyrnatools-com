import React from 'react'

import CountBubble from '../common/CountBubble'

/** Account page header: the title and the user's region, messages and sign
 *  out on the right, and the account's sections as underline tabs along the
 *  bottom rule — the same header every top-level page opens with. */
export default function CockpitHeader({
    activeTab,
    isMobile,
    onChangeTab,
    onOpenMessages,
    onSignOut,
    regionLabel,
    tabs,
    unreadMessageCount = 0
}) {
    return (
        <header className="shrink-0 bg-bg-secondary px-4 pt-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1">
                    <h1 className="m-0 font-heading text-[28px] font-semibold leading-none tracking-tight text-text-primary">
                        Account
                    </h1>
                    {regionLabel && <p className="m-0 mt-2 truncate text-[13px] text-text-secondary">{regionLabel}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {onOpenMessages && (
                        <button
                            type="button"
                            onClick={() => onOpenMessages()}
                            aria-label={
                                unreadMessageCount > 0
                                    ? `Open messages — ${unreadMessageCount} unread`
                                    : 'Open messages'
                            }
                            className="btn-secondary relative"
                        >
                            <i className="fas fa-envelope text-[12px]" aria-hidden="true" />
                            {!isMobile && <span>Messages</span>}
                            <CountBubble
                                count={unreadMessageCount}
                                size="sm"
                                ring="ring-bg-secondary"
                                className="absolute -right-1.5 -top-1.5"
                            />
                        </button>
                    )}
                    <button type="button" onClick={onSignOut} aria-label="Sign out" className="btn-danger">
                        <i className="fas fa-arrow-right-from-bracket text-[12px]" aria-hidden="true" />
                        {!isMobile && <span>Sign out</span>}
                    </button>
                </div>
            </div>
            <div className="mt-4 overflow-x-auto border-b border-border-light">
                <div className="-mb-px flex items-center gap-6" role="tablist">
                    {tabs.map(({ id, label }) => {
                        const isActive = activeTab === id
                        return (
                            <button
                                type="button"
                                key={id}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => onChangeTab(id)}
                                data-tutorial-target={id === 'preferences' ? 'preferences-tab' : null}
                                className={`whitespace-nowrap border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-2.5 pt-1 text-[13px] font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:text-text-primary ${
                                    isActive
                                        ? 'border-text-primary text-text-primary'
                                        : 'border-transparent text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                {label}
                            </button>
                        )
                    })}
                </div>
            </div>
        </header>
    )
}
