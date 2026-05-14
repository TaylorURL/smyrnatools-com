import React from 'react'

import {
    RV_RAIL_FIXED,
    RV_SPLIT_LEFT,
    RV_SPLIT_PARENT,
    RV_SPLIT_RAIL_SLOT
} from '../../../../constants/reportsViewConstants'
import { exportLostLoadReports } from '../../../modules/export/reports/LostLoadExport'
import MyOneOffRail from '../../MyOneOffRail'
import { LossFilterBar, MobileFilterShell } from '../../ReportsToolbar'
import LostLoadsList from './LostLoadsList'

/** Body for the "Loss Reports" tab — submit button, filter bar, paginated list
 *  of lost loads, and the personal one-off submission rail. */
export default function LostLoadsTabPanel({
    accent,
    deleteLostLoadReport,
    filters,
    getUserName,
    handlers,
    hasLostLoadsDeletePermission,
    hasLostLoadsPermission,
    isLoadingLostLoads,
    lostLoadsPagination,
    onOpenLostLoadModal,
    onSetSelectedLostLoad,
    railCollapsed,
    railRef,
    regionalPlants
}) {
    return (
        <div className={RV_SPLIT_PARENT} data-collapsed={railCollapsed}>
            <div className={RV_SPLIT_LEFT}>
                {hasLostLoadsPermission && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onOpenLostLoadModal}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-white text-[10.5px] font-semibold uppercase tracking-wider"
                            style={{ background: accent }}
                        >
                            <i className="fas fa-truck text-[10px]" /> Submit Lost Load
                        </button>
                    </div>
                )}
                <MobileFilterShell
                    label="Filters"
                    activeCount={
                        (filters.lossDumpLocation !== 'all' ? 1 : 0) +
                        (filters.lossReason !== 'all' ? 1 : 0) +
                        (filters.lossDateFrom ? 1 : 0) +
                        (filters.lossDateTo ? 1 : 0)
                    }
                >
                    <div className="bg-bg-primary border border-border-light rounded-lg px-3 py-2.5">
                        <LossFilterBar
                            dumpLocationFilter={filters.lossDumpLocation}
                            onDumpLocationFilterChange={filters.setLossDumpLocation}
                            reasonFilter={filters.lossReason}
                            onReasonFilterChange={filters.setLossReason}
                            sort={filters.lossSort}
                            onSortChange={filters.setLossSort}
                            dateFrom={filters.lossDateFrom}
                            onDateFromChange={filters.setLossDateFrom}
                            dateTo={filters.lossDateTo}
                            onDateToChange={filters.setLossDateTo}
                            hasActiveFilters={filters.lossHasActiveFilters}
                            onClear={filters.clearLossFilters}
                            onExport={
                                filters.visibleLostLoads.length > 0
                                    ? () =>
                                          exportLostLoadReports({
                                              getUserName,
                                              plants: regionalPlants,
                                              reports: filters.visibleLostLoads
                                          })
                                    : undefined
                            }
                        />
                    </div>
                </MobileFilterShell>
                <LostLoadsList
                    isLoading={isLoadingLostLoads}
                    items={lostLoadsPagination.paginatedItems}
                    pageSize={lostLoadsPagination.pageSize}
                    currentPage={lostLoadsPagination.currentPage}
                    totalPages={lostLoadsPagination.totalPages}
                    onPageSizeChange={lostLoadsPagination.changePageSize}
                    onPageChange={lostLoadsPagination.goToPage}
                    getUserName={getUserName}
                    canDelete={hasLostLoadsDeletePermission}
                    onDelete={deleteLostLoadReport}
                    onRowClick={onSetSelectedLostLoad}
                />
            </div>
            <div ref={railRef} className={RV_SPLIT_RAIL_SLOT}>
                <div className={RV_RAIL_FIXED}>
                    <MyOneOffRail
                        reports={filters.myLostLoadReports}
                        title="Your Lost Loads"
                        emptyLabel="You haven't submitted a lost load yet"
                        onEdit={handlers.handleEditMyOneOff}
                    />
                </div>
            </div>
        </div>
    )
}
