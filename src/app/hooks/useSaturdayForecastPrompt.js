import { useCallback, useEffect, useState } from 'react'

import { SaturdayForecastService } from '../../services/SaturdayForecastService'
import { SATURDAY_FORECAST_EVENTS } from '../constants/saturdayForecastConstants'
import { useAuth } from '../context/AuthContext'

const EMPTY_RESULT = Object.freeze({
    pendingPlants: [],
    saturdayDate: '',
    submittedPlants: [],
    weekIso: ''
})

/**
 * Drives the Dashboard Saturday-forecast banner.
 *
 * Fetches the authenticated manager's pending + already-submitted plants for
 * the upcoming Saturday and listens for the cross-window `submitted` event so
 * the banner disappears the moment the modal completes — no hard reload.
 *
 * Guarded by sign-in: with no `user.id` the hook returns the empty default
 * without touching the network, so it's safe to mount unconditionally on
 * Dashboard.
 *
 * @returns {{
 *   needsPrompt: boolean,
 *   pendingPlants: Array,
 *   submittedPlants: Array,
 *   weekIso: string,
 *   saturdayDate: string,
 *   loading: boolean,
 *   error: string | null,
 *   refresh: () => Promise<void>
 * }}
 */
export function useSaturdayForecastPrompt() {
    const { user } = useAuth() || {}
    const userId = user?.id || null

    const [data, setData] = useState(EMPTY_RESULT)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchPending = useCallback(
        async ({ signal } = {}) => {
            if (!userId) {
                setData(EMPTY_RESULT)
                setError(null)
                setLoading(false)
                return
            }
            setLoading(true)
            setError(null)
            try {
                const result = await SaturdayForecastService.fetchPendingForUser()
                if (signal?.cancelled) return
                setData({
                    pendingPlants: result.pendingPlants || [],
                    saturdayDate: result.saturdayDate || '',
                    submittedPlants: result.submittedPlants || [],
                    weekIso: result.weekIso || ''
                })
            } catch (err) {
                if (signal?.cancelled) return
                setError(err?.message || 'Failed to load Saturday forecast')
                setData(EMPTY_RESULT)
            } finally {
                if (!signal?.cancelled) setLoading(false)
            }
        },
        [userId]
    )

    useEffect(() => {
        const signal = { cancelled: false }
        fetchPending({ signal })
        return () => {
            signal.cancelled = true
        }
    }, [fetchPending])

    useEffect(() => {
        if (!userId) return undefined
        const handleSubmitted = () => {
            fetchPending()
        }
        window.addEventListener(SATURDAY_FORECAST_EVENTS.submitted, handleSubmitted)
        return () => {
            window.removeEventListener(SATURDAY_FORECAST_EVENTS.submitted, handleSubmitted)
        }
    }, [fetchPending, userId])

    const refresh = useCallback(() => fetchPending(), [fetchPending])

    return {
        error,
        loading,
        needsPrompt: data.pendingPlants.length > 0,
        pendingPlants: data.pendingPlants,
        refresh,
        saturdayDate: data.saturdayDate,
        submittedPlants: data.submittedPlants,
        weekIso: data.weekIso
    }
}
