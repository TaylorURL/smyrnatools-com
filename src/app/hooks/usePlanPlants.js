import { useCallback, useEffect, useRef, useState } from 'react'

import { PlanService } from '../../services/PlanService'
import { PlantService } from '../../services/PlantService'
import { ReportService } from '../../services/ReportService'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Loads the plant list and per-plant active-mixer counts for the user's
 * currently-selected region (falling back to the user's permanent
 * assignment, then to all plants). Also wires the realtime subscriptions
 * that keep mixer counts and the travel-time cache fresh while the user
 * is on the planner.
 *
 * Returns a stable shape so the host hook can spread without conditional
 * branches: `isLoading` starts true and flips false once the initial
 * plants/counts resolve.
 */
export function usePlanPlants({ selectedRegionCode, userId }) {
    const [plants, setPlants] = useState([])
    const [regionPlants, setRegionPlants] = useState([])
    const [mixerCountsByPlant, setMixerCountsByPlant] = useState({})
    const [travelTimes, setTravelTimes] = useState({})
    const [isLoading, setIsLoading] = useState(true)

    /** Best-effort travel-time refresh. Swallows errors (e.g. Unauthorized
     *  when the session hasn't established yet, or transient network blips)
     *  so the planner doesn't surface a runtime error for non-critical data. */
    const refreshTravelTimes = useCallback(async () => {
        try {
            await PlanService.fetchTravelTimes()
            setTravelTimes(PlanService.getTravelTimesMap())
        } catch (err) {
            console.warn('[usePlanData] travel-times refresh failed:', err?.message || err)
        }
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

    const plantCodesRef = useRef([])
    plantCodesRef.current = plants.map((p) => p.plant_code).filter(Boolean)

    // Realtime: refresh mixer counts whenever any mixer row changes.
    useRealtimeSubscription({
        enabled: !isLoading && plants.length > 0,
        onChange: useCallback(async () => {
            if (!plantCodesRef.current.length) return
            const counts = await ReportService.fetchActiveMixerCountsByPlant(plantCodesRef.current)
            setMixerCountsByPlant(counts)
        }, []),
        table: 'mixers'
    })

    // Realtime: refresh travel times when the source table updates.
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

    return {
        isLoading,
        mixerCountsByPlant,
        plants,
        refreshTravelTimes,
        regionPlants,
        travelTimes
    }
}
