import { useCallback, useEffect, useRef, useState } from 'react'

import CrmService from '../../services/CrmService'

const EMPTY_DESK = { accounts: [], followups: [], opportunities: [], recentActivity: [] }

/**
 * Fetches the current user's CRM desk summary on mount.
 * Returns the desk payload plus loading state.
 */
export function useMyDesk() {
    const [desk, setDesk] = useState(EMPTY_DESK)
    const [isLoading, setIsLoading] = useState(true)
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    const reload = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await CrmService.fetchMyDesk()
            if (mounted.current) setDesk(data ?? EMPTY_DESK)
        } catch {
            if (mounted.current) setDesk(EMPTY_DESK)
        } finally {
            if (mounted.current) setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        reload()
    }, [reload])

    return { desk, isLoading }
}
