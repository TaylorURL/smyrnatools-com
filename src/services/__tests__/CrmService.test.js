import { beforeEach, describe, expect, it, vi } from 'vitest'

import APIUtility from '../../utils/APIUtility'
import CrmService from '../CrmService'

vi.mock('../../utils/APIUtility', () => ({ default: { post: vi.fn() } }))

describe('CrmService', () => {
    beforeEach(() => vi.clearAllMocks())

    it('fetchRoster posts scope and returns data array', async () => {
        APIUtility.post.mockResolvedValue({ res: { ok: true }, json: { data: [{ account_id: 'a1' }] } })
        const rows = await CrmService.fetchRoster({ scope: 'my-sales' })
        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/roster',
            expect.objectContaining({ scope: 'my-sales' })
        )
        expect(rows).toEqual([{ account_id: 'a1' }])
    })

    it('logInteraction validates accountId then posts', async () => {
        await expect(CrmService.logInteraction({ interactionType: 'call' })).rejects.toThrow('accountId')
        APIUtility.post.mockResolvedValue({ res: { ok: true }, json: { data: { id: 'i1' } } })
        const row = await CrmService.logInteraction({ accountId: 'a1', interactionType: 'meeting', comment: 'hi' })
        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/log-interaction',
            expect.objectContaining({ accountId: 'a1', interactionType: 'meeting' })
        )
        expect(row).toEqual({ id: 'i1' })
    })
})
