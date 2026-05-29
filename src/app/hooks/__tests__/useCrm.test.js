import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CrmService from '../../../services/CrmService'
import { useCrm } from '../useCrm'

vi.mock('../../../services/CrmService', () => ({
    default: {
        fetchRoster: vi.fn(),
        fetchAccount: vi.fn(),
        saveAccount: vi.fn(),
        logInteraction: vi.fn(),
        fetchInteractions: vi.fn()
    }
}))

describe('useCrm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        CrmService.fetchRoster.mockResolvedValue([{ account_id: 'a1', customer_name: 'Acme' }])
        CrmService.fetchInteractions.mockResolvedValue([])
        CrmService.logInteraction.mockResolvedValue({ id: 'i1', interaction_type: 'meeting', occurred_at: 'now' })
    })

    it('loads the scoped roster on mount', async () => {
        const { result } = renderHook(() => useCrm({ scope: 'all' }))
        await waitFor(() => expect(result.current.roster).toHaveLength(1))
        expect(CrmService.fetchRoster).toHaveBeenCalledWith({ scope: 'all', includeActive: true })
    })

    it('optimistically prepends a logged interaction', async () => {
        const { result } = renderHook(() => useCrm({ scope: 'all' }))
        await waitFor(() => expect(result.current.roster).toHaveLength(1))
        await act(async () => {
            await result.current.logInteraction({ accountId: 'a1', interactionType: 'meeting' })
        })
        expect(result.current.interactionsByAccount.a1[0]).toMatchObject({ id: 'i1' })
    })
})
