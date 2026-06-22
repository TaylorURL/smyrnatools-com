/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { VIEW_MODES } from '../../../../../utils/PlanScheduleUtility'
import Badge from '../../../common/Badge'

/**
 * Title strip above the schedule — title, summary text, and the row of
 * affordances (view-mode toggle, mobile Filters button, Maximize, Planner
 * jump). Hidden entirely in maximized mode; the compact toolbar carries
 * the view toggle and Exit button instead.
 */
export default function PlanScheduleTitleRow({
    accentColor,
    activeFilterCount,
    allOrdersCount,
    compareMode = false,
    filteredCount,
    filtersOpen,
    hasAnyOrders,
    isMobile,
    onSwitchToPlanner,
    onToggleCompare,
    onToggleFilters,
    onToggleMaximized,
    setViewMode,
    viewMode
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
                <div className="text-[18px] sm:text-[22px] font-bold leading-tight text-text-primary font-heading">
                    Schedule
                </div>
                <div className="text-[11.5px] sm:text-[12px] text-text-secondary">
                    {isMobile
                        ? `${filteredCount} of ${allOrdersCount} orders`
                        : "Pulled from the Daily Order Listing import. Filter, sort, and scan every plant's orders on one page."}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {!isMobile && (
                    <div className="flex items-center rounded-lg p-0.5 bg-bg-secondary border border-border-light">
                        {VIEW_MODES.map((m) => (
                            <button type="button"
                                key={m}
                                type="button"
                                onClick={() => setViewMode(m)}
                                className="px-3 py-1.5 rounded-md text-[11.5px] font-semibold border-none cursor-pointer flex items-center gap-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                style={{
                                    background: viewMode === m ? accentColor : 'transparent',
                                    color: viewMode === m ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                <i className={`fas ${m === 'table' ? 'fa-table' : 'fa-grip'} text-[10px]`} />
                                {m === 'table' ? 'Table' : 'Cards'}
                            </button>
                        ))}
                    </div>
                )}
                {isMobile && hasAnyOrders && (
                    <button type="button"
                        onClick={onToggleFilters}
                        aria-expanded={filtersOpen}
                        aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
                        className="min-h-[44px] px-3.5 rounded-lg text-[13px] font-semibold border-none cursor-pointer flex items-center gap-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={{
                            background: filtersOpen || activeFilterCount > 0 ? accentColor : 'var(--bg-secondary)',
                            color: filtersOpen || activeFilterCount > 0 ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        <i className={`fas fa-filter text-[11px]`} />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge
                                bg="rgba(255,255,255,0.3)"
                                className="min-w-[18px] justify-center"
                                fg="inherit"
                                shape="pill"
                                size="xs"
                                variant="custom"
                            >
                                {activeFilterCount}
                            </Badge>
                        )}
                    </button>
                )}
                {!isMobile && hasAnyOrders && onToggleCompare && (
                    <button type="button"
                        onClick={onToggleCompare}
                        className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={{
                            background: compareMode ? accentColor : 'var(--bg-secondary)',
                            color: compareMode ? '#fff' : 'var(--text-secondary)'
                        }}
                        title={
                            compareMode
                                ? 'Exit the side-by-side comparison and return to the standard schedule view'
                                : 'Split the schedule into two columns — the original 5:30 PM snapshot vs. live'
                        }
                    >
                        <i className={`fas ${compareMode ? 'fa-table-columns' : 'fa-clock-rotate-left'} text-[10px]`} />
                        {compareMode ? 'Exit comparison' : 'View original schedule'}
                    </button>
                )}
                {!isMobile && hasAnyOrders && (
                    <button type="button"
                        onClick={onToggleMaximized}
                        className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5 bg-bg-secondary border border-border-light text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        title="Maximize the schedule — hide the KPI strip and side rail so the table fills the screen"
                    >
                        <i className="fas fa-expand text-[10px]" />
                        Maximize
                    </button>
                )}
                {onSwitchToPlanner && (
                    <button type="button"
                        onClick={onSwitchToPlanner}
                        className="min-h-[44px] md:min-h-0 md:py-2 px-3.5 rounded-lg text-[13px] md:text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5 text-white active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={{ background: accentColor }}
                    >
                        <i className="fas fa-project-diagram text-[11px] md:text-[10px]" /> Planner
                    </button>
                )}
            </div>
        </div>
    )
}
