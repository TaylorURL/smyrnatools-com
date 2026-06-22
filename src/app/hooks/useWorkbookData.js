import { useCallback, useEffect, useRef, useState } from 'react'

import { OperatorService } from '../../services/OperatorService'
import { PlantService } from '../../services/PlantService'

export default function useWorkbookData({ config, regionPlantCodes }) {
    const [items, setItems] = useState([])
    const [plants, setPlants] = useState([])
    const [operators, setOperators] = useState([])
    const [loading, setLoading] = useState(true)
    const fetchedRef = useRef(false)

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const [fetchedItems, fetchedPlants, fetchedOperators] = await Promise.all([
                config.fetchItems(regionPlantCodes),
                PlantService.fetchAllPlants(),
                config.hasOperatorAssignment
                    ? OperatorService.getAllOperators()
                    : Promise.resolve([])
            ])

            let processed = fetchedItems ?? []
            if (config.attachIsVerified) {
                processed = processed.map(config.attachIsVerified)
            }
            if (config.postFetchCleanup) {
                const cleaned = await config.postFetchCleanup(processed)
                if (cleaned) processed = cleaned
            }

            setItems(processed)
            setPlants(fetchedPlants)
            setOperators(fetchedOperators)
        } catch (err) {
            console.error(`Workbook data fetch failed for ${config.key}:`, err)
        } finally {
            setLoading(false)
        }
    }, [config, regionPlantCodes])

    useEffect(() => {
        if (!fetchedRef.current) {
            fetchedRef.current = true
            loadAll()
        }
    }, [loadAll])

    return { items, loading, lookups: { operators, plants }, refresh: loadAll }
}
