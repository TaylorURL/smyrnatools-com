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
    const dirtyRef = useRef(false)

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
        const loadPlan = async () => {
            try {
                const plan = await PlanService.fetchPlan(planDate)
                if (plan?.assignments?.length) {
                    setAssignments(ensureUniqueIds(plan.assignments))
                } else {
                    setAssignments([createEmptyAssignment()])
                }
                setNotes(plan?.notes || '')
                setPlantProduction(plan?.plant_production || {})
            } catch {
                setAssignments([createEmptyAssignment()])
                setNotes('')
                setPlantProduction({})
            }
            loadedForDateRef.current = planDate
            requestAnimationFrame(() => {
                autosaveEnabledRef.current = true
            })
        }
        loadPlan()
    }, [planDate, isLoading])

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

    // Autosave
    useEffect(() => {
        if (!canEdit || !planDate || isLoading) return
        if (loadedForDateRef.current !== planDate || !autosaveEnabledRef.current) return
        dirtyRef.current = true
        const timeout = setTimeout(async () => {
            try {
                await PlanService.savePlan(planDate, assignments, notes, plantProduction)
                dirtyRef.current = false
            } catch {}
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
        table: 'plans',
        enabled: !isLoading,
        onChange: useCallback((payload) => {
            if (dirtyRef.current) return
            const record = payload.new
            if (!record || record.plan_date !== planDateRef.current) return
            const incoming = JSON.stringify(record.assignments ?? [])
            const local = JSON.stringify(assignmentsRef.current)
            if (incoming !== local) {
                setAssignments(
                    record.assignments?.length ? ensureUniqueIds(record.assignments) : [createEmptyAssignment()]
                )
            }
            if ((record.notes || '') !== notesRef.current) {
                setNotes(record.notes || '')
            }
            if (record.plant_production && Object.keys(record.plant_production).length > 0) {
                const incomingProd = JSON.stringify(record.plant_production)
                const localProd = JSON.stringify(plantProductionRef.current)
                if (incomingProd !== localProd) {
                    setPlantProduction(record.plant_production)
                }
            }
        }, [])
    })

    // Realtime: refresh mixer counts
    const plantCodesRef = useRef([])
    plantCodesRef.current = plants.map((p) => p.plant_code).filter(Boolean)

    useRealtimeSubscription({
        table: 'mixers',
        enabled: !isLoading && plants.length > 0,
        onChange: useCallback(async () => {
            if (!plantCodesRef.current.length) return
            const counts = await ReportService.fetchActiveMixerCountsByPlant(plantCodesRef.current)
            setMixerCountsByPlant(counts)
        }, [])
    })

    // Realtime: refresh travel times
    useRealtimeSubscription({
        table: 'plant_travel_times',
        enabled: !isLoading,
        onChange: useCallback(async () => {
            try {
                await PlanService.fetchTravelTimes()
                setTravelTimes(PlanService.getTravelTimesMap())
            } catch (err) {
                console.warn('[usePlanData] realtime travel-times refresh failed:', err?.message || err)
            }
        }, [])
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
        planDate,
        plants,
        setPlantProduction,
        enabled: !isLoading && plants.length > 0
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
        plantProduction,
        plants,
        refreshSchedule,
        refreshTravelTimes,
        regionPlants,
        scheduleFileUpdatedAt,
        scheduleLastSyncedAt,
        setAssignments,
        setNotes,
        setPlantProduction,
        travelTimes,
        userId
    }
}
