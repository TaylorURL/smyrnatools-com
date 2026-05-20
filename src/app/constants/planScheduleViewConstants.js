/* Plan Schedule View constants — UI-level defaults that don't belong in the
 * pure helper module at src/utils/PlanScheduleUtility.ts. */

/** Default-shape sentinel — used only when PlanScheduleView renders
 *  standalone (e.g. in tests or a future preview surface). The real
 *  OperationsView always supplies `filters` + `onChangeFilter` so the
 *  schedule-tab filters survive the loading-skeleton swap on every
 *  date change. */
export const DEFAULT_SCHEDULE_FILTERS = {
    filtersOpen: true,
    minYards: '',
    /** Multi-select array of plant codes — empty means "all plants".
     *  Lets the dispatcher pick whole districts / arbitrary permutations
     *  via PlantDropdownModal. */
    plantFilters: [],
    productFilter: 'all',
    query: '',
    /** Cancelled (17:00 sentinel) and test (18:00 sentinel) orders are noise
     *  by default — they're real rows in the dispatch report but they
     *  don't represent production. Hidden until the dispatcher explicitly
     *  flips these toggles to inspect them. */
    showCancelled: false,
    showExtraRows: false,
    showTest: false,
    sortKey: 'plantThenTime',
    statusFilter: 'all',
    viewMode: 'table'
}
