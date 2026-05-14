/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ListService } from '../../../services/ListService'

function ActivitySkeleton({ count, isMobile }) {
    return (
        <div className="flex flex-col">
            {[...Array(count)].map((_, index) => (
                <div
                    key={index}
                    className={`flex border-b border-border-light ${isMobile ? 'gap-3 px-4 py-3' : 'gap-4 px-6 py-4'}`}
                >
                    <div
                        className={`rounded-full bg-slate-200 animate-pulse shrink-0 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`}
                    />
                    <div className="flex flex-1 flex-col gap-2">
                        <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
                        <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function ActivityRow({ accentColor, activityProfiles, entry, isMobile, onSelectItem }) {
    const display = ListService.getActivityDisplay(entry.action, entry.field_name)
    const actorName = ListService.getProfileName(entry.user_id, activityProfiles)
    const iconColor = display.color === 'accentColor' ? accentColor : display.color
    const hasValueChange = entry.action === 'updated' && (entry.old_value || entry.new_value)

    return (
        <div
            onClick={() => entry.list_item_id && onSelectItem(entry.list_item_id)}
            className={`flex border-b border-border-light cursor-pointer transition-all duration-200 ${
                isMobile ? 'gap-3 px-4 py-3' : 'gap-4 px-6 py-4'
            } bg-bg-primary`}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
        >
            <div className="flex items-start pt-0.5">
                <div
                    className={`flex items-center justify-center rounded-full shrink-0 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`}
                    style={{ background: `${iconColor}15`, color: iconColor }}
                >
                    <i className={`fas ${display.icon} ${isMobile ? 'text-[10px]' : 'text-xs'}`} />
                </div>
            </div>
            <div className={`flex flex-1 flex-col min-w-0 ${isMobile ? 'gap-1' : 'gap-1.5'}`}>
                <p className={`m-0 ${isMobile ? 'text-xs' : 'text-[0.8125rem]'}`}>
                    <span className="text-text-primary font-semibold">{actorName}</span>
                    <span className="text-text-secondary">{` ${display.verb} `}</span>
                    <span className="text-text-primary font-medium">
                        {ListService.truncateText(entry.item_description || 'an item', 60)}
                    </span>
                </p>
                {hasValueChange && (
                    <div className={`flex items-center gap-1.5 ${isMobile ? 'text-[0.625rem]' : 'text-xs'}`}>
                        <span className="text-text-tertiary bg-bg-tertiary rounded px-1.5 py-0.5 line-through">
                            {ListService.formatActivityValue(entry.field_name, entry.old_value)}
                        </span>
                        <i className="fas fa-arrow-right text-text-tertiary text-[8px]" />
                        <span className="text-text-secondary bg-bg-tertiary rounded px-1.5 py-0.5 font-medium">
                            {ListService.formatActivityValue(entry.field_name, entry.new_value)}
                        </span>
                    </div>
                )}
                <div className={`flex items-center gap-2 ${isMobile ? 'text-[0.625rem]' : 'text-xs'}`}>
                    <span className="text-text-tertiary font-medium">
                        {ListService.formatRelativeTime(entry.created_at)}
                    </span>
                </div>
            </div>
            <div className="flex items-center justify-center text-text-tertiary text-sm pt-0.5">
                <i className="fas fa-chevron-right" />
            </div>
        </div>
    )
}

/**
 * Recent task-activity feed card. Renders a per-row skeleton while loading,
 * an empty state when the feed is empty, or a list of activity rows whose
 * description-click navigates to the related list item.
 */
export default function ListActivityFeed({
    accentColor,
    activityFeed,
    activityLoading,
    activityProfiles,
    isMobile,
    onSelectItem
}) {
    return (
        <div className={`flex flex-col w-full ${isMobile ? 'pb-6' : 'pb-8'}`}>
            <div className="bg-bg-primary border border-border-light overflow-hidden rounded">
                <div className={`bg-bg-secondary border-b border-border-light ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
                    <div
                        className={`flex items-center text-text-primary font-bold ${isMobile ? 'text-sm gap-2' : 'text-base gap-3'}`}
                    >
                        <i className="fas fa-history" style={{ color: accentColor }} />
                        <span>Recent Activity</span>
                        {!activityLoading && (
                            <span
                                className={`inline-flex items-center justify-center rounded text-white font-bold px-2 ${
                                    isMobile ? 'text-[0.6875rem] h-5 min-w-[20px]' : 'text-xs h-6 min-w-[24px]'
                                }`}
                                style={{ background: accentColor }}
                            >
                                {activityFeed.length}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col">
                    {activityLoading ? (
                        <ActivitySkeleton count={6} isMobile={isMobile} />
                    ) : activityFeed.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="text-text-tertiary text-3xl mb-3">
                                <i className="fas fa-stream" />
                            </div>
                            <p className="text-text-secondary text-sm m-0">No activity recorded yet</p>
                        </div>
                    ) : (
                        activityFeed.map((entry, index) => (
                            <ActivityRow
                                key={entry.id || `${entry.action}-${index}`}
                                accentColor={accentColor}
                                activityProfiles={activityProfiles}
                                entry={entry}
                                isMobile={isMobile}
                                onSelectItem={onSelectItem}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
