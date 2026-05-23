import React from 'react'

import { ReportUtility } from '../../../../../utils/ReportUtility'
import {
    formatRange,
    RV_RAIL_FIXED,
    RV_SPLIT_LEFT,
    RV_SPLIT_PARENT,
    RV_SPLIT_RAIL_SLOT
} from '../../../../constants/reportsViewConstants'
import WeekRibbon from '../../WeekRibbon'
import MyReportsSummaryBar from './MyReportsSummaryBar'
import OverdueBanner from './OverdueBanner'
import QuickRail from './QuickRail'
import ReportsEmptyState from './ReportsEmptyState'
import TrackCard from './TrackCard'

/** Body for the "My Reports" tab — summary bar, week ribbon, deadline fuse,
 *  overdue banner, the track-card grid for the selected week, and the
 *  collapsible right rail with one-off quick actions. */
export default function MyReportsTabPanel({
    accent,
    handlers,
    hasAssigned,
    hasLostLoadsPermission,
    hasQCStrengthPermission,
    onOpenLostLoad,
    onOpenQCStrength,
    onOpenThirdPartyLab,
    onPickWeek,
    railCollapsed,
    railRef,
    timeline
}) {
    const {
        fuseForSelectedWeek,
        getHistoryForName,
        isSelectedWeekFuture,
        isSelectedWeekThis,
        myItemsForSelectedWeek,
        myReportsSummary,
        overdueSourceItems,
        recentSubmissions,
        selectedWeekIso,
        selectedWeekRange,
        weekRibbonData
    } = timeline
    return (
        <div className="flex flex-col gap-4">
            <MyReportsSummaryBar
                accent={accent}
                cutoffLabel={ReportUtility.getLateCutoffLabel()}
                daysLeft={fuseForSelectedWeek.daysLeft}
                fuseCaption={fuseForSelectedWeek.caption}
                isFuture={fuseForSelectedWeek.mode === 'future'}
                isPast={fuseForSelectedWeek.mode === 'past'}
                overdueCarryover={myReportsSummary.overdueCarryover}
                pending={myReportsSummary.pending}
                submitted={myReportsSummary.submitted}
                todayIndex={fuseForSelectedWeek.todayIndex}
                weekLabel={isSelectedWeekFuture ? 'Next week' : isSelectedWeekThis ? 'This week' : 'Archived week'}
                weekRange={selectedWeekRange}
            />
            <WeekRibbon weeks={weekRibbonData} activeIso={selectedWeekIso} onPick={onPickWeek} />
            {overdueSourceItems.length > 0 && (
                <OverdueBanner
                    count={overdueSourceItems.length}
                    title={overdueSourceItems[0]?.title}
                    dueLabel={
                        overdueSourceItems[0]?.weekIso ? `week of ${formatRange(overdueSourceItems[0].weekIso)}` : ''
                    }
                    onSubmit={handlers.handleSubmitOldestOverdue}
                />
            )}
            <div className={RV_SPLIT_PARENT} data-collapsed={railCollapsed}>
                <div className={RV_SPLIT_LEFT}>
                    <div className="text-[10px] font-bold uppercase tracking-[.08em] text-text-secondary font-heading">
                        {isSelectedWeekFuture
                            ? `Next Week · ${selectedWeekRange}`
                            : isSelectedWeekThis
                              ? `Weekly reports · Track · ${selectedWeekRange}`
                              : `${selectedWeekRange} · Archive`}
                    </div>
                    {isSelectedWeekFuture ? (
                        <div className="rounded-lg border py-12 px-4 text-center text-sm bg-bg-primary border-border-light text-text-secondary">
                            Next week opens Monday — nothing to file yet.
                        </div>
                    ) : myItemsForSelectedWeek.length === 0 ? (
                        <ReportsEmptyState
                            tab="all"
                            hasAssigned={hasAssigned}
                            hasOneOffAccess={hasLostLoadsPermission || hasQCStrengthPermission}
                        />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {myItemsForSelectedWeek.map((item) => (
                                <TrackCard
                                    key={`${item.name}-${item.weekIso}`}
                                    item={item}
                                    history={getHistoryForName(item.name)}
                                    onStart={handlers.handleTrackAction}
                                    onContinue={handlers.handleTrackAction}
                                    onView={handlers.handleTrackAction}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div ref={railRef} className={RV_SPLIT_RAIL_SLOT}>
                    <div className={RV_RAIL_FIXED}>
                        <QuickRail
                            hasQCStrengthPermission={hasQCStrengthPermission}
                            hasLostLoadsPermission={hasLostLoadsPermission}
                            onOpenQCStrength={onOpenQCStrength}
                            onOpenThirdPartyLab={onOpenThirdPartyLab}
                            onOpenLostLoad={onOpenLostLoad}
                            recentItems={recentSubmissions}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
