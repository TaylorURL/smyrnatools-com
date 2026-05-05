import React from 'react'

/**
 * Slim sticky dashboard header — mirrors `PlanHeader`'s flat aesthetic so
 * both surfaces feel like part of the same product. One-line title, an
 * inline region/scope pill, and a row of action buttons (refresh / plant
 * filter). Skeleton state matches the live layout's height to avoid CLS.
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
    return (
        <div
            className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
        >
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0" style={{ color: 'var(--text-primary)' }}>
                Dashboard
            </h1>
            {isLoading ? (
                <div className="h-6 w-56 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
            ) : (
                <span
                    className="inline-flex items-center gap-2 rounded text-[12px] font-medium px-2.5 py-1 max-w-full"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <i className="fas fa-location-dot text-[10px]" style={{ color: '#16a34a' }} />
                    <span className="truncate">{regionDisplayName || 'Region'}</span>
                    {heroRegionSub && (
                        <span className="hidden sm:inline truncate" style={{ color: 'var(--text-tertiary)' }}>
                            · {heroRegionSub}
                        </span>
                    )}
                </span>
            )}
            <div className="flex-1 min-w-[8px]" />
            <div className="flex items-center gap-1.5">
                {onPlantFilterClick && (
                    <button
                        type="button"
                        onClick={onPlantFilterClick}
                        className="inline-flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 h-[30px] cursor-pointer"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <i className="fas fa-filter text-[11px]" />
                        {!isMobile && <span>Filter</span>}
                    </button>
                )}
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center justify-center w-[30px] h-[30px] rounded cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                        title="Refresh"
                    >
                        <i className={`fas fa-arrows-rotate text-[11px] ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>
        </div>
    )
}
