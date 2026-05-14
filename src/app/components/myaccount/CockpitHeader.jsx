import React from 'react'

/** Slim sticky page header for the account view. Mirrors `PlanHeader`'s
 *  rhythm: title + region scope chip + flex spacer + action cluster + inline
 *  tab pill switcher. */
export default function CockpitHeader({
    accentColor,
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
        <div className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5 bg-bg-primary border-border-light">
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0 text-text-primary">Account</h1>
            {regionLabel && (
                <span className="inline-flex items-center gap-2 rounded text-[12px] font-medium px-2.5 py-1 max-w-full bg-bg-secondary border border-border-light text-text-primary">
                    <i className="fas fa-location-dot text-[10px] text-green-600" />
                    <span className="truncate">{regionLabel}</span>
                </span>
            )}
            <div className="flex-1 min-w-[8px]" />
            <div className="flex items-center gap-1.5 shrink-0">
                {onOpenMessages && (
                    <button
                        type="button"
                        onClick={() => onOpenMessages()}
                        title={
                            unreadMessageCount > 0
                                ? `${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}`
                                : 'Open messages'
                        }
                        className="relative flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 transition-colors hover:brightness-95 bg-bg-tertiary text-text-secondary"
                    >
                        <i className="fas fa-comments" />
                        {!isMobile && <span>Messages</span>}
                        {unreadMessageCount > 0 && (
                            <span
                                className="absolute font-mono tabular-nums rounded-full text-[9.5px] font-bold uppercase tracking-wider min-w-[16px] h-[16px] flex items-center justify-center px-1 bg-red-600 text-white"
                                style={{ border: '1.5px solid var(--bg-primary)', right: -4, top: -4 }}
                            >
                                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                            </span>
                        )}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onSignOut}
                    title="Sign out"
                    className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 transition-colors hover:brightness-95 bg-[rgba(220,_38,_38,_0.12)] text-red-600"
                >
                    <i className="fas fa-arrow-right-from-bracket" />
                    {!isMobile && <span>Sign out</span>}
                </button>
            </div>
            <div
                className="flex items-center rounded-lg p-0.5 overflow-x-auto bg-bg-tertiary border border-border-light"
                role="tablist"
            >
                {tabs.map(({ icon, id, label }) => {
                    const isActive = activeTab === id
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onChangeTab(id)}
                            data-tutorial-target={id === 'preferences' ? 'preferences-tab' : null}
                            className="flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 whitespace-nowrap transition-colors"
                            style={{
                                backgroundColor: isActive ? accentColor : 'transparent',
                                color: isActive ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            <i className={`fas ${icon}`} />
                            {!isMobile && <span>{label}</span>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
