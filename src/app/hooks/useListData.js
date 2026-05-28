import { useCallback, useEffect, useState } from 'react'

import { ListService } from '../../services/ListService'

/**
 * Loads task list items + plants via ListService and re-renders consumers
 * whenever the service emits a `list-items-changed` event (after fetches and
 * optimistic mutations). Exposes a `reload` helper for explicit refresh after
 * create / external invalidation.
 */
export function useListData() {
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [, setTick] = useState(0)

    useEffect(() => {
        const bump = () => setTick((t) => t + 1)
        window.addEventListener('list-items-changed', bump)
        return () => window.removeEventListener('list-items-changed', bump)
    }, [])

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
