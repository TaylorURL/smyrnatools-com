import { beforeEach, describe, expect, it, vi } from 'vitest'

import APIUtility from '../../utils/APIUtility'
import CrmService from '../CrmService'

vi.mock('../../utils/APIUtility', () => ({ default: { post: vi.fn() } }))

const ok = (data) => ({ json: { data }, res: { ok: true } })
const fail = (error) => ({ json: { error }, res: { ok: false } })

describe('CrmService — Phase 2 methods', () => {
    beforeEach(() => vi.clearAllMocks())

    // ── fetchMyDesk ──────────────────────────────────────────────────────────
    it('fetchMyDesk posts to /my-desk and returns the bundle', async () => {
        const bundle = { accounts: [], followups: [{ id: 'f1' }], opportunities: [], recentActivity: [] }
        APIUtility.post.mockResolvedValue(ok(bundle))

        const result = await CrmService.fetchMyDesk()

        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/my-desk', {})
        expect(result).toEqual(bundle)
    })

    it('fetchMyDesk throws on non-ok response', async () => {
        APIUtility.post.mockResolvedValue(fail('Unauthorized'))
        await expect(CrmService.fetchMyDesk()).rejects.toThrow('Unauthorized')
    })

    // ── saveFollowup ─────────────────────────────────────────────────────────
    it('saveFollowup throws when title is missing', async () => {
        await expect(CrmService.saveFollowup({ accountId: 'a1' })).rejects.toThrow('title is required')
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('saveFollowup posts and returns the saved row', async () => {
        const row = { id: 'fu1', status: 'open', title: 'Call back' }
        APIUtility.post.mockResolvedValue(ok(row))

        const result = await CrmService.saveFollowup({ accountId: 'a1', title: 'Call back' })

        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/save-followup',
            expect.objectContaining({ accountId: 'a1', title: 'Call back' })
        )
        expect(result).toEqual(row)
    })

    // ── bulkAssignSalesReps ──────────────────────────────────────────────────
    it('bulkAssignSalesReps throws when assignments array is empty', async () => {
        await expect(CrmService.bulkAssignSalesReps([])).rejects.toThrow('non-empty array')
        await expect(CrmService.bulkAssignSalesReps()).rejects.toThrow('non-empty array')
    })

    it('bulkAssignSalesReps posts assignments and returns matched/unmatched counts', async () => {
        const payload = { matched: 2, unmatched: ['Unknown Co'] }
        APIUtility.post.mockResolvedValue(ok(payload))

        const assignments = [
            { customerNum: '12345', repUserId: 'u1' },
            { customerName: 'Acme', repUserId: 'u2' }
        ]
        const result = await CrmService.bulkAssignSalesReps(assignments)

        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/bulk-assign-sales-reps', { assignments })
        expect(result.matched).toBe(2)
        expect(result.unmatched).toEqual(['Unknown Co'])
    })

    // ── saveAccount now accepts salesRepUserId ───────────────────────────────
    it('saveAccount includes salesRepUserId in the request body', async () => {
        APIUtility.post.mockResolvedValue(ok({ id: 'a1', name: 'Acme' }))
        await CrmService.saveAccount({ name: 'Acme', salesRepUserId: 'u1' })
        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/save-account',
            expect.objectContaining({ name: 'Acme', salesRepUserId: 'u1' })
        )
    })
})
