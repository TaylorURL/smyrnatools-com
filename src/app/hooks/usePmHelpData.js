import { useEffect, useState } from 'react'

import { Database } from '../../services/DatabaseService'

/** Loads the active mixer operators for a given plant code from the
 *  database, returning a normalized `{ employeeId, name, ... }` shape. */
async function fetchActiveMixerOperators(plantCode) {
    const { data: operatorsData } = await Database.from('operators')
        .select('employee_id, name, status, plant_code, smyrna_id, position')
        .eq('status', 'Active')
        .eq('plant_code', plantCode)
        .eq('position', 'Mixer Operator')
        .order('name')
    return (operatorsData || []).map((op) => ({
        employeeId: op.employee_id,
        name: op.name,
        plantCode: op.plant_code,
        position: op.position,
        smyrnaId: op.smyrna_id,
        status: op.status
    }))
}

/** Resolves the regional plant list — either the prop-supplied set, or
 *  the regions_plants table for the user's current plant. */
async function fetchRegionalPlants(currentPlantCode) {
    if (!currentPlantCode) return []
    const { data: regionData } = await Database.from('regions_plants')
        .select('region_id')
        .eq('plant_code', currentPlantCode)
        .limit(1)
        .maybeSingle()
    if (!regionData?.region_id) return []
    const { data: regionPlantsData } = await Database.from('regions_plants')
        .select('plant_code')
        .eq('region_id', regionData.region_id)
    const codes = (regionPlantsData || []).map((rp) => rp.plant_code).filter(Boolean)
    if (codes.length === 0) return []
    const { data: plantsData } = await Database.from('plants')
        .select('plant_code, plant_name')
        .in('plant_code', codes)
        .order('plant_code')
    return (plantsData || []).map((p) => ({ plantCode: p.plant_code, plantName: p.plant_name }))
}

/** Fetches the regional plants list and active operator roster for the
 *  Operators Sent To Help section. Falls back to the prop-supplied
 *  `regionalPlants` list when present. */
export function usePmHelpData(currentPlantCode, regionalPlants) {
    const [plants, setPlants] = useState([])
    const [operators, setOperators] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        async function fetchData() {
            try {
                if (regionalPlants && regionalPlants.length > 0) {
                    setPlants(
                        regionalPlants.map((p) => ({
                            plantCode: p.plantCode || p.plant_code,
                            plantName: p.plantName || p.plant_name
                        }))
                    )
                } else if (currentPlantCode) {
                    const nextPlants = await fetchRegionalPlants(currentPlantCode)
                    if (!mounted) return
                    setPlants(nextPlants)
                }
                if (currentPlantCode) {
                    const transformedOperators = await fetchActiveMixerOperators(currentPlantCode)
                    if (!mounted) return
                    setOperators(transformedOperators)
                }
            } catch (err) {
                /* swallow — preserves the original implementation's silent failure */
            } finally {
                if (mounted) setLoading(false)
            }
        }
        fetchData()
        return () => {
            mounted = false
        }
    }, [currentPlantCode, regionalPlants])

    const refreshOperators = async () => {
        if (!currentPlantCode) return
        setLoading(true)
        try {
            const transformedOperators = await fetchActiveMixerOperators(currentPlantCode)
            setOperators(transformedOperators)
        } catch (err) {
            console.error('Error refreshing operators:', err)
        } finally {
            setLoading(false)
        }
    }

    return { loading, operators, plants, refreshOperators, setLoading, setOperators }
}
