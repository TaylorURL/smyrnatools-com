import { useCallback, useEffect, useRef, useState } from 'react'

import { PlanService } from '../../services/PlanService'
import { PlantService } from '../../services/PlantService'
import { ReportService } from '../../services/ReportService'
import { UserService } from '../../services/UserService'
import { AUTOSAVE_DELAY_MS, createEmptyAssignment, ensureUniqueIds, getOffsetDate } from '../../utils/PlanUtility'
import { usePreferences } from '../context/PreferencesContext'
import { useDetailOrders } from './useDetailOrders'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { useScheduleSync } from './useScheduleSync'

export function usePlanData(planDate) {
    const { preferences } = usePreferences()
    const selectedRegionCode = preferences?.selectedRegion?.code || null
    const [plants, setPlants] = useState([])
    const [regionPlants, setRegionPlants] = useState([])
    const [mixerCountsByPlant, setMixerCountsByPlant] = useState({})
    const [assignments, setAssignments] = useState([])
    const [notes, setNotes] = useState('')
    const [travelTimes, setTravelTimes] = useState({})
    const [userId, setUserId] = useState(null)
    const [canEdit, setCanEdit] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
    const [plantProduction, setPlantProduction] = useState({})
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

    const getTravelTime = (from, to) => travelTimes[`${from}->${to}`] ?? null

    /** Best-effort travel-time refresh. Swallows errors (e.g. Unauthorized
     *  when the session hasn't established yet, or transient network blips)
     *  so the planner doesn't surface a runtime error for non-critical data. */
    const refreshTravelTimes = async () => {
        try {
            await PlanService.fetchTravelTimes()
            setTravelTimes(PlanService.getTravelTimesMap())
        } catch (err) {
            console.warn('[usePlanData] travel-times refresh failed:', err?.message || err)
        }
    }

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
    }, [])

    // Plants + mixer counts — re-runs whenever the user's selected region
    // changes so the plan scopes to the region the user is currently viewing,
    // not their permanently-assigned one.
    useEffect(() => {
        let cancelled = false
        const loadPlants = async () => {
            let plantList = []
            let regionPlantRecords = []
            if (selectedRegionCode) {
                try {
                    const [all, fetchedRegionPlants] = await Promise.all([
                        ReportService.fetchPlantsSorted(),
                        PlantService.fetchRegionPlants(selectedRegionCode)
                    ])
                    regionPlantRecords = fetchedRegionPlants || []
                    const allowedCodes = new Set(
                        regionPlantRecords
                            .map((rp) => String(rp.plantCode || rp.plant_code || '').trim())
                            .filter(Boolean)
                    )
                    plantList = (all || []).filter((p) => allowedCodes.has(String(p.plant_code || '').trim()))
                } catch {
                    plantList = []
                    regionPlantRecords = []
                }
            } else if (userId) {
                plantList = await ReportService.fetchPlantsForUser(userId)
                if (!plantList.length) plantList = await ReportService.fetchPlantsSorted()
            } else {
                plantList = await ReportService.fetchPlantsSorted()
            }
            if (!cancelled) setRegionPlants(regionPlantRecords)
            if (cancelled) return
            const sorted = (plantList || [])
                .filter((p) => p.plant_code)
                .sort((a, b) => String(a.plant_code).localeCompare(String(b.plant_code)))
            setPlants(sorted)
            if (sorted.length) {
                const counts = await ReportService.fetchActiveMixerCountsByPlant(
                    sorted.map((p) => p.plant_code).filter(Boolean)
                )
                if (!cancelled) setMixerCountsByPlant(counts)
            } else {
                setMixerCountsByPlant({})
            }
            if (!cancelled) setIsLoading(false)
        }
        loadPlants()
        return () => {
            cancelled = true
        }
    }, [userId, selectedRegionCode])

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
                setAssignments(loadedAssignments)
                setNotes(loadedNotes)
                setPlantProduction(loadedProduction)
                /* Seed the snapshot with the server's current state so the
                 * first autosave effect fire (caused by setState above) is
                 * a no-op — otherwise we'd immediately write the same data
                 * we just read, racing every collaborator's open. */
                lastSyncedSnapshotRef.current = JSON.stringify({
                    assignments: loadedAssignments,
                    notes: loadedNotes,
                    plantProduction: loadedProduction
                })
                loadedForDateRef.current = planDate
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
    const planDateRef = useRef(planDate)
    planDateRef.current = planDate
    const assignmentsRef = useRef(assignments)
    assignmentsRef.current = assignments
    const notesRef = useRef(notes)
    notesRef.current = notes
    const plantProductionRef = useRef(plantProduction)
    plantProductionRef.current = plantProduction

    useRealtimeSubscription({
        enabled: !isLoading,
        onChange: useCallback((payload) => {
            const record = payload.new
            if (!record || record.plan_date !== planDateRef.current) return
            const incomingAssignments = record.assignments?.length
                ? ensureUniqueIds(record.assignments)
                : [createEmptyAssignment()]
            const incomingNotes = record.notes || ''
            const incomingProduction = record.plant_production || {}
            const incomingSnapshot = JSON.stringify({
                assignments: incomingAssignments,
                notes: incomingNotes,
                plantProduction: incomingProduction
            })
            /* Skip our own save echo. The autosave loop stores its
             * just-written snapshot in `lastSyncedSnapshotRef`; a realtime
             * payload that matches it is the bus reflecting our own write
             * back at us — applying it would just bounce state for no
             * reason. */
            if (incomingSnapshot === lastSyncedSnapshotRef.current) return
            /* Stamp the snapshot BEFORE applying so the autosave effect
             * that fires from the setState calls below short-circuits
             * instead of immediately re-saving what we just received. */
            lastSyncedSnapshotRef.current = incomingSnapshot
            if (JSON.stringify(incomingAssignments) !== JSON.stringify(assignmentsRef.current)) {
                setAssignments(incomingAssignments)
            }
            if (incomingNotes !== notesRef.current) {
                setNotes(incomingNotes)
            }
            if (JSON.stringify(incomingProduction) !== JSON.stringify(plantProductionRef.current)) {
                setPlantProduction(incomingProduction)
            }
            setSyncStatus('saved')
        }, []),
        table: 'plans'
    })

    // Realtime: refresh mixer counts
    const plantCodesRef = useRef([])
    plantCodesRef.current = plants.map((p) => p.plant_code).filter(Boolean)

    useRealtimeSubscription({
        enabled: !isLoading && plants.length > 0,
        onChange: useCallback(async () => {
            if (!plantCodesRef.current.length) return
            const counts = await ReportService.fetchActiveMixerCountsByPlant(plantCodesRef.current)
            setMixerCountsByPlant(counts)
        }, []),
        table: 'mixers'
    })

    // Realtime: refresh travel times
    useRealtimeSubscription({
        enabled: !isLoading,
        onChange: useCallback(async () => {
            try {
                await PlanService.fetchTravelTimes()
                setTravelTimes(PlanService.getTravelTimesMap())
            } catch (err) {
                console.warn('[usePlanData] realtime travel-times refresh failed:', err?.message || err)
            }
        }, []),
        table: 'plant_travel_times'
    })

    // Pull the daily schedule from the bucket every 5 min, plus realtime when
    // a fresh upload lands. Replaces the old manual "Import Production" upload
    // — dispatcher's workstation auto-uploads today + 7 days of schedule HTML
    // so production data is always current.
    const {
        fileUpdatedAt: scheduleFileUpdatedAt,
        isSyncing: isSchedulesSyncing,
        lastSyncedAt: scheduleLastSyncedAt,
        refresh: refreshSchedule
    } = useScheduleSync({
        enabled: !isLoading && plants.length > 0,
        planDate,
        plants,
        setPlantProduction
    })

    // Detail (ticket-level) orders are fetched once at this level so every
    // downstream tab (Schedule, Realtime, Statistics) sees the same map and
    // PlanView can hold its skeleton until tickets actually land.
    const { detailByOrderId, isLoading: isDetailOrdersLoading } = useDetailOrders(planDate)

    return {
        adjacentPlans,
        adjacentProduction,
        assignments,
        canEdit,
        detailByOrderId,
        dirtyRef,
        getTravelTime,
        isDetailOrdersLoading,
        isLoading,
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
