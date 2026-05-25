import React from 'react'

import { ReportsViewSkeleton } from '../../../../app/components/reports/ReportsViewSkeletons'
import LostLoadsTabPanel from '../../../../app/components/reports/tabs/lost-loads/LostLoadsTabPanel'
import MyReportsTabPanel from '../../../../app/components/reports/tabs/my-reports/MyReportsTabPanel'
import QualityTabPanel from '../../../../app/components/reports/tabs/quality/QualityTabPanel'
import ReviewTabPanel from '../../../../app/components/reports/tabs/review/ReviewTabPanel'
import QualityIssuesView from '../../quality/QualityIssuesView'

/**
 * Routes the active tab to its panel and renders the correct skeleton
 * during initial loads. Hoisted out of `ReportsView` to keep the
 * orchestrator focused on state plumbing rather than render branching.
 */
function ReportsTabContent({
    accent,
    deleteLostLoadReport,
    filters,
    getUserName,
    handlers,
    hasAssigned,
    hasLostLoadsDeletePermission,
    hasLostLoadsPermission,
    hasQCStrengthPermission,
    isLoadingLostLoads,
    lostLoadsPagination,
    modals,
    onPickWeek,
    preferences,
    qc,
    railCollapsed,
    railRef,
    regionalPlants,
    reviewTypeOptions,
    reviewedByCurrentUser,
    showAllSkeleton,
    showBootSkeleton,
    showReviewSkeleton,
    tab,
    timeline
}) {
    return (
        <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-5">
            {showBootSkeleton && <ReportsViewSkeleton variant="grid" />}
            {showAllSkeleton && <ReportsViewSkeleton variant="grid" />}
            {showReviewSkeleton && <ReportsViewSkeleton variant="list" />}

            {!showBootSkeleton && !showAllSkeleton && tab === 'all' && (
                <MyReportsTabPanel
                    accent={accent}
                    handlers={handlers}
                    hasAssigned={hasAssigned}
                    hasLostLoadsPermission={hasLostLoadsPermission}
                    hasQCStrengthPermission={hasQCStrengthPermission}
                    onOpenLostLoad={() => modals.setShowLostLoadModal(true)}
                    onOpenQCStrength={() => modals.setShowQCStrengthModal(true)}
                    onOpenThirdPartyLab={() => modals.setShowLabReportModal(true)}
                    onPickWeek={onPickWeek}
                    railCollapsed={railCollapsed}
                    railRef={railRef}
                    timeline={timeline}
                />
            )}

            {!showReviewSkeleton && tab === 'review' && (
                <ReviewTabPanel
                    filters={filters}
                    getUserName={getUserName}
                    handlers={handlers}
                    onPickWeek={onPickWeek}
                    railCollapsed={railCollapsed}
                    railRef={railRef}
                    reviewTypeOptions={reviewTypeOptions}
                    reviewedByCurrentUser={reviewedByCurrentUser}
                    timeline={timeline}
                />
            )}

            {tab === 'lost_loads' && (
                <LostLoadsTabPanel
                    accent={accent}
                    deleteLostLoadReport={deleteLostLoadReport}
                    filters={filters}
                    getUserName={getUserName}
                    handlers={handlers}
                    hasLostLoadsDeletePermission={hasLostLoadsDeletePermission}
                    hasLostLoadsPermission={hasLostLoadsPermission}
                    isLoadingLostLoads={isLoadingLostLoads}
                    lostLoadsPagination={lostLoadsPagination}
                    onOpenLostLoadModal={() => modals.setShowLostLoadModal(true)}
                    onSetSelectedLostLoad={modals.setSelectedLostLoad}
                    railCollapsed={railCollapsed}
                    railRef={railRef}
                    regionalPlants={regionalPlants}
                />
            )}

            {tab === 'quality' && (
                <QualityTabPanel
                    accent={accent}
                    filters={filters}
                    getUserName={getUserName}
                    handlers={handlers}
                    hasQCStrengthPermission={hasQCStrengthPermission}
                    onOpenLabReportModal={() => modals.setShowLabReportModal(true)}
                    onOpenQcStrengthModal={() => modals.setShowQCStrengthModal(true)}
                    onOpenQualityIssueModal={() => modals.setShowQualityIssueModal(true)}
                    onSetSelectedLabReport={modals.setSelectedLabReport}
                    onSetSelectedQCReport={modals.setSelectedQCReport}
                    qc={qc}
                    railCollapsed={railCollapsed}
                    railRef={railRef}
                />
            )}

            {tab === 'quality_issues' && (
                <QualityIssuesView plants={regionalPlants} regionCode={preferences?.selectedRegion?.code || ''} />
            )}
        </div>
    )
}

export default ReportsTabContent
