import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CrmService from '../../../services/CrmService'
import { useOpportunities } from '../useOpportunities'

vi.mock('../../../services/CrmService', () => ({
    default: {
        deleteOpportunity: vi.fn(),
        fetchOpportunities: vi.fn(),
        moveStage: vi.fn(),
        saveOpportunity: vi.fn()
    }
}))

const REAL_OPP = { account_id: 'a1', id: 'o1', stage: 'new', title: 'Deal A' }
const VIRTUAL_OPP = {
    account_id: 'a2',
    account_name: 'Prospect Co',
    id: 'virtual:prospect:a2',
    owner_user_id: 'u1',
    source: 'prospect',
    stage: 'new',
    title: 'Prospect Opportunity',
    virtual: true
}
const VIRTUAL_WON_OPP = {
    account_id: 'a3',
    account_name: 'New Customer',
    id: 'virtual:order:a3',
    owner_user_id: 'u1',
    source: 'order',
    stage: 'won',
    title: 'Order Opportunity',
    virtual: true
}

describe('useOpportunities', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        CrmService.fetchOpportunities.mockResolvedValue([REAL_OPP])
        CrmService.saveOpportunity.mockResolvedValue({ id: 'o2', stage: 'new', title: 'Deal B' })
        CrmService.moveStage.mockResolvedValue({ id: 'o1', stage: 'won' })
        CrmService.deleteOpportunity.mockResolvedValue(true)
    })

    it('boardMode fetches all open opportunities on mount', async () => {
        const { result } = renderHook(() => useOpportunities({ boardMode: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(CrmService.fetchOpportunities).toHaveBeenCalledWith({ openOnly: true })
        expect(result.current.opportunities).toHaveLength(1)
        expect(result.current.opportunities[0]).toMatchObject(REAL_OPP)
    })

    it('accountId mode fetches by account on mount', async () => {
        renderHook(() => useOpportunities({ accountId: 'a1' }))
        await waitFor(() => expect(CrmService.fetchOpportunities).toHaveBeenCalledWith({ accountId: 'a1' }))
    })

    it('move on a real opp calls CrmService.moveStage then reloads', async () => {
        const { result } = renderHook(() => useOpportunities({ boardMode: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        CrmService.fetchOpportunities.mockClear()

        await act(async () => {
            await result.current.move(REAL_OPP, 'won')
        })

        expect(CrmService.moveStage).toHaveBeenCalledWith('o1', 'won', undefined)
        expect(CrmService.saveOpportunity).not.toHaveBeenCalled()
        expect(CrmService.fetchOpportunities).toHaveBeenCalledTimes(1)
    })

    it('move on a real opp forwards lostReason to moveStage', async () => {
        const { result } = renderHook(() => useOpportunities({ boardMode: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.move(REAL_OPP, 'lost', 'Budget cut')
        })

        expect(CrmService.moveStage).toHaveBeenCalledWith('o1', 'lost', 'Budget cut')
    })

    it('move on a virtual opp calls saveOpportunity at targetStage (not moveStage)', async () => {
        const { result } = renderHook(() => useOpportunities({ boardMode: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        CrmService.fetchOpportunities.mockClear()

        await act(async () => {
            await result.current.move(VIRTUAL_OPP, 'contacted')
        })

        expect(CrmService.moveStage).not.toHaveBeenCalled()
        expect(CrmService.saveOpportunity).toHaveBeenCalledWith({
            accountId: 'a2',
            ownerUserId: 'u1',
            source: 'prospect',
            stage: 'contacted',
            title: 'Prospect Opportunity'
        })
        expect(CrmService.fetchOpportunities).toHaveBeenCalledTimes(1)
    })

    it('materialize calls saveOpportunity at the opp current stage then reloads', async () => {
        const { result } = renderHook(() => useOpportunities({ boardMode: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        CrmService.fetchOpportunities.mockClear()

        await act(async () => {
            await result.current.materialize(VIRTUAL_WON_OPP)
        })

        expect(CrmService.moveStage).not.toHaveBeenCalled()
        expect(CrmService.saveOpportunity).toHaveBeenCalledWith({
            accountId: 'a3',
            ownerUserId: 'u1',
            source: 'order',
            stage: 'won',
            title: 'Order Opportunity'
        })
        expect(CrmService.fetchOpportunities).toHaveBeenCalledTimes(1)
    })

    it('hook exposes materialize in its return value', async () => {
        const { result } = renderHook(() => useOpportunities({ boardMode: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(typeof result.current.materialize).toBe('function')
    })

    it('save calls CrmService.saveOpportunity then reloads', async () => {
        const { result } = renderHook(() => useOpportunities({ accountId: 'a1' }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        CrmService.fetchOpportunities.mockClear()

        await act(async () => {
            await result.current.save({ accountId: 'a1', title: 'New deal' })
        })

        expect(CrmService.saveOpportunity).toHaveBeenCalledWith({ accountId: 'a1', title: 'New deal' })
        expect(CrmService.fetchOpportunities).toHaveBeenCalledTimes(1)
    })

    it('sets error state when fetch fails', async () => {
        CrmService.fetchOpportunities.mockRejectedValueOnce(new Error('Network error'))
        const { result } = renderHook(() => useOpportunities({ boardMode: true }))
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBe('Network error')
    })
})
