import { PLAN_META_KEY } from '../app/constants/planConstants'

/* Time zone the planner treats as authoritative for "today" comparisons.
 * Aligned with `usePlanDate`, which also formats Chicago dates so the
 * `YYYY-MM-DD` strings compared with `<` produce sane day-boundary
 * results regardless of the viewer's wall-clock location. */
export const PLAN_EDIT_TIME_ZONE = 'America/Chicago'

/* Race-window in milliseconds: any autosave that wants to write an
 * effectively-empty plan over a previously-meaningful plan within this
 * window of the last load is treated as a race (realtime echo, schedule
 * sync, etc.) and blocked. A legitimate "delete every route" workflow
 * comfortably takes longer than this after page load. */
export const PLAN_AUTOSAVE_RACE_WINDOW_MS = 10000

/** Today's date in the planner's authoritative time zone (Chicago) as
 *  `YYYY-MM-DD`. Used to gate edits — past-day plans are read-only no
 *  matter what permission the user holds. Computed via Intl so the
 *  string lines up with the `planDate` values already produced by
 *  `usePlanDate` (which also formats Chicago dates). */
export function chicagoTodayDate() {
    const fmt = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: PLAN_EDIT_TIME_ZONE,
        year: 'numeric'
    })
    const parts = fmt.formatToParts(new Date()).reduce((acc, p) => {
        acc[p.type] = p.value
        return acc
    }, {})
    return `${parts.year}-${parts.month}-${parts.day}`
}

/** An assignment list is "meaningful" if any entry has a real route
 *  endpoint or order link. The single empty placeholder row used as a
 *  blank-plan default does not count. Centralized so autosave guards,
 *  realtime echo filters, and load diagnostics share the exact same
 *  definition of "this plan has live routes". */
export function hasMeaningfulAssignments(list) {
    return Array.isArray(list) && list.some((a) => a?.fromPlant || a?.toPlant || a?.forOrderId)
}

/**
 * Resolves the `plantProduction` to commit when (re)loading a saved `plans`
 * row, given whether the dispatch schedule sync has ALREADY applied
 * authoritative order rows for the current date.
 *
 * `plantProduction` has two writers: `useScheduleSync` — authoritative; it
 * pulls fresh `dispatch_data` and replaces the per-plant order rows — and the
 * plan load / resync, whose source is the saved row. The saved row's order
 * rows are only a CACHE and can be stale: a job since rescheduled to another
 * day still sits in the blob. When that load lands after a dispatch sync it
 * would otherwise clobber the live orders with those phantoms (symptom:
 * schedule loads correct, then moved orders reappear a few seconds later).
 *
 *   - Dispatch has NOT synced yet (initial render before the first sync, OR a
 *     past date `dispatch_data` no longer covers) → use the full saved blob so
 *     the schedule still renders from the snapshot.
 *   - Dispatch HAS synced → keep the live dispatch orders and apply only the
 *     saved `_meta` (user-authored Saturday counts / special jobs), which the
 *     dispatch sync intentionally never owns.
 */
export function reconcileLoadedProduction(loadedProduction, currentProduction, dispatchAlreadySynced) {
    const loaded = loadedProduction && typeof loadedProduction === 'object' ? loadedProduction : {}
    if (!dispatchAlreadySynced) return loaded
    const current = currentProduction && typeof currentProduction === 'object' ? currentProduction : {}
    const savedMeta = loaded[PLAN_META_KEY]
    if (savedMeta === undefined) {
        const { [PLAN_META_KEY]: _removed, ...ordersOnly } = current
        return ordersOnly
    }
    return { ...current, [PLAN_META_KEY]: savedMeta }
}
