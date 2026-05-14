import { useEffect, useState } from 'react'

import { PlantService } from '../../services/PlantService'
import { normalizeToUpperCase } from '../constants/listViewConstants'

/**
 * Resolves region-allowed plant codes plus the full region plant list (with
 * districts) for the active region. Clears the caller's `selectedPlant` if
 * that plant is no longer in the allowed set after a region change.
 */
export function useListRegion({ regionCode, selectedPlant, setSelectedPlant }) {
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [regionPlants, setRegionPlants] = useState([])

    useEffect(() => {
        let cancelled = false
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

    return { regionPlantCodes, regionPlants }
}
