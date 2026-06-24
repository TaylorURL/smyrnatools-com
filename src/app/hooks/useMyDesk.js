import { useCallback, useEffect, useRef, useState } from 'react'

import CrmService from '../../services/CrmService'

const EMPTY_DESK = { accounts: [], followups: [], opportunities: [], recentActivity: [] }

/**
 * Fetches the current user's CRM desk summary on mount.
 * Returns all four buckets (follow-ups, accounts, opportunities, recent activity)
 * plus loading/error state and a manual reload trigger.
 */
export function useMyDesk() {
    const [desk, setDesk] = useState(EMPTY_DESK)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    const reload = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await CrmService.fetchMyDesk()
            if (mounted.current) setDesk(data ?? EMPTY_DESK)
        } catch (err) {
            if (mounted.current) setError(err?.message || 'Failed to load desk')
        } finally {
            if (mounted.current) setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        reload()
    }, [reload])

    return { desk, error, isLoading, reload }
}
