import { beforeEach, describe, expect, it, vi } from 'vitest'

import APIUtility from '../../utils/APIUtility'
import CrmService from '../CrmService'

vi.mock('../../utils/APIUtility', () => ({ default: { post: vi.fn() } }))

const ok = (data) => ({ res: { ok: true }, json: { data } })
const fail = (error) => ({ res: { ok: false }, json: { error } })

describe('CrmService — geocodeAccounts', () => {
    beforeEach(() => vi.clearAllMocks())

    it('posts to geocode-accounts with the supplied limit', async () => {
        APIUtility.post.mockResolvedValue(ok({ geocoded: 5, failed: 1, remaining: 0 }))

        const result = await CrmService.geocodeAccounts({ limit: 10 })

        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/geocode-accounts', { limit: 10 })
        expect(result).toEqual({ geocoded: 5, failed: 1, remaining: 0 })
    })

    it('uses the default limit of 15 when none is provided', async () => {
        APIUtility.post.mockResolvedValue(ok({ geocoded: 3, failed: 0, remaining: 0 }))

        await CrmService.geocodeAccounts()

        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/geocode-accounts', { limit: 15 })
    })

    it('returns the data object from the response', async () => {
        const payload = { geocoded: 8, failed: 2, remaining: 4 }
        APIUtility.post.mockResolvedValue(ok(payload))

        const result = await CrmService.geocodeAccounts({ limit: 10 })

        expect(result).toEqual(payload)
    })

    it('throws when the response is not ok', async () => {
        APIUtility.post.mockResolvedValue(fail('Failed to geocode accounts'))

        await expect(CrmService.geocodeAccounts()).rejects.toThrow('Failed to geocode accounts')
    })
})
