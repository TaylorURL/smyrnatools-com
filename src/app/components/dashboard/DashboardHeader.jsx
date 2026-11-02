import React from 'react'

import { formatCentralDate } from '../../../utils/PlanUtility'

/**
 * Dashboard page header: the title, a line naming the region and today's
 * date, and the plant filter and refresh. It sits on the page background with
 * the same inset as the content under it, so the title lines up with the
 * first column of numbers.
 */
export default function DashboardHeader({
    accentColor: _accentColor,
    heroRegionSub,
    isLoading = false,
    isMobile,
    onPlantFilterClick,
    onRefresh,
    refreshing,
    regionDisplayName
}) {
    const dateLabel = formatCentralDate(new Date(), { day: 'numeric', month: 'long', weekday: 'long' })
    return (
        <header className="shrink-0 bg-bg-secondary">
            <div className="flex w-full flex-wrap items-end gap-x-4 gap-y-3 px-4 pb-5 pt-6 sm:px-6 lg:px-8">
                <div className="min-w-0 flex-1">
                    <h1 className="m-0 font-heading text-[28px] font-semibold leading-none tracking-tight text-text-primary">
                        Dashboard
                    </h1>
                    {isLoading ? (
                        <div className="mt-2.5 h-4 w-64 rounded-sm bg-bg-tertiary animate-pulse motion-reduce:animate-none" />
                    ) : (
                        <p className="m-0 mt-2 truncate text-[13px] text-text-secondary">
                            <span className="font-medium text-text-primary">{regionDisplayName || 'Region'}</span>
                            {heroRegionSub && <span> · {heroRegionSub}</span>}
                            <span className="hidden sm:inline"> · {dateLabel}</span>
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onPlantFilterClick && (
                        <button
                            type="button"
                            onClick={onPlantFilterClick}
                            className="btn-secondary"
                            aria-label="Filter dashboard by plant"
                        >
                            <i className="fas fa-sliders text-[11px]" aria-hidden="true" />
                            {!isMobile && <span>Plants</span>}
                        </button>
                    )}
                    {onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={refreshing}
                            className="btn-secondary w-9 justify-center px-0"
                            title="Refresh"
                            aria-label="Refresh dashboard data"
                        >
                            <i
                                className={`fas fa-arrows-rotate text-[12px] ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
                                aria-hidden="true"
                            />
                        </button>
                    )}
                </div>
            </div>
        </header>
    )
}
