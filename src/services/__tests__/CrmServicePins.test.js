import { beforeEach, describe, expect, it, vi } from 'vitest'

import APIUtility from '../../utils/APIUtility'
import CrmService from '../CrmService'

vi.mock('../../utils/APIUtility', () => ({ default: { post: vi.fn() } }))

const ok = (data) => ({ res: { ok: true }, json: { data } })
const fail = (error) => ({ res: { ok: false }, json: { error } })

describe('CrmService — pin methods', () => {
    beforeEach(() => vi.clearAllMocks())

    // ── savePin ──────────────────────────────────────────────────────────────

    it('savePin throws when lat is non-finite', async () => {
        await expect(CrmService.savePin({ lat: NaN, lng: -89.5 })).rejects.toThrow('lat and lng must be finite numbers')
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('savePin throws when lng is non-finite', async () => {
        await expect(CrmService.savePin({ lat: 35.1, lng: Infinity })).rejects.toThrow(
            'lat and lng must be finite numbers'
        )
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('savePin throws when lat/lng are missing', async () => {
        await expect(CrmService.savePin({})).rejects.toThrow('lat and lng must be finite numbers')
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('savePin posts to /save-pin and returns the data row', async () => {
        const pinRow = { id: 'p1', lat: 35.1234, lng: -89.5678, comment: 'job note', created_by: 'u1' }
        APIUtility.post.mockResolvedValue(ok(pinRow))

        const result = await CrmService.savePin({ lat: 35.1234, lng: -89.5678, comment: 'job note' })

        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/save-pin',
            expect.objectContaining({ lat: 35.1234, lng: -89.5678, comment: 'job note' })
        )
        expect(result).toEqual(pinRow)
    })

    it('savePin throws the server error message on non-ok response', async () => {
        APIUtility.post.mockResolvedValue(fail('Unauthorized'))
        await expect(CrmService.savePin({ lat: 35.0, lng: -89.0 })).rejects.toThrow('Unauthorized')
    })

    // ── fetchPins ────────────────────────────────────────────────────────────

    it('fetchPins posts to /pins-list with default params', async () => {
        APIUtility.post.mockResolvedValue(ok([{ id: 'p1' }, { id: 'p2' }]))

        const rows = await CrmService.fetchPins()

        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/pins-list',
            expect.objectContaining({ mineOnly: false, limit: 200 })
        )
        expect(rows).toHaveLength(2)
    })

    it('fetchPins passes mineOnly and limit through', async () => {
        APIUtility.post.mockResolvedValue(ok([]))

        await CrmService.fetchPins({ mineOnly: true, limit: 50 })

        expect(APIUtility.post).toHaveBeenCalledWith(
            '/call-list-service/pins-list',
            expect.objectContaining({ mineOnly: true, limit: 50 })
        )
    })

    it('fetchPins returns empty array when data is null', async () => {
        APIUtility.post.mockResolvedValue({ res: { ok: true }, json: { data: null } })
        const rows = await CrmService.fetchPins()
        expect(rows).toEqual([])
    })

    // ── deletePin ────────────────────────────────────────────────────────────

    it('deletePin throws when id is missing', async () => {
        await expect(CrmService.deletePin(null)).rejects.toThrow('id is required')
        expect(APIUtility.post).not.toHaveBeenCalled()
    })

    it('deletePin posts to /delete-pin and returns true', async () => {
        APIUtility.post.mockResolvedValue({ res: { ok: true }, json: { success: true } })
        const result = await CrmService.deletePin('p1')
        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/delete-pin', { id: 'p1' })
        expect(result).toBe(true)
    })
})
