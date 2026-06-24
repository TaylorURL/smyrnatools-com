import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CrmService from '../../../services/CrmService'
import { useFollowups } from '../useFollowups'

vi.mock('../../../services/CrmService', () => ({
    default: {
        completeFollowup: vi.fn(),
        deleteFollowup: vi.fn(),
        fetchFollowups: vi.fn(),
        saveFollowup: vi.fn()
    }
}))

const FOLLOWUPS = [
    { due_at: '2026-01-01T12:00:00Z', id: 'f1', status: 'open', title: 'Call back Acme' },
    { due_at: null, id: 'f2', status: 'open', title: 'Send proposal' }
]

describe('useFollowups', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        CrmService.fetchFollowups.mockResolvedValue(FOLLOWUPS)
        CrmService.completeFollowup.mockResolvedValue({ id: 'f1', status: 'completed' })
    })

    it('loads follow-ups on mount with mineOnly flag', async () => {
        const { result } = renderHook(() => useFollowups({ mineOnly: true }))

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(CrmService.fetchFollowups).toHaveBeenCalledWith({ mineOnly: true })
        expect(result.current.followups).toEqual(FOLLOWUPS)
    })

    it('starts with isLoading true and clears error on success', async () => {
        const { result } = renderHook(() => useFollowups())
        expect(result.current.isLoading).toBe(true)
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBeNull()
    })

    it('complete calls the service then triggers a reload', async () => {
        const { result } = renderHook(() => useFollowups({ mineOnly: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        // Reset so we can observe the reload call
        CrmService.fetchFollowups.mockClear()

        await act(async () => {
            await result.current.complete('f1')
        })

        expect(CrmService.completeFollowup).toHaveBeenCalledWith('f1')
        // A reload fires after completion
        expect(CrmService.fetchFollowups).toHaveBeenCalledTimes(1)
    })

    it('exposes error state when the fetch fails', async () => {
        CrmService.fetchFollowups.mockRejectedValue(new Error('Server error'))
        const { result } = renderHook(() => useFollowups())
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBe('Server error')
        expect(result.current.followups).toEqual([])
    })
})
