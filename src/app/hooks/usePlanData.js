import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PlanService } from '../../services/PlanService'
import { UserService } from '../../services/UserService'
import {
    chicagoTodayDate,
    hasMeaningfulAssignments,
    PLAN_AUTOSAVE_RACE_WINDOW_MS,
    reconcileLoadedProduction
} from '../../utils/PlanDataUtility'
import { AUTOSAVE_DELAY_MS, createEmptyAssignment, ensureUniqueIds, getOffsetDate } from '../../utils/PlanUtility'
import { PLAN_META_KEY } from '../constants/planConstants'
import { usePreferences } from '../context/PreferencesContext'
import { useDetailOrders } from './useDetailOrders'
import { usePlanPlants } from './usePlanPlants'
import { usePlanRealtimeSync } from './usePlanRealtimeSync'
import { useScheduleSync } from './useScheduleSync'

/** Min gap between wake/reconnect re-syncs so focus + visibilitychange (which
 *  fire together on tab return) coalesce into a single refetch. */
const PLAN_RESYNC_THROTTLE_MS = 1500

/**
 * True when the only difference between `currentSnap` and `prevSnap` is the
 * non-`_meta` portion of `plantProduction` — i.e. the change came from
 * `useScheduleSync` refreshing dispatch data and no user-authored field
 * (assignments, notes, `_meta`) is different.
 *
 * Why this matters: every dispatcher tab independently pulls `dispatch_data`
 * every ~10s. When they save that refresh back to `plans`, the upsert carries
 * the client's LOCAL view of `_meta` — which can be stale relative to a peer's
 * just-committed Saturday-count or missing-operator edit that hasn't been
 * broadcast yet. The receiver then applies that stale `_meta` via the
 * field-level realtime diff and the peer's edit silently reverts. By skipping
 * the autosave when only the machine-synced dispatch data changed, we keep the
 * client's local plantProduction current without racing peers' `_meta` edits.
 */
function snapshotDiffIsMachineOnly(currentSnap, prevSnap) {
    if (!prevSnap) return false
    try {
        const c = JSON.parse(currentSnap)
        const p = JSON.parse(prevSnap)
        if (c.notes !== p.notes) return false
        if (JSON.stringify(c.assignments) !== JSON.stringify(p.assignments)) return false
        const cMeta = c.plantProduction?.[PLAN_META_KEY] ?? null
        const pMeta = p.plantProduction?.[PLAN_META_KEY] ?? null
        return JSON.stringify(cMeta) === JSON.stringify(pMeta)
    } catch {
        return false
    }
}

export function usePlanData(planDate) {
    const { preferences } = usePreferences()
    const selectedRegionCode = preferences?.selectedRegion?.code || null
    const [assignments, setAssignments] = useState([])
    const [notes, setNotes] = useState('')
    const [userId, setUserId] = useState(null)
    const [canEdit, setCanEdit] = useState(true)
    const [plantProduction, setPlantProduction] = useState({})
    /* Synchronous mirror of plantProduction so async callbacks (the plan-load
     * reconciliation) read the live value instead of a stale closure. */
    const plantProductionRef = useRef(plantProduction)
    plantProductionRef.current = plantProduction
    /* True once useScheduleSync has applied authoritative dispatch orders for
     * the current date. While true, a (re)load of the saved plans row must not
     * overwrite those live orders with the row's cached (possibly stale) ones —
     * it applies only the saved _meta. Reset to false on every date change. */
    const dispatchOrdersAppliedRef = useRef(false)
    const [adjacentPlans, setAdjacentPlans] = useState({})
    const [adjacentProduction, setAdjacentProduction] = useState({})
    /** Surfaces a transient plan-load failure to the UI. Stays null on
     *  success (including the "no plan exists for this date" case, which
     *  is a successful empty load) and holds an error message when the
     *  fetch itself failed — auth blip, 5xx, network timeout. */
    const [planLoadError, setPlanLoadError] = useState(null)
    /** Bumping this triggers the plan-load effect to re-run without
     *  forcing a hard page reload. Wired to the error banner's Retry
     *  button so the user can recover from a transient failure without
     *  losing the rest of their planner session. */
    const [planLoadAttempt, setPlanLoadAttempt] = useState(0)
    const retryPlanLoad = useCallback(() => setPlanLoadAttempt((n) => n + 1), [])
    const dirtyRef = useRef(false)
    /** Wall-clock ms timestamp set every time the load effect commits a
     *  fresh plan. The autosave race guard compares against this to
     *  decide whether an empty-over-meaningful save looks like a load
     *  race (suspicious — block) vs a deliberate user-initiated clear
     *  (allow through). */
    const loadedAtMsRef = useRef(0)
    /* Monotonic counter incremented on every local edit. Each scheduled save
     * captures the serial at scheduling time; on completion it only clears
     * dirtyRef if no newer edit has been queued. Without this, an in-flight
     * save can resolve AFTER a fresh edit, clear dirtyRef prematurely, and
     * let its realtime echo overwrite the user's newer state. */
    const editSerialRef = useRef(0)
    /* Stringified snapshot of the most recent payload we either saved or
     * received from realtime. Used for two-way echo suppression:
     *   - When realtime fires, if the incoming payload matches this snapshot
     *     it's our own save echoing back — skip applying it.
     *   - When the autosave effect re-fires after applying a remote update,
     *     the next-save snapshot matches → we skip the redundant write so
     *     the bus doesn't ping-pong on every collaborator's edit.
     * Cleared on date change so a stale snapshot from a different day's plan
     * never gets compared against the next day's payload. */
    const lastSyncedSnapshotRef = useRef('')
    /** UI-facing live status of the autosave pipeline: 'idle' before any
     *  user edit on this date, 'saving' while a write is in flight, 'saved'
     *  after a successful save (or after a remote update lands and the
     *  local state matches the server), and 'error' when the most recent
     *  write threw. Drives the small indicator next to the planner header. */
    const [syncStatus, setSyncStatus] = useState('idle')

    const { isLoading, mixerCountsByPlant, plants, refreshTravelTimes, regionPlants, travelTimes } = usePlanPlants({
        selectedRegionCode,
        userId
    })
    const isLoadingRef = useRef(isLoading)
    isLoadingRef.current = isLoading

    /* Stable reference so consumers that memoize on `getTravelTime` (e.g. the
     * dashboard clock-in board) aren't forced to recompute/re-render on every
     * unrelated OperationsView render such as typing in the Notes field. */
    const getTravelTime = useCallback((from, to) => travelTimes[`${from}->${to}`] ?? null, [travelTimes])

    // One-time bootstrap: user, permissions, travel-time cache. We only fetch
    // travel times once we have a session — otherwise the edge function 401s
    // and the unhandled rejection surfaces as a "runtime error" overlay.
    useEffect(() => {
        const bootstrap = async () => {
            try {
                const user = await UserService.getCurrentUser()
                const uid = user?.id || user
                if (uid) {
                    setUserId(uid)
                    try {
                        const hasEdit = await UserService.hasPermission(uid, 'plan.edit')
                        setCanEdit(hasEdit)
                    } catch {
                        setCanEdit(true)
                    }
                    await refreshTravelTimes()
                }
            } catch (err) {
                console.warn('[usePlanData] bootstrap failed:', err?.message || err)
            }
        }
        bootstrap()
    }, [refreshTravelTimes])

    /* Clear the dispatch-ownership flag whenever the date changes — the new
     * date's orders haven't been synced yet. Deliberately keyed on planDate
     * only (NOT planLoadAttempt) so a mid-session resync keeps honoring the
     * already-synced live orders instead of reloading the saved cache over
     * them. */
    useEffect(() => {
        dispatchOrdersAppliedRef.current = false
    }, [planDate])

    // Load plan for selected date
    const loadedForDateRef = useRef(null)
    const autosaveEnabledRef = useRef(false)
    useEffect(() => {
        if (!planDate || isLoading) return
        loadedForDateRef.current = null
        autosaveEnabledRef.current = false
        /* Reset the sync snapshot on every date change — a stale snapshot
         * from yesterday's plan would compare false against today's payload
         * and immediately re-save the freshly-loaded data back to the bus. */
        lastSyncedSnapshotRef.current = ''
        setSyncStatus('idle')
        let cancelled = false
        const loadPlan = async () => {
            setPlanLoadError(null)
            try {
                const plan = await PlanService.fetchPlan(planDate)
                if (cancelled) return
                const loadedAssignments = plan?.assignments?.length
                    ? ensureUniqueIds(plan.assignments)
                    : [createEmptyAssignment()]
                const loadedNotes = plan?.notes || ''
                const loadedProduction = plan?.plant_production || {}
                /* Diagnostic for the intermittent tomorrow-wipe report — log
                 * what the server returned for the plan we just loaded so
                 * we can correlate "DB has my saved data" claims against
                 * what the load actually received. Remove once the wipe
                 * culprit is identified. */
                console.info('[usePlanData] plan loaded', {
                    assignmentCount: loadedAssignments.length,
                    hasMeaningfulAssignments: hasMeaningfulAssignments(loadedAssignments),
                    planDate,
                    rawAssignmentsLength: plan?.assignments?.length ?? null,
                    rawPlanWasNull: plan === null
                })
                setAssignments(loadedAssignments)
                setNotes(loadedNotes)
                /* Don't let the saved row's cached order rows clobber orders the
                 * dispatch sync has already applied for this date — those are
                 * authoritative (fresh dispatch_data) and the cache can hold a
                 * job since moved to another day. Once dispatch has synced, keep
                 * its live orders and take only the saved _meta; before that (or
                 * for past dates dispatch_data no longer covers) use the full
                 * saved blob. */
                const reconciledProduction = reconcileLoadedProduction(
                    loadedProduction,
                    plantProductionRef.current,
                    dispatchOrdersAppliedRef.current
                )
                setPlantProduction(reconciledProduction)
                /* Seed the snapshot with the exact state we just committed so the
                 * first autosave effect fire (caused by setState above) is a
                 * no-op — otherwise we'd immediately write the same data we just
                 * read, racing every collaborator's open. */
                lastSyncedSnapshotRef.current = JSON.stringify({
                    assignments: loadedAssignments,
                    notes: loadedNotes,
                    plantProduction: reconciledProduction
                })
                loadedForDateRef.current = planDate
                loadedAtMsRef.current = Date.now()
                requestAnimationFrame(() => {
                    if (cancelled) return
                    autosaveEnabledRef.current = true
                })
            } catch (err) {
                if (cancelled) return
                // Critical: DO NOT wipe local state on a transport failure.
                // The server still has the real plan — a transient 401 /
                // 5xx / timeout shouldn't make the planner replace local
                // assignments with the empty placeholder. The previous
                // behaviour primed an empty autosave that overwrote the
                // saved plan as soon as the dispatcher touched anything.
                // We leave assignments / notes / plantProduction alone, hold
                // `loadedForDateRef` at null (which keeps autosave DISARMED),
                // and surface an error the UI can render as a retry banner.
                console.warn('[usePlanData] plan load failed:', err?.message || err)
                setPlanLoadError(err?.message || 'Failed to load plan')
            }
        }
        loadPlan()
        return () => {
            cancelled = true
        }
    }, [planDate, isLoading, planLoadAttempt])

    /* Re-pull the authoritative plan from the server to recover from a
     * realtime gap. A backgrounded tab's socket is suspended by the browser
     * and silently misses every edit made while it was hidden — and realtime
     * never replays missed events. Without this, a returning tab keeps its
     * stale snapshot and the next local edit autosaves it over everyone
     * else's newer work. Re-running the load effect re-fetches, re-seeds the
     * sync snapshot, and re-arms autosave from a clean baseline.
     *
     * Guarded so it can NEVER discard work:
     *   - dirtyRef: a pending unsaved local edit must flush first.
     *   - loadedForDateRef: only resync from a settled, loaded state.
     *   - isLoading: skip while plants / region are still loading. */
    const lastResyncAtMsRef = useRef(0)
    const requestResync = useCallback(() => {
        if (isLoadingRef.current || dirtyRef.current || loadedForDateRef.current == null) return
        const now = Date.now()
        if (now - lastResyncAtMsRef.current < PLAN_RESYNC_THROTTLE_MS) return
        lastResyncAtMsRef.current = now
        retryPlanLoad()
    }, [retryPlanLoad])

    /* Wake / reconnect triggers. visibilitychange is the dominant one (tab
     * backgrounded long enough for the browser to suspend the realtime
     * socket); focus covers desktop app-switching; online covers a dropped-
     * then-restored network. All routed through the guarded requestResync. */
    useEffect(() => {
        if (!planDate) return undefined
        const onVisible = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') requestResync()
        }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', requestResync)
        window.addEventListener('online', requestResync)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', requestResync)
            window.removeEventListener('online', requestResync)
        }
    }, [planDate, requestResync])

    // Fetch adjacent days for timeline view
    const adjacentFetchRef = useRef(0)
    useEffect(() => {
        if (!planDate || isLoading) return
        const fetchId = ++adjacentFetchRef.current
        const loadAdjacentPlans = async () => {
            // Timeline wants ±3 days. Schedule's yardage KPIs need the
            // current Mon–Sat week (which can extend up to +5 when planDate
            // is Monday) plus the previous business day (up to -2 when
            // planDate is Monday and Sunday is closed). Fetch -6..+5 so
            // every weekday view has the dates it needs in cache.
            const offsets = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5]
            const dates = offsets.map((o) => getOffsetDate(planDate, o))
            const results = await Promise.allSettled(dates.map((d) => PlanService.fetchPlan(d)))
            if (adjacentFetchRef.current !== fetchId) return
            const plans = {}
            const production = {}
            dates.forEach((d, i) => {
                const result = results[i]
                if (result.status === 'fulfilled' && result.value) {
                    if (result.value.assignments?.length) plans[d] = result.value.assignments
                    if (result.value.plant_production) production[d] = result.value.plant_production
                }
            })
            setAdjacentPlans(plans)
            setAdjacentProduction(production)
        }
        loadAdjacentPlans()
    }, [planDate, isLoading])

    // Autosave — debounced, snapshot-gated. Every local edit OR remote-applied
    // update re-fires this effect via the state deps, but we only actually
    // write when the stringified snapshot differs from the last one we sync'd
    // (saved OR received). That single check makes the pipeline symmetric:
    // local edits flush to the server, remote updates DON'T turn around and
    // re-save the same bytes back, and saves that fail leave `dirtyRef` in a
    // recoverable state instead of being silently stuck forever.
    useEffect(() => {
        if (!canEdit || !planDate || isLoading) return
        if (loadedForDateRef.current !== planDate || !autosaveEnabledRef.current) return
        const snapshot = JSON.stringify({ assignments, notes, plantProduction })
        if (snapshot === lastSyncedSnapshotRef.current) return
        /* The only diff is the machine-synced dispatch data — stamp the new
         * snapshot and skip the save. Writing every client's local view of
         * dispatch refreshes is what lets a stale `_meta` from one tab clobber
         * another tab's freshly-saved Saturday / missing-operator edit. Every
         * client recomputes dispatch data independently, so there's no
         * correctness loss from not racing peers to persist it; the next
         * user-authored edit on any client (assignments / notes / `_meta`)
         * still flushes the latest dispatch data along with it. */
        if (snapshotDiffIsMachineOnly(snapshot, lastSyncedSnapshotRef.current)) {
            lastSyncedSnapshotRef.current = snapshot
            dirtyRef.current = false
            setSyncStatus('saved')
            return
        }
        /* Diagnostic tripwire for the intermittent "DB row got wiped"
         * report. If we're about to autosave a state where every
         * assignment is empty (no fromPlant / toPlant / forOrderId) AND
         * the last-known-saved state had at least one real route, log
         * a stack trace so the next occurrence in the wild captures
         * exactly which call path triggered the wipe. Doesn't block the
         * save — a legitimate "delete every route" flow would also trip
         * this, and the dispatcher's confirm dialog already protects
         * against accidental clicks there. Remove this block once the
         * culprit is identified. */
        const newSnapshotEffectivelyEmpty = !hasMeaningfulAssignments(assignments)
        let prevSnapshotWasMeaningful = false
        if (lastSyncedSnapshotRef.current) {
            try {
                const prev = JSON.parse(lastSyncedSnapshotRef.current)
                prevSnapshotWasMeaningful = hasMeaningfulAssignments(prev?.assignments)
            } catch {
                prevSnapshotWasMeaningful = false
            }
        }
        if (newSnapshotEffectivelyEmpty && prevSnapshotWasMeaningful) {
            /* Hard guard: when the new state goes from meaningful to
             * effectively-empty WITHIN the race window of the last load,
             * treat it as a race (realtime echo, schedule sync, etc.) and
             * refuse to persist. A legitimate "delete every route" flow
             * takes longer than the window after page load so those still
             * pass through. Block + log so the next reproduction tells us
             * where the stale empty state came from. */
            const elapsedSinceLoad = Date.now() - loadedAtMsRef.current
            if (elapsedSinceLoad < PLAN_AUTOSAVE_RACE_WINDOW_MS) {
                console.error(
                    '[usePlanData] BLOCKED autosave: would write EMPTY plan over previously non-empty state within ' +
                        `${elapsedSinceLoad}ms of load — treating as a race and preserving the saved plan.`,
                    {
                        elapsedSinceLoad,
                        nowAssignments: assignments,
                        planDate,
                        prevSnapshot: lastSyncedSnapshotRef.current,
                        stack: new Error('wipe-block-trace').stack
                    }
                )
                dirtyRef.current = false
                setSyncStatus('saved')
                return
            }
            console.warn(
                '[usePlanData] AUTOSAVE about to write an EMPTY plan over a previously non-empty plan. Stack trace follows.',
                {
                    elapsedSinceLoad,
                    nowAssignments: assignments,
                    planDate,
                    prevSnapshot: lastSyncedSnapshotRef.current,
                    stack: new Error('wipe-trace').stack
                }
            )
        }
        dirtyRef.current = true
        editSerialRef.current += 1
        const savingSerial = editSerialRef.current
        setSyncStatus('saving')
        const timeout = setTimeout(async () => {
            try {
                await PlanService.savePlan(planDate, assignments, notes, plantProduction)
                /* Stamp the snapshot of WHAT WE JUST SAVED so the realtime
                 * echo of our own write doesn't trigger an apply and so the
                 * next autosave run sees "nothing changed" and short-
                 * circuits. */
                lastSyncedSnapshotRef.current = snapshot
                if (editSerialRef.current === savingSerial) {
                    dirtyRef.current = false
                    setSyncStatus('saved')
                }
            } catch (err) {
                console.error('[usePlanData] plan save failed:', err?.message || err)
                /* Always clear `dirtyRef` on failure so a transient blip
                 * doesn't permanently block incoming realtime updates. The
                 * next local edit will set it again and retry the save. */
                dirtyRef.current = false
                setSyncStatus('error')
            }
        }, AUTOSAVE_DELAY_MS)
        return () => clearTimeout(timeout)
    }, [canEdit, planDate, assignments, notes, plantProduction, isLoading])

    // Realtime: sync plan changes from other users
    usePlanRealtimeSync({
        assignments,
        dirtyRef,
        isLoading,
        lastSyncedSnapshotRef,
        notes,
        onResync: requestResync,
        planDate,
        plantProduction,
        setAssignments,
        setNotes,
        setPlantProduction,
        setSyncStatus
    })

    // Pull the daily schedule from the bucket every 5 min, plus realtime when
    // a fresh upload lands. Replaces the old manual "Import Production" upload
    // — dispatcher's workstation auto-uploads today + 7 days of schedule HTML
    // so production data is always current.
    /* Wrap the dispatch sync's setter so we record that authoritative orders
     * have landed for this date. useScheduleSync only calls this once
     * dispatch_data actually has rows (it bails on an empty fetch), so a past
     * date with no dispatch data never flips the flag and keeps rendering from
     * the saved snapshot. */
    const applyDispatchProduction = useCallback((updater) => {
        dispatchOrdersAppliedRef.current = true
        setPlantProduction(updater)
    }, [])
    const {
        fileUpdatedAt: scheduleFileUpdatedAt,
        isSyncing: isSchedulesSyncing,
        lastSyncedAt: scheduleLastSyncedAt,
        refresh: refreshSchedule
    } = useScheduleSync({
        enabled: !isLoading && plants.length > 0,
        planDate,
        plants,
        setPlantProduction: applyDispatchProduction
    })

    // Detail (ticket-level) orders are fetched once at this level so every
    // downstream tab (Schedule, Realtime, Statistics) sees the same map and
    // OperationsView can hold its skeleton until tickets actually land.
    // Passing `plantProduction` lets the service-layer detail allocator
    // backfill DetailDriver-only ticket quantities from the dispatcher's
    // curated schedule yardage — without this, cross-plant tickets whose
    // dispatch_data header row arrived with null `scheduled_yardage`
    // render as "—" in the popup, the Schedule's Loaded column, and every
    // Statistics sub-page that sums ticket quantities.
    const { detailByOrderId, isLoading: isDetailOrdersLoading } = useDetailOrders(planDate, plantProduction)

    /* Effective edit-capability: the user must both hold the
     * `plan.edit` permission AND be viewing a current or future plan.
     * Past-day plans are read-only across every Plan tab — no
     * route edits, no notes edits, no driver-count adjustments —
     * so a manager can reference yesterday's schedule without
     * accidentally rewriting history. Falsy `planDate` (transient
     * load state) stays editable so the initial render doesn't
     * flicker the read-only banner before the date string lands. */
    const isPastPlanDate = useMemo(() => {
        if (!planDate || typeof planDate !== 'string') return false
        return planDate < chicagoTodayDate()
    }, [planDate])
    const canEditEffective = useMemo(() => canEdit && !isPastPlanDate, [canEdit, isPastPlanDate])

    return {
        adjacentPlans,
        adjacentProduction,
        assignments,
        canEdit: canEditEffective,
        detailByOrderId,
        dirtyRef,
        getTravelTime,
        isDetailOrdersLoading,
        isLoading,
        isPastPlanDate,
        isSchedulesSyncing,
        mixerCountsByPlant,
        notes,
        planLoadError,
        plantProduction,
        plants,
        refreshSchedule,
        refreshTravelTimes,
        regionPlants,
        retryPlanLoad,
        scheduleFileUpdatedAt,
        scheduleLastSyncedAt,
        setAssignments,
        setNotes,
        setPlantProduction,
        syncStatus,
        travelTimes,
        userId
    }
}
