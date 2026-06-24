import { useCallback, useEffect, useRef, useState } from 'react'

import CrmService from '../../services/CrmService'

/**
 * Manages a list of follow-ups, scoped by optional `mineOnly` flag.
 * Provides `complete` for the single-item mutation surface CrmFollowupsPage
 * exposes today; create/edit/delete UI is not wired in this build.
 *
 * @param {{ mineOnly?: boolean }} options
 */
export function useFollowups({ mineOnly } = {}) {
    const [followups, setFollowups] = useState([])
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
            const data = await CrmService.fetchFollowups({ mineOnly })
            if (mounted.current) setFollowups(data)
        } catch (err) {
            if (mounted.current) setError(err?.message || 'Failed to load follow-ups')
        } finally {
            if (mounted.current) setIsLoading(false)
        }
    }, [mineOnly])

    useEffect(() => {
        reload()
    }, [reload])

    const complete = useCallback(
        async (id) => {
            await CrmService.completeFollowup(id)
            if (mounted.current) reload()
        },
        [reload]
    )

    return { complete, error, followups, isLoading }
}
