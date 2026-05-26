import { useCallback, useEffect, useMemo, useState } from 'react'

import { SaturdayForecastService } from '../../services/SaturdayForecastService'
import { SATURDAY_FORECAST_EVENTS } from '../constants/saturdayForecastConstants'

const EMPTY_FORECASTS = Object.freeze({})

/**
 * Loads the per-plant Saturday operator forecasts for a given week.
 *
 * Consumers (Planner Saturday-override editor, analytics surfaces) pass the
 * Saturday they care about plus an optional plant-code scope. When either
 * input changes, the hook re-fetches; an unset `saturdayDate` short-circuits
 * to the empty result without hitting the network. Listens for the
 * `submitted` and `refreshed` events so freshly-saved entries appear without
 * a manual reload.
 *
 * @param {Object} params
 * @param {string} [params.saturdayDate] YYYY-MM-DD of the target Saturday.
 * @param {string[]} [params.plantCodes] Optional plant scope; omit / empty to fetch all.
 * @returns {{
 *   forecastsByPlant: Record<string, { operatorCount: number, submittedAt: string, submittedByUserId: string, submittedByName: string | null }>,
 *   loading: boolean,
 *   error: string | null,
 *   refresh: () => Promise<void>
 * }}
 */
export function useSaturdayForecasts({ saturdayDate, plantCodes } = {}) {
    const [forecastsByPlant, setForecastsByPlant] = useState(EMPTY_FORECASTS)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // A stable string key over plantCodes so the effect re-runs only when the
    // *content* of the array changes — passing a fresh array literal each
    // render would otherwise loop forever.
    const plantCodesKey = useMemo(() => {
        if (!Array.isArray(plantCodes) || plantCodes.length === 0) return ''
        return [...plantCodes].sort().join(',')
    }, [plantCodes])

    const fetchForecasts = useCallback(
        async ({ signal } = {}) => {
            if (!saturdayDate) {
                setForecastsByPlant(EMPTY_FORECASTS)
                setError(null)
                setLoading(false)
                return
            }
            setLoading(true)
            setError(null)
            try {
                const scopedCodes = plantCodesKey ? plantCodesKey.split(',') : undefined
                const result = await SaturdayForecastService.fetchForWeek(saturdayDate, scopedCodes)
                if (signal?.cancelled) return
                setForecastsByPlant(result && typeof result === 'object' ? result : EMPTY_FORECASTS)
            } catch (err) {
                if (signal?.cancelled) return
                setError(err?.message || 'Failed to load Saturday forecasts')
                setForecastsByPlant(EMPTY_FORECASTS)
            } finally {
                if (!signal?.cancelled) setLoading(false)
            }
        },
        [saturdayDate, plantCodesKey]
    )

    useEffect(() => {
        const signal = { cancelled: false }
        fetchForecasts({ signal })
        return () => {
            signal.cancelled = true
        }
    }, [fetchForecasts])

    useEffect(() => {
        if (!saturdayDate) return undefined
        const handleRefresh = () => {
            fetchForecasts()
        }
        window.addEventListener(SATURDAY_FORECAST_EVENTS.submitted, handleRefresh)
        window.addEventListener(SATURDAY_FORECAST_EVENTS.refreshed, handleRefresh)
        return () => {
            window.removeEventListener(SATURDAY_FORECAST_EVENTS.submitted, handleRefresh)
            window.removeEventListener(SATURDAY_FORECAST_EVENTS.refreshed, handleRefresh)
        }
    }, [fetchForecasts, saturdayDate])

    const refresh = useCallback(() => fetchForecasts(), [fetchForecasts])

    return { error, forecastsByPlant, loading, refresh }
}
