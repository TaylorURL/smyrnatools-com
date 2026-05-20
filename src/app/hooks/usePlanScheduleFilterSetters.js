import { useCallback, useMemo } from 'react'

/**
 * Derives individual setter callbacks from the parent's single
 * `onChangeFilter(key, value)` so PlanScheduleView can hand off
 * setter-per-key style props (the rest of the view doesn't need to know
 * the state lives upstream in OperationsView).
 *
 * Filter / view / sort state is controlled by the parent so it survives
 * the loading-skeleton swap on every date change.
 */
export function usePlanScheduleFilterSetters(onChangeFilter) {
    const setFilterValue = useCallback(
        (key) => (value) => {
            if (typeof onChangeFilter === 'function') onChangeFilter(key, value)
        },
        [onChangeFilter]
    )
    const setQuery = useMemo(() => setFilterValue('query'), [setFilterValue])
    const setPlantFilters = useMemo(() => setFilterValue('plantFilters'), [setFilterValue])
    const setStatusFilter = useMemo(() => setFilterValue('statusFilter'), [setFilterValue])
    const setProductFilter = useMemo(() => setFilterValue('productFilter'), [setFilterValue])
    const setMinYards = useMemo(() => setFilterValue('minYards'), [setFilterValue])
    const setSortKey = useMemo(() => setFilterValue('sortKey'), [setFilterValue])
    /** When the schedule is filtered to a single plant we interleave synthetic
     *  rows (truck returns, help events, send-home recommendations, open-slot
     *  suggestions, trade-offs). Those rows only make sense chronologically,
     *  so turning them ON forces a time-based sort; turning them OFF lets the
     *  Sort by picker actually reorder the table. Default off so the sort
     *  controls work immediately — dispatchers opt-in to the extras. */
    const setShowExtraRows = useMemo(() => setFilterValue('showExtraRows'), [setFilterValue])
    const setShowCancelled = useMemo(() => setFilterValue('showCancelled'), [setFilterValue])
    const setShowTest = useMemo(() => setFilterValue('showTest'), [setFilterValue])
    // Mobile is always cards (the 12-column table needs hundreds of px to read).
    const setViewMode = useMemo(() => setFilterValue('viewMode'), [setFilterValue])
    // Filter drawer is collapsed by default on mobile so the schedule fills the screen.
    const setFiltersOpen = useMemo(() => setFilterValue('filtersOpen'), [setFilterValue])

    return {
        setFiltersOpen,
        setMinYards,
        setPlantFilters,
        setProductFilter,
        setQuery,
        setShowCancelled,
        setShowExtraRows,
        setShowTest,
        setSortKey,
        setStatusFilter,
        setViewMode
    }
}
