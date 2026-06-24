import { beforeEach, describe, expect, it, vi } from 'vitest'

import APIUtility from '../../utils/APIUtility'
import CrmService from '../CrmService'

vi.mock('../../utils/APIUtility', () => ({ default: { post: vi.fn() } }))

const ok = (data) => ({ json: { data }, res: { ok: true } })
const fail = (error) => ({ json: { error }, res: { ok: false } })

describe('CrmService — Phase 3 opportunity methods', () => {
    beforeEach(() => vi.clearAllMocks())

    // ── fetchOpportunities ───────────────────────────────────────────────────
    it('fetchOpportunities posts to /opportunities-list with accountId', async () => {
        APIUtility.post.mockResolvedValue(ok([{ id: 'o1', title: 'First deal' }]))

        const rows = await CrmService.fetchOpportunities({ accountId: 'a1' })

        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/opportunities-list',
            expect.objectContaining({ accountId: 'a1' })
        )
        expect(rows).toEqual([{ id: 'o1', title: 'First deal' }])
    })

    it('fetchOpportunities returns empty array when data is null', async () => {
        APIUtility.post.mockResolvedValue({ json: { data: null }, res: { ok: true } })
        const rows = await CrmService.fetchOpportunities()
        expect(rows).toEqual([])
    })

    it('fetchOpportunities throws on non-ok response', async () => {
        APIUtility.post.mockResolvedValue(fail('Unauthorized'))
        await expect(CrmService.fetchOpportunities()).rejects.toThrow('Unauthorized')
    })

    // ── saveOpportunity ──────────────────────────────────────────────────────
    it('saveOpportunity throws when title is missing', async () => {
        await expect(CrmService.saveOpportunity({ accountId: 'a1' })).rejects.toThrow('title is required')
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('saveOpportunity posts to /save-opportunity and returns the row', async () => {
        const row = { id: 'o1', stage: 'new', title: 'New deal' }
        APIUtility.post.mockResolvedValue(ok(row))

        const result = await CrmService.saveOpportunity({ accountId: 'a1', title: 'New deal' })

        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/save-opportunity',
            expect.objectContaining({ accountId: 'a1', title: 'New deal' })
        )
        expect(result).toEqual(row)
    })

    // ── moveStage ────────────────────────────────────────────────────────────
    it('moveStage throws when id is missing', async () => {
        await expect(CrmService.moveStage(null, 'won')).rejects.toThrow('id is required')
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('moveStage throws when stage is missing', async () => {
        await expect(CrmService.moveStage('o1', '')).rejects.toThrow('stage is required')
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('moveStage posts to /move-stage and returns the updated row', async () => {
        const row = { id: 'o1', stage: 'won' }
        APIUtility.post.mockResolvedValue(ok(row))

        const result = await CrmService.moveStage('o1', 'won')

        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/move-stage',
            expect.objectContaining({ id: 'o1', stage: 'won' })
        )
        expect(result).toEqual(row)
    })

    it('moveStage forwards lostReason when provided', async () => {
        APIUtility.post.mockResolvedValue(ok({ id: 'o1', stage: 'lost' }))
        await CrmService.moveStage('o1', 'lost', 'Price too high')
        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/move-stage',
            expect.objectContaining({ id: 'o1', lostReason: 'Price too high', stage: 'lost' })
        )
    })

    // ── deleteOpportunity ────────────────────────────────────────────────────
    it('deleteOpportunity throws when id is missing', async () => {
        await expect(CrmService.deleteOpportunity(null)).rejects.toThrow('id is required')
    })

    it('deleteOpportunity posts to /delete-opportunity and returns true', async () => {
        APIUtility.post.mockResolvedValue({ json: { success: true }, res: { ok: true } })
        const result = await CrmService.deleteOpportunity('o1')
        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/delete-opportunity', { id: 'o1' })
        expect(result).toBe(true)
    })
})
