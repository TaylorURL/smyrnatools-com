import React from 'react'

import {
    RV_RAIL_FIXED,
    RV_SPLIT_LEFT,
    RV_SPLIT_PARENT,
    RV_SPLIT_RAIL_SLOT
} from '../../../../constants/reportsViewConstants'
import MyOneOffRail from '../../MyOneOffRail'
import { MobileFilterShell, QcFilterBar } from '../../ReportsToolbar'
import QualityReportsList from './QualityReportsList'

/** Body for the "Quality Reports" tab — submit buttons, filter bar, the QC
 *  reports list, and the personal one-off submission rail. */
export default function QualityTabPanel({
    accent,
    filters,
    getUserName,
    handlers,
    hasQCStrengthPermission,
    onOpenLabReportModal,
    onOpenQcStrengthModal,
    onOpenQualityIssueModal,
    onSetSelectedLabReport,
    onSetSelectedQCReport,
    qc,
    railCollapsed,
    railRef
}) {
    return (
        <div className={RV_SPLIT_PARENT} data-collapsed={railCollapsed}>
            <div className={RV_SPLIT_LEFT}>
                {hasQCStrengthPermission && (
                    <div className="flex flex-wrap gap-2">
                        <button type="button"
                            onClick={onOpenQcStrengthModal}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-white text-[10.5px] font-semibold uppercase tracking-wider"
                            style={{ background: accent }}
                        >
                            <i className="fas fa-flask text-[10px]" /> Submit QC Strength
                        </button>
                        <button type="button"
                            onClick={onOpenLabReportModal}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-white text-[10.5px] font-semibold uppercase tracking-wider bg-[#e11d48]"
                        >
                            <i className="fas fa-vial text-[10px]" /> Submit Lab Report
                        </button>
                        <button type="button"
                            onClick={onOpenQualityIssueModal}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-white text-[10.5px] font-semibold uppercase tracking-wider bg-red-600"
                            title="Log a new quality dispute / follow-up. Tracked in the Quality Issues tab."
                        >
                            <i className="fas fa-clipboard-list text-[10px]" /> New Quality Issue
                        </button>
                    </div>
                )}
                <MobileFilterShell
                    label="Filters"
                    activeCount={
                        (filters.qcTypeFilter !== 'all' ? 1 : 0) +
                        (filters.qcStatusFilter !== 'all' ? 1 : 0) +
                        (filters.qcDateFrom ? 1 : 0) +
                        (filters.qcDateTo ? 1 : 0)
                    }
                >
                    <div className="bg-bg-primary border border-border-light rounded-lg px-3 py-2.5">
                        <QcFilterBar
                            qcTypeFilter={filters.qcTypeFilter}
                            onQcTypeFilterChange={filters.setQcTypeFilter}
                            qcStatusFilter={filters.qcStatusFilter}
                            onQcStatusFilterChange={filters.setQcStatusFilter}
                            qcSort={filters.qcSort}
                            onQcSortChange={filters.setQcSort}
                            qcDateFrom={filters.qcDateFrom}
                            onQcDateFromChange={filters.setQcDateFrom}
                            qcDateTo={filters.qcDateTo}
                            onQcDateToChange={filters.setQcDateTo}
                            qcHasActiveFilters={filters.qcHasActiveFilters}
                            onClearQcFilters={filters.clearQcFilters}
                        />
                    </div>
                </MobileFilterShell>
                <QualityReportsList
                    accent={accent}
                    allReports={qc.qcReports}
                    getUserName={getUserName}
                    hasActiveFilters={filters.qcHasActiveFilters}
                    isLoading={qc.isLoadingQC}
                    onDelete={qc.handleDeleteQCReport}
                    onOpenLab={onSetSelectedLabReport}
                    onOpenQc={onSetSelectedQCReport}
                    visibleReports={filters.visibleQcReports}
                />
            </div>
            <div ref={railRef} className={RV_SPLIT_RAIL_SLOT}>
                <div className={RV_RAIL_FIXED}>
                    <MyOneOffRail
                        reports={filters.myQualityReports}
                        title="Your Quality Reports"
                        emptyLabel="You haven't submitted a quality report yet"
                        onEdit={handlers.handleEditMyOneOff}
                    />
                </div>
            </div>
        </div>
    )
}
