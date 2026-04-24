import React from 'react'

/**
 * Sticky dashboard top bar. Displays the region/plant identity with a clean
 * gradient accent band. Plant filter is surfaced on mobile; refresh controls
 * live in the sidebar.
 */
export default function DashboardHeader({
    accentColor,
    isMobile,
    regionDisplayName,
    heroRegionSub,
    isLoading = false,
    onPlantFilterClick
}) {
    return (
        <div
            className={`relative sticky top-0 z-10 bg-bg-primary/90 backdrop-blur-md border-b border-border-light ${isMobile ? 'px-3 py-3' : 'px-6 py-4'}`}
            style={{
                backgroundImage: `
                    radial-gradient(ellipse 80% 60% at 0% 0%, ${accentColor}0f 0%, transparent 60%),
                    radial-gradient(ellipse 50% 70% at 100% 0%, ${accentColor}0a 0%, transparent 60%)
                `
            }}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
                style={{
                    background: `linear-gradient(90deg, transparent 0%, ${accentColor}55 50%, transparent 100%)`
                }}
            />
            {isLoading ? (
                <div className="flex flex-wrap items-center gap-3">
                    <div className={`${isMobile ? 'h-7 w-32' : 'h-8 w-40'} rounded-lg bg-bg-tertiary animate-pulse`} />
                    <div className="h-4 w-56 rounded bg-bg-tertiary animate-pulse" />
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <span
                            aria-hidden
                            className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 ring-1 ring-inset"
                            style={{
                                background: `${accentColor}14`,
                                color: accentColor,
                                boxShadow: `inset 0 0 0 1px ${accentColor}26`
                            }}
                        >
                            <i className="fas fa-chart-column text-sm" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <h1
                                    className={`font-bold text-text-primary m-0 leading-none ${isMobile ? 'text-lg' : 'text-[22px]'}`}
                                >
                                    {regionDisplayName || 'Dashboard'}
                                </h1>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary bg-bg-tertiary border border-border-light rounded-full px-2 py-0.5">
                                    Dashboard
                                </span>
                            </div>
                            {heroRegionSub && (
                                <p className="text-xs md:text-sm text-text-secondary m-0 mt-1 truncate">
                                    {heroRegionSub}
                                </p>
                            )}
                        </div>
                    </div>
                    {isMobile && onPlantFilterClick && (
                        <button
                            className="flex items-center justify-center w-10 h-10 rounded-xl border border-border-light bg-bg-primary text-text-primary text-sm cursor-pointer flex-shrink-0 hover:bg-bg-tertiary transition-colors"
                            onClick={onPlantFilterClick}
                            type="button"
                            aria-label="Filter by plant"
                        >
                            <i className="fas fa-filter" />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
