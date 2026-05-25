import React from 'react'

import ReportsHomeOfficeGate from '../../../../app/components/reports/ReportsHomeOfficeGate'
import { ReportsViewSkeleton } from '../../../../app/components/reports/ReportsViewSkeletons'
import { reportTypeMap } from '../../../../app/types/ReportTypes'
import ReportsReviewView from '../ReportsReviewView'
import ReportsSubmitView from '../ReportsSubmitView'

/**
 * Blurred-skeleton background + Home Office gate shown when a user with the
 * `office` region type lands on Reports. Reports are scoped to operating
 * regions, so we short-circuit any deep-link / stale-state path that would
 * otherwise drop the user straight into a submit or review form.
 */
export function ReportsHomeOfficeBranch({ userId }) {
    return (
        <div className="bg-slate-50 min-h-screen w-full pb-16 relative">
            <div className="pointer-events-none select-none blur-sm" aria-hidden>
                <ReportsViewSkeleton variant="grid" />
            </div>
            <ReportsHomeOfficeGate userId={userId} />
        </div>
    )
}

/**
 * Submit-form drill-down. Wraps `ReportsSubmitView` in the standard page
 * shell. When `showReview` is null but `reviewData` is set, the form is
 * rendered read-only (preview of a previously submitted report).
 */
export function ReportsSubmitBranch({
    handlers,
    managerEditUser,
    reviewData,
    showForm,
    showReview,
    submitInitialData,
    user,
    userProfiles
}) {
    const report = reportTypeMap[showForm.name]
        ? { ...reportTypeMap[showForm.name], weekIso: showForm.weekIso }
        : showForm
    return (
        <div className="bg-slate-50 min-h-screen w-full pb-16">
            <ReportsSubmitView
                report={report}
                initialData={submitInitialData}
                onBack={handlers.handleBack}
                onSubmit={handlers.handleFormSubmit}
                user={user}
                readOnly={showReview === null && reviewData !== null}
                managerEditUser={managerEditUser}
                userProfiles={userProfiles}
            />
        </div>
    )
}

/**
 * Review-form drill-down. Surfaces the manager-edit affordance via
 * `handlers.handleManagerEdit` and pre-resolves the completing user's
 * profile from the cached `userProfiles` map.
 */
export function ReportsReviewBranch({ handlers, reviewData, showReview, user, userProfiles }) {
    return (
        <div className="bg-slate-50 min-h-screen w-full pb-16">
            <ReportsReviewView
                report={reportTypeMap[showReview.name] || showReview}
                initialData={reviewData}
                onBack={handlers.handleReviewBack}
                user={user}
                completedByUser={reviewData?.userId ? userProfiles[reviewData.userId] : undefined}
                onManagerEdit={handlers.handleManagerEdit}
            />
        </div>
    )
}
