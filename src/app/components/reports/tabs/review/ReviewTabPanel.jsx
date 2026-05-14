import React from 'react'

import { ReportUtility } from '../../../../../utils/ReportUtility'
import {
    RV_RAIL_FIXED,
    RV_SPLIT_LEFT,
    RV_SPLIT_PARENT,
    RV_SPLIT_RAIL_SLOT
} from '../../../../constants/reportsViewConstants'
import DeadlineFuse from '../../DeadlineFuse'
import { MobileFilterShell, ReviewFilterBar } from '../../ReportsToolbar'
import WeekRibbon from '../../WeekRibbon'
import MergedReviewList from './MergedReviewList'
import MissingPanel from './MissingPanel'

/** Body for the "Review" tab — week ribbon, filter bar, the merged review
 *  list of submitted reports, and the missing-reports rail. */
export default function ReviewTabPanel({
    filters,
    getUserName,
    handlers,
    onPickWeek,
    railCollapsed,
    railRef,
    reviewTypeOptions,
    reviewedByCurrentUser,
    timeline
}) {
    const { fuseForSelectedWeek, selectedWeekIso, selectedWeekRange, weekRibbonData } = timeline
    return (
        <div className="flex flex-col gap-4">
            <WeekRibbon weeks={weekRibbonData} activeIso={selectedWeekIso} onPick={onPickWeek} />
            <DeadlineFuse
                daysLeft={fuseForSelectedWeek.daysLeft}
                cutoffLabel={ReportUtility.getLateCutoffLabel()}
                todayIndex={fuseForSelectedWeek.todayIndex}
                mode={fuseForSelectedWeek.mode}
                caption={fuseForSelectedWeek.caption}
            />
            <MobileFilterShell
                label="Filters"
                activeCount={
                    (filters.reviewStatusFilter !== 'all' ? 1 : 0) +
                    (filters.filterReportType ? 1 : 0) +
                    (filters.reviewDateFrom ? 1 : 0) +
                    (filters.reviewDateTo ? 1 : 0)
                }
            >
                <div className="bg-bg-primary border border-border-light rounded-lg px-3 py-2.5">
                    <ReviewFilterBar
                        statusFilter={filters.reviewStatusFilter}
                        onStatusFilterChange={filters.setReviewStatusFilter}
                        reportTypeFilter={filters.filterReportType}
                        onReportTypeFilterChange={filters.setFilterReportType}
                        reportTypeOptions={reviewTypeOptions}
                        sort={filters.reviewSort}
                        onSortChange={filters.setReviewSort}
                        dateFrom={filters.reviewDateFrom}
                        onDateFromChange={filters.setReviewDateFrom}
                        dateTo={filters.reviewDateTo}
                        onDateToChange={filters.setReviewDateTo}
                        hasActiveFilters={filters.reviewHasActiveFilters}
                        onClear={filters.clearReviewFilters}
                    />
                </div>
            </MobileFilterShell>
            <div className={RV_SPLIT_PARENT} data-collapsed={railCollapsed}>
                <div className={RV_SPLIT_LEFT}>
                    <div className="text-xs font-bold uppercase tracking-[.06em] text-slate-500 font-heading">
                        Submitted · {selectedWeekRange}
                    </div>
                    <MergedReviewList
                        missing={[]}
                        review={filters.filteredReviewReports}
                        reviewedByCurrentUser={reviewedByCurrentUser}
                        getUserName={getUserName}
                        onReview={handlers.handleReview}
                        onNudge={handlers.handleNudge}
                    />
                </div>
                <div ref={railRef} className={RV_SPLIT_RAIL_SLOT}>
                    <div className={RV_RAIL_FIXED}>
                        <MissingPanel
                            missing={filters.visibleMissingReports}
                            getUserName={getUserName}
                            onNudge={handlers.handleNudge}
                            weekRangeLabel={selectedWeekRange}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
