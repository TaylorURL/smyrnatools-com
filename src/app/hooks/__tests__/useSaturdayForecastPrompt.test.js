/**
 * useSaturdayForecastPrompt drives the Dashboard banner — it must:
 *  - skip the fetch when no user is signed in
 *  - surface the API payload as `pendingPlants` / `submittedPlants` etc.
 *  - flip `needsPrompt` to true iff `pendingPlants.length > 0`
 *  - re-fetch on the `submitted` window event
 *  - capture errors in `error` rather than throwing through the hook
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SaturdayForecastService } from '../../../services/SaturdayForecastService'
import { SATURDAY_FORECAST_EVENTS } from '../../constants/saturdayForecastConstants'
import { useAuth } from '../../context/AuthContext'
import { useSaturdayForecastPrompt } from '../useSaturdayForecastPrompt'

vi.mock('../../../services/SaturdayForecastService', () => ({
    SaturdayForecastService: { fetchPendingForUser: vi.fn() }
}))

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn()
}))

const signedIn = { user: { id: 'user-1' } }
const signedOut = { user: null }

const samplePayload = {
    pendingPlants: [{ plantCode: '101', plantName: 'North' }],
    saturdayDate: '2026-05-30',
    submittedPlants: [{ operatorCount: 2, plantCode: '202' }],
    weekIso: '2026-W22'
}

describe('useSaturdayForecastPrompt', () => {
    beforeEach(() => {
        useAuth.mockReturnValue(signedIn)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('returns the empty default and skips the fetch when no user is signed in', async () => {
        useAuth.mockReturnValue(signedOut)

        const { result } = renderHook(() => useSaturdayForecastPrompt())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(SaturdayForecastService.fetchPendingForUser).not.toHaveBeenCalled()
        expect(result.current.needsPrompt).toBe(false)
        expect(result.current.pendingPlants).toEqual([])
        expect(result.current.submittedPlants).toEqual([])
        expect(result.current.weekIso).toBe('')
        expect(result.current.saturdayDate).toBe('')
        expect(result.current.error).toBeNull()
    })

    it('surfaces the API payload and flips needsPrompt when pending plants exist', async () => {
        SaturdayForecastService.fetchPendingForUser.mockResolvedValue(samplePayload)

        const { result } = renderHook(() => useSaturdayForecastPrompt())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(SaturdayForecastService.fetchPendingForUser).toHaveBeenCalledTimes(1)
        expect(result.current.needsPrompt).toBe(true)
        expect(result.current.pendingPlants).toEqual(samplePayload.pendingPlants)
        expect(result.current.submittedPlants).toEqual(samplePayload.submittedPlants)
        expect(result.current.weekIso).toBe('2026-W22')
        expect(result.current.saturdayDate).toBe('2026-05-30')
        expect(result.current.error).toBeNull()
    })

    it('leaves needsPrompt false when the user has no pending plants', async () => {
        SaturdayForecastService.fetchPendingForUser.mockResolvedValue({
            ...samplePayload,
            pendingPlants: []
        })

        const { result } = renderHook(() => useSaturdayForecastPrompt())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.needsPrompt).toBe(false)
        expect(result.current.submittedPlants).toEqual(samplePayload.submittedPlants)
    })

    it('captures errors in state without throwing through the hook', async () => {
        SaturdayForecastService.fetchPendingForUser.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useSaturdayForecastPrompt())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.error).toBe('boom')
        expect(result.current.needsPrompt).toBe(false)
        expect(result.current.pendingPlants).toEqual([])
    })

    it('re-fetches when the submitted event fires', async () => {
        SaturdayForecastService.fetchPendingForUser.mockResolvedValue(samplePayload)

        const { result } = renderHook(() => useSaturdayForecastPrompt())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })
        expect(SaturdayForecastService.fetchPendingForUser).toHaveBeenCalledTimes(1)

        SaturdayForecastService.fetchPendingForUser.mockResolvedValue({
            ...samplePayload,
            pendingPlants: []
        })

        await act(async () => {
            window.dispatchEvent(new CustomEvent(SATURDAY_FORECAST_EVENTS.submitted))
        })

        await waitFor(() => {
            expect(SaturdayForecastService.fetchPendingForUser).toHaveBeenCalledTimes(2)
            expect(result.current.needsPrompt).toBe(false)
        })
    })

    it('exposes a refresh function that re-invokes the fetch', async () => {
        SaturdayForecastService.fetchPendingForUser.mockResolvedValue(samplePayload)

        const { result } = renderHook(() => useSaturdayForecastPrompt())

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        await act(async () => {
            await result.current.refresh()
        })

        expect(SaturdayForecastService.fetchPendingForUser).toHaveBeenCalledTimes(2)
    })
})
