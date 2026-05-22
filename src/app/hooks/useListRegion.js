import { useEffect, useState } from 'react'

import { PlantService } from '../../services/PlantService'
import { normalizeToUpperCase } from '../constants/listViewConstants'

/**
 * Resolves region-allowed plant codes plus the full region plant list (with
 * districts) for the active region. Clears the caller's `selectedPlant` if
 * that plant is no longer in the allowed set after a region change.
 *
 * Exposes `regionReady` so callers can gate downstream rendering until the
 * region scope has resolved. Without this, a first paint or region switch
 * would briefly show the other region's data — the `useListData` items
 * are global to the user, and the per-region filter relies on
 * `regionPlantCodes` which starts as `null`. Returning the unfiltered list
 * during that window leaks cross-region tasks until the fetch lands.
 */
export function useListRegion({ regionCode, selectedPlant, setSelectedPlant }) {
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [regionPlants, setRegionPlants] = useState([])
    const [regionReady, setRegionReady] = useState(false)

    useEffect(() => {
        let cancelled = false
        // Flip back to "loading" on every region change so the UI shows
        // the skeleton during the swap instead of the previous region's
        // already-filtered data.
        setRegionReady(false)
        const fetchRegionData = async () => {
            try {
                const [codes, rPlants] = await Promise.all([
                    PlantService.getAllowedPlantCodes(regionCode || ''),
                    regionCode ? PlantService.fetchRegionPlants(regionCode).catch(() => []) : Promise.resolve([])
                ])
                if (cancelled) return
                setRegionPlantCodes(codes)
                setRegionPlants(rPlants)
                if (
                    selectedPlant &&
                    !selectedPlant.startsWith('DISTRICT:') &&
                    codes &&
                    !codes.has(normalizeToUpperCase(selectedPlant))
                )
                    setSelectedPlant('')
            } catch {
                if (!cancelled) setRegionPlantCodes(null)
            } finally {
                if (!cancelled) setRegionReady(true)
            }
        }
        fetchRegionData()
        return () => {
            cancelled = true
        }
    }, [regionCode, selectedPlant, setSelectedPlant])

    useEffect(() => {
        if (!selectedPlant || selectedPlant.startsWith('DISTRICT:') || !regionPlantCodes?.size) return
        if (!regionPlantCodes.has(normalizeToUpperCase(selectedPlant))) setSelectedPlant('')
    }, [regionPlantCodes, selectedPlant, setSelectedPlant])

    return { regionPlantCodes, regionPlants, regionReady }
}
