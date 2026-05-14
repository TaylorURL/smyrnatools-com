import { useCallback, useEffect, useState } from 'react'

import { ListService } from '../../services/ListService'

/**
 * Loads task list items and plants via ListService and exposes a reload helper
 * used by the add sheet after a successful create.
 */
export function useListData() {
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const reload = useCallback(async () => {
        setIsLoading(true)
        try {
            await Promise.all([ListService.fetchListItems(), ListService.fetchPlants()])
            setPlants(ListService.plants)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        reload()
    }, [reload])

    return { isLoading, plants, reload, setIsLoading, setPlants }
}
